# Error Analysis Template

## 1) Top failure categories
- Blurry/obstructed labels
- Similar brand packaging confusion
- Partial label crop
- Multilingual script OCR misses

## 2) Quantitative breakdown
| Category | Count | % of failures | Example case IDs |
|---|---:|---:|---|
| Blurry label | 0 | 0% | - |
| Non-med false positives | 0 | 0% | - |
| High-risk misses | 0 | 0% | - |

## 3) Mitigations
- Lower confidence threshold triggers safety refusal.
- Expand benchmark with harder negatives.
- Add multilingual OCR preprocessing + transliteration.

## 4) Next iteration tasks
- Collect 100+ real-world labels (diverse lighting).
- Add multilingual med dictionaries.
- Add image quality detector before OCR/LLM call.
