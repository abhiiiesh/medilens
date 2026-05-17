# Mock RAG Database for Hackathon MVP
# In a real production system, this would be replaced with vector search 
# over FDA databases, or API calls to RxNav / Epocrates.

MOCK_PHARMACY_KNOWLEDGE_BASE = {
    "ibuprofen": {
        "class": "NSAID",
        "warnings": "May increase risk of heart attack or stroke. Can cause stomach bleeding.",
        "known_interactions": [
            "aspirin", "lisinopril", "warfarin", "naproxen", "corticosteroids"
        ]
    },
    "lisinopril": {
        "class": "ACE Inhibitor",
        "warnings": "Can cause a dry cough, dizziness, or high potassium levels.",
        "known_interactions": [
            "ibuprofen", "naproxen", "potassium supplements", "spironolactone"
        ]
    },
    "warfarin": {
        "class": "Anticoagulant",
        "warnings": "High risk of severe bleeding. Requires frequent blood testing.",
        "known_interactions": [
            "ibuprofen", "aspirin", "amiodarone", "antibiotics"
        ]
    },
    "metformin": {
        "class": "Biguanide",
        "warnings": "Risk of lactic acidosis. Take with food to reduce stomach upset.",
        "known_interactions": [
            "contrast dye", "alcohol"
        ]
    },
    "omeprazole": {
        "class": "Proton Pump Inhibitor",
        "warnings": "Long-term use may increase the risk of bone fractures.",
        "known_interactions": [
            "clopidogrel", "methotrexate", "st. john's wort"
        ]
    }
}

def retrieve_drug_context(drug_name: str) -> str:
    """
    Simulates a RAG retrieval step. Matches the drug name against the knowledge base
    and returns formatted grounded facts to inject into the LLM prompt.
    """
    if not drug_name:
        return ""
        
    drug_lower = drug_name.lower()
    
    # Simple fuzzy match simulation for MVP
    for known_drug, data in MOCK_PHARMACY_KNOWLEDGE_BASE.items():
        if known_drug in drug_lower or drug_lower in known_drug:
            return f"""
[GROUNDED MEDICAL KNOWLEDGE DATABASE]
Drug Class: {data['class']}
FDA Warnings: {data['warnings']}
High-Risk Interactions: {', '.join(data['known_interactions'])}
"""
    return "[GROUNDED MEDICAL KNOWLEDGE DATABASE]: No specific warnings found in local database."
