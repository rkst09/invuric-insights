import asyncio
import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon-key")

from fastapi import HTTPException  # noqa: E402

import auth  # noqa: E402
from config import settings  # noqa: E402


class _FakeUser:
    def __init__(self, user_id: str, email: str):
        self.id = user_id
        self.email = email


class _FakeAuthClient:
    """Stands in for the real Supabase auth client - only .auth.get_user() is used
    before the domain check, so nothing else needs to be implemented."""

    def __init__(self, user: _FakeUser):
        self.auth = SimpleNamespace(get_user=lambda token: SimpleNamespace(user=user))


class EmailDomainAllowlistTests(unittest.TestCase):
    def setUp(self):
        self._original_domains = settings.allowed_email_domains

    def tearDown(self):
        settings.allowed_email_domains = self._original_domains

    def test_allowed_domain_passes_case_insensitively(self):
        settings.allowed_email_domains = "invuric.co"
        self.assertTrue(auth._email_domain_allowed("person@invuric.co"))
        self.assertTrue(auth._email_domain_allowed("Person@INVURIC.CO"))

    def test_other_domain_is_rejected(self):
        settings.allowed_email_domains = "invuric.co"
        self.assertFalse(auth._email_domain_allowed("person@gmail.com"))

    def test_lookalike_subdomain_is_not_a_bypass(self):
        settings.allowed_email_domains = "invuric.co"
        self.assertFalse(auth._email_domain_allowed("person@invuric.co.evil.com"))

    def test_malformed_email_is_rejected(self):
        settings.allowed_email_domains = "invuric.co"
        self.assertFalse(auth._email_domain_allowed(""))
        self.assertFalse(auth._email_domain_allowed("not-an-email"))

    def test_no_configured_domains_allows_everything(self):
        settings.allowed_email_domains = ""
        self.assertTrue(auth._email_domain_allowed("person@anywhere.com"))


class GetCurrentUserDomainEnforcementTests(unittest.TestCase):
    def setUp(self):
        self._original_domains = settings.allowed_email_domains
        settings.allowed_email_domains = "invuric.co"
        self._original_client = auth._auth_client

    def tearDown(self):
        settings.allowed_email_domains = self._original_domains
        auth._auth_client = self._original_client

    def test_non_company_email_is_rejected_with_403_before_profile_lookup(self):
        auth._auth_client = _FakeAuthClient(_FakeUser("user-1", "person@gmail.com"))

        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(auth.get_current_user(authorization="Bearer sometoken"))

        self.assertEqual(ctx.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
