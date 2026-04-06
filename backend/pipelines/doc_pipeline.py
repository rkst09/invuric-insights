from openai import AsyncOpenAI
from config import settings

client = AsyncOpenAI(api_key=settings.openai_api_key)

# Metadata keys the questionnaire collects — pulled into the metadata block verbatim
METADATA_KEYS = ["client_name", "project_id", "project_name", "author", "requestor", "start_date", "end_date"]

SOW_PROMPT = """You are an expert Business Analyst at Invuric. Generate a complete, professional Statement of Work (SOW).

Return ONLY valid JSON matching this exact schema (no extra keys, no markdown):
{
  "metadata": {
    "client_name": string,
    "project_id": string,
    "project_name": string,
    "author": string,
    "requestor": string,
    "start_date": string,
    "end_date": string
  },
  "executive_summary": string,
  "project_overview": string,
  "scope_of_work": {
    "in_scope": [string, ...],
    "out_of_scope": [string, ...]
  },
  "deliverables": [
    {"id": "D-001", "name": string, "description": string},
    ...
  ],
  "risks": [
    {"id": "R-001", "description": string},
    ...
  ],
  "assumptions": [
    {"id": "A-001", "description": string},
    ...
  ],
  "dependencies": [
    {"id": "DEP-001", "description": string},
    ...
  ],
  "responsibilities": {
    "Client": [string, ...],
    "Invuric": [string, ...]
  },
  "timeline": {
    "phases": [
      {"phase": string, "weeks": "1-2", "deliverables": string},
      ...
    ]
  },
  "roles": [
    {"role": string, "description": string, "location": string, "hours": string},
    ...
  ],
  "change_management": string,
  "acceptance_criteria": [string, ...],
  "validity": string
}

Rules:
- Populate metadata from the questionnaire answers provided.
- Be specific, thorough, and professional. Minimum 3-5 items per list.
- Timeline phases must cover the full project. Use realistic week ranges (e.g. "1-2", "3-5").
- Do not include cost, rate, or monetary values — leave those fields as empty strings.
- Roles: include realistic BA project roles (BA, PM, Tech Lead, Developer, QA) with hours estimates.
"""

PRD_PROMPT = """You are an expert Product Manager at Invuric. Generate a complete Product Requirements Document (PRD).

Return ONLY valid JSON matching this exact schema (no extra keys, no markdown):
{
  "metadata": {
    "client_name": string,
    "project_id": string,
    "project_name": string,
    "author": string,
    "requestor": string,
    "start_date": string,
    "end_date": string
  },
  "product_overview": string,
  "goals": [
    {"goal": string, "metric": string},
    ...
  ],
  "user_personas": [
    {"name": string, "role": string, "needs": string, "pain_points": string},
    ...
  ],
  "feature_requirements": [
    {"id": "F-001", "feature": string, "description": string, "priority": "High|Medium|Low", "user_story": string},
    ...
  ],
  "non_functional_requirements": [
    {"category": string, "requirement": string},
    ...
  ],
  "user_flows": string,
  "technical_constraints": [string, ...],
  "out_of_scope": [string, ...],
  "timeline": string,
  "open_questions": [string, ...]
}

Rules:
- Populate metadata from the questionnaire answers provided.
- Be specific and thorough. Minimum 3-5 items per list.
- Feature requirements: minimum 5 features with clear user stories.
- Non-functional requirements: cover performance, security, scalability, accessibility.
"""

FRD_PROMPT = """You are an expert Business Analyst at Invuric. Generate a complete Functional Requirements Document (FRD).

Return ONLY valid JSON matching this exact schema (no extra keys, no markdown):
{
  "metadata": {
    "client_name": string,
    "project_id": string,
    "project_name": string,
    "author": string,
    "requestor": string,
    "start_date": string,
    "end_date": string
  },
  "introduction": string,
  "system_overview": string,
  "functional_requirements": [
    {
      "id": "FR-001",
      "title": string,
      "description": string,
      "priority": "High|Medium|Low",
      "acceptance_criteria": string
    },
    ...
  ],
  "business_rules": [string, ...],
  "data_requirements": string,
  "integration_requirements": [
    {"system": string, "type": string, "description": string},
    ...
  ],
  "security_requirements": [string, ...],
  "reporting_requirements": [string, ...],
  "assumptions": [string, ...],
  "glossary": {
    "term": "definition",
    ...
  }
}

Rules:
- Populate metadata from the questionnaire answers provided.
- Functional requirements: minimum 8 requirements, numbered FR-001 through FR-00N.
- Each FR must have a clear, testable acceptance criterion.
- Business rules: minimum 4 rules.
- Be specific and thorough throughout.
"""

SYSTEM_PROMPTS = {"sow": SOW_PROMPT, "prd": PRD_PROMPT, "frd": FRD_PROMPT}


async def run_doc_pipeline(doc_type: str, raw_text: str, answers: dict) -> dict:
    system_prompt = SYSTEM_PROMPTS[doc_type]

    # Extract metadata from answers
    metadata_lines = "\n".join(
        f"  {k}: {answers.get(k, '')}" for k in METADATA_KEYS
    )

    # Remaining answers (non-metadata)
    other_answers = {k: v for k, v in answers.items() if k not in METADATA_KEYS}
    answers_lines = "\n".join(f"  - {k}: {v}" for k, v in other_answers.items())

    user_content = f"""## Metadata Fields (include these verbatim in the metadata block):
{metadata_lines}

## Questionnaire Answers:
{answers_lines if answers_lines else "  (none provided)"}

## Uploaded Document Context:
{raw_text[:8000] if raw_text else "No document uploaded — generate from scratch using the information above."}

Generate the full {doc_type.upper()} now. Return valid JSON only, no markdown fences."""

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )

    import json
    return json.loads(response.choices[0].message.content)
