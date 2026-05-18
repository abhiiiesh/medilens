from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String)
    role = Column(String, default="patient")
    
    medications = relationship("Medication", back_populates="owner")

class Medication(Base):
    __tablename__ = "medications"

    id = Column(Integer, primary_key=True, index=True)
    drug_name = Column(String, index=True)
    dosage = Column(String)
    frequency = Column(String)
    reminder_time = Column(String, nullable=True) # e.g. "08:00 AM"
    added_at = Column(DateTime, default=datetime.utcnow)
    
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="medications")

class AdherenceLog(Base):
    __tablename__ = "adherence_logs"

    id = Column(Integer, primary_key=True, index=True)
    medication_id = Column(Integer, ForeignKey("medications.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String) # 'taken' or 'missed'

class SymptomLog(Base):
    __tablename__ = "symptom_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    timestamp = Column(DateTime, default=datetime.utcnow)
    symptom_description = Column(String)
    severity_score = Column(Integer) # 1-10

class HealthMemory(Base):
    __tablename__ = "health_memory"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    memory_type = Column(String) # 'allergy' or 'condition'
    description = Column(String)
    added_at = Column(DateTime, default=datetime.utcnow)

class CaregiverLink(Base):
    __tablename__ = "caregiver_links"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"))
    caregiver_email = Column(String, index=True)
    permissions = Column(String, default="read_adherence,read_alerts") # RBAC flags
    linked_at = Column(DateTime, default=datetime.utcnow)

class HealthDocument(Base):
    __tablename__ = "health_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    filename = Column(String)
    status = Column(String, default="processing") # processing, completed, failed
    uploaded_at = Column(DateTime, default=datetime.utcnow)

class ClinicalFeedback(Base):
    __tablename__ = "clinical_feedback"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    case_type = Column(String, default="analyze")  # analyze, food, parse_prescription
    model_output_summary = Column(String)  # short textual summary for audit
    reviewer_role = Column(String, default="patient")  # patient, caregiver, clinician
    rating = Column(Integer)  # 1-5 quality score
    is_safe = Column(String, default="unknown")  # yes, no, unknown
    comments = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
