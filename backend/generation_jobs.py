"""Generation job orchestration — queue, dispatch, and track background generation tasks.

Pattern: POST route calls queue_and_dispatch() → stores state in Supabase → schedules
an asyncio task → frontend polls /api/sessions/{id}/generation until completed/failed.
On server restart, resume_incomplete_generations() re-schedules any orphaned jobs.

All async generation functions wrap synchronous Supabase and file-generation calls in
asyncio.to_thread() so the event loop is never blocked during DB I/O or CPU-heavy work.
"""

import asyncio
import logging
import os
import tempfile
import uuid

from fastapi import HTTPException

from database import (
    clear_questionnaire_answers,
    get_client_template_for_session,
    get_combined_extracted_text,
    get_combined_extracted_text_excluding,
    get_generation_state,
    get_supabase,
    list_resumable_generations,
    replace_output_file,
    update_generation_state,
    update_session_status,
)
from generators.docx_generator import generate_docx
from generators.pdf_generator import PdfConversionUnavailableError, docx_to_pdf
from generators.xlsx_generator import generate_backlog_xlsx, generate_raid_xlsx, generate_wbs_xlsx
from pipelines.backlog_pipeline import run_backlog_pipeline
from pipelines.doc_pipeline import run_doc_pipeline
from pipelines.pfd_pipeline import run_pfd_pipeline
from pipelines.raid_pipeline import run_raid_pipeline
from pipelines.wbs_pipeline import run_wbs_pipeline

_TASKS: dict[tuple[str, str], asyncio.Task] = {}
_LOGGER = logging.getLogger("invuric.jobs")
_TERMINAL_STATES = frozenset({"completed", "failed"})


def _task_key(session_id: str, module_type: str) -> tuple[str, str]:
    return session_id, module_type


# ── Async helpers ─────────────────────────────────────────────────────────────

async def _progress(
    session_id: str,
    module_type: str,
    *,
    status: str,
    stage: str,
    message: str,
    progress: int,
    job_id: str | None,
    **kwargs,
) -> None:
    """Write a progress update to Supabase without blocking the event loop."""
    await asyncio.to_thread(
        update_generation_state,
        session_id,
        module_type,
        status=status,
        stage=stage,
        message=message,
        progress=progress,
        job_id=job_id,
        **kwargs,
    )


async def _set_status(session_id: str, status: str, module_type: str) -> None:
    await asyncio.to_thread(update_session_status, session_id, status, module_type=module_type)


# ── Sync helpers (called via asyncio.to_thread) ───────────────────────────────

def _store_questionnaire_answers(session_id: str, section_id: str, answers: dict) -> None:
    """Bulk-upsert questionnaire answers — single DB round-trip instead of N inserts."""
    if not answers:
        return
    db = get_supabase()
    clear_questionnaire_answers(session_id, section_id)
    rows = [
        {"session_id": session_id, "section_id": section_id, "question_id": k, "answer": str(v), "source": "user"}
        for k, v in answers.items()
    ]
    db.table("questionnaire_answers").insert(rows).execute()


def _pfd_save_output(session_id: str, mermaid_code: str) -> None:
    """Persist PFD mermaid output — called via asyncio.to_thread."""
    db = get_supabase()
    db.table("outputs").delete().eq("session_id", session_id).eq("output_type", "pfd_mermaid").execute()
    db.table("outputs").insert({"session_id": session_id, "output_type": "pfd_mermaid", "mermaid_code": mermaid_code}).execute()


# ── Job lifecycle ─────────────────────────────────────────────────────────────

def mark_generation_failed(session_id: str, module_type: str, error: str, job_id: str | None = None) -> None:
    update_session_status(session_id, "failed", module_type=module_type)
    update_generation_state(
        session_id,
        module_type,
        status="failed",
        stage="failed",
        message=error,
        progress=100,
        error=error,
        job_id=job_id,
    )


def queue_and_dispatch(session_id: str, module_type: str, request_payload: dict, message: str) -> dict:
    """Create a generation job and schedule it — wraps all exceptions so routes never return 500.

    Returns a dict suitable for the route response.
    Any infrastructure failure (Supabase write error, missing session, etc.) is caught here
    and the frontend receives a clean 400/503 instead of an opaque 500.
    """
    try:
        job_id = create_generation_job(session_id, module_type, request_payload, message)
    except Exception as exc:
        _LOGGER.exception("queue_and_dispatch: create_generation_job failed session=%s module=%s", session_id, module_type)
        raise HTTPException(
            status_code=503,
            detail=f"Could not queue {module_type.upper()} generation. The session may have expired — please refresh and try again.",
        ) from exc

    try:
        schedule_generation(session_id, module_type)
    except Exception:
        _LOGGER.exception("queue_and_dispatch: schedule_generation failed session=%s module=%s", session_id, module_type)
        # Job was created; schedule failure is non-fatal — client can still poll.

    return {"session_id": session_id, "status": "queued", "job_id": job_id}


def create_generation_job(session_id: str, module_type: str, request_payload: dict, message: str) -> str:
    job_id = str(uuid.uuid4())
    update_session_status(session_id, "queued", module_type=module_type)
    update_generation_state(
        session_id,
        module_type,
        status="queued",
        stage="queued",
        message=message,
        progress=5,
        job_id=job_id,
        request=request_payload,
        result=None,
        error=None,
        preserve_started_at=False,
        preserve_request=False,
    )
    return job_id


def _finish_task(session_id: str, module_type: str) -> None:
    _TASKS.pop(_task_key(session_id, module_type), None)


def schedule_generation(session_id: str, module_type: str) -> str:
    state = get_generation_state(session_id, module_type)
    if not state:
        _LOGGER.warning(
            "schedule_generation: no state found for session=%s module=%s — skipping dispatch",
            session_id, module_type,
        )
        return ""

    # Don't re-schedule jobs that already finished — avoids duplicate runs on restart.
    if state.get("status") in _TERMINAL_STATES:
        return state.get("job_id") or ""

    existing = _TASKS.get(_task_key(session_id, module_type))
    if existing and not existing.done():
        return state.get("job_id") or ""

    task = asyncio.create_task(_dispatch_generation(session_id, module_type))
    task.add_done_callback(lambda _: _finish_task(session_id, module_type))
    _TASKS[_task_key(session_id, module_type)] = task
    return state.get("job_id") or ""


async def resume_incomplete_generations() -> None:
    items = await asyncio.to_thread(list_resumable_generations)
    for item in items:
        schedule_generation(item["session_id"], item["module_type"])


# ── Dispatch router ───────────────────────────────────────────────────────────

async def _dispatch_generation(session_id: str, module_type: str) -> None:
    state = await asyncio.to_thread(get_generation_state, session_id, module_type)
    state = state or {}
    request = state.get("request") if isinstance(state.get("request"), dict) else {}
    job_id = state.get("job_id")

    if module_type in {"sow", "prd", "frd"}:
        await run_document_generation(
            session_id=session_id,
            doc_type=module_type,
            answers=request.get("answers", {}),
            export_format=request.get("export_format", "docx"),
            template=request.get("template", "invuric"),
            job_id=job_id,
        )
    elif module_type == "raid":
        await run_raid_generation(session_id=session_id, job_id=job_id)
    elif module_type == "wbs":
        await run_wbs_generation(session_id=session_id, audience=request.get("audience", ["PM", "Developers"]), job_id=job_id)
    elif module_type == "backlog":
        await run_backlog_generation(
            session_id=session_id,
            project_name=request.get("project_name", ""),
            project_id=request.get("project_id", ""),
            supplemental_context=request.get("supplemental_context", ""),
            job_id=job_id,
        )
    elif module_type == "pfd":
        await run_pfd_generation(
            session_id=session_id,
            flow_type=request.get("flow_type", "end-to-end"),
            style=request.get("style", "flowchart"),
            job_id=job_id,
        )
    else:
        raise ValueError(f"Unsupported module type: {module_type}")


# ── Generation workers ────────────────────────────────────────────────────────

async def run_document_generation(
    *,
    session_id: str,
    doc_type: str,
    answers: dict,
    export_format: str,
    template: str,
    job_id: str | None,
) -> None:
    try:
        await _set_status(session_id, "generating", doc_type)
        await _progress(session_id, doc_type, status="generating", stage="preparing_context",
                        message="Preparing project context.", progress=15, job_id=job_id)

        client_template = await asyncio.to_thread(get_client_template_for_session, session_id) if template == "client" else None
        if template == "client" and not client_template:
            raise HTTPException(status_code=400, detail="Please upload a client template before generating this document.")

        excluded_ids = {client_template["document_id"]} if client_template else set()
        if excluded_ids:
            raw_text = await asyncio.to_thread(get_combined_extracted_text_excluding, session_id, excluded_ids)
        else:
            raw_text = await asyncio.to_thread(get_combined_extracted_text, session_id)
        await asyncio.to_thread(_store_questionnaire_answers, session_id, doc_type, answers)

        await _progress(session_id, doc_type, status="generating", stage="calling_model",
                        message="Generating structured content with Claude.", progress=40, job_id=job_id)
        result = await run_doc_pipeline(doc_type, raw_text, answers, client_template["text"] if client_template else "")

        await _progress(session_id, doc_type, status="generating", stage="rendering_output",
                        message=f"Rendering the {doc_type.upper()} document.", progress=72, job_id=job_id)

        with tempfile.TemporaryDirectory() as tmp:
            docx_path = os.path.join(tmp, f"{doc_type}.docx")
            await asyncio.to_thread(
                generate_docx,
                result,
                docx_path,
                doc_type=doc_type.upper(),
                template_mode=template,
                template_bytes=client_template["bytes"] if client_template else None,
                template_kind=client_template["file_type"] if client_template else None,
            )

            if export_format == "pdf":
                try:
                    out_path = await asyncio.to_thread(docx_to_pdf, docx_path, tmp)
                except PdfConversionUnavailableError as exc:
                    raise HTTPException(status_code=503, detail=str(exc)) from exc
                ext, content_type = "pdf", "application/pdf"
            else:
                out_path = docx_path
                ext, content_type = "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

            with open(out_path, "rb") as fh:
                file_bytes = fh.read()

        await _progress(session_id, doc_type, status="generating", stage="uploading_output",
                        message="Saving generated document.", progress=90, job_id=job_id)
        output_type = f"{doc_type}_{ext}"
        storage_path = f"outputs/{session_id}/{doc_type}.{ext}"
        await asyncio.to_thread(replace_output_file, session_id, output_type, storage_path, file_bytes, content_type)
        await _set_status(session_id, "completed", doc_type)
        await _progress(session_id, doc_type, status="completed", stage="completed",
                        message=f"{doc_type.upper()} ready to download.", progress=100, job_id=job_id,
                        result={"output_type": output_type})
    except HTTPException as exc:
        mark_generation_failed(session_id, doc_type, str(exc.detail), job_id)
    except Exception as exc:
        _LOGGER.exception("run_document_generation failed session=%s doc_type=%s", session_id, doc_type)
        mark_generation_failed(session_id, doc_type, str(exc), job_id)


async def run_raid_generation(*, session_id: str, job_id: str | None) -> None:
    module_type = "raid"
    try:
        await _set_status(session_id, "generating", module_type)
        await _progress(session_id, module_type, status="generating", stage="preparing_context",
                        message="Preparing project context.", progress=15, job_id=job_id)
        raw_text = await asyncio.to_thread(get_combined_extracted_text, session_id)

        await _progress(session_id, module_type, status="generating", stage="calling_model",
                        message="Generating the RAID register with Claude.", progress=40, job_id=job_id)
        result = await run_raid_pipeline(raw_text)

        await _progress(session_id, module_type, status="generating", stage="rendering_output",
                        message="Building the Excel workbook.", progress=72, job_id=job_id)
        with tempfile.TemporaryDirectory() as tmp:
            xlsx_path = os.path.join(tmp, "raid.xlsx")
            await asyncio.to_thread(generate_raid_xlsx, result, xlsx_path)
            with open(xlsx_path, "rb") as fh:
                file_bytes = fh.read()

        await _progress(session_id, module_type, status="generating", stage="uploading_output",
                        message="Saving generated workbook.", progress=90, job_id=job_id)
        output_type = "raid_xlsx"
        storage_path = f"outputs/{session_id}/raid.xlsx"
        await asyncio.to_thread(replace_output_file, session_id, output_type, storage_path, file_bytes,
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        await _set_status(session_id, "completed", module_type)
        await _progress(session_id, module_type, status="completed", stage="completed",
                        message="RAID register ready.", progress=100, job_id=job_id,
                        result={"output_type": output_type, "data": result})
    except Exception as exc:
        _LOGGER.exception("run_raid_generation failed session=%s", session_id)
        mark_generation_failed(session_id, module_type, str(exc), job_id)


async def run_wbs_generation(*, session_id: str, audience: list[str], job_id: str | None) -> None:
    module_type = "wbs"
    try:
        await _set_status(session_id, "generating", module_type)
        await _progress(session_id, module_type, status="generating", stage="preparing_context",
                        message="Preparing project context.", progress=15, job_id=job_id)
        raw_text = await asyncio.to_thread(get_combined_extracted_text, session_id)

        await _progress(session_id, module_type, status="generating", stage="calling_model",
                        message="Generating the work breakdown structure with Claude.", progress=40, job_id=job_id)
        result = await run_wbs_pipeline(raw_text, audience)

        await _progress(session_id, module_type, status="generating", stage="rendering_output",
                        message="Building the Excel workbook.", progress=72, job_id=job_id)
        with tempfile.TemporaryDirectory() as tmp:
            xlsx_path = os.path.join(tmp, "wbs.xlsx")
            await asyncio.to_thread(generate_wbs_xlsx, result, xlsx_path, audience)
            with open(xlsx_path, "rb") as fh:
                file_bytes = fh.read()

        await _progress(session_id, module_type, status="generating", stage="uploading_output",
                        message="Saving generated workbook.", progress=90, job_id=job_id)
        output_type = "wbs_xlsx"
        storage_path = f"outputs/{session_id}/wbs.xlsx"
        await asyncio.to_thread(replace_output_file, session_id, output_type, storage_path, file_bytes,
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        await _set_status(session_id, "completed", module_type)
        await _progress(session_id, module_type, status="completed", stage="completed",
                        message="WBS ready.", progress=100, job_id=job_id,
                        result={"output_type": output_type, "data": result})
    except Exception as exc:
        _LOGGER.exception("run_wbs_generation failed session=%s", session_id)
        mark_generation_failed(session_id, module_type, str(exc), job_id)


async def run_backlog_generation(
    *,
    session_id: str,
    project_name: str,
    project_id: str,
    supplemental_context: str,
    job_id: str | None,
) -> None:
    module_type = "backlog"
    try:
        await _set_status(session_id, "generating", module_type)
        await _progress(session_id, module_type, status="generating", stage="preparing_context",
                        message="Preparing project context.", progress=15, job_id=job_id)
        raw_text = await asyncio.to_thread(get_combined_extracted_text, session_id)

        await _progress(session_id, module_type, status="generating", stage="calling_model",
                        message="Generating user stories with Claude.", progress=40, job_id=job_id)
        result = await run_backlog_pipeline(raw_text, project_name, project_id, supplemental_context)

        await _progress(session_id, module_type, status="generating", stage="rendering_output",
                        message="Building the Excel workbook.", progress=72, job_id=job_id)
        with tempfile.TemporaryDirectory() as tmp:
            xlsx_path = os.path.join(tmp, "backlog.xlsx")
            await asyncio.to_thread(generate_backlog_xlsx, result, xlsx_path, project_name, project_id)
            with open(xlsx_path, "rb") as fh:
                file_bytes = fh.read()

        await _progress(session_id, module_type, status="generating", stage="uploading_output",
                        message="Saving generated workbook.", progress=90, job_id=job_id)
        output_type = "backlog_xlsx"
        storage_path = f"outputs/{session_id}/backlog.xlsx"
        await asyncio.to_thread(replace_output_file, session_id, output_type, storage_path, file_bytes,
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        await _set_status(session_id, "completed", module_type)
        await _progress(session_id, module_type, status="completed", stage="completed",
                        message="Product backlog ready.", progress=100, job_id=job_id,
                        result={"output_type": output_type, "data": result})
    except Exception as exc:
        _LOGGER.exception("run_backlog_generation failed session=%s", session_id)
        mark_generation_failed(session_id, module_type, str(exc), job_id)


async def run_pfd_generation(*, session_id: str, flow_type: str, style: str, job_id: str | None) -> None:
    module_type = "pfd"
    try:
        await _set_status(session_id, "generating", module_type)
        await _progress(session_id, module_type, status="generating", stage="preparing_context",
                        message="Preparing process context.", progress=15, job_id=job_id)
        raw_text = await asyncio.to_thread(get_combined_extracted_text, session_id)

        await _progress(session_id, module_type, status="generating", stage="calling_model",
                        message="Generating Mermaid syntax with Claude.", progress=45, job_id=job_id)
        mermaid_code = await run_pfd_pipeline(raw_text, flow_type, style)

        await _progress(session_id, module_type, status="generating", stage="uploading_output",
                        message="Saving generated diagram.", progress=90, job_id=job_id)
        await asyncio.to_thread(_pfd_save_output, session_id, mermaid_code)

        await _set_status(session_id, "completed", module_type)
        await _progress(session_id, module_type, status="completed", stage="completed",
                        message="Process flow diagram ready.", progress=100, job_id=job_id,
                        result={"mermaid_code": mermaid_code, "output_type": "pfd_mermaid"})
    except Exception as exc:
        _LOGGER.exception("run_pfd_generation failed session=%s", session_id)
        mark_generation_failed(session_id, module_type, str(exc), job_id)
