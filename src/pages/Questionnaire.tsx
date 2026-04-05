import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Zap,
  AlignLeft,
  Plus,
  Trash2,
} from "lucide-react";

// ─── Data ────────────────────────────────────────────────────────────────────

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
  conditions: string;
  collapsed: boolean;
};

const SECTIONS: Section[] = [
  {
    id: "org",
    number: "01",
    title: "Organization & Project Context",
    short: "Organization",
    questions: [
      {
        id: "org_name",
        label: "Tell us about your organization",
        helper: "Briefly describe what your company does, its mission, and core focus.",
        placeholder: "e.g. Acme Corp is a fintech company focused on payment infrastructure for SMBs…",
      },
      {
        id: "org_client",
        label: "Who is the client or stakeholder for this project?",
        helper: "Name of the client company and the primary contact, if known.",
        placeholder: "e.g. Client: XYZ Bank, Contact: Sarah Mitchell (Head of Product)…",
      },
      {
        id: "org_background",
        label: "What is the background or context behind this project?",
        helper: "Why is this project happening? What triggered it?",
        placeholder: "e.g. The client's existing system is outdated and cannot scale beyond 10k users…",
      },
    ],
  },
  {
    id: "objectives",
    number: "02",
    title: "Project Objectives",
    short: "Objectives",
    questions: [
      {
        id: "obj_goal",
        label: "What is the primary goal of this project?",
        helper: "State the single most important outcome this project must deliver.",
        placeholder: "e.g. Build a white-label payment gateway that processes $1M+ transactions daily…",
      },
      {
        id: "obj_secondary",
        label: "Are there secondary objectives?",
        helper: "Any supporting goals, business outcomes, or side benefits.",
        placeholder: "e.g. Reduce manual reconciliation time by 70%, improve audit trail compliance…",
      },
      {
        id: "obj_success",
        label: "How will success be measured?",
        helper: "KPIs, metrics, or acceptance criteria that define project success.",
        placeholder: "e.g. System handles 500 concurrent users, 99.9% uptime, zero critical bugs at go-live…",
      },
    ],
  },
  {
    id: "scope",
    number: "03",
    title: "Scope of Work",
    short: "Scope",
    questions: [
      {
        id: "scope_in",
        label: "What is included in this project?",
        helper: "List the deliverables, features, or areas of work that are in scope.",
        placeholder: "e.g. API development, admin dashboard, mobile app (iOS & Android), QA testing, deployment…",
      },
      {
        id: "scope_out",
        label: "What is explicitly OUT of scope?",
        helper: "Any items that could cause confusion — clarify they are not part of this engagement.",
        placeholder: "e.g. Legacy data migration, third-party integrations beyond Stripe, ongoing support post-launch…",
      },
      {
        id: "scope_phases",
        label: "Is the project divided into phases or milestones?",
        helper: "Describe the phases if work will be delivered in stages.",
        placeholder: "e.g. Phase 1: MVP in 6 weeks. Phase 2: Extended features in 12 weeks…",
      },
      {
        id: "scope_deliverables",
        label: "What are the key deliverables?",
        helper: "Tangible outputs the client will receive at the end of this engagement.",
        placeholder: "e.g. Source code, deployment scripts, user documentation, training session, 3-month warranty…",
      },
    ],
  },
  {
    id: "timeline",
    number: "04",
    title: "Timeline & Schedule",
    short: "Timeline",
    questions: [
      {
        id: "timeline_start",
        label: "When does the project start?",
        helper: "Planned or expected start date.",
        placeholder: "e.g. 1st May 2025, or 'Two weeks after contract signing'…",
      },
      {
        id: "timeline_end",
        label: "When is the expected completion date?",
        helper: "Final delivery or go-live date.",
        placeholder: "e.g. 31st July 2025, approximately 12 weeks from start…",
      },
      {
        id: "timeline_milestones",
        label: "Are there any key milestones or checkpoints?",
        helper: "Intermediate dates where progress will be reviewed.",
        placeholder: "e.g. Week 2: Design approval. Week 6: Beta release. Week 10: UAT sign-off…",
      },
    ],
  },
  {
    id: "budget",
    number: "05",
    title: "Budget & Commercial Terms",
    short: "Budget",
    questions: [
      {
        id: "budget_total",
        label: "What is the total project budget or commercial value?",
        helper: "Fixed price, T&M rate, or budget range.",
        placeholder: "e.g. Fixed price: £85,000 + VAT, or Time & Materials at £850/day…",
      },
      {
        id: "budget_payment",
        label: "What are the payment terms and schedule?",
        helper: "When and how payments will be made.",
        placeholder: "e.g. 30% upfront, 40% at Phase 1 delivery, 30% at final sign-off…",
      },
      {
        id: "budget_expenses",
        label: "Are there any additional costs or expenses?",
        helper: "Travel, licenses, third-party services, or infrastructure costs.",
        placeholder: "e.g. AWS hosting costs at client's expense. Travel billed at cost…",
      },
    ],
  },
  {
    id: "roles",
    number: "06",
    title: "Roles & Responsibilities",
    short: "Roles",
    questions: [
      {
        id: "roles_vendor",
        label: "Who is on the vendor / delivery team?",
        helper: "List key roles and their responsibilities.",
        placeholder: "e.g. Project Manager, 2x Backend Engineers, 1x Designer, QA Lead…",
      },
      {
        id: "roles_client",
        label: "What is expected from the client team?",
        helper: "Client responsibilities, approvals, or resources they must provide.",
        placeholder: "e.g. Client to provide API access within Week 1, assign a product owner for weekly reviews…",
      },
      {
        id: "roles_escalation",
        label: "Who are the escalation contacts on both sides?",
        helper: "Decision-makers for issues, blockers, or changes.",
        placeholder: "e.g. Vendor: James (CTO) | Client: Sarah (VP Engineering)…",
      },
    ],
  },
  {
    id: "assumptions",
    number: "07",
    title: "Assumptions & Dependencies",
    short: "Assumptions",
    questions: [
      {
        id: "assumptions_list",
        label: "What assumptions are you making to deliver this project?",
        helper: "Conditions you are taking for granted. If these are wrong, scope may change.",
        placeholder: "e.g. Client will provide staging environment. All APIs documented by Week 1…",
      },
      {
        id: "dependencies_list",
        label: "What external dependencies exist?",
        helper: "Third-party services, client teams, or resources outside your control.",
        placeholder: "e.g. Stripe API integration, client legal team sign-off on contracts…",
      },
      {
        id: "assumptions_constraints",
        label: "Are there any known constraints?",
        helper: "Technical, regulatory, resource, or time constraints you're aware of.",
        placeholder: "e.g. Must use client's existing Azure infrastructure. GDPR compliance mandatory…",
      },
    ],
  },
  {
    id: "risk",
    number: "08",
    title: "Risk Management",
    short: "Risk",
    questions: [
      {
        id: "risk_list",
        label: "What are the main risks to this project?",
        helper: "Identify risks that could impact delivery, quality, or budget.",
        placeholder: "e.g. Scope creep, delayed client approvals, unclear requirements, key person dependency…",
      },
      {
        id: "risk_mitigation",
        label: "How will risks be managed or mitigated?",
        helper: "Planned responses or mitigation strategies.",
        placeholder: "e.g. Weekly status calls, change request process for scope changes, buffer weeks in timeline…",
      },
      {
        id: "risk_change",
        label: "What is the change management process?",
        helper: "How will changes to scope, timeline, or budget be handled?",
        placeholder: "e.g. All changes require written approval. Impact assessed within 48 hours, priced accordingly…",
      },
    ],
  },
  {
    id: "acceptance",
    number: "09",
    title: "Acceptance Criteria",
    short: "Acceptance",
    questions: [
      {
        id: "acceptance_criteria",
        label: "What defines project completion?",
        helper: "Specific criteria or tests the deliverables must pass for client sign-off.",
        placeholder: "e.g. All test cases pass, performance benchmarks met, UAT completed with no critical bugs…",
      },
      {
        id: "acceptance_process",
        label: "What is the review and sign-off process?",
        helper: "How will deliverables be reviewed and formally accepted?",
        placeholder: "e.g. 5 business days for client review. Formal sign-off via email or contract amendment…",
      },
      {
        id: "acceptance_warranty",
        label: "Is there a warranty or support period after delivery?",
        helper: "Any post-delivery support obligations.",
        placeholder: "e.g. 30-day bug fix warranty. Critical issues resolved within 24 hours…",
      },
    ],
  },
  {
    id: "legal",
    number: "10",
    title: "Legal & Compliance",
    short: "Legal",
    questions: [
      {
        id: "legal_ip",
        label: "Who owns the intellectual property (IP)?",
        helper: "Ownership of code, designs, and deliverables after project completion.",
        placeholder: "e.g. Full IP transferred to client upon final payment. Vendor retains rights to generic frameworks…",
      },
      {
        id: "legal_confidentiality",
        label: "Are there confidentiality or NDA requirements?",
        helper: "Data protection, NDAs, or information security obligations.",
        placeholder: "e.g. Mutual NDA in place. No client data to be stored outside EU. GDPR compliant…",
      },
      {
        id: "legal_governing",
        label: "What is the governing law and jurisdiction?",
        helper: "Legal framework under which this agreement operates.",
        placeholder: "e.g. Governed by English Law. Disputes resolved under English courts…",
      },
    ],
  },
  {
    id: "communication",
    number: "11",
    title: "Communication Plan",
    short: "Communication",
    questions: [
      {
        id: "comm_cadence",
        label: "What is the communication cadence?",
        helper: "Meeting frequency, stand-ups, and review calls.",
        placeholder: "e.g. Weekly project call every Monday. Fortnightly steering committee. Daily Slack updates…",
      },
      {
        id: "comm_tools",
        label: "What tools will be used for communication and project tracking?",
        helper: "Tools, platforms, and channels agreed with the client.",
        placeholder: "e.g. Slack for daily comms, Jira for task tracking, Confluence for documentation, Zoom for calls…",
      },
      {
        id: "comm_reporting",
        label: "What reports or updates will be shared with the client?",
        helper: "Format and frequency of progress reports.",
        placeholder: "e.g. Weekly status report every Friday. Monthly executive summary…",
      },
    ],
  },
];

const PRD_SECTIONS: Section[] = [
  {
    id: "vision",
    number: "01",
    title: "Product Vision",
    short: "Vision",
    questions: [
      {
        id: "prd_vision_describe",
        label: "Describe your product vision",
        helper: "What are you building and why does it matter?",
        placeholder: "e.g. A platform that helps small business owners manage invoicing and payments without needing an accountant…",
      },
      {
        id: "prd_vision_problem",
        label: "What problem are you solving?",
        helper: "What pain point does your product address? Who feels this pain most?",
        placeholder: "e.g. Freelancers spend 5+ hours/week on admin tasks that don't generate revenue…",
      },
      {
        id: "prd_vision_longterm",
        label: "What is your long-term vision?",
        helper: "Where do you see this product in 3–5 years?",
        placeholder: "e.g. Become the default financial OS for 1M+ independent creators worldwide…",
      },
    ],
  },
  {
    id: "users",
    number: "02",
    title: "Target Users",
    short: "Users",
    questions: [
      {
        id: "prd_users_primary",
        label: "Who are your primary users?",
        helper: "Describe their background, profession, and context of use.",
        placeholder: "e.g. Working professionals aged 25–40 using fintech apps on mobile daily…",
      },
      {
        id: "prd_users_painpoints",
        label: "What are their biggest pain points?",
        helper: "What frustrates them today? What workarounds are they using?",
        placeholder: "e.g. They juggle 3 different tools to do what should be one workflow…",
      },
      {
        id: "prd_users_persona",
        label: "Describe your core user persona",
        helper: "Name, role, goals, and a typical day in their life.",
        placeholder: "e.g. Maya, 32, freelance designer. Juggles 5 clients. Needs to invoice fast and get paid faster…",
      },
    ],
  },
  {
    id: "experience",
    number: "03",
    title: "User Experience Goals",
    short: "Experience",
    questions: [
      {
        id: "prd_exp_feeling",
        label: "How should users feel when using your product?",
        helper: "Describe the emotional experience — not features, but feelings.",
        placeholder: "e.g. Calm, in control, confident. Never confused. Like the app is doing the thinking for them…",
      },
      {
        id: "prd_exp_journey",
        label: "Describe the ideal user journey",
        helper: "From first touch to core value — what does the critical path look like?",
        placeholder: "e.g. Sign up → connect bank → see dashboard → send first invoice in under 3 minutes…",
      },
      {
        id: "prd_exp_reference",
        label: "Are there any products whose UX inspires you?",
        helper: "References help set the quality bar.",
        placeholder: "e.g. Linear for speed and clarity, Notion for flexibility, Stripe for trust and polish…",
      },
    ],
  },
  {
    id: "features",
    number: "04",
    title: "Features & Functionality",
    short: "Features",
    questions: [
      {
        id: "prd_feat_core",
        label: "What are the core features of your product?",
        helper: "What MUST be included for your product to deliver its core value?",
        placeholder: "e.g. Invoice creation, payment tracking, client management, automated reminders…",
      },
      {
        id: "prd_feat_mvp",
        label: "What is the MVP scope?",
        helper: "What is the minimum set of features needed to launch and learn?",
        placeholder: "e.g. MVP = invoice creation + payment link + basic dashboard. Everything else is Phase 2…",
      },
      {
        id: "prd_feat_later",
        label: "What features can come later?",
        helper: "What is valuable but not critical for the first release?",
        placeholder: "e.g. Tax reports, multi-currency, team accounts, integrations with accounting tools…",
      },
    ],
  },
  {
    id: "differentiation",
    number: "05",
    title: "Differentiation & Positioning",
    short: "Differentiation",
    questions: [
      {
        id: "prd_diff_competitors",
        label: "Who are your main competitors?",
        helper: "List direct and indirect alternatives your users currently use.",
        placeholder: "e.g. FreshBooks, Wave, HoneyBook, or just spreadsheets and WhatsApp…",
      },
      {
        id: "prd_diff_unique",
        label: "What makes your product different?",
        helper: "Your unique angle — why would someone choose you over existing options?",
        placeholder: "e.g. We're the only tool built specifically for solopreneurs, not teams. 10x simpler…",
      },
      {
        id: "prd_diff_positioning",
        label: "How would you describe your product in one sentence?",
        helper: "Your positioning statement. Who it's for, what it does, why it's better.",
        placeholder: "e.g. The fastest way for freelancers to get paid — without the complexity of accounting software…",
      },
    ],
  },
  {
    id: "metrics",
    number: "06",
    title: "Success Metrics",
    short: "Metrics",
    questions: [
      {
        id: "prd_metrics_north_star",
        label: "What is your north star metric?",
        helper: "The single number that best captures product value being delivered.",
        placeholder: "e.g. Monthly invoices sent, or 'time from sign-up to first payment received'…",
      },
      {
        id: "prd_metrics_kpis",
        label: "What KPIs will you track?",
        helper: "Supporting metrics that indicate product health.",
        placeholder: "e.g. DAU/MAU ratio, invoice completion rate, churn rate, NPS score…",
      },
      {
        id: "prd_metrics_launch",
        label: "What does a successful launch look like?",
        helper: "Measurable goals for the first 30–90 days post-launch.",
        placeholder: "e.g. 500 sign-ups in 30 days, 40% activation rate, <5% week-1 churn…",
      },
    ],
  },
  {
    id: "content",
    number: "07",
    title: "Content & Data",
    short: "Content",
    questions: [
      {
        id: "prd_content_types",
        label: "What types of content or data does the product handle?",
        helper: "What will users create, upload, view, or manage?",
        placeholder: "e.g. Invoices, client profiles, payment records, expense receipts, reports…",
      },
      {
        id: "prd_content_structure",
        label: "How is information structured in your product?",
        helper: "Key entities and how they relate to each other.",
        placeholder: "e.g. User → Clients → Projects → Invoices → Payments. Each invoice has line items…",
      },
      {
        id: "prd_content_external",
        label: "Does the product integrate with external data sources?",
        helper: "APIs, third-party services, or existing tools.",
        placeholder: "e.g. Stripe for payments, Plaid for bank data, Gmail for sending invoices…",
      },
    ],
  },
  {
    id: "constraints",
    number: "08",
    title: "Constraints & Requirements",
    short: "Constraints",
    questions: [
      {
        id: "prd_const_technical",
        label: "Are there technical constraints or platform requirements?",
        helper: "Must-use technologies, existing infrastructure, or platform targets.",
        placeholder: "e.g. Must be mobile-first (iOS + Android). Backend must use existing Node.js API…",
      },
      {
        id: "prd_const_compliance",
        label: "Are there compliance, legal, or security requirements?",
        helper: "Regulations, data privacy laws, or security standards to meet.",
        placeholder: "e.g. GDPR compliant, PCI-DSS for payment handling, SOC 2 target within 12 months…",
      },
      {
        id: "prd_const_timeline",
        label: "Are there hard deadlines or business constraints?",
        helper: "Launch dates, funding milestones, or market windows.",
        placeholder: "e.g. Must launch before Q3 to capture freelance season. Board demo in 8 weeks…",
      },
    ],
  },
  {
    id: "assumptions",
    number: "09",
    title: "Assumptions & Risks",
    short: "Assumptions",
    questions: [
      {
        id: "prd_assume_user",
        label: "What assumptions are you making about user behaviour?",
        helper: "Hypotheses about how users will discover, adopt, and use the product.",
        placeholder: "e.g. We assume users will check the dashboard daily. We assume word-of-mouth will drive growth…",
      },
      {
        id: "prd_assume_market",
        label: "What market assumptions are you making?",
        helper: "Beliefs about market size, competition, or timing.",
        placeholder: "e.g. The market is underserved. Existing tools are too complex for solo users…",
      },
      {
        id: "prd_assume_risks",
        label: "What are the biggest risks to this product?",
        helper: "What could prevent this product from succeeding?",
        placeholder: "e.g. Low activation if onboarding is confusing. Competitor launches similar feature first…",
      },
    ],
  },
  {
    id: "future",
    number: "10",
    title: "Future Scope",
    short: "Future Scope",
    questions: [
      {
        id: "prd_future_v2",
        label: "What is the vision for v2 and beyond?",
        helper: "Features, markets, or capabilities planned for future phases.",
        placeholder: "e.g. v2: team accounts and sub-contractor management. v3: AI-powered financial forecasting…",
      },
      {
        id: "prd_future_expansion",
        label: "Are there plans to expand to new user segments or markets?",
        helper: "Geographic, demographic, or vertical expansion ideas.",
        placeholder: "e.g. Start with UK freelancers, expand to EU in Year 2, US in Year 3…",
      },
      {
        id: "prd_future_platform",
        label: "Do you see this becoming a platform or ecosystem?",
        helper: "Third-party integrations, marketplace, or API access for developers.",
        placeholder: "e.g. Long-term: open API so accountants can build custom views on top of our data…",
      },
    ],
  },
];

const FRD_SECTIONS: Section[] = [
  {
    id: "frd_overview",
    number: "01",
    title: "System Overview",
    short: "System Overview",
    questions: [
      {
        id: "frd_overview_describe",
        label: "Describe the system you want to build",
        helper: "Explain what the system does at a high level — its purpose and primary function.",
        placeholder: "e.g. A multi-tenant SaaS platform for managing client onboarding workflows with role-based access…",
      },
      {
        id: "frd_overview_modules",
        label: "What are the main components or modules?",
        helper: "List the functional areas or subsystems the platform will have.",
        placeholder: "e.g. Authentication, Dashboard, Client Management, Document Vault, Notifications, Admin Panel…",
      },
      {
        id: "frd_overview_users",
        label: "Who are the end users of this system?",
        helper: "Describe the user types and their technical familiarity.",
        placeholder: "e.g. Internal ops team (power users), external clients (non-technical), system admins…",
      },
    ],
  },
  {
    id: "frd_roles",
    number: "02",
    title: "User Roles & Permissions",
    short: "User Roles",
    questions: [
      {
        id: "frd_roles_types",
        label: "What types of users will use this system?",
        helper: "List all roles. Example: Admin, Manager, Standard User, Guest, Super Admin.",
        placeholder: "e.g. Super Admin, Account Manager, Client User, Read-Only Viewer…",
      },
      {
        id: "frd_roles_permissions",
        label: "What can each role do?",
        helper: "Map roles to capabilities — create, read, update, delete, approve.",
        placeholder: "e.g. Admin: full access. Manager: can create/edit but not delete. Client: read-only on shared docs…",
      },
      {
        id: "frd_roles_restrictions",
        label: "Are there any data isolation or access restriction rules?",
        helper: "Multi-tenant boundaries, row-level security, or organisation-level isolation.",
        placeholder: "e.g. Each organisation can only see their own data. Admins can view across orgs…",
      },
    ],
  },
  {
    id: "frd_auth",
    number: "03",
    title: "Authentication & Security",
    short: "Authentication",
    questions: [
      {
        id: "frd_auth_method",
        label: "How should users log in?",
        helper: "Authentication methods: email/password, magic link, SSO, Google/Microsoft OAuth, OTP.",
        placeholder: "e.g. Email + password with email verification. Optional Google SSO. 2FA via SMS or Authenticator…",
      },
      {
        id: "frd_auth_session",
        label: "How should sessions be managed?",
        helper: "Session expiry, remember me, token refresh, concurrent login handling.",
        placeholder: "e.g. JWT tokens. 7-day session with refresh. Force logout after 30 min idle. Single session only…",
      },
      {
        id: "frd_auth_security",
        label: "What security measures should be included?",
        helper: "Rate limiting, brute force protection, password policy, audit logs.",
        placeholder: "e.g. Lock account after 5 failed attempts. Passwords: min 10 chars, 1 uppercase, 1 symbol. All actions logged…",
      },
    ],
  },
  {
    id: "frd_features",
    number: "04",
    title: "Functional Requirements",
    short: "Features",
    builderType: "feature-builder",
    questions: [],
  },
  {
    id: "frd_flows",
    number: "05",
    title: "User Flows",
    short: "User Flows",
    questions: [
      {
        id: "frd_flows_critical",
        label: "What are the critical user flows?",
        helper: "Step-by-step sequences for the most important actions in the system.",
        placeholder: "e.g. New user signup → email verify → onboarding wizard → dashboard. Client invite → accept → profile setup…",
      },
      {
        id: "frd_flows_happy",
        label: "Describe the happy path for the core workflow",
        helper: "The ideal sequence when everything works as expected.",
        placeholder: "e.g. User logs in → selects project → uploads document → system extracts data → user confirms → saved…",
      },
      {
        id: "frd_flows_alt",
        label: "Are there alternative or exception flows?",
        helper: "Paths taken when the happy path isn't available.",
        placeholder: "e.g. If extraction fails → manual entry fallback. If session expires → redirect to login with state preserved…",
      },
    ],
  },
  {
    id: "frd_ui",
    number: "06",
    title: "UI Behaviour",
    short: "UI Behavior",
    questions: [
      {
        id: "frd_ui_interactions",
        label: "What happens when users interact with key actions?",
        helper: "Define feedback for clicks, submissions, and state changes.",
        placeholder: "e.g. Button click → loading spinner → success toast. Form submit → inline validation → confirmation modal…",
      },
      {
        id: "frd_ui_errors",
        label: "What error states should be shown?",
        helper: "All UI error scenarios: validation, network, auth, empty states.",
        placeholder: "e.g. Invalid email: inline red error. Network failure: banner + retry button. Empty list: illustration + CTA…",
      },
      {
        id: "frd_ui_loading",
        label: "How should loading states be handled?",
        helper: "Skeletons, spinners, progress bars, disabled states during async operations.",
        placeholder: "e.g. Table rows: skeleton loader. Long operations: progress bar with % complete. Buttons: disabled + spinner…",
      },
    ],
  },
  {
    id: "frd_logic",
    number: "07",
    title: "Business Logic",
    short: "Business Logic",
    questions: [
      {
        id: "frd_logic_rules",
        label: "What are the core business rules of this system?",
        helper: "Rules that govern how data behaves, how calculations work, or what triggers what.",
        placeholder: "e.g. Invoice can only be sent if all line items have a price. Status auto-updates when all tasks complete…",
      },
      {
        id: "frd_logic_calculations",
        label: "Are there any calculations or derived values?",
        helper: "Totals, scores, statuses, or any computed fields.",
        placeholder: "e.g. Project completion % = completed tasks / total tasks. Invoice total = sum of line items + VAT…",
      },
      {
        id: "frd_logic_workflows",
        label: "Are there approval workflows or state machines?",
        helper: "Multi-step processes requiring sign-off or conditional progression.",
        placeholder: "e.g. Document: Draft → Review → Approved → Published. Each state change triggers notification…",
      },
    ],
  },
  {
    id: "frd_data",
    number: "08",
    title: "Data & Storage",
    short: "Data",
    questions: [
      {
        id: "frd_data_entities",
        label: "What are the main data entities?",
        helper: "Core tables or objects the system will store and manage.",
        placeholder: "e.g. Users, Organisations, Projects, Documents, Tasks, Comments, Audit Logs…",
      },
      {
        id: "frd_data_relationships",
        label: "How do these entities relate to each other?",
        helper: "One-to-many, many-to-many, ownership, and hierarchy.",
        placeholder: "e.g. Organisation has many Users. Project belongs to Organisation. Document has many Versions…",
      },
      {
        id: "frd_data_retention",
        label: "Are there data retention or archiving requirements?",
        helper: "How long data is kept, soft delete vs hard delete, archiving rules.",
        placeholder: "e.g. Deleted records: soft delete for 90 days. Audit logs: retained 2 years. Exports: stored 30 days…",
      },
    ],
  },
  {
    id: "frd_integrations",
    number: "09",
    title: "Integrations",
    short: "Integrations",
    questions: [
      {
        id: "frd_int_external",
        label: "What external services does the system need to integrate with?",
        helper: "Payment gateways, email providers, CRMs, analytics, cloud storage.",
        placeholder: "e.g. Stripe (payments), SendGrid (email), AWS S3 (file storage), Salesforce (CRM sync)…",
      },
      {
        id: "frd_int_apis",
        label: "Does this system expose or consume APIs?",
        helper: "Internal APIs, public APIs, webhooks, or event streams.",
        placeholder: "e.g. REST API consumed by mobile app. Webhooks to notify client systems of status changes…",
      },
      {
        id: "frd_int_sync",
        label: "Are there any data sync or real-time requirements?",
        helper: "Live updates, polling, WebSockets, or background sync.",
        placeholder: "e.g. Dashboard updates in real-time via WebSocket. Background sync every 15 minutes with CRM…",
      },
    ],
  },
  {
    id: "frd_edge",
    number: "10",
    title: "Edge Cases & Failure Handling",
    short: "Edge Cases",
    questions: [
      {
        id: "frd_edge_failure",
        label: "What should happen if something fails?",
        helper: "API failures, timeout errors, third-party outages, network issues.",
        placeholder: "e.g. Payment API down: show retry option, do not charge twice. File upload fails: preserve form state…",
      },
      {
        id: "frd_edge_concurrency",
        label: "Are there concurrency or race condition scenarios?",
        helper: "Simultaneous edits, double submissions, optimistic UI conflicts.",
        placeholder: "e.g. Two users editing same record: last-write-wins with conflict warning. Prevent double payment on retry…",
      },
      {
        id: "frd_edge_invalid",
        label: "How should invalid or unexpected inputs be handled?",
        helper: "Malformed data, unexpected formats, boundary values.",
        placeholder: "e.g. File exceeds 25MB: show size error before upload. SQL injection: sanitised at API layer…",
      },
    ],
  },
  {
    id: "frd_nonfunc",
    number: "11",
    title: "Non-Functional Requirements",
    short: "Non-Functional",
    questions: [
      {
        id: "frd_nf_performance",
        label: "What performance expectations do you have?",
        helper: "Response times, load times, throughput targets.",
        placeholder: "e.g. API response < 300ms (p95). Page load < 2s. Support 1000 concurrent users at launch…",
      },
      {
        id: "frd_nf_scalability",
        label: "What scalability requirements are needed?",
        helper: "Expected growth, peak load handling, horizontal/vertical scale.",
        placeholder: "e.g. Handle 10x traffic during month-end. Auto-scale on AWS. Database read replicas for reporting…",
      },
      {
        id: "frd_nf_availability",
        label: "What are the uptime and availability requirements?",
        helper: "SLA targets, planned downtime, disaster recovery expectations.",
        placeholder: "e.g. 99.9% uptime SLA. Max 4 hours RTO. Automated failover. Maintenance windows on Sundays 2–4am…",
      },
    ],
  },
  {
    id: "frd_reports",
    number: "12",
    title: "Reporting & Analytics",
    short: "Reports",
    questions: [
      {
        id: "frd_rep_types",
        label: "What reports or dashboards does the system need?",
        helper: "Built-in analytics, export formats, admin reporting.",
        placeholder: "e.g. Project status dashboard, user activity report, revenue summary, monthly export to Excel…",
      },
      {
        id: "frd_rep_filters",
        label: "How should data be filtered and segmented?",
        helper: "Date ranges, user groups, status filters, custom dimensions.",
        placeholder: "e.g. Filter by date range, user role, project status. Group by organisation or region…",
      },
      {
        id: "frd_rep_export",
        label: "What export formats are required?",
        helper: "CSV, Excel, PDF, or API-accessible data.",
        placeholder: "e.g. CSV and Excel exports on all table views. PDF report for client-facing summaries…",
      },
    ],
  },
  {
    id: "frd_notif",
    number: "13",
    title: "Notifications",
    short: "Notifications",
    questions: [
      {
        id: "frd_notif_triggers",
        label: "What events should trigger notifications?",
        helper: "System events that require alerting users — in-app, email, or push.",
        placeholder: "e.g. New task assigned, document approved, payment failed, mention in comment, deadline approaching…",
      },
      {
        id: "frd_notif_channels",
        label: "What notification channels are needed?",
        helper: "In-app notifications, email, SMS, push notifications, Slack/Teams.",
        placeholder: "e.g. In-app bell icon + email for critical events. Optional Slack integration. SMS for payment alerts…",
      },
      {
        id: "frd_notif_prefs",
        label: "Should users be able to manage notification preferences?",
        helper: "Granular control over what notifications are received and how.",
        placeholder: "e.g. Users can toggle per-event preferences. Global mute option. Email digest vs real-time…",
      },
    ],
  },
  {
    id: "frd_acceptance",
    number: "14",
    title: "Acceptance Criteria",
    short: "Acceptance",
    questions: [
      {
        id: "frd_acc_criteria",
        label: "What defines each feature as functionally complete?",
        helper: "Specific, testable conditions for sign-off.",
        placeholder: "e.g. Login: user can authenticate with valid credentials and is redirected to dashboard within 2s…",
      },
      {
        id: "frd_acc_testing",
        label: "What testing requirements exist?",
        helper: "Unit tests, integration tests, UAT, performance tests.",
        placeholder: "e.g. 80% test coverage. All critical flows covered by E2E tests. UAT with 3 client users before go-live…",
      },
      {
        id: "frd_acc_signoff",
        label: "What is the formal sign-off process?",
        helper: "Who reviews and approves the FRD and final deliverables?",
        placeholder: "e.g. Tech lead reviews FRD. Product owner signs off feature completion. Client signs UAT document…",
      },
    ],
  },
];

const SECTIONS_MAP: Record<string, Section[]> = {
  SOW: SECTIONS,
  PRD: PRD_SECTIONS,
  FRD: FRD_SECTIONS,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

type SectionStatus = "empty" | "partial" | "complete";

function getSectionStatus(section: Section, answers: Record<string, string>): SectionStatus {
  const filled = section.questions.filter((q) => answers[q.id]?.trim()).length;
  if (filled === 0) return "empty";
  if (filled === section.questions.length) return "complete";
  return "partial";
}

function getTotalProgress(sections: Section[], answers: Record<string, string>): number {
  const total = sections.reduce((acc, s) => acc + s.questions.length, 0);
  const filled = Object.values(answers).filter((v) => v?.trim() && v !== "—skipped—").length;
  return Math.round((filled / total) * 100);
}

// ─── Component ───────────────────────────────────────────────────────────────

const Questionnaire = () => {
  const [searchParams] = useSearchParams();
  const docType = searchParams.get("type") || "SOW";
  const navigate = useNavigate();

  const sections = SECTIONS_MAP[docType] ?? SECTIONS_MAP["SOW"];
  const generateRoute = `/output-format?type=${docType}`;
  const badgeLabel = docType === "PRD"
    ? "PRD — Product Requirements Document"
    : docType === "FRD"
    ? "FRD — Functional Requirements Document"
    : "SOW — Statement of Work";

  const [currentSection, setCurrentSection] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [guidedMode, setGuidedMode] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const [featureCards, setFeatureCards] = useState<FeatureCard[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addFeatureCard = () => {
    const id = `feat_${Date.now()}`;
    setFeatureCards((prev) => [
      ...prev,
      { id, name: "", purpose: "", userActions: "", inputs: "", outputs: "", validations: "", errorHandling: "", conditions: "", collapsed: false },
    ]);
  };

  const updateFeatureCard = (id: string, field: keyof Omit<FeatureCard, "id" | "collapsed">, value: string) => {
    setFeatureCards((prev) => prev.map((c) => c.id === id ? { ...c, [field]: value } : c));
    setSaveStatus("idle");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveStatus("saved"), 800);
  };

  const toggleFeatureCard = (id: string) => {
    setFeatureCards((prev) => prev.map((c) => c.id === id ? { ...c, collapsed: !c.collapsed } : c));
  };

  const deleteFeatureCard = (id: string) => {
    setFeatureCards((prev) => prev.filter((c) => c.id !== id));
  };

  const section = sections[currentSection];
  const progress = getTotalProgress(sections, answers);
  const visibleQuestions =
    guidedMode && !expanded[section.id]
      ? section.questions.slice(0, 3)
      : section.questions;
  const hasMore = guidedMode && section.questions.length > 3 && !expanded[section.id];

  const handleAnswer = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setSaveStatus("idle");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveStatus("saved"), 800);
  };

  const handleSkip = (id: string) => {
    handleAnswer(id, "—skipped—");
  };

  const isSkipped = (id: string) => answers[id] === "—skipped—";

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const goNext = () => {
    if (currentSection < sections.length - 1) {
      setCurrentSection((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goPrev = () => {
    if (currentSection > 0) {
      setCurrentSection((s) => s - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleGenerate = () => {
    navigate(generateRoute);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar activeItem="New Project" />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">

        {/* ── Top bar ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 lg:px-8 pt-6 flex-shrink-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary transition-all duration-200 hover:-translate-x-1"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <nav className="font-mono-label text-xs tracking-wider flex items-center gap-1.5 flex-wrap">
              <span className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors" onClick={() => navigate("/")}>Dashboard</span>
              <span className="text-[hsl(0_0%_20%)]">→</span>
              <span className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors" onClick={() => navigate("/document-generation")}>Document Generation</span>
              <span className="text-[hsl(0_0%_20%)]">→</span>
              <span className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors" onClick={() => navigate(-1)}>Choose Path</span>
              <span className="text-[hsl(0_0%_20%)]">→</span>
              <span className="text-foreground">Questionnaire</span>
            </nav>
          </div>

          {/* Step indicator */}
          <div className="hidden sm:flex items-center gap-0">
            {["Type", "Path", "Configure"].map((step, i) => (
              <div key={step} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${i <= 2 ? "bg-primary" : "border border-[hsl(0_0%_20%)]"}`} />
                  <span className={`font-mono-label text-[10px] tracking-wider ${i === 2 ? "text-foreground" : "text-[hsl(0_0%_33%)]"}`}>
                    {step}
                  </span>
                </div>
                {i < 2 && <div className="w-8 h-px bg-[hsl(0_0%_13%)] mx-1 -mt-4" />}
              </div>
            ))}
          </div>
        </div>

        {/* ── Context chip ────────────────────────────────────────── */}
        <div className="mt-7 flex justify-center flex-shrink-0">
          <div className="inline-flex items-center gap-2 bg-secondary border border-border rounded-[20px] py-1.5 px-3.5">
            <span className="w-1.5 h-1.5 rounded-sm bg-primary flex-shrink-0" />
            <span className="font-mono-label text-xs text-foreground tracking-wide">
              {badgeLabel}
            </span>
          </div>
        </div>

        {/* ── Main content ─────────────────────────────────────────── */}
        <div className="flex flex-1 mt-6 overflow-hidden">

          {/* ── Left: Section Navigator ─────────────────────────── */}
          <aside className="hidden lg:flex flex-col w-56 xl:w-64 flex-shrink-0 px-4 xl:px-6 border-r border-border overflow-y-auto pb-8">
            <p className="font-mono-label text-[10px] text-muted-foreground tracking-widest uppercase mb-4 mt-1">
              Sections
            </p>
            <nav className="space-y-0.5">
              {sections.map((s, i) => {
                const status = getSectionStatus(s, answers);
                const isActive = i === currentSection;
                return (
                  <button
                    key={s.id}
                    onClick={() => setCurrentSection(i)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left
                      transition-all duration-150
                      ${isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      }
                    `}
                  >
                    {/* Status dot */}
                    <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                      {status === "complete" ? (
                        <span className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-primary-foreground" />
                        </span>
                      ) : status === "partial" ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                      ) : (
                        <span className={`w-2.5 h-2.5 rounded-full border ${isActive ? "border-primary" : "border-[hsl(0_0%_25%)]"}`} />
                      )}
                    </span>
                    <span className="text-sm leading-tight">{s.short}</span>
                    <span className="ml-auto font-mono-label text-[10px] text-[hsl(0_0%_25%)]">
                      {s.number}
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* Progress */}
            <div className="mt-8 px-3">
              <div className="flex justify-between items-center mb-2">
                <span className="font-mono-label text-[10px] text-muted-foreground tracking-wider">PROGRESS</span>
                <span className="font-mono-label text-[10px] text-primary">{progress}%</span>
              </div>
              <div className="h-1 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </aside>

          {/* ── Right: Questions ─────────────────────────────────── */}
          <main className="flex-1 overflow-y-auto px-6 lg:px-10 xl:px-14 pb-32">

            {/* Section header row */}
            <div className="flex items-start justify-between mb-8 mt-1">
              <div>
                <div className="inline-flex items-center pill bg-secondary border border-border text-primary font-mono-label text-[11px] tracking-wider mb-3">
                  #{section.number} — {section.short}
                </div>
                <h2 className="text-2xl font-light text-foreground tracking-tight">
                  {section.title}
                </h2>
                <p className="text-sm text-muted-foreground mt-1.5">
                  Answer what you know — you can skip anything
                </p>
              </div>

              {/* Right controls */}
              <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                {/* Save indicator */}
                <span
                  className={`font-mono-label text-[10px] tracking-wider transition-opacity duration-300 ${
                    saveStatus === "saved" ? "text-primary opacity-100" : "opacity-0"
                  }`}
                >
                  ✓ SAVED
                </span>

                {/* Section counter */}
                <span className="font-mono-label text-[10px] text-muted-foreground tracking-wider hidden sm:block">
                  {currentSection + 1} / {sections.length}
                </span>

                {/* Guided toggle */}
                <button
                  onClick={() => setGuidedMode((v) => !v)}
                  className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium
                    transition-all duration-200
                    ${guidedMode
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                    }
                  `}
                >
                  {guidedMode ? <Zap className="w-3 h-3" /> : <AlignLeft className="w-3 h-3" />}
                  <span className="hidden sm:inline">{guidedMode ? "Guided" : "All Questions"}</span>
                </button>
              </div>
            </div>

            {/* Feature Builder (FRD only) */}
            {section.builderType === "feature-builder" ? (
              <div className="space-y-4 max-w-2xl">
                {featureCards.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center animate-fade-up">
                    <p className="text-muted-foreground text-sm mb-1">No features defined yet</p>
                    <p className="text-[12px] text-[hsl(0_0%_30%)]">Add each functional requirement as a feature card</p>
                  </div>
                )}
                {featureCards.map((card, ci) => (
                  <div key={card.id} className="rounded-2xl border border-border bg-card animate-fade-up" style={{ animationDelay: `${ci * 60}ms` }}>
                    {/* Card header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                      <div className="flex items-center gap-3">
                        <span className="font-mono-label text-[10px] text-primary tracking-widest">FEATURE {String(ci + 1).padStart(2, "0")}</span>
                        <span className="text-sm font-medium text-foreground">{card.name || "Unnamed Feature"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleFeatureCard(card.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                          {card.collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                        </button>
                        <button onClick={() => deleteFeatureCard(card.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {/* Card fields */}
                    {!card.collapsed && (
                      <div className="p-6 grid grid-cols-1 gap-4">
                        {([
                          { field: "name", label: "Feature Name", placeholder: "e.g. User Authentication", rows: 1 },
                          { field: "purpose", label: "Purpose", placeholder: "e.g. Allow users to securely log in and access their account", rows: 2 },
                          { field: "userActions", label: "User Actions", placeholder: "e.g. Enter email + password → click Login → redirected to dashboard", rows: 2 },
                          { field: "inputs", label: "Inputs", placeholder: "e.g. Email (string, valid format), Password (string, min 8 chars)", rows: 2 },
                          { field: "outputs", label: "Outputs", placeholder: "e.g. JWT token, session cookie, user profile object", rows: 2 },
                          { field: "validations", label: "Validations", placeholder: "e.g. Email must be valid format. Password min 8 chars. Account must be active.", rows: 2 },
                          { field: "errorHandling", label: "Error Handling", placeholder: "e.g. Invalid creds: show error without revealing which field is wrong. Lock after 5 attempts.", rows: 2 },
                          { field: "conditions", label: "Success / Failure Conditions", placeholder: "e.g. Success: user redirected to dashboard with session. Failure: error message shown, form remains.", rows: 2 },
                        ] as { field: keyof Omit<FeatureCard, "id" | "collapsed">; label: string; placeholder: string; rows: number }[]).map(({ field, label, placeholder, rows }) => (
                          <div key={field}>
                            <label className="block text-xs font-medium text-muted-foreground mb-1.5 font-mono-label tracking-wider uppercase">{label}</label>
                            <textarea
                              value={card[field]}
                              onChange={(e) => updateFeatureCard(card.id, field, e.target.value)}
                              placeholder={placeholder}
                              rows={rows}
                              className="w-full rounded-lg bg-background border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-[hsl(0_0%_28%)] resize-none outline-none focus:border-primary transition-colors duration-150"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <button
                  onClick={addFeatureCard}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary transition-all duration-200 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Feature
                </button>
              </div>
            ) : (

            /* Questions */
            <div className="space-y-4 max-w-2xl">
              {visibleQuestions.map((q, qi) => {
                const skipped = isSkipped(q.id);
                const hasAnswer = answers[q.id] && !skipped;

                return (
                  <div
                    key={q.id}
                    className="rounded-2xl border border-border bg-card p-6 transition-all duration-200 animate-fade-up"
                    style={{ animationDelay: `${qi * 60}ms` }}
                  >
                    {skipped ? (
                      // Collapsed skipped state
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="w-1.5 h-1.5 rounded-sm bg-[hsl(0_0%_25%)] flex-shrink-0" />
                          <span className="text-sm text-muted-foreground line-through opacity-50">
                            {q.label}
                          </span>
                        </div>
                        <button
                          onClick={() => handleAnswer(q.id, "")}
                          className="text-[11px] text-primary hover:underline font-mono-label tracking-wider"
                        >
                          Undo
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Question label */}
                        <div className="flex items-start justify-between mb-1">
                          <label className="text-[15px] text-foreground font-medium leading-snug flex-1 pr-4">
                            {q.label}
                          </label>
                          {hasAnswer && (
                            <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                          )}
                        </div>

                        {/* Helper */}
                        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                          {q.helper}
                        </p>

                        {/* Textarea */}
                        <textarea
                          value={skipped ? "" : (answers[q.id] || "")}
                          onChange={(e) => handleAnswer(q.id, e.target.value)}
                          placeholder={q.placeholder}
                          rows={3}
                          className="
                            w-full rounded-lg bg-background border border-border
                            px-4 py-3 text-sm text-foreground
                            placeholder:text-[hsl(0_0%_28%)]
                            resize-none outline-none
                            focus:border-primary focus:ring-0
                            transition-colors duration-150
                          "
                        />

                        {/* Skip */}
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={() => handleSkip(q.id)}
                            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors font-mono-label tracking-wider"
                          >
                            Skip →
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {/* Show more */}
              {hasMore && (
                <button
                  onClick={() => setExpanded((p) => ({ ...p, [section.id]: true }))}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary transition-all duration-200 text-sm"
                >
                  <ChevronDown className="w-4 h-4" />
                  Show {section.questions.length - 3} more question{section.questions.length - 3 > 1 ? "s" : ""}
                </button>
              )}
            </div>
            )} {/* end feature-builder conditional */}
          </main>
        </div>

        {/* ── Bottom navigation bar ─────────────────────────────── */}
        <div className="flex-shrink-0 border-t border-border bg-card px-6 lg:px-10 xl:px-14 py-4 flex items-center justify-between">
          <button
            onClick={goPrev}
            disabled={currentSection === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Previous
          </button>

          {/* Mobile progress */}
          <div className="flex items-center gap-3 lg:hidden">
            <span className="font-mono-label text-[10px] text-muted-foreground">
              {currentSection + 1}/{sections.length}
            </span>
            <div className="w-24 h-1 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {currentSection === sections.length - 1 ? (
            <button
              onClick={handleGenerate}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-200"
            >
              Finalize & Format
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={goNext}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm font-medium hover:border-primary transition-colors duration-200"
            >
              Next Section
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Questionnaire;
