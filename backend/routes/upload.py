import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from database import get_supabase
from extractors.file_extractor import extract_text

router = APIRouter()

ALLOWED_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/png",
    "image/jpeg",
    "image/jpg",
}

MAX_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB


@router.post("")
async def upload_file(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")

    content = await file.read()
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(400, "File too large. Max 50MB.")

    db = get_supabase()

    # Upload to Supabase Storage
    file_id = str(uuid.uuid4())
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin"
    storage_path = f"uploads/{file_id}.{ext}"

    db.storage.from_("documents").upload(
        storage_path, content, {"content-type": file.content_type}
    )

    # Create session — project_name derived from filename
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
    text = extract_text(content, file.content_type, file.filename)

    db.table("extracted_data").insert({
        "session_id": session_id,
        "document_id": doc_id,
        "raw_text": text,
    }).execute()

    return {
        "session_id": session_id,
        "document_id": doc_id,
        "filename": file.filename,
        "extracted_length": len(text),
    }
