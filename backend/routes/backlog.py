from fastapi import APIRouter
from pydantic import BaseModel
from pipelines.backlog_pipeline import run_backlog_pipeline
from generators.xlsx_generator import generate_backlog_xlsx
from database import get_supabase
import tempfile, os

router = APIRouter()


class GenerateRequest(BaseModel):
    session_id: str
    project_name: str = ""
    project_id: str = ""


@router.post("")
async def generate_backlog(req: GenerateRequest):
    db = get_supabase()
    extracted = db.table("extracted_data").select("raw_text").eq("session_id", req.session_id).execute()
    raw_text = extracted.data[0]["raw_text"] if extracted.data else ""

    db.table("sessions").update({"status": "generating", "module_type": "backlog"}).eq("id", req.session_id).execute()
    result = await run_backlog_pipeline(raw_text, req.project_name, req.project_id)

    with tempfile.TemporaryDirectory() as tmp:
        xlsx_path = os.path.join(tmp, "backlog.xlsx")
        generate_backlog_xlsx(result, xlsx_path, req.project_name, req.project_id)
        with open(xlsx_path, "rb") as f:
            file_bytes = f.read()

    storage_path = f"outputs/{req.session_id}/backlog.xlsx"
    db.storage.from_("outputs").upload(storage_path, file_bytes, {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    })
    db.table("outputs").insert({
        "session_id": req.session_id,
        "output_type": "backlog_xlsx",
        "storage_path": storage_path,
    }).execute()
    db.table("sessions").update({"status": "completed"}).eq("id", req.session_id).execute()

    url = db.storage.from_("outputs").create_signed_url(storage_path, 3600)
    return {"download_url": url["signedURL"], "session_id": req.session_id, "data": result}
