import os
import json
import re
import httpx
from typing import Any

AI_PROVIDER = os.getenv("AI_PROVIDER", "gemini").lower()  # gemini | gemma | offline
GEMMA_ENDPOINT = os.getenv("GEMMA_ENDPOINT", "http://127.0.0.1:11434/api/generate")
GEMMA_MODEL = os.getenv("GEMMA_MODEL", "gemma3:4b")


def _extract_json(text: str) -> dict[str, Any]:
    text = (text or "").replace("```json", "").replace("```", "").strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError("No JSON object found in model output")
    return json.loads(match.group(0))


async def generate_structured_json(prompt: str, *, image_base64: str | None = None, mime_type: str = "image/jpeg", temperature: float = 0.1) -> dict[str, Any]:
    if AI_PROVIDER == "offline":
        # Deterministic offline-safe fallback for demo and edge mode.
        return {
            "is_medication": False,
            "confidence_score": 0.0,
            "drug_name": None,
            "dose_plain": None,
            "instructions": None,
            "warnings": ["Offline mode active - AI unavailable."],
            "interaction_alert": None,
            "speak_text": "I'm in offline mode and cannot safely analyze this image right now.",
            "is_high_risk": True,
        }

    if AI_PROVIDER == "gemma":
        # Ollama-compatible local Gemma path
        full_prompt = prompt
        if image_base64:
            full_prompt += "\n\n[Base64 image bytes omitted in text mode integration]"
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(
                GEMMA_ENDPOINT,
                json={
                    "model": GEMMA_MODEL,
                    "prompt": full_prompt,
                    "stream": False,
                    "format": "json",
                    "options": {"temperature": temperature},
                },
            )
        resp.raise_for_status()
        data = resp.json()
        return _extract_json(data.get("response", ""))

    # Default: Gemini
    api_key = os.getenv("API_Key", "")
    if not api_key:
        raise ValueError("Google API Key not found")

    parts: list[dict[str, Any]] = [{"text": prompt}]
    if image_base64:
        parts.append({"inline_data": {"mime_type": mime_type, "data": image_base64}})

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {"temperature": temperature, "responseMimeType": "application/json"},
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
            json=payload,
        )
    if response.status_code != 200:
        raise ValueError(f"Gemini API error: {response.text}")
    data = response.json()
    raw_text = data["candidates"][0]["content"][0]["parts"][0]["text"] if "content" in data.get("candidates", [{}])[0] else data["candidates"][0]["content"]["parts"][0]["text"]
    return _extract_json(raw_text)
