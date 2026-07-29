from __future__ import annotations

import json
import logging
import shutil
import socket
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urlparse

from supabase import Client, create_client

from config import settings
from errors import StorageServiceError

LOGGER = logging.getLogger("invuric.database")
_client: Client | "LocalSupabaseClient" | None = None
_backend_mode: str | None = None
_local_lock = threading.RLock()

_LOCAL_DATA_ROOT = Path(__file__).resolve().parent / ".local_backend"
_LOCAL_STORAGE_ROOT = _LOCAL_DATA_ROOT / "storage"
_LOCAL_TABLE_PATHS = {
    "sessions": _LOCAL_DATA_ROOT / "sessions.json",
    "documents": _LOCAL_DATA_ROOT / "documents.json",
    "extracted_data": _LOCAL_DATA_ROOT / "extracted_data.json",
    "outputs": _LOCAL_DATA_ROOT / "outputs.json",
    "questionnaire_answers": _LOCAL_DATA_ROOT / "questionnaire_answers.json",
}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _ensure_local_backend_dirs() -> None:
    _LOCAL_DATA_ROOT.mkdir(parents=True, exist_ok=True)
    _LOCAL_STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    for table_path in _LOCAL_TABLE_PATHS.values():
        if not table_path.exists():
            table_path.write_text("[]", encoding="utf-8")


def _is_local_backend_enabled() -> bool:
    return _get_backend_mode() == "local"


def _get_backend_mode() -> str:
    global _backend_mode
    if _backend_mode is not None:
        return _backend_mode

    configured = settings.storage_backend.strip().lower()
    if configured in {"local", "supabase"}:
        _backend_mode = configured
        return _backend_mode

    hostname = urlparse(settings.supabase_url).hostname
    if not hostname:
        _backend_mode = "local"
        return _backend_mode

    try:
        socket.getaddrinfo(hostname, 443, type=socket.SOCK_STREAM)
        _backend_mode = "supabase"
    except OSError:
        _backend_mode = "local"
    return _backend_mode


def _should_fallback_to_local(exc: Exception) -> bool:
    configured = settings.storage_backend.strip().lower()
    if configured != "auto":
        return False
    if settings.environment.lower() == "production":
        return False
    LOGGER.warning("supabase_unavailable_falling_back_to_local error=%s", exc)
    return True


def _switch_to_local_backend() -> LocalSupabaseClient:
    global _client, _backend_mode
    _backend_mode = "local"
    _client = LocalSupabaseClient()
    return _client


def _with_retries(operation_name: str, fn):
    last_exc: Exception | None = None
    attempts = max(1, int(settings.external_request_max_attempts))
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except Exception as exc:
            last_exc = exc
            if attempt >= attempts:
                break
            delay = max(0.1, float(settings.external_request_retry_delay_seconds)) * (2 ** (attempt - 1))
            LOGGER.warning(
                "external_retry operation=%s attempt=%s/%s delay=%.1fs error=%s",
                operation_name,
                attempt,
                attempts,
                delay,
                exc,
            )
            time.sleep(delay)
    raise last_exc  # type: ignore[misc]


def _execute(operation_name: str, query):
    return _with_retries(operation_name, query.execute)


def execute_query(operation_name: str, query):
    return _execute(operation_name, query)


def run_external_operation(operation_name: str, fn):
    return _with_retries(operation_name, fn)


class LocalResponse:
    def __init__(self, data: list[dict]):
        self.data = data


class LocalStorageBucket:
    def __init__(self, bucket: str):
        self.bucket = bucket

    def _bucket_root(self) -> Path:
        root = _LOCAL_STORAGE_ROOT / self.bucket
        root.mkdir(parents=True, exist_ok=True)
        return root

    def _resolve_path(self, storage_path: str) -> Path:
        if not storage_path:
            raise StorageServiceError("Storage path is required.")
        root = self._bucket_root().resolve()
        target = (root / storage_path).resolve()
        if target != root and root not in target.parents:
            raise StorageServiceError("Invalid storage path.")
        return target

    def upload(self, storage_path: str, content: bytes, _options: dict | None = None):
        target = self._resolve_path(storage_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        payload = content if isinstance(content, bytes) else bytes(content)
        target.write_bytes(payload)
        return {"path": storage_path}

    def download(self, storage_path: str) -> bytes:
        target = self._resolve_path(storage_path)
        if not target.exists():
            raise FileNotFoundError(storage_path)
        return target.read_bytes()

    def remove(self, paths: list[str]):
        for storage_path in paths:
            try:
                target = self._resolve_path(storage_path)
            except StorageServiceError:
                continue
            if target.exists():
                target.unlink()
        return {"deleted": paths}

    def create_signed_url(self, storage_path: str, _expires_in_seconds: int):
        encoded_bucket = quote(self.bucket, safe="")
        encoded_path = quote(storage_path, safe="")
        return {
            "signedURL": (
                f"{settings.public_backend_url}/api/system/local-file"
                f"?bucket={encoded_bucket}&path={encoded_path}"
            )
        }


class LocalStorageClient:
    def from_(self, bucket: str) -> LocalStorageBucket:
        return LocalStorageBucket(bucket)


class LocalSupabaseClient:
    def __init__(self):
        _ensure_local_backend_dirs()
        self.storage = LocalStorageClient()

    def table(self, table_name: str) -> "LocalTableQuery":
        if table_name not in _LOCAL_TABLE_PATHS:
            raise ValueError(f"Unsupported local table: {table_name}")
        return LocalTableQuery(table_name)


class LocalTableQuery:
    def __init__(self, table_name: str):
        self.table_name = table_name
        self._action = "select"
        self._filters: list[tuple[str, str, object]] = []
        self._insert_rows: list[dict] | None = None
        self._update_payload: dict | None = None
        self._selected_columns: str | None = None
        self._order_field: str | None = None
        self._order_desc = False
        self._limit: int | None = None

    def select(self, columns: str) -> "LocalTableQuery":
        self._action = "select"
        self._selected_columns = columns
        return self

    def insert(self, payload: dict | list[dict]) -> "LocalTableQuery":
        self._action = "insert"
        if isinstance(payload, list):
            self._insert_rows = [dict(row) for row in payload]
        else:
            self._insert_rows = [dict(payload)]
        return self

    def update(self, payload: dict) -> "LocalTableQuery":
        self._action = "update"
        self._update_payload = dict(payload)
        return self

    def delete(self) -> "LocalTableQuery":
        self._action = "delete"
        return self

    def eq(self, field: str, value: object) -> "LocalTableQuery":
        self._filters.append(("eq", field, value))
        return self

    def in_(self, field: str, values: list[object]) -> "LocalTableQuery":
        self._filters.append(("in", field, list(values)))
        return self

    def order(self, field: str, desc: bool = False) -> "LocalTableQuery":
        self._order_field = field
        self._order_desc = desc
        return self

    def limit(self, limit: int) -> "LocalTableQuery":
        self._limit = limit
        return self

    def execute(self) -> LocalResponse:
        with _local_lock:
            rows = _load_local_table(self.table_name)
            if self._action == "insert":
                inserted = [_normalize_insert_row(self.table_name, row) for row in (self._insert_rows or [])]
                rows.extend(inserted)
                _save_local_table(self.table_name, rows)
                return LocalResponse([dict(row) for row in inserted])

            matching_indexes = [
                index for index, row in enumerate(rows)
                if _row_matches_filters(row, self._filters)
            ]

            if self._action == "update":
                updated: list[dict] = []
                for index in matching_indexes:
                    rows[index].update(self._update_payload or {})
                    updated.append(dict(rows[index]))
                _save_local_table(self.table_name, rows)
                return LocalResponse(updated)

            if self._action == "delete":
                deleted = [dict(rows[index]) for index in matching_indexes]
                kept = [row for index, row in enumerate(rows) if index not in set(matching_indexes)]
                _save_local_table(self.table_name, kept)
                return LocalResponse(deleted)

            selected = [dict(rows[index]) for index in matching_indexes]
            if self._order_field:
                selected.sort(
                    key=lambda row: _sort_value(row.get(self._order_field)),
                    reverse=self._order_desc,
                )
            if self._limit is not None:
                selected = selected[:self._limit]
            return LocalResponse([_project_row(self.table_name, row, self._selected_columns) for row in selected])


def _table_path(table_name: str) -> Path:
    _ensure_local_backend_dirs()
    return _LOCAL_TABLE_PATHS[table_name]


def _load_local_table(table_name: str) -> list[dict]:
    path = _table_path(table_name)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        data = []
    return data if isinstance(data, list) else []


def _save_local_table(table_name: str, rows: list[dict]) -> None:
    path = _table_path(table_name)
    path.write_text(json.dumps(rows, indent=2), encoding="utf-8")


def _row_matches_filters(row: dict, filters: list[tuple[str, str, object]]) -> bool:
    for operator, field, value in filters:
        row_value = row.get(field)
        if operator == "eq" and row_value != value:
            return False
        if operator == "in" and row_value not in value:
            return False
    return True


def _normalize_insert_row(table_name: str, row: dict) -> dict:
    now = _utc_now_iso()
    normalized = dict(row)
    normalized.setdefault("id", str(uuid.uuid4()))
    if table_name == "sessions":
        normalized.setdefault("project_name", "Untitled Project")
        normalized.setdefault("status", "created")
        normalized.setdefault("module_type", "unknown")
        normalized.setdefault("metadata", {})
        normalized.setdefault("created_at", now)
    elif table_name == "documents":
        normalized.setdefault("created_at", now)
    elif table_name == "outputs":
        normalized.setdefault("created_at", now)
        normalized.setdefault("generated_at", now)
    else:
        normalized.setdefault("created_at", now)
    return normalized


def _sort_value(value: object) -> object:
    return value if value is not None else ""


def _project_row(table_name: str, row: dict, columns: str | None) -> dict:
    if not columns or columns.strip() == "*":
        return dict(row)

    if table_name == "sessions" and ("documents(*)" in columns or "outputs(*)" in columns):
        projected = dict(row)
        if "documents(*)" in columns:
            projected["documents"] = [
                dict(doc) for doc in _load_local_table("documents")
                if doc.get("session_id") == row.get("id")
            ]
        if "outputs(*)" in columns:
            projected["outputs"] = [
                dict(output) for output in _load_local_table("outputs")
                if output.get("session_id") == row.get("id")
            ]
        return projected

    projected: dict = {}
    for column in [part.strip() for part in columns.split(",")]:
        if column == "*" or not column:
            projected.update(row)
        elif column in row:
            projected[column] = row[column]
    return projected


def get_supabase() -> Client | LocalSupabaseClient:
    global _client
    if _client is not None:
        return _client

    if _is_local_backend_enabled():
        _client = LocalSupabaseClient()
    else:
        _client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _client


def get_combined_extracted_text(session_id: str) -> str:
    return get_combined_extracted_text_excluding(session_id, set())


def get_combined_extracted_text_excluding(session_id: str, excluded_document_ids: set[str]) -> str:
    db = get_supabase()
    result = _execute(
        "get_combined_extracted_text",
        db.table("extracted_data").select("raw_text, document_id").eq("session_id", session_id),
    )
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
    result = _execute("get_session_record", db.table("sessions").select("*").eq("id", session_id).limit(1))
    return result.data[0] if result.data else None


def merge_session_metadata(session_id: str, metadata_updates: dict) -> dict:
    db = get_supabase()
    session = get_session_record(session_id)
    merged_metadata = {**(session.get("metadata") or {}), **metadata_updates} if session else metadata_updates
    result = _execute(
        "merge_session_metadata",
        db.table("sessions").update({"metadata": merged_metadata}).eq("id", session_id),
    )
    return result.data[0] if result.data else {"id": session_id, "metadata": merged_metadata}


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
    result = _execute(
        "list_resumable_generations",
        db.table("sessions").select("id, status, module_type, metadata").in_("status", ["queued", "generating"]),
    )
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
    result = _execute("get_document_record", db.table("documents").select("*").eq("id", document_id).limit(1))
    return result.data[0] if result.data else None


def list_documents_for_session(session_id: str) -> list[dict]:
    db = get_supabase()
    result = _execute(
        "list_documents_for_session",
        db.table("documents").select("*").eq("session_id", session_id),
    )
    return result.data or []


def get_latest_output_record(session_id: str, output_type: str) -> dict | None:
    db = get_supabase()
    result = _execute(
        "get_latest_output_record",
        db.table("outputs")
        .select("*")
        .eq("session_id", session_id)
        .eq("output_type", output_type)
        .order("generated_at", desc=True)
        .limit(1),
    )
    return result.data[0] if result.data else None


def create_output_signed_url(storage_path: str, expires_in_seconds: int = 3600) -> str:
    db = get_supabase()
    result = _with_retries(
        "create_output_signed_url",
        lambda: db.storage.from_("outputs").create_signed_url(storage_path, expires_in_seconds),
    )
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
    result = _execute(
        "get_document_extracted_text",
        db.table("extracted_data").select("raw_text").eq("document_id", document_id),
    )
    rows = result.data or []
    return "\n\n".join(
        row["raw_text"].strip()
        for row in rows
        if isinstance(row.get("raw_text"), str) and row["raw_text"].strip()
    )


def download_storage_file(bucket: str, storage_path: str) -> bytes:
    db = get_supabase()
    return _with_retries("download_storage_file", lambda: db.storage.from_(bucket).download(storage_path))


def get_local_storage_file_path(bucket: str, storage_path: str) -> Path:
    if not _is_local_backend_enabled():
        raise FileNotFoundError(storage_path)
    return LocalStorageBucket(bucket)._resolve_path(storage_path)


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
    _execute("update_session_status", db.table("sessions").update(payload).eq("id", session_id))


def check_db_connectivity() -> bool:
    try:
        db = get_supabase()
        _execute("check_db_connectivity", db.table("sessions").select("id").limit(1))
        return True
    except Exception:
        return False


def clear_questionnaire_answers(session_id: str, section_id: str) -> None:
    db = get_supabase()
    _execute(
        "clear_questionnaire_answers",
        db.table("questionnaire_answers").delete().eq("session_id", session_id).eq("section_id", section_id),
    )


def replace_output_file(
    session_id: str,
    output_type: str,
    storage_path: str,
    file_bytes: bytes,
    content_type: str,
) -> None:
    db = get_supabase()
    existing = _execute(
        "replace_output_file_select_existing",
        db.table("outputs").select("storage_path").eq("session_id", session_id).eq("output_type", output_type),
    )
    existing_paths = [
        row["storage_path"]
        for row in (existing.data or [])
        if isinstance(row.get("storage_path"), str) and row["storage_path"]
    ]
    if existing_paths:
        try:
            _with_retries("replace_output_file_remove_existing", lambda: db.storage.from_("outputs").remove(existing_paths))
        except Exception:
            pass

    try:
        _execute(
            "replace_output_file_delete_row",
            db.table("outputs").delete().eq("session_id", session_id).eq("output_type", output_type),
        )
        _with_retries(
            "replace_output_file_upload",
            lambda: db.storage.from_("outputs").upload(storage_path, file_bytes, {"content-type": content_type}),
        )
        _execute(
            "replace_output_file_insert_row",
            db.table("outputs").insert({"session_id": session_id, "output_type": output_type, "storage_path": storage_path}),
        )
    except Exception as exc:
        raise StorageServiceError("The file was generated, but saving it to storage failed. Please try again.") from exc


def reset_backend_client_for_tests() -> None:
    global _client, _backend_mode
    _client = None
    _backend_mode = None


def reset_local_backend_data() -> None:
    with _local_lock:
        reset_backend_client_for_tests()
        if _LOCAL_DATA_ROOT.exists():
            shutil.rmtree(_LOCAL_DATA_ROOT)
