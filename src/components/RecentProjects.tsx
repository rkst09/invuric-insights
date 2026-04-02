import { useEffect } from "react";
import { Download, ExternalLink } from "lucide-react";
import { fetchRecentProjects, downloadProject, openProject } from "@/lib/api";

type BadgeColor = "blue" | "green" | "amber" | "rose" | "violet";

interface Project {
  id: string;
  name: string;
  type: string;
  typeBadge: BadgeColor;
  status: "Complete" | "In Progress" | "Draft";
  lastEdited: string;
}

const projects: Project[] = [
  { id: "1", name: "E-Commerce Platform Revamp", type: "SOW", typeBadge: "blue", status: "Complete", lastEdited: "2 hours ago" },
  { id: "2", name: "Mobile Banking App", type: "PRD + User Stories", typeBadge: "violet", status: "In Progress", lastEdited: "1 day ago" },
  { id: "3", name: "CRM Integration Project", type: "RAID", typeBadge: "amber", status: "Complete", lastEdited: "3 days ago" },
  { id: "4", name: "Healthcare Portal", type: "WBS", typeBadge: "rose", status: "Draft", lastEdited: "5 days ago" },
  { id: "5", name: "Payment Gateway API", type: "FRD", typeBadge: "green", status: "Complete", lastEdited: "1 week ago" },
];

const badgeColors: Record<BadgeColor, string> = {
  blue: "bg-blue-500/10 text-blue-400",
  green: "bg-emerald-500/10 text-emerald-400",
  amber: "bg-amber-500/10 text-amber-400",
  rose: "bg-rose-500/10 text-rose-400",
  violet: "bg-violet-500/10 text-violet-400",
};

const statusStyles: Record<string, string> = {
  Complete: "bg-emerald-500/10 text-emerald-400",
  "In Progress": "bg-blue-500/10 text-blue-400",
  Draft: "bg-muted text-muted-foreground",
};

const RecentProjects = () => {
  useEffect(() => {
    fetchRecentProjects();
  }, []);

  return (
    <div className="animate-fade-up" style={{ animationDelay: "320ms" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-medium text-foreground">Recent Projects</h3>
        <button className="text-xs text-primary hover:opacity-80 transition-opacity duration-200 flex items-center gap-1">
          View all →
        </button>
      </div>

      <div className="card-surface overflow-hidden">
        {/* Header */}
        <div className="hidden sm:grid grid-cols-[1fr_140px_110px_120px_80px] gap-4 px-6 py-3 border-b border-border">
          <span className="text-xs text-muted-foreground font-mono-label">Project</span>
          <span className="text-xs text-muted-foreground font-mono-label">Type</span>
          <span className="text-xs text-muted-foreground font-mono-label">Status</span>
          <span className="text-xs text-muted-foreground font-mono-label">Last Edited</span>
          <span className="text-xs text-muted-foreground font-mono-label">Actions</span>
        </div>

        {/* Rows */}
        {projects.map((project) => (
          <div
            key={project.id}
            className="group grid grid-cols-1 sm:grid-cols-[1fr_140px_110px_120px_80px] gap-2 sm:gap-4 items-center px-6 py-3.5 border-b border-border last:border-b-0 hover:bg-secondary/50 transition-colors duration-200"
          >
            <span className="text-sm font-medium text-foreground">{project.name}</span>

            <div>
              <span className={`pill ${badgeColors[project.typeBadge]}`}>
                {project.type}
              </span>
            </div>

            <div>
              <span className={`pill ${statusStyles[project.status]}`}>
                {project.status}
              </span>
            </div>

            <span className="font-mono-label text-xs text-muted-foreground">
              {project.lastEdited}
            </span>

            <div className="flex items-center gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
              <button
                onClick={() => downloadProject(project.id)}
                className="p-1.5 rounded hover:bg-muted transition-colors duration-200"
              >
                <Download className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <button
                onClick={() => openProject(project.id)}
                className="p-1.5 rounded hover:bg-muted transition-colors duration-200"
              >
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentProjects;
