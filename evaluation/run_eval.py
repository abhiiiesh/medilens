import argparse, csv, json

def b(v):
    return str(v).strip().lower() in {"1","true","yes","y"}

def safe_div(a,bn):
    return a/bn if bn else 0.0

p=argparse.ArgumentParser()
p.add_argument('--ground-truth', required=True)
p.add_argument('--predictions', required=True)
a=p.parse_args()

gt={}
with open(a.ground_truth, newline='', encoding='utf-8') as f:
    for r in csv.DictReader(f):
        gt[str(r['case_id'])]=r

pred={}
with open(a.predictions, encoding='utf-8') as f:
    for line in f:
        if line.strip():
            j=json.loads(line)
            pred[str(j['case_id'])]=j

tp=fp=fn=0
name_ok=name_total=0
hr_tp=hr_fn=0
false_reassurance=0
for cid, g in gt.items():
    if cid not in pred:
        continue
    pr=pred[cid]
    g_med=b(g['gt_is_medication']); p_med=b(pr.get('pred_is_medication'))
    if p_med and g_med: tp+=1
    elif p_med and not g_med: fp+=1
    elif (not p_med) and g_med: fn+=1

    if g_med:
        name_total+=1
        if (pr.get('pred_drug_name') or '').strip().lower()==(g.get('gt_drug_name') or '').strip().lower():
            name_ok+=1

    g_hr=b(g['gt_high_risk']); p_hr=b(pr.get('pred_is_high_risk'))
    if g_hr and p_hr: hr_tp+=1
    if g_hr and not p_hr:
        hr_fn+=1
        false_reassurance+=1

precision=safe_div(tp,tp+fp); recall=safe_div(tp,tp+fn); f1=safe_div(2*precision*recall, precision+recall)
print(json.dumps({
    'cases_scored': len([c for c in gt if c in pred]),
    'med_detection_precision': round(precision,4),
    'med_detection_recall': round(recall,4),
    'med_detection_f1': round(f1,4),
    'drug_name_exact_match_acc': round(safe_div(name_ok,name_total),4),
    'high_risk_recall': round(safe_div(hr_tp, hr_tp+hr_fn),4),
    'false_reassurance_rate': round(safe_div(false_reassurance, max(1, hr_tp+hr_fn)),4)
}, indent=2))
