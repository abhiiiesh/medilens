import os
import json
import re
import time
import base64
import binascii
import httpx
from fastapi import FastAPI, HTTPException, Depends, File, UploadFile, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
import logging
from pydantic import BaseModel
from typing import Optional, List
import uvicorn
from dotenv import load_dotenv, find_dotenv
import models
from database import engine, get_db
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
import auth
import rag_database
from ai_client import generate_structured_json

# find_dotenv() traverses up the directory tree to find the .env file
load_dotenv(find_dotenv())

# Create SQLite tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="MediLens API - Production", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class AnalyzeRequest(BaseModel):
    image_base64: str

class AnalyzeResponse(BaseModel):
    is_medication: bool = True
    confidence_score: float | None = None
    drug_name: str | None = None
    dose_plain: str | None = None
    instructions: str | None = None
    warnings: list[str] = []
    interaction_alert: str | None = None
    speak_text: str
    is_high_risk: bool = False

class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class MedicationCreate(BaseModel):
    drug_name: str
    dosage: str
    frequency: str
    reminder_time: str | None = None

class MedicationResponse(MedicationCreate):
    id: int
    
    class Config:
        from_attributes = True

class AdherenceLogCreate(BaseModel):
    medication_id: int
    status: str

class SymptomLogCreate(BaseModel):
    symptom_description: str
    severity_score: int

class HealthMemoryCreate(BaseModel):
    memory_type: str
    description: str

class HealthMemoryResponse(HealthMemoryCreate):
    id: int
    class Config:
        from_attributes = True

class CaregiverLinkCreate(BaseModel):
    caregiver_email: str
    permissions: str = "read_adherence,read_alerts"

class CaregiverLinkResponse(CaregiverLinkCreate):
    id: int
    linked_at: str | None = None
    class Config:
        from_attributes = True

class HealthDocumentResponse(BaseModel):
    id: int
    filename: str
    status: str
    uploaded_at: str | None = None
    class Config:
        from_attributes = True

class FoodAnalysisResponse(BaseModel):
    food_name: str
    is_safe: bool
    safety_message: str
    interactions: list[str] = []

class PharmacyResponse(BaseModel):
    name: str
    address: str
    distance: str
    in_stock: bool
    price: str | None = None

class ClinicalFeedbackCreate(BaseModel):
    case_type: str = "analyze"
    model_output_summary: str
    reviewer_role: str = "patient"
    rating: int
    is_safe: str = "unknown"
    comments: str | None = None

class ClinicalFeedbackResponse(ClinicalFeedbackCreate):
    id: int
    created_at: str | None = None

# ---------------------------------------------------------------------------
# Risk Detection Layer (Middleware Guardrail)
# ---------------------------------------------------------------------------

HIGH_RISK_KEYWORDS = [
    "overdose", "insulin", "anticoagulant", "chemotherapy", "opioid", 
    "warfarin", "methotrexate", "fentanyl"
]

TELEMETRY = {
    "analyze_total": 0,
    "analyze_success": 0,
    "analyze_fail": 0,
    "analyze_high_risk": 0,
    "analyze_low_quality_rejects": 0,
    "latency_ms_samples": [],
}

def _record_latency(ms: float):
    TELEMETRY["latency_ms_samples"].append(ms)
    # Keep bounded in-memory samples for lightweight MVP telemetry.
    if len(TELEMETRY["latency_ms_samples"]) > 500:
        TELEMETRY["latency_ms_samples"] = TELEMETRY["latency_ms_samples"][-500:]

def _image_quality_precheck(image_base64: str) -> tuple[bool, str | None]:
    """Simple edge-safe quality guardrail for low-connectivity MVP deployments.
    This checks payload validity and a minimum byte-size threshold as a proxy for
    very blurry/over-compressed captures.
    """
    if not image_base64:
        return False, "Image payload is empty."
    try:
        raw = base64.b64decode(image_base64, validate=True)
    except (binascii.Error, ValueError):
        return False, "Image payload is not valid base64."
    if len(raw) < 12_000:
        return False, "Image quality is too low or too compressed. Please retake with better lighting and focus."
    return True, None

def apply_risk_detection(response_data: dict) -> dict:
    """Scans the AI output for high-risk medications and modifies the payload if detected.
       Also acts as the Medical Safety Gateway to reject low-confidence AI responses."""
       
    # CONFIDENCE SCORING GUARDRAIL
    confidence = response_data.get("confidence_score")
    if response_data.get("is_medication") and confidence is not None:
        if confidence < 0.90:
            # Reject the scan entirely if AI is not 90%+ confident
            return {
                "is_medication": False,
                "confidence_score": confidence,
                "drug_name": None,
                "dose_plain": None,
                "instructions": None,
                "warnings": ["AI Confidence too low."],
                "interaction_alert": None,
                "speak_text": "I could not confidently verify this medication. Please consult your pharmacist.",
                "is_high_risk": True
            }

    # HIGH-RISK KEYWORD GUARDRAIL
    combined_text = (
        (response_data.get("drug_name") or "") + " " +
        (response_data.get("instructions") or "") + " " +
        " ".join(response_data.get("warnings") or [])
    ).lower()

    if any(keyword in combined_text for keyword in HIGH_RISK_KEYWORDS):
        response_data["is_high_risk"] = True
        warning_msg = "⚠ High-risk medication detected. Please double-check dosage carefully."
        
        # Prepend to the TTS output and add to warnings array
        response_data["speak_text"] = warning_msg + " " + response_data.get("speak_text", "")
        
        if "warnings" not in response_data:
            response_data["warnings"] = []
        response_data["warnings"].insert(0, warning_msg)

    return response_data

# ---------------------------------------------------------------------------
# AI Prompts
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are a medication assistant helping elderly and visually impaired patients
understand their prescriptions. Always respond in plain language a 10-year-old could understand.
Never give medical advice or suggest changing doses. Only explain what is printed on the label.
If you cannot clearly read the label, say so in the speak_text field."""

USER_PROMPT_TEMPLATE = """The patient currently takes these medications: {medications}

[GROUNDED MEDICAL KNOWLEDGE DATABASE]
{grounded_context}
(Use the above database context to determine accurate interactions and warnings for the current medications.)

Look at this image carefully. 

IF THE IMAGE IS NOT A MEDICATION BOTTLE OR PRESCRIPTION:
Set "is_medication" to false. In "speak_text", describe what you see (e.g., "I see a coffee mug") and say "Please point the camera at a medication bottle to provide me with medication details." Leave all other fields null.

IF THE IMAGE IS A MEDICATION BOTTLE:
Extract and explain:
1. Drug name and dose — in plain words, no abbreviations
2. How and when to take it (morning/evening, with food, how many)
3. Any printed warnings — simplified to plain language
4. Any potential interaction with their listed current medications

Respond ONLY with valid JSON and absolutely nothing else:
{{
  "is_medication": true,
  "confidence_score": 0.95,
  "drug_name": "full drug name and dose in plain words",
  "dose_plain": "dose amount in plain words",
  "instructions": "plain English instructions",
  "warnings": ["warning 1", "warning 2"],
  "interaction_alert": "plain English interaction warning or null",
  "speak_text": "One complete sentence to read aloud",
  "is_high_risk": false
}}"""

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "MediLens Production API"}

@app.post("/auth/register", response_model=UserResponse)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    if len(user.password) < 8 or not re.search(r"[a-z]", user.password) or not re.search(r"[A-Z]", user.password) or not re.search(r"[0-9]", user.password) or not re.search(r"[^A-Za-z0-9]", user.password):
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long and contain an uppercase letter, a lowercase letter, a number, and a special character.")

    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pwd = auth.get_password_hash(user.password)
    new_user = models.User(email=user.email, hashed_password=hashed_pwd, full_name=user.full_name)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/auth/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
        
    access_token = auth.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=UserResponse)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.post("/medications", response_model=MedicationResponse)
def add_medication(med: MedicationCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_med = models.Medication(**med.model_dump(), owner_id=current_user.id)
    db.add(db_med)
    db.commit()
    db.refresh(db_med)
    return db_med

@app.get("/medications", response_model=list[MedicationResponse])
def get_medications(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.Medication).filter(models.Medication.owner_id == current_user.id).all()

@app.post("/log/adherence")
def log_adherence(log: AdherenceLogCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_log = models.AdherenceLog(**log.model_dump(), user_id=current_user.id)
    db.add(db_log)
    db.commit()
    return {"status": "success"}

@app.post("/log/symptom")
def log_symptom(log: SymptomLogCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_log = models.SymptomLog(**log.model_dump(), user_id=current_user.id)
    db.add(db_log)
    db.commit()
    return {"status": "success"}

@app.post("/health-memory", response_model=HealthMemoryResponse)
def add_health_memory(memory: HealthMemoryCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_mem = models.HealthMemory(**memory.model_dump(), user_id=current_user.id)
    db.add(db_mem)
    db.commit()
    db.refresh(db_mem)
    return db_mem

@app.get("/health-memory", response_model=list[HealthMemoryResponse])
def get_health_memory(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.HealthMemory).filter(models.HealthMemory.user_id == current_user.id).all()

@app.post("/caregivers", response_model=CaregiverLinkResponse)
def add_caregiver(link: CaregiverLinkCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_link = models.CaregiverLink(**link.model_dump(), patient_id=current_user.id)
    db.add(db_link)
    db.commit()
    db.refresh(db_link)
    # Return string representation of datetime
    return CaregiverLinkResponse(
        id=db_link.id,
        caregiver_email=db_link.caregiver_email,
        permissions=db_link.permissions,
        linked_at=str(db_link.linked_at)
    )

@app.get("/caregivers", response_model=list[CaregiverLinkResponse])
def get_caregivers(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    links = db.query(models.CaregiverLink).filter(models.CaregiverLink.patient_id == current_user.id).all()
    return [CaregiverLinkResponse(id=l.id, caregiver_email=l.caregiver_email, permissions=l.permissions, linked_at=str(l.linked_at)) for l in links]

# --- Agentic Health Vault ---

async def process_medical_document(doc_id: int, file_bytes: bytes, mime_type: str, user_id: int):
    # This runs in the background. We need a new DB session since the request one is closed.
    from database import SessionLocal
    db = SessionLocal()
    try:
        api_key = os.getenv("API_Key", "")
        if not api_key:
            raise ValueError("No API Key")
            
        import base64
        base64_data = base64.b64encode(file_bytes).decode('utf-8')
        
        prompt = """You are a specialized Medical Document AI. Read the attached medical document (lab report, discharge summary, etc).
Extract any explicitly stated patient ALLERGIES and CHRONIC CONDITIONS.
Return ONLY valid JSON matching this schema:
{
  "allergies": ["list of strings"],
  "conditions": ["list of strings"]
}
"""
        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": mime_type, "data": base64_data}}
                ]
            }],
            "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
                json=payload,
            )
            
        response_data = response.json()
        raw_text = response_data["candidates"][0]["content"]["parts"][0]["text"]
        
        import re
        json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
        if json_match:
            extracted = json.loads(json_match.group(0))
            # Write to Health Memory
            for allergy in extracted.get("allergies", []):
                new_mem = models.HealthMemory(user_id=user_id, memory_type="allergy", description=allergy)
                db.add(new_mem)
            for condition in extracted.get("conditions", []):
                new_mem = models.HealthMemory(user_id=user_id, memory_type="condition", description=condition)
                db.add(new_mem)
                
            doc = db.query(models.HealthDocument).filter(models.HealthDocument.id == doc_id).first()
            if doc:
                doc.status = "completed"
            db.commit()
            
    except Exception as e:
        logging.error(f"Failed to process document {doc_id}: {str(e)}")
        doc = db.query(models.HealthDocument).filter(models.HealthDocument.id == doc_id).first()
        if doc:
            doc.status = "failed"
            db.commit()
    finally:
        db.close()

@app.post("/vault/upload", response_model=HealthDocumentResponse)
async def upload_document(
    background_tasks: BackgroundTasks, 
    file: UploadFile = File(...), 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    # 1. Save metadata to DB
    new_doc = models.HealthDocument(user_id=current_user.id, filename=file.filename, status="processing")
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    
    # 2. Read file
    file_bytes = await file.read()
    mime_type = file.content_type or "image/jpeg"
    
    # 3. Queue async task
    background_tasks.add_task(process_medical_document, new_doc.id, file_bytes, mime_type, current_user.id)
    
    return HealthDocumentResponse(id=new_doc.id, filename=new_doc.filename, status=new_doc.status, uploaded_at=str(new_doc.uploaded_at))

@app.get("/vault/documents", response_model=list[HealthDocumentResponse])
def get_documents(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    docs = db.query(models.HealthDocument).filter(models.HealthDocument.user_id == current_user.id).all()
    return [HealthDocumentResponse(id=d.id, filename=d.filename, status=d.status, uploaded_at=str(d.uploaded_at)) for d in docs]

@app.get("/intelligence/insights")
async def get_insights(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    from datetime import datetime, timedelta
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    
    symptoms = db.query(models.SymptomLog).filter(models.SymptomLog.user_id == current_user.id, models.SymptomLog.timestamp >= seven_days_ago).all()
    adherences = db.query(models.AdherenceLog).filter(models.AdherenceLog.user_id == current_user.id, models.AdherenceLog.timestamp >= seven_days_ago).all()
    
    if not symptoms and not adherences:
        return {"insight": "Not enough data yet. Keep logging your symptoms and medication adherence to unlock AI behavioral insights!"}
        
    symptom_str = "\n".join([f"- {s.timestamp.strftime('%Y-%m-%d %H:%M')}: {s.symptom_description} (Severity: {s.severity_score}/10)" for s in symptoms])
    adherence_str = "\n".join([f"- {a.timestamp.strftime('%Y-%m-%d %H:%M')}: Med ID {a.medication_id} marked as {a.status}" for a in adherences])
    
    prompt = f"""You are MediLens AI, an advanced Longitudinal Health Intelligence agent. 
Analyze the user's past 7 days of behavioral data to find correlations between missed medications and reported symptoms.
If there's a correlation, point it out gently (e.g. "I noticed you reported dizziness on days you missed your Lisinopril").
If there's no obvious correlation, provide a brief encouraging message about their adherence or symptom trends.
Keep it under 3 sentences.

[ADHERENCE LOG]
{adherence_str if adherence_str else "No adherence logs."}

[SYMPTOM LOG]
{symptom_str if symptom_str else "No symptom logs."}
"""

    api_key = os.getenv("API_Key", "")
    if not api_key:
        return {"insight": "API Key missing for AI Insights."}
        
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.2}
                }
            )
        data = response.json()
        insight_text = data["candidates"][0]["content"]["parts"][0]["text"]
        return {"insight": insight_text.strip()}
    except Exception as e:
        return {"insight": "Failed to generate AI insights at this time."}

@app.post("/intelligence/food", response_model=FoodAnalysisResponse)
async def analyze_food(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    api_key = os.getenv("API_Key", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="Google API Key not found.")

    # Gather context from Health Memory and Medications
    memories = db.query(models.HealthMemory).filter(models.HealthMemory.user_id == current_user.id).all()
    allergies = [m.description for m in memories if m.memory_type == "allergy"]
    conditions = [m.description for m in memories if m.memory_type == "condition"]
    
    meds = db.query(models.Medication).filter(models.Medication.owner_id == current_user.id).all()
    med_names = [m.drug_name for m in meds]

    try:
        file_bytes = await file.read()
        import base64
        base64_data = base64.b64encode(file_bytes).decode('utf-8')
        mime_type = file.content_type or "image/jpeg"
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read image: {str(e)}")

    prompt = f"""You are MediLens Nutritional Intelligence. Analyze this image of a meal or food item.
    
Patient Profile:
- Known Allergies: {', '.join(allergies) if allergies else 'None'}
- Chronic Conditions: {', '.join(conditions) if conditions else 'None'}
- Current Medications: {', '.join(med_names) if med_names else 'None'}

Determine if the food in the image is safe for this patient based on their profile.
For example, if they take Statins and the food is Grapefruit, that is an interaction.
If they are diabetic and the food is highly sugary, warn them gently.

Return ONLY valid JSON:
{{
  "food_name": "Identify the primary food items",
  "is_safe": true or false,
  "safety_message": "A friendly, plain-language message about whether it's safe to eat or not.",
  "interactions": ["List of specific interactions, or empty list"]
}}
"""
    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": mime_type, "data": base64_data}}
            ]
        }],
        "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"}
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
                json=payload,
            )
        response_data = response.json()
        raw_text = response_data["candidates"][0]["content"]["parts"][0]["text"]
        
        import re
        json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
        if json_match:
            return FoodAnalysisResponse(**json.loads(json_match.group(0)))
        else:
            raise Exception("No JSON found")
    except Exception as e:
        logging.error(f"Food analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to analyze food.")

@app.get("/pharmacy/inventory/{drug_name}", response_model=list[PharmacyResponse])
def get_pharmacy_inventory(drug_name: str, location: Optional[str] = "Springfield", db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Mock data generation based on drug name hash to ensure deterministic "shortages"
    # For a real application, this would call a PBM or pharmacy inventory API
    import hashlib
    import random
    
    # Use drug name to seed the random generator for consistent mock results
    seed_str = drug_name.lower().strip()
    seed = int(hashlib.md5(seed_str.encode()).hexdigest(), 16) % 10000
    random.seed(seed)
    
    # 20% chance of a "severe shortage" where almost nowhere has it
    is_shortage = random.random() < 0.2
    
    pharmacies = [
        {"name": "Walgreens Pharmacy", "address": f"123 Main St, {location}", "distance": "0.8 miles"},
        {"name": "CVS Pharmacy", "address": f"456 Oak Rd, {location}", "distance": "1.2 miles"},
        {"name": f"{location} Local Rx", "address": f"789 Pine Ave, {location}", "distance": "2.5 miles"},
        {"name": "Walmart Pharmacy", "address": f"100 Retail Way, {location}", "distance": "4.1 miles"}
    ]
    
    results = []
    for p in pharmacies:
        # If there's a shortage, 80% chance this pharmacy is out of stock
        # If normal, 10% chance out of stock
        out_of_stock_prob = 0.8 if is_shortage else 0.1
        in_stock = random.random() > out_of_stock_prob
        
        base_price = random.uniform(10.0, 150.0)
        price_str = f"${base_price:.2f}" if in_stock else None
        
        results.append({
            "name": p["name"],
            "address": p["address"],
            "distance": p["distance"],
            "in_stock": in_stock,
            "price": price_str
        })
        
    # Sort by in_stock first, then distance
    results.sort(key=lambda x: (not x["in_stock"], float(x["distance"].split()[0])))
    return [PharmacyResponse(**r) for r in results]

@app.post("/pharmacy/addons")
async def get_ai_addons(payload: dict):
    """Uses Gemini AI to recommend complementary add-on products based on cart contents."""
    drug_names = payload.get("drugs", [])
    api_key = os.getenv("API_Key", "")
    if not api_key or not drug_names:
        return [{"name": "Hydration Salts", "price": 5.99}, {"name": "Probiotics 30ct", "price": 15.50}, {"name": "Thermometer", "price": 12.00}]

    prompt = f"""A patient is buying: {', '.join(drug_names)}.
Suggest exactly 3 complementary OTC health products that would be genuinely useful alongside these medications.
Return ONLY a JSON array (no markdown) like:
[
  {{"name": "Product Name", "price": 9.99}},
  {{"name": "Product Name 2", "price": 14.99}},
  {{"name": "Product Name 3", "price": 7.49}}
]
"""
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
                json={"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.4, "responseMimeType": "application/json"}}
            )
        data = res.json()
        raw = data["candidates"][0]["content"]["parts"][0]["text"]
        addons = json.loads(raw)
        return addons[:3]
    except Exception as e:
        logging.error(f"AI addons failed: {e}")
        return [{"name": "Hydration Salts", "price": 5.99}, {"name": "Probiotics 30ct", "price": 15.50}, {"name": "Thermometer", "price": 12.00}]

class ParsedDrug(BaseModel):
    drug_name: str | None = None
    dosage: str | None = None
    frequency: str | None = None

class ParsePrescriptionResponse(BaseModel):
    medications: list[ParsedDrug] = []

PARSE_PROMPT = """You are MediLens OCR. Extract the prescription details from this document.
There may be multiple medications listed.
CRITICAL: If any text is in another language (e.g., Hindi, Spanish), you MUST translate it to English.
Return ONLY valid JSON matching this schema:
{
  "medications": [
    {
      "drug_name": "Name of the drug (e.g. Lisinopril)",
      "dosage": "Amount (e.g. 10mg)",
      "frequency": "How often (e.g. Daily or Nightly)"
    }
  ]
}
Do not include markdown tags like ```json."""

@app.post("/parse-prescription", response_model=ParsePrescriptionResponse)
async def parse_prescription(file: UploadFile = File(...)):
    # DEMO MODE fallback
    if os.getenv("DEMO_MODE", "false").lower() == "true":
        return ParsePrescriptionResponse(medications=[
            ParsedDrug(drug_name="Metformin", dosage="500mg", frequency="Daily")
        ])

    api_key = os.getenv("API_Key", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="Google API Key not found.")

    try:
        file_bytes = await file.read()
        import base64
        base64_data = base64.b64encode(file_bytes).decode('utf-8')
        mime_type = file.content_type or "image/jpeg"
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

    payload = {
        "contents": [{
            "parts": [
                {"text": PARSE_PROMPT},
                {
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": base64_data
                    }
                }
            ]
        }],
        "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
                json=payload,
            )
        
        response_data = response.json()
        
        if "error" in response_data:
            logging.error(f"Gemini API Error: {response_data['error']}")
            raise HTTPException(status_code=502, detail="Gemini API returned an error.")

        raw_text = response_data["candidates"][0]["content"]["parts"][0]["text"]
        
        # Robust JSON extraction
        import re
        json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
        if not json_match:
            logging.error(f"Failed to find JSON in AI response. Raw output:\n{raw_text}")
            raise HTTPException(status_code=422, detail="AI did not return valid JSON.")
            
        json_str = json_match.group(0)
        return ParsePrescriptionResponse(**json.loads(json_str))
        
    except Exception as e:
        logging.error(f"Parse Endpoint Exception: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Parsing failed: {str(e)}")

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_medication(
    request_ctx: Request,
    request: AnalyzeRequest, 
    db: Session = Depends(get_db),
    # Temporarily optional to support the current frontend during transition, 
    # but defaults to real DB integration when token is provided.
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Accepts a base64-encoded JPEG. Calls Gemini API, applies Risk Detection Layer,
    and returns structured JSON for the React frontend.
    """
    
    TELEMETRY["analyze_total"] += 1
    start = time.perf_counter()

    # DEMO MODE fallback
    if os.getenv("DEMO_MODE", "false").lower() == "true":
        demo_payload = {
            "drug_name": "Lisinopril 10mg",
            "dose_plain": "Ten milligrams",
            "instructions": "Take one tablet by mouth every morning.",
            "warnings": ["May cause dizziness."],
            "interaction_alert": "Interacts with ibuprofen.",
            "speak_text": "This is Lisinopril, ten milligrams. Take one tablet every morning.",
            "is_high_risk": False
        }
        safe_demo_payload = apply_risk_detection(demo_payload)
        TELEMETRY["analyze_success"] += 1
        _record_latency((time.perf_counter() - start) * 1000)
        return AnalyzeResponse(**safe_demo_payload)

    quality_ok, quality_msg = _image_quality_precheck(request.image_base64)
    if not quality_ok:
        TELEMETRY["analyze_low_quality_rejects"] += 1
        TELEMETRY["analyze_fail"] += 1
        _record_latency((time.perf_counter() - start) * 1000)
        return AnalyzeResponse(
            is_medication=False,
            confidence_score=0.0,
            drug_name=None,
            dose_plain=None,
            instructions=None,
            warnings=[quality_msg or "Image quality too low."],
            interaction_alert=None,
            speak_text="I couldn't read the label clearly. Please move closer, improve lighting, and retake the photo.",
            is_high_risk=True,
        )

    # Pull medications and RAG context directly from the persistent database
    user_meds = []
    rag_contexts = []
    meds = db.query(models.Medication).filter(models.Medication.owner_id == current_user.id).all()
    for m in meds:
        user_meds.append(m.drug_name)
        rag_contexts.append(f"Knowledge for {m.drug_name}:\n{rag_database.retrieve_drug_context(m.drug_name)}")

    meds_str = ", ".join(user_meds) if user_meds else "none listed"
    rag_str = "\n".join(rag_contexts) if rag_contexts else "No specific ground truth database context."

    prompt = SYSTEM_PROMPT + "\n\n" + USER_PROMPT_TEMPLATE.format(
        medications=meds_str,
        grounded_context=rag_str
    ) + "\n\nIf the visible text is in a non-English language, translate it to English before extraction."

    try:
        parsed_json = await generate_structured_json(
            prompt,
            image_base64=request.image_base64,
            mime_type="image/jpeg",
            temperature=0.1,
            trace_id=request_ctx.headers.get("X-Request-ID"),
        )

        # If it's a medication, apply risk detection
        if parsed_json.get("is_medication", True):
            parsed_json = apply_risk_detection(parsed_json)
        if parsed_json.get("is_high_risk"):
            TELEMETRY["analyze_high_risk"] += 1

        TELEMETRY["analyze_success"] += 1
        _record_latency((time.perf_counter() - start) * 1000)
        return AnalyzeResponse(**parsed_json)

    except HTTPException:
        TELEMETRY["analyze_fail"] += 1
        _record_latency((time.perf_counter() - start) * 1000)
        raise
    except Exception as e:
        TELEMETRY["analyze_fail"] += 1
        _record_latency((time.perf_counter() - start) * 1000)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.get("/telemetry/summary")
def telemetry_summary(current_user: models.User = Depends(auth.get_current_user)):
    samples = TELEMETRY["latency_ms_samples"]
    p95 = sorted(samples)[int(0.95 * (len(samples) - 1))] if len(samples) > 1 else (samples[0] if samples else 0.0)
    return {
        "analyze_total": TELEMETRY["analyze_total"],
        "analyze_success": TELEMETRY["analyze_success"],
        "analyze_fail": TELEMETRY["analyze_fail"],
        "analyze_low_quality_rejects": TELEMETRY["analyze_low_quality_rejects"],
        "analyze_high_risk": TELEMETRY["analyze_high_risk"],
        "success_rate": round((TELEMETRY["analyze_success"] / TELEMETRY["analyze_total"]), 4) if TELEMETRY["analyze_total"] else 0.0,
        "p95_latency_ms": round(p95, 2),
        "samples": len(samples),
    }

@app.post("/feedback/clinical", response_model=ClinicalFeedbackResponse)
def add_clinical_feedback(
    payload: ClinicalFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if payload.rating < 1 or payload.rating > 5:
        raise HTTPException(status_code=400, detail="rating must be between 1 and 5")
    if payload.is_safe not in {"yes", "no", "unknown"}:
        raise HTTPException(status_code=400, detail="is_safe must be one of yes/no/unknown")

    row = models.ClinicalFeedback(
        user_id=current_user.id,
        case_type=payload.case_type,
        model_output_summary=payload.model_output_summary[:500],
        reviewer_role=payload.reviewer_role,
        rating=payload.rating,
        is_safe=payload.is_safe,
        comments=(payload.comments[:1000] if payload.comments else None),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return ClinicalFeedbackResponse(
        id=row.id,
        case_type=row.case_type,
        model_output_summary=row.model_output_summary,
        reviewer_role=row.reviewer_role,
        rating=row.rating,
        is_safe=row.is_safe,
        comments=row.comments,
        created_at=str(row.created_at),
    )

@app.get("/feedback/clinical")
def list_clinical_feedback(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    rows = (
        db.query(models.ClinicalFeedback)
        .filter(models.ClinicalFeedback.user_id == current_user.id)
        .order_by(models.ClinicalFeedback.created_at.desc())
        .limit(min(max(limit, 1), 200))
        .all()
    )
    return [
        {
            "id": r.id,
            "case_type": r.case_type,
            "reviewer_role": r.reviewer_role,
            "rating": r.rating,
            "is_safe": r.is_safe,
            "comments": r.comments,
            "created_at": str(r.created_at),
        }
        for r in rows
    ]

@app.get("/feedback/clinical/summary")
def clinical_feedback_summary(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    from datetime import datetime, timedelta
    since = datetime.utcnow() - timedelta(days=max(1, min(days, 180)))
    rows = db.query(models.ClinicalFeedback).filter(
        models.ClinicalFeedback.user_id == current_user.id,
        models.ClinicalFeedback.created_at >= since
    ).all()

    if not rows:
        return {
            "window_days": max(1, min(days, 180)),
            "entries": 0,
            "avg_rating": None,
            "unsafe_flags": 0,
            "safe_flags": 0,
            "unknown_flags": 0,
            "by_case_type": {},
            "by_reviewer_role": {},
        }

    def count_by(attr: str):
        out: dict[str, int] = {}
        for r in rows:
            k = (getattr(r, attr, None) or "unknown").lower()
            out[k] = out.get(k, 0) + 1
        return out

    safe_flags = sum(1 for r in rows if (r.is_safe or "").lower() == "yes")
    unsafe_flags = sum(1 for r in rows if (r.is_safe or "").lower() == "no")
    unknown_flags = sum(1 for r in rows if (r.is_safe or "").lower() not in {"yes", "no"})
    avg_rating = round(sum(r.rating for r in rows) / len(rows), 2)

    return {
        "window_days": max(1, min(days, 180)),
        "entries": len(rows),
        "avg_rating": avg_rating,
        "unsafe_flags": unsafe_flags,
        "safe_flags": safe_flags,
        "unknown_flags": unknown_flags,
        "by_case_type": count_by("case_type"),
        "by_reviewer_role": count_by("reviewer_role"),
    }

@app.get("/pilot/metrics")
def pilot_metrics(days: int = 7, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    from datetime import datetime, timedelta
    since = datetime.utcnow() - timedelta(days=max(1, min(days, 90)))
    adherences = db.query(models.AdherenceLog).filter(
        models.AdherenceLog.user_id == current_user.id,
        models.AdherenceLog.timestamp >= since
    ).all()
    symptoms = db.query(models.SymptomLog).filter(
        models.SymptomLog.user_id == current_user.id,
        models.SymptomLog.timestamp >= since
    ).all()
    feedback_rows = db.query(models.ClinicalFeedback).filter(
        models.ClinicalFeedback.user_id == current_user.id,
        models.ClinicalFeedback.created_at >= since
    ).all()

    taken = sum(1 for a in adherences if (a.status or "").lower() == "taken")
    missed = sum(1 for a in adherences if (a.status or "").lower() == "missed")
    adherence_rate = round((taken / (taken + missed)), 4) if (taken + missed) else 0.0

    avg_symptom = round(sum(s.severity_score for s in symptoms) / len(symptoms), 2) if symptoms else None
    feedback_count = len(feedback_rows)
    avg_rating = round(sum(f.rating for f in feedback_rows) / feedback_count, 2) if feedback_count else None
    unsafe_flags = sum(1 for f in feedback_rows if (f.is_safe or "").lower() == "no")

    return {
        "window_days": max(1, min(days, 90)),
        "adherence": {
            "logs_total": len(adherences),
            "taken": taken,
            "missed": missed,
            "adherence_rate": adherence_rate,
        },
        "symptoms": {
            "logs_total": len(symptoms),
            "avg_severity": avg_symptom,
        },
        "clinical_feedback": {
            "entries": feedback_count,
            "avg_rating": avg_rating,
            "unsafe_flags": unsafe_flags,
        }
    }



@app.get("/pilot/metrics/cohort")
def pilot_metrics_cohort(days: int = 7, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Aggregate pilot metrics across all users (reviewer/admin use)."""
    if (current_user.role or "patient") not in {"admin", "caregiver"}:
        raise HTTPException(status_code=403, detail="Insufficient role for cohort metrics")

    from datetime import datetime, timedelta
    since = datetime.utcnow() - timedelta(days=max(1, min(days, 90)))

    adherences = db.query(models.AdherenceLog).filter(models.AdherenceLog.timestamp >= since).all()
    symptoms = db.query(models.SymptomLog).filter(models.SymptomLog.timestamp >= since).all()
    feedback_rows = db.query(models.ClinicalFeedback).filter(models.ClinicalFeedback.created_at >= since).all()

    taken = sum(1 for a in adherences if (a.status or "").lower() == "taken")
    missed = sum(1 for a in adherences if (a.status or "").lower() == "missed")
    adherence_rate = round((taken / (taken + missed)), 4) if (taken + missed) else 0.0

    avg_symptom = round(sum(s.severity_score for s in symptoms) / len(symptoms), 2) if symptoms else None
    feedback_count = len(feedback_rows)
    avg_rating = round(sum(f.rating for f in feedback_rows) / feedback_count, 2) if feedback_count else None
    unsafe_flags = sum(1 for f in feedback_rows if (f.is_safe or "").lower() == "no")

    return {
        "window_days": max(1, min(days, 90)),
        "adherence": {"logs_total": len(adherences), "taken": taken, "missed": missed, "adherence_rate": adherence_rate},
        "symptoms": {"logs_total": len(symptoms), "avg_severity": avg_symptom},
        "clinical_feedback": {"entries": feedback_count, "avg_rating": avg_rating, "unsafe_flags": unsafe_flags},
    }


@app.get("/pilot/export")
def pilot_export(days: int = 7, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Export user-scoped pilot records for offline analysis."""
    from datetime import datetime, timedelta
    since = datetime.utcnow() - timedelta(days=max(1, min(days, 90)))

    adherences = db.query(models.AdherenceLog).filter(
        models.AdherenceLog.user_id == current_user.id,
        models.AdherenceLog.timestamp >= since,
    ).all()
    symptoms = db.query(models.SymptomLog).filter(
        models.SymptomLog.user_id == current_user.id,
        models.SymptomLog.timestamp >= since,
    ).all()
    feedback_rows = db.query(models.ClinicalFeedback).filter(
        models.ClinicalFeedback.user_id == current_user.id,
        models.ClinicalFeedback.created_at >= since,
    ).all()

    return {
        "window_days": max(1, min(days, 90)),
        "user_id": current_user.id,
        "adherence_logs": [
            {"id": a.id, "medication_id": a.medication_id, "timestamp": str(a.timestamp), "status": a.status}
            for a in adherences
        ],
        "symptom_logs": [
            {"id": s.id, "timestamp": str(s.timestamp), "symptom_description": s.symptom_description, "severity_score": s.severity_score}
            for s in symptoms
        ],
        "clinical_feedback": [
            {"id": f.id, "case_type": f.case_type, "rating": f.rating, "is_safe": f.is_safe, "comments": f.comments, "created_at": str(f.created_at)}
            for f in feedback_rows
        ],
    }
@app.get("/pilot/report")
def pilot_report(days: int = 7, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Unified pilot-readout endpoint for quick weekly reporting."""
    metrics = pilot_metrics(days=days, db=db, current_user=current_user)
    telemetry = telemetry_summary(current_user=current_user)
    feedback_preview = list_clinical_feedback(limit=10, db=db, current_user=current_user)
    return {
        "window_days": metrics["window_days"],
        "reliability": {
            "analyze_success_rate": telemetry["success_rate"],
            "analyze_p95_latency_ms": telemetry["p95_latency_ms"],
            "analyze_total": telemetry["analyze_total"],
            "analyze_fail": telemetry["analyze_fail"],
            "low_quality_rejects": telemetry["analyze_low_quality_rejects"],
        },
        "outcomes": metrics,
        "latest_feedback": feedback_preview,
    }

@app.get("/pilot/report/markdown")
def pilot_report_markdown(days: int = 7, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Return a markdown-formatted weekly pilot summary for quick sharing."""
    data = pilot_report(days=days, db=db, current_user=current_user)
    rel = data.get("reliability", {})
    out = data.get("outcomes", {})
    adh = out.get("adherence", {})
    sym = out.get("symptoms", {})
    cfb = out.get("clinical_feedback", {})
    md = f"""# MediLens Pilot Weekly Report

## Scope
- Window (days): **{data.get('window_days')}**

## Reliability
- Analyze success rate: **{rel.get('analyze_success_rate')}**
- Analyze p95 latency (ms): **{rel.get('analyze_p95_latency_ms')}**
- Analyze failures: **{rel.get('analyze_fail')}**
- Low-quality rejects: **{rel.get('low_quality_rejects')}**

## Outcomes
- Adherence rate: **{adh.get('adherence_rate')}**
- Avg symptom severity: **{sym.get('avg_severity')}**
- Clinical feedback avg rating: **{cfb.get('avg_rating')}**
- Unsafe flags: **{cfb.get('unsafe_flags')}**
"""
    return {"markdown": md, "window_days": data.get("window_days")}

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
