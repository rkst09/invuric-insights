from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from auth import CurrentUser, assert_session_access, get_current_user
from database import (
    create_output_signed_url,
    execute_query,
    get_generation_state,
    get_latest_output_record,
    get_supabase,
    merge_session_metadata,
    run_external_operation,
)
from errors import StorageServiceError

router = APIRouter()


class CreateSessionRequest(BaseModel):
    module_type: str = Field(default="unknown", min_length=1, max_length=50)
    metadata: dict = Field(default_factory=dict)


class UpdateSessionRequest(BaseModel):
    metadata: dict = Field(default_factory=dict)


@router.post("")
def create_session(req: CreateSessionRequest, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    result = execute_query("create_session", db.table("sessions").insert({
        "project_name": req.metadata.get("project_name", "Untitled Project"),
        "status": "created",
        "module_type": req.module_type,
        "metadata": req.metadata,
        "org_id": current_user.org_id,
    }))
    return result.data[0]


@router.get("/{session_id}")
def get_session(session_id: str, current_user: CurrentUser = Depends(get_current_user)):
    assert_session_access(session_id, current_user)
    db = get_supabase()
    result = execute_query(
        "get_session",
        db.table("sessions").select("*, documents(*), outputs(*)").eq("id", session_id).limit(1),
    )
    if not result.data:
        raise HTTPException(404, "Session not found")
    return result.data[0]


@router.get("/{session_id}/generation")
def get_generation_status(
    session_id: str,
    module_type: str | None = None,
    current_user: CurrentUser = Depends(get_current_user),
):
    session = assert_session_access(session_id, current_user)

    generation = get_generation_state(session_id, module_type) or {}
    resolved_module = module_type or generation.get("module_type") or session.get("module_type")
    response = {
        "session_id": session_id,
        "status": session.get("status", "unknown"),
        "module_type": resolved_module,
        "generation": generation or None,
        "result": None,
    }

    result_payload = generation.get("result") if isinstance(generation.get("result"), dict) else None
    if result_payload and generation.get("status") == "completed":
        response["result"] = dict(result_payload)
        output_type = result_payload.get("output_type")
        if output_type:
            output = get_latest_output_record(session_id, output_type)
            if output and isinstance(output.get("storage_path"), str) and output["storage_path"]:
                try:
                    response["result"]["download_url"] = create_output_signed_url(output["storage_path"])
                except Exception:
                    pass

    if resolved_module == "pfd" and generation.get("status") == "completed" and not response["result"]:
        output = get_latest_output_record(session_id, "pfd_mermaid")
        if output:
            response["result"] = {
                "output_type": "pfd_mermaid",
                "mermaid_code": output.get("mermaid_code"),
            }

    return response


@router.patch("/{session_id}")
def update_session(
    session_id: str,
    req: UpdateSessionRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    assert_session_access(session_id, current_user)
    updated = merge_session_metadata(session_id, req.metadata)
    return updated


@router.get("/{session_id}/outputs/{output_type}/download")
def download_output(
    session_id: str,
    output_type: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    assert_session_access(session_id, current_user)
    db = get_supabase()
    result = execute_query(
        "download_output",
        db.table("outputs")
        .select("storage_path, generated_at")
        .eq("session_id", session_id)
        .eq("output_type", output_type)
        .order("generated_at", desc=True)
        .limit(1),
    )
    row = result.data[0] if result.data else None
    if not row:
        raise HTTPException(404, "Output not found")
    try:
        download_url = create_output_signed_url(row["storage_path"])
    except StorageServiceError as exc:
        raise HTTPException(502, str(exc)) from exc
    return {"download_url": download_url}


@router.delete("/{session_id}")
def delete_session(session_id: str, current_user: CurrentUser = Depends(get_current_user)):
    assert_session_access(session_id, current_user)
    db = get_supabase()

    # Best-effort: delete storage files for outputs
    outputs = execute_query(
        "delete_session_select_outputs",
        db.table("outputs").select("storage_path").eq("session_id", session_id),
    )
    for row in (outputs.data or []):
        try:
            run_external_operation("delete_session_remove_output", lambda row=row: db.storage.from_("outputs").remove([row["storage_path"]]))
        except Exception:
            pass

    # Best-effort: delete uploaded document files
    docs = execute_query(
        "delete_session_select_documents",
        db.table("documents").select("storage_path").eq("session_id", session_id),
    )
    for row in (docs.data or []):
        try:
            run_external_operation("delete_session_remove_document", lambda row=row: db.storage.from_("documents").remove([row["storage_path"]]))
        except Exception:
            pass

    # Delete DB rows (child tables first)
    execute_query("delete_session_outputs", db.table("outputs").delete().eq("session_id", session_id))
    execute_query("delete_session_extracted_data", db.table("extracted_data").delete().eq("session_id", session_id))
    execute_query("delete_session_documents", db.table("documents").delete().eq("session_id", session_id))
    execute_query("delete_session_session", db.table("sessions").delete().eq("id", session_id))

    return {"deleted": session_id}


@router.get("")
def list_sessions(limit: int = 20, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    result = execute_query(
        "list_sessions",
        db.table("sessions")
        .select("id, module_type, status, created_at, metadata, project_name")
        .eq("org_id", current_user.org_id)
        .order("created_at", desc=True)
        .limit(limit),
    )
    return result.data
