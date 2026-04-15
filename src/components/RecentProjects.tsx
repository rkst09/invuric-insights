import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, ExternalLink } from "lucide-react";
import { fetchRecentProjects, downloadDocument, Session } from "@/lib/api";

type BadgeColor = "blue" | "green" | "amber" | "rose" | "violet";

const TYPE_BADGE: Record<string, BadgeColor> = {
  sow: "blue", prd: "violet", frd: "green",
  raid: "amber", wbs: "rose", backlog: "violet", pfd: "blue",
};

const badgeColors: Record<BadgeColor, string> = {
  blue:   "bg-blue-500/10 text-blue-400",
  green:  "bg-emerald-500/10 text-emerald-400",
  amber:  "bg-amber-500/10 text-amber-400",
  rose:   "bg-rose-500/10 text-rose-400",
  violet: "bg-violet-500/10 text-violet-400",
};

const statusStyles: Record<string, string> = {
  completed:  "bg-emerald-500/10 text-emerald-400",
  generating: "bg-blue-500/10 text-blue-400",
  created:    "bg-muted text-muted-foreground",
  failed:     "bg-rose-500/10 text-rose-400",
};

const statusLabel: Record<string, string> = {
  completed: "Complete", generating: "In Progress", created: "Draft", failed: "Failed",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 7)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const RecentProjects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Session[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetchRecentProjects()
      .then(setProjects)
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-fade-up" style={{ animationDelay: "320ms" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-medium text-foreground">Recent Projects</h3>
        <button
          onClick={() => navigate("/history")}
          className="text-xs text-primary hover:opacity-80 transition-opacity duration-200"
        >
          View all →
        </button>
      </div>

      <div className="card-surface overflow-hidden">
        {/* Header */}
        <div className="hidden sm:grid grid-cols-[1fr_120px_120px_120px_80px] gap-4 px-6 py-3 border-b border-border">
          <span className="text-xs text-muted-foreground font-mono-label">Project</span>
          <span className="text-xs text-muted-foreground font-mono-label">Type</span>
          <span className="text-xs text-muted-foreground font-mono-label">Status</span>
          <span className="text-xs text-muted-foreground font-mono-label">Created</span>
          <span className="text-xs text-muted-foreground font-mono-label">Actions</span>
        </div>

        {loading && (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            Loading projects…
          </div>
        )}

        {!loading && projects.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            No projects yet. Generate your first document above.
          </div>
        )}

        {projects.map((p) => {
          const type  = (p.module_type || "unknown").toUpperCase();
          const badge = TYPE_BADGE[p.module_type] ?? "blue";
          const name  = p.project_name || (p.metadata?.project_name as string) || (p.metadata?.filename as string) || `Session ${p.id.slice(0, 8)}`;

          return (
            <div
              key={p.id}
              className="group grid grid-cols-1 sm:grid-cols-[1fr_120px_120px_120px_80px] gap-2 sm:gap-4 items-center px-6 py-3.5 border-b border-border last:border-b-0 hover:bg-secondary/50 transition-colors duration-200"
            >
              <span className="text-sm font-medium text-foreground truncate">{name}</span>

              <div>
                <span className={`pill ${badgeColors[badge]}`}>{type}</span>
              </div>

              <div>
                <span className={`pill ${statusStyles[p.status] ?? statusStyles.created}`}>
                  {statusLabel[p.status] ?? p.status}
                </span>
              </div>

              <span className="font-mono-label text-xs text-muted-foreground">
                {timeAgo(p.created_at)}
              </span>

              <div className="flex items-center gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void downloadDocument(p.id, undefined, p.module_type);
                  }}
                  className="p-1.5 rounded hover:bg-muted transition-colors duration-200"
                  title="Download"
                >
                  <Download className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate("/history"); }}
                  className="p-1.5 rounded hover:bg-muted transition-colors duration-200"
                  title="View in History"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecentProjects;
