from openai import AsyncOpenAI
from config import settings
import json

client = AsyncOpenAI(api_key=settings.openai_api_key)

SYSTEM_PROMPT = """You are an expert Business Analyst specializing in risk management.
Analyze the provided document and extract a comprehensive RAID register.

Return a JSON object with exactly these keys:
{
  "risks": [{"id": "R001", "title": "", "description": "", "probability": "High|Medium|Low", "impact": "High|Medium|Low", "mitigation": "", "owner": ""}],
  "assumptions": [{"id": "A001", "title": "", "description": "", "impact_if_wrong": "", "validation_method": ""}],
  "issues": [{"id": "I001", "title": "", "description": "", "severity": "Critical|High|Medium|Low", "resolution": "", "owner": ""}],
  "dependencies": [{"id": "D001", "title": "", "description": "", "type": "Internal|External", "due_date": "", "owner": ""}]
}

Extract at minimum: 5 risks, 4 assumptions, 2 issues, 4 dependencies. Be specific and actionable."""


async def run_raid_pipeline(raw_text: str) -> dict:
    user_content = f"""Analyze this document and extract the RAID register:

{raw_text[:10000] if raw_text else "No document provided. Generate a generic software project RAID register."}

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
