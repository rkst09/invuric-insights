from fastapi import APIRouter
from pydantic import BaseModel, Field

from generation_jobs import queue_and_dispatch

router = APIRouter()


class GenerateRequest(BaseModel):
    session_id: str = Field(..., min_length=1)
    project_name: str = Field(default="", max_length=200)
    project_id: str = Field(default="", max_length=100)
    supplemental_context: str = Field(default="", max_length=5000)


@router.post("")
async def generate_backlog(req: GenerateRequest):
    return queue_and_dispatch(
        req.session_id,
        "backlog",
        {
            "session_id": req.session_id,
            "project_name": req.project_name,
            "project_id": req.project_id,
            "supplemental_context": req.supplemental_context,
        },
        "Backlog generation queued.",
    )
