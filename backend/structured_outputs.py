from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    # extra="ignore" — Claude frequently emits contextual keys not in the schema.
    # "forbid" caused ValidationError on every such response; "ignore" silently drops extras.
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


class MetadataModel(StrictModel):
    client_name: str
    project_id: str
    project_name: str
    author: str
    requestor: str
    start_date: str
    end_date: str


class IdDescriptionModel(StrictModel):
    id: str
    description: str


class SOWDeliverableModel(StrictModel):
    id: str
    name: str
    description: str


class SOWScopeModel(StrictModel):
    in_scope: list[str] = Field(min_length=7)
    out_of_scope: list[str] = Field(min_length=5)


class SOWResponsibilitiesModel(StrictModel):
    Client: list[str] = Field(min_length=7)
    Invuric: list[str] = Field(min_length=7)


class SOWTimelinePhaseModel(StrictModel):
    phase: str
    weeks: str
    deliverables: str


class SOWTimelineModel(StrictModel):
    phases: list[SOWTimelinePhaseModel] = Field(min_length=5)


class SOWRoleModel(StrictModel):
    role: str
    description: str
    location: str
    hours: str


class SOWDocumentModel(StrictModel):
    metadata: MetadataModel
    executive_summary: str
    project_overview: str
    scope_of_work: SOWScopeModel
    deliverables: list[SOWDeliverableModel] = Field(min_length=6)
    risks: list[IdDescriptionModel] = Field(min_length=6)
    assumptions: list[IdDescriptionModel] = Field(min_length=6)
    dependencies: list[IdDescriptionModel] = Field(min_length=5)
    responsibilities: SOWResponsibilitiesModel
    timeline: SOWTimelineModel
    roles: list[SOWRoleModel] = Field(min_length=5)
    change_management: str
    acceptance_criteria: list[str] = Field(min_length=6)
    validity: str


class PRDGoalModel(StrictModel):
    goal: str
    metric: str
    target: str
    timeframe: str


class PRDPersonaModel(StrictModel):
    name: str
    role: str
    age_range: str
    context: str
    goals: str
    pain_points: str
    tech_proficiency: str
    success_definition: str


class PRDFeatureRequirementModel(StrictModel):
    id: str
    feature: str
    description: str
    priority: Literal["Critical", "High", "Medium", "Low"]
    user_story: str
    acceptance_criteria: str
    dependencies: str


class PRDNonFunctionalRequirementModel(StrictModel):
    category: str
    requirement: str
    metric: str


class PRDUserFlowModel(StrictModel):
    flow_name: str
    actor: str
    steps: list[str] = Field(min_length=2)
    success_outcome: str


class PRDEdgeCaseModel(StrictModel):
    scenario: str
    trigger: str
    expected_system_behavior: str
    user_communication: str


class PRDRiskModel(StrictModel):
    id: str
    risk: str
    likelihood: Literal["High", "Medium", "Low"]
    impact: Literal["High", "Medium", "Low"]
    mitigation: str


class PRDTestingStrategyModel(StrictModel):
    approach: str
    test_types: list[str] = Field(min_length=3)
    coverage_areas: list[str] = Field(min_length=3)
    vague_input_handling: str
    conflicting_requirements_handling: str


class PRDDocumentModel(StrictModel):
    metadata: MetadataModel
    product_overview: str
    problem_statement: str
    goals: list[PRDGoalModel] = Field(min_length=5)
    user_personas: list[PRDPersonaModel] = Field(min_length=3)
    feature_requirements: list[PRDFeatureRequirementModel] = Field(min_length=8)
    non_functional_requirements: list[PRDNonFunctionalRequirementModel] = Field(min_length=10)
    user_flows: list[PRDUserFlowModel] = Field(min_length=4)
    edge_cases: list[PRDEdgeCaseModel] = Field(min_length=10)
    risks: list[PRDRiskModel] = Field(min_length=5)
    technical_constraints: list[str] = Field(min_length=6)
    out_of_scope: list[str] = Field(min_length=6)
    testing_strategy: PRDTestingStrategyModel
    assumptions: list[str] = Field(min_length=1)
    timeline: str
    open_questions: list[str] = Field(min_length=5)


class FRDUseCaseModel(StrictModel):
    id: str
    name: str
    actor: str
    preconditions: list[str] = Field(min_length=1)
    main_flow: list[str] = Field(min_length=2)
    alternate_flows: list[str] = Field(min_length=1)
    postconditions: list[str] = Field(min_length=1)


class FRDFunctionalRequirementModel(StrictModel):
    id: str
    title: str
    description: str
    input: str
    process: str
    output: str
    priority: Literal["Critical", "High", "Medium", "Low"]
    acceptance_criteria: str


_BR_CATEGORY_MAP: dict[str, str] = {
    "validation": "Validation",
    "calculation": "Calculation",
    "access control": "Access Control",
    "data integrity": "Data Integrity",
    "workflow orchestration": "Workflow Orchestration",
    "workflow": "Workflow Orchestration",
    "notification": "Notification",
    "compliance": "Compliance",
    "rate limiting": "Rate Limiting",
    "rate limit": "Rate Limiting",
}
_BR_VALID = frozenset(_BR_CATEGORY_MAP.values())


class FRDBusinessRuleModel(StrictModel):
    id: str
    # Accept any string and normalise to the canonical set at validation time.
    # Claude reliably uses near-matches ("Workflow" vs "Workflow Orchestration")
    # that caused hard ValidationError failures under Literal typing.
    category: str
    rule: str
    rationale: str

    @model_validator(mode="after")
    def normalise_category(self) -> "FRDBusinessRuleModel":
        normalised = _BR_CATEGORY_MAP.get(self.category.lower().strip())
        if normalised:
            self.category = normalised
        elif self.category not in _BR_VALID:
            # Best-effort: keep what Claude gave us rather than fail the whole document
            pass
        return self


class FRDErrorHandlingModel(StrictModel):
    error_code: str
    scenario: str
    trigger_condition: str
    system_response: str
    user_message: str
    recovery_action: str


_DR_SOURCE_MAP: dict[str, str] = {
    "user input": "User input",
    "user-input": "User input",
    "user entered": "User input",
    "system generated": "System generated",
    "system-generated": "System generated",
    "auto generated": "System generated",
    "derived/calculated": "Derived/Calculated",
    "derived": "Derived/Calculated",
    "calculated": "Derived/Calculated",
    "external api": "External API",
    "api": "External API",
    "third-party": "External API",
    "file import": "File import",
    "import": "File import",
    "uploaded": "File import",
}
_DR_SOURCE_VALID = frozenset(_DR_SOURCE_MAP.values())


class FRDDataRequirementModel(StrictModel):
    entity: str
    field: str
    data_type: str
    constraints: str
    validation_rules: str
    # Accept any string and normalise — Claude uses case/wording variants
    source: str

    @model_validator(mode="after")
    def normalise_source(self) -> "FRDDataRequirementModel":
        normalised = _DR_SOURCE_MAP.get(self.source.lower().strip())
        if normalised:
            self.source = normalised
        return self


class FRDIntegrationRequirementModel(StrictModel):
    system: str
    type: str
    description: str
    protocol: str
    authentication: str
    error_handling: str


class FRDDocumentModel(StrictModel):
    metadata: MetadataModel
    introduction: str
    system_overview: str
    use_cases: list[FRDUseCaseModel] = Field(min_length=5)
    functional_requirements: list[FRDFunctionalRequirementModel] = Field(min_length=12)
    business_rules: list[FRDBusinessRuleModel] = Field(min_length=7)
    error_handling: list[FRDErrorHandlingModel] = Field(min_length=10)
    data_requirements: list[FRDDataRequirementModel] = Field(min_length=12)
    integration_requirements: list[FRDIntegrationRequirementModel] = Field(min_length=1)
    security_requirements: list[str] = Field(min_length=8)
    reporting_requirements: list[str] = Field(min_length=1)
    assumptions: list[str] = Field(min_length=1)
    glossary: dict[str, str] = Field(min_length=1)


class RaidEntryModel(StrictModel):
    id: str
    title: str
    description: str
    owner: str


class RaidRiskModel(RaidEntryModel):
    probability: Literal["High", "Medium", "Low"]
    impact: Literal["High", "Medium", "Low"]
    risk_score: Literal["Critical", "High", "Medium", "Low"]
    trigger_conditions: str
    mitigation: str
    contingency: str
    review_date: str


class RaidAssumptionModel(RaidEntryModel):
    impact_if_wrong: str
    validation_method: str
    validation_by: str


class RaidIssueModel(StrictModel):
    id: str
    title: str
    description: str
    severity: Literal["Critical", "High", "Medium", "Low"]
    impact: str
    resolution_plan: str
    resolution_owner: str
    target_resolution_date: str


class RaidDependencyModel(StrictModel):
    id: str
    title: str
    description: str
    type: Literal["Internal", "External"]
    due_date: str
    dependency_owner: str
    impact_if_delayed: str
    status: Literal["On Track", "At Risk", "Blocked"]


class RaidDocumentModel(StrictModel):
    risks: list[RaidRiskModel] = Field(min_length=8)
    assumptions: list[RaidAssumptionModel] = Field(min_length=6)
    issues: list[RaidIssueModel] = Field(min_length=4)
    dependencies: list[RaidDependencyModel] = Field(min_length=6)


class WbsSubtaskModel(StrictModel):
    id: str
    name: str
    duration: str
    assigned_to: list[Literal["PM", "Developers", "QA", "BA", "Design"]] = Field(min_length=1)


class WbsTaskModel(StrictModel):
    id: str
    name: str
    description: str
    duration: str
    assigned_to: list[Literal["PM", "Developers", "QA", "BA", "Design"]] = Field(min_length=1)
    dependencies: str
    subtasks: list[WbsSubtaskModel] = Field(min_length=1, max_length=6)


class WbsPhaseModel(StrictModel):
    id: str
    name: str
    objective: str
    exit_criteria: str
    duration: str
    tasks: list[WbsTaskModel] = Field(min_length=2, max_length=8)


class WbsDocumentModel(StrictModel):
    project_name: str
    # Claude reliably miscounts these totals when generating JSON in one shot.
    # Validated counts → guaranteed ValidationError on first attempt.
    # We now accept whatever Claude emits and auto-correct from the actual data.
    total_phases: int = 0
    total_tasks: int = 0
    total_subtasks: int = 0
    phases: list[WbsPhaseModel] = Field(min_length=3, max_length=8)

    @model_validator(mode="after")
    def auto_correct_counts(self) -> "WbsDocumentModel":
        self.total_phases = len(self.phases)
        self.total_tasks = sum(len(phase.tasks) for phase in self.phases)
        self.total_subtasks = sum(
            len(task.subtasks) for phase in self.phases for task in phase.tasks
        )
        return self


class BacklogStoryModel(StrictModel):
    page_name: str
    epic: str
    high_level_flow: str
    user_story: str
    priority: Literal["Must Have", "Should Have", "Could Have", "Won't Have"]
    story_points: int = Field(ge=1, le=13)
    acceptance_criteria: str
    data_points: str
    edge_cases: str
    non_functional: str
    dependencies: str


class BacklogDocumentModel(StrictModel):
    stories: list[BacklogStoryModel] = Field(min_length=10, max_length=15)
