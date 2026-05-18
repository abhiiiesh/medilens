import argparse, csv, json

p=argparse.ArgumentParser()
p.add_argument('--ground-truth', required=True)
a=p.parse_args()

with open(a.ground_truth, newline='', encoding='utf-8') as f:
    rows=list(csv.DictReader(f))

total=len(rows)
non_med=sum(1 for r in rows if str(r.get('gt_is_medication','')).strip().lower() in {'0','false','no','n'})
high_risk=sum(1 for r in rows if str(r.get('gt_high_risk','')).strip().lower() in {'1','true','yes','y'})
multilingual=sum(1 for r in rows if (r.get('language') or '').strip().lower() not in {'', 'en', 'english'})

targets={"total":100,"non_med":15,"high_risk":20,"multilingual":10}
progress={
    "total": round(min(total/targets['total'],1.0),4),
    "non_med": round(min(non_med/targets['non_med'],1.0),4),
    "high_risk": round(min(high_risk/targets['high_risk'],1.0),4),
    "multilingual": round(min(multilingual/targets['multilingual'],1.0),4),
}
print(json.dumps({"counts":{"total":total,"non_med":non_med,"high_risk":high_risk,"multilingual":multilingual},"progress":progress}, indent=2))
