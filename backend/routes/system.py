import mimetypes

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from database import get_local_storage_file_path
from generators.pdf_generator import get_libreoffice_binary

router = APIRouter()


@router.get("/capabilities")
def get_capabilities():
    pdf_export_available = bool(get_libreoffice_binary())
    return {
        "pdf_export_available": pdf_export_available,
        "pdf_export_reason": None if pdf_export_available else "PDF export is unavailable on this deployment.",
        "client_template_available": True,
        "client_template_reason": None,
        "supported_templates": ["invuric", "client"],
    }


@router.get("/local-file")
def get_local_file(bucket: str, path: str):
    try:
        file_path = get_local_storage_file_path(bucket, path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="File not found") from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid file request") from exc

    media_type, _ = mimetypes.guess_type(str(file_path))
    return FileResponse(file_path, media_type=media_type or "application/octet-stream")
