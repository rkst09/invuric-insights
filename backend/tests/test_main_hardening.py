import os
import sys
import asyncio
import unittest
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from docx import Document
from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon-key")

from auth import CurrentUser, get_current_user  # noqa: E402
from config import settings  # noqa: E402
from database import replace_output_file, reset_local_backend_data  # noqa: E402
from generation_jobs import resume_incomplete_generations  # noqa: E402
from main import app  # noqa: E402
from utils.rate_limit import rate_limiter  # noqa: E402

_TEST_USER = CurrentUser(user_id="test-user", email="test@invuric.co", org_id="test-org")


class MainHardeningTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.dependency_overrides[get_current_user] = lambda: _TEST_USER
        cls.client = TestClient(app)

    def setUp(self):
        rate_limiter._hits.clear()
        self._original_upload_limit = settings.rate_limit_uploads_per_window
        self._original_window = settings.rate_limit_window_seconds
        self._original_storage_backend = settings.storage_backend
        self._original_public_backend_url = settings.public_backend_url

    def tearDown(self):
        settings.rate_limit_uploads_per_window = self._original_upload_limit
        settings.rate_limit_window_seconds = self._original_window
        settings.storage_backend = self._original_storage_backend
        settings.public_backend_url = self._original_public_backend_url
        rate_limiter._hits.clear()

    def test_unauthenticated_requests_are_rejected(self):
        app.dependency_overrides.pop(get_current_user, None)
        try:
            response = self.client.get("/api/sessions")
            self.assertEqual(response.status_code, 401)
        finally:
            app.dependency_overrides[get_current_user] = lambda: _TEST_USER

    def test_sessions_are_isolated_by_organization(self):
        settings.storage_backend = "local"
        reset_local_backend_data()

        other_user = CurrentUser(user_id="other-user", email="other@otherco.com", org_id="other-org")
        app.dependency_overrides[get_current_user] = lambda: other_user
        other_session = self.client.post(
            "/api/sessions", json={"module_type": "raid", "metadata": {"project_name": "Rival"}}
        ).json()

        app.dependency_overrides[get_current_user] = lambda: _TEST_USER
        my_session = self.client.post(
            "/api/sessions", json={"module_type": "raid", "metadata": {"project_name": "Atlas"}}
        ).json()

        # Cannot read another org's session by ID
        cross_org_read = self.client.get(f"/api/sessions/{other_session['id']}")
        self.assertEqual(cross_org_read.status_code, 404)

        # Cannot delete another org's session
        cross_org_delete = self.client.delete(f"/api/sessions/{other_session['id']}")
        self.assertEqual(cross_org_delete.status_code, 404)

        # Listing only returns sessions in the caller's own org
        listing = self.client.get("/api/sessions").json()
        listed_ids = {item["id"] for item in listing}
        self.assertIn(my_session["id"], listed_ids)
        self.assertNotIn(other_session["id"], listed_ids)

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

    def test_resume_incomplete_generations_does_not_crash_startup_on_backend_errors(self):
        with patch("generation_jobs.list_resumable_generations", side_effect=RuntimeError("database unavailable")):
            asyncio.run(resume_incomplete_generations())

        with (
            patch("generation_jobs.list_resumable_generations", return_value=[{"session_id": "session-1", "module_type": "sow"}]),
            patch("generation_jobs.schedule_generation", side_effect=RuntimeError("scheduler unavailable")),
        ):
            asyncio.run(resume_incomplete_generations())

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

    def test_local_backend_supports_uploads_and_output_downloads(self):
        settings.storage_backend = "local"
        settings.public_backend_url = "http://testserver"
        reset_local_backend_data()

        session_response = self.client.post(
            "/api/sessions",
            json={"module_type": "raid", "metadata": {"project_name": "Atlas"}})
        self.assertEqual(session_response.status_code, 200)
        session_id = session_response.json()["id"]

        document = Document()
        document.add_paragraph("Process overview for Atlas")
        buffer = BytesIO()
        document.save(buffer)
        upload_response = self.client.post(
            "/api/upload",
            data={"session_id": session_id},
            files={
                "file": (
                    "atlas.docx",
                    buffer.getvalue(),
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
            },
        )
        self.assertEqual(upload_response.status_code, 200)
        self.assertEqual(upload_response.json()["session_id"], session_id)

        session_detail = self.client.get(f"/api/sessions/{session_id}")
        self.assertEqual(session_detail.status_code, 200)
        payload = session_detail.json()
        self.assertEqual(payload["id"], session_id)
        self.assertEqual(len(payload["documents"]), 1)

        replace_output_file(
            session_id,
            "raid_xlsx",
            f"outputs/{session_id}/raid.xlsx",
            b"local output bytes",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        download_response = self.client.get(f"/api/sessions/{session_id}/outputs/raid_xlsx/download")
        self.assertEqual(download_response.status_code, 200)
        download_url = download_response.json()["download_url"]
        self.assertIn("/api/system/local-file", download_url)

        file_response = self.client.get(download_url.replace("http://testserver", ""))
        self.assertEqual(file_response.status_code, 200)
        self.assertEqual(file_response.content, b"local output bytes")


if __name__ == "__main__":
    unittest.main()
