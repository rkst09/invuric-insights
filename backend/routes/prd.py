from fastapi import APIRouter
from pydantic import BaseModel
from pipelines.doc_pipeline import run_doc_pipeline
from generators.docx_generator import generate_docx
from generators.pdf_generator import docx_to_pdf
from database import get_supabase
import tempfile, os

router = APIRouter()


class GenerateRequest(BaseModel):
    session_id: str
    answers: dict
    export_format: str = "docx"
    template: str = "invuric"


@router.post("")
async def generate_prd(req: GenerateRequest):
    db = get_supabase()
    extracted = db.table("extracted_data").select("raw_text").eq("session_id", req.session_id).execute()
    raw_text = extracted.data[0]["raw_text"] if extracted.data else ""

    for key, value in req.answers.items():
        db.table("questionnaire_answers").insert({
            "session_id": req.session_id,
            "section_id": "prd",
            "question_id": key,
            "answer": str(value),
            "source": "user",
        }).execute()

    db.table("sessions").update({"status": "generating", "module_type": "prd"}).eq("id", req.session_id).execute()
    result = await run_doc_pipeline("prd", raw_text, req.answers)

    with tempfile.TemporaryDirectory() as tmp:
        docx_path = os.path.join(tmp, "prd.docx")
        generate_docx(result, docx_path, doc_type="PRD")

        if req.export_format == "pdf":
            out_path = docx_to_pdf(docx_path, tmp)
            ext, content_type = "pdf", "application/pdf"
        else:
            out_path = docx_path
            ext, content_type = "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        with open(out_path, "rb") as f:
            file_bytes = f.read()

    storage_path = f"outputs/{req.session_id}/prd.{ext}"
    db.storage.from_("outputs").upload(storage_path, file_bytes, {"content-type": content_type})
    db.table("outputs").insert({
        "session_id": req.session_id,
        "output_type": f"prd_{ext}",
        "storage_path": storage_path,
    }).execute()
    db.table("sessions").update({"status": "completed"}).eq("id", req.session_id).execute()

    url = db.storage.from_("outputs").create_signed_url(storage_path, 3600)
    return {"download_url": url["signedURL"], "session_id": req.session_id}
