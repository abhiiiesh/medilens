import os
import json
import re
import uuid
import logging
import httpx
from dotenv import load_dotenv, find_dotenv
from typing import Any

logger = logging.getLogger("medilens.ai")

# Load .env before reading provider configuration. app.py also loads dotenv, but
# ai_client is imported before app.py calls load_dotenv(), so provider settings
# must be initialized here as well.
load_dotenv(find_dotenv())

AI_PROVIDER = os.getenv("AI_PROVIDER", "gemini").lower()  # gemini | gemma | offline
GEMMA_ENDPOINT = os.getenv("GEMMA_ENDPOINT", "http://127.0.0.1:11434/api/generate")
GEMMA_MODEL = os.getenv("GEMMA_MODEL", "gemma3:4b")
AI_TIMEOUT_SECONDS = float(os.getenv("AI_TIMEOUT_SECONDS", "45"))
AI_MAX_RETRIES = int(os.getenv("AI_MAX_RETRIES", "2"))


def _strip_markdown_fences(text: str) -> str:
    return (text or "").replace("```json", "").replace("```", "").strip()


def _extract_json_value(text: str) -> Any:
    text = _strip_markdown_fences(text)
    if not text:
        raise ValueError("No JSON found in model output")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    object_match = re.search(r"\{.*\}", text, re.DOTALL)
    array_match = re.search(r"\[.*\]", text, re.DOTALL)
    matches = [m for m in (object_match, array_match) if m]
    if not matches:
        raise ValueError("No JSON object or array found in model output")
    # Prefer whichever JSON-looking value starts first in the model response.
    match = min(matches, key=lambda m: m.start())
    return json.loads(match.group(0))


def _extract_json(text: str) -> dict[str, Any]:
    value = _extract_json_value(text)
    if not isinstance(value, dict):
        raise ValueError("Expected JSON object in model output")
    return value


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


def _offline_medication_response() -> dict[str, Any]:
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


async def generate_text(
    prompt: str,
    *,
    image_base64: str | None = None,
    mime_type: str = "image/jpeg",
    temperature: float = 0.1,
    trace_id: str | None = None,
    offline_fallback: str | None = None,
) -> str:
    trace_id = trace_id or str(uuid.uuid4())

    if AI_PROVIDER == "offline":
        return offline_fallback or "Offline mode active - AI unavailable."

    if AI_PROVIDER == "gemma":
        gemma_payload: dict[str, Any] = {
            "model": GEMMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": temperature},
        }
        if image_base64:
            gemma_payload["images"] = [image_base64]
        data = await _post_with_retries(
            GEMMA_ENDPOINT,
            gemma_payload,
            timeout=AI_TIMEOUT_SECONDS,
            trace_id=trace_id,
        )
        return str(data.get("response", "")).strip()

    api_key = os.getenv("API_Key", "") or os.getenv("GOOGLE_API_KEY", "")
    if not api_key:
        raise ValueError("Google API Key not found")

    parts: list[dict[str, Any]] = [{"text": prompt}]
    if image_base64:
        parts.append({"inline_data": {"mime_type": mime_type, "data": image_base64}})

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {"temperature": temperature},
    }

    data = await _post_with_retries(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
        payload,
        timeout=AI_TIMEOUT_SECONDS,
        trace_id=trace_id,
    )
    return _get_candidate_text(data).strip()


async def generate_json_value(
    prompt: str,
    *,
    image_base64: str | None = None,
    mime_type: str = "image/jpeg",
    temperature: float = 0.1,
    trace_id: str | None = None,
    offline_fallback: Any = None,
) -> Any:
    trace_id = trace_id or str(uuid.uuid4())

    if AI_PROVIDER == "offline":
        if offline_fallback is not None:
            return offline_fallback
        return _offline_medication_response()

    if AI_PROVIDER == "gemma":
        gemma_payload: dict[str, Any] = {
            "model": GEMMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {"temperature": temperature},
        }
        if image_base64:
            gemma_payload["images"] = [image_base64]
        data = await _post_with_retries(
            GEMMA_ENDPOINT,
            gemma_payload,
            timeout=AI_TIMEOUT_SECONDS,
            trace_id=trace_id,
        )
        return _extract_json_value(data.get("response", ""))

    api_key = os.getenv("API_Key", "") or os.getenv("GOOGLE_API_KEY", "")
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
    return _extract_json_value(raw_text)


async def generate_structured_json(
    prompt: str,
    *,
    image_base64: str | None = None,
    mime_type: str = "image/jpeg",
    temperature: float = 0.1,
    trace_id: str | None = None,
    offline_fallback: dict[str, Any] | None = None,
) -> dict[str, Any]:
    value = await generate_json_value(
        prompt,
        image_base64=image_base64,
        mime_type=mime_type,
        temperature=temperature,
        trace_id=trace_id,
        offline_fallback=offline_fallback,
    )
    if not isinstance(value, dict):
        raise ValueError("Expected JSON object in model output")
    return value
