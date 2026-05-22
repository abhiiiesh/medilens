# 🔬 MediLens — AI Medication Intelligence

MediLens is a multimodal AI health assistant powered by **Gemma 4 (gemma-4-31b-it)** that helps patients safely identify medications, parse handwritten prescriptions, check food safety, and build a personal health memory — all from their phone.

![MediLens Banner](docs/cover.png)

## 🌟 Key Features

| Feature | How It Works |
|---------|-------------|
| 📸 **Identify Medication** | Point camera at any pill bottle → Gemma 4 reads label in plain English, flags high-risk drugs, speaks result aloud |
| 📄 **Prescription OCR** | Upload a photo of a handwritten prescription → Gemma 4 extracts all medications, auto-fills scheduling form |
| 🍎 **Food as Medicine** | Photograph your meal → cross-referenced against your allergies & medications for interaction warnings |
| 🧠 **Health Memory Vault** | Upload lab reports & discharge docs → Gemma 4 extracts structured health facts (allergies, diagnoses, meds) |
| 📊 **Longitudinal Insights** | Weekly correlation analysis between missed doses and reported symptoms |

## 🏗️ Architecture

```
React Frontend (Vite + Tailwind)
        ↕ REST API
FastAPI Backend (Python 3.11)
        ↕ Google Generative Language API
Gemma 4 — gemma-4-31b-it
  • 256K token context window
  • Native multimodal (image + text)
  • Structured JSON output
  • Native function calling
        ↕
SQLite + SQLAlchemy (local health data)
RAG Database (clinical pharmacology)
```

## 🤖 Gemma 4 Usage

All AI features call `gemma-4-31b-it` via the Google Generative Language API:

```python
# backend/app.py
GEMMA4_MODEL = "gemma-4-31b-it"
GEMMA4_API_BASE = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMMA4_MODEL}:generateContent"
```

**Why `gemma-4-31b-it`:**
- Native multimodal vision for medication label + prescription photo analysis
- 256K context window holds the full patient medication history + clinical RAG context in a single call
- `responseMimeType: application/json` — structured output without fragile regex parsing
- Apache 2.0 license — commercially deployable in healthcare settings

## 🛡️ Safety Architecture

- **Confidence Guardrail**: Rejects AI reads with `confidence_score < 0.90` rather than guessing
- **High-Risk Keyword Scanner**: Flags warfarin, opioids, insulin, chemo agents with audible emergency warnings
- **RAG Grounding**: All medication responses grounded against a pharmacological knowledge base
- **Graceful Degradation**: Full feature fallback when no API key is present

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Google AI Studio API Key (get one at [aistudio.google.com](https://aistudio.google.com))

### Backend Setup
```bash
cd medilens/backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt

# Create .env file
echo "API_Key=YOUR_GOOGLE_AI_KEY" > .env

uvicorn app:app --reload --port 8000
```

### Frontend Setup
```bash
cd medilens/frontend
npm install
npm run dev
```

Open http://localhost:5173

### Demo Mode (No API Key)
```bash
# backend/.env
DEMO_MODE=true
```
Full app works in demo mode with intelligent profile-aware responses — no API key required.

## 📁 Project Structure

```
medilens/
├── backend/
│   ├── app.py              # FastAPI server — all Gemma 4 endpoints
│   ├── models.py           # SQLAlchemy models
│   ├── auth.py             # JWT authentication
│   ├── rag_database.py     # Clinical pharmacology RAG
│   ├── database.py         # SQLite engine
│   └── requirements.txt
└── frontend/
    └── src/
        ├── App.jsx             # Camera scanner + state router
        └── components/
            ├── Dashboard.jsx       # Medication schedule + insights
            ├── AddMedication.jsx   # Prescription OCR upload
            ├── FoodScanner.jsx     # Food safety analysis
            ├── Vault.jsx           # Health document vault
            ├── PharmacyRadar.jsx   # Local pharmacy inventory
            └── Settings.jsx        # Clinical profile editor
```

## 🔌 API Endpoints

| Endpoint | Method | Description | Model |
|----------|--------|-------------|-------|
| `/analyze` | POST | Identify medication from camera image | Gemma 4 |
| `/parse-prescription` | POST | OCR a handwritten prescription | Gemma 4 |
| `/intelligence/food` | POST | Analyze food safety vs. patient profile | Gemma 4 |
| `/vault/upload` | POST | Upload & extract health memory from document | Gemma 4 |
| `/intelligence/insights` | GET | Generate longitudinal health insights | Gemma 4 |
| `/medications` | GET/POST | Manage medication schedule | — |
| `/pharmacy/inventory/{drug}` | GET | Find nearby pharmacies with stock | — |
| `/orders` | GET/POST | Order medications for delivery | — |

## 🏆 Track

- **Impact Track: Health & Sciences** — Democratizing medication safety for elderly, visually impaired, and underserved populations
- **Main Track** — Full multimodal agentic health application

## 📜 License

Apache 2.0 — same as Gemma 4 itself.

---

*Built for the [Gemma 4 Good Hackathon](https://www.kaggle.com/competitions/gemma-4-good-hackathon) · May 2026*
