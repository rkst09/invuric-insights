import uuid
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from config import settings
from database import get_supabase
from extractors.file_extractor import extract_text
from errors import StorageServiceError

router = APIRouter()

ALLOWED_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/png",
    "image/jpeg",
    "image/jpg",
}

MAX_SIZE_BYTES = settings.max_file_size_mb * 1024 * 1024


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    session_id: str | None = Form(default=None),
):
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
    inferred_type = {
        "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
    }.get(ext)
    content_type = file.content_type or inferred_type

    if content_type == "text/plain":
        raise HTTPException(400, "TXT uploads are not enabled on this deployment. Please upload PDF or DOCX.")

    if content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Unsupported file type: {content_type or file.content_type}")

    content = await file.read()
    if not file.filename:
        raise HTTPException(400, "Filename is required.")
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(400, f"File too large. Max {settings.max_file_size_mb}MB.")

    db = get_supabase()

    # Upload to Supabase Storage
    file_id = str(uuid.uuid4())
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin"
    storage_path = f"uploads/{file_id}.{ext}"

    try:
        db.storage.from_("documents").upload(
            storage_path, content, {"content-type": content_type}
        )
    except Exception as exc:
        raise StorageServiceError("The uploaded file could not be saved to storage. Please try again.") from exc

    # Create session — project_name derived from filename
    if session_id:
        db.table("sessions").update({"status": "uploaded"}).eq("id", session_id).execute()
    else:
        project_name = file.filename.rsplit(".", 1)[0].replace("_", " ").replace("-", " ").title()
        session = db.table("sessions").insert({
            "project_name": project_name,
            "module_type": "upload",
            "status": "uploaded",
            "metadata": {"original_filename": file.filename},
        }).execute()
        session_id = session.data[0]["id"]

    # Save document record — match exact DB column names
    doc = db.table("documents").insert({
        "session_id": session_id,
        "file_name": file.filename,
        "file_type": ext.upper(),
        "storage_path": storage_path,
        "file_size": len(content),
    }).execute()
    doc_id = doc.data[0]["id"]

    # Extract text
    text = extract_text(content, content_type, file.filename)

    db.table("extracted_data").insert({
        "session_id": session_id,
        "document_id": doc_id,
        "raw_text": text,
    }).execute()

    return {
        "session_id": session_id,
        "document_id": doc_id,
        "filename": file.filename,
        "file_type": ext.lower(),
        "storage_path": storage_path,
        "extracted_length": len(text),
    }
