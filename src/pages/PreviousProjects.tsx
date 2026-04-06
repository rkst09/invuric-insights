import { useState, useEffect, useCallback } from "react";
import AppSidebar from "@/components/AppSidebar";
import {
  FolderOpen, FileText, Clock, TrendingUp, Search,
  MoreHorizontal, Download, Eye, CheckCircle2,
  Circle, X, ArrowRight,
} from "lucide-react";
import {
  fetchRecentProjects, getSession, Session,
  downloadDocument, previewDocument, exportAllDocuments,
  continueProject, renameProject, duplicateProject, deleteProject,
} from "@/lib/api";

type DocType = "SOW" | "PRD" | "FRD" | "RAID" | "WBS" | "Stories";
type Status = "Complete" | "In Progress" | "Draft";

interface ProjectDoc {
  name: string;
  format: string;
  size: string;
  outputType: string;
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

const MODULE_TO_PILL: Record<string, DocType> = {
  sow: "SOW", prd: "PRD", frd: "FRD",
  raid: "RAID", wbs: "WBS", backlog: "Stories", pfd: "SOW",
};

const STATUS_MAP: Record<string, Status> = {
  completed: "Complete", generating: "In Progress",
  created: "Draft", failed: "Draft", uploaded: "Draft",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function sessionToProject(s: Session & { documents?: any[]; outputs?: any[] }): Project {
  const docType = MODULE_TO_PILL[s.module_type] ?? "SOW";
  const status  = STATUS_MAP[s.status] ?? "Draft";
  const name    = (s.metadata?.project_name as string)
                || (s.metadata?.filename as string)
                || `Session ${s.id.slice(0, 8)}`;
  const client  = (s.metadata?.client_name as string) || "—";

  const docs: ProjectDoc[] = (s.outputs ?? []).map((o: any) => ({
    name: o.output_type?.replace(/_/g, " ").toUpperCase() ?? "Document",
    format: o.output_type?.includes("pdf") ? "PDF" : "DOCX",
    size: "—",
    outputType: o.output_type ?? "",
  }));

  const timeline: TimelineEntry[] = [
    { date: timeAgo(s.created_at), action: `${docType} Created`, sub: name },
    ...(s.outputs ?? []).map((o: any) => ({
      date: timeAgo(s.created_at),
      action: `${o.output_type?.replace(/_/g, " ").toUpperCase()} Generated`,
      sub: "Invuric format",
    })),
  ];

  return {
    id: s.id,
    name,
    pills: [docType],
    client,
    status,
    progress: [status === "Complete" ? 5 : status === "In Progress" ? 2 : 1, 5] as [number, number],
    edited: timeAgo(s.created_at),
    created: new Date(s.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    timeSpent: "—",
    description: `${docType} document generated for ${client} via Invuric BA Agent.`,
    documents: docs,
    modules: [],
    timeline,
  };
}

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

const PreviousProjects = () => {
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [projects, setProjects]   = useState<Project[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    fetchRecentProjects()
      .then((sessions) => setProjects(sessions.map(sessionToProject)))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = projects.filter((p) => {
    const matchesFilter = activeFilter === "All" || p.pills.includes(activeFilter as DocType);
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.client.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const stats = [
    { icon: FolderOpen, value: String(projects.length), label: "Total Projects" },
    { icon: FileText, value: String(projects.filter(p => p.status === "Complete").length), label: "Documents Generated" },
    { icon: Clock, value: "—", label: "Avg. Completion Time" },
    { icon: TrendingUp, value: projects.length ? `${Math.round(projects.filter(p => p.status === "Complete").length / projects.length * 100)}%` : "—", label: "Completion Rate" },
  ];

  const handleOpenProject = (project: Project) => {
    setSelectedProject(project);
    setIsPanelOpen(true);
    getSession(project.id)
      .then((full) => setSelectedProject(sessionToProject(full as any)))
      .catch(() => {});
  };

  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false);
    setTimeout(() => setSelectedProject(null), 320);
  }, []);

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
                        onClick={() => setActiveFilter(f)}
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
                {loading ? (
                  <div className="py-16 text-center text-sm text-muted-foreground">Loading projects…</div>
                ) : filtered.length === 0 ? (
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    {searchQuery || activeFilter !== "All" ? "No projects match your filter." : "No projects yet. Generate your first document from the dashboard."}
                  </div>
                ) : filtered.map((project, i) => (
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
                          onClick={() => downloadDocument(selectedProject.id, doc.outputType)}
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
