import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from generators.pdf_generator import get_libreoffice_binary  # noqa: E402


class PdfGeneratorTests(unittest.TestCase):
    def test_prefers_explicit_env_binary(self):
        with patch.dict(os.environ, {"LIBREOFFICE_BINARY": "/custom/libreoffice"}, clear=False):
            self.assertEqual(get_libreoffice_binary(), "/custom/libreoffice")

    def test_falls_back_to_detected_binary(self):
        with patch.dict(os.environ, {}, clear=True):
            with patch("generators.pdf_generator.shutil.which", side_effect=["", "/usr/bin/soffice"]):
                self.assertEqual(get_libreoffice_binary(), "/usr/bin/soffice")


if __name__ == "__main__":
    unittest.main()
