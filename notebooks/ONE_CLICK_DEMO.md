# One-click Demo (Judge Friendly)

## Backend
```bash
cd backend
export AI_PROVIDER=offline
python app.py
```

## Frontend
```bash
cd frontend
npm install
npm run dev
```

## Optional: Local Gemma mode (Ollama)
```bash
export AI_PROVIDER=gemma
export GEMMA_ENDPOINT=http://127.0.0.1:11434/api/generate
export GEMMA_MODEL=gemma3:4b
```

Then use the scanner flow in the UI.
