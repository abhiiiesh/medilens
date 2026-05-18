import argparse
import json
from pathlib import Path

p=argparse.ArgumentParser()
p.add_argument('--pilot-json', required=True, help='JSON from /pilot/report endpoint')
p.add_argument('--output', default='evaluation/pilot_weekly_report.md')
a=p.parse_args()

with open(a.pilot_json, encoding='utf-8') as f:
    data=json.load(f)

rel=data.get('reliability',{})
out=data.get('outcomes',{})
adh=out.get('adherence',{})
sym=out.get('symptoms',{})
cf=out.get('clinical_feedback',{})

md=f"""# MediLens Pilot Weekly Report\n\n## Scope\n- Pilot window (days): **{data.get('window_days')}**\n\n## Reliability\n- Analyze success rate: **{rel.get('analyze_success_rate')}**\n- Analyze p95 latency (ms): **{rel.get('analyze_p95_latency_ms')}**\n- Analyze failures: **{rel.get('analyze_fail')}**\n- Low-quality image rejects: **{rel.get('low_quality_rejects')}**\n\n## Outcomes\n- Adherence rate: **{adh.get('adherence_rate')}**\n- Avg symptom severity: **{sym.get('avg_severity')}**\n- Clinical feedback avg rating: **{cf.get('avg_rating')}**\n- Unsafe feedback flags: **{cf.get('unsafe_flags')}**\n\n## Latest Feedback (up to 10)\n```json\n{json.dumps(data.get('latest_feedback',[]), indent=2)}\n```\n"""
Path(a.output).write_text(md, encoding='utf-8')
print(f'Wrote {a.output}')
