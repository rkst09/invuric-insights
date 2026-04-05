from openai import AsyncOpenAI
from config import settings
import json

client = AsyncOpenAI(api_key=settings.openai_api_key)

SYSTEM_PROMPT = """You are an expert Project Manager. Create a detailed Work Breakdown Structure (WBS).

Return a JSON object with this structure:
{
  "project_name": "",
  "total_phases": 0,
  "total_tasks": 0,
  "total_subtasks": 0,
  "phases": [
    {
      "id": "P1",
      "name": "",
      "duration": "",
      "tasks": [
        {
          "id": "T1.1",
          "name": "",
          "duration": "",
          "assigned_to": ["PM", "Developers", "QA", "BA", "Design"],
          "subtasks": [
            {"id": "S1.1.1", "name": "", "duration": "", "assigned_to": []}
          ]
        }
      ]
    }
  ]
}

assigned_to should be from: PM, Developers, QA, BA, Design.
Create at minimum 4 phases with realistic tasks."""


async def run_wbs_pipeline(raw_text: str, audience: list[str]) -> dict:
    user_content = f"""Create a WBS for this project:

{raw_text[:10000] if raw_text else "Generic software development project."}

Target audience (ensure tasks are relevant to): {', '.join(audience)}

Return valid JSON only."""

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )

    return json.loads(response.choices[0].message.content)
