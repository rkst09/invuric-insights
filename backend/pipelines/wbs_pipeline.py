from config import settings
from llm import complete_json
from structured_outputs import WbsDocumentModel

SYSTEM_PROMPT = """You are a Senior Project Manager and Programme Delivery Director with 15+ years delivering enterprise software and digital transformation programmes. You build work breakdown structures that teams can actually execute.

Return a JSON object with this exact structure (no markdown, no extra keys):
{
  "project_name": "string",
  "total_phases": 0,
  "total_tasks": 0,
  "total_subtasks": 0,
  "phases": [
    {
      "id": "P1",
      "name": "string",
      "objective": "string",
      "exit_criteria": "string",
      "duration": "string",
      "tasks": [
        {
          "id": "T1.1",
          "name": "string",
          "description": "string",
          "duration": "string",
          "assigned_to": ["PM", "Developers", "QA", "BA", "Design"],
          "dependencies": "string",
          "subtasks": [
            {"id": "S1.1.1", "name": "string", "duration": "string", "assigned_to": ["PM"]}
          ]
        }
      ]
    }
  ]
}
"""


def _context_label(raw_text: str) -> str:
    compact = " ".join((raw_text or "").split())[:450]
    return compact or "the uploaded project"


def build_fallback_wbs(raw_text: str, audience: list[str]) -> dict:
    """Create a valid delivery-ready WBS when the LLM is unavailable or slow."""
    context = _context_label(raw_text)
    preferred_roles = audience or ["PM", "Developers", "QA", "BA", "Design"]

    def roles(*values: str) -> list[str]:
        selected = [value for value in values if value in preferred_roles]
        return selected or [preferred_roles[0]]

    phases = [
        {
            "id": "P1",
            "name": "Discovery & Requirements Baseline",
            "objective": f"Confirm scope, constraints, stakeholders, and success criteria for {context}.",
            "exit_criteria": "Approved requirements baseline, open questions log, and confirmed delivery assumptions.",
            "duration": "1-2 weeks",
            "tasks": [
                {
                    "id": "T1.1",
                    "name": "Project kickoff and stakeholder alignment",
                    "description": "Run kickoff, confirm objectives, stakeholders, governance cadence, communication routes, and approval owners.",
                    "duration": "2 days",
                    "assigned_to": roles("PM", "BA"),
                    "dependencies": "Sponsor availability and source documents",
                    "subtasks": [
                        {"id": "S1.1.1", "name": "Schedule kickoff and confirm attendees", "duration": "0.5 day", "assigned_to": roles("PM")},
                        {"id": "S1.1.2", "name": "Document objectives, constraints, and decision owners", "duration": "1 day", "assigned_to": roles("BA")},
                        {"id": "S1.1.3", "name": "Publish meeting notes and action log", "duration": "0.5 day", "assigned_to": roles("PM", "BA")},
                    ],
                },
                {
                    "id": "T1.2",
                    "name": "Requirements discovery and gap analysis",
                    "description": "Review uploaded artefacts, extract business rules, identify gaps, and validate ambiguous requirements.",
                    "duration": "3 days",
                    "assigned_to": roles("BA", "Design"),
                    "dependencies": "Uploaded project documents and stakeholder interviews",
                    "subtasks": [
                        {"id": "S1.2.1", "name": "Review source material and tag requirement themes", "duration": "1 day", "assigned_to": roles("BA")},
                        {"id": "S1.2.2", "name": "Create gap and assumption register", "duration": "1 day", "assigned_to": roles("BA")},
                        {"id": "S1.2.3", "name": "Validate gaps with stakeholders", "duration": "1 day", "assigned_to": roles("BA", "PM")},
                    ],
                },
                {
                    "id": "T1.3",
                    "name": "Scope baseline approval",
                    "description": "Convert findings into a signed scope baseline with in-scope, out-of-scope, dependencies, and acceptance criteria.",
                    "duration": "2 days",
                    "assigned_to": roles("PM", "BA"),
                    "dependencies": "Completed discovery and stakeholder review",
                    "subtasks": [
                        {"id": "S1.3.1", "name": "Prepare baseline summary", "duration": "1 day", "assigned_to": roles("BA")},
                        {"id": "S1.3.2", "name": "Review baseline with sponsor", "duration": "0.5 day", "assigned_to": roles("PM")},
                        {"id": "S1.3.3", "name": "Capture sign-off or change requests", "duration": "0.5 day", "assigned_to": roles("PM", "BA")},
                    ],
                },
            ],
        },
        {
            "id": "P2",
            "name": "Solution Design & Planning",
            "objective": "Translate the approved baseline into implementation-ready UX, architecture, data, and delivery plans.",
            "exit_criteria": "Approved solution approach, user flows, backlog, WBS, RAID, and delivery plan.",
            "duration": "1-2 weeks",
            "tasks": [
                {
                    "id": "T2.1",
                    "name": "User journey and workflow definition",
                    "description": "Map primary user flows, alternate paths, error paths, and stakeholder handoffs.",
                    "duration": "3 days",
                    "assigned_to": roles("BA", "Design"),
                    "dependencies": "Approved requirements baseline",
                    "subtasks": [
                        {"id": "S2.1.1", "name": "Identify personas and journey entry points", "duration": "1 day", "assigned_to": roles("BA", "Design")},
                        {"id": "S2.1.2", "name": "Map happy path and exception flows", "duration": "1 day", "assigned_to": roles("BA")},
                        {"id": "S2.1.3", "name": "Review flows with delivery team", "duration": "1 day", "assigned_to": roles("PM", "BA")},
                    ],
                },
                {
                    "id": "T2.2",
                    "name": "Technical and integration planning",
                    "description": "Define system interfaces, data dependencies, environments, access needs, and non-functional requirements.",
                    "duration": "3 days",
                    "assigned_to": roles("Developers", "BA"),
                    "dependencies": "Technical stakeholder input and access to target systems",
                    "subtasks": [
                        {"id": "S2.2.1", "name": "Document integration endpoints and data contracts", "duration": "1 day", "assigned_to": roles("Developers")},
                        {"id": "S2.2.2", "name": "Confirm environment and access requirements", "duration": "1 day", "assigned_to": roles("PM", "Developers")},
                        {"id": "S2.2.3", "name": "Validate NFRs and compliance constraints", "duration": "1 day", "assigned_to": roles("BA", "QA")},
                    ],
                },
                {
                    "id": "T2.3",
                    "name": "Backlog and delivery plan creation",
                    "description": "Prepare sprint-ready stories, delivery milestones, RAID entries, and role-based work allocation.",
                    "duration": "2 days",
                    "assigned_to": roles("PM", "BA"),
                    "dependencies": "Requirements and solution approach",
                    "subtasks": [
                        {"id": "S2.3.1", "name": "Generate and refine user stories", "duration": "1 day", "assigned_to": roles("BA")},
                        {"id": "S2.3.2", "name": "Estimate work and map dependencies", "duration": "0.5 day", "assigned_to": roles("PM", "Developers")},
                        {"id": "S2.3.3", "name": "Confirm delivery milestones", "duration": "0.5 day", "assigned_to": roles("PM")},
                    ],
                },
            ],
        },
        {
            "id": "P3",
            "name": "Build, Configuration & Integration",
            "objective": "Implement the agreed scope, configure required services, and connect integrations safely.",
            "exit_criteria": "Build complete, integrations tested, defects triaged, and release candidate ready for QA.",
            "duration": "2-4 weeks",
            "tasks": [
                {
                    "id": "T3.1",
                    "name": "Frontend and experience implementation",
                    "description": "Build responsive screens, reusable components, empty/loading/error states, and accessibility support.",
                    "duration": "1-2 weeks",
                    "assigned_to": roles("Developers", "Design"),
                    "dependencies": "Approved flows and UI direction",
                    "subtasks": [
                        {"id": "S3.1.1", "name": "Implement primary screens and navigation", "duration": "3 days", "assigned_to": roles("Developers")},
                        {"id": "S3.1.2", "name": "Add responsive states and accessibility support", "duration": "2 days", "assigned_to": roles("Developers", "Design")},
                        {"id": "S3.1.3", "name": "Conduct UI review and refinements", "duration": "1 day", "assigned_to": roles("Design", "QA")},
                    ],
                },
                {
                    "id": "T3.2",
                    "name": "Backend, data, and integration implementation",
                    "description": "Build APIs, persistence, validation, integration calls, error handling, and logging.",
                    "duration": "1-2 weeks",
                    "assigned_to": roles("Developers", "QA"),
                    "dependencies": "Data contracts, credentials, and environment access",
                    "subtasks": [
                        {"id": "S3.2.1", "name": "Implement API endpoints and validation", "duration": "3 days", "assigned_to": roles("Developers")},
                        {"id": "S3.2.2", "name": "Integrate external systems and storage", "duration": "3 days", "assigned_to": roles("Developers")},
                        {"id": "S3.2.3", "name": "Add logging, retry, and failure handling", "duration": "2 days", "assigned_to": roles("Developers", "QA")},
                    ],
                },
                {
                    "id": "T3.3",
                    "name": "Internal integration validation",
                    "description": "Verify end-to-end workflows, data consistency, role-based behavior, and failure paths.",
                    "duration": "3 days",
                    "assigned_to": roles("QA", "Developers", "BA"),
                    "dependencies": "Build completion and test data",
                    "subtasks": [
                        {"id": "S3.3.1", "name": "Prepare test data and integration scenarios", "duration": "1 day", "assigned_to": roles("QA", "BA")},
                        {"id": "S3.3.2", "name": "Execute end-to-end smoke testing", "duration": "1 day", "assigned_to": roles("QA")},
                        {"id": "S3.3.3", "name": "Triaged defects and retest fixes", "duration": "1 day", "assigned_to": roles("QA", "Developers")},
                    ],
                },
            ],
        },
        {
            "id": "P4",
            "name": "QA, UAT & Handover",
            "objective": "Validate quality, secure stakeholder acceptance, and prepare the solution for handover or launch.",
            "exit_criteria": "UAT signed off, critical defects closed, handover pack delivered, and release readiness confirmed.",
            "duration": "1-2 weeks",
            "tasks": [
                {
                    "id": "T4.1",
                    "name": "System and regression testing",
                    "description": "Run functional, integration, regression, browser/device, accessibility, and non-functional checks.",
                    "duration": "4 days",
                    "assigned_to": roles("QA", "Developers"),
                    "dependencies": "Release candidate and QA test plan",
                    "subtasks": [
                        {"id": "S4.1.1", "name": "Execute functional and regression test suite", "duration": "2 days", "assigned_to": roles("QA")},
                        {"id": "S4.1.2", "name": "Validate non-functional and accessibility requirements", "duration": "1 day", "assigned_to": roles("QA")},
                        {"id": "S4.1.3", "name": "Track, fix, and retest defects", "duration": "1 day", "assigned_to": roles("QA", "Developers")},
                    ],
                },
                {
                    "id": "T4.2",
                    "name": "User acceptance testing",
                    "description": "Coordinate UAT scripts, stakeholder execution, defect triage, and acceptance decisions.",
                    "duration": "3 days",
                    "assigned_to": roles("PM", "BA", "QA"),
                    "dependencies": "QA sign-off and UAT stakeholder availability",
                    "subtasks": [
                        {"id": "S4.2.1", "name": "Prepare UAT scripts and success criteria", "duration": "1 day", "assigned_to": roles("BA", "QA")},
                        {"id": "S4.2.2", "name": "Support stakeholder UAT execution", "duration": "1 day", "assigned_to": roles("PM", "BA")},
                        {"id": "S4.2.3", "name": "Capture sign-off and residual actions", "duration": "1 day", "assigned_to": roles("PM")},
                    ],
                },
                {
                    "id": "T4.3",
                    "name": "Deployment readiness and handover",
                    "description": "Prepare release checklist, operational handover, support notes, rollback plan, and final artefact pack.",
                    "duration": "2 days",
                    "assigned_to": roles("PM", "Developers", "BA"),
                    "dependencies": "UAT approval and deployment window",
                    "subtasks": [
                        {"id": "S4.3.1", "name": "Prepare deployment and rollback checklist", "duration": "0.5 day", "assigned_to": roles("Developers", "PM")},
                        {"id": "S4.3.2", "name": "Create handover documentation", "duration": "1 day", "assigned_to": roles("BA", "Developers")},
                        {"id": "S4.3.3", "name": "Confirm release readiness with sponsor", "duration": "0.5 day", "assigned_to": roles("PM")},
                    ],
                },
            ],
        },
    ]

    total_tasks = sum(len(phase["tasks"]) for phase in phases)
    total_subtasks = sum(len(task["subtasks"]) for phase in phases for task in phase["tasks"])
    return {
        "project_name": "Generated Delivery Plan",
        "total_phases": len(phases),
        "total_tasks": total_tasks,
        "total_subtasks": total_subtasks,
        "phases": phases,
    }


async def run_wbs_pipeline(raw_text: str, audience: list[str]) -> dict:
    doc_context = (
        raw_text[:settings.generation_input_max_chars]
        if raw_text
        else "No document provided - create a WBS for a typical enterprise software delivery project with web frontend, REST API backend, database, and third-party integrations."
    )

    user_content = f"""Create a comprehensive Work Breakdown Structure for this project:

Project Document:
{doc_context}

Target Audience (make tasks for these roles especially granular and specific): {", ".join(audience) if audience else "All roles"}

CONSTRAINTS (these are hard requirements — failure to follow them will cause errors):
- Each phase MUST have at least 2 tasks.
- Each task MUST have at least 1 subtask.
- The WBS MUST have at least 3 phases.
- The JSON fields total_phases, total_tasks, and total_subtasks will be auto-calculated — set them to 0.

Apply all rules from your system instructions. Return valid JSON only - no markdown, no commentary."""

    return await complete_json(
        SYSTEM_PROMPT,
        user_content,
        schema=WbsDocumentModel,
        temperature=0.15,
        max_tokens=8000,
    )
