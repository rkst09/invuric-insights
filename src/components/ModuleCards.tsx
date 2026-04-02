import {
  FileText,
  GitBranch,
  ShieldAlert,
  Network,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { openModule } from "@/lib/api";

const modules = [
  {
    id: "doc-gen",
    number: "#01",
    title: "Document Generation",
    description: "Generate SOW, PRD and FRD from scratch or uploaded documents",
    icon: FileText,
    generated: 12,
  },
  {
    id: "pfd",
    number: "#02",
    title: "Process Flow Diagram",
    description: "Convert requirements into visual process flows and swimlane diagrams",
    icon: GitBranch,
    generated: 8,
  },
  {
    id: "raid",
    number: "#03",
    title: "RAID Document",
    description: "Extract risks, assumptions, issues and dependencies automatically",
    icon: ShieldAlert,
    generated: 15,
  },
  {
    id: "wbs",
    number: "#04",
    title: "Work Breakdown Structure",
    description: "Break down projects into phases, tasks and subtasks",
    icon: Network,
    generated: 6,
  },
  {
    id: "user-stories",
    number: "#05",
    title: "User Stories",
    description: "Generate user stories, acceptance criteria and edge cases",
    icon: MessageSquare,
    generated: 21,
  },
];

const ModuleCards = () => {
  const navigate = useNavigate();

  const handleClick = (modId: string) => {
    openModule(modId);
    if (modId === "doc-gen") {
      navigate("/document-generation");
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {modules.map((mod, i) => (
        <button
          key={mod.id}
          onClick={() => handleClick(mod.id)}
          className="card-surface-hover p-6 text-left group animate-fade-up"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
              <mod.icon className="w-5 h-5 text-primary" />
            </div>
            <span className="font-mono-label text-xs text-muted-foreground">
              {mod.number}
            </span>
          </div>

          <h4 className="text-sm font-medium text-foreground mb-1.5">
            {mod.title}
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-4">
            {mod.description}
          </p>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-xs text-primary font-medium group-hover:gap-2 transition-all duration-200">
              Open <ArrowRight className="w-3 h-3" />
            </span>
            <span className="font-mono-label text-[10px] text-muted-foreground">
              {mod.generated} generated
            </span>
          </div>
        </button>
      ))}
    </div>
  );
};

export default ModuleCards;
