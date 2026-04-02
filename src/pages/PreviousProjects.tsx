import { useState, useEffect, useCallback } from "react";
import AppSidebar from "@/components/AppSidebar";
import {
  FolderOpen, FileText, Clock, TrendingUp, Search,
  MoreHorizontal, Download, Eye, CheckCircle2,
  Circle, X, ArrowRight,
} from "lucide-react";
import {
  fetchProjects, searchProjects, openProjectDetail, closeProjectDetail,
  downloadDocument, previewDocument, exportAllDocuments,
  continueProject, renameProject, duplicateProject, deleteProject,
} from "@/lib/api";

type DocType = "SOW" | "PRD" | "FRD" | "RAID" | "WBS" | "Stories";
type Status = "Complete" | "In Progress" | "Draft";

interface ProjectDoc {
  name: string;
  format: string;
  size: string;
}

interface TimelineEntry {
  date: string;
  action: string;
  sub: string;
}

interface Project {
  id: string;
  name: string;
  pills: DocType[];
  client: string;
  status: Status;
  progress: [number, number];
  edited: string;
  created: string;
  timeSpent: string;
  description: string;
  documents: ProjectDoc[];
  modules: { name: string; status: "complete" | "in-progress" | "not-started" }[];
  timeline: TimelineEntry[];
}

const PROJECTS: Project[] = [
  {
    id: "1", name: "E-Commerce Platform Revamp", pills: ["SOW", "RAID", "WBS"],
    client: "RetailCo — Full project documentation", status: "Complete",
    progress: [5, 5], edited: "2 hours ago", created: "Mar 15, 2026", timeSpent: "4h 32m",
    description: "E-Commerce Platform Revamp covering full scope documentation including SOW, RAID log and Work Breakdown Structure across 3 project phases.",
    documents: [
      { name: "Statement of Work", format: "DOCX", size: "84 KB" },
      { name: "RAID Document", format: "DOCX", size: "42 KB" },
      { name: "Work Breakdown Structure", format: "XLSX", size: "61 KB" },
    ],
    modules: [
      { name: "Document Generation", status: "complete" },
      { name: "RAID Document", status: "complete" },
      { name: "Work Breakdown Structure", status: "complete" },
      { name: "Process Flow Diagram", status: "not-started" },
      { name: "User Stories", status: "not-started" },
    ],
    timeline: [
      { date: "Mar 28", action: "WBS Generated", sub: "Exported to Excel, 3 phases" },
      { date: "Mar 27", action: "RAID Document Created", sub: "14 risks identified" },
      { date: "Mar 26", action: "SOW Generated", sub: "Invuric format, DOCX" },
      { date: "Mar 25", action: "Documents Uploaded", sub: "3 files processed" },
      { date: "Mar 24", action: "Project Created", sub: "E-Commerce Platform Revamp" },
    ],
  },
  {
    id: "2", name: "Mobile Banking App", pills: ["PRD", "Stories"],
    client: "FinTech Ltd — Product requirements", status: "In Progress",
    progress: [2, 5], edited: "1 day ago", created: "Mar 20, 2026", timeSpent: "2h 15m",
    description: "Mobile banking application product requirements and user stories covering core banking features, security protocols, and UX flows.",
    documents: [
      { name: "Product Requirements Document", format: "DOCX", size: "96 KB" },
    ],
    modules: [
      { name: "Document Generation", status: "complete" },
      { name: "RAID Document", status: "not-started" },
      { name: "Work Breakdown Structure", status: "not-started" },
      { name: "Process Flow Diagram", status: "in-progress" },
      { name: "User Stories", status: "not-started" },
    ],
    timeline: [
      { date: "Mar 27", action: "PRD Generated", sub: "96 KB, DOCX format" },
      { date: "Mar 20", action: "Project Created", sub: "Mobile Banking App" },
    ],
  },
  {
    id: "3", name: "Healthcare Portal Redesign", pills: ["FRD", "RAID"],
    client: "MedCare Group — System requirements", status: "Complete",
    progress: [5, 5], edited: "3 days ago", created: "Mar 10, 2026", timeSpent: "6h 08m",
    description: "Healthcare portal functional requirements and risk assessment documentation covering patient management, appointment scheduling, and compliance modules.",
    documents: [
      { name: "Functional Requirements Document", format: "DOCX", size: "112 KB" },
      { name: "RAID Document", format: "DOCX", size: "38 KB" },
    ],
    modules: [
      { name: "Document Generation", status: "complete" },
      { name: "RAID Document", status: "complete" },
      { name: "Work Breakdown Structure", status: "complete" },
      { name: "Process Flow Diagram", status: "complete" },
      { name: "User Stories", status: "complete" },
    ],
    timeline: [
      { date: "Mar 25", action: "All Modules Completed", sub: "Full documentation set" },
      { date: "Mar 18", action: "RAID Document Created", sub: "9 risks, 4 assumptions" },
      { date: "Mar 10", action: "Project Created", sub: "Healthcare Portal Redesign" },
    ],
  },
  {
    id: "4", name: "Payment Gateway Integration", pills: ["SOW", "FRD"],
    client: "PayFlow Inc — Technical SOW", status: "Draft",
    progress: [1, 5], edited: "5 days ago", created: "Mar 8, 2026", timeSpent: "1h 10m",
    description: "Payment gateway integration technical scope and functional requirements for multi-provider payment processing system.",
    documents: [
      { name: "Statement of Work", format: "DOCX", size: "54 KB" },
    ],
    modules: [
      { name: "Document Generation", status: "complete" },
      { name: "RAID Document", status: "not-started" },
      { name: "Work Breakdown Structure", status: "not-started" },
      { name: "Process Flow Diagram", status: "not-started" },
      { name: "User Stories", status: "not-started" },
    ],
    timeline: [
      { date: "Mar 23", action: "SOW Draft Saved", sub: "54 KB, incomplete" },
      { date: "Mar 8", action: "Project Created", sub: "Payment Gateway Integration" },
    ],
  },
  {
    id: "5", name: "CRM System Migration", pills: ["PRD", "WBS", "Stories"],
    client: "SalesForce Project — Internal", status: "Complete",
    progress: [5, 5], edited: "1 week ago", created: "Feb 28, 2026", timeSpent: "8h 45m",
    description: "CRM system migration covering product requirements, work breakdown structure and user stories for data migration and feature parity.",
    documents: [
      { name: "Product Requirements Document", format: "DOCX", size: "88 KB" },
      { name: "Work Breakdown Structure", format: "XLSX", size: "72 KB" },
      { name: "User Stories", format: "DOCX", size: "64 KB" },
    ],
    modules: [
      { name: "Document Generation", status: "complete" },
      { name: "RAID Document", status: "complete" },
      { name: "Work Breakdown Structure", status: "complete" },
      { name: "Process Flow Diagram", status: "complete" },
      { name: "User Stories", status: "complete" },
    ],
    timeline: [
      { date: "Mar 18", action: "User Stories Generated", sub: "24 stories, 3 epics" },
      { date: "Mar 14", action: "WBS Created", sub: "4 phases, 32 tasks" },
      { date: "Mar 5", action: "PRD Generated", sub: "88 KB, DOCX format" },
      { date: "Feb 28", action: "Project Created", sub: "CRM System Migration" },
    ],
  },
  {
    id: "6", name: "Logistics Dashboard", pills: ["SOW", "PRD"],
    client: "ShipFast — Dashboard requirements", status: "In Progress",
    progress: [3, 5], edited: "1 week ago", created: "Feb 25, 2026", timeSpent: "3h 20m",
    description: "Logistics dashboard scope and product requirements for real-time shipment tracking, route optimization, and fleet management.",
    documents: [
      { name: "Statement of Work", format: "DOCX", size: "76 KB" },
      { name: "Product Requirements Document", format: "DOCX", size: "92 KB" },
    ],
    modules: [
      { name: "Document Generation", status: "complete" },
      { name: "RAID Document", status: "complete" },
      { name: "Work Breakdown Structure", status: "in-progress" },
      { name: "Process Flow Diagram", status: "not-started" },
      { name: "User Stories", status: "not-started" },
    ],
    timeline: [
      { date: "Mar 20", action: "PRD Generated", sub: "92 KB, DOCX format" },
      { date: "Mar 12", action: "SOW Generated", sub: "76 KB, DOCX format" },
      { date: "Feb 25", action: "Project Created", sub: "Logistics Dashboard" },
    ],
  },
  {
    id: "7", name: "HR Management System", pills: ["FRD", "Stories"],
    client: "PeopleFirst — HR module specs", status: "Complete",
    progress: [5, 5], edited: "2 weeks ago", created: "Feb 18, 2026", timeSpent: "5h 50m",
    description: "HR management system functional requirements and user stories for employee onboarding, payroll, and performance management modules.",
    documents: [
      { name: "Functional Requirements Document", format: "DOCX", size: "104 KB" },
      { name: "User Stories", format: "DOCX", size: "58 KB" },
    ],
    modules: [
      { name: "Document Generation", status: "complete" },
      { name: "RAID Document", status: "complete" },
      { name: "Work Breakdown Structure", status: "complete" },
      { name: "Process Flow Diagram", status: "complete" },
      { name: "User Stories", status: "complete" },
    ],
    timeline: [
      { date: "Mar 8", action: "User Stories Generated", sub: "18 stories, 2 epics" },
      { date: "Mar 2", action: "FRD Generated", sub: "104 KB, DOCX format" },
      { date: "Feb 18", action: "Project Created", sub: "HR Management System" },
    ],
  },
  {
    id: "8", name: "Inventory Management Tool", pills: ["SOW", "RAID", "WBS"],
    client: "StockMaster — Warehouse tool", status: "Draft",
    progress: [2, 5], edited: "2 weeks ago", created: "Feb 15, 2026", timeSpent: "1h 45m",
    description: "Inventory management tool covering scope, risk assessment, and work breakdown for warehouse automation and stock tracking system.",
    documents: [
      { name: "Statement of Work", format: "DOCX", size: "68 KB" },
      { name: "RAID Document", format: "DOCX", size: "32 KB" },
    ],
    modules: [
      { name: "Document Generation", status: "complete" },
      { name: "RAID Document", status: "complete" },
      { name: "Work Breakdown Structure", status: "not-started" },
      { name: "Process Flow Diagram", status: "not-started" },
      { name: "User Stories", status: "not-started" },
    ],
    timeline: [
      { date: "Mar 5", action: "RAID Document Created", sub: "8 risks identified" },
      { date: "Feb 28", action: "SOW Draft Saved", sub: "68 KB, incomplete" },
      { date: "Feb 15", action: "Project Created", sub: "Inventory Management Tool" },
    ],
  },
  {
    id: "9", name: "Customer Support Platform", pills: ["PRD", "FRD"],
    client: "HelpDesk Pro — Support system", status: "Complete",
    progress: [5, 5], edited: "3 weeks ago", created: "Feb 10, 2026", timeSpent: "7h 12m",
    description: "Customer support platform product and functional requirements for ticket management, knowledge base, and live chat integration.",
    documents: [
      { name: "Product Requirements Document", format: "DOCX", size: "90 KB" },
      { name: "Functional Requirements Document", format: "DOCX", size: "118 KB" },
    ],
    modules: [
      { name: "Document Generation", status: "complete" },
      { name: "RAID Document", status: "complete" },
      { name: "Work Breakdown Structure", status: "complete" },
      { name: "Process Flow Diagram", status: "complete" },
      { name: "User Stories", status: "complete" },
    ],
    timeline: [
      { date: "Mar 1", action: "All Modules Completed", sub: "Full documentation set" },
      { date: "Feb 22", action: "FRD Generated", sub: "118 KB, DOCX format" },
      { date: "Feb 14", action: "PRD Generated", sub: "90 KB, DOCX format" },
      { date: "Feb 10", action: "Project Created", sub: "Customer Support Platform" },
    ],
  },
  {
    id: "10", name: "Supply Chain Analytics", pills: ["SOW", "Stories"],
    client: "ChainIQ — Analytics platform", status: "In Progress",
    progress: [1, 5], edited: "1 month ago", created: "Feb 1, 2026", timeSpent: "0h 55m",
    description: "Supply chain analytics platform scope and user stories for predictive analytics, demand forecasting, and supplier performance dashboards.",
    documents: [
      { name: "Statement of Work", format: "DOCX", size: "62 KB" },
    ],
    modules: [
      { name: "Document Generation", status: "complete" },
      { name: "RAID Document", status: "not-started" },
      { name: "Work Breakdown Structure", status: "not-started" },
      { name: "Process Flow Diagram", status: "not-started" },
      { name: "User Stories", status: "not-started" },
    ],
    timeline: [
      { date: "Feb 5", action: "SOW Generated", sub: "62 KB, DOCX format" },
      { date: "Feb 1", action: "Project Created", sub: "Supply Chain Analytics" },
    ],
  },
];

const FILTERS = ["All", "SOW", "PRD", "FRD", "RAID", "WBS", "Stories"] as const;

const pillStyles: Record<DocType, string> = {
  SOW: "bg-[hsl(217_50%_18%)] text-primary border border-[hsl(217_50%_28%)]",
  PRD: "bg-[hsl(217_50%_18%)] text-primary border border-[hsl(217_50%_28%)]",
  FRD: "bg-[hsl(217_50%_18%)] text-primary border border-[hsl(217_50%_28%)]",
  RAID: "bg-[hsl(140_20%_12%)] text-[hsl(142_71%_45%)] border border-[hsl(140_30%_18%)]",
  WBS: "bg-[hsl(35_20%_12%)] text-[hsl(38_92%_50%)] border border-[hsl(35_30%_18%)]",
  Stories: "bg-[hsl(270_25%_14%)] text-[hsl(263_70%_76%)] border border-[hsl(270_30%_20%)]",
};

const statusBarColor: Record<Status, string> = {
  "Complete": "bg-[hsl(142_71%_45%)]",
  "In Progress": "bg-primary",
  "Draft": "bg-[hsl(0_0%_33%)]",
};

const statusPillStyle: Record<Status, string> = {
  "Complete": "bg-[hsl(142_20%_12%)] text-[hsl(142_71%_45%)] border border-[hsl(142_30%_20%)]",
  "In Progress": "bg-[hsl(217_50%_18%)] text-primary border border-[hsl(217_50%_28%)]",
  "Draft": "bg-[hsl(0_0%_12%)] text-[hsl(0_0%_40%)] border border-[hsl(0_0%_20%)]",
};

const progressFill: Record<Status, string> = {
  "Complete": "bg-[hsl(142_71%_45%)]",
  "In Progress": "bg-primary",
  "Draft": "bg-[hsl(0_0%_33%)]",
};

const stats = [
  { icon: FolderOpen, value: "14", label: "Total Projects" },
  { icon: FileText, value: "47", label: "Documents Generated" },
  { icon: Clock, value: "2.4 hrs", label: "Avg. Completion Time" },
  { icon: TrendingUp, value: "92%", label: "Completion Rate" },
];

const PreviousProjects = () => {
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const filtered = PROJECTS.filter((p) => {
    const matchesFilter = activeFilter === "All" || p.pills.includes(activeFilter as DocType);
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.client.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleOpenProject = (project: Project) => {
    openProjectDetail(project.id);
    setSelectedProject(project);
    setIsPanelOpen(true);
  };

  const handleClosePanel = useCallback(() => {
    closeProjectDetail();
    setIsPanelOpen(false);
    setTimeout(() => setSelectedProject(null), 320);
  }, []);

  useEffect(() => {
    fetchProjects(activeFilter);
  }, [activeFilter]);

  useEffect(() => {
    if (searchQuery) searchProjects(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isPanelOpen) handleClosePanel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isPanelOpen, handleClosePanel]);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar activeItem="History" />

      <div className="flex-1 flex flex-col min-w-0 relative">
        <main className="flex-1 overflow-y-auto">
          <div className="glow-top">
            <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
              {/* Top Bar */}
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                <div>
                  <h1 className="text-[22px] font-medium text-foreground">Previous Projects</h1>
                  <p className="font-mono-label text-xs text-[hsl(0_0%_27%)] mt-1">
                    14 projects · 47 documents generated
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(0_0%_27%)]" />
                    <input
                      type="text"
                      placeholder="Search projects..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-60 bg-card border border-border rounded-lg pl-9 pr-3.5 py-2.5 text-[13px] text-foreground placeholder:text-[hsl(0_0%_20%)] focus:outline-none focus:border-primary focus:shadow-[0_0_12px_hsl(217_91%_60%/0.08)] transition-all duration-200"
                    />
                  </div>
                  {/* Filters */}
                  <div className="flex flex-wrap gap-2">
                    {FILTERS.map((f) => (
                      <button
                        key={f}
                        onClick={() => { setActiveFilter(f); fetchProjects(f); }}
                        className={`font-mono-label text-[11px] px-3 py-1.5 rounded-[20px] border transition-all duration-150 cursor-pointer ${
                          activeFilter === f
                            ? "bg-primary border-primary text-primary-foreground"
                            : "bg-secondary border-border text-muted-foreground hover:border-primary hover:text-foreground"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
                {stats.map((s, i) => (
                  <div
                    key={s.label}
                    className="bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-3.5 animate-fade-up"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="w-9 h-9 bg-secondary border border-border rounded-lg flex items-center justify-center shrink-0">
                      <s.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-medium text-foreground leading-none">{s.value}</p>
                      <p className="font-mono-label text-[11px] text-[hsl(0_0%_33%)] mt-0.5">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Project List */}
              <div className="mt-8 space-y-2.5">
                {filtered.map((project, i) => (
                  <div
                    key={project.id}
                    onClick={() => handleOpenProject(project)}
                    className="group bg-card border border-border rounded-[14px] px-7 py-5 flex items-center gap-6 cursor-pointer transition-all duration-200 hover:bg-[hsl(215_30%_8%)] hover:border-primary animate-fade-up relative"
                    style={{ animationDelay: `${200 + i * 50}ms` }}
                  >
                    {/* Status bar */}
                    <div className={`w-[3px] self-stretch rounded-full shrink-0 ${statusBarColor[project.status]}`} />

                    {/* Left block */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-base font-medium text-foreground">{project.name}</span>
                        {project.pills.map((pill) => (
                          <span key={pill} className={`font-mono-label text-[10px] px-2 py-0.5 rounded-[20px] ${pillStyles[pill]}`}>
                            {pill}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-0 mt-2 text-[13px]">
                        <span className="text-muted-foreground italic">{project.client}</span>
                        <span className="text-[hsl(0_0%_20%)] mx-4">·</span>
                        <span className="font-mono-label text-[11px] text-[hsl(0_0%_27%)]">{project.created}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2.5">
                        <div className="w-[180px] h-[1px] bg-border rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${progressFill[project.status]}`}
                            style={{ width: `${(project.progress[0] / project.progress[1]) * 100}%` }}
                          />
                        </div>
                        <span className="font-mono-label text-[10px] text-[hsl(0_0%_27%)]">
                          {project.progress[0]}/{project.progress[1]} modules
                        </span>
                      </div>
                    </div>

                    {/* Middle block */}
                    <div className="hidden md:flex flex-col items-end gap-1 shrink-0">
                      <span className="font-mono-label text-[11px] text-[hsl(0_0%_27%)]">Edited {project.edited}</span>
                      <span className="font-mono-label text-[10px] text-[hsl(0_0%_20%)]">{project.timeSpent} total</span>
                    </div>

                    {/* Right block */}
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenProject(project); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-transparent border border-border text-primary text-xs px-4 py-2 rounded-lg hover:bg-primary hover:text-primary-foreground"
                      >
                        Open <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                      </button>
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === project.id ? null : project.id); }}
                          className="p-1.5 rounded-lg hover:bg-secondary transition-colors duration-200"
                        >
                          <MoreHorizontal className="w-4 h-4 text-[hsl(0_0%_27%)]" />
                        </button>
                        {openMenuId === project.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }} />
                            <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-secondary border border-border rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.4)] py-1 overflow-hidden">
                              {[
                                { label: "Rename", fn: () => renameProject(project.id) },
                                { label: "Duplicate", fn: () => duplicateProject(project.id) },
                                { label: "Export All", fn: () => exportAllDocuments(project.id) },
                                { label: "Delete", fn: () => deleteProject(project.id), destructive: true },
                              ].map((item) => (
                                <button
                                  key={item.label}
                                  onClick={(e) => { e.stopPropagation(); item.fn(); setOpenMenuId(null); }}
                                  className={`w-full text-left px-4 py-2.5 text-[13px] transition-colors duration-150 ${
                                    (item as any).destructive
                                      ? "text-foreground hover:text-destructive hover:bg-[hsl(0_0%_12%)]"
                                      : "text-foreground hover:bg-[hsl(0_0%_12%)]"
                                  }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>

        {/* PDP Overlay */}
        {(isPanelOpen || selectedProject) && (
          <div
            className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 ${isPanelOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            onClick={handleClosePanel}
          />
        )}

        {/* PDP Panel */}
        <div
          className={`fixed top-0 right-0 z-50 h-screen w-full sm:w-[560px] bg-[hsl(0_0%_6%)] border-l border-border transition-transform duration-300 overflow-y-auto ${
            isPanelOpen ? "translate-x-0" : "translate-x-full"
          }`}
          style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)", scrollbarWidth: "none" }}
        >
          {selectedProject && (
            <div>
              {/* Panel top bar */}
              <div className="sticky top-0 z-10 bg-[hsl(0_0%_6%)] border-b border-border px-7 py-4 flex items-center justify-between">
                <button onClick={handleClosePanel} className="text-muted-foreground hover:text-foreground transition-colors duration-200">
                  <X className="w-5 h-5" />
                </button>
                <span className="text-base font-medium text-foreground">{selectedProject.name}</span>
                <button
                  onClick={() => exportAllDocuments(selectedProject.id)}
                  className="text-xs text-muted-foreground border border-border px-3.5 py-1.5 rounded-lg hover:border-primary hover:text-primary transition-all duration-200"
                >
                  Export All
                </button>
              </div>

              {/* Block 1 — Overview */}
              <div className="px-7 pt-7">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-[26px] font-medium text-foreground">{selectedProject.name}</h2>
                  <span className={`font-mono-label text-[11px] px-2.5 py-1 rounded-[20px] ${statusPillStyle[selectedProject.status]}`}>
                    {selectedProject.status}
                  </span>
                </div>

                <div className="flex items-center gap-0 mt-4">
                  {[
                    { label: "CLIENT", value: selectedProject.client.split("—")[0].trim() },
                    { label: "CREATED", value: selectedProject.created },
                    { label: "LAST EDITED", value: selectedProject.edited },
                  ].map((meta, i) => (
                    <div key={meta.label} className={`flex-1 ${i > 0 ? "border-l border-border pl-5" : ""}`}>
                      <p className="font-mono-label text-[10px] text-[hsl(0_0%_27%)] tracking-wider">{meta.label}</p>
                      <p className="text-[13px] text-foreground mt-1">{meta.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 bg-secondary border border-border rounded-[10px] p-4">
                  <p className="text-[13px] text-muted-foreground leading-relaxed">{selectedProject.description}</p>
                </div>
              </div>

              {/* Divider */}
              <div className="mx-7 my-6 h-px bg-[hsl(0_0%_10%)]" />

              {/* Block 2 — Documents */}
              <div className="px-7">
                <p className="font-mono-label text-[10px] text-[hsl(0_0%_27%)] tracking-[0.1em] mb-4">GENERATED DOCUMENTS</p>
                <div className="space-y-2">
                  {selectedProject.documents.map((doc) => (
                    <div key={doc.name} className="bg-secondary border border-border rounded-[10px] px-4 py-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-primary shrink-0" />
                        <span className="text-sm font-medium text-foreground">{doc.name}</span>
                        <span className="font-mono-label text-[10px] text-[hsl(0_0%_27%)] bg-secondary border border-border px-2 py-0.5 rounded-[20px]">{doc.format}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono-label text-[11px] text-[hsl(0_0%_27%)]">{doc.size}</span>
                        <button
                          onClick={() => downloadDocument(selectedProject.id, doc.name)}
                          className="text-primary hover:scale-110 transition-transform duration-150"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => previewDocument(selectedProject.id, doc.name)}
                          className="text-muted-foreground hover:text-foreground transition-colors duration-150"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mx-7 my-6 h-px bg-[hsl(0_0%_10%)]" />

              {/* Block 3 — Modules */}
              <div className="px-7">
                <p className="font-mono-label text-[10px] text-[hsl(0_0%_27%)] tracking-[0.1em] mb-4">MODULE PROGRESS</p>
                <div className="space-y-1">
                  {selectedProject.modules.map((mod) => (
                    <div key={mod.name} className="flex items-center justify-between py-2.5 px-1">
                      <span className="text-[13px] text-foreground">{mod.name}</span>
                      {mod.status === "complete" && <CheckCircle2 className="w-4 h-4 text-[hsl(142_71%_45%)]" />}
                      {mod.status === "in-progress" && <Circle className="w-4 h-4 text-primary animate-pulse-glow" />}
                      {mod.status === "not-started" && <Circle className="w-4 h-4 text-[hsl(0_0%_16%)]" />}
                    </div>
                  ))}
                </div>
                {selectedProject.status !== "Complete" && (
                  <button
                    onClick={() => continueProject(selectedProject.id)}
                    className="w-full mt-5 border border-primary text-primary rounded-lg py-3 text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-all duration-200"
                  >
                    Continue where you left off →
                  </button>
                )}
              </div>

              <div className="mx-7 my-6 h-px bg-[hsl(0_0%_10%)]" />

              {/* Block 4 — Timeline */}
              <div className="px-7 pb-8">
                <p className="font-mono-label text-[10px] text-[hsl(0_0%_27%)] tracking-[0.1em] mb-4">ACTIVITY</p>
                <div className="relative pl-5">
                  {/* Line */}
                  <div className="absolute left-[3px] top-2 bottom-2 w-px bg-border" />
                  <div className="space-y-5">
                    {selectedProject.timeline.map((entry, i) => (
                      <div key={i} className="relative">
                        <div className={`absolute -left-5 top-1 w-2 h-2 rounded-full ${i === 0 ? "bg-primary" : "bg-[hsl(0_0%_20%)]"}`} />
                        <p className="font-mono-label text-[10px] text-[hsl(0_0%_27%)]">{entry.date}</p>
                        <p className="text-[13px] text-foreground mt-0.5">{entry.action}</p>
                        <p className="text-[11px] text-[hsl(0_0%_33%)] mt-0.5">{entry.sub}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreviousProjects;
