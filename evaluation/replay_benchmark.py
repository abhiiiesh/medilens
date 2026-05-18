import argparse
import base64
import csv
import json
import time
from pathlib import Path

import httpx


def login(api_base: str, email: str, password: str) -> str:
    res = httpx.post(
        f"{api_base.rstrip('/')}/auth/login",
        data={"username": email, "password": password},
        timeout=30,
    )
    res.raise_for_status()
    return res.json()["access_token"]


def main():
    p = argparse.ArgumentParser(description="Replay benchmark images against a running MediLens backend and write prediction JSONL.")
    p.add_argument("--ground-truth", required=True, help="Benchmark CSV, e.g. evaluation/data/benchmark_v1.csv")
    p.add_argument("--output", required=True, help="Prediction JSONL output path")
    p.add_argument("--api-base", default="http://127.0.0.1:8000")
    p.add_argument("--token", help="Bearer token for an existing user")
    p.add_argument("--email", help="Login email if token is not provided")
    p.add_argument("--password", help="Login password if token is not provided")
    p.add_argument("--image-root", default=".", help="Root used to resolve relative image_path values")
    args = p.parse_args()

    token = args.token
    if not token:
        if not args.email or not args.password:
            raise SystemExit("Provide --token or both --email and --password")
        token = login(args.api_base, args.email, args.password)

    with open(args.ground_truth, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    image_root = Path(args.image_root)

    with out.open("w", encoding="utf-8") as pred_file:
        with httpx.Client(timeout=90) as client:
            for row in rows:
                cid = str(row["case_id"])
                image_path = image_root / row["image_path"]
                started = time.perf_counter()
                record = {"case_id": cid}
                try:
                    image_base64 = base64.b64encode(image_path.read_bytes()).decode("utf-8")
                    res = client.post(
                        f"{args.api_base.rstrip('/')}/analyze",
                        headers={"Authorization": f"Bearer {token}"},
                        json={"image_base64": image_base64},
                    )
                    latency_ms = round((time.perf_counter() - started) * 1000, 2)
                    record["http_status"] = res.status_code
                    record["latency_ms"] = latency_ms
                    if res.is_success:
                        data = res.json()
                        record.update({
                            "pred_is_medication": data.get("is_medication"),
                            "pred_drug_name": data.get("drug_name"),
                            "pred_is_high_risk": data.get("is_high_risk"),
                            "confidence_score": data.get("confidence_score"),
                            "interaction_alert": data.get("interaction_alert"),
                        })
                    else:
                        record.update({
                            "pred_is_medication": False,
                            "pred_drug_name": None,
                            "pred_is_high_risk": True,
                            "error": res.text[:500],
                        })
                except Exception as e:
                    record.update({
                        "pred_is_medication": False,
                        "pred_drug_name": None,
                        "pred_is_high_risk": True,
                        "error": str(e),
                    })
                pred_file.write(json.dumps(record) + "\n")
                pred_file.flush()
                print(json.dumps(record))


if __name__ == "__main__":
    main()
