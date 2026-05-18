import argparse, csv, sys

p=argparse.ArgumentParser()
p.add_argument('--ground-truth', required=True)
a=p.parse_args()

rows=[]
with open(a.ground_truth, newline='', encoding='utf-8') as f:
    rows=list(csv.DictReader(f))

if not rows:
    print('ERROR: empty dataset')
    sys.exit(1)

total=len(rows)
non_med=sum(1 for r in rows if str(r.get('gt_is_medication','')).strip().lower() in {'0','false','no','n'})
high_risk=sum(1 for r in rows if str(r.get('gt_high_risk','')).strip().lower() in {'1','true','yes','y'})
multilingual=sum(1 for r in rows if (r.get('language') or '').strip().lower() not in {'', 'en', 'english'})

rules = [
    (total >= 100, f'total >=100 (actual {total})'),
    (non_med >= 15, f'non-med >=15 (actual {non_med})'),
    (high_risk >= 20, f'high-risk >=20 (actual {high_risk})'),
    (multilingual >= 10, f'multilingual >=10 (actual {multilingual})'),
]

ok=True
for passed,msg in rules:
    print(('PASS' if passed else 'FAIL') + ': ' + msg)
    ok = ok and passed
sys.exit(0 if ok else 1)
