import argparse
import csv
import json
from pathlib import Path

TRUE_VALUES = {"1", "true", "yes", "y"}
FALSE_VALUES = {"0", "false", "no", "n"}


def b(v):
    return str(v).strip().lower() in TRUE_VALUES


def safe_div(a, bn):
    return a / bn if bn else 0.0


def norm_name(v):
    return (v or "").strip().lower()


p = argparse.ArgumentParser(description="Compute MediLens benchmark metrics from labeled CSV + prediction JSONL.")
p.add_argument("--ground-truth", required=True)
p.add_argument("--predictions", required=True)
p.add_argument("--output", default="evaluation/results.latest.json", help="Path to write metrics JSON")
a = p.parse_args()

gt = {}
with open(a.ground_truth, newline="", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        gt[str(r["case_id"])] = r

pred = {}
with open(a.predictions, encoding="utf-8") as f:
    for line in f:
        if line.strip():
            j = json.loads(line)
            pred[str(j["case_id"])] = j

tp = fp = fn = tn = 0
name_ok = name_total = 0
hr_tp = hr_fn = 0
false_reassurance = 0
non_med_total = non_med_fp = 0
multilingual_name_ok = multilingual_name_total = 0
missing_predictions = []
extra_predictions = sorted([cid for cid in pred if cid not in gt])

for cid, g in gt.items():
    if cid not in pred:
        missing_predictions.append(cid)
        continue

    pr = pred[cid]
    g_med = b(g["gt_is_medication"])
    p_med = b(pr.get("pred_is_medication"))

    if p_med and g_med:
        tp += 1
    elif p_med and not g_med:
        fp += 1
    elif (not p_med) and g_med:
        fn += 1
    else:
        tn += 1

    if not g_med:
        non_med_total += 1
        if p_med:
            non_med_fp += 1

    is_multilingual = (g.get("language") or "").strip().lower() not in {"", "en", "english"}
    if g_med:
        name_total += 1
        name_match = norm_name(pr.get("pred_drug_name")) == norm_name(g.get("gt_drug_name"))
        if name_match:
            name_ok += 1
        if is_multilingual:
            multilingual_name_total += 1
            if name_match:
                multilingual_name_ok += 1

    g_hr = b(g["gt_high_risk"])
    p_hr = b(pr.get("pred_is_high_risk"))
    if g_hr and p_hr:
        hr_tp += 1
    if g_hr and not p_hr:
        hr_fn += 1
        false_reassurance += 1

precision = safe_div(tp, tp + fp)
recall = safe_div(tp, tp + fn)
f1 = safe_div(2 * precision * recall, precision + recall)

metrics = {
    "cases_total": len(gt),
    "cases_scored": len([c for c in gt if c in pred]),
    "missing_predictions": len(missing_predictions),
    "extra_predictions": len(extra_predictions),
    "med_detection_precision": round(precision, 4),
    "med_detection_recall": round(recall, 4),
    "med_detection_f1": round(f1, 4),
    "drug_name_exact_match_acc": round(safe_div(name_ok, name_total), 4),
    "high_risk_recall": round(safe_div(hr_tp, hr_tp + hr_fn), 4),
    "false_reassurance_rate": round(safe_div(false_reassurance, max(1, hr_tp + hr_fn)), 4),
    "non_med_false_positive_rate": round(safe_div(non_med_fp, non_med_total), 4),
    "multilingual_drug_name_exact_match_acc": round(safe_div(multilingual_name_ok, multilingual_name_total), 4),
    "counts": {
        "true_positive_med": tp,
        "false_positive_med": fp,
        "false_negative_med": fn,
        "true_negative_non_med": tn,
        "drug_name_cases": name_total,
        "high_risk_cases": hr_tp + hr_fn,
        "non_med_cases": non_med_total,
        "multilingual_med_cases": multilingual_name_total,
    },
    "missing_prediction_case_ids": missing_predictions[:25],
    "extra_prediction_case_ids": extra_predictions[:25],
}

out = Path(a.output)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
print(json.dumps(metrics, indent=2))
