from fastapi import APIRouter
from pydantic import BaseModel
from pipelines.pfd_pipeline import run_pfd_pipeline
from database import get_supabase

router = APIRouter()


class GenerateRequest(BaseModel):
    session_id: str
    flow_type: str = "end-to-end"
    style: str = "flowchart"


@router.post("")
async def generate_pfd(req: GenerateRequest):
    db = get_supabase()
    extracted = db.table("extracted_data").select("raw_text").eq("session_id", req.session_id).execute()
    raw_text = extracted.data[0]["raw_text"] if extracted.data else ""

    db.table("sessions").update({"status": "generating", "module_type": "pfd"}).eq("id", req.session_id).execute()
    mermaid_code = await run_pfd_pipeline(raw_text, req.flow_type, req.style)

    db.table("outputs").insert({
        "session_id": req.session_id,
        "output_type": "pfd_mermaid",
        "mermaid_code": mermaid_code,
    }).execute()
    db.table("sessions").update({"status": "completed"}).eq("id", req.session_id).execute()

    return {"mermaid_code": mermaid_code, "session_id": req.session_id}
