from llm import complete_text

FLOW_DESCRIPTIONS = {
    "end-to-end": "Complete end-to-end process flow from system entry to final outcome, covering all major steps and actors",
    "swimlane": "Multi-actor swimlane diagram showing responsibilities and handoffs between roles, systems, or departments",
    "happy-path": "Primary success flow with no errors, exceptions, or alternative branches - the ideal user journey",
    "error-flow": "Exception handling and error recovery flow - what happens when things go wrong at each step",
    "user-journey": "User-centric journey map showing the user's experience, touchpoints, and emotional states through the process",
    "data-flow": "Data flow diagram showing how data originates, transforms, moves, and is persisted through the system",
}

STYLE_SYNTAX = {
    "flowchart": "Mermaid flowchart TD syntax - use rectangles for processes, diamonds for decisions, and rounded rectangles for start and end",
    "swimlane": "Mermaid flowchart TD with subgraph blocks representing each swimlane actor or department",
    "sequence": "Mermaid sequenceDiagram syntax - show time-ordered messages between actors and systems",
}

SYSTEM_PROMPT = """You are a Senior Business Analyst and Systems Architect specialising in process modelling and diagramming. You produce Mermaid diagrams that are immediately renderable, visually clear, and technically accurate to the process described.

DIAGRAM QUALITY RULES:
1. Return only valid Mermaid diagram code - no markdown fences, explanations, or comments outside the diagram.
2. The diagram must start with the correct Mermaid diagram type declaration on line 1.
3. All node labels must be clear, concise, and meaningful.
4. Use correct Mermaid syntax for the specified style.
5. Include decision points wherever the process branches.
6. For flowchart style, always start with `flowchart TD`.
7. For sequence style, always start with `sequenceDiagram`.
8. For swimlane style, use `flowchart TD` with `subgraph ActorName` blocks for each lane.
9. Keep the diagram under 35 nodes for readability.
10. Use descriptive IDs for maintainability.
11. Apply consistent node shapes: rounded rectangles for start and end, rectangles for processes, diamonds for decisions, and cylinders for databases.
12. Include explicit start and end nodes.
13. Include all labeled decision branches.
14. Show error paths unless the flow type explicitly limits you to the happy path.
"""


def _validate_mermaid(code: str, style: str) -> str:
    cleaned = code.strip()
    if not cleaned:
        raise ValueError("Claude returned an empty Mermaid diagram.")

    first_line = cleaned.splitlines()[0].strip()
    expected_prefix = "sequenceDiagram" if style == "sequence" else "flowchart"
    if not first_line.startswith(expected_prefix):
        raise ValueError("Claude returned Mermaid that does not match the requested diagram style.")
    return cleaned


async def run_pfd_pipeline(raw_text: str, flow_type: str, style: str) -> str:
    flow_desc = FLOW_DESCRIPTIONS.get(flow_type, flow_type)
    style_desc = STYLE_SYNTAX.get(style, style)

    user_content = f"""Generate a process flow diagram with these exact specifications:

Flow Type: {flow_desc}
Diagram Style: {style_desc}

Project or System Context:
{raw_text[:80_000] if raw_text else "Generic enterprise web application with user authentication, data management, and reporting features. Create a representative, realistic example flow."}

Requirements:
- Apply all syntax rules from your system instructions.
- Diagram must be valid Mermaid and render without errors.
- Include all major steps, actors, decision points, and outcomes for this flow type.
- Return only the raw Mermaid code - the first character must be the diagram type keyword.
- No markdown fences, explanations, or comments."""

    code = await complete_text(SYSTEM_PROMPT, user_content, temperature=0.1, max_tokens=2500)
    if code.startswith("```"):
        lines = code.split("\n")
        start = 1
        end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
        code = "\n".join(lines[start:end]).strip()

    return _validate_mermaid(code, style)
