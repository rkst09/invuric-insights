from fastapi import APIRouter
from pydantic import BaseModel, Field

from generation_jobs import queue_and_dispatch

router = APIRouter()


class GenerateRequest(BaseModel):
    session_id: str = Field(..., min_length=1)


@router.post("")
async def generate_raid(req: GenerateRequest):
    return queue_and_dispatch(req.session_id, "raid", {"session_id": req.session_id}, "RAID generation queued.")
