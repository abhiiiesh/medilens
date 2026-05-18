# MediLens Evaluation Harness

This folder provides a lightweight, reproducible evaluation setup for hackathon judging.

## Files
- `data/benchmark_template.csv`: template schema for benchmark cases.
- `data/benchmark_v1.csv`: working file for 100+ case benchmark build.
- `replay_benchmark.py`: replays benchmark images against a running backend to produce prediction JSONL.
- `run_eval.py`: computes accuracy and safety-oriented metrics.
- `check_gates.py`: validates metrics against submission thresholds.
- `responsible_ai_matrix.md`: test matrix for hallucination, OCR false positives, multilingual robustness.
- `responsible_ai_results.md`: run-by-run pass/fail evidence tracker.
- `collect_benchmark_template.md`: data collection and labeling guide.

## Quick start
1. Fill `data/benchmark_v1.csv` with 100+ real benchmark examples.
2. Create predictions file as JSONL (`evaluation/predictions/sample_predictions.jsonl`) with fields:
   - `case_id`
   - `pred_is_medication`
   - `pred_drug_name`
   - `pred_is_high_risk`
3. Validate benchmark coverage before claiming readiness:
   ```bash
   python evaluation/validate_benchmark.py --ground-truth evaluation/data/benchmark_v1.csv
   ```
4. Generate real predictions against a running backend:
   ```bash
   python evaluation/replay_benchmark.py \
     --ground-truth evaluation/data/benchmark_v1.csv \
     --output evaluation/predictions/benchmark_v1_predictions.jsonl \
     --api-base http://127.0.0.1:8000 \
     --email demo@example.com \
     --password 'YourPassword123!'
   ```
5. Run evaluation on real benchmark predictions:
   ```bash
   python evaluation/run_eval.py \
     --ground-truth evaluation/data/benchmark_v1.csv \
     --predictions evaluation/predictions/benchmark_v1_predictions.jsonl \
     --output evaluation/results.latest.json
   ```
6. Validate quality gates:
   ```bash
   python evaluation/check_gates.py --metrics evaluation/results.latest.json
   ```
7. Generate submission-readiness report:
   ```bash
   python evaluation/build_submission_report.py \
     --ground-truth evaluation/data/benchmark_v1.csv \
     --predictions evaluation/predictions/benchmark_v1_predictions.jsonl \
     --metrics evaluation/results.latest.json \
     --responsible-ai evaluation/responsible_ai_results.md \
     --error-analysis evaluation/error_analysis.md
   ```

## Reported metrics
- Medication detection precision / recall / F1
- Drug-name exact match accuracy
- High-risk recall (critical safety)
- False reassurance rate (`gt_high_risk=true` while `pred_is_high_risk=false`)
- Non-medication false-positive rate
- Multilingual subset drug-name exact match
- Prediction coverage / missing prediction count
