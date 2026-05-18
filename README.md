# MediLens - Longitudinal Healthcare Assistant

MediLens is a medication safety assistant for elderly and visually-impaired users.

## Key capabilities
- Medication label analysis from camera image
- Risk guardrails for high-risk drugs and low-confidence outputs
- Medication and adherence tracking
- Health memory (allergies + conditions)
- Food safety analysis against user profile
- Pharmacy inventory radar + checkout simulation

## AI providers
Backend supports three modes via environment variable `AI_PROVIDER`:
- `gemini` (default): Gemini API path
- `gemma`: local Gemma path via Ollama-compatible endpoint
- `offline`: deterministic safe fallback for low-connectivity demos

### AI env vars
- `AI_PROVIDER=gemini|gemma|offline`
- `API_Key=<google key>` (gemini mode)
- `GEMMA_ENDPOINT=http://127.0.0.1:11434/api/generate` (gemma mode)
- `GEMMA_MODEL=gemma3:4b` (gemma mode)
- `ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`

## Quick start
### Backend
```bash
cd backend
python app.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Evaluation + Responsible AI
See `evaluation/README.md` for formal metrics and `evaluation/responsible_ai_matrix.md` for safety testing matrix.

## One-click judge demo
See `notebooks/ONE_CLICK_DEMO.md`.
