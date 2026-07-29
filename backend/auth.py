"""Authentication and org-scoping for all API routes.

Login itself is handled by Supabase Auth (Microsoft/Azure OAuth) on the frontend;
the frontend attaches the resulting access token as `Authorization: Bearer <token>`.
This module verifies that token against Supabase on every request, rejects any
email outside `settings.allowed_email_domains`, and resolves the token to the
caller's organization, which every route uses to scope data access.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from fastapi import Header, HTTPException
from supabase import create_client

from config import settings
from database import execute_query, get_session_record, get_supabase

LOGGER = logging.getLogger("invuric.auth")

_auth_client = None


def _get_auth_client():
    """A Supabase client used only to validate bearer tokens against the real
    Auth server — independent of the local-storage dev fallback in database.py,
    since auth verification always requires reaching Supabase itself."""
    global _auth_client
    if _auth_client is None:
        _auth_client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _auth_client


def _email_domain_allowed(email: str) -> bool:
    allowed_domains = settings.allowed_email_domains_list
    if not allowed_domains:
        return True
    if "@" not in email:
        return False
    domain = email.rsplit("@", 1)[-1].lower()
    return domain in allowed_domains


@dataclass(frozen=True)
class CurrentUser:
    user_id: str
    email: str
    org_id: str


async def get_current_user(authorization: str | None = Header(default=None)) -> CurrentUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header.")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(401, "Missing bearer token.")

    try:
        response = _get_auth_client().auth.get_user(token)
    except Exception as exc:
        LOGGER.warning("auth_token_verification_failed error=%s", exc)
        raise HTTPException(401, "Invalid or expired session. Please sign in again.") from exc

    user = getattr(response, "user", None)
    if not user or not user.id:
        raise HTTPException(401, "Invalid or expired session. Please sign in again.")

    if not _email_domain_allowed(user.email or ""):
        LOGGER.warning("auth_domain_rejected user_id=%s email=%s", user.id, user.email)
        raise HTTPException(403, "Access is restricted to approved company accounts.")

    profile_result = execute_query(
        "get_profile_for_auth",
        _get_auth_client().table("profiles").select("org_id").eq("id", user.id).limit(1),
    )
    profile = profile_result.data[0] if profile_result.data else None
    if not profile or not profile.get("org_id"):
        raise HTTPException(403, "Your account is not linked to an approved organization.")

    return CurrentUser(user_id=user.id, email=user.email or "", org_id=profile["org_id"])


def assert_session_access(session_id: str, current_user: CurrentUser) -> dict:
    """Fetch a session and confirm it belongs to the caller's org.

    Returns 404 (not 403) on a mismatch so callers can't distinguish
    "not yours" from "doesn't exist".
    """
    session = get_session_record(session_id)
    if not session or session.get("org_id") != current_user.org_id:
        raise HTTPException(404, "Session not found")
    return session
