# Benchmark Collection Guide (v1 target: 100+ cases)

## Required split
- 60 medication positives (clear labels)
- 15 medication positives (blurry/partial labels)
- 15 non-medication negatives
- 10 multilingual prescriptions/labels

## Labeling fields
Use `evaluation/data/benchmark_v1.csv` with columns:
- `case_id`
- `image_path`
- `language`
- `gt_is_medication`
- `gt_drug_name`
- `gt_high_risk`
- `notes`

## Quality rules
- At least 20% high-risk medications (e.g. warfarin, insulin).
- At least 15% difficult OCR cases (blur/glare/crop).
- At least 10% multilingual labels.

## Privacy rules
- Remove personal identifiers from images.
- Do not include patient name, address, MRN, phone, or DOB.
