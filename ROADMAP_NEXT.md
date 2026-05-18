# Next Development Roadmap (Direct Execution)

## Sprint 1 (Immediate)
1. Build benchmark v1 with >= 100 real cases.
2. Run eval harness and produce `latest_metrics.json`.
3. Complete Responsible-AI matrix with pass/fail evidence.

## Sprint 2
1. ✅ Add pre-check image quality gate (blur/low-light proxy via payload-quality threshold).
2. ✅ Implement structured telemetry summary (latency, error rate, high-risk and low-quality counters).
3. ✅ Add multilingual preprocessing prompt instruction for English-normalized extraction.

## Sprint 3
1. ✅ True multimodal Gemma local path baseline (Ollama-compatible `images` payload support).
2. ✅ Clinical reviewer feedback loop baseline (`/feedback/clinical` submit + list).
3. ✅ Pilot metrics baseline endpoint (`/pilot/metrics`) for adherence/symptom/feedback outcomes.
