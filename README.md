# MediLens - Longitudinal Healthcare Assistant

MediLens is a medication safety assistant for elderly and visually-impaired users.

## Key capabilities
- Medication label analysis from camera image
- Risk guardrails for high-risk drugs and low-confidence outputs
- Medication and adherence tracking
- Health memory (allergies + conditions)
- Food safety analysis against user profile
- Pharmacy inventory radar + checkout simulation
- Telemetry summary endpoint for analyze reliability metrics (`/telemetry/summary`)
- Clinical feedback loop endpoints for safety/quality review (`/feedback/clinical`)
- Clinical feedback summary endpoint for reviewer analytics (`/feedback/clinical/summary`)
- Pilot outcome metrics endpoint (`/pilot/metrics`)
- Pilot cohort metrics endpoint for reviewer/admin rollups (`/pilot/metrics/cohort`)
- Unified pilot reporting endpoint (`/pilot/report`)
- Pilot raw-data export endpoint (`/pilot/export`)

## AI providers
Backend supports three modes via environment variable `AI_PROVIDER`:
- `gemini` (default): Gemini API path
- `gemma`: local Gemma path via Ollama-compatible endpoint
- `gemma`: local Gemma path via Ollama-compatible endpoint (supports multimodal `images` payload for vision-capable local models)
- `offline`: deterministic safe fallback for low-connectivity demos

### AI env vars
- `AI_PROVIDER=gemini|gemma|offline`
- `API_Key=<google key>` (gemini mode)
- `GEMMA_ENDPOINT=http://127.0.0.1:11434/api/generate` (gemma mode)
- `GEMMA_MODEL=gemma3:4b` (gemma mode)
- `AI_TIMEOUT_SECONDS=45`
- `AI_MAX_RETRIES=2`
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
Submission thresholds and acceptance gates are in `evaluation/SUBMISSION_GATES.md`.
Use `evaluation/error_analysis.md` to track failures and mitigations.
Use `evaluation/check_gates.py` to auto-validate metric thresholds after each benchmark run.

## One-click judge demo
See `notebooks/ONE_CLICK_DEMO.md`.

## Direct next steps
Execution roadmap is documented in `ROADMAP_NEXT.md`.
Pilot reporting template/scripts are available in `evaluation/pilot_report_template.md` and `evaluation/build_pilot_report.py`.
Benchmark progress tracker is available at `evaluation/benchmark_progress.py`.
