import os
import json
import re
import uuid
import logging
import httpx
from typing import Any

logger = logging.getLogger("medilens.ai")

AI_PROVIDER = os.getenv("AI_PROVIDER", "gemini").lower()  # gemini | gemma | offline
GEMMA_ENDPOINT = os.getenv("GEMMA_ENDPOINT", "http://127.0.0.1:11434/api/generate")
GEMMA_MODEL = os.getenv("GEMMA_MODEL", "gemma3:4b")
AI_TIMEOUT_SECONDS = float(os.getenv("AI_TIMEOUT_SECONDS", "45"))
AI_MAX_RETRIES = int(os.getenv("AI_MAX_RETRIES", "2"))


def _extract_json(text: str) -> dict[str, Any]:
    text = (text or "").replace("```json", "").replace("```", "").strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError("No JSON object found in model output")
    return json.loads(match.group(0))


def _get_candidate_text(data: dict[str, Any]) -> str:
    candidates = data.get("candidates") or []
    if not candidates:
        raise ValueError("No candidates found in model response")
    content = candidates[0].get("content")
    if not content:
        raise ValueError("No content found in model response")
    if isinstance(content, dict):
        parts = content.get("parts") or []
    elif isinstance(content, list):
        parts = content[0].get("parts") if content and isinstance(content[0], dict) else []
    else:
        parts = []
    if not parts:
        raise ValueError("No parts found in model response")
    text = parts[0].get("text")
    if not text:
        raise ValueError("No text found in model response")
    return text


async def _post_with_retries(url: str, payload: dict[str, Any], *, timeout: float, trace_id: str) -> dict[str, Any]:
    last_err: Exception | None = None
    for attempt in range(AI_MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(url, json=payload)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            last_err = e
            logger.warning("ai_request_failed", extra={"trace_id": trace_id, "attempt": attempt, "error": str(e)})
            if attempt >= AI_MAX_RETRIES:
                break
    raise ValueError(f"AI request failed after retries: {last_err}")


async def generate_structured_json(prompt: str, *, image_base64: str | None = None, mime_type: str = "image/jpeg", temperature: float = 0.1, trace_id: str | None = None) -> dict[str, Any]:
    trace_id = trace_id or str(uuid.uuid4())

    if AI_PROVIDER == "offline":
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
        full_prompt = prompt
        gemma_payload: dict[str, Any] = {
            "model": GEMMA_MODEL,
            "prompt": full_prompt,
            "stream": False,
            "format": "json",
            "options": {"temperature": temperature},
        }
        # Ollama-compatible multimodal payload for Gemma vision-capable local models.
        if image_base64:
            gemma_payload["images"] = [image_base64]
        data = await _post_with_retries(
            GEMMA_ENDPOINT,
            gemma_payload,
            timeout=AI_TIMEOUT_SECONDS,
            trace_id=trace_id,
        )
        return _extract_json(data.get("response", ""))

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

    data = await _post_with_retries(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
        payload,
        timeout=AI_TIMEOUT_SECONDS,
        trace_id=trace_id,
    )
    raw_text = _get_candidate_text(data)
    return _extract_json(raw_text)
