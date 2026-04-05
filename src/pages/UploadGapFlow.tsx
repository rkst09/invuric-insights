import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  X,
  FileText,
  Check,
  Star,
  Zap,
  Filter,
  Sparkles,
  AlertCircle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type AnswerState = "autofilled" | "needs-input" | "optional";

type AnswerEntry = {
  value: string;
  state: AnswerState;
  edited: boolean;
};

type Question = {
  id: string;
  label: string;
  helper: string;
  placeholder: string;
};

type Section = {
  id: string;
  number: string;
  title: string;
  short: string;
  questions: Question[];
  builderType?: "feature-builder";
};

type FeatureCard = {
  id: string;
  name: string;
  purpose: string;
  userActions: string;
  inputs: string;
  outputs: string;
  validations: string;
  errorHandling: string;
  collapsed: boolean;
};

type Stage = "upload" | "processing" | "results";

type UploadedFile = {
  id: string;
  name: string;
  size: number;
  type: string;
};

// ─── SOW Sections (subset for display) ───────────────────────────────────────

const SOW_SECTIONS: Section[] = [
  {
    id: "org", number: "01", title: "Organization & Project Context", short: "Organization",
    questions: [
      { id: "org_name", label: "Tell us about your organization", helper: "Briefly describe what your company does, its mission, and core focus.", placeholder: "e.g. Acme Corp is a fintech company focused on payment infrastructure for SMBs…" },
      { id: "org_client", label: "Who is the client or stakeholder?", helper: "Name of the client company and the primary contact, if known.", placeholder: "e.g. Client: XYZ Bank, Contact: Sarah Mitchell (Head of Product)…" },
      { id: "org_background", label: "What is the background behind this project?", helper: "Why is this project happening? What triggered it?", placeholder: "e.g. The client's existing system is outdated and cannot scale beyond 10k users…" },
    ],
  },
  {
    id: "objectives", number: "02", title: "Project Objectives", short: "Objectives",
    questions: [
      { id: "obj_goal", label: "What is the primary goal of this project?", helper: "State the single most important outcome this project must deliver.", placeholder: "e.g. Build a white-label payment gateway that processes $1M+ transactions daily…" },
      { id: "obj_secondary", label: "Are there secondary objectives?", helper: "Any supporting goals, business outcomes, or side benefits.", placeholder: "e.g. Reduce manual reconciliation time by 70%, improve audit trail compliance…" },
      { id: "obj_success", label: "How will success be measured?", helper: "KPIs, metrics, or acceptance criteria.", placeholder: "e.g. 99.9% uptime, zero critical bugs at go-live, 500 concurrent users supported…" },
    ],
  },
  {
    id: "scope", number: "03", title: "Scope of Work", short: "Scope",
    questions: [
      { id: "scope_in", label: "What is included in this project?", helper: "List deliverables, features, or areas of work in scope.", placeholder: "e.g. API development, admin dashboard, mobile app, QA testing, deployment…" },
      { id: "scope_out", label: "What is explicitly OUT of scope?", helper: "Items that could cause confusion — clarify they are not part of this engagement.", placeholder: "e.g. Legacy data migration, third-party integrations beyond Stripe…" },
      { id: "scope_phases", label: "Is the project divided into phases?", helper: "Describe phases if work will be delivered in stages.", placeholder: "e.g. Phase 1: MVP in 6 weeks. Phase 2: Extended features in 12 weeks…" },
      { id: "scope_deliverables", label: "What are the key deliverables?", helper: "Tangible outputs the client will receive.", placeholder: "e.g. Source code, deployment scripts, user documentation, training session…" },
    ],
  },
  {
    id: "timeline", number: "04", title: "Timeline & Schedule", short: "Timeline",
    questions: [
      { id: "timeline_start", label: "When does the project start?", helper: "Planned or expected start date.", placeholder: "e.g. 1st May 2025, or 'Two weeks after contract signing'…" },
      { id: "timeline_end", label: "When is the expected completion date?", helper: "Final delivery or go-live date.", placeholder: "e.g. 31st July 2025, approximately 12 weeks from start…" },
      { id: "timeline_milestones", label: "Are there any key milestones?", helper: "Intermediate dates where progress will be reviewed.", placeholder: "e.g. Week 2: Design approval. Week 6: Beta release. Week 10: UAT sign-off…" },
    ],
  },
  {
    id: "budget", number: "05", title: "Budget & Commercial Terms", short: "Budget",
    questions: [
      { id: "budget_total", label: "What is the total project budget?", helper: "Fixed price, T&M rate, or budget range.", placeholder: "e.g. Fixed price: £85,000 + VAT, or Time & Materials at £850/day…" },
      { id: "budget_payment", label: "What are the payment terms?", helper: "When and how payments will be made.", placeholder: "e.g. 30% upfront, 40% at Phase 1 delivery, 30% at final sign-off…" },
      { id: "budget_expenses", label: "Are there additional costs or expenses?", helper: "Travel, licenses, third-party services.", placeholder: "e.g. AWS hosting costs at client's expense. Travel billed at cost…" },
    ],
  },
  {
    id: "roles", number: "06", title: "Roles & Responsibilities", short: "Roles",
    questions: [
      { id: "roles_vendor", label: "Who is on the delivery team?", helper: "List key roles and their responsibilities.", placeholder: "e.g. Project Manager, 2x Backend Engineers, 1x Designer, QA Lead…" },
      { id: "roles_client", label: "What is expected from the client team?", helper: "Client responsibilities, approvals, or resources they must provide.", placeholder: "e.g. Client to provide API access within Week 1, assign a product owner…" },
      { id: "roles_escalation", label: "Who are the escalation contacts?", helper: "Decision-makers for issues, blockers, or changes.", placeholder: "e.g. Vendor: James (CTO) | Client: Sarah (VP Engineering)…" },
    ],
  },
  {
    id: "assumptions", number: "07", title: "Assumptions & Dependencies", short: "Assumptions",
    questions: [
      { id: "assumptions_list", label: "What assumptions are you making?", helper: "Conditions you are taking for granted.", placeholder: "e.g. Client will provide staging environment. All APIs documented by Week 1…" },
      { id: "dependencies_list", label: "What external dependencies exist?", helper: "Third-party services, client teams, or resources outside your control.", placeholder: "e.g. Stripe API integration, client legal team sign-off on contracts…" },
      { id: "assumptions_constraints", label: "Are there any known constraints?", helper: "Technical, regulatory, resource, or time constraints.", placeholder: "e.g. Must use client's existing Azure infrastructure. GDPR compliance mandatory…" },
    ],
  },
  {
    id: "risk", number: "08", title: "Risk Management", short: "Risk",
    questions: [
      { id: "risk_list", label: "What are the main risks?", helper: "Identify risks that could impact delivery, quality, or budget.", placeholder: "e.g. Scope creep, delayed client approvals, key person dependency…" },
      { id: "risk_mitigation", label: "How will risks be mitigated?", helper: "Planned responses or mitigation strategies.", placeholder: "e.g. Weekly status calls, change request process for scope changes…" },
      { id: "risk_change", label: "What is the change management process?", helper: "How will changes to scope, timeline, or budget be handled?", placeholder: "e.g. All changes require written approval. Impact assessed within 48 hours…" },
    ],
  },
  {
    id: "acceptance", number: "09", title: "Acceptance Criteria", short: "Acceptance",
    questions: [
      { id: "acceptance_criteria", label: "What defines project completion?", helper: "Specific criteria or tests the deliverables must pass.", placeholder: "e.g. All test cases pass, performance benchmarks met, UAT completed…" },
      { id: "acceptance_process", label: "What is the review and sign-off process?", helper: "How will deliverables be reviewed and formally accepted?", placeholder: "e.g. 5 business days for client review. Formal sign-off via email…" },
      { id: "acceptance_warranty", label: "Is there a warranty period after delivery?", helper: "Any post-delivery support obligations.", placeholder: "e.g. 30-day bug fix warranty. Critical issues resolved within 24 hours…" },
    ],
  },
  {
    id: "legal", number: "10", title: "Legal & Compliance", short: "Legal",
    questions: [
      { id: "legal_ip", label: "Who owns the intellectual property?", helper: "Ownership of code, designs, and deliverables after completion.", placeholder: "e.g. Full IP transferred to client upon final payment…" },
      { id: "legal_confidentiality", label: "Are there confidentiality requirements?", helper: "Data protection, NDAs, or information security obligations.", placeholder: "e.g. Mutual NDA in place. No client data to be stored outside EU…" },
      { id: "legal_governing", label: "What is the governing law?", helper: "Legal framework under which this agreement operates.", placeholder: "e.g. Governed by English Law. Disputes resolved under English courts…" },
    ],
  },
  {
    id: "communication", number: "11", title: "Communication Plan", short: "Communication",
    questions: [
      { id: "comm_cadence", label: "What is the communication cadence?", helper: "Meeting frequency, stand-ups, and review calls.", placeholder: "e.g. Weekly project call every Monday. Fortnightly steering committee…" },
      { id: "comm_tools", label: "What tools will be used?", helper: "Tools, platforms, and channels agreed with the client.", placeholder: "e.g. Slack for daily comms, Jira for tasks, Confluence for docs, Zoom for calls…" },
      { id: "comm_reporting", label: "What reports will be shared with the client?", helper: "Format and frequency of progress reports.", placeholder: "e.g. Weekly status report every Friday. Monthly executive summary…" },
    ],
  },
];

// ─── Mock AI answers ──────────────────────────────────────────────────────────

const MOCK_AI_ANSWERS: Record<string, { value: string; state: AnswerState }> = {
  org_name: { state: "autofilled", value: "Acme Digital Ltd — a UK-based software consultancy specialising in enterprise fintech solutions. Mission: deliver robust, scalable financial infrastructure to mid-market businesses." },
  org_client: { state: "needs-input", value: "" },
  org_background: { state: "autofilled", value: "The client's existing payment reconciliation system was built in 2018 and cannot support transaction volumes exceeding 50k/day. The business is growing at 40% YoY and requires a modern, scalable replacement before Q3." },
  obj_goal: { state: "autofilled", value: "Design, build, and deploy a new payment reconciliation platform capable of handling 500k+ daily transactions with real-time reporting and multi-currency support." },
  obj_secondary: { state: "needs-input", value: "" },
  obj_success: { state: "needs-input", value: "" },
  scope_in: { state: "autofilled", value: "Backend API development (Node.js), admin dashboard (React), payment processor integrations (Stripe, Braintree), automated reconciliation engine, QA testing, staging and production deployment on AWS." },
  scope_out: { state: "needs-input", value: "" },
  scope_phases: { state: "autofilled", value: "Phase 1 (Weeks 1–8): Core reconciliation engine + API. Phase 2 (Weeks 9–14): Admin dashboard + reporting. Phase 3 (Weeks 15–18): Integration testing, UAT, go-live." },
  scope_deliverables: { state: "needs-input", value: "" },
  timeline_start: { state: "needs-input", value: "" },
  timeline_end: { state: "autofilled", value: "18 weeks from contract signing, targeting go-live by end of Q3 2025." },
  timeline_milestones: { state: "optional", value: "" },
  budget_total: { state: "needs-input", value: "" },
  budget_payment: { state: "needs-input", value: "" },
  budget_expenses: { state: "optional", value: "" },
  roles_vendor: { state: "autofilled", value: "1× Project Manager, 2× Senior Backend Engineers, 1× Frontend Engineer, 1× QA Engineer, 1× DevOps Engineer (part-time)." },
  roles_client: { state: "needs-input", value: "" },
  roles_escalation: { state: "optional", value: "" },
  assumptions_list: { state: "autofilled", value: "Client will provide access to existing database schemas and payment processor credentials within the first week. Staging environment will be provisioned by client IT. All third-party API documentation will be available at project start." },
  dependencies_list: { state: "needs-input", value: "" },
  assumptions_constraints: { state: "optional", value: "" },
  risk_list: { state: "autofilled", value: "1. Delayed access to client systems (High). 2. Scope creep from additional payment processors (Medium). 3. Data migration complexity if legacy data is unstructured (High). 4. Key person risk if senior engineer leaves mid-project (Medium)." },
  risk_mitigation: { state: "needs-input", value: "" },
  risk_change: { state: "optional", value: "" },
  acceptance_criteria: { state: "autofilled", value: "All 247 functional test cases pass. System handles 500k daily transactions in load testing. Zero P1 bugs at UAT sign-off. Admin dashboard renders in < 2s on standard broadband." },
  acceptance_process: { state: "needs-input", value: "" },
  acceptance_warranty: { state: "optional", value: "" },
  legal_ip: { state: "needs-input", value: "" },
  legal_confidentiality: { state: "autofilled", value: "Mutual NDA signed prior to project start. All client data classified as confidential. No client data to be stored outside EU. GDPR compliance mandatory across all data flows." },
  legal_governing: { state: "optional", value: "" },
  comm_cadence: { state: "needs-input", value: "" },
  comm_tools: { state: "autofilled", value: "Slack (daily comms), Jira (task tracking), Confluence (documentation), Zoom (weekly calls), GitHub (code repository and PR reviews)." },
  comm_reporting: { state: "optional", value: "" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PROCESSING_STEPS = [
  "Reading your documents…",
  "Extracting project context…",
  "Identifying scope and objectives…",
  "Mapping roles and timelines…",
  "Detecting information gaps…",
  "Generating your SOW draft…",
];

// ─── PRD Sections ────────────────────────────────────────────────────────────

const PRD_UPLOAD_SECTIONS: Section[] = [
  { id: "vision", number: "01", title: "Product Vision", short: "Vision", questions: [
    { id: "prd_vision_describe", label: "Describe your product vision", helper: "What are you building and why does it matter?", placeholder: "e.g. A platform that helps freelancers manage invoicing without needing an accountant…" },
    { id: "prd_vision_problem", label: "What problem are you solving?", helper: "What pain point does your product address?", placeholder: "e.g. Freelancers spend 5+ hours/week on admin tasks that don't generate revenue…" },
    { id: "prd_vision_longterm", label: "What is your long-term vision?", helper: "Where do you see this product in 3–5 years?", placeholder: "e.g. Become the default financial OS for 1M+ independent creators worldwide…" },
  ]},
  { id: "users", number: "02", title: "Target Users", short: "Users", questions: [
    { id: "prd_users_primary", label: "Who are your primary users?", helper: "Describe their background, profession, and context of use.", placeholder: "e.g. Working professionals aged 25–40 using fintech apps on mobile daily…" },
    { id: "prd_users_painpoints", label: "What are their biggest pain points?", helper: "What frustrates them today?", placeholder: "e.g. They juggle 3 different tools to do what should be one workflow…" },
    { id: "prd_users_persona", label: "Describe your core user persona", helper: "Name, role, goals, and a typical day in their life.", placeholder: "e.g. Maya, 32, freelance designer. Juggles 5 clients. Needs to invoice fast and get paid faster…" },
  ]},
  { id: "experience", number: "03", title: "User Experience Goals", short: "Experience", questions: [
    { id: "prd_exp_feeling", label: "How should users feel when using your product?", helper: "Emotional experience — not features, but feelings.", placeholder: "e.g. Calm, in control, confident. Like the app is doing the thinking for them…" },
    { id: "prd_exp_journey", label: "Describe the ideal user journey", helper: "From first touch to core value.", placeholder: "e.g. Sign up → connect bank → see dashboard → send first invoice in under 3 minutes…" },
    { id: "prd_exp_reference", label: "Are there any products whose UX inspires you?", helper: "References help set the quality bar.", placeholder: "e.g. Linear for speed, Notion for flexibility, Stripe for trust and polish…" },
  ]},
  { id: "features", number: "04", title: "Features & Functionality", short: "Features", questions: [
    { id: "prd_feat_core", label: "What are the core features?", helper: "What MUST be included for your product to deliver its core value?", placeholder: "e.g. Invoice creation, payment tracking, client management, automated reminders…" },
    { id: "prd_feat_mvp", label: "What is the MVP scope?", helper: "Minimum set of features needed to launch and learn.", placeholder: "e.g. MVP = invoice creation + payment link + basic dashboard. Everything else is Phase 2…" },
    { id: "prd_feat_later", label: "What features can come later?", helper: "Valuable but not critical for the first release.", placeholder: "e.g. Tax reports, multi-currency, team accounts, integrations…" },
  ]},
  { id: "differentiation", number: "05", title: "Differentiation", short: "Differentiation", questions: [
    { id: "prd_diff_competitors", label: "Who are your main competitors?", helper: "Direct and indirect alternatives users currently use.", placeholder: "e.g. FreshBooks, Wave, HoneyBook, or just spreadsheets and WhatsApp…" },
    { id: "prd_diff_unique", label: "What makes your product different?", helper: "Your unique angle — why would someone choose you?", placeholder: "e.g. We're the only tool built specifically for solopreneurs. 10x simpler…" },
    { id: "prd_diff_positioning", label: "Describe your product in one sentence", helper: "Your positioning statement.", placeholder: "e.g. The fastest way for freelancers to get paid — without the complexity of accounting software…" },
  ]},
  { id: "metrics", number: "06", title: "Success Metrics", short: "Metrics", questions: [
    { id: "prd_metrics_north_star", label: "What is your north star metric?", helper: "The single number that best captures product value.", placeholder: "e.g. Monthly invoices sent, or 'time from sign-up to first payment received'…" },
    { id: "prd_metrics_kpis", label: "What KPIs will you track?", helper: "Supporting metrics that indicate product health.", placeholder: "e.g. DAU/MAU ratio, invoice completion rate, churn rate, NPS score…" },
    { id: "prd_metrics_launch", label: "What does a successful launch look like?", helper: "Measurable goals for the first 30–90 days.", placeholder: "e.g. 500 sign-ups in 30 days, 40% activation rate, <5% week-1 churn…" },
  ]},
  { id: "content", number: "07", title: "Content & Data", short: "Content", questions: [
    { id: "prd_content_types", label: "What types of content or data does the product handle?", helper: "What will users create, upload, view, or manage?", placeholder: "e.g. Invoices, client profiles, payment records, expense receipts, reports…" },
    { id: "prd_content_structure", label: "How is information structured?", helper: "Key entities and how they relate to each other.", placeholder: "e.g. User → Clients → Projects → Invoices → Payments…" },
    { id: "prd_content_external", label: "Does the product integrate with external data sources?", helper: "APIs, third-party services, or existing tools.", placeholder: "e.g. Stripe for payments, Plaid for bank data, Gmail for sending invoices…" },
  ]},
  { id: "constraints", number: "08", title: "Constraints", short: "Constraints", questions: [
    { id: "prd_const_technical", label: "Are there technical constraints or platform requirements?", helper: "Must-use technologies, existing infrastructure, or platform targets.", placeholder: "e.g. Must be mobile-first (iOS + Android). Backend must use existing Node.js API…" },
    { id: "prd_const_compliance", label: "Are there compliance or security requirements?", helper: "Regulations, data privacy laws, or security standards.", placeholder: "e.g. GDPR compliant, PCI-DSS for payment handling, SOC 2 target…" },
    { id: "prd_const_timeline", label: "Are there hard deadlines or business constraints?", helper: "Launch dates, funding milestones, or market windows.", placeholder: "e.g. Must launch before Q3. Board demo in 8 weeks…" },
  ]},
  { id: "assumptions", number: "09", title: "Assumptions & Risks", short: "Assumptions", questions: [
    { id: "prd_assume_user", label: "What assumptions are you making about user behaviour?", helper: "Hypotheses about how users will discover and use the product.", placeholder: "e.g. We assume users will check the dashboard daily…" },
    { id: "prd_assume_market", label: "What market assumptions are you making?", helper: "Beliefs about market size, competition, or timing.", placeholder: "e.g. The market is underserved. Existing tools are too complex for solo users…" },
    { id: "prd_assume_risks", label: "What are the biggest risks to this product?", helper: "What could prevent this product from succeeding?", placeholder: "e.g. Low activation if onboarding is confusing…" },
  ]},
  { id: "future", number: "10", title: "Future Scope", short: "Future Scope", questions: [
    { id: "prd_future_v2", label: "What is the vision for v2 and beyond?", helper: "Features, markets, or capabilities planned for future phases.", placeholder: "e.g. v2: team accounts. v3: AI-powered financial forecasting…" },
    { id: "prd_future_expansion", label: "Are there plans to expand to new markets?", helper: "Geographic, demographic, or vertical expansion ideas.", placeholder: "e.g. Start with UK freelancers, expand to EU in Year 2, US in Year 3…" },
    { id: "prd_future_platform", label: "Do you see this becoming a platform or ecosystem?", helper: "Third-party integrations, marketplace, or API access.", placeholder: "e.g. Long-term: open API so accountants can build custom views…" },
  ]},
];

// ─── FRD Sections ────────────────────────────────────────────────────────────

const FRD_UPLOAD_SECTIONS: Section[] = [
  { id: "frd_overview", number: "01", title: "System Overview", short: "System Overview", questions: [
    { id: "frd_overview_describe", label: "Describe the system you want to build", helper: "Explain what the system does at a high level.", placeholder: "e.g. A multi-tenant SaaS platform for managing client onboarding workflows…" },
    { id: "frd_overview_modules", label: "What are the main components or modules?", helper: "List the functional areas or subsystems.", placeholder: "e.g. Authentication, Dashboard, Client Management, Document Vault, Notifications…" },
    { id: "frd_overview_users", label: "Who are the end users of this system?", helper: "Describe the user types and their technical familiarity.", placeholder: "e.g. Internal ops team (power users), external clients (non-technical), system admins…" },
  ]},
  { id: "frd_roles", number: "02", title: "User Roles & Permissions", short: "User Roles", questions: [
    { id: "frd_roles_types", label: "What types of users will use this system?", helper: "List all roles.", placeholder: "e.g. Super Admin, Account Manager, Client User, Read-Only Viewer…" },
    { id: "frd_roles_permissions", label: "What can each role do?", helper: "Map roles to capabilities — create, read, update, delete, approve.", placeholder: "e.g. Admin: full access. Manager: can create/edit but not delete…" },
    { id: "frd_roles_restrictions", label: "Are there data isolation or access restriction rules?", helper: "Multi-tenant boundaries, row-level security.", placeholder: "e.g. Each organisation can only see their own data…" },
  ]},
  { id: "frd_auth", number: "03", title: "Authentication & Security", short: "Authentication", questions: [
    { id: "frd_auth_method", label: "How should users log in?", helper: "Authentication methods: email/password, magic link, SSO, OAuth, OTP.", placeholder: "e.g. Email + password with email verification. Optional Google SSO…" },
    { id: "frd_auth_session", label: "How should sessions be managed?", helper: "Session expiry, remember me, token refresh.", placeholder: "e.g. JWT tokens. 7-day session with refresh. Force logout after 30 min idle…" },
    { id: "frd_auth_security", label: "What security measures should be included?", helper: "Rate limiting, brute force protection, password policy, audit logs.", placeholder: "e.g. Lock account after 5 failed attempts. All actions logged…" },
  ]},
  { id: "frd_features", number: "04", title: "Functional Requirements", short: "Features", builderType: "feature-builder", questions: [] },
  { id: "frd_flows", number: "05", title: "User Flows", short: "User Flows", questions: [
    { id: "frd_flows_critical", label: "What are the critical user flows?", helper: "Step-by-step sequences for the most important actions.", placeholder: "e.g. New user signup → email verify → onboarding wizard → dashboard…" },
    { id: "frd_flows_happy", label: "Describe the happy path for the core workflow", helper: "The ideal sequence when everything works as expected.", placeholder: "e.g. User logs in → selects project → uploads document → confirms → saved…" },
    { id: "frd_flows_alt", label: "Are there alternative or exception flows?", helper: "Paths taken when the happy path isn't available.", placeholder: "e.g. If extraction fails → manual entry fallback…" },
  ]},
  { id: "frd_ui", number: "06", title: "UI Behaviour", short: "UI Behavior", questions: [
    { id: "frd_ui_interactions", label: "What happens when users interact with key actions?", helper: "Define feedback for clicks, submissions, and state changes.", placeholder: "e.g. Button click → loading spinner → success toast…" },
    { id: "frd_ui_errors", label: "What error states should be shown?", helper: "All UI error scenarios: validation, network, auth, empty states.", placeholder: "e.g. Invalid email: inline red error. Network failure: banner + retry…" },
    { id: "frd_ui_loading", label: "How should loading states be handled?", helper: "Skeletons, spinners, progress bars, disabled states.", placeholder: "e.g. Table rows: skeleton loader. Long operations: progress bar…" },
  ]},
  { id: "frd_logic", number: "07", title: "Business Logic", short: "Business Logic", questions: [
    { id: "frd_logic_rules", label: "What are the core business rules?", helper: "Rules that govern how data behaves or what triggers what.", placeholder: "e.g. Invoice can only be sent if all line items have a price…" },
    { id: "frd_logic_calculations", label: "Are there any calculations or derived values?", helper: "Totals, scores, statuses, or any computed fields.", placeholder: "e.g. Project completion % = completed tasks / total tasks…" },
    { id: "frd_logic_workflows", label: "Are there approval workflows or state machines?", helper: "Multi-step processes requiring sign-off or conditional progression.", placeholder: "e.g. Document: Draft → Review → Approved → Published…" },
  ]},
  { id: "frd_data", number: "08", title: "Data & Storage", short: "Data", questions: [
    { id: "frd_data_entities", label: "What are the main data entities?", helper: "Core tables or objects the system will store and manage.", placeholder: "e.g. Users, Organisations, Projects, Documents, Tasks, Comments…" },
    { id: "frd_data_relationships", label: "How do these entities relate to each other?", helper: "One-to-many, many-to-many, ownership, and hierarchy.", placeholder: "e.g. Organisation has many Users. Project belongs to Organisation…" },
    { id: "frd_data_retention", label: "Are there data retention or archiving requirements?", helper: "How long data is kept, soft delete vs hard delete.", placeholder: "e.g. Soft delete for 90 days. Audit logs: retained 2 years…" },
  ]},
  { id: "frd_integrations", number: "09", title: "Integrations", short: "Integrations", questions: [
    { id: "frd_int_external", label: "What external services does the system need?", helper: "Payment gateways, email providers, CRMs, cloud storage.", placeholder: "e.g. Stripe (payments), SendGrid (email), AWS S3 (file storage)…" },
    { id: "frd_int_apis", label: "Does this system expose or consume APIs?", helper: "Internal APIs, public APIs, webhooks, or event streams.", placeholder: "e.g. REST API consumed by mobile app. Webhooks to notify client systems…" },
    { id: "frd_int_sync", label: "Are there real-time requirements?", helper: "Live updates, polling, WebSockets, or background sync.", placeholder: "e.g. Dashboard updates in real-time via WebSocket…" },
  ]},
  { id: "frd_edge", number: "10", title: "Edge Cases & Failures", short: "Edge Cases", questions: [
    { id: "frd_edge_failure", label: "What should happen if something fails?", helper: "API failures, timeout errors, third-party outages, network issues.", placeholder: "e.g. Payment API down: show retry option, do not charge twice…" },
    { id: "frd_edge_concurrency", label: "Are there concurrency or race condition scenarios?", helper: "Simultaneous edits, double submissions, optimistic UI conflicts.", placeholder: "e.g. Two users editing same record: last-write-wins with conflict warning…" },
    { id: "frd_edge_invalid", label: "How should invalid inputs be handled?", helper: "Malformed data, unexpected formats, boundary values.", placeholder: "e.g. File exceeds 25MB: show size error before upload…" },
  ]},
  { id: "frd_nonfunc", number: "11", title: "Non-Functional Requirements", short: "Non-Functional", questions: [
    { id: "frd_nf_performance", label: "What performance expectations do you have?", helper: "Response times, load times, throughput targets.", placeholder: "e.g. API response < 300ms (p95). Page load < 2s…" },
    { id: "frd_nf_scalability", label: "What scalability requirements are needed?", helper: "Expected growth, peak load handling.", placeholder: "e.g. Handle 10x traffic during month-end. Auto-scale on AWS…" },
    { id: "frd_nf_availability", label: "What are the uptime and availability requirements?", helper: "SLA targets, planned downtime, disaster recovery.", placeholder: "e.g. 99.9% uptime SLA. Max 4 hours RTO…" },
  ]},
  { id: "frd_reports", number: "12", title: "Reporting & Analytics", short: "Reports", questions: [
    { id: "frd_rep_types", label: "What reports or dashboards does the system need?", helper: "Built-in analytics, export formats, admin reporting.", placeholder: "e.g. Project status dashboard, user activity report, revenue summary…" },
    { id: "frd_rep_filters", label: "How should data be filtered and segmented?", helper: "Date ranges, user groups, status filters.", placeholder: "e.g. Filter by date range, user role, project status…" },
    { id: "frd_rep_export", label: "What export formats are required?", helper: "CSV, Excel, PDF, or API-accessible data.", placeholder: "e.g. CSV and Excel exports on all table views…" },
  ]},
  { id: "frd_notif", number: "13", title: "Notifications", short: "Notifications", questions: [
    { id: "frd_notif_triggers", label: "What events should trigger notifications?", helper: "System events that require alerting users.", placeholder: "e.g. New task assigned, document approved, payment failed…" },
    { id: "frd_notif_channels", label: "What notification channels are needed?", helper: "In-app, email, SMS, push notifications, Slack/Teams.", placeholder: "e.g. In-app bell icon + email for critical events…" },
    { id: "frd_notif_prefs", label: "Should users manage notification preferences?", helper: "Granular control over what notifications are received.", placeholder: "e.g. Users can toggle per-event preferences…" },
  ]},
  { id: "frd_acceptance", number: "14", title: "Acceptance Criteria", short: "Acceptance", questions: [
    { id: "frd_acc_criteria", label: "What defines each feature as functionally complete?", helper: "Specific, testable conditions for sign-off.", placeholder: "e.g. Login: user can authenticate with valid credentials and is redirected within 2s…" },
    { id: "frd_acc_testing", label: "What testing requirements exist?", helper: "Unit tests, integration tests, UAT, performance tests.", placeholder: "e.g. 80% test coverage. All critical flows covered by E2E tests…" },
    { id: "frd_acc_signoff", label: "What is the formal sign-off process?", helper: "Who reviews and approves the FRD and final deliverables?", placeholder: "e.g. Tech lead reviews FRD. Product owner signs off feature completion…" },
  ]},
];

// ─── Mock PRD answers ─────────────────────────────────────────────────────────

const MOCK_PRD_ANSWERS: Record<string, { value: string; state: AnswerState }> = {
  prd_vision_describe: { state: "autofilled", value: "A mobile-first financial management platform that helps freelancers and independent contractors manage invoices, track payments, and understand their cash flow — without needing accounting expertise." },
  prd_vision_problem: { state: "autofilled", value: "Freelancers spend an average of 6+ hours per week on financial admin tasks. Existing tools are built for accountants, not creators — too complex, too expensive, and not designed for how independent workers actually operate." },
  prd_vision_longterm: { state: "needs-input", value: "" },
  prd_users_primary: { state: "autofilled", value: "Independent professionals aged 24–38: freelance designers, developers, writers, consultants, and photographers. Primarily mobile users, tech-comfortable but not tech-expert. Earning £30k–£90k/year from 3–8 active clients." },
  prd_users_painpoints: { state: "autofilled", value: "1. Tracking who has and hasn't paid across multiple clients. 2. Creating professional invoices quickly on mobile. 3. Understanding actual take-home after taxes. 4. Chasing late payments without damaging client relationships." },
  prd_users_persona: { state: "needs-input", value: "" },
  prd_exp_feeling: { state: "autofilled", value: "Calm, in control, and confident. Users should feel like the app is handling the stressful parts of running a freelance business. Every interaction should feel fast, obvious, and reassuring — never bureaucratic." },
  prd_exp_journey: { state: "needs-input", value: "" },
  prd_exp_reference: { state: "optional", value: "" },
  prd_feat_core: { state: "autofilled", value: "1. Invoice creation and sending (PDF + payment link). 2. Payment status tracking per client. 3. Client management. 4. Automated payment reminders. 5. Basic earnings dashboard. 6. Expense logging." },
  prd_feat_mvp: { state: "autofilled", value: "MVP scope: Invoice creation → Send via email/link → Track payment status → Basic client list → Simple earnings summary. Everything else deferred to Phase 2." },
  prd_feat_later: { state: "needs-input", value: "" },
  prd_diff_competitors: { state: "autofilled", value: "FreshBooks (too complex, too expensive for solos), Wave (free but US-centric), HoneyBook (US market, project management focus), Bonsai (US-centric). Most are built for small teams, not true solopreneurs." },
  prd_diff_unique: { state: "needs-input", value: "" },
  prd_diff_positioning: { state: "needs-input", value: "" },
  prd_metrics_north_star: { state: "autofilled", value: "Monthly invoices successfully sent and paid through the platform (measures both activation and core value delivery)." },
  prd_metrics_kpis: { state: "autofilled", value: "Sign-up to first invoice sent (activation). Invoice payment rate. 30-day retention. Weekly active users. NPS score. Average invoices per user per month." },
  prd_metrics_launch: { state: "needs-input", value: "" },
  prd_content_types: { state: "autofilled", value: "Invoices, client profiles, payment records, expense receipts, project/job records, bank account details (read-only), generated PDF documents, email communication logs." },
  prd_content_structure: { state: "optional", value: "" },
  prd_content_external: { state: "autofilled", value: "Stripe (payment processing), Open Banking / Plaid (bank account sync), SendGrid (transactional email), AWS S3 (PDF and receipt storage), Google/Apple Auth (SSO)." },
  prd_const_technical: { state: "needs-input", value: "" },
  prd_const_compliance: { state: "autofilled", value: "GDPR compliance mandatory (UK/EU users). PCI-DSS compliance for payment data handling via Stripe. HMRC Making Tax Digital (MTD) compatibility for UK VAT-registered users in future phases." },
  prd_const_timeline: { state: "needs-input", value: "" },
  prd_assume_user: { state: "autofilled", value: "Users will primarily access via mobile. Users are comfortable with digital payments. Users have 2–8 active clients at any time. Users want speed over features — they will not read help docs." },
  prd_assume_market: { state: "optional", value: "" },
  prd_assume_risks: { state: "needs-input", value: "" },
  prd_future_v2: { state: "autofilled", value: "v2: Tax estimation and self-assessment helpers. VAT tracking. Multi-currency invoicing. Proposals and contracts. v3: Team/sub-contractor management. Accountant collaboration portal." },
  prd_future_expansion: { state: "optional", value: "" },
  prd_future_platform: { state: "optional", value: "" },
};

// ─── Mock FRD answers ─────────────────────────────────────────────────────────

const MOCK_FRD_ANSWERS: Record<string, { value: string; state: AnswerState }> = {
  frd_overview_describe: { state: "autofilled", value: "A multi-tenant SaaS platform for managing end-to-end client onboarding workflows. The system handles document collection, KYC verification, approval routing, and audit trail generation across multiple client organisations." },
  frd_overview_modules: { state: "autofilled", value: "1. Authentication & RBAC. 2. Onboarding Workflow Engine. 3. Document Vault. 4. KYC / Verification Module. 5. Notification Centre. 6. Reporting & Analytics. 7. Admin Control Panel. 8. Audit Log Service." },
  frd_overview_users: { state: "needs-input", value: "" },
  frd_roles_types: { state: "autofilled", value: "Super Admin (internal), Organisation Admin (per-tenant), Case Manager, Compliance Officer, Client (external, limited access), Read-Only Auditor." },
  frd_roles_permissions: { state: "autofilled", value: "Super Admin: full system access. Org Admin: manage users and settings within their org. Case Manager: create/edit cases, upload documents. Compliance Officer: review and approve/reject. Client: submit documents only. Auditor: read-only." },
  frd_roles_restrictions: { state: "needs-input", value: "" },
  frd_auth_method: { state: "autofilled", value: "Email + password with mandatory email verification. Google SSO optional for internal users. Magic link for external clients (no password required). MFA via TOTP authenticator app for admin roles." },
  frd_auth_session: { state: "autofilled", value: "JWT access tokens (15-min expiry) + refresh tokens (7-day expiry). Auto-refresh on activity. Force logout after 30 minutes of inactivity. Single active session per user (concurrent session invalidation)." },
  frd_auth_security: { state: "needs-input", value: "" },
  frd_flows_critical: { state: "autofilled", value: "1. Client onboarding: invite → register → document upload → submission → review → approval/rejection → notification. 2. Case management: create case → assign → progress through stages → close. 3. Document review: upload → OCR extraction → compliance check → approve/flag." },
  frd_flows_happy: { state: "autofilled", value: "Compliance officer creates case → assigns to client → client receives email invite → client registers via magic link → client uploads required documents → system validates formats → case manager reviews → compliance officer approves → case closed with full audit trail." },
  frd_flows_alt: { state: "needs-input", value: "" },
  frd_ui_interactions: { state: "autofilled", value: "All async actions: show loading spinner on trigger element, disable button during request, show success toast on completion. Form submissions: inline validation before submit. File uploads: progress bar per file. Destructive actions: confirmation modal required." },
  frd_ui_errors: { state: "needs-input", value: "" },
  frd_ui_loading: { state: "autofilled", value: "Tables: skeleton rows during fetch. Dashboard widgets: skeleton cards. File upload: per-file progress bar with % complete. Long-running operations (>3s): progress indicator with cancel option. All buttons disabled during their own async operation." },
  frd_logic_rules: { state: "autofilled", value: "1. A case cannot be submitted until all required documents are uploaded. 2. Approval requires a Compliance Officer role — Case Managers cannot self-approve. 3. Rejected cases require a written rejection reason. 4. Audit log entries are immutable once written. 5. Archived cases are read-only." },
  frd_logic_calculations: { state: "optional", value: "" },
  frd_logic_workflows: { state: "autofilled", value: "Case states: New → In Progress → Pending Review → Under Compliance Review → Approved / Rejected / On Hold. Each transition logs: who, when, from-state, to-state, reason (if rejection). Notifications fired on each transition." },
  frd_data_entities: { state: "autofilled", value: "Organisations, Users, Roles, Cases, Documents, DocumentVersions, CaseStageHistory, Notifications, AuditLogs, InviteTokens, CommentThreads." },
  frd_data_relationships: { state: "autofilled", value: "Organisation has many Users and Cases. Case belongs to Organisation, has many Documents and a CaseStageHistory. Document has many DocumentVersions. AuditLog is append-only and linked to User + Case." },
  frd_data_retention: { state: "needs-input", value: "" },
  frd_int_external: { state: "autofilled", value: "AWS S3 (document storage), SendGrid (transactional email), Twilio (SMS for MFA), Onfido or Jumio (KYC verification API), Stripe (billing/subscriptions for SaaS tiers), Datadog (monitoring and alerting)." },
  frd_int_apis: { state: "autofilled", value: "REST API (versioned, /api/v1/) consumed by web frontend and mobile app. Webhooks outbound: case status changes, document approvals. API keys for enterprise clients to integrate programmatically." },
  frd_int_sync: { state: "needs-input", value: "" },
  frd_edge_failure: { state: "autofilled", value: "KYC API unavailable: queue verification request, retry with exponential backoff, notify case manager. Document upload failure: preserve form state, show retry per file. Email delivery failure: log and retry up to 3 times over 24 hours." },
  frd_edge_concurrency: { state: "needs-input", value: "" },
  frd_edge_invalid: { state: "autofilled", value: "File exceeds 20MB: reject before upload with clear size error. Unsupported file type: show allowed formats list. Expired invite token: redirect to 'request new invite' flow. SQL injection / XSS: sanitised at API layer, WAF in front of load balancer." },
  frd_nf_performance: { state: "autofilled", value: "API response time < 300ms (p95) under normal load. Document upload: max 30s for 20MB file. Dashboard initial load < 2s. Search results < 500ms." },
  frd_nf_scalability: { state: "needs-input", value: "" },
  frd_nf_availability: { state: "autofilled", value: "99.9% uptime SLA (max ~8.7h downtime/year). RTO: 4 hours. RPO: 1 hour. Multi-AZ deployment on AWS. Automated failover. Maintenance windows communicated 72h in advance." },
  frd_rep_types: { state: "autofilled", value: "Case volume dashboard (by status, date, org). User activity report. Document throughput report. Compliance turnaround time report. Monthly executive summary (PDF export). Admin: system health and error rate dashboard." },
  frd_rep_filters: { state: "optional", value: "" },
  frd_rep_export: { state: "autofilled", value: "CSV and Excel on all table views. PDF export for case summary and audit reports. API endpoint for programmatic data access (/api/v1/reports)." },
  frd_notif_triggers: { state: "autofilled", value: "Case assigned, document uploaded, review required, case approved, case rejected, case on hold, invite sent, invite accepted, session expiry warning, failed login attempt (admin only)." },
  frd_notif_channels: { state: "needs-input", value: "" },
  frd_notif_prefs: { state: "optional", value: "" },
  frd_acc_criteria: { state: "autofilled", value: "Each feature has a definition-of-done: all acceptance tests pass, no P1/P2 bugs open, performance benchmarks met, security scan clean, QA sign-off received. Compliance Officer can approve a case end-to-end in < 3 clicks from the review screen." },
  frd_acc_testing: { state: "autofilled", value: "Unit test coverage ≥ 80%. All critical user flows covered by automated E2E tests (Playwright). Load testing: 500 concurrent users for 30 minutes. Penetration test before go-live. UAT with 5 client users across 2 organisations." },
  frd_acc_signoff: { state: "needs-input", value: "" },
};

// ─── Mock FRD feature cards ──────────────────────────────────────────────────

const MOCK_FRD_FEATURE_CARDS: Omit<FeatureCard, "id">[] = [
  { name: "User Authentication", purpose: "Allow users to securely access the system with role-appropriate permissions.", userActions: "Navigate to login → enter email + password (or click magic link in email) → complete MFA if admin role → redirected to role-specific dashboard.", inputs: "Email (string, valid format), Password (string, min 10 chars) or Magic Link Token (UUID, 15-min expiry).", outputs: "JWT access token (15-min), refresh token (7-day), user session object with role and org context.", validations: "Email must be valid format. Account must be active and verified. MFA code must match TOTP window. Max 5 failed attempts before lockout.", errorHandling: "Invalid credentials: generic error (do not reveal which field is wrong). Account locked: show unlock instructions. Expired magic link: prompt to request new link.", collapsed: false },
  { name: "Case Creation", purpose: "Enable Case Managers to initiate a new onboarding case for a client.", userActions: "Click 'New Case' → fill case details form → assign client (invite or existing) → select required document checklist → confirm → case created in 'New' status.", inputs: "Case name, client email, document checklist (multi-select), assigned case manager, due date (optional), priority (Low/Medium/High).", outputs: "Case record created with unique case ID, invitation email sent to client, audit log entry written, case appears in Case Manager's queue.", validations: "Client email must be valid. At least one document type must be selected. Case name max 120 chars. Due date must be in the future.", errorHandling: "Duplicate client email in same org: warn with option to link to existing client. Email send failure: case still created, retry email with error shown.", collapsed: true },
  { name: "Document Upload & Verification", purpose: "Allow clients to upload required documents which are then validated and stored securely.", userActions: "Client opens case link → sees document checklist → clicks upload per document type → selects file → confirms upload → system processes file.", inputs: "File (PDF, JPEG, PNG, max 20MB), document type (enum), case ID, uploader user ID.", outputs: "Document record with S3 URL, virus scan result, OCR extracted text, document status (Pending Review), notification to Case Manager.", validations: "File must be under 20MB. File type must be PDF/JPEG/PNG. Virus scan must pass. OCR confidence must exceed 70% (else flag for manual review).", errorHandling: "Virus detected: quarantine file, notify admin, show client 'upload failed' without revealing reason. OCR fails: mark as 'needs manual review', still store file.", collapsed: true },
];

// ─── Type config map ─────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, {
  contextLabel: string;
  contextPlaceholder: string;
  descLabel: string;
  descPlaceholder: string;
  descHelper: string;
  uploadSubtitle: string;
  analyseBtn: string;
  analyseHint: string;
  processingSteps: string[];
  sections: Section[];
  mockAnswers: Record<string, { value: string; state: AnswerState }>;
  generateRoute: string;
  aiLabel: string;
  summaryLabel: string;
  generateLabel: string;
  filterLabel: string;
  filterActiveLabel: string;
  neededLabel: string;
}> = {
  SOW: {
    contextLabel: "Project Name", contextPlaceholder: "e.g. E-Commerce Platform Revamp",
    descLabel: "Short Description", descPlaceholder: "Briefly describe your project (optional)",
    descHelper: "This helps the AI understand your context better",
    uploadSubtitle: "Upload any files you already have — we'll extract and structure everything automatically",
    analyseBtn: "Analyse with AI", analyseHint: "No files? That's fine — AI will ask only what it needs",
    processingSteps: ["Reading your documents…", "Extracting project context…", "Identifying scope and objectives…", "Mapping roles and timelines…", "Detecting information gaps…", "Generating your SOW draft…"],
    sections: SOW_SECTIONS, mockAnswers: MOCK_AI_ANSWERS,
    generateRoute: "/output-format", aiLabel: "AI filled", summaryLabel: "of your document",
    generateLabel: "Finalize & Format →", filterLabel: "Show only ⭐ gaps", filterActiveLabel: "Showing gaps only", neededLabel: "NEEDED",
  },
  PRD: {
    contextLabel: "Product Name", contextPlaceholder: "e.g. Fintech Budgeting App",
    descLabel: "Product Description", descPlaceholder: "Describe your product idea, target users, and purpose (optional)",
    descHelper: "This helps AI understand your product vision and context",
    uploadSubtitle: "Upload any briefs, notes, or research — AI will extract product insights automatically",
    analyseBtn: "Understand My Product", analyseHint: "No files? Describe your product above and we'll work from that",
    processingSteps: ["Reading your documents…", "Extracting product information…", "Identifying user needs and features…", "Mapping insights to PRD structure…", "Detecting product gaps…", "Generating your PRD draft…"],
    sections: PRD_UPLOAD_SECTIONS, mockAnswers: MOCK_PRD_ANSWERS,
    generateRoute: "/output-format", aiLabel: "AI defined", summaryLabel: "of your product",
    generateLabel: "Finalize & Format →", filterLabel: "Show only ⭐ gaps", filterActiveLabel: "Showing gaps only", neededLabel: "NEEDED",
  },
  FRD: {
    contextLabel: "System / Product Name", contextPlaceholder: "e.g. Multi-vendor E-commerce Platform",
    descLabel: "System Description", descPlaceholder: "Describe the system, its purpose, and key functionality (optional)",
    descHelper: "This helps AI understand your system architecture and logic",
    uploadSubtitle: "Upload any specs, notes, or diagrams — AI will extract system behavior and requirements",
    analyseBtn: "Map My System", analyseHint: "No files? Describe your system above and we'll map the requirements",
    processingSteps: ["Reading your documents…", "Extracting system components…", "Understanding user roles and flows…", "Mapping functional requirements…", "Identifying missing logic and edge cases…", "Generating your FRD draft…"],
    sections: FRD_UPLOAD_SECTIONS, mockAnswers: MOCK_FRD_ANSWERS,
    generateRoute: "/output-format", aiLabel: "AI mapped", summaryLabel: "of your system",
    generateLabel: "Finalize & Format →", filterLabel: "Show only ⭐ missing logic", filterActiveLabel: "Showing missing logic", neededLabel: "DEFINE",
  },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getSectionStats(section: Section, answers: Record<string, AnswerEntry>) {
  const total = section.questions.length;
  const filled = section.questions.filter((q) => {
    const a = answers[q.id];
    return a?.value?.trim() && a.state !== "optional";
  }).length;
  const needsInput = section.questions.filter((q) => answers[q.id]?.state === "needs-input" && !answers[q.id]?.value?.trim()).length;
  return { total, filled, needsInput };
}

// ─── Component ────────────────────────────────────────────────────────────────

const UploadGapFlow = () => {
  const [searchParams] = useSearchParams();
  const docType = searchParams.get("type") || "SOW";
  const navigate = useNavigate();

  const cfg = TYPE_CONFIG[docType] ?? TYPE_CONFIG["SOW"];
  const activeSections = cfg.sections;

  const [stage, setStage] = useState<Stage>("upload");
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerEntry>>({});
  const [featureCards, setFeatureCards] = useState<FeatureCard[]>([]);
  const [currentSection, setCurrentSection] = useState(0);
  const [filterMode, setFilterMode] = useState<"all" | "needs-input">("all");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateFeatureCard = (id: string, field: keyof Omit<FeatureCard, "id" | "collapsed">, value: string) => {
    setFeatureCards((prev) => prev.map((c) => c.id === id ? { ...c, [field]: value } : c));
  };
  const toggleFeatureCard = (id: string) => {
    setFeatureCards((prev) => prev.map((c) => c.id === id ? { ...c, collapsed: !c.collapsed } : c));
  };

  // Stats
  const totalQuestions = activeSections.filter(s => !s.builderType).reduce((a, s) => a + s.questions.length, 0);
  const autofilledCount = Object.values(answers).filter((a) => a.state === "autofilled").length;
  const needsInputCount = Object.values(answers).filter((a) => a.state === "needs-input" && !a.value.trim()).length;
  const aiPercent = totalQuestions > 0 ? Math.round((autofilledCount / totalQuestions) * 100) : 0;

  const section = activeSections[currentSection];
  const visibleQuestions = section.builderType ? [] : filterMode === "needs-input"
    ? section.questions.filter((q) => answers[q.id]?.state === "needs-input" && !answers[q.id]?.value?.trim())
    : section.questions;

  // ── File handling ─────────────────────────────────────────────────────────

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const mapped: UploadedFile[] = arr.map((f) => ({
      id: `${f.name}_${Date.now()}_${Math.random()}`,
      name: f.name,
      size: f.size,
      type: f.type,
    }));
    setFiles((prev) => [...prev, ...mapped]);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));

  // ── Processing simulation ────────────────────────────────────────────────

  const startProcessing = () => {
    if (files.length === 0 && !projectName.trim()) return;
    setStage("processing");
    setProcessingStep(0);
    setProcessingProgress(0);

    let step = 0;
    let progress = 0;

    const stepInterval = setInterval(() => {
      step += 1;
      setProcessingStep(step);
      if (step >= cfg.processingSteps.length - 1) clearInterval(stepInterval);
    }, 420);

    const progressInterval = setInterval(() => {
      progress += Math.random() * 8 + 4;
      if (progress >= 100) {
        progress = 100;
        setProcessingProgress(100);
        clearInterval(progressInterval);
        setTimeout(() => {
          const initialAnswers: Record<string, AnswerEntry> = {};
          activeSections.forEach((s) => {
            s.questions.forEach((q) => {
              const mock = cfg.mockAnswers[q.id];
              initialAnswers[q.id] = { value: mock?.value ?? "", state: mock?.state ?? "optional", edited: false };
            });
          });
          setAnswers(initialAnswers);
          if (docType === "FRD") {
            setFeatureCards(MOCK_FRD_FEATURE_CARDS.map((c, i) => ({ ...c, id: `ai_feat_${i}` })));
          }
          setStage("results");
        }, 400);
      } else {
        setProcessingProgress(progress);
      }
    }, 120);
  };

  // ── Answer editing ────────────────────────────────────────────────────────

  const handleEdit = (id: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [id]: { ...prev[id], value, edited: prev[id]?.value !== value },
    }));
    setSaveStatus("idle");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveStatus("saved"), 800);
  };

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  // ─────────────────────────────────────────────────────────────────────────

  const renderTop = (subtitle: string) => (
    <>
      <div className="flex items-center justify-between px-6 lg:px-8 pt-6 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary transition-all duration-200 hover:-translate-x-1">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <nav className="font-mono-label text-xs tracking-wider flex items-center gap-1.5 flex-wrap">
            <span className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors" onClick={() => navigate("/")}>Dashboard</span>
            <span className="text-[hsl(0_0%_20%)]">→</span>
            <span className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors" onClick={() => navigate("/document-generation")}>Document Generation</span>
            <span className="text-[hsl(0_0%_20%)]">→</span>
            <span className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors" onClick={() => navigate(-1)}>Choose Path</span>
            <span className="text-[hsl(0_0%_20%)]">→</span>
            <span className="text-foreground">{subtitle}</span>
          </nav>
        </div>
        <div className="hidden sm:flex items-center gap-0">
          {["Type", "Path", "Configure"].map((step, i) => (
            <div key={step} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${i <= 2 ? "bg-primary" : "border border-[hsl(0_0%_20%)]"}`} />
                <span className={`font-mono-label text-[10px] tracking-wider ${i === 2 ? "text-foreground" : "text-[hsl(0_0%_33%)]"}`}>{step}</span>
              </div>
              {i < 2 && <div className="w-8 h-px bg-[hsl(0_0%_13%)] mx-1 -mt-4" />}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-7 flex justify-center flex-shrink-0">
        <div className="inline-flex items-center gap-2 bg-secondary border border-border rounded-[20px] py-1.5 px-3.5">
          <span className="w-1.5 h-1.5 rounded-sm bg-primary flex-shrink-0" />
          <span className="font-mono-label text-xs text-foreground tracking-wide">{docType} — Upload & AI Autofill</span>
        </div>
      </div>
    </>
  );

  // ── Stage: Upload ──────────────────────────────────────────────────────────

  if (stage === "upload") {
    return (
      <div className="flex min-h-screen bg-background">
        <AppSidebar activeItem="New Project" />
        <div className="flex-1 flex flex-col min-w-0">
          {renderTop("Upload Documents")}
          <main className="flex-1 overflow-y-auto py-10 px-6">
            <div className="max-w-[720px] mx-auto space-y-6 animate-fade-up">

              {/* Header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center pill bg-secondary border border-border text-primary font-mono-label text-[11px] tracking-wider mb-4">#03 — Configure</div>
                <h1 className="text-[36px] font-light text-foreground tracking-tight">Upload your documents</h1>
                <p className="text-muted-foreground text-[15px] mt-3 max-w-[480px] mx-auto leading-relaxed">
                  Drop anything you have — rough notes, briefs, existing docs. Our AI extracts everything and fills your SOW automatically.
                </p>
              </div>

              {/* Project context */}
              <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-2 font-mono-label tracking-wider uppercase">{cfg.contextLabel}</label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder={cfg.contextPlaceholder}
                    className="w-full rounded-lg bg-background border border-border px-4 py-3 text-sm text-foreground placeholder:text-[hsl(0_0%_28%)] outline-none focus:border-primary transition-colors duration-150"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-2 font-mono-label tracking-wider uppercase">{cfg.descLabel} <span className="normal-case text-[hsl(0_0%_30%)]">(optional)</span></label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={cfg.descPlaceholder}
                    rows={3}
                    className="w-full rounded-lg bg-background border border-border px-4 py-3 text-sm text-foreground placeholder:text-[hsl(0_0%_28%)] resize-none outline-none focus:border-primary transition-colors duration-150"
                  />
                </div>
              </div>

              {/* Upload zone */}
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="text-sm font-medium text-foreground mb-1">Upload Documents</h3>
                <p className="text-xs text-muted-foreground mb-4">{cfg.uploadSubtitle}</p>

                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    relative flex flex-col items-center justify-center gap-3
                    rounded-xl border-2 border-dashed cursor-pointer
                    py-12 transition-all duration-200
                    ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-secondary/30"}
                  `}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-200 ${isDragging ? "bg-primary/20" : "bg-secondary"}`}>
                    <Upload className={`w-5 h-5 transition-colors duration-200 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-foreground font-medium">Drop files here or click to upload</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, TXT, PNG, JPG</p>
                  </div>
                  <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg" className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
                </div>

                {/* File list */}
                {files.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {files.map((f) => (
                      <div key={f.id} className="flex items-center gap-3 rounded-lg bg-secondary border border-border px-4 py-3">
                        <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">{f.name}</p>
                          <p className="text-[11px] text-muted-foreground">{formatBytes(f.size)}</p>
                        </div>
                        <button onClick={() => removeFile(f.id)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CTA */}
              <div className="flex flex-col items-center gap-3 pt-2 pb-8">
                <button
                  onClick={startProcessing}
                  className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-all duration-200"
                >
                  <Sparkles className="w-4 h-4" />
                  {cfg.analyseBtn}
                  <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-[12px] text-muted-foreground">{cfg.analyseHint}</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ── Stage: Processing ──────────────────────────────────────────────────────

  if (stage === "processing") {
    return (
      <div className="flex min-h-screen bg-background">
        <AppSidebar activeItem="New Project" />
        <div className="flex-1 flex flex-col min-w-0">
          {renderTop("Analysing")}
          <main className="flex-1 flex items-center justify-center px-6">
            <div className="max-w-[480px] w-full text-center animate-fade-up">
              <div className="w-16 h-16 rounded-2xl bg-secondary border border-border flex items-center justify-center mx-auto mb-8">
                <Sparkles className="w-7 h-7 text-primary animate-pulse" />
              </div>
              <h2 className="text-2xl font-light text-foreground mb-2">
                {cfg.processingSteps[Math.min(processingStep, cfg.processingSteps.length - 1)]}
              </h2>
              <p className="text-sm text-muted-foreground mb-10">This usually takes a few seconds</p>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-200 ease-out"
                  style={{ width: `${processingProgress}%` }}
                />
              </div>
              <p className="font-mono-label text-[11px] text-primary tracking-wider">{Math.round(processingProgress)}%</p>

              {/* Steps */}
              <div className="mt-10 space-y-2 text-left">
                {cfg.processingSteps.map((step, i) => (
                  <div key={step} className={`flex items-center gap-3 text-sm transition-all duration-300 ${i <= processingStep ? "text-foreground" : "text-[hsl(0_0%_25%)]"}`}>
                    <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                      {i < processingStep ? (
                        <Check className="w-3.5 h-3.5 text-primary" />
                      ) : i === processingStep ? (
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      ) : (
                        <span className="w-2 h-2 rounded-full border border-[hsl(0_0%_25%)]" />
                      )}
                    </span>
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ── Stage: Results ─────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar activeItem="New Project" />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {renderTop("AI Results")}

        {/* Summary banner */}
        <div className="mx-6 lg:mx-8 mt-5 rounded-xl border border-border bg-card px-5 py-4 flex flex-wrap items-center gap-4 justify-between flex-shrink-0 animate-fade-up">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{cfg.aiLabel} {aiPercent}%</p>
                <p className="text-[11px] text-muted-foreground">{autofilledCount} questions answered</p>
              </div>
            </div>
            <div className="w-px h-8 bg-border hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[hsl(38_92%_50%_/_0.1)] border border-[hsl(38_92%_50%_/_0.2)] flex items-center justify-center">
                <Star className="w-4 h-4 text-[hsl(38_92%_50%)]" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{needsInputCount} need your input</p>
                <p className="text-[11px] text-muted-foreground">Quick to fill in</p>
              </div>
            </div>
          </div>

          {/* Filter */}
          <button
            onClick={() => setFilterMode((m) => m === "all" ? "needs-input" : "all")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-medium transition-all duration-200 ${
              filterMode === "needs-input"
                ? "border-[hsl(38_92%_50%_/_0.4)] bg-[hsl(38_92%_50%_/_0.08)] text-[hsl(38_92%_50%)]"
                : "border-border bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            {filterMode === "needs-input" ? cfg.filterActiveLabel : cfg.filterLabel}
          </button>
        </div>

        {/* Main split */}
        <div className="flex flex-1 mt-4 overflow-hidden">

          {/* Left nav */}
          <aside className="hidden lg:flex flex-col w-56 xl:w-64 flex-shrink-0 px-4 xl:px-6 border-r border-border overflow-y-auto pb-8">
            <p className="font-mono-label text-[10px] text-muted-foreground tracking-widest uppercase mb-4 mt-1">Sections</p>
            <nav className="space-y-0.5">
              {activeSections.map((s, i) => {
                const { needsInput } = getSectionStats(s, answers);
                const isActive = i === currentSection;
                return (
                  <button
                    key={s.id}
                    onClick={() => setCurrentSection(i)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 ${
                      isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <span className="text-sm flex-1 leading-tight">{s.short}</span>
                    {needsInput > 0 && (
                      <span className="flex items-center gap-1 flex-shrink-0">
                        <Star className="w-3 h-3 text-[hsl(38_92%_50%)]" />
                        <span className="font-mono-label text-[10px] text-[hsl(38_92%_50%)]">{needsInput}</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Save indicator */}
            <div className="mt-6 px-3">
              <span className={`font-mono-label text-[10px] tracking-wider transition-opacity duration-300 ${saveStatus === "saved" ? "text-primary opacity-100" : "opacity-0"}`}>
                ✓ SAVED
              </span>
            </div>
          </aside>

          {/* Right questions */}
          <main className="flex-1 overflow-y-auto px-6 lg:px-10 xl:px-14 pb-32">

            {/* Section header */}
            <div className="mb-6 mt-1">
              <div className="inline-flex items-center pill bg-secondary border border-border text-primary font-mono-label text-[11px] tracking-wider mb-3">
                #{section.number} — {section.short}
              </div>
              <h2 className="text-xl font-light text-foreground tracking-tight">{section.title}</h2>
              <p className="text-xs text-muted-foreground mt-1">Review AI answers and fill in anything missing</p>
            </div>

            {/* Feature builder (FRD features section) */}
            {section.builderType === "feature-builder" && (
              <div className="space-y-4 max-w-2xl mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 font-mono-label text-[10px] text-primary tracking-wider">
                    <Sparkles className="w-3 h-3" /> AI mapped {featureCards.length} features
                  </span>
                </div>
                {featureCards.map((card, ci) => (
                  <div key={card.id} className="rounded-2xl border border-primary/20 bg-[hsl(215_50%_7%)] animate-fade-up" style={{ animationDelay: `${ci * 60}ms` }}>
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1 font-mono-label text-[10px] text-primary tracking-widest"><Sparkles className="w-3 h-3" /> FEATURE {String(ci + 1).padStart(2, "0")}</span>
                        <span className="text-sm font-medium text-foreground">{card.name || "Unnamed Feature"}</span>
                      </div>
                      <button onClick={() => toggleFeatureCard(card.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                        {card.collapsed ? <ArrowRight className="w-4 h-4 rotate-90" /> : <ArrowRight className="w-4 h-4 -rotate-90" />}
                      </button>
                    </div>
                    {!card.collapsed && (
                      <div className="p-6 grid grid-cols-1 gap-4">
                        {([ { field: "name", label: "Feature Name", rows: 1 }, { field: "purpose", label: "Purpose", rows: 2 }, { field: "userActions", label: "User Actions", rows: 2 }, { field: "inputs", label: "Inputs", rows: 2 }, { field: "outputs", label: "Outputs", rows: 2 }, { field: "validations", label: "Validations", rows: 2 }, { field: "errorHandling", label: "Error Handling", rows: 2 } ] as { field: keyof Omit<FeatureCard,"id"|"collapsed">; label: string; rows: number }[]).map(({ field, label, rows }) => (
                          <div key={field}>
                            <label className="block text-xs font-medium text-muted-foreground mb-1.5 font-mono-label tracking-wider uppercase">{label}</label>
                            <textarea value={card[field]} onChange={(e) => updateFeatureCard(card.id, field, e.target.value)} rows={rows} className="w-full rounded-lg bg-background border border-primary/20 px-4 py-2.5 text-sm text-foreground placeholder:text-[hsl(0_0%_28%)] resize-none outline-none focus:border-primary transition-colors duration-150" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Questions */}
            <div className="space-y-4 max-w-2xl">
              {!section.builderType && visibleQuestions.length === 0 && filterMode === "needs-input" && (
                <div className="rounded-2xl border border-border bg-card/50 p-8 text-center">
                  <Check className="w-6 h-6 text-primary mx-auto mb-2" />
                  <p className="text-sm text-foreground font-medium">All gaps filled in this section</p>
                  <p className="text-xs text-muted-foreground mt-1">Switch to "All" to review AI answers</p>
                </div>
              )}

              {visibleQuestions.map((q, qi) => {
                const entry = answers[q.id] ?? { value: "", state: "optional" as AnswerState, edited: false };
                const isAutofilled = entry.state === "autofilled";
                const isNeedsInput = entry.state === "needs-input";
                const isEmpty = !entry.value.trim();

                return (
                  <div
                    key={q.id}
                    className={`rounded-2xl border p-6 transition-all duration-200 animate-fade-up ${
                      isAutofilled && !isEmpty
                        ? "border-primary/20 bg-[hsl(215_50%_7%)]"
                        : isNeedsInput && isEmpty
                          ? "border-[hsl(38_92%_50%_/_0.25)] bg-[hsl(38_20%_7%)]"
                          : "border-border bg-card"
                    }`}
                    style={{ animationDelay: `${qi * 60}ms` }}
                  >
                    {/* Question header */}
                    <div className="flex items-start justify-between mb-1 gap-3">
                      <label className="text-[15px] text-foreground font-medium leading-snug flex-1">{q.label}</label>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {entry.edited && (
                          <span className="font-mono-label text-[10px] text-muted-foreground tracking-wider">EDITED</span>
                        )}
                        {isAutofilled && !isEmpty && (
                          <span className="inline-flex items-center gap-1 font-mono-label text-[10px] text-primary tracking-wider">
                            <Sparkles className="w-3 h-3" /> AI
                          </span>
                        )}
                        {isNeedsInput && isEmpty && (
                          <span className="inline-flex items-center gap-1 font-mono-label text-[10px] text-[hsl(38_92%_50%)] tracking-wider">
                            <Star className="w-3 h-3" /> {cfg.neededLabel}
                          </span>
                        )}
                        {!isNeedsInput && !isAutofilled && (
                          <span className="font-mono-label text-[10px] text-[hsl(0_0%_30%)] tracking-wider">OPTIONAL</span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{q.helper}</p>

                    <textarea
                      value={entry.value}
                      onChange={(e) => handleEdit(q.id, e.target.value)}
                      placeholder={isNeedsInput && isEmpty ? "⭐ " + q.placeholder : q.placeholder}
                      rows={entry.value.length > 120 ? 4 : 3}
                      className={`w-full rounded-lg border px-4 py-3 text-sm text-foreground resize-none outline-none transition-colors duration-150 ${
                        isAutofilled && !isEmpty
                          ? "bg-background border-primary/20 focus:border-primary placeholder:text-[hsl(0_0%_28%)]"
                          : isNeedsInput && isEmpty
                            ? "bg-background border-[hsl(38_92%_50%_/_0.3)] focus:border-[hsl(38_92%_50%)] placeholder:text-[hsl(38_60%_35%)]"
                            : "bg-background border-border focus:border-primary placeholder:text-[hsl(0_0%_28%)]"
                      }`}
                    />

                    {isNeedsInput && isEmpty && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <AlertCircle className="w-3 h-3 text-[hsl(38_92%_50%)]" />
                        <p className="text-[11px] text-[hsl(38_92%_50%)]">This information wasn't found in your documents</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Section navigation */}
            <div className="flex items-center justify-between max-w-2xl mt-6">
              <button
                onClick={() => { if (currentSection > 0) setCurrentSection((s) => s - 1); }}
                disabled={currentSection === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Previous
              </button>
              <button
                onClick={() => { if (currentSection < activeSections.length - 1) setCurrentSection((s) => s + 1); }}
                disabled={currentSection === activeSections.length - 1}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                Next Section <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </main>
        </div>

        {/* Sticky bottom CTA */}
        <div className="flex-shrink-0 border-t border-border bg-card px-6 lg:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-32 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${aiPercent}%` }} />
            </div>
            <span className="font-mono-label text-[11px] text-muted-foreground">{aiPercent}% ready</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFilterMode((m) => m === "all" ? "needs-input" : "all")}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-secondary text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Review gaps
            </button>
            <button
              onClick={() => navigate(`${cfg.generateRoute}?type=${docType}`)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors duration-200"
            >
              {cfg.generateLabel} <Zap className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadGapFlow;
