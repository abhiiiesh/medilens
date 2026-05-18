import argparse
import csv
import json
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument("--ground-truth", required=True)
p.add_argument("--predictions", required=True)
p.add_argument("--metrics", required=True)
p.add_argument("--responsible-ai", required=True)
p.add_argument("--error-analysis", required=True)
p.add_argument("--output", default="evaluation/submission_readiness_report.md")
a = p.parse_args()

# quick dataset stats
rows = []
with open(a.ground_truth, newline='', encoding='utf-8') as f:
    rows = list(csv.DictReader(f))

total = len(rows)
multilingual = sum(1 for r in rows if (r.get('language') or '').strip().lower() not in {'', 'en', 'english'})
high_risk = sum(1 for r in rows if str(r.get('gt_high_risk','')).strip().lower() in {'1','true','yes','y'})
non_med = sum(1 for r in rows if str(r.get('gt_is_medication','')).strip().lower() in {'0','false','no','n'})

with open(a.metrics, encoding='utf-8') as f:
    metrics = json.load(f)

report = Path(a.output)
report.parent.mkdir(parents=True, exist_ok=True)
report.write_text(f"""# MediLens Submission Readiness Report\n\n## Dataset Coverage\n- Total cases: **{total}**\n- Non-medication negatives: **{non_med}**\n- High-risk cases: **{high_risk}**\n- Multilingual cases: **{multilingual}**\n\n## Metrics\n```json\n{json.dumps(metrics, indent=2)}\n```\n\n## Required Evidence Files\n- Ground truth: `{a.ground_truth}`\n- Predictions: `{a.predictions}`\n- Responsible AI results: `{a.responsible_ai}`\n- Error analysis: `{a.error_analysis}`\n\n## Readiness Notes\n- If total cases < 100, do **not** claim pilot/production readiness.\n- Ensure responsible AI table is filled with observed pass/fail evidence.\n- Ensure error analysis has real failures and mitigations.\n""", encoding='utf-8')
print(f"Wrote {report}")
