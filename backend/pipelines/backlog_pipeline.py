from datetime import datetime

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


async def run_backlog_pipeline(
    raw_text: str,
    project_name: str,
    project_id: str,
    supplemental_context: str = "",
) -> dict:
    supplemental_block = (
        f"\nSupplemental Context:\n{supplemental_context.strip()}\n"
        if supplemental_context.strip()
        else ""
    )
    user_content = f"""Generate a comprehensive product backlog for this project:

Project Name: {project_name or "Unnamed Project"}
Project ID: {project_id or "PRJ-001"}

Project Document / Context:
{raw_text[:80_000] if raw_text else "No document provided - generate a comprehensive backlog for a typical enterprise web application with user authentication, dashboard, data management, and reporting features."}
{supplemental_block}

Apply all rules from your system instructions. Cover every screen and flow. Minimum 10 stories, maximum 15. Return valid JSON only - no markdown, no commentary."""

    result = await complete_json(
        SYSTEM_PROMPT,
        user_content,
        schema=BacklogDocumentModel,
        temperature=0.15,
        max_tokens=12000,
    )

    analyzed_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    for story in result.get("stories", []):
        story["project_name"] = project_name
        story["project_id"] = project_id
        story["analyzed_at"] = analyzed_at

    return result
