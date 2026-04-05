from openai import AsyncOpenAI
from config import settings

client = AsyncOpenAI(api_key=settings.openai_api_key)

FLOW_DESCRIPTIONS = {
    "end-to-end": "Complete end-to-end process flow from start to finish",
    "swimlane": "Multi-actor swimlane diagram showing responsibilities",
    "happy-path": "Primary happy path flow (no errors/exceptions)",
    "error-flow": "Error handling and exception flows",
    "user-journey": "User journey map from user perspective",
    "data-flow": "Data flow showing how data moves through the system",
}

STYLE_SYNTAX = {
    "flowchart": "Mermaid flowchart syntax (flowchart TD)",
    "swimlane": "Mermaid flowchart with subgraph swimlanes",
    "sequence": "Mermaid sequence diagram syntax (sequenceDiagram)",
}

SYSTEM_PROMPT = """You are an expert Business Analyst and diagramming specialist.
Generate a Mermaid.js diagram based on the provided document and requirements.

RULES:
1. Return ONLY valid Mermaid diagram code — no markdown fences, no explanation
2. Use proper Mermaid syntax for the requested style
3. Label nodes clearly and concisely
4. Include decision points (diamonds) where applicable
5. For flowchart: start with 'flowchart TD'
6. For sequence: start with 'sequenceDiagram'
7. Maximum 30 nodes for clarity"""


async def run_pfd_pipeline(raw_text: str, flow_type: str, style: str) -> str:
    flow_desc = FLOW_DESCRIPTIONS.get(flow_type, flow_type)
    style_desc = STYLE_SYNTAX.get(style, style)

    user_content = f"""Create a process flow diagram with these specs:
Flow Type: {flow_desc}
Diagram Style: {style_desc}

Document Context:
{raw_text[:8000] if raw_text else "Generic software system — create a representative example flow."}

Return ONLY the raw Mermaid code. No explanations. No markdown fences."""

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        temperature=0.2,
    )

    code = response.choices[0].message.content.strip()
    # Strip markdown fences if model added them anyway
    if code.startswith("```"):
        lines = code.split("\n")
        code = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

    return code
