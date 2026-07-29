from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from auth import CurrentUser, assert_session_access, get_current_user
from generation_jobs import queue_and_dispatch

router = APIRouter()


class GenerateRequest(BaseModel):
    session_id: str = Field(..., min_length=1)
    audience: list[str] = Field(default_factory=lambda: ["PM", "Developers"], min_length=1)


@router.post("")
async def generate_wbs(req: GenerateRequest, current_user: CurrentUser = Depends(get_current_user)):
    assert_session_access(req.session_id, current_user)
    return queue_and_dispatch(
        req.session_id,
        "wbs",
        {"session_id": req.session_id, "audience": req.audience},
        "WBS generation queued.",
    )
