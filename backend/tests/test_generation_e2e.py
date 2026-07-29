import io
import os
import sys
import asyncio
import shutil
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from PIL import Image

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon-key")
os.environ.setdefault("STORAGE_BACKEND", "local")

from auth import CurrentUser, get_current_user  # noqa: E402
from config import settings  # noqa: E402
from database import execute_query, get_generation_state, get_supabase, reset_local_backend_data, update_generation_state  # noqa: E402
from generation_jobs import (  # noqa: E402
    run_backlog_generation,
    run_document_generation,
    run_pfd_generation,
    run_raid_generation,
    run_wbs_generation,
)
from main import app  # noqa: E402

_TEST_USER = CurrentUser(user_id="test-user", email="test@invuric.co", org_id="test-org")
app.dependency_overrides[get_current_user] = lambda: _TEST_USER


class _WorkspaceTemporaryDirectory:
    def __init__(self):
        self.name = str(Path(tempfile.tempdir or tempfile.gettempdir()) / f"tmp-{uuid.uuid4().hex}")

    def __enter__(self):
        Path(self.name).mkdir(parents=True, exist_ok=False)
        return self.name

    def __exit__(self, _exc_type, _exc, _traceback):
        shutil.rmtree(self.name, ignore_errors=True)


def _sow_payload():
    return {
        "metadata": {
            "client_name": "Northwind",
            "project_id": "INV-001",
            "project_name": "Atlas",
            "author": "Invuric",
            "requestor": "Ops",
            "start_date": "2026-01-01",
            "end_date": "2026-03-01",
        },
        "executive_summary": "Summary",
        "project_overview": "Overview",
        "scope_of_work": {"in_scope": ["Discovery"], "out_of_scope": ["Support"]},
        "deliverables": [{"id": "D1", "name": "Plan", "description": "Delivery plan"}],
        "risks": [{"id": "R1", "description": "Dependency risk"}],
        "assumptions": [{"id": "A1", "description": "Stakeholders available"}],
        "dependencies": [{"id": "DEP1", "description": "API access"}],
        "responsibilities": {"Client": ["Review"], "Invuric": ["Deliver"]},
        "timeline": {"phases": [{"phase": "Discovery", "weeks": "1-2", "deliverables": "Plan"}]},
        "roles": [{"role": "BA", "description": "Analysis", "location": "Remote", "hours": "40"}],
        "change_management": "Change control",
        "acceptance_criteria": ["Sponsor sign-off"],
        "validity": "30 days",
    }


def _prd_payload():
    return {
        "metadata": _sow_payload()["metadata"],
        "product_overview": "Product overview",
        "problem_statement": "Problem statement",
        "goals": [{"goal": "Reduce cycle time", "metric": "Minutes", "target": "< 10", "timeframe": "90 days"}],
        "user_personas": [{"name": "Priya", "role": "Ops", "age_range": "30-40", "context": "Daily user", "goals": "Speed", "pain_points": "Manual work", "tech_proficiency": "Intermediate", "success_definition": "Fast completion"}],
        "feature_requirements": [{"id": "F1", "feature": "Intake", "description": "Guided intake", "priority": "High", "user_story": "As a user I want intake.", "acceptance_criteria": "Given data, When submitted, Then saved.", "dependencies": "CRM"}],
        "non_functional_requirements": [{"category": "Performance", "requirement": "Fast", "metric": "P95 < 2s"}],
        "user_flows": [{"flow_name": "Submit", "actor": "User", "steps": ["Open", "Submit"], "success_outcome": "Saved"}],
        "edge_cases": [{"scenario": "Timeout", "trigger": "API slow", "expected_system_behavior": "Retry", "user_communication": "Try again"}],
        "risks": [{"id": "R1", "risk": "Late API", "likelihood": "Medium", "impact": "High", "mitigation": "Start early"}],
        "technical_constraints": ["Use existing CRM"],
        "out_of_scope": ["Mobile"],
        "testing_strategy": {"approach": "Risk based", "test_types": ["unit"], "coverage_areas": ["intake"], "vague_input_handling": "Prompt", "conflicting_requirements_handling": "Escalate"},
        "assumptions": ["Stakeholders available"],
        "timeline": "12 weeks",
        "open_questions": ["Offline mode?"],
    }


def _frd_payload():
    return {
        "metadata": _sow_payload()["metadata"],
        "system_overview": "System overview",
        "business_context": "Business context",
        "functional_requirements": [{"id": "FR1", "module": "Intake", "requirement": "Capture requests", "description": "Capture structured data", "priority": "High", "inputs": "Form data", "processing_rules": "Validate required fields", "outputs": "Request record", "acceptance_criteria": "Request is saved"}],
        "business_rules": [{"id": "BR1", "rule": "Required fields", "description": "Mandatory data must be present", "condition": "Submit", "outcome": "Validation"}],
        "data_requirements": [{"entity": "Request", "fields": "id, status", "source": "User", "validation": "Required", "retention": "7 years"}],
        "integrations": [{"system": "CRM", "direction": "Outbound", "data_exchanged": "Request", "method": "REST", "frequency": "Realtime"}],
        "user_roles_permissions": [{"role": "Analyst", "permissions": "Create", "restrictions": "Own records only"}],
        "workflows": [{"workflow_name": "Submit request", "trigger": "User submit", "steps": ["Validate", "Save"], "exceptions": ["Timeout"]}],
        "reporting_requirements": [{"report": "Status", "audience": "Ops", "frequency": "Daily", "metrics": "Open requests"}],
        "non_functional_requirements": [{"category": "Security", "requirement": "TLS", "metric": "HTTPS only"}],
        "assumptions": ["CRM available"],
        "dependencies": ["CRM API"],
        "open_questions": ["Approval needed?"],
    }


def _raid_payload():
    item = {"id": "R1", "title": "Risk", "description": "Risk item", "probability": "Medium", "impact": "High", "risk_score": "High", "owner": "PM"}
    return {"risks": [item], "assumptions": [item], "issues": [item], "dependencies": [item]}


def _wbs_payload():
    return {
        "project_name": "Atlas",
        "total_phases": 1,
        "total_tasks": 1,
        "total_subtasks": 1,
        "phases": [{
            "id": "P1",
            "name": "Discovery",
            "objective": "Understand scope",
            "exit_criteria": "Scope signed off",
            "duration": "1 week",
            "tasks": [{
                "id": "T1",
                "name": "Workshop",
                "description": "Run workshop",
                "duration": "2 days",
                "assigned_to": ["PM"],
                "dependencies": "None",
                "subtasks": [{"id": "S1", "name": "Schedule", "duration": "1 day", "assigned_to": ["PM"]}],
            }],
        }],
    }


def _backlog_payload():
    return {
        "stories": [{
            "page_name": "Dashboard",
            "high_level_flow": "Review status",
            "user_story": "As an analyst I want status.",
            "acceptance_criteria": "Given data, When opened, Then status appears.",
            "data_points": "status",
            "edge_cases": "No data",
            "non_functional": "P95 < 2s",
            "project_id": "INV-001",
            "project_name": "Atlas",
            "analyzed_at": "2026-01-01",
        }]
    }


class GenerationE2ETests(unittest.TestCase):
    def setUp(self):
        self._original_storage_backend = settings.storage_backend
        self._original_public_backend_url = settings.public_backend_url
        settings.storage_backend = "local"
        settings.public_backend_url = "http://testserver"
        self._original_tempdir = tempfile.tempdir
        self._tmp_root = BACKEND_ROOT / "tests" / ".tmp"
        self._tmp_root.mkdir(parents=True, exist_ok=True)
        tempfile.tempdir = str(self._tmp_root)
        self._tempdir_patch = patch("generation_jobs.tempfile.TemporaryDirectory", new=_WorkspaceTemporaryDirectory)
        self._tempdir_patch.start()
        reset_local_backend_data()
        self.client = TestClient(app)

    def tearDown(self):
        settings.storage_backend = self._original_storage_backend
        settings.public_backend_url = self._original_public_backend_url
        self._tempdir_patch.stop()
        tempfile.tempdir = self._original_tempdir
        reset_local_backend_data()
        shutil.rmtree(self._tmp_root, ignore_errors=True)

    def _create_session(self, module_type: str) -> str:
        response = self.client.post("/api/sessions", json={"module_type": module_type, "metadata": {"project_name": "Atlas"}})
        self.assertEqual(response.status_code, 200)
        session_id = response.json()["id"]
        execute_query(
            "test_insert_extracted_data",
            get_supabase().table("extracted_data").insert({
                "session_id": session_id,
                "document_id": "seed-doc",
                "raw_text": "Project context for Atlas.",
            }),
        )
        return session_id

    def _create_session_with_metadata(self, module_type: str, metadata: dict, raw_text: str) -> str:
        response = self.client.post("/api/sessions", json={"module_type": module_type, "metadata": metadata})
        self.assertEqual(response.status_code, 200)
        session_id = response.json()["id"]
        execute_query(
            "test_insert_extracted_data",
            get_supabase().table("extracted_data").insert({
                "session_id": session_id,
                "document_id": "seed-doc",
                "raw_text": raw_text,
            }),
        )
        return session_id

    def _assert_completed(self, session_id: str, module_type: str, expected_result_key: str):
        response = self.client.get(f"/api/sessions/{session_id}/generation?module_type={module_type}")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        generation = payload.get("generation") or {}
        self.assertEqual(generation.get("status"), "completed", generation.get("error"))
        self.assertIn(expected_result_key, payload.get("result") or {})

    def test_all_generation_routes_queue_durably(self):
        cases = [
            ("sow", "/api/generate/sow", {"answers": {}, "export_format": "docx", "template": "invuric"}),
            ("prd", "/api/generate/prd", {"answers": {}, "export_format": "docx", "template": "invuric"}),
            ("frd", "/api/generate/frd", {"answers": {}, "export_format": "docx", "template": "invuric"}),
            ("raid", "/api/generate/raid", {}),
            ("wbs", "/api/generate/wbs", {"audience": ["PM"]}),
            ("backlog", "/api/generate/backlog", {"project_name": "Atlas", "project_id": "INV-001"}),
            ("pfd", "/api/generate/pfd", {"flow_type": "business", "style": "flowchart"}),
        ]

        with patch("generation_jobs.schedule_generation", return_value="test-job"):
            for module_type, path, body in cases:
                session_id = self._create_session(module_type)
                response = self.client.post(path, json={"session_id": session_id, **body})
                self.assertEqual(response.status_code, 200, response.text)
                self.assertEqual(response.json()["status"], "queued")
                state = get_generation_state(session_id, module_type) or {}
                self.assertEqual(state.get("status"), "queued")
                self.assertIsInstance(state.get("request"), dict)

    def test_completed_generation_route_returns_cached_result(self):
        session_id = self._create_session("raid")
        request_payload = {"session_id": session_id}
        update_generation_state(
            session_id,
            "raid",
            status="completed",
            stage="completed",
            message="RAID register ready.",
            progress=100,
            job_id="cached-job",
            request=request_payload,
            result={"output_type": "raid_xlsx", "data": _raid_payload()},
        )

        with patch("generation_jobs.schedule_generation") as schedule:
            response = self.client.post("/api/generate/raid", json=request_payload)

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["status"], "completed")
        self.assertTrue(response.json()["cached"])
        schedule.assert_not_called()

    def test_raid_worker_falls_back_when_model_times_out(self):
        async def timeout_pipeline(_raw_text):
            raise TimeoutError("Claude took too long to respond.")

        session_id = self._create_session("raid")
        with patch("generation_jobs.run_raid_pipeline", new=timeout_pipeline):
            asyncio.run(run_raid_generation(session_id=session_id, job_id="test-job"))

        response = self.client.get(f"/api/sessions/{session_id}/generation?module_type=raid")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        generation = payload.get("generation") or {}
        self.assertEqual(generation.get("status"), "completed", generation.get("error"))
        self.assertEqual(generation.get("stage"), "completed")
        self.assertIn("download_url", payload.get("result") or {})
        self.assertEqual((payload.get("result") or {}).get("data", {}).get("issues", [])[0].get("title"), "AI generation fallback used")

    def test_wbs_worker_falls_back_when_model_times_out(self):
        async def timeout_pipeline(_raw_text, _audience):
            raise TimeoutError("Claude took too long to respond.")

        session_id = self._create_session("wbs")
        with patch("generation_jobs.run_wbs_pipeline", new=timeout_pipeline):
            asyncio.run(run_wbs_generation(session_id=session_id, audience=["PM", "Developers"], job_id="test-job"))

        response = self.client.get(f"/api/sessions/{session_id}/generation?module_type=wbs")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        generation = payload.get("generation") or {}
        result = payload.get("result") or {}
        self.assertEqual(generation.get("status"), "completed", generation.get("error"))
        self.assertIn("download_url", result)
        self.assertGreaterEqual(len((result.get("data") or {}).get("phases", [])), 3)

    def test_backlog_worker_falls_back_when_model_times_out(self):
        async def timeout_pipeline(_raw_text, _project_name, _project_id, _context, _images=None):
            raise TimeoutError("Claude took too long to respond.")

        session_id = self._create_session("backlog")
        with patch("generation_jobs.run_backlog_pipeline", new=timeout_pipeline):
            asyncio.run(run_backlog_generation(
                session_id=session_id,
                project_name="Atlas",
                project_id="INV-001",
                supplemental_context="",
                job_id="test-job",
            ))

        response = self.client.get(f"/api/sessions/{session_id}/generation?module_type=backlog")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        generation = payload.get("generation") or {}
        result = payload.get("result") or {}
        self.assertEqual(generation.get("status"), "completed", generation.get("error"))
        self.assertIn("download_url", result)
        self.assertGreaterEqual(len((result.get("data") or {}).get("stories", [])), 10)

    def test_document_workers_fall_back_when_model_times_out(self):
        async def timeout_pipeline(_doc_type, _raw_text, _answers, _template_context=""):
            raise TimeoutError("Claude took too long to respond.")

        answers = {
            "client_name": "Northwind",
            "project_id": "INV-001",
            "project_name": "Atlas",
            "author": "Invuric",
            "requestor": "Operations",
        }

        with patch("generation_jobs.run_doc_pipeline", new=timeout_pipeline):
            for doc_type in ["sow", "prd", "frd"]:
                session_id = self._create_session(doc_type)
                asyncio.run(run_document_generation(
                    session_id=session_id,
                    doc_type=doc_type,
                    answers=answers,
                    export_format="docx",
                    template="invuric",
                    job_id="test-job",
                ))

                response = self.client.get(f"/api/sessions/{session_id}/generation?module_type={doc_type}")
                self.assertEqual(response.status_code, 200)
                payload = response.json()
                generation = payload.get("generation") or {}
                result = payload.get("result") or {}
                self.assertEqual(generation.get("status"), "completed", generation.get("error"))
                self.assertIn("download_url", result)
                self.assertEqual(result.get("output_type"), f"{doc_type}_docx")

    def test_all_generation_workers_complete_without_live_llm(self):
        async def fake_doc_pipeline(doc_type, _raw_text, _answers, _template_context=""):
            return {"sow": _sow_payload, "prd": _prd_payload, "frd": _frd_payload}[doc_type]()

        patches = [
            patch("generation_jobs.run_doc_pipeline", new=fake_doc_pipeline),
            patch("generation_jobs.run_raid_pipeline", new=lambda _raw_text: _async_value(_raid_payload())),
            patch("generation_jobs.run_wbs_pipeline", new=lambda _raw_text, _audience: _async_value(_wbs_payload())),
            patch("generation_jobs.run_backlog_pipeline", new=lambda _raw_text, _project_name, _project_id, _context, _images=None: _async_value(_backlog_payload())),
            patch("generation_jobs.run_pfd_pipeline", new=lambda _raw_text, _flow_type, _style: _async_value("graph TD\nA[Start] --> B[Done]")),
        ]

        with patches[0], patches[1], patches[2], patches[3], patches[4]:
            for doc_type in ["sow", "prd", "frd"]:
                session_id = self._create_session(doc_type)
                asyncio.run(run_document_generation(
                    session_id=session_id,
                    doc_type=doc_type,
                    answers={},
                    export_format="docx",
                    template="invuric",
                    job_id="test-job",
                ))
                self._assert_completed(session_id, doc_type, "download_url")

            session_id = self._create_session("raid")
            asyncio.run(run_raid_generation(session_id=session_id, job_id="test-job"))
            self._assert_completed(session_id, "raid", "download_url")

            session_id = self._create_session("wbs")
            asyncio.run(run_wbs_generation(session_id=session_id, audience=["PM"], job_id="test-job"))
            self._assert_completed(session_id, "wbs", "download_url")

            session_id = self._create_session("backlog")
            asyncio.run(run_backlog_generation(
                session_id=session_id,
                project_name="Atlas",
                project_id="INV-001",
                supplemental_context="",
                job_id="test-job",
            ))
            self._assert_completed(session_id, "backlog", "download_url")

            session_id = self._create_session("pfd")
            asyncio.run(run_pfd_generation(session_id=session_id, flow_type="business", style="flowchart", job_id="test-job"))
            self._assert_completed(session_id, "pfd", "mermaid_code")


    # RAID/WBS/PFD/Backlog don't receive a questionnaire answers dict, so known
    # project/client names have to be pulled from the session record instead. These
    # tests prove that path actually masks free-text mentions before the (mocked)
    # pipeline sees them, and restores the real values in the final result.

    def test_raid_worker_masks_known_names_from_session_and_restores_them(self):
        captured = {}

        async def capturing_pipeline(raw_text):
            captured["raw_text"] = raw_text
            payload = _raid_payload()
            payload["risks"][0]["description"] = "Escalate to [CLIENT_NAME] before the [PROJECT_NAME] cutover."
            return payload

        session_id = self._create_session_with_metadata(
            "raid",
            {"project_name": "Atlas", "client_name": "Northwind Bank"},
            "Northwind Bank has approved the Atlas rollout for Q1. Contact ops@northwind-bank.example for details.",
        )

        with patch("generation_jobs.run_raid_pipeline", new=capturing_pipeline):
            asyncio.run(run_raid_generation(session_id=session_id, job_id="test-job"))

        self.assertNotIn("Northwind Bank", captured["raw_text"])
        self.assertNotIn("Atlas", captured["raw_text"])
        self.assertNotIn("ops@northwind-bank.example", captured["raw_text"])

        response = self.client.get(f"/api/sessions/{session_id}/generation?module_type=raid")
        result = response.json().get("result") or {}
        description = (result.get("data") or {}).get("risks", [{}])[0].get("description", "")
        self.assertIn("Northwind Bank", description)
        self.assertIn("Atlas", description)

    def test_backlog_worker_masks_project_name_inside_raw_text_too(self):
        """Regression check: project_name must be registered before raw_text is
        scanned, not after - otherwise a mention of it inside the uploaded document
        (as opposed to the request parameter) would reach Claude unmasked."""
        captured = {}

        async def capturing_pipeline(raw_text, project_name, project_id, supplemental_context, images=None):
            captured["raw_text"] = raw_text
            captured["project_name"] = project_name
            captured["images"] = images
            payload = _backlog_payload()
            payload["stories"][0]["high_level_flow"] = "Coordinate with [CLIENT_NAME] on the [PROJECT_NAME] launch."
            return payload

        session_id = self._create_session_with_metadata(
            "backlog",
            {"project_name": "Atlas", "client_name": "Northwind Bank"},
            "The Atlas programme is sponsored by Northwind Bank leadership.",
        )

        with patch("generation_jobs.run_backlog_pipeline", new=capturing_pipeline):
            asyncio.run(run_backlog_generation(
                session_id=session_id,
                project_name="Atlas",
                project_id="INV-001",
                supplemental_context="",
                job_id="test-job",
            ))

        self.assertNotIn("Atlas", captured["raw_text"])
        self.assertNotIn("Northwind Bank", captured["raw_text"])
        self.assertEqual(captured["project_name"], "[PROJECT_NAME]")
        # No documents table row exists for this session (only a raw extracted_data
        # row seeded directly), so there's nothing to render into vision images.
        self.assertEqual(captured["images"], [])

        response = self.client.get(f"/api/sessions/{session_id}/generation?module_type=backlog")
        result = response.json().get("result") or {}
        flow = (result.get("data") or {}).get("stories", [{}])[0].get("high_level_flow", "")
        self.assertIn("Northwind Bank", flow)
        self.assertIn("Atlas", flow)

    def test_backlog_worker_renders_uploaded_screenshot_as_a_vision_image(self):
        """End-to-end: a real uploaded PNG screen must flow all the way through
        list_documents_for_session -> download_storage_file -> render_document_images
        and arrive at the pipeline as an actual base64 image block, not just a filename."""
        img = Image.new("RGB", (900, 600), color=(10, 30, 60))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        png_bytes = buf.getvalue()

        upload_response = self.client.post(
            "/api/upload",
            files={"file": ("dashboard-screen.png", png_bytes, "image/png")},
        )
        self.assertEqual(upload_response.status_code, 200, upload_response.text)
        session_id = upload_response.json()["session_id"]

        captured = {}

        async def capturing_pipeline(raw_text, project_name, project_id, supplemental_context, images=None):
            captured["images"] = images
            return _backlog_payload()

        with patch("generation_jobs.run_backlog_pipeline", new=capturing_pipeline):
            asyncio.run(run_backlog_generation(
                session_id=session_id,
                project_name="Atlas",
                project_id="INV-001",
                supplemental_context="",
                job_id="test-job",
            ))

        images = captured["images"]
        self.assertIsInstance(images, list)
        self.assertEqual(len(images), 1)
        self.assertEqual(images[0]["media_type"], "image/png")
        decoded = Image.open(io.BytesIO(__import__("base64").b64decode(images[0]["data"])))
        self.assertEqual(decoded.format, "PNG")


async def _async_value(value):
    return value


if __name__ == "__main__":
    unittest.main()
