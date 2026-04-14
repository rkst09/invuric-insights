import os
import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon-key")

from config import settings  # noqa: E402
from main import app  # noqa: E402
from utils.rate_limit import rate_limiter  # noqa: E402


class MainHardeningTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        rate_limiter._hits.clear()
        self._original_upload_limit = settings.rate_limit_uploads_per_window
        self._original_window = settings.rate_limit_window_seconds

    def tearDown(self):
        settings.rate_limit_uploads_per_window = self._original_upload_limit
        settings.rate_limit_window_seconds = self._original_window
        rate_limiter._hits.clear()

    def test_health_includes_request_headers(self):
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.headers.get("X-Request-ID"))
        self.assertEqual(response.headers.get("X-Content-Type-Options"), "nosniff")
        self.assertEqual(response.headers.get("X-Frame-Options"), "DENY")
        self.assertEqual(response.json()["status"], "ok")

    def test_validation_errors_are_standardized(self):
        response = self.client.post(
            "/api/generate/pfd",
            json={"session_id": "session-1", "style": "invalid-style"},
        )

        self.assertEqual(response.status_code, 422)
        payload = response.json()
        self.assertEqual(payload["error_code"], "validation_error")
        self.assertTrue(payload["request_id"])
        self.assertIsInstance(payload["errors"], list)

    def test_upload_paths_are_rate_limited(self):
        settings.rate_limit_uploads_per_window = 2
        settings.rate_limit_window_seconds = 60

        first = self.client.post("/api/upload")
        second = self.client.post("/api/upload")
        third = self.client.post("/api/upload")

        self.assertEqual(first.status_code, 422)
        self.assertEqual(second.status_code, 422)
        self.assertEqual(third.status_code, 429)
        self.assertEqual(third.json()["error_code"], "rate_limited")
        self.assertTrue(third.headers.get("Retry-After"))


if __name__ == "__main__":
    unittest.main()
