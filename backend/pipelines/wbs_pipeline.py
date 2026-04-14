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


async def run_wbs_pipeline(raw_text: str, audience: list[str]) -> dict:
    doc_context = (
        raw_text[:80_000]
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
        max_tokens=12000,
    )
