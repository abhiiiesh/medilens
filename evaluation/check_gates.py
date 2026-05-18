import argparse, json

GATES = {
    "high_risk_recall": (">=", 0.95),
    "false_reassurance_rate": ("<=", 0.02),
    "med_detection_f1": (">=", 0.90),
    "drug_name_exact_match_acc": (">=", 0.85),
}

def passed(op, v, t):
    return v >= t if op == ">=" else v <= t

p = argparse.ArgumentParser()
p.add_argument("--metrics", required=True, help="Path to metrics JSON from run_eval.py")
a = p.parse_args()

with open(a.metrics, encoding="utf-8") as f:
    m = json.load(f)

results = []
all_pass = True
for k, (op, t) in GATES.items():
    v = m.get(k)
    ok = v is not None and passed(op, float(v), float(t))
    all_pass = all_pass and ok
    results.append({"metric": k, "actual": v, "rule": f"{op} {t}", "pass": ok})

print(json.dumps({"all_pass": all_pass, "results": results}, indent=2))
raise SystemExit(0 if all_pass else 1)
