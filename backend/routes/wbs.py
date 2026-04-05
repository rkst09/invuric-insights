from fastapi import APIRouter
from pydantic import BaseModel
from pipelines.wbs_pipeline import run_wbs_pipeline
from generators.xlsx_generator import generate_wbs_xlsx
from database import get_supabase
import tempfile, os

router = APIRouter()


class GenerateRequest(BaseModel):
    session_id: str
    audience: list[str] = ["PM", "Developers"]


@router.post("")
async def generate_wbs(req: GenerateRequest):
    db = get_supabase()
    extracted = db.table("extracted_data").select("raw_text").eq("session_id", req.session_id).execute()
    raw_text = extracted.data[0]["raw_text"] if extracted.data else ""

    db.table("sessions").update({"status": "generating", "module_type": "wbs"}).eq("id", req.session_id).execute()
    result = await run_wbs_pipeline(raw_text, req.audience)

    with tempfile.TemporaryDirectory() as tmp:
        xlsx_path = os.path.join(tmp, "wbs.xlsx")
        generate_wbs_xlsx(result, xlsx_path, req.audience)
        with open(xlsx_path, "rb") as f:
            file_bytes = f.read()

    storage_path = f"outputs/{req.session_id}/wbs.xlsx"
    db.storage.from_("outputs").upload(storage_path, file_bytes, {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    })
    db.table("outputs").insert({
        "session_id": req.session_id,
        "output_type": "wbs_xlsx",
        "storage_path": storage_path,
    }).execute()
    db.table("sessions").update({"status": "completed"}).eq("id", req.session_id).execute()

    url = db.storage.from_("outputs").create_signed_url(storage_path, 3600)
    return {"download_url": url["signedURL"], "session_id": req.session_id, "data": result}
