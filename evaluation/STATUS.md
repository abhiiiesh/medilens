# Evaluation and Pilot Status

This file records what is complete versus pending before claiming production or pilot readiness.

## Priority 1: Benchmark and Responsible AI evidence

Status: **Not complete**.

- `evaluation/data/benchmark_v1.csv` currently contains only the header row, so the required 100+ real-case benchmark has not been collected yet.
- `evaluation/results.latest.json` currently reports `cases_scored: 4`, so the latest metrics are from a tiny sample run rather than a real benchmark.
- `evaluation/responsible_ai_results.md` is still an unfilled evidence table.
- `evaluation/error_analysis.md` is still a template with placeholder categories and zero observed failures.

Before claiming pilot/production readiness, collect the 100+ case benchmark, generate real predictions, run `run_eval.py`, run `check_gates.py`, fill the responsible-AI evidence table, and complete real failure-category analysis.

## Priority 2: Pilot execution

Status: **Infrastructure exists, pilot not yet completed in-repo**.

- Backend endpoints exist for qualitative feedback, telemetry, pilot metrics, cohort metrics, exports, and reports.
- The repository does not yet include evidence from a completed 5-10 user pilot.

## Priority 3: Frontend pilot operations screens

Status: **Partially complete**.

- Scanner flow includes point-of-care clinical feedback submission.
- PilotOps includes report, clinical-feedback summary, cohort metrics handling, and JSON/Markdown/CSV exports.
- A standalone telemetry drill-down/review screen is still pending.
