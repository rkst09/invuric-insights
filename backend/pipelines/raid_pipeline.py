from llm import complete_json
from structured_outputs import RaidDocumentModel

SYSTEM_PROMPT = """You are a Senior Risk Manager and Programme Assurance consultant with 15+ years managing risk registers for enterprise programmes across banking, government, healthcare, and technology. You have chaired risk review boards and presented RAID registers to boards of directors.

The RAID register you produce will be used in weekly programme steering committee meetings and reviewed by the client's PMO office. Every item must be specific, actionable, owned, and reflect genuine risks inherent to THIS project - not generic project management platitudes.

Quality standard:
- Risks must name specific failure modes for this project domain
- Mitigation strategies must be concrete actions with named owners
- Contingency plans must differ from mitigations
- Assumptions must have specific, measurable impact-if-wrong statements
- Issues must have concrete resolution steps with target dates
- Dependencies must name specific external systems, teams, approval bodies, or vendors

Return a JSON object with exactly these keys (no extra keys, no markdown):
{
  "risks": [{"id": "R001", "title": "string", "description": "string", "probability": "High|Medium|Low", "impact": "High|Medium|Low", "risk_score": "Critical|High|Medium|Low", "trigger_conditions": "string", "mitigation": "string", "contingency": "string", "owner": "string", "review_date": "string"}],
  "assumptions": [{"id": "A001", "title": "string", "description": "string", "impact_if_wrong": "string", "validation_method": "string", "validation_by": "string", "owner": "string"}],
  "issues": [{"id": "I001", "title": "string", "description": "string", "severity": "Critical|High|Medium|Low", "impact": "string", "resolution_plan": "string", "resolution_owner": "string", "target_resolution_date": "string"}],
  "dependencies": [{"id": "D001", "title": "string", "description": "string", "type": "Internal|External", "due_date": "string", "dependency_owner": "string", "impact_if_delayed": "string", "status": "On Track|At Risk|Blocked"}]
}
"""


async def run_raid_pipeline(raw_text: str) -> dict:
    doc_context = (
        raw_text[:80_000]
        if raw_text
        else "No document provided - generate a comprehensive RAID register for a typical enterprise software delivery project, inferring domain-specific risks from the project context described in the questionnaire."
    )

    user_content = f"""Analyse this project document and extract a comprehensive RAID register specific to this project's domain, technology, and organisational context:

{doc_context}

Apply all rules from your system instructions. Every item must be specific to this project. Return valid JSON only - no markdown, no commentary."""

    return await complete_json(
        SYSTEM_PROMPT,
        user_content,
        schema=RaidDocumentModel,
        temperature=0.15,
        max_tokens=10000,
    )
