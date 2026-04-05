from openai import AsyncOpenAI
from config import settings

client = AsyncOpenAI(api_key=settings.openai_api_key)

SYSTEM_PROMPTS = {
    "sow": """You are an expert Business Analyst. Generate a complete, professional Statement of Work (SOW) document.
Structure it with these sections:
1. Executive Summary
2. Project Overview & Background
3. Scope of Work
4. Deliverables
5. Timeline & Milestones
6. Assumptions & Constraints
7. Acceptance Criteria
8. Pricing & Payment Terms
9. Change Management Process
10. Sign-off

Use the provided document context and questionnaire answers. Be specific, professional, and thorough.
Return the document as structured JSON with keys matching section names.""",

    "prd": """You are an expert Product Manager. Generate a complete Product Requirements Document (PRD).
Structure it with these sections:
1. Product Overview
2. Goals & Success Metrics
3. User Personas
4. Feature Requirements (functional)
5. Non-Functional Requirements
6. User Flows
7. Technical Constraints
8. Out of Scope
9. Timeline
10. Open Questions

Use the provided context and answers. Return as structured JSON with section keys.""",

    "frd": """You are an expert Business Analyst. Generate a complete Functional Requirements Document (FRD).
Structure it with these sections:
1. Introduction & Purpose
2. System Overview
3. Functional Requirements (numbered FR-001, FR-002...)
4. Business Rules
5. Data Requirements
6. Integration Requirements
7. Security Requirements
8. Reporting Requirements
9. Assumptions
10. Glossary

Each functional requirement must have: ID, Title, Description, Priority (High/Medium/Low), Acceptance Criteria.
Return as structured JSON with section keys.""",
}


async def run_doc_pipeline(doc_type: str, raw_text: str, answers: dict) -> dict:
    system_prompt = SYSTEM_PROMPTS[doc_type]

    user_content = f"""## Uploaded Document Context:
{raw_text[:8000] if raw_text else "No document uploaded — generate from scratch using the answers below."}

## Questionnaire Answers:
{_format_answers(answers)}

Generate the full {doc_type.upper()} document now. Return valid JSON only."""

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


def _format_answers(answers: dict) -> str:
    return "\n".join(f"- {k}: {v}" for k, v in answers.items())
