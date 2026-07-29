from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import Literal

from auth import CurrentUser, assert_session_access, get_current_user
from generation_jobs import queue_and_dispatch

router = APIRouter()


class GenerateRequest(BaseModel):
    session_id: str = Field(..., min_length=1)
    flow_type: str = Field(default="end-to-end", min_length=1, max_length=80)
    style: Literal["flowchart", "swimlane", "sequence"] = "flowchart"


@router.post("")
async def generate_pfd(req: GenerateRequest, current_user: CurrentUser = Depends(get_current_user)):
    assert_session_access(req.session_id, current_user)
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
