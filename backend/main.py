import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import upload, sessions, sow, prd, frd, raid, wbs, backlog, pfd

app = FastAPI(title="Invuric BA Agent API", version="1.0.0")

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:4173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])
app.include_router(sow.router, prefix="/api/generate/sow", tags=["sow"])
app.include_router(prd.router, prefix="/api/generate/prd", tags=["prd"])
app.include_router(frd.router, prefix="/api/generate/frd", tags=["frd"])
app.include_router(raid.router, prefix="/api/generate/raid", tags=["raid"])
app.include_router(wbs.router, prefix="/api/generate/wbs", tags=["wbs"])
app.include_router(backlog.router, prefix="/api/generate/backlog", tags=["backlog"])
app.include_router(pfd.router, prefix="/api/generate/pfd", tags=["pfd"])


@app.get("/health")
def health():
    return {"status": "ok"}
