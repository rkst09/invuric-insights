import os
import sys
import unittest
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon-key")

from redaction import RedactionSession  # noqa: E402


class RedactionKnownFieldTests(unittest.TestCase):
    def test_known_answer_fields_are_tokenised_and_restored(self):
        session = RedactionSession()
        answers = {
            "client_name": "Northwind Bank",
            "project_name": "Atlas",
            "author": "Jane Doe",
            "requestor": "Ops Team",
            "start_date": "2026-01-01",
        }
        masked = session.mask_answers(answers)

        self.assertEqual(masked["client_name"], "[CLIENT_NAME]")
        self.assertEqual(masked["project_name"], "[PROJECT_NAME]")
        self.assertEqual(masked["author"], "[AUTHOR_NAME]")
        self.assertEqual(masked["requestor"], "[REQUESTOR_NAME]")
        self.assertEqual(masked["start_date"], "2026-01-01")

        restored = session.restore(masked)
        self.assertEqual(restored, answers)

    def test_known_field_value_is_masked_in_raw_text_case_insensitively(self):
        session = RedactionSession()
        session.mask_answers({"client_name": "Northwind Bank"})
        raw = "Northwind Bank has requested a review. NORTHWIND BANK signed off yesterday."

        redacted = session.redact_text(raw)

        self.assertNotIn("Northwind", redacted)
        self.assertNotIn("NORTHWIND", redacted)
        self.assertEqual(redacted.count("[CLIENT_NAME]"), 2)

    def test_restore_reinserts_original_value_in_nested_structure(self):
        session = RedactionSession()
        session.mask_answers({"client_name": "Northwind Bank"})
        model_output = {
            "metadata": {"client_name": "[CLIENT_NAME]"},
            "notes": ["Prepared for [CLIENT_NAME]", "No other mentions"],
        }

        restored = session.restore(model_output)

        self.assertEqual(restored["metadata"]["client_name"], "Northwind Bank")
        self.assertEqual(restored["notes"][0], "Prepared for Northwind Bank")


class RedactionPatternTests(unittest.TestCase):
    def test_email_is_detected_and_restored(self):
        session = RedactionSession()
        raw = "Contact jane.doe@example.com for approval."

        redacted = session.redact_text(raw)

        self.assertNotIn("jane.doe@example.com", redacted)
        self.assertIn("[EMAIL_1]", redacted)
        self.assertEqual(session.restore(redacted), raw)

    def test_iban_is_detected(self):
        session = RedactionSession()
        raw = "Remit to IBAN GB33BUKB20201555555555 before Friday."

        redacted = session.redact_text(raw)

        self.assertNotIn("GB33BUKB20201555555555", redacted)
        self.assertTrue(any(token.startswith("[IBAN") for token in session.token_map))

    def test_uk_sort_code_and_account_number_is_detected(self):
        session = RedactionSession()
        raw = "Sort code 12-34-56, account 12345678."

        redacted = session.redact_text(raw)

        self.assertNotIn("12-34-56", redacted)
        self.assertTrue(any(token.startswith("[SORT_ACCOUNT") for token in session.token_map))

    def test_currency_amount_is_detected(self):
        session = RedactionSession()
        raw = "The invoice totals £125,450.00 for this phase."

        redacted = session.redact_text(raw)

        self.assertNotIn("£125,450.00", redacted)
        self.assertTrue(any(token.startswith("[AMOUNT") for token in session.token_map))

    def test_repeated_value_reuses_the_same_token(self):
        session = RedactionSession()
        raw = "Email jane@example.com or jane@example.com again."

        redacted = session.redact_text(raw)

        self.assertEqual(redacted.count("[EMAIL_1]"), 2)
        self.assertNotIn("[EMAIL_2]", redacted)

    def test_answers_free_text_values_are_pattern_scanned(self):
        session = RedactionSession()
        answers = {"notes": "Reach me at jane@example.com if needed."}

        masked = session.mask_answers(answers)

        self.assertNotIn("jane@example.com", masked["notes"])
        self.assertIn("[EMAIL_1]", masked["notes"])

    def test_empty_text_is_handled_safely(self):
        session = RedactionSession()
        self.assertEqual(session.redact_text(""), "")
        self.assertEqual(session.redact_text(None), "")
        self.assertIsNone(session.restore(None))


if __name__ == "__main__":
    unittest.main()
