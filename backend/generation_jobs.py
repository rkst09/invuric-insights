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

from config import settings
from database import (
    clear_questionnaire_answers,
    download_storage_file,
    execute_query,
    get_client_template_for_session,
    get_combined_extracted_text,
    get_combined_extracted_text_excluding,
    get_generation_state,
    get_session_record,
    get_supabase,
    list_documents_for_session,
    list_resumable_generations,
    replace_output_file,
    update_generation_state,
    update_session_status,
)
from generators.docx_generator import generate_docx
from errors import LLMServiceError
from generators.pdf_generator import PdfConversionUnavailableError, docx_to_pdf
from generators.xlsx_generator import generate_backlog_xlsx, generate_raid_xlsx, generate_wbs_xlsx
from pipelines.backlog_pipeline import build_fallback_backlog, run_backlog_pipeline
from pipelines.doc_fallbacks import build_fallback_doc
from pipelines.doc_pipeline import run_doc_pipeline
from pipelines.pfd_pipeline import run_pfd_pipeline
from pipelines.raid_pipeline import build_fallback_raid, run_raid_pipeline
from pipelines.wbs_pipeline import build_fallback_wbs, run_wbs_pipeline
from redaction import RedactionSession
from vision import render_document_images

_TASKS: dict[tuple[str, str], asyncio.Task] = {}
_LOGGER = logging.getLogger("invuric.jobs")
_TERMINAL_STATES = frozenset({"completed", "failed"})


def _task_key(session_id: str, module_type: str) -> tuple[str, str]:
    return session_id, module_type


async def _session_known_fields(session_id: str) -> dict[str, str]:
    """Best-effort project/client name for pipelines (RAID, WBS, PFD) that don't
    receive a questionnaire answers dict of their own to redact against."""
    session = await asyncio.to_thread(get_session_record, session_id)
    if not session:
        return {}
    known: dict[str, str] = {}
    project_name = session.get("project_name")
    if project_name and project_name != "Untitled Project":
        known["project_name"] = project_name
    client_name = (session.get("metadata") or {}).get("client_name")
    if client_name:
        known["client_name"] = client_name
    return known


_VISION_EXT_TO_CONTENT_TYPE = {"PDF": "application/pdf", "PNG": "image/png", "JPG": "image/jpeg", "JPEG": "image/jpeg"}


async def _gather_backlog_vision_images(session_id: str) -> list[dict]:
    """Best-effort: render uploaded PDFs/screens into vision image blocks for
    Backlog/User Stories generation only - not redacted, see vision.py."""
    max_images = settings.backlog_vision_max_images
    if max_images <= 0:
        return []

    documents = await asyncio.to_thread(list_documents_for_session, session_id)
    images: list[dict] = []
    for document in documents:
        if len(images) >= max_images:
            break
        content_type = _VISION_EXT_TO_CONTENT_TYPE.get((document.get("file_type") or "").upper())
        if not content_type:
            continue
        try:
            content = await asyncio.to_thread(download_storage_file, "documents", document["storage_path"])
            rendered = await asyncio.to_thread(render_document_images, content, content_type, document.get("file_name", ""))
        except Exception as exc:
            _LOGGER.warning(
                "backlog_vision_render_skipped session=%s document=%s reason=%s",
                session_id, document.get("id"), exc,
            )
            continue
        images.extend(rendered)
    return images[:max_images]


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


async def _await_model_with_heartbeat(
    awaitable,
    *,
    session_id: str,
    module_type: str,
    job_id: str | None,
    message: str,
    start_progress: int = 40,
    max_progress: int = 65,
    timeout_seconds: int | None = None,
):
    """Keep long Claude calls visible in the UI and stop genuinely stalled jobs."""
    task = asyncio.create_task(awaitable)
    started = asyncio.get_running_loop().time()
    timeout = max(30, int(timeout_seconds or settings.generation_model_timeout_seconds))
    next_progress = start_progress

    while not task.done():
        elapsed = asyncio.get_running_loop().time() - started
        if elapsed >= timeout:
            task.cancel()
            raise TimeoutError("Claude took too long to respond. Please retry with a smaller or cleaner document.")

        done, _pending = await asyncio.wait({task}, timeout=5)
        if done:
            break

        next_progress = min(max_progress, next_progress + 2)
        await _progress(
            session_id,
            module_type,
            status="generating",
            stage="calling_model",
            message=message,
            progress=next_progress,
            job_id=job_id,
        )

    return await task


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
    execute_query("store_questionnaire_answers", db.table("questionnaire_answers").insert(rows))


def _pfd_save_output(session_id: str, mermaid_code: str) -> None:
    """Persist PFD mermaid output — called via asyncio.to_thread."""
    db = get_supabase()
    execute_query("pfd_delete_previous_output", db.table("outputs").delete().eq("session_id", session_id).eq("output_type", "pfd_mermaid"))
    execute_query("pfd_insert_output", db.table("outputs").insert({"session_id": session_id, "output_type": "pfd_mermaid", "mermaid_code": mermaid_code}))


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
        existing_state = get_generation_state(session_id, module_type) or {}
        existing_request = existing_state.get("request") if isinstance(existing_state.get("request"), dict) else {}
        if existing_state.get("status") == "completed" and existing_request == request_payload and existing_state.get("result"):
            return {
                "session_id": session_id,
                "status": "completed",
                "job_id": existing_state.get("job_id"),
                "cached": True,
            }

        if existing_state.get("status") in {"queued", "generating"} and existing_request == request_payload:
            job_id = schedule_generation(session_id, module_type)
            return {
                "session_id": session_id,
                "status": existing_state.get("status"),
                "job_id": job_id or existing_state.get("job_id"),
                "cached": False,
            }

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
    try:
        items = await asyncio.to_thread(list_resumable_generations)
    except Exception:
        _LOGGER.exception("resume_incomplete_generations failed; API startup will continue")
        return
    for item in items:
        try:
            schedule_generation(item["session_id"], item["module_type"])
        except Exception:
            _LOGGER.exception(
                "resume_incomplete_generation_item failed session=%s module=%s",
                item.get("session_id"),
                item.get("module_type"),
            )


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

        # Mask known PII (client/project/author/requestor + regex-detected emails,
        # account numbers, phone numbers, amounts) before anything reaches Claude;
        # restore() below re-inserts the real values once generation completes.
        redaction = RedactionSession()
        masked_answers = redaction.mask_answers(answers)
        redacted_text = redaction.redact_text(raw_text)
        redacted_template_text = redaction.redact_text(client_template["text"]) if client_template else ""

        await _progress(session_id, doc_type, status="generating", stage="calling_model",
                        message="Generating structured content with Claude.", progress=40, job_id=job_id)
        try:
            result = await _await_model_with_heartbeat(
                run_doc_pipeline(doc_type, redacted_text, masked_answers, redacted_template_text),
                session_id=session_id,
                module_type=doc_type,
                job_id=job_id,
                message="Generating structured content with Claude.",
                timeout_seconds=settings.document_model_timeout_seconds,
            )
            result = redaction.restore(result)
        except Exception as exc:
            _LOGGER.warning(
                "run_document_generation using fallback session=%s doc_type=%s reason=%s",
                session_id,
                doc_type,
                exc,
            )
            await _progress(session_id, doc_type, status="generating", stage="fallback_model",
                            message=f"Preparing a fast Invuric-format {doc_type.upper()} draft from available context.",
                            progress=68, job_id=job_id)
            result = await asyncio.to_thread(build_fallback_doc, doc_type, raw_text, answers)

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
        redaction = RedactionSession()
        for field_name, value in (await _session_known_fields(session_id)).items():
            redaction.mask_known_field(field_name, value)
        redacted_text = redaction.redact_text(raw_text)

        await _progress(session_id, module_type, status="generating", stage="calling_model",
                        message="Generating the RAID register with Claude.", progress=40, job_id=job_id)
        try:
            result = await _await_model_with_heartbeat(
                run_raid_pipeline(redacted_text),
                session_id=session_id,
                module_type=module_type,
                job_id=job_id,
                message="Generating the RAID register with Claude.",
                timeout_seconds=settings.raid_model_timeout_seconds,
            )
            result = redaction.restore(result)
        except Exception as exc:
            _LOGGER.warning("run_raid_generation using fallback session=%s reason=%s", session_id, exc)
            await _progress(session_id, module_type, status="generating", stage="fallback_model",
                            message="Claude was slow, so a fallback RAID register is being prepared.", progress=68, job_id=job_id)
            result = await asyncio.to_thread(build_fallback_raid, raw_text)

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
        redaction = RedactionSession()
        for field_name, value in (await _session_known_fields(session_id)).items():
            redaction.mask_known_field(field_name, value)
        redacted_text = redaction.redact_text(raw_text)

        await _progress(session_id, module_type, status="generating", stage="calling_model",
                        message="Generating the work breakdown structure with Claude.", progress=40, job_id=job_id)
        try:
            result = await _await_model_with_heartbeat(
                run_wbs_pipeline(redacted_text, audience),
                session_id=session_id,
                module_type=module_type,
                job_id=job_id,
                message="Generating the work breakdown structure with Claude.",
                timeout_seconds=settings.wbs_model_timeout_seconds,
            )
            result = redaction.restore(result)
        except Exception as exc:
            _LOGGER.warning("run_wbs_generation using fallback session=%s reason=%s", session_id, exc)
            await _progress(session_id, module_type, status="generating", stage="fallback_model",
                            message="Claude was slow, so a fallback WBS is being prepared.", progress=68, job_id=job_id)
            result = await asyncio.to_thread(build_fallback_wbs, raw_text, audience)

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
        redaction = RedactionSession()
        client_name = (await _session_known_fields(session_id)).get("client_name")
        if client_name:
            redaction.mask_known_field("client_name", client_name)
        # Register project_name before scanning raw_text/supplemental_context so a
        # literal mention of it inside the uploaded document is masked too, not just
        # the value echoed into the prompt's "Project Name:" line below.
        masked_project_name = redaction.mask_known_field("project_name", project_name) if project_name else project_name
        redacted_text = redaction.redact_text(raw_text)
        redacted_supplemental_context = redaction.redact_text(supplemental_context) if supplemental_context else supplemental_context
        images = await _gather_backlog_vision_images(session_id)

        await _progress(session_id, module_type, status="generating", stage="calling_model",
                        message="Generating user stories with Claude.", progress=40, job_id=job_id)
        try:
            result = await _await_model_with_heartbeat(
                run_backlog_pipeline(redacted_text, masked_project_name, project_id, redacted_supplemental_context, images),
                session_id=session_id,
                module_type=module_type,
                job_id=job_id,
                message="Generating user stories with Claude.",
                timeout_seconds=settings.backlog_model_timeout_seconds,
            )
            result = redaction.restore(result)
        except Exception as exc:
            _LOGGER.warning("run_backlog_generation using fallback session=%s reason=%s", session_id, exc)
            await _progress(session_id, module_type, status="generating", stage="fallback_model",
                            message="Claude was slow, so a fallback product backlog is being prepared.", progress=68, job_id=job_id)
            result = await asyncio.to_thread(build_fallback_backlog, raw_text, project_name, project_id, supplemental_context)

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
        redaction = RedactionSession()
        for field_name, value in (await _session_known_fields(session_id)).items():
            redaction.mask_known_field(field_name, value)
        redacted_text = redaction.redact_text(raw_text)

        await _progress(session_id, module_type, status="generating", stage="calling_model",
                        message="Generating Mermaid syntax with Claude.", progress=45, job_id=job_id)
        mermaid_code = await _await_model_with_heartbeat(
            run_pfd_pipeline(redacted_text, flow_type, style),
            session_id=session_id,
            module_type=module_type,
            job_id=job_id,
            message="Generating Mermaid syntax with Claude.",
            start_progress=45,
            max_progress=80,
        )
        mermaid_code = redaction.restore(mermaid_code)

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
