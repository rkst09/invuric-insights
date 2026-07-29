import io
import os
import sys
import unittest
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon-key")

import fitz  # noqa: E402
from PIL import Image  # noqa: E402

from config import settings  # noqa: E402
from vision import render_document_images  # noqa: E402


def _png_bytes(size=(2400, 1400), color=(20, 40, 60)) -> bytes:
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _pdf_bytes(num_pages: int) -> bytes:
    doc = fitz.open()
    for i in range(num_pages):
        page = doc.new_page()
        page.insert_text((72, 72), f"Mock screen {i + 1}")
    data = doc.tobytes()
    doc.close()
    return data


class VisionRenderingTests(unittest.TestCase):
    def setUp(self):
        self._original_max_pages = settings.backlog_vision_max_pdf_pages_each
        self._original_max_dim = settings.backlog_vision_max_image_dimension

    def tearDown(self):
        settings.backlog_vision_max_pdf_pages_each = self._original_max_pages
        settings.backlog_vision_max_image_dimension = self._original_max_dim

    def test_png_upload_returns_single_downscaled_block(self):
        settings.backlog_vision_max_image_dimension = 800
        blocks = render_document_images(_png_bytes(), "image/png", "screen.png")

        self.assertEqual(len(blocks), 1)
        self.assertEqual(blocks[0]["media_type"], "image/png")
        decoded = Image.open(io.BytesIO(__import__("base64").b64decode(blocks[0]["data"])))
        self.assertLessEqual(max(decoded.size), 800)

    def test_jpeg_content_type_is_accepted(self):
        img = Image.new("RGB", (400, 300), color=(200, 100, 50))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        blocks = render_document_images(buf.getvalue(), "image/jpeg", "screen.jpg")
        self.assertEqual(len(blocks), 1)

    def test_pdf_pages_are_capped(self):
        settings.backlog_vision_max_pdf_pages_each = 3
        blocks = render_document_images(_pdf_bytes(10), "application/pdf", "mockup.pdf")
        self.assertEqual(len(blocks), 3)
        for block in blocks:
            self.assertEqual(block["media_type"], "image/png")

    def test_pdf_with_fewer_pages_than_cap_returns_all_pages(self):
        settings.backlog_vision_max_pdf_pages_each = 10
        blocks = render_document_images(_pdf_bytes(2), "application/pdf", "short.pdf")
        self.assertEqual(len(blocks), 2)

    def test_unsupported_content_type_returns_empty(self):
        blocks = render_document_images(b"whatever", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "doc.docx")
        self.assertEqual(blocks, [])

    def test_corrupt_pdf_bytes_fails_safe_to_empty_list(self):
        blocks = render_document_images(b"not a real pdf", "application/pdf", "broken.pdf")
        self.assertEqual(blocks, [])

    def test_corrupt_image_bytes_fails_safe_to_empty_list(self):
        blocks = render_document_images(b"not a real image", "image/png", "broken.png")
        self.assertEqual(blocks, [])


if __name__ == "__main__":
    unittest.main()
