from datetime import datetime, timezone

from supabase import Client, create_client

from config import settings
from errors import StorageServiceError

_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _client


def get_combined_extracted_text(session_id: str) -> str:
    return get_combined_extracted_text_excluding(session_id, set())


def get_combined_extracted_text_excluding(session_id: str, excluded_document_ids: set[str]) -> str:
    db = get_supabase()
    result = db.table("extracted_data").select("raw_text, document_id").eq("session_id", session_id).execute()
    rows = result.data or []
    return "\n\n".join(
        row["raw_text"].strip()
        for row in rows
        if row.get("document_id") not in excluded_document_ids
        and isinstance(row.get("raw_text"), str)
        and row["raw_text"].strip()
    )


def get_session_record(session_id: str) -> dict | None:
    db = get_supabase()
    # Avoid .single() — supabase-py raises APIError when 0 rows are returned,
    # which propagates as an unhandled 500 in route handlers.
    result = db.table("sessions").select("*").eq("id", session_id).limit(1).execute()
    return result.data[0] if result.data else None


def merge_session_metadata(session_id: str, metadata_updates: dict) -> dict:
    db = get_supabase()
    session = get_session_record(session_id)
    merged_metadata = {**(session.get("metadata") or {}), **metadata_updates} if session else metadata_updates
    result = db.table("sessions").update({"metadata": merged_metadata}).eq("id", session_id).execute()
    return result.data[0] if result.data else {"id": session_id, "metadata": merged_metadata}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _get_generations(metadata: dict | None) -> dict:
    generations = (metadata or {}).get("generations")
    return generations if isinstance(generations, dict) else {}


def update_generation_state(
    session_id: str,
    module_type: str,
    *,
    status: str,
    stage: str,
    message: str,
    progress: int,
    error: str | None = None,
    result: dict | None = None,
    request: dict | None = None,
    job_id: str | None = None,
    preserve_started_at: bool = True,
    preserve_request: bool = True,
) -> dict:
    session = get_session_record(session_id) or {}
    metadata = session.get("metadata") or {}
    generations = _get_generations(metadata)
    existing = generations.get(module_type) if isinstance(generations.get(module_type), dict) else {}
    started_at = existing.get("started_at") if preserve_started_at else None
    persisted_request = existing.get("request") if preserve_request else None

    generation_payload = {
        "job_id": job_id or existing.get("job_id"),
        "module_type": module_type,
        "status": status,
        "stage": stage,
        "message": message,
        "progress": max(0, min(int(progress), 100)),
        "started_at": started_at or _utc_now_iso(),
        "finished_at": _utc_now_iso() if status in {"completed", "failed"} else None,
        "error": error,
        "result": result if result is not None else existing.get("result"),
        "request": request if request is not None else persisted_request,
    }
    generations[module_type] = generation_payload
    return merge_session_metadata(session_id, {"generation": generation_payload, "generations": generations})


def get_generation_state(session_id: str, module_type: str | None = None) -> dict | None:
    session = get_session_record(session_id)
    metadata = session.get("metadata") if session else {}
    generations = _get_generations(metadata)
    if module_type:
        generation = generations.get(module_type)
        if isinstance(generation, dict):
            return generation
    generation = (metadata or {}).get("generation")
    return generation if isinstance(generation, dict) else None


def list_resumable_generations() -> list[dict]:
    db = get_supabase()
    result = db.table("sessions").select("id, status, module_type, metadata").in_("status", ["queued", "generating"]).execute()
    sessions = result.data or []
    resumable: list[dict] = []
    for session in sessions:
        metadata = session.get("metadata") or {}
        generations = _get_generations(metadata)
        for module_type, generation in generations.items():
            if not isinstance(generation, dict):
                continue
            if generation.get("status") not in {"queued", "generating"}:
                continue
            request = generation.get("request")
            if not isinstance(request, dict):
                continue
            resumable.append(
                {
                    "session_id": session["id"],
                    "module_type": module_type,
                    "job_id": generation.get("job_id"),
                    "request": request,
                }
            )
    return resumable


def get_document_record(document_id: str) -> dict | None:
    db = get_supabase()
    result = db.table("documents").select("*").eq("id", document_id).limit(1).execute()
    return result.data[0] if result.data else None


def get_latest_output_record(session_id: str, output_type: str) -> dict | None:
    db = get_supabase()
    result = (
        db.table("outputs")
        .select("*")
        .eq("session_id", session_id)
        .eq("output_type", output_type)
        .order("generated_at", desc=True)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def create_output_signed_url(storage_path: str, expires_in_seconds: int = 3600) -> str:
    db = get_supabase()
    result = db.storage.from_("outputs").create_signed_url(storage_path, expires_in_seconds)
    # Handle different storage3 version return formats:
    # storage3 <0.7 returns {"signedURL": "..."}
    # storage3 >=0.7 returns {"signedUrl": "..."} or an object with .signed_url
    if isinstance(result, dict):
        for key in ("signedURL", "signedUrl", "signed_url"):
            val = result.get(key)
            if val:
                return val
    for attr in ("signed_url", "signedURL", "signedUrl"):
        val = getattr(result, attr, None)
        if val:
            return val
    raise StorageServiceError("Could not generate a download link for this file.")


def get_document_extracted_text(document_id: str) -> str:
    db = get_supabase()
    result = db.table("extracted_data").select("raw_text").eq("document_id", document_id).execute()
    rows = result.data or []
    return "\n\n".join(
        row["raw_text"].strip()
        for row in rows
        if isinstance(row.get("raw_text"), str) and row["raw_text"].strip()
    )


def download_storage_file(bucket: str, storage_path: str) -> bytes:
    db = get_supabase()
    return db.storage.from_(bucket).download(storage_path)


def get_client_template_for_session(session_id: str) -> dict | None:
    session = get_session_record(session_id)
    metadata = session.get("metadata") if session else {}
    template_info = (metadata or {}).get("client_template")
    if not isinstance(template_info, dict):
        return None

    document_id = template_info.get("document_id")
    storage_path = template_info.get("storage_path")
    if not document_id or not storage_path:
        return None

    document = get_document_record(document_id)
    if not document:
        return None

    return {
        "document_id": document_id,
        "filename": template_info.get("filename") or document.get("file_name") or "",
        "file_type": (template_info.get("file_type") or document.get("file_type") or "").lower(),
        "storage_path": storage_path,
        "text": get_document_extracted_text(document_id),
        "bytes": download_storage_file("documents", storage_path),
    }


def update_session_status(session_id: str, status: str, **extra_fields) -> None:
    db = get_supabase()
    payload = {"status": status, **extra_fields}
    db.table("sessions").update(payload).eq("id", session_id).execute()


def check_db_connectivity() -> bool:
    """Ping Supabase — returns True if reachable, False on any error."""
    try:
        db = get_supabase()
        db.table("sessions").select("id").limit(1).execute()
        return True
    except Exception:
        return False


def clear_questionnaire_answers(session_id: str, section_id: str) -> None:
    db = get_supabase()
    db.table("questionnaire_answers").delete().eq("session_id", session_id).eq("section_id", section_id).execute()


def replace_output_file(
    session_id: str,
    output_type: str,
    storage_path: str,
    file_bytes: bytes,
    content_type: str,
) -> None:
    db = get_supabase()
    existing = db.table("outputs").select("storage_path").eq("session_id", session_id).eq("output_type", output_type).execute()
    existing_paths = [
        row["storage_path"]
        for row in (existing.data or [])
        if isinstance(row.get("storage_path"), str) and row["storage_path"]
    ]
    if existing_paths:
        try:
            db.storage.from_("outputs").remove(existing_paths)
        except Exception:
            pass

    try:
        db.table("outputs").delete().eq("session_id", session_id).eq("output_type", output_type).execute()
        db.storage.from_("outputs").upload(storage_path, file_bytes, {"content-type": content_type})
        db.table("outputs").insert({"session_id": session_id, "output_type": output_type, "storage_path": storage_path}).execute()
    except Exception as exc:
        raise StorageServiceError("The file was generated, but saving it to storage failed. Please try again.") from exc
