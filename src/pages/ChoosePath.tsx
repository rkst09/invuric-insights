import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import {
  ArrowLeft,
  ArrowRight,
  PenLine,
  Upload,
} from "lucide-react";

type PathType = "SCRATCH" | "UPLOAD";

const DOC_FULL_NAMES: Record<string, string> = {
  SOW: "Statement of Work",
  PRD: "Product Requirements Document",
  FRD: "Functional Requirements Document",
};

const ROUTES: Record<PathType, string> = {
  SCRATCH: "/questionnaire",
  UPLOAD: "/upload-gap-flow",
};

const paths: {
  id: PathType;
  number: string;
  icon: typeof PenLine;
  title: string;
  description: string;
  helper: string;
  tags: string[];
}[] = [
  {
    id: "SCRATCH",
    number: "01",
    icon: PenLine,
    title: "Start from Scratch",
    description: "Answer guided questions — AI builds your document from your inputs.",
    helper: "Start fresh with guided input",
    tags: ["Guided", "Questionnaire", "No files needed"],
  },
  {
    id: "UPLOAD",
    number: "02",
    icon: Upload,
    title: "Upload Your Documents",
    description: "Upload files — AI extracts, fills gaps, asks only what's missing.",
    helper: "Upload files and let AI do the work",
    tags: ["AI Extraction", "Auto-fill", "Gap Detection"],
  },
];

const steps = ["Type", "Path", "Configure"];

const ChoosePath = () => {
  const [searchParams] = useSearchParams();
  const docType = searchParams.get("type") || "SOW";
  const docFullName = DOC_FULL_NAMES[docType] || docType;

  const [activeCard, setActiveCard] = useState<PathType | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const navigate = useNavigate();

  const handleSelect = (id: PathType) => {
    if (activeCard) return;

    setActiveCard(id);

    setTimeout(() => {
      setIsExiting(true);
    }, 120);

    setTimeout(() => {
      navigate(`${ROUTES[id]}?type=${docType}`);
    }, 300);
  };

  const handleBack = () => {
    navigate(`/document-generation`);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar activeItem="New Project" />

      <div
        className="flex-1 flex flex-col min-w-0 transition-all duration-[180ms] ease-out"
        style={{
          opacity: isExiting ? 0 : 1,
          transform: isExiting ? "translateY(-8px)" : "translateY(0)",
        }}
      >
        {/* Top: breadcrumb + step indicator */}
        <div className="flex items-center justify-between px-6 lg:px-8 pt-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleBack}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary transition-all duration-200 hover:-translate-x-1"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <nav className="font-mono-label text-xs tracking-wider flex items-center gap-1.5">
              <span
                className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors duration-200"
                onClick={() => navigate("/")}
              >
                Dashboard
              </span>
              <span className="text-[hsl(0_0%_20%)]">→</span>
              <span className="text-muted-foreground">Document Generation</span>
              <span className="text-[hsl(0_0%_20%)]">→</span>
              <span
                className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors duration-200"
                onClick={handleBack}
              >
                Choose Document Type
              </span>
              <span className="text-[hsl(0_0%_20%)]">→</span>
              <span className="text-foreground">Choose Path</span>
            </nav>
          </div>

          {/* Step indicator */}
          <div className="hidden sm:flex items-center gap-0">
            {steps.map((step, i) => (
              <div key={step} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      i <= 1 ? "bg-primary" : "border border-[hsl(0_0%_20%)]"
                    }`}
                  />
                  <span
                    className={`font-mono-label text-[10px] tracking-wider ${
                      i === 1 ? "text-foreground" : "text-[hsl(0_0%_33%)]"
                    }`}
                  >
                    {step}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className="w-8 h-px bg-[hsl(0_0%_13%)] mx-1 -mt-4" />
                )}
              </div>
            ))}
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
          <div className="glow-top">
            <div className="max-w-[960px] mx-auto px-6 lg:px-8">
              {/* Context chip */}
              <div className="mt-5 animate-fade-up flex justify-center">
                <div className="inline-flex items-center gap-2 bg-secondary border border-border rounded-[20px] py-1.5 px-3.5">
                  <span className="w-1.5 h-1.5 rounded-sm bg-primary flex-shrink-0" />
                  <span className="font-mono-label text-xs text-foreground tracking-wide">
                    {docType} — {docFullName}
                  </span>
                </div>
              </div>

              {/* Header */}
              <div className="text-center pt-6 pb-8 animate-fade-up">
                <div className="inline-flex items-center pill bg-secondary border border-border text-primary font-mono-label text-[11px] tracking-wider mb-4">
                  #02 — Choose Path
                </div>
                <h1 className="text-[28px] font-semibold text-foreground tracking-tight leading-tight">
                  Choose how you want to create your {docType}
                </h1>
                <p className="text-muted-foreground text-sm mt-3 max-w-[420px] mx-auto leading-relaxed">
                  Select the path that matches your starting point.
                </p>
              </div>

              {/* Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-24 max-w-[900px] mx-auto mt-4">
                {paths.map((path, i) => {
                  const isActive = activeCard === path.id;

                  return (
                    <button
                      key={path.id}
                      onClick={() => handleSelect(path.id)}
                      disabled={!!activeCard}
                      className={`
                        group relative text-left flex flex-col rounded-2xl p-8
                        animate-fade-up cursor-pointer border bg-card
                        ${isActive
                          ? "border-primary bg-[hsl(215_50%_8%)]"
                          : "border-border hover:border-primary hover:-translate-y-[4px] hover:shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_8px_32px_rgba(59,130,246,0.08)]"
                        }
                      `}
                      style={{
                        animationDelay: `${i * 60}ms`,
                        transform: isActive ? "scale(0.97)" : undefined,
                        transition:
                          "transform 120ms ease-out, border-color 200ms cubic-bezier(0.25,0,0,1), background-color 120ms ease-out, box-shadow 200ms cubic-bezier(0.25,0,0,1)",
                        boxShadow: isActive
                          ? "0 0 0 1px hsl(var(--primary)), 0 0 24px rgba(59,130,246,0.18)"
                          : undefined,
                      }}
                    >
                      {/* Icon + path label */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-11 h-11 rounded-xl bg-secondary border border-border flex items-center justify-center">
                          <path.icon className="w-5 h-5 text-primary" />
                        </div>
                        <span className="font-mono-label text-[10px] tracking-widest text-primary">
                          PATH {path.number}
                        </span>
                      </div>

                      {/* Title + description + helper */}
                      <h2 className="text-[17px] font-semibold text-foreground leading-snug">
                        {path.title}
                      </h2>
                      <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed">
                        {path.description}
                      </p>
                      <p className="text-[12px] text-[hsl(0_0%_53%)] italic mt-1.5">
                        {path.helper}
                      </p>

                      {/* Tags + arrow */}
                      <div className="mt-auto pt-4 border-t border-[hsl(0_0%_10%)] flex items-end justify-between">
                        <div className="flex flex-wrap gap-1.5">
                          {path.tags.map((tag) => (
                            <span
                              key={tag}
                              className="pill bg-secondary border border-border text-muted-foreground font-mono-label text-[11px] px-2 py-0.5"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0 ml-2" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ChoosePath;
