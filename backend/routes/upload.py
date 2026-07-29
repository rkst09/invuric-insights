import uuid
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from auth import CurrentUser, assert_session_access, get_current_user
from config import settings
from database import execute_query, get_supabase, run_external_operation
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
    current_user: CurrentUser = Depends(get_current_user),
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
        run_external_operation(
            "upload_file_storage_upload",
            lambda: db.storage.from_("documents").upload(storage_path, content, {"content-type": content_type}),
        )
    except Exception as exc:
        raise StorageServiceError("The uploaded file could not be saved to storage. Please try again.") from exc

    # Create session — project_name derived from filename
    if session_id:
        assert_session_access(session_id, current_user)
        execute_query("upload_file_update_session", db.table("sessions").update({"status": "uploaded"}).eq("id", session_id))
    else:
        project_name = file.filename.rsplit(".", 1)[0].replace("_", " ").replace("-", " ").title()
        session = execute_query("upload_file_create_session", db.table("sessions").insert({
            "project_name": project_name,
            "module_type": "upload",
            "status": "uploaded",
            "metadata": {"original_filename": file.filename},
            "org_id": current_user.org_id,
        }))
        session_id = session.data[0]["id"]

    # Save document record — match exact DB column names
    doc = execute_query("upload_file_insert_document", db.table("documents").insert({
        "session_id": session_id,
        "file_name": file.filename,
        "file_type": ext.upper(),
        "storage_path": storage_path,
        "file_size": len(content),
    }))
    doc_id = doc.data[0]["id"]

    # Extract text
    text = extract_text(content, content_type, file.filename)

    execute_query("upload_file_insert_extracted_data", db.table("extracted_data").insert({
        "session_id": session_id,
        "document_id": doc_id,
        "raw_text": text,
    }))

    return {
        "session_id": session_id,
        "document_id": doc_id,
        "filename": file.filename,
        "file_type": ext.lower(),
        "storage_path": storage_path,
        "extracted_length": len(text),
    }
