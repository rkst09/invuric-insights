import sys
import unittest
from pathlib import Path

from pydantic import ValidationError

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from structured_outputs import BacklogDocumentModel, SOWDocumentModel, WbsDocumentModel  # noqa: E402


class StructuredOutputTests(unittest.TestCase):
    def test_sow_schema_accepts_complete_payload(self):
        payload = {
            "metadata": {
                "client_name": "Northwind Health",
                "project_id": "INV-2026-001",
                "project_name": "Claims Portal Modernisation",
                "author": "Invuric BA Team",
                "requestor": "CIO",
                "start_date": "2026-05-01",
                "end_date": "2026-08-15",
            },
            "executive_summary": "Executive summary.",
            "project_overview": "Project overview.",
            "scope_of_work": {
                "in_scope": [f"In scope item {i}" for i in range(1, 8)],
                "out_of_scope": [f"Out of scope item {i}" for i in range(1, 6)],
            },
            "deliverables": [
                {"id": f"D-00{i}", "name": f"Deliverable {i}", "description": "Description"}
                for i in range(1, 7)
            ],
            "risks": [{"id": f"R-00{i}", "description": "Risk description"} for i in range(1, 7)],
            "assumptions": [{"id": f"A-00{i}", "description": "Assumption description"} for i in range(1, 7)],
            "dependencies": [{"id": f"DEP-00{i}", "description": "Dependency description"} for i in range(1, 6)],
            "responsibilities": {
                "Client": [f"Client responsibility {i}" for i in range(1, 8)],
                "Invuric": [f"Invuric responsibility {i}" for i in range(1, 8)],
            },
            "timeline": {
                "phases": [
                    {"phase": f"Phase {i}", "weeks": f"{i}-{i + 1}", "deliverables": "Named deliverables"}
                    for i in range(1, 6)
                ]
            },
            "roles": [
                {"role": f"Role {i}", "description": "Role description", "location": "Remote", "hours": "40"}
                for i in range(1, 6)
            ],
            "change_management": "Formal change control.",
            "acceptance_criteria": [f"Criterion {i}" for i in range(1, 7)],
            "validity": "30 days",
        }

        model = SOWDocumentModel.model_validate(payload)

        self.assertEqual(model.metadata.project_name, "Claims Portal Modernisation")
        self.assertEqual(len(model.deliverables), 6)

    def test_wbs_schema_auto_corrects_totals(self):
        """WbsDocumentModel ignores whatever totals Claude emits and recalculates them."""
        payload = {
            "project_name": "Atlas",
            "total_phases": 1,    # wrong — model should auto-correct to 4
            "total_tasks": 99,    # wrong — model should auto-correct to 12
            "total_subtasks": 99, # wrong — model should auto-correct to 24
            "phases": [
                {
                    "id": f"P{i}",
                    "name": f"Phase {i}",
                    "objective": "Objective",
                    "exit_criteria": "Exit criteria",
                    "duration": "1 week",
                    "tasks": [
                        {
                            "id": f"T{i}.{j}",
                            "name": "Task",
                            "description": "Task description",
                            "duration": "2 days",
                            "assigned_to": ["PM"],
                            "dependencies": "None",
                            "subtasks": [
                                {"id": f"S{i}.{j}.1", "name": "Subtask 1", "duration": "1 day", "assigned_to": ["PM"]},
                                {"id": f"S{i}.{j}.2", "name": "Subtask 2", "duration": "1 day", "assigned_to": ["BA"]},
                            ],
                        }
                        for j in range(1, 4)
                    ],
                }
                for i in range(1, 5)
            ],
        }

        model = WbsDocumentModel.model_validate(payload)

        self.assertEqual(model.total_phases, 4)
        self.assertEqual(model.total_tasks, 12)
        self.assertEqual(model.total_subtasks, 24)

    def test_wbs_schema_rejects_too_few_phases(self):
        """Fewer than 3 phases must raise ValidationError."""
        payload = {
            "project_name": "Atlas",
            "total_phases": 0,
            "total_tasks": 0,
            "total_subtasks": 0,
            "phases": [
                {
                    "id": "P1",
                    "name": "Phase 1",
                    "objective": "Objective",
                    "exit_criteria": "Exit criteria",
                    "duration": "1 week",
                    "tasks": [
                        {
                            "id": "T1.1",
                            "name": "Task",
                            "description": "Desc",
                            "duration": "1 day",
                            "assigned_to": ["PM"],
                            "dependencies": "None",
                            "subtasks": [{"id": "S1.1.1", "name": "Sub", "duration": "1 day", "assigned_to": ["PM"]}],
                        },
                        {
                            "id": "T1.2",
                            "name": "Task 2",
                            "description": "Desc",
                            "duration": "1 day",
                            "assigned_to": ["BA"],
                            "dependencies": "None",
                            "subtasks": [{"id": "S1.2.1", "name": "Sub", "duration": "1 day", "assigned_to": ["BA"]}],
                        },
                    ],
                }
            ],
        }

        with self.assertRaises(ValidationError):
            WbsDocumentModel.model_validate(payload)

    def test_backlog_schema_requires_minimum_story_count(self):
        payload = {
            "stories": [
                {
                    "page_name": "Dashboard",
                    "epic": "Reporting",
                    "high_level_flow": "View summary",
                    "user_story": "As an operations lead, I want to view the dashboard so that I can review status.",
                    "priority": "Must Have",
                    "story_points": 5,
                    "acceptance_criteria": "Scenario 1 - Given data, When page loads, Then summary appears.",
                    "data_points": "status (ENUM) - item status",
                    "edge_cases": "Empty state handled.",
                    "non_functional": "P95 under 1s.",
                    "dependencies": "Requires auth middleware.",
                }
                for _ in range(9)
            ]
        }

        with self.assertRaises(ValidationError):
            BacklogDocumentModel.model_validate(payload)


if __name__ == "__main__":
    unittest.main()
