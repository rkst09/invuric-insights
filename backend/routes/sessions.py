from fastapi import APIRouter, HTTPException
from database import get_supabase

router = APIRouter()


@router.get("/{session_id}")
def get_session(session_id: str):
    db = get_supabase()
    result = db.table("sessions").select("*, documents(*), outputs(*)").eq("id", session_id).single().execute()
    if not result.data:
        raise HTTPException(404, "Session not found")
    return result.data


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
