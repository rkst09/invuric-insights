"""Invuric BA Agent API — FastAPI application entry point.

Handles request routing, middleware, exception handling, and startup/shutdown lifecycle.
All generation endpoints follow the queue-and-poll pattern: POST queues a background job,
GET /api/sessions/{id}/generation polls its status.
"""

import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from auth import CurrentUser, get_current_user
from config import settings
from database import check_db_connectivity
from errors import ExternalServiceError
from generation_jobs import resume_incomplete_generations
from routes import backlog, frd, pfd, prd, raid, sessions, sow, system, upload, wbs
from utils.rate_limit import rate_limiter

LOGGER = logging.getLogger("invuric.api")
if not LOGGER.handlers:
    logging.basicConfig(
        level=getattr(logging, settings.request_log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Resume any generation jobs that were in-progress when the server last stopped."""
    await resume_incomplete_generations()
    yield


app = FastAPI(title="Invuric BA Agent API", version="1.0.0", lifespan=lifespan)

if settings.dev_bypass_auth:
    if settings.environment.lower() == "production":
        raise RuntimeError("DEV_BYPASS_AUTH must never be enabled when ENVIRONMENT=production.")
    LOGGER.warning(
        "AUTH IS DISABLED (DEV_BYPASS_AUTH=true) — every request is treated as a fake "
        "local dev user. This must never be set outside local testing."
    )
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        user_id="00000000-0000-0000-0000-000000000001",
        email="dev@invuric.co",
        # Must be a real row in `organizations` - sessions.org_id has a foreign key
        # constraint, so a made-up UUID 500s on every insert. This is the actual
        # "Invuric" org row already in Supabase, not a fake placeholder.
        org_id="2d0b114b-ea8e-42d2-8895-d415e46076ec",
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts_list or ["*"])


def _get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _should_rate_limit(request: Request) -> tuple[int, str] | None:
    path = request.url.path
    if request.method != "POST":
        return None
    if path.startswith("/api/upload"):
        return settings.rate_limit_uploads_per_window, "upload"
    if path.startswith("/api/generate/"):
        return settings.rate_limit_generations_per_window, "generate"
    return None


@app.middleware("http")
async def add_request_context(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = request_id
    started = time.perf_counter()

    limit_config = _should_rate_limit(request)
    if limit_config:
        limit, scope = limit_config
        allowed, retry_after = rate_limiter.check(
            key=f"{scope}:{_get_client_ip(request)}",
            limit=limit,
            window_seconds=settings.rate_limit_window_seconds,
        )
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Too many requests. Please wait before trying again.",
                    "error_code": "rate_limited",
                    "request_id": request_id,
                },
                headers={"Retry-After": str(retry_after), "X-Request-ID": request_id},
            )

    try:
        response = await call_next(request)
    except Exception:
        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        LOGGER.exception(
            "request_failed request_id=%s method=%s path=%s client_ip=%s duration_ms=%s",
            request_id,
            request.method,
            request.url.path,
            _get_client_ip(request),
            duration_ms,
        )
        raise

    duration_ms = round((time.perf_counter() - started) * 1000, 2)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if settings.environment.lower() != "development":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    LOGGER.info(
        "request_completed request_id=%s method=%s path=%s status_code=%s client_ip=%s duration_ms=%s",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        _get_client_ip(request),
        duration_ms,
    )
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "error_code": "http_error",
            "request_id": request_id,
        },
        headers={"X-Request-ID": request_id},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Validation failed for the submitted request.",
            "error_code": "validation_error",
            "errors": exc.errors(),
            "request_id": request_id,
        },
        headers={"X-Request-ID": request_id},
    )


@app.exception_handler(ExternalServiceError)
async def external_service_exception_handler(request: Request, exc: ExternalServiceError):
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "error_code": exc.error_code,
            "request_id": request_id,
        },
        headers={"X-Request-ID": request_id},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    LOGGER.exception("unhandled_exception request_id=%s path=%s", request_id, request.url.path)
    headers = {"X-Request-ID": request_id}
    origin = request.headers.get("origin", "")
    if origin in settings.allowed_origins_list:
        headers["Access-Control-Allow-Origin"] = origin
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An unexpected server error occurred.",
            "error_code": "internal_error",
            "request_id": request_id,
        },
        headers=headers,
    )


_auth_dep = [Depends(get_current_user)]

app.include_router(upload.router, prefix="/api/upload", tags=["upload"], dependencies=_auth_dep)
app.include_router(system.router, prefix="/api/system", tags=["system"], dependencies=_auth_dep)
app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"], dependencies=_auth_dep)
app.include_router(sow.router, prefix="/api/generate/sow", tags=["sow"], dependencies=_auth_dep)
app.include_router(prd.router, prefix="/api/generate/prd", tags=["prd"], dependencies=_auth_dep)
app.include_router(frd.router, prefix="/api/generate/frd", tags=["frd"], dependencies=_auth_dep)
app.include_router(raid.router, prefix="/api/generate/raid", tags=["raid"], dependencies=_auth_dep)
app.include_router(wbs.router, prefix="/api/generate/wbs", tags=["wbs"], dependencies=_auth_dep)
app.include_router(backlog.router, prefix="/api/generate/backlog", tags=["backlog"], dependencies=_auth_dep)
app.include_router(pfd.router, prefix="/api/generate/pfd", tags=["pfd"], dependencies=_auth_dep)



@app.get("/health")
def health():
    return {"status": "ok", "environment": settings.environment}


@app.get("/ready")
async def ready():
    import asyncio as _asyncio
    db_ok = await _asyncio.to_thread(check_db_connectivity)
    all_ok = bool(settings.anthropic_api_key) and bool(settings.supabase_url) and bool(settings.supabase_service_role_key) and db_ok
    return {
        "status": "ready" if all_ok else "degraded",
        "checks": {
            "anthropic_api_key": bool(settings.anthropic_api_key),
            "supabase_url": bool(settings.supabase_url),
            "supabase_service_role_key": bool(settings.supabase_service_role_key),
            "database_connectivity": db_ok,
        },
    }
