"""Renders uploaded PDF pages and PNG/JPG screens into Claude-ready vision image
blocks, for the Backlog/User Stories pipeline only - the one flow where Claude
needs to actually see uploaded screens/mockups rather than just their extracted
text, in order to derive screen-accurate user stories.

Images are NOT redacted - redaction.py only operates on text. Whoever uploads a
screen is responsible for not including one with real customer data visible on
it; the upload UI carries an explicit warning about this.
"""

from __future__ import annotations

import base64
import io
import logging

import fitz
from PIL import Image

from config import settings

LOGGER = logging.getLogger("invuric.vision")

_PDF_CONTENT_TYPE = "application/pdf"
_IMAGE_CONTENT_TYPES = {"image/png", "image/jpeg", "image/jpg"}
_RENDER_DPI = 144  # ~1224x1584px for a Letter/A4 page - close to the downscale cap below.


def render_document_images(content: bytes, content_type: str, filename: str) -> list[dict]:
    """Returns [{"media_type": "image/png", "data": <base64>}, ...] for a single
    uploaded file - one block per rendered PDF page (capped), or a single
    downscaled block for a PNG/JPG upload. Empty list for anything else (DOCX)."""
    try:
        if content_type == _PDF_CONTENT_TYPE:
            return _render_pdf_pages(content)
        if content_type in _IMAGE_CONTENT_TYPES:
            return [_downscale_image(content)]
    except Exception:
        LOGGER.warning(
            "vision_render_failed filename=%s content_type=%s", filename, content_type, exc_info=True
        )
    return []


def _render_pdf_pages(content: bytes) -> list[dict]:
    max_pages = max(0, settings.backlog_vision_max_pdf_pages_each)
    blocks: list[dict] = []
    with fitz.open(stream=content, filetype="pdf") as doc:
        for page in doc:
            if len(blocks) >= max_pages:
                break
            pixmap = page.get_pixmap(dpi=_RENDER_DPI)
            blocks.append(_downscale_image(pixmap.tobytes("png")))
    return blocks


def _downscale_image(image_bytes: bytes) -> dict:
    max_dim = settings.backlog_vision_max_image_dimension
    with Image.open(io.BytesIO(image_bytes)) as img:
        if img.mode == "CMYK":
            img = img.convert("RGB")
        if max(img.size) > max_dim:
            img.thumbnail((max_dim, max_dim), Image.LANCZOS)
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
    return {"media_type": "image/png", "data": base64.b64encode(buffer.getvalue()).decode("ascii")}
