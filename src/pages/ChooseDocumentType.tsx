import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import {
  ArrowLeft,
  FileText,
  ClipboardList,
  Code2,
  ArrowRight,
} from "lucide-react";
import { openDocumentGuide, navigateBack } from "@/lib/api";

type DocType = "SOW" | "PRD" | "FRD";

const documents: {
  type: DocType;
  number: string;
  fullName: string;
  shortName: string;
  description: string;
  tags: string[];
  icon: typeof FileText;
}[] = [
  {
    type: "SOW",
    number: "01",
    fullName: "STATEMENT OF WORK",
    shortName: "SOW",
    description:
      "Define project scope, deliverables, timeline, and commercial terms. Ideal for client-facing project agreements and vendor contracts.",
    tags: ["Scope", "Timeline", "Deliverables"],
    icon: FileText,
  },
  {
    type: "PRD",
    number: "02",
    fullName: "PRODUCT REQUIREMENTS DOCUMENT",
    shortName: "PRD",
    description:
      "Capture the what and why of your product. Define goals, user personas, features, and success metrics for stakeholders and product teams.",
    tags: ["Features", "Personas", "Metrics"],
    icon: ClipboardList,
  },
  {
    type: "FRD",
    number: "03",
    fullName: "FUNCTIONAL REQUIREMENTS DOCUMENT",
    shortName: "FRD",
    description:
      "Translate product requirements into precise system behaviours. Detail functional specs, business rules, and technical requirements for developers.",
    tags: ["Logic", "Rules", "APIs"],
    icon: Code2,
  },
];

const steps = ["Type", "Path", "Configure"];

const ChooseDocumentType = () => {
  const [activeCard, setActiveCard] = useState<DocType | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const navigate = useNavigate();

  const handleSelect = (type: DocType) => {
    if (activeCard) return; // prevent double-tap during animation

    setActiveCard(type);

    // Phase 1: card micro-interaction (120ms)
    // Phase 2: page exit transition (starts at 120ms, lasts 180ms)
    setTimeout(() => {
      setIsExiting(true);
    }, 120);

    // Navigate after full animation completes
    setTimeout(() => {
      navigate(`/choose-path?type=${type}`);
    }, 300);
  };

  const handleBack = () => {
    navigateBack();
    navigate("/");
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
        {/* Top area: breadcrumb + step indicator */}
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
                onClick={handleBack}
              >
                Dashboard
              </span>
              <span className="text-[hsl(0_0%_20%)]">→</span>
              <span className="text-muted-foreground">Document Generation</span>
              <span className="text-[hsl(0_0%_20%)]">→</span>
              <span className="text-foreground">Choose Document Type</span>
            </nav>
          </div>

          {/* Step indicator */}
          <div className="hidden sm:flex items-center gap-0">
            {steps.map((step, i) => (
              <div key={step} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      i === 0
                        ? "bg-primary"
                        : "border border-[hsl(0_0%_20%)]"
                    }`}
                  />
                  <span className="font-mono-label text-[10px] text-[hsl(0_0%_33%)] tracking-wider">
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
            <div className="max-w-5xl mx-auto px-6 lg:px-8">
              {/* Header */}
              <div className="text-center pt-16 pb-12 animate-fade-up">
                <div className="inline-flex items-center pill bg-secondary border border-border text-primary font-mono-label text-[11px] tracking-wider mb-6">
                  #01 — Document Generation
                </div>
                <h1 className="text-[40px] font-light text-foreground tracking-tight leading-tight">
                  What would you like to create?
                </h1>
                <p className="text-muted-foreground text-base mt-4 max-w-[480px] mx-auto leading-relaxed">
                  Choose a document type to begin. Each document follows a guided
                  generation process tailored to your project needs.
                </p>
              </div>

              {/* Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 justify-center">
                {documents.map((doc, i) => {
                  const isActive = activeCard === doc.type;

                  return (
                    <button
                      key={doc.type}
                      onClick={() => handleSelect(doc.type)}
                      disabled={!!activeCard}
                      className={`
                        group relative text-left flex flex-col rounded-2xl p-8
                        animate-fade-up cursor-pointer
                        border transition-all
                        ${isActive
                          ? "border-primary bg-[hsl(215_50%_8%)]"
                          : "border-border bg-card hover:border-primary hover:-translate-y-1 hover:shadow-[0_0_24px_rgba(59,130,246,0.08)]"
                        }
                      `}
                      style={{
                        animationDelay: `${80 + i * 80}ms`,
                        minHeight: 380,
                        transform: isActive ? "scale(0.97)" : undefined,
                        transition: "transform 120ms ease-out, border-color 120ms ease-out, background-color 120ms ease-out, box-shadow 120ms ease-out",
                        boxShadow: isActive
                          ? "0 0 0 1px hsl(var(--primary)), 0 0 24px rgba(59,130,246,0.18)"
                          : undefined,
                      }}
                    >
                      {/* Top row: icon + number */}
                      <div className="flex items-start justify-between mb-6">
                        <div className="w-14 h-14 rounded-xl bg-secondary border border-border flex items-center justify-center">
                          <doc.icon className="w-6 h-6 text-primary" />
                        </div>
                        <span className="font-mono-label text-sm text-[hsl(0_0%_20%)]">
                          {doc.number}
                        </span>
                      </div>

                      {/* Middle */}
                      <p className="font-mono-label text-[13px] text-primary tracking-widest uppercase">
                        {doc.fullName}
                      </p>
                      <h2 className="text-[32px] font-medium text-foreground mt-2">
                        {doc.shortName}
                      </h2>
                      <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                        {doc.description}
                      </p>

                      {/* Bottom */}
                      <div className="mt-auto pt-6 border-t border-[hsl(0_0%_10%)] flex items-center justify-between">
                        <div className="flex flex-wrap gap-1.5">
                          {doc.tags.map((tag) => (
                            <span
                              key={tag}
                              className="pill bg-secondary border border-border text-muted-foreground font-mono-label text-[11px] px-2 py-0.5"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Helper text */}
              <div className="text-center mt-12 pb-24">
                <span className="text-[hsl(0_0%_27%)] text-[13px]">
                  Not sure which to choose?{" "}
                </span>
                <button
                  onClick={openDocumentGuide}
                  className="text-primary text-[13px] hover:underline transition-all duration-200"
                >
                  See document type guide →
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ChooseDocumentType;
