from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Literal

from generation_jobs import queue_and_dispatch

router = APIRouter()


class GenerateRequest(BaseModel):
    session_id: str = Field(..., min_length=1)
    flow_type: str = Field(default="end-to-end", min_length=1, max_length=80)
    style: Literal["flowchart", "swimlane", "sequence"] = "flowchart"


@router.post("")
async def generate_pfd(req: GenerateRequest):
    return queue_and_dispatch(
        req.session_id,
        "pfd",
        {
            "session_id": req.session_id,
            "flow_type": req.flow_type,
            "style": req.style,
        },
        "Diagram generation queued.",
    )
