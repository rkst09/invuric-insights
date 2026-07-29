from __future__ import annotations

from datetime import datetime, timedelta, UTC


def _answer(answers: dict, key: str, fallback: str) -> str:
    value = answers.get(key)
    return str(value).strip() if value is not None and str(value).strip() else fallback


def _metadata(answers: dict) -> dict:
    today = datetime.now(UTC).date()
    default_end = today + timedelta(days=90)
    return {
        "client_name": _answer(answers, "client_name", _answer(answers, "org_name", "Client")),
        "project_id": _answer(answers, "project_id", "INV-001"),
        "project_name": _answer(answers, "project_name", "Project Initiative"),
        "author": _answer(answers, "author", "Invuric"),
        "requestor": _answer(answers, "requestor", "Project Sponsor"),
        "start_date": _answer(answers, "start_date", today.isoformat()),
        "end_date": _answer(answers, "end_date", default_end.isoformat()),
    }


def _context(raw_text: str, answers: dict) -> str:
    compact = " ".join((raw_text or "").split())[:900]
    if compact:
        return compact
    answer_text = " ".join(str(value).strip() for value in answers.values() if str(value).strip())
    return answer_text[:900] or "available business and project information"


def build_fallback_doc(doc_type: str, raw_text: str, answers: dict) -> dict:
    metadata = _metadata(answers or {})
    project = metadata["project_name"]
    client = metadata["client_name"]
    context = _context(raw_text, answers or {})

    if doc_type == "sow":
        return _sow(metadata, project, client, context)
    if doc_type == "prd":
        return _prd(metadata, project, client, context)
    if doc_type == "frd":
        return _frd(metadata, project, client, context)
    raise ValueError(f"Unsupported document type: {doc_type}")


def _sow(metadata: dict, project: str, client: str, context: str) -> dict:
    return {
        "metadata": metadata,
        "executive_summary": (
            f"Invuric will support {client} in defining and preparing {project} for controlled delivery. "
            "This Statement of Work establishes the delivery scope, expected outputs, governance model, "
            "responsibilities, assumptions, dependencies, and acceptance criteria required to progress the engagement."
        ),
        "project_overview": (
            f"The current project context is summarised as: {context}. The engagement will convert the available "
            "business context into clear delivery artefacts, stakeholder decisions, and implementation-ready guidance."
        ),
        "scope_of_work": {
            "in_scope": [
                "Review uploaded source material, questionnaire responses, and stakeholder objectives.",
                "Define the delivery scope, business outcomes, constraints, and approval expectations.",
                "Document in-scope and out-of-scope activities for stakeholder sign-off.",
                "Prepare Invuric-format business analysis artefacts requested for the engagement.",
                "Identify requirements, assumptions, risks, dependencies, and open clarification points.",
                "Define milestones, deliverables, roles, responsibilities, and acceptance criteria.",
                "Provide final downloadable artefacts suitable for review, planning, and handover.",
            ],
            "out_of_scope": [
                "Implementation work not approved in the final delivery baseline.",
                "Third-party procurement, licensing, legal review, or vendor negotiation.",
                "Production operations or support beyond the agreed handover window.",
                "Major scope changes after approval without formal change control.",
                "Client-owned data cleansing, access provisioning, or stakeholder availability management.",
            ],
        },
        "deliverables": [
            {"id": "D-001", "name": "Discovery Summary", "description": "Documented objectives, source context, stakeholder considerations, constraints, and open questions."},
            {"id": "D-002", "name": "Scope Baseline", "description": "Approved in-scope and out-of-scope boundaries with assumptions and dependencies."},
            {"id": "D-003", "name": "Requirements Pack", "description": "Structured requirements artefacts prepared in Invuric format for review and delivery planning."},
            {"id": "D-004", "name": "Delivery Plan", "description": "Milestones, roles, responsibilities, governance checkpoints, and handover expectations."},
            {"id": "D-005", "name": "RAID Summary", "description": "Risks, assumptions, issues, and dependencies requiring monitoring during execution."},
            {"id": "D-006", "name": "Final Handover Pack", "description": "Final artefacts, approval notes, residual actions, and recommended next steps."},
        ],
        "risks": [
            {"id": "R-001", "description": "Incomplete or outdated source material may require further stakeholder clarification."},
            {"id": "R-002", "description": "Delayed stakeholder review may extend approval timelines and downstream planning."},
            {"id": "R-003", "description": "Unconfirmed technical dependencies may affect solution feasibility or estimates."},
            {"id": "R-004", "description": "Late scope changes may require revised effort, timeline, and commercial review."},
            {"id": "R-005", "description": "Ambiguous acceptance criteria may lead to rework during validation."},
            {"id": "R-006", "description": "Client-side access, data, or environment readiness gaps may delay delivery."},
        ],
        "assumptions": [
            {"id": "A-001", "description": "Uploaded source material reflects the current business priority and expected scope."},
            {"id": "A-002", "description": "Client stakeholders will provide timely, consolidated feedback."},
            {"id": "A-003", "description": "Technical, compliance, and operational constraints will be disclosed before approval."},
            {"id": "A-004", "description": "Invuric standard format is acceptable for draft and final document outputs."},
            {"id": "A-005", "description": "Required systems, data, APIs, and environments will be made available when needed."},
            {"id": "A-006", "description": "Final artefacts will be reviewed by the client before formal approval or execution."},
        ],
        "dependencies": [
            {"id": "DEP-001", "description": "Named sponsor and approval stakeholders must be confirmed."},
            {"id": "DEP-002", "description": "Required source documents and project answers must be available and accurate."},
            {"id": "DEP-003", "description": "Technical owners must confirm integration, environment, and security assumptions."},
            {"id": "DEP-004", "description": "Client review windows must be protected in the delivery calendar."},
            {"id": "DEP-005", "description": "Open decisions must be resolved or accepted as residual actions before sign-off."},
        ],
        "responsibilities": {
            "Client": [
                "Provide accurate source documents, business context, and stakeholder contacts.",
                "Nominate a sponsor empowered to approve scope, priorities, and final artefacts.",
                "Review draft outputs within the agreed review window.",
                "Provide consolidated feedback and resolve conflicting stakeholder inputs.",
                "Confirm system access, environment details, data availability, and operational constraints.",
                "Disclose legal, compliance, branding, security, or procurement constraints.",
                "Accept final deliverables in writing or provide specific remediation feedback.",
            ],
            "Invuric": [
                "Review supplied material and prepare structured business analysis artefacts.",
                "Translate available context into Invuric-format SOW, PRD, and FRD outputs where requested.",
                "Highlight assumptions, dependencies, risks, and open questions.",
                "Maintain professional formatting, clear language, and delivery-ready structure.",
                "Apply agreed feedback during the revision cycle.",
                "Provide final document outputs and handover notes.",
                "Escalate unresolved decisions that may affect scope, timeline, or acceptance.",
            ],
        },
        "timeline": {
            "phases": [
                {"phase": "Discovery and Intake", "weeks": "Week 1", "deliverables": "Discovery summary and open question log"},
                {"phase": "Requirements Baseline", "weeks": "Week 1-2", "deliverables": "Scope and requirements baseline"},
                {"phase": "Planning and Governance", "weeks": "Week 2", "deliverables": "Delivery plan, milestones, and RAID summary"},
                {"phase": "Review and Refinement", "weeks": "Week 2-3", "deliverables": "Updated artefacts and feedback disposition"},
                {"phase": "Approval and Handover", "weeks": "Week 3", "deliverables": "Final Invuric-format document pack"},
            ]
        },
        "roles": [
            {"role": "Project Sponsor", "description": "Approves scope, priorities, and final artefacts.", "location": "Client / Remote", "hours": "As required"},
            {"role": "Business Analyst", "description": "Owns requirements analysis, documentation, and stakeholder clarification.", "location": "Remote", "hours": "Part-time"},
            {"role": "Project Manager", "description": "Coordinates plan, actions, dependencies, and approvals.", "location": "Remote", "hours": "Part-time"},
            {"role": "Solution Architect", "description": "Reviews technical assumptions and solution feasibility.", "location": "Remote", "hours": "As required"},
            {"role": "QA Lead", "description": "Validates acceptance criteria, edge cases, and handover readiness.", "location": "Remote", "hours": "As required"},
        ],
        "change_management": "Changes to approved scope, timeline, deliverables, or assumptions require written impact assessment and approval before execution.",
        "acceptance_criteria": [
            "Deliverables use Invuric standard format unless a client template is selected.",
            "Scope, assumptions, dependencies, and risks are clearly documented.",
            "Requirements are specific enough to support planning and implementation.",
            "Open questions and unresolved decisions are clearly marked.",
            "Agreed feedback has been incorporated or logged as residual action.",
            "Final artefacts are available for download and sponsor review.",
        ],
        "validity": "This SOW remains valid for 30 days from issue unless superseded by a revised agreement.",
    }


def _prd(metadata: dict, project: str, client: str, context: str) -> dict:
    features = [
        ("F-001", "Project Intake and Setup", "Capture project profile, business objectives, stakeholders, and operating constraints.", "Critical"),
        ("F-002", "User and Role Management", "Define core user groups, responsibilities, access expectations, and usage boundaries.", "High"),
        ("F-003", "Workflow Management", "Support the primary business workflow from intake through review, approval, and completion.", "Critical"),
        ("F-004", "Data Capture and Validation", "Collect required business data with validation, completeness checks, and error guidance.", "Critical"),
        ("F-005", "Dashboard and Status Tracking", "Provide visibility into work status, ownership, blockers, and upcoming actions.", "High"),
        ("F-006", "Notifications and Reminders", "Notify relevant stakeholders about actions, approvals, exceptions, and due dates.", "Medium"),
        ("F-007", "Reporting and Export", "Produce downloadable reports and operational summaries for stakeholders.", "High"),
        ("F-008", "Audit Trail and History", "Maintain traceability of key actions, decisions, status changes, and generated outputs.", "High"),
    ]
    return {
        "metadata": metadata,
        "product_overview": (
            f"{project} is intended to help {client} improve consistency, visibility, and control across the target "
            f"business process. The available context is: {context}."
        ),
        "problem_statement": (
            "Current stakeholders need a clearer, faster, and more reliable way to capture requirements, manage workflow, "
            "track decisions, and produce review-ready outputs without relying on fragmented manual processes."
        ),
        "goals": [
            {"goal": "Improve process clarity", "metric": "Documented workflow coverage", "target": "Core workflow mapped and approved", "timeframe": "Initial release"},
            {"goal": "Reduce manual coordination", "metric": "Manual follow-up effort", "target": "Material reduction in repetitive follow-ups", "timeframe": "First 90 days"},
            {"goal": "Increase decision traceability", "metric": "Tracked decisions and status changes", "target": "All key changes captured", "timeframe": "Every workflow"},
            {"goal": "Improve stakeholder visibility", "metric": "Dashboard and report adoption", "target": "Primary users can self-serve status", "timeframe": "Post launch"},
            {"goal": "Support controlled delivery", "metric": "Requirements accepted by delivery and QA", "target": "Requirements are testable and prioritised", "timeframe": "Before build"},
        ],
        "user_personas": [
            {"name": "Business User", "role": "Primary Operator", "age_range": "25-55", "context": "Uses the solution to complete daily process activities.", "goals": "Finish tasks quickly with fewer errors.", "pain_points": "Manual tracking, unclear status, and duplicate data entry.", "tech_proficiency": "Intermediate", "success_definition": "Work can be completed accurately without unnecessary follow-up."},
            {"name": "Team Lead", "role": "Reviewer and Approver", "age_range": "30-60", "context": "Reviews submissions, resolves exceptions, and approves outcomes.", "goals": "See priorities, blockers, and approval queues clearly.", "pain_points": "Missing context and inconsistent approval evidence.", "tech_proficiency": "Intermediate", "success_definition": "Approvals are timely, auditable, and informed."},
            {"name": "Executive Sponsor", "role": "Business Owner", "age_range": "35-65", "context": "Needs visibility into value, risk, and delivery readiness.", "goals": "Confirm business benefits and operating control.", "pain_points": "Limited reporting and unclear accountability.", "tech_proficiency": "Basic to Intermediate", "success_definition": "Can understand progress and approve next steps confidently."},
        ],
        "feature_requirements": [
            {
                "id": fid,
                "feature": feature,
                "description": description,
                "priority": priority,
                "user_story": f"As a stakeholder, I want {feature.lower()} so that {description.lower()}",
                "acceptance_criteria": f"Given valid project context, when {feature.lower()} is used, then the expected information is captured, validated, visible, and auditable.",
                "dependencies": "Approved workflow, confirmed data fields, role definitions, and stakeholder review.",
            }
            for fid, feature, description, priority in features
        ],
        "non_functional_requirements": [
            {"category": "Performance", "requirement": "Primary screens and actions should respond quickly under normal usage.", "metric": "Target P95 response under 3 seconds for common actions."},
            {"category": "Availability", "requirement": "The solution should be available during agreed business hours.", "metric": "Availability target to be confirmed with operations."},
            {"category": "Security", "requirement": "Sensitive information must be protected in transit and at rest.", "metric": "TLS required and storage controls applied."},
            {"category": "Usability", "requirement": "Users should understand required actions without specialist training.", "metric": "Clear labels, validation messages, and guided flows."},
            {"category": "Accessibility", "requirement": "Core workflows should support accessible interaction patterns.", "metric": "Keyboard access and readable contrast for primary actions."},
            {"category": "Scalability", "requirement": "The solution should support expected user and record growth.", "metric": "Capacity assumptions confirmed before release."},
            {"category": "Maintainability", "requirement": "Configuration and business rules should be maintainable without broad code changes where feasible.", "metric": "Documented rule ownership and change process."},
            {"category": "Auditability", "requirement": "Important actions and decisions must be traceable.", "metric": "Actor, timestamp, action, and outcome recorded."},
            {"category": "Reliability", "requirement": "Failures should be recoverable without data loss.", "metric": "Clear retry and recovery paths for key operations."},
            {"category": "Compatibility", "requirement": "Exports and generated documents should use agreed formats.", "metric": "DOCX/XLSX/PDF support as configured."},
        ],
        "user_flows": [
            {"flow_name": "Create Request", "actor": "Business User", "steps": ["Open the intake form", "Enter required details", "Attach supporting information", "Submit for validation"], "success_outcome": "A complete request is created and routed."},
            {"flow_name": "Review and Approve", "actor": "Team Lead", "steps": ["Open review queue", "Check request details", "Approve or request changes", "Capture decision notes"], "success_outcome": "Decision is recorded and next action is triggered."},
            {"flow_name": "Monitor Work", "actor": "Project Manager", "steps": ["Open dashboard", "Filter by status or owner", "Review blockers", "Escalate overdue items"], "success_outcome": "Risks and delays are visible."},
            {"flow_name": "Export Summary", "actor": "Executive Sponsor", "steps": ["Select reporting view", "Choose date range", "Generate export", "Review summary"], "success_outcome": "Stakeholders receive a consistent report."},
        ],
        "edge_cases": [
            {"scenario": "Required data missing", "trigger": "User submits incomplete form", "expected_system_behavior": "Block submission and identify missing fields.", "user_communication": "Show field-level validation guidance."},
            {"scenario": "Duplicate request", "trigger": "Similar record already exists", "expected_system_behavior": "Warn user and offer review path.", "user_communication": "Potential duplicate found."},
            {"scenario": "Approver unavailable", "trigger": "Approval remains overdue", "expected_system_behavior": "Escalate according to configured rules.", "user_communication": "Approval is overdue and has been escalated."},
            {"scenario": "Attachment unavailable", "trigger": "File cannot be opened or processed", "expected_system_behavior": "Keep request draft and show retry option.", "user_communication": "Attachment could not be processed."},
            {"scenario": "Conflicting stakeholder input", "trigger": "Two requirements contradict each other", "expected_system_behavior": "Flag conflict for decision.", "user_communication": "Clarification required before approval."},
            {"scenario": "Integration timeout", "trigger": "External system does not respond", "expected_system_behavior": "Retry safely and preserve current state.", "user_communication": "External service is temporarily unavailable."},
            {"scenario": "Permission mismatch", "trigger": "User opens restricted record", "expected_system_behavior": "Deny access and log attempt.", "user_communication": "You do not have access to this record."},
            {"scenario": "Report has no data", "trigger": "Selected filters return no records", "expected_system_behavior": "Show empty state with filter guidance.", "user_communication": "No records match the selected filters."},
            {"scenario": "Late scope change", "trigger": "New requirement added after approval", "expected_system_behavior": "Route through change control.", "user_communication": "Change request required."},
            {"scenario": "System recovery", "trigger": "Generation or processing resumes after interruption", "expected_system_behavior": "Continue from recorded state where possible.", "user_communication": "Processing has resumed."},
        ],
        "risks": [
            {"id": "R-001", "risk": "Stakeholders may not agree on final scope.", "likelihood": "Medium", "impact": "High", "mitigation": "Run structured review and decision workshops."},
            {"id": "R-002", "risk": "Source material may be incomplete or outdated.", "likelihood": "Medium", "impact": "Medium", "mitigation": "Validate assumptions and open questions before build."},
            {"id": "R-003", "risk": "Integration details may be confirmed late.", "likelihood": "Medium", "impact": "High", "mitigation": "Identify technical owners and review early."},
            {"id": "R-004", "risk": "Users may resist workflow changes.", "likelihood": "Medium", "impact": "Medium", "mitigation": "Include training, communication, and phased rollout."},
            {"id": "R-005", "risk": "Non-functional expectations may remain implicit.", "likelihood": "Medium", "impact": "High", "mitigation": "Approve performance, security, and reporting criteria before release."},
        ],
        "technical_constraints": [
            "Existing systems, integrations, and access controls must be confirmed before solution design.",
            "Data retention and privacy requirements must align with client policy.",
            "Supported document and export formats must be agreed before go-live.",
            "Role-based access requirements must be mapped to operational responsibilities.",
            "Reporting accuracy depends on reliable source data and agreed definitions.",
            "Final delivery timeline depends on stakeholder availability and environment readiness.",
        ],
        "out_of_scope": [
            "Legal approval of contract terms.",
            "Procurement or licensing decisions.",
            "Production support outside the agreed handover model.",
            "Unapproved integrations or major workflow redesign.",
            "Historical data cleansing unless specifically agreed.",
            "Authentication redesign unless separately requested.",
        ],
        "testing_strategy": {
            "approach": "Risk-based testing focused on core workflows, validation, permissions, reporting, and recovery.",
            "test_types": ["functional testing", "integration testing", "user acceptance testing", "regression testing"],
            "coverage_areas": ["intake", "approval", "dashboard", "reporting", "permissions", "exports"],
            "vague_input_handling": "Capture unclear items as open questions and avoid implementation until clarified.",
            "conflicting_requirements_handling": "Escalate conflicts to the sponsor for decision and update the baseline.",
        },
        "assumptions": ["Stakeholders will review and validate generated requirements.", "Source documents represent the current intended process."],
        "timeline": "A phased delivery timeline should be confirmed after scope, integrations, and approval responsibilities are validated.",
        "open_questions": [
            "Who is the final business approver?",
            "Which systems must be integrated in phase one?",
            "What reporting metrics are mandatory at launch?",
            "What security or compliance controls are non-negotiable?",
            "What volume, performance, and availability targets should be applied?",
        ],
    }


def _frd(metadata: dict, project: str, client: str, context: str) -> dict:
    titles = [
        "Create project record", "Capture business request details", "Validate mandatory fields",
        "Upload supporting documents", "Route request for review", "Approve or reject request",
        "Track workflow status", "Manage comments and decisions", "Send stakeholder notifications",
        "Generate operational reports", "Export approved artefacts", "Maintain audit history",
    ]
    return {
        "metadata": metadata,
        "introduction": f"This Functional Requirements Document defines the expected functional behaviour for {project} for {client}. Context: {context}.",
        "system_overview": "The solution will support structured intake, data validation, workflow routing, review, approval, reporting, export, and auditability for the agreed business process.",
        "use_cases": [
            {"id": "UC-001", "name": "Submit business request", "actor": "Business User", "preconditions": ["User has access to the intake flow"], "main_flow": ["Enter required details", "Attach support material", "Submit request"], "alternate_flows": ["Validation errors require correction before submission"], "postconditions": ["Request is stored and routed"]},
            {"id": "UC-002", "name": "Review request", "actor": "Reviewer", "preconditions": ["Request is awaiting review"], "main_flow": ["Open review queue", "Inspect details", "Add comments", "Approve or request changes"], "alternate_flows": ["Reviewer escalates unclear items"], "postconditions": ["Decision is recorded"]},
            {"id": "UC-003", "name": "Monitor status", "actor": "Project Manager", "preconditions": ["Workflow records exist"], "main_flow": ["Open dashboard", "Filter records", "Review blockers", "Escalate overdue items"], "alternate_flows": ["No matching records shows an empty state"], "postconditions": ["Status is visible"]},
            {"id": "UC-004", "name": "Generate report", "actor": "Team Lead", "preconditions": ["Reportable data exists"], "main_flow": ["Select report type", "Choose filters", "Generate report", "Download output"], "alternate_flows": ["No data returns empty report guidance"], "postconditions": ["Report is available"]},
            {"id": "UC-005", "name": "Audit decision history", "actor": "Administrator", "preconditions": ["Record has history"], "main_flow": ["Open record", "View audit history", "Review actor and timestamp", "Export if required"], "alternate_flows": ["Restricted history is hidden"], "postconditions": ["Decision trace is available"]},
        ],
        "functional_requirements": [
            {
                "id": f"FR-{index:03}",
                "title": title,
                "description": f"The system shall {title.lower()} as part of the {project} operating workflow.",
                "input": "User action, project metadata, workflow state, and required business data.",
                "process": "Validate the request, apply business rules, update workflow state, and record the outcome.",
                "output": "Updated record, visible status, audit entry, and relevant notification or export.",
                "priority": "Critical" if index <= 6 else "High",
                "acceptance_criteria": f"Given valid inputs, when the user performs {title.lower()}, then the system completes the action and records the result.",
            }
            for index, title in enumerate(titles, start=1)
        ],
        "business_rules": [
            {"id": "BR-001", "category": "Validation", "rule": "Mandatory fields must be completed before submission.", "rationale": "Prevents incomplete records."},
            {"id": "BR-002", "category": "Workflow Orchestration", "rule": "Submitted requests must move to the appropriate review queue.", "rationale": "Ensures accountability."},
            {"id": "BR-003", "category": "Access Control", "rule": "Users may only access records permitted by their role.", "rationale": "Protects sensitive information."},
            {"id": "BR-004", "category": "Data Integrity", "rule": "Status changes must be recorded with actor and timestamp.", "rationale": "Maintains auditability."},
            {"id": "BR-005", "category": "Notification", "rule": "Stakeholders must be notified when their action is required.", "rationale": "Reduces process delay."},
            {"id": "BR-006", "category": "Compliance", "rule": "Generated reports must reflect approved data definitions.", "rationale": "Maintains consistent reporting."},
            {"id": "BR-007", "category": "Rate Limiting", "rule": "Repeated processing attempts should be controlled to protect service stability.", "rationale": "Avoids accidental overload."},
        ],
        "error_handling": [
            {"error_code": f"ERR-{index:03}", "scenario": scenario, "trigger_condition": trigger, "system_response": response, "user_message": message, "recovery_action": action}
            for index, (scenario, trigger, response, message, action) in enumerate([
                ("Missing mandatory field", "User submits incomplete data", "Block submission and highlight fields", "Please complete the required fields.", "User corrects input"),
                ("Invalid file type", "Unsupported attachment uploaded", "Reject attachment", "This file type is not supported.", "Upload supported file"),
                ("Duplicate record", "Matching request detected", "Warn user and show match", "A similar request may already exist.", "Review duplicate"),
                ("Permission denied", "User accesses restricted record", "Deny access and log event", "You do not have permission.", "Request access"),
                ("Approval overdue", "Review SLA exceeded", "Escalate to owner", "Approval is overdue.", "Reviewer acts or delegates"),
                ("Integration unavailable", "External service fails", "Retry and preserve state", "External service unavailable.", "Retry later"),
                ("Report empty", "Filters return no records", "Show empty state", "No data matched your filters.", "Adjust filters"),
                ("Export failure", "File generation fails", "Show retry option", "Export could not be created.", "Retry export"),
                ("Conflicting update", "Record changed during edit", "Require refresh", "This record was updated.", "Refresh and reapply changes"),
                ("Unexpected service error", "Unhandled exception", "Log error and show safe message", "Something went wrong.", "Contact support or retry"),
            ], start=1)
        ],
        "data_requirements": [
            {"entity": "Project", "field": "project_id", "data_type": "String", "constraints": "Required, unique", "validation_rules": "Must not be blank", "source": "System generated"},
            {"entity": "Project", "field": "project_name", "data_type": "String", "constraints": "Required", "validation_rules": "Minimum descriptive name required", "source": "User input"},
            {"entity": "Stakeholder", "field": "name", "data_type": "String", "constraints": "Required for approvers", "validation_rules": "Must identify owner or reviewer", "source": "User input"},
            {"entity": "Stakeholder", "field": "role", "data_type": "String", "constraints": "Required", "validation_rules": "Must map to permitted role", "source": "User input"},
            {"entity": "Request", "field": "status", "data_type": "Enum", "constraints": "Required", "validation_rules": "Must follow approved lifecycle", "source": "System generated"},
            {"entity": "Request", "field": "priority", "data_type": "Enum", "constraints": "Required", "validation_rules": "Critical, High, Medium, or Low", "source": "User input"},
            {"entity": "Request", "field": "description", "data_type": "Text", "constraints": "Required", "validation_rules": "Must describe business need", "source": "User input"},
            {"entity": "Attachment", "field": "file_type", "data_type": "String", "constraints": "Supported formats only", "validation_rules": "Allowed extension and MIME type", "source": "File import"},
            {"entity": "Decision", "field": "outcome", "data_type": "Enum", "constraints": "Required", "validation_rules": "Approved, rejected, or changes requested", "source": "User input"},
            {"entity": "Decision", "field": "timestamp", "data_type": "DateTime", "constraints": "Required", "validation_rules": "System generated at action time", "source": "System generated"},
            {"entity": "Report", "field": "date_range", "data_type": "DateRange", "constraints": "Optional", "validation_rules": "Start date must be before end date", "source": "User input"},
            {"entity": "Audit", "field": "change_summary", "data_type": "Text", "constraints": "Required for state changes", "validation_rules": "Automatically captured", "source": "Derived/Calculated"},
        ],
        "integration_requirements": [
            {"system": "Client Source Systems", "type": "Data Integration", "description": "Exchange approved records, reference data, or status updates where required.", "protocol": "HTTPS API or secure file transfer", "authentication": "To be confirmed with client security owner", "error_handling": "Retry transient failures and log unrecoverable errors."}
        ],
        "security_requirements": [
            "All sensitive data must be protected in transit.",
            "Role-based access must restrict records and actions.",
            "Administrative functions must be limited to authorised users.",
            "Audit history must record significant actions and decisions.",
            "Generated exports must not expose unauthorised data.",
            "Errors must not reveal secrets, credentials, or internal implementation details.",
            "Data retention must align with client policy.",
            "Access reviews should be performed before production release.",
        ],
        "reporting_requirements": [
            "The system must report request volume, status, ageing, ownership, overdue actions, approval outcomes, and exception trends."
        ],
        "assumptions": [
            "Client stakeholders will validate workflow, data, roles, and reporting definitions before build.",
            "Generated requirements remain draft until reviewed and approved by the client sponsor.",
        ],
        "glossary": {
            "SOW": "Statement of Work",
            "PRD": "Product Requirements Document",
            "FRD": "Functional Requirements Document",
            "Workflow": "A controlled sequence of business actions from intake to completion",
            "Audit Trail": "A record of actor, timestamp, action, and outcome for traceability",
        },
    }
