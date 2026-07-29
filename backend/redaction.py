"""Reversible PII redaction for text that leaves the server on its way to the Anthropic API.

Phase 1 - known fields: client_name, project_name, author, requestor are already explicit
fields in the questionnaire answers dict, so they are masked by deterministic exact
(case-insensitive) match - no detection heuristics required.

Phase 2 - pattern detection: emails, IBAN/UK sort-code+account numbers, phone numbers,
currency amounts, and card-like numbers are masked via regex before any text reaches the
model. This runs locally and never calls an LLM itself.

A RedactionSession holds the token<->original mapping for exactly one generation call.
It is never persisted - callers redact right before the API call and restore() the
model's JSON/text output immediately after, then discard the session.

Regex matching here is deliberately permissive (a few false positives are fine - the
masked span is restored byte-for-byte if it reappears in the model's output, so
over-redaction only costs the model a little context, never correctness). It will not
catch every unanticipated format; a human review step remains the honest stopgap for
whatever this phase misses.
"""

from __future__ import annotations

import re

_KNOWN_FIELD_TOKENS: dict[str, str] = {
    "client_name": "CLIENT_NAME",
    "org_name": "CLIENT_NAME",
    "project_name": "PROJECT_NAME",
    "author": "AUTHOR_NAME",
    "requestor": "REQUESTOR_NAME",
}

_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("EMAIL", re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")),
    ("IBAN", re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b")),
    ("SORT_ACCOUNT", re.compile(r"\b\d{2}-\d{2}-\d{2}\b(?:\s*,?\s*\d{6,8}\b)?")),
    ("PHONE", re.compile(r"(?<!\d)(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]){2,4}\d{3,4}(?!\d)")),
    (
        "AMOUNT",
        re.compile(r"(?:[£$€]\s?\d[\d,]*(?:\.\d{1,2})?)|(?:\b\d[\d,]*(?:\.\d{1,2})?\s?(?:GBP|USD|EUR)\b)"),
    ),
    ("CARD_NUMBER", re.compile(r"\b(?:\d[ -]?){13,19}\b")),
]


class RedactionSession:
    """Token map for one generation job. Create, mask, call the LLM, restore, discard."""

    def __init__(self) -> None:
        self.token_map: dict[str, str] = {}
        self._value_to_token: dict[str, str] = {}
        self._counters: dict[str, int] = {}

    def _reserve(self, prefix: str, original: str) -> str:
        key = original.lower()
        existing = self._value_to_token.get(key)
        if existing:
            return existing
        numbered = prefix not in _KNOWN_FIELD_TOKENS.values()
        if numbered:
            self._counters[prefix] = self._counters.get(prefix, 0) + 1
            token = f"[{prefix}_{self._counters[prefix]}]"
        else:
            token = f"[{prefix}]"
        self.token_map[token] = original
        self._value_to_token[key] = token
        return token

    def mask_known_field(self, field_name: str, value):
        """Phase 1: mask a single known questionnaire field. Returns the token, or the
        original value unchanged if the field isn't a recognised PII field."""
        prefix = _KNOWN_FIELD_TOKENS.get(field_name)
        if not prefix or value is None:
            return value
        value_str = str(value).strip()
        if len(value_str) < 2:
            return value
        return self._reserve(prefix, value_str)

    def mask_answers(self, answers: dict) -> dict:
        """Phase 1 (known metadata fields) + Phase 2 (regex scan of every other
        free-text answer) applied to a whole questionnaire answers dict."""
        masked: dict = {}
        for key, value in (answers or {}).items():
            if key in _KNOWN_FIELD_TOKENS and value:
                masked[key] = self.mask_known_field(key, value)
            elif isinstance(value, str):
                masked[key] = self.redact_text(value)
            else:
                masked[key] = value
        return masked

    def redact_text(self, text: str) -> str:
        """Mask any already-known field values, then scan for structured PII patterns."""
        if not text:
            return text or ""
        redacted = text
        for original_lower, token in self._value_to_token.items():
            original = self.token_map[token]
            redacted = re.compile(re.escape(original), re.IGNORECASE).sub(token, redacted)
        for prefix, pattern in _PATTERNS:
            redacted = pattern.sub(lambda m, prefix=prefix: self._reserve(prefix, m.group(0)), redacted)
        return redacted

    def restore(self, value):
        """Recursively replace tokens with their original values in the model's output."""
        if not self.token_map:
            return value
        if isinstance(value, str):
            for token, original in self.token_map.items():
                if token in value:
                    value = value.replace(token, original)
            return value
        if isinstance(value, dict):
            return {key: self.restore(item) for key, item in value.items()}
        if isinstance(value, list):
            return [self.restore(item) for item in value]
        return value
