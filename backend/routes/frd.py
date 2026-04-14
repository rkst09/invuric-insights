from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Literal

from database import get_client_template_for_session
from generation_jobs import queue_and_dispatch

router = APIRouter()


class GenerateRequest(BaseModel):
    session_id: str = Field(..., min_length=1)
    answers: dict = Field(default_factory=dict)
    export_format: Literal["docx", "pdf"] = "docx"
    template: Literal["invuric", "client"] = "invuric"


@router.post("")
async def generate_frd(req: GenerateRequest):
    client_template = get_client_template_for_session(req.session_id) if req.template == "client" else None
    if req.template == "client" and not client_template:
        raise HTTPException(status_code=400, detail="Please upload a client template before generating this document.")

    return queue_and_dispatch(
        req.session_id,
        "frd",
        {
            "answers": req.answers,
            "export_format": req.export_format,
            "template": req.template,
        },
        "FRD generation queued.",
    )
