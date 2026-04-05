from openai import AsyncOpenAI
from config import settings
import json
from datetime import datetime

client = AsyncOpenAI(api_key=settings.openai_api_key)

SYSTEM_PROMPT = """You are an expert Business Analyst creating user stories for a product backlog.

Return a JSON object with this structure:
{
  "stories": [
    {
      "page_name": "",
      "high_level_flow": "",
      "user_story": "As a [role], I want to [action], so that [benefit]",
      "acceptance_criteria": "Given [context], When [action], Then [outcome]",
      "data_points": "",
      "edge_cases": "",
      "non_functional": "",
    }
  ]
}

Generate comprehensive user stories covering all major flows and pages.
Include edge cases, error handling, and non-functional requirements.
Minimum 10 user stories."""


async def run_backlog_pipeline(raw_text: str, project_name: str, project_id: str) -> dict:
    user_content = f"""Generate user stories for this project:

Project Name: {project_name or "Unnamed Project"}
Project ID: {project_id or "PRJ-001"}

Document Context:
{raw_text[:10000] if raw_text else "No document provided. Generate generic web application user stories."}

Return valid JSON only."""

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )

    result = json.loads(response.choices[0].message.content)

    # Enrich with project metadata
    analyzed_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    for story in result.get("stories", []):
        story["project_name"] = project_name
        story["project_id"] = project_id
        story["analyzed_at"] = analyzed_at

    return result
