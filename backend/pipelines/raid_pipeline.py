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


def _context_label(raw_text: str) -> str:
    words = " ".join((raw_text or "").split())[:500]
    return words or "the uploaded project"


def build_fallback_raid(raw_text: str) -> dict:
    """Create a valid starter RAID when the LLM is unavailable or too slow."""
    context = _context_label(raw_text)
    return {
        "risks": [
            {
                "id": f"R{i:03}",
                "title": title,
                "description": f"{title} may affect delivery for {context}.",
                "probability": probability,
                "impact": impact,
                "risk_score": score,
                "trigger_conditions": trigger,
                "mitigation": mitigation,
                "contingency": contingency,
                "owner": owner,
                "review_date": "Weekly until closure",
            }
            for i, (title, probability, impact, score, trigger, mitigation, contingency, owner) in enumerate([
                ("Scope ambiguity", "Medium", "High", "High", "Requirements remain open or contradictory", "Run a scope confirmation workshop and document decisions", "Escalate unresolved scope items to the sponsor", "Project Manager"),
                ("Stakeholder availability", "Medium", "High", "High", "Review meetings are delayed or unattended", "Book recurring decision forums with named delegates", "Use sponsor escalation for missed approvals", "Business Analyst"),
                ("Integration dependency delay", "Medium", "High", "High", "External API, data, or system access is not available", "Confirm access owners and test connectivity early", "Use mock data while dependency is restored", "Technical Lead"),
                ("Data quality gaps", "Medium", "Medium", "Medium", "Uploaded source material is incomplete or inconsistent", "Validate source documents before generation", "Request corrected source data and regenerate outputs", "Business Analyst"),
                ("Approval cycle slippage", "Medium", "Medium", "Medium", "Sign-off dates are missed", "Agree approval SLA and decision owners", "Re-plan affected milestones with sponsor approval", "Project Manager"),
                ("Environment or tooling issue", "Low", "High", "Medium", "Generation, storage, or deployment tooling is unavailable", "Monitor health checks and keep rollback steps ready", "Switch to manual template generation temporarily", "Engineering Lead"),
                ("Non-functional requirements missed", "Medium", "Medium", "Medium", "Performance, security, or compliance expectations are unclear", "Add NFR review to requirements baseline", "Create remediation backlog for missed NFRs", "Solution Architect"),
                ("Change request volume", "Medium", "Medium", "Medium", "New requests arrive after baseline sign-off", "Use formal change control with impact assessment", "Defer non-critical changes to a later phase", "Product Owner"),
            ], start=1)
        ],
        "assumptions": [
            {
                "id": f"A{i:03}",
                "title": title,
                "description": description,
                "impact_if_wrong": impact,
                "validation_method": validation,
                "validation_by": "Next project checkpoint",
                "owner": owner,
            }
            for i, (title, description, impact, validation, owner) in enumerate([
                ("Source documents are representative", "Uploaded documents reflect the current project scope.", "Generated RAID may miss current constraints.", "Confirm source pack with project owner.", "Business Analyst"),
                ("Decision makers are available", "Named stakeholders can review and approve outputs.", "Approval delays may affect delivery dates.", "Confirm stakeholder roster and alternates.", "Project Manager"),
                ("Technical dependencies can be accessed", "Required systems, APIs, and data sources can be reached.", "Integration risks may increase.", "Run access and connectivity checks.", "Technical Lead"),
                ("Scope baseline is acceptable", "The current scope can be used for planning.", "Rework may be needed if scope changes materially.", "Confirm baseline scope in writing.", "Product Owner"),
                ("Operational support is defined", "Owners exist for post-generation review and action tracking.", "RAID actions may remain unowned.", "Assign owners in the first RAID review.", "Project Manager"),
                ("Security and compliance needs are known", "Major compliance constraints have been disclosed.", "Late compliance findings may cause redesign.", "Validate with compliance/security contact.", "Solution Architect"),
            ], start=1)
        ],
        "issues": [
            {
                "id": f"I{i:03}",
                "title": title,
                "description": description,
                "severity": severity,
                "impact": impact,
                "resolution_plan": resolution,
                "resolution_owner": owner,
                "target_resolution_date": "Next review cycle",
            }
            for i, (title, description, severity, impact, resolution, owner) in enumerate([
                ("AI generation fallback used", "The primary AI RAID generation did not complete in time.", "Medium", "Output should be reviewed before client use.", "Review and refine fallback RAID entries manually.", "Business Analyst"),
                ("Document completeness unknown", "The uploaded document set may not include all project artefacts.", "Medium", "Some risks or dependencies may be missing.", "Collect missing artefacts and regenerate if needed.", "Project Manager"),
                ("Ownership validation pending", "Owners listed in the RAID need confirmation.", "Low", "Actions may not progress until ownership is confirmed.", "Validate owners during RAID review.", "Project Manager"),
                ("Dates require confirmation", "Fallback due dates and review dates are generic.", "Low", "Tracking precision is reduced.", "Replace generic dates with project-specific dates.", "Business Analyst"),
            ], start=1)
        ],
        "dependencies": [
            {
                "id": f"D{i:03}",
                "title": title,
                "description": description,
                "type": dep_type,
                "due_date": "Confirm during planning",
                "dependency_owner": owner,
                "impact_if_delayed": impact,
                "status": status,
            }
            for i, (title, description, dep_type, owner, impact, status) in enumerate([
                ("Stakeholder sign-off", "Business stakeholders must approve generated outputs.", "Internal", "Project Sponsor", "Document acceptance and downstream work may be delayed.", "At Risk"),
                ("Source document availability", "Complete project source material must be available.", "Internal", "Business Analyst", "Generated content may be incomplete.", "At Risk"),
                ("Technical access", "Required systems, data, or APIs must be accessible.", "External", "Technical Lead", "Integration analysis may be blocked.", "At Risk"),
                ("Delivery team capacity", "Assigned team members must be available for review and action closure.", "Internal", "Project Manager", "RAID mitigations may not progress.", "On Track"),
                ("Compliance/security review", "Security or compliance stakeholders must review relevant risks.", "Internal", "Compliance Lead", "Late findings could cause rework.", "At Risk"),
                ("Client feedback cycle", "Client feedback must be provided within the agreed review window.", "External", "Client Owner", "Final outputs may be delayed.", "At Risk"),
            ], start=1)
        ],
    }


async def run_raid_pipeline(raw_text: str) -> dict:
    doc_context = (
        raw_text[:30_000]
        if raw_text
        else "No document provided - generate a comprehensive RAID register for a typical enterprise software delivery project, inferring domain-specific risks from the project context described in the questionnaire."
    )

    user_content = f"""Analyse this project document and extract a comprehensive RAID register specific to this project's domain, technology, and organisational context:

{doc_context}

Return exactly:
- 8 risks
- 6 assumptions
- 4 issues
- 6 dependencies

Apply all rules from your system instructions. Every item must be specific to this project. Return valid JSON only - no markdown, no commentary."""

    return await complete_json(
        SYSTEM_PROMPT,
        user_content,
        schema=RaidDocumentModel,
        temperature=0.15,
        max_tokens=7000,
    )
