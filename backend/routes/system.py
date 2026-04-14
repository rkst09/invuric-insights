from fastapi import APIRouter

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
