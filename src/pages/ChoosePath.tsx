import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import {
  ArrowLeft,
  ArrowRight,
  PenLine,
  Upload,
  RefreshCw,
  Check,
  X,
} from "lucide-react";

type PathType = "SCRATCH" | "UPLOAD" | "REFORMAT";

const DOC_FULL_NAMES: Record<string, string> = {
  SOW: "Statement of Work",
  PRD: "Product Requirements Document",
  FRD: "Functional Requirements Document",
};

const paths: {
  id: PathType;
  number: string;
  icon: typeof PenLine;
  title: string;
  description: string;
  tags: string[];
  recommended?: boolean;
  muted?: boolean;
}[] = [
  {
    id: "SCRATCH",
    number: "01",
    icon: PenLine,
    title: "Start from Scratch",
    description:
      "Answer a structured set of questions and our AI builds your document from the ground up. Best when you're starting a new project with no existing documentation.",
    tags: ["Guided questionnaire", "~15 minutes", "No uploads needed"],
  },
  {
    id: "UPLOAD",
    number: "02",
    icon: Upload,
    title: "Upload Your Documents",
    description:
      "Upload rough notes, diagrams, briefs, or any existing documents. Our AI extracts what it can, identifies the gaps, and asks only the questions you haven't answered yet. Fastest path to a complete document.",
    tags: ["Upload PDFs, DOCX, images", "AI fills gaps automatically", "Review before generating"],
    recommended: true,
  },
  {
    id: "REFORMAT",
    number: "03",
    icon: RefreshCw,
    title: "Reformat Existing Document",
    description:
      "Already have a completed document but need it in Invuric or client format? Upload it and we'll restructure the layout, formatting, and branding — no content changes.",
    tags: ["Upload existing document", "Format conversion only", "~2 minutes"],
    muted: true,
  },
];

const steps = ["Type", "Path", "Configure"];

const NEXT_STEP_LABELS: Record<PathType, string> = {
  SCRATCH: "Next: Answer guided questions to build your document",
  UPLOAD: "Next: Upload your files and answer gap questions",
  REFORMAT: "Next: Upload your document and choose output format",
};

const ChoosePath = () => {
  const [searchParams] = useSearchParams();
  const docType = searchParams.get("type") || "SOW";
  const docFullName = DOC_FULL_NAMES[docType] || docType;

  const [selectedPath, setSelectedPath] = useState<PathType | null>(null);
  const navigate = useNavigate();

  const handleSelect = (path: PathType) => {
    if (selectedPath === path) {
      setSelectedPath(null);
    } else {
      setSelectedPath(path);
      console.log("[API] selectPath called:", path);
    }
  };

  const handleContinue = () => {
    if (selectedPath) {
      console.log("[API] continueToPath called:", selectedPath);
    }
  };

  const handleBack = () => {
    console.log("[API] navigateBack called");
    navigate("/document-generation");
  };

  const handleRemoveDocType = () => {
    console.log("[API] goBackToDocumentType called");
    navigate("/document-generation");
  };

  const selectedPathData = paths.find((p) => p.id === selectedPath);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar activeItem="New Project" />

      <div className="flex-1 flex flex-col min-w-0">
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
            <div className="max-w-3xl mx-auto px-6 lg:px-8">
              {/* Context chip */}
              <div className="mt-6 mb-12 animate-fade-up">
                <div className="inline-flex items-center gap-2.5 bg-secondary border border-border rounded-[20px] py-1.5 px-3.5 pr-3">
                  <span className="w-1.5 h-1.5 rounded-sm bg-primary flex-shrink-0" />
                  <span className="font-mono-label text-xs text-foreground tracking-wide">
                    {docType} — {docFullName}
                  </span>
                  <button
                    onClick={handleRemoveDocType}
                    className="text-[hsl(0_0%_27%)] hover:text-foreground transition-colors duration-200 ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Header */}
              <div className="text-center pt-8 pb-10 animate-fade-up">
                <div className="inline-flex items-center pill bg-secondary border border-border text-primary font-mono-label text-[11px] tracking-wider mb-6">
                  #02 — Choose Path
                </div>
                <h1 className="text-[38px] font-light text-foreground tracking-tight leading-tight">
                  How do you want to build your {docType}?
                </h1>
                <p className="text-muted-foreground text-[15px] mt-4 max-w-[520px] mx-auto" style={{ lineHeight: 1.65 }}>
                  Choose the path that matches what you already have. Each path is tailored to your starting point — from zero to an existing document.
                </p>
              </div>

              {/* Path cards */}
              <div className="flex flex-col gap-3 pb-8">
                {paths.map((path, i) => {
                  const isSelected = selectedPath === path.id;
                  const hasSelection = selectedPath !== null;
                  const isDeselected = hasSelection && !isSelected;
                  const isMuted = path.muted;
                  const accentColor = isMuted ? "hsl(0 0% 27%)" : "hsl(var(--primary))";

                  return (
                    <button
                      key={path.id}
                      onClick={() => handleSelect(path.id)}
                      disabled={isDeselected}
                      className={`
                        group relative text-left rounded-2xl p-7 pl-8
                        transition-all duration-200 cursor-pointer
                        animate-fade-up
                        ${isSelected
                          ? "border border-primary bg-[hsl(215_50%_8%)]"
                          : "border border-border bg-card"
                        }
                        ${isDeselected ? "opacity-[0.45] pointer-events-none" : ""}
                        ${!isSelected && !isDeselected ? "hover:bg-[hsl(0_0%_8%)]" : ""}
                        active:scale-[0.99]
                      `}
                      style={{
                        animationDelay: `${80 + i * 80}ms`,
                        borderLeftWidth: isSelected ? 1 : 3,
                        borderLeftColor: isSelected ? "hsl(var(--primary))" : accentColor,
                      }}
                    >
                      {/* Recommended badge */}
                      {path.recommended && (
                        <span
                          className="absolute top-0 right-0 bg-primary text-primary-foreground font-mono-label text-[10px] font-bold tracking-wider px-2.5 py-1"
                          style={{ borderRadius: "0 16px 0 8px" }}
                        >
                          RECOMMENDED
                        </span>
                      )}

                      {/* Selected checkmark */}
                      {isSelected && (
                        <div className="absolute top-6 left-6 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-primary-foreground" />
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-6">
                        {/* Left block */}
                        <div className="flex items-start gap-5 flex-1 min-w-0">
                          <div
                            className="w-12 h-12 rounded-[10px] bg-secondary border border-border flex items-center justify-center flex-shrink-0"
                            style={{ marginLeft: isSelected ? 6 : 0 }}
                          >
                            <path.icon
                              className="w-5 h-5"
                              style={{ color: isMuted ? "hsl(0 0% 40%)" : "hsl(var(--primary))" }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span
                              className="font-mono-label text-[10px] tracking-[0.1em]"
                              style={{ color: isMuted ? "hsl(0 0% 27%)" : "hsl(var(--primary))" }}
                            >
                              PATH {path.number}
                            </span>
                            <h2 className="text-xl font-medium text-foreground mt-1">
                              {path.title}
                            </h2>
                            <p className="text-[13px] text-muted-foreground mt-1.5 max-w-[420px]" style={{ lineHeight: 1.6 }}>
                              {path.description}
                            </p>
                          </div>
                        </div>

                        {/* Right block: tags + arrow */}
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0 pt-1">
                          {path.tags.map((tag) => (
                            <span
                              key={tag}
                              className="pill bg-secondary border border-border font-mono-label text-[11px] px-2.5 py-0.5 whitespace-nowrap"
                              style={{
                                color: isMuted ? "hsl(0 0% 33%)" : "hsl(0 0% 40%)",
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                          <ArrowRight
                            className="w-4 h-4 text-primary mt-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200"
                          />
                        </div>
                      </div>

                      {/* Left border glow on hover (non-muted only) */}
                      {!isMuted && !isSelected && (
                        <div className="absolute inset-y-0 left-0 w-[3px] rounded-l-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          style={{ boxShadow: "-2px 0 12px rgba(59,130,246,0.3)" }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Spacer for bottom bar */}
              <div className="h-24" />
            </div>
          </div>
        </main>

        {/* Bottom action bar */}
        <div
          className={`
            fixed bottom-0 left-0 lg:left-60 right-0 z-40
            bg-card border-t border-border
            px-8 py-5 flex items-center justify-between
            transition-transform duration-300
            ${selectedPath ? "translate-y-0" : "translate-y-full"}
          `}
          style={{
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div className="flex items-center gap-3">
            {selectedPathData && (
              <>
                <div className="w-10 h-10 rounded-lg bg-secondary border border-border flex items-center justify-center">
                  <selectedPathData.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex flex-col">
                  <span className="text-foreground font-medium text-sm">
                    PATH {selectedPathData.number} — {selectedPathData.title}
                  </span>
                  <span className="text-muted-foreground text-[13px]">
                    {NEXT_STEP_LABELS[selectedPath!]}
                  </span>
                </div>
              </>
            )}
          </div>
          <button
            onClick={handleContinue}
            className="h-11 px-8 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors duration-200 flex items-center gap-2 min-w-[140px] justify-center"
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChoosePath;
