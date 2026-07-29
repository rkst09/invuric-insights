from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from config import settings
from errors import LLMServiceError

try:
    from anthropic import (
        APIConnectionError,
        APITimeoutError,
        APIStatusError,
        AsyncAnthropic,
        AuthenticationError,
        BadRequestError,
        PermissionDeniedError,
        RateLimitError,
    )
except ImportError:  # pragma: no cover - handled at runtime if dependency is missing
    AsyncAnthropic = None


LOGGER = logging.getLogger("invuric.llm")
DEFAULT_MODEL = settings.anthropic_model
DEFAULT_JSON_MAX_TOKENS = settings.llm_json_max_tokens
DEFAULT_TEXT_MAX_TOKENS = settings.llm_text_max_tokens
ModelT = TypeVar("ModelT", bound=BaseModel)
_client: AsyncAnthropic | None = None


def _get_client():
    global _client
    if AsyncAnthropic is None:
        raise RuntimeError(
            "Anthropic SDK is not installed. Run `pip install -r backend/requirements.txt` to enable Claude."
        )
    if _client is None:
        _client = AsyncAnthropic(
            api_key=settings.llm_api_key,
            timeout=settings.llm_request_timeout_seconds,
            max_retries=2,
        )
    return _client


def _extract_text_content(response) -> str:
    parts = []
    for block in getattr(response, "content", []):
        text = getattr(block, "text", None)
        if text:
            parts.append(text)
    return "".join(parts).strip()


def _coerce_json_payload(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        cleaned = "\n".join(lines[1:-1]).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        return json.loads(cleaned[start : end + 1])


def _usage_value(response, *keys: str) -> int | None:
    usage = getattr(response, "usage", None)
    if usage is None:
        return None
    for key in keys:
        value = getattr(usage, key, None)
        if isinstance(value, int):
            return value
    return None


_RETRYABLE_STATUS_CODES = frozenset({429, 500, 502, 503, 529})
_RETRY_MAX_ATTEMPTS = 4          # 1 original + 3 retries
_RETRY_BASE_DELAY_SECONDS = 2.0  # doubles each attempt: 2s, 4s, 8s


def _build_message_content(user_content: str, images: list[dict] | None) -> str | list[dict]:
    """Plain text, unless images are attached (vision - Backlog/User Stories only),
    in which case each image becomes its own content block ahead of the text."""
    if not images:
        return user_content
    blocks = [
        {"type": "image", "source": {"type": "base64", "media_type": image["media_type"], "data": image["data"]}}
        for image in images
    ]
    blocks.append({"type": "text", "text": user_content})
    return blocks


async def _create_message(
    *,
    system_prompt: str,
    user_content: str,
    temperature: float,
    max_tokens: int,
    images: list[dict] | None = None,
):
    """Call the Anthropic API with exponential-backoff retry for transient errors.

    The SDK's built-in max_retries handles connection errors; this layer adds
    explicit retry for 529 (overloaded) and other retryable HTTP status codes
    that the SDK does not retry by default.
    """
    client = _get_client()
    last_exc: Exception | None = None
    message_content = _build_message_content(user_content, images)

    for attempt in range(_RETRY_MAX_ATTEMPTS):
        started = time.perf_counter()
        try:
            response = await client.messages.create(
                model=DEFAULT_MODEL,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_prompt,
                messages=[{"role": "user", "content": message_content}],
            )
            duration_ms = round((time.perf_counter() - started) * 1000, 2)
            LOGGER.info(
                "llm_response model=%s attempt=%s duration_ms=%s input_tokens=%s output_tokens=%s stop_reason=%s",
                DEFAULT_MODEL,
                attempt + 1,
                duration_ms,
                _usage_value(response, "input_tokens"),
                _usage_value(response, "output_tokens"),
                getattr(response, "stop_reason", None),
            )
            return response
        except APIStatusError as exc:
            if exc.status_code in _RETRYABLE_STATUS_CODES and attempt < _RETRY_MAX_ATTEMPTS - 1:
                delay = _RETRY_BASE_DELAY_SECONDS * (2 ** attempt)
                LOGGER.warning("llm_retry attempt=%s/%s status=%s delay=%.0fs",
                               attempt + 1, _RETRY_MAX_ATTEMPTS, exc.status_code, delay)
                await asyncio.sleep(delay)
                last_exc = exc
                continue
            raise
        except (APIConnectionError, APITimeoutError) as exc:
            if attempt < _RETRY_MAX_ATTEMPTS - 1:
                delay = _RETRY_BASE_DELAY_SECONDS * (2 ** attempt)
                LOGGER.warning("llm_retry attempt=%s/%s error=%s delay=%.0fs",
                               attempt + 1, _RETRY_MAX_ATTEMPTS, exc.__class__.__name__, delay)
                await asyncio.sleep(delay)
                last_exc = exc
                continue
            raise

    raise last_exc  # type: ignore[misc]


def _wrap_llm_exception(exc: Exception) -> LLMServiceError:
    if isinstance(exc, AuthenticationError):
        return LLMServiceError("Claude authentication failed. Check the Anthropic API key configured for the backend.")
    if isinstance(exc, PermissionDeniedError):
        return LLMServiceError("Claude rejected the request due to account or permission settings.")
    if isinstance(exc, RateLimitError):
        return LLMServiceError(
            "Claude is rate-limiting requests right now. Please wait a moment and try again.",
            status_code=429,
        )
    if isinstance(exc, BadRequestError):
        return LLMServiceError(
            "Claude rejected the generation request. The uploaded input may be too large or malformed."
        )
    if isinstance(exc, APITimeoutError):
        return LLMServiceError(
            "Claude took too long to respond. Please retry, or use a smaller document set.",
            status_code=504,
        )
    if isinstance(exc, APIConnectionError):
        return LLMServiceError(
            "The backend could not reach Claude. Check your network, firewall, or proxy settings and try again."
        )
    if isinstance(exc, APIStatusError):
        status_code = getattr(exc, "status_code", 502)
        if status_code == 529:
            return LLMServiceError(
                "Claude is temporarily overloaded. Please retry in a moment.",
                status_code=503,
            )
        return LLMServiceError(f"Claude returned an upstream error ({status_code}). Please try again.")
    return LLMServiceError("Claude returned an unexpected error. Please try again.")


def _validation_error_text(exc: Exception) -> str:
    if isinstance(exc, ValidationError):
        return exc.json(indent=2)
    return str(exc)


def _build_repair_prompt(original_request: str, original_response: str, validation_error: Exception) -> str:
    error_text = _validation_error_text(validation_error)
    # Determine specific guidance based on the error type
    if "json" in error_text.lower() or "parse" in error_text.lower():
        error_guidance = "The JSON was malformed or truncated. Reconstruct it as complete, valid JSON."
    else:
        error_guidance = (
            "A Pydantic validation error occurred. Common causes:\n"
            "- A list had fewer items than the required minimum — add more items.\n"
            "- A string field used a value not in the allowed set — use the exact allowed string.\n"
            "- A required field was missing — add it.\n"
            "Fix ONLY what the error describes. Keep all other content unchanged."
        )

    return f"""The previous response did not satisfy the required JSON contract. Repair it now.

ERRORS TO FIX:
{error_text[:8000]}

GUIDANCE:
{error_guidance}

ORIGINAL REQUEST (for context):
{original_request[:8000]}

PREVIOUS RESPONSE TO REPAIR (preserve all valid content):
{original_response[:40000]}

Rules:
- Return the complete repaired JSON object only.
- Do NOT truncate any array — include every item from the previous response.
- Do NOT add markdown fences, commentary, or any text outside the JSON.
- Do NOT change content that was already correct."""


async def complete_json(
    system_prompt: str,
    user_content: str,
    *,
    schema: type[ModelT] | None = None,
    temperature: float = 0.2,
    max_tokens: int = DEFAULT_JSON_MAX_TOKENS,
    images: list[dict] | None = None,
) -> dict:
    current_user_content = user_content
    current_temperature = temperature
    last_error: Exception | None = None

    for attempt in range(settings.llm_max_validation_repairs + 1):
        try:
            response = await _create_message(
                system_prompt=system_prompt,
                user_content=current_user_content,
                temperature=current_temperature,
                max_tokens=max_tokens,
                images=images,
            )
            full_text = _extract_text_content(response)
            payload = _coerce_json_payload(full_text)
            if schema is None:
                return payload

            validated = schema.model_validate(payload)
            return validated.model_dump(mode="python")
        except (
            AuthenticationError,
            PermissionDeniedError,
            RateLimitError,
            BadRequestError,
            APITimeoutError,
            APIConnectionError,
            APIStatusError,
        ) as exc:
            raise _wrap_llm_exception(exc) from exc
        except (json.JSONDecodeError, ValidationError) as exc:
            last_error = exc
            if attempt >= settings.llm_max_validation_repairs:
                break
            LOGGER.warning(
                "llm_structured_output_retry attempt=%s model=%s reason=%s",
                attempt + 1,
                DEFAULT_MODEL,
                exc.__class__.__name__,
            )
            current_user_content = _build_repair_prompt(user_content, full_text, exc)
            current_temperature = 0

    raise LLMServiceError(
        "Claude returned an invalid structured response after multiple repair attempts. Please try again."
    ) from last_error


async def complete_text(
    system_prompt: str,
    user_content: str,
    *,
    temperature: float = 0.2,
    max_tokens: int = DEFAULT_TEXT_MAX_TOKENS,
) -> str:
    try:
        response = await _create_message(
            system_prompt=system_prompt,
            user_content=user_content,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return _extract_text_content(response)
    except (
        AuthenticationError,
        PermissionDeniedError,
        RateLimitError,
        BadRequestError,
        APITimeoutError,
        APIConnectionError,
        APIStatusError,
    ) as exc:
        raise _wrap_llm_exception(exc) from exc
