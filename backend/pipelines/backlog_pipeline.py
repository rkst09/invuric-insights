from datetime import UTC, datetime

from config import settings
from llm import complete_json
from structured_outputs import BacklogDocumentModel

SYSTEM_PROMPT = """You are a Senior Product Owner and Business Analyst with 12+ years writing product backlogs for agile delivery teams. You have facilitated sprint planning for teams from 5 to 50 engineers and have shipped products in fintech, healthcare, e-commerce, and enterprise SaaS.

The backlog you produce will be imported directly into a sprint planning session. Every story must meet the INVEST criteria and be specific to THIS product.

Return a JSON object with this structure (no markdown, no extra keys):
{
  "stories": [
    {
      "page_name": "string",
      "epic": "string",
      "high_level_flow": "string",
      "user_story": "string",
      "priority": "Must Have|Should Have|Could Have|Won't Have",
      "story_points": 0,
      "acceptance_criteria": "string",
      "data_points": "string",
      "edge_cases": "string",
      "non_functional": "string",
      "dependencies": "string"
    }
  ]
}
"""


def _context_label(raw_text: str, project_name: str) -> str:
    compact = " ".join((raw_text or "").split())[:450]
    return compact or project_name or "the uploaded project"


def build_fallback_backlog(
    raw_text: str,
    project_name: str,
    project_id: str,
    supplemental_context: str = "",
) -> dict:
    """Create a polished sprint-ready backlog when the LLM is unavailable or slow."""
    context = _context_label(f"{raw_text}\n{supplemental_context}", project_name)
    project = project_name or "Project"
    pid = project_id or "PRJ-001"
    analyzed_at = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
    story_specs = [
        ("Project Intake", "Discovery & Scope", "Capture project objectives and source documents", "As a business analyst, I want to capture project goals, constraints, and uploaded documents so that downstream artefacts are generated from a reliable baseline.", "Must Have", 5, "Given project details and documents are provided, when the user submits intake, then the system stores the context and confirms readiness for analysis.", "Project name, client name, objectives, uploaded file metadata, extracted text", "Missing files, unsupported file type, duplicate uploads, incomplete project metadata", "Upload response under 10 seconds for supported files; clear validation errors; accessible form labels", "Document extraction service; session storage"),
        ("Analysis Workspace", "Discovery & Scope", "Review extracted context and identify gaps", "As a BA, I want to review extracted project context so that I can catch missing or unclear requirements before generation.", "Must Have", 5, "Given extracted text exists, when the user opens analysis, then key sections, gaps, and source references are visible.", "Extracted text, detected sections, confidence indicators, gap list", "Poor OCR quality, empty extraction, conflicting document sections", "Large documents remain responsive; no raw errors shown to user", "Extraction pipeline; document records"),
        ("Requirements Review", "Requirements Management", "Validate business and functional requirements", "As a project stakeholder, I want to review captured requirements so that I can confirm scope before delivery artefacts are produced.", "Must Have", 8, "Given requirements are extracted, when stakeholder review is completed, then approved and open items are tracked separately.", "Requirement ID, title, description, priority, status, owner", "Duplicate requirements, vague requirement, stakeholder disagreement", "Audit trail for decisions; keyboard-accessible review controls", "Session metadata; approval workflow"),
        ("User Journey", "Experience Design", "Map primary user flows", "As a product owner, I want user journeys mapped from the source material so that design and development teams understand the intended flow.", "Should Have", 5, "Given project context is available, when journey mapping runs, then primary actors, steps, success paths, and exceptions are generated.", "Actors, steps, triggers, outcomes, exceptions", "Multiple actors with overlapping steps, missing success criteria", "Generated journey renders within the page without layout shift", "LLM generation; diagram renderer"),
        ("Backlog Generation", "Agile Delivery", "Generate sprint-ready user stories", "As a product owner, I want a prioritized backlog so that the team can plan implementation with clear acceptance criteria.", "Must Have", 8, "Given approved context, when backlog generation completes, then 10-15 INVEST-style stories are available in Excel.", "Story title, epic, priority, points, acceptance criteria, dependencies", "Claude timeout, invalid structured response, incomplete context", "Fallback backlog available if AI generation stalls; Excel remains formatted", "LLM provider; XLSX generator"),
        ("WBS Planning", "Delivery Planning", "Break delivery into phases and tasks", "As a project manager, I want a WBS so that delivery work, dependencies, and owners are clear.", "Must Have", 8, "Given project scope exists, when WBS is generated, then phases, tasks, subtasks, owners, durations, and dependencies are included.", "Phase, task, subtask, owner role, duration, dependency", "Overlapping tasks, missing owners, unrealistic durations", "Excel output uses clear hierarchy and frozen headers", "WBS generator; project context"),
        ("RAID Register", "Risk Governance", "Track risks, assumptions, issues, and dependencies", "As a delivery lead, I want a RAID register so that project threats and blockers are visible and actionable.", "Should Have", 5, "Given project context, when RAID generation completes, then risks, assumptions, issues, and dependencies have owners and review fields.", "Risk score, owner, mitigation, status, due date", "Generic risk entries, missing owner, outdated status", "Color-coded severity/status fields in Excel", "RAID generator; XLSX output"),
        ("Output Download", "Export & Handoff", "Download polished Excel artefacts", "As a user, I want downloadable artefacts so that I can share them with stakeholders and delivery teams.", "Must Have", 3, "Given an output exists, when the user clicks download, then a signed URL returns the latest generated file.", "Output type, storage path, generated timestamp, signed URL", "Expired signed URL, storage unavailable, missing output row", "Download errors are recoverable and user-friendly", "Supabase storage; output records"),
        ("Project History", "Governance & Traceability", "View previous generated artefacts", "As a BA manager, I want generation history so that I can audit what was produced and when.", "Should Have", 3, "Given previous sessions exist, when history is opened, then completed and failed generations are visible with timestamps.", "Session ID, module type, status, created date, metadata", "Large history list, failed generation, missing metadata", "History loads quickly with pagination or limits", "Sessions table; metadata records"),
        ("Error Recovery", "Operational Resilience", "Recover gracefully from external service failures", "As a user, I want clear retry and fallback behavior so that temporary AI or storage issues do not block my work.", "Must Have", 5, "Given an external service fails, when generation is attempted, then the system shows progress, retries where safe, and produces fallback output where supported.", "Error code, request ID, stage, retry state, fallback result", "Claude timeout, Supabase transient outage, upload failure", "No indefinite spinner; actionable error copy", "LLM provider; storage provider; job state"),
        ("Stakeholder Sign-off", "Governance & Traceability", "Capture review decisions", "As a sponsor, I want sign-off checkpoints so that generated artefacts become agreed delivery inputs.", "Should Have", 3, "Given artefacts are generated, when review is complete, then sign-off status and open questions are recorded.", "Reviewer, decision, comments, date, open questions", "Delayed approval, conflicting feedback, missing reviewer", "Decision state is visible and exportable", "Session metadata; review workflow"),
        ("Deployment Readiness", "Release Planning", "Prepare production handoff", "As an engineering lead, I want deployment readiness tracked so that implementation can move safely to release.", "Could Have", 5, "Given backlog and WBS are complete, when readiness is reviewed, then dependencies, environments, QA, and release tasks are visible.", "Environment, dependency, QA status, release owner, go-live criteria", "Environment unavailable, incomplete QA, DNS or integration delay", "Readiness view remains clear on desktop and mobile", "Delivery plan; WBS; RAID"),
    ]

    stories = []
    for index, spec in enumerate(story_specs, start=1):
        (
            page_name,
            epic,
            flow,
            user_story,
            priority,
            points,
            acceptance,
            data_points,
            edge_cases,
            non_functional,
            dependencies,
        ) = spec
        stories.append({
            "page_name": page_name,
            "epic": epic,
            "high_level_flow": f"{flow}. Project context: {context}",
            "user_story": user_story,
            "priority": priority,
            "story_points": points,
            "acceptance_criteria": acceptance,
            "data_points": data_points,
            "edge_cases": edge_cases,
            "non_functional": non_functional,
            "dependencies": dependencies,
            "project_id": pid,
            "project_name": project,
            "analyzed_at": analyzed_at,
        })
    return {"stories": stories}


async def run_backlog_pipeline(
    raw_text: str,
    project_name: str,
    project_id: str,
    supplemental_context: str = "",
    images: list[dict] | None = None,
) -> dict:
    supplemental_block = (
        f"\nSupplemental Context:\n{supplemental_context.strip()}\n"
        if supplemental_context.strip()
        else ""
    )
    vision_block = (
        "\nAttached above are actual screenshots/mockup pages from the uploaded materials. "
        "Look at them directly - identify each distinct screen, its UI elements, and the "
        "flow between screens. Use what you see (not just filenames) to name pages "
        "precisely and to ground high_level_flow, user_story, acceptance_criteria, and "
        "edge_cases in the real layout and interactions shown, the way an experienced "
        "Business Analyst would when reviewing wireframes with a client.\n"
        if images
        else ""
    )
    user_content = f"""Generate a comprehensive product backlog for this project:

Project Name: {project_name or "Unnamed Project"}
Project ID: {project_id or "PRJ-001"}

Project Document / Context:
{raw_text[:settings.generation_input_max_chars] if raw_text else "No document provided - generate a comprehensive backlog for a typical enterprise web application with user authentication, dashboard, data management, and reporting features."}
{supplemental_block}{vision_block}
Apply all rules from your system instructions. Cover every screen and flow. Minimum 10 stories, maximum 15. Return valid JSON only - no markdown, no commentary."""

    result = await complete_json(
        SYSTEM_PROMPT,
        user_content,
        schema=BacklogDocumentModel,
        temperature=0.15,
        max_tokens=8000,
        images=images,
    )

    analyzed_at = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
    for story in result.get("stories", []):
        story["project_name"] = project_name
        story["project_id"] = project_id
        story["analyzed_at"] = analyzed_at

    return result
