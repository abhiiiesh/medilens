# MediLens Evaluation Harness

This folder provides a lightweight, reproducible evaluation setup for hackathon judging.

## Files
- `data/benchmark_template.csv`: template schema for benchmark cases.
- `run_eval.py`: computes accuracy and safety-oriented metrics.
- `responsible_ai_matrix.md`: test matrix for hallucination, OCR false positives, multilingual robustness.

## Quick start
1. Fill `data/benchmark_template.csv` with test examples.
2. Create predictions file as JSONL (`evaluation/predictions/sample_predictions.jsonl`) with fields:
   - `case_id`
   - `pred_is_medication`
   - `pred_drug_name`
   - `pred_is_high_risk`
3. Run:
   ```bash
   python evaluation/run_eval.py \
     --ground-truth evaluation/data/benchmark_template.csv \
     --predictions evaluation/predictions/sample_predictions.jsonl
   ```

## Reported metrics
- Medication detection precision / recall / F1
- Drug-name exact match accuracy
- High-risk recall (critical safety)
- False reassurance rate (`gt_high_risk=true` while `pred_is_high_risk=false`)
