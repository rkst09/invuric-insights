from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_supabase

router = APIRouter()


class CreateSessionRequest(BaseModel):
    module_type: str = "unknown"
    metadata: dict = {}


@router.post("")
def create_session(req: CreateSessionRequest):
    db = get_supabase()
    result = db.table("sessions").insert({
        "project_name": req.metadata.get("project_name", "Untitled Project"),
        "status": "created",
        "module_type": req.module_type,
        "metadata": req.metadata,
    }).execute()
    return result.data[0]


@router.get("/{session_id}")
def get_session(session_id: str):
    db = get_supabase()
    result = db.table("sessions").select("*, documents(*), outputs(*)").eq("id", session_id).single().execute()
    if not result.data:
        raise HTTPException(404, "Session not found")
    return result.data


@router.get("/{session_id}/outputs/{output_type}/download")
def download_output(session_id: str, output_type: str):
    db = get_supabase()
    result = (
        db.table("outputs")
        .select("storage_path")
        .eq("session_id", session_id)
        .eq("output_type", output_type)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "Output not found")
    url = db.storage.from_("outputs").create_signed_url(result.data["storage_path"], 3600)
    return {"download_url": url["signedURL"]}


@router.get("")
def list_sessions(limit: int = 20):
    db = get_supabase()
    result = (
        db.table("sessions")
        .select("id, module_type, status, created_at, metadata")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data
