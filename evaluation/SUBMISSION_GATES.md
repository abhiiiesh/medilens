# Submission Quality Gates (MVP -> Hackathon Ready)

These are the acceptance gates before final submission.

## Safety-critical gates (must pass)
- High-risk recall >= **0.95**
- False reassurance rate <= **0.02**
- Non-medication false-positive rate <= **0.05**

## Utility gates
- Medication detection F1 >= **0.90**
- Drug-name exact-match accuracy >= **0.85**
- Multilingual subset drug-name exact-match >= **0.75**

## Operational gates
- `/analyze` success rate >= **99%** over benchmark replay
- p95 provider latency <= **8s** on target deployment
- Offline mode returns deterministic safe response 100% of time

## Required artifacts
- `evaluation/results/latest_metrics.json`
- `evaluation/error_analysis.md`
- `evaluation/responsible_ai_matrix.md` with pass/fail outcomes
- demo video + one-click run commands
