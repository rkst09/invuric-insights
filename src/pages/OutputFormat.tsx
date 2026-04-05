import { useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Upload,
  X,
  Zap,
} from "lucide-react";

const DOC_FULL_NAMES: Record<string, string> = {
  SOW: "Statement of Work",
  PRD: "Product Requirements Document",
  FRD: "Functional Requirements Document",
};

const steps = ["Type", "Path", "Configure", "Format"];

type FormatOption = "INVURIC" | "CLIENT" | null;
type FileExport = "docx" | "pdf";

const OutputFormat = () => {
  const [searchParams] = useSearchParams();
  const docType = searchParams.get("type") || "SOW";
  const docFullName = DOC_FULL_NAMES[docType] || docType;

  const [selected, setSelected] = useState<FormatOption>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [exportFormat, setExportFormat] = useState<FileExport>("docx");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleBack = () => navigate(-1);

  const handleSelectInvuric = () => {
    setSelected("INVURIC");
    setUploadedFile(null);
  };

  const handleSelectClient = () => {
    setSelected("CLIENT");
  };

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (allowed.includes(file.type)) setUploadedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file);
  };

  const canGenerate = selected === "INVURIC" || (selected === "CLIENT" && uploadedFile);

  const handleGenerate = () => {
    if (!canGenerate || isGenerating) return;
    setIsGenerating(true);
    setTimeout(() => setIsExiting(true), 100);
    setTimeout(() => navigate(`/generating?type=${docType}&format=${selected}&export=${exportFormat}`), 280);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar activeItem="New Project" />

      <div
        className="flex-1 flex flex-col min-w-0"
        style={{
          opacity: isExiting ? 0 : 1,
          transform: isExiting ? "translateY(-8px)" : "translateY(0)",
          transition: "opacity 180ms ease-out, transform 180ms ease-out",
        }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 lg:px-8 pt-6 shrink-0">
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
              <span className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors duration-200" onClick={handleBack}>
                Configure
              </span>
              <span className="text-[hsl(0_0%_20%)]">→</span>
              <span className="text-foreground">Output Format</span>
            </nav>
          </div>

          {/* Step indicator */}
          <div className="hidden sm:flex items-center gap-0">
            {steps.map((step, i) => (
              <div key={step} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      i <= 3 ? "bg-primary" : "border border-[hsl(0_0%_20%)]"
                    }`}
                  />
                  <span
                    className={`font-mono-label text-[10px] tracking-wider ${
                      i === 3 ? "text-foreground" : "text-[hsl(0_0%_33%)]"
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

        {/* Main content */}
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
                  #04 — Output Format
                </div>
                <h1 className="text-[28px] font-semibold text-foreground tracking-tight leading-tight">
                  Choose how you want your {docType} structured
                </h1>
                <p className="text-muted-foreground text-sm mt-3 max-w-[420px] mx-auto leading-relaxed">
                  Select a format — then generate your final document instantly.
                </p>
              </div>

              {/* Format cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-[900px] mx-auto">

                {/* Card 1 — Invuric Standard */}
                <button
                  onClick={handleSelectInvuric}
                  className={`
                    group relative text-left flex flex-col rounded-2xl p-8
                    animate-fade-up cursor-pointer border bg-card
                    transition-all duration-200
                    ${selected === "INVURIC"
                      ? "border-primary bg-[hsl(215_50%_8%)] shadow-[0_0_0_1px_hsl(var(--primary)),0_0_28px_rgba(59,130,246,0.18)]"
                      : "border-border hover:border-primary hover:-translate-y-[4px] hover:shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_8px_32px_rgba(59,130,246,0.08)]"
                    }
                  `}
                  style={{ animationDelay: "0ms" }}
                >
                  {/* Selected indicator */}
                  {selected === "INVURIC" && (
                    <div className="absolute top-4 right-4">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    </div>
                  )}

                  {/* Icon + label */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-secondary border border-border flex items-center justify-center">
                      <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-mono-label text-[10px] tracking-widest text-primary">
                      OPTION 01
                    </span>
                  </div>

                  <h2 className="text-[17px] font-semibold text-foreground leading-snug">
                    Invuric Standard
                  </h2>
                  <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed">
                    Use our professionally structured, industry-ready {docType} format.
                  </p>
                  <p className="text-[12px] text-[hsl(0_0%_53%)] italic mt-1.5">
                    Best for quick, polished output
                  </p>

                  {/* Mini doc preview */}
                  <div className="mt-4 rounded-lg border border-border bg-secondary p-3 space-y-1.5">
                    {["Executive Summary", "Scope of Work", "Deliverables", "Timeline & Milestones"].map((line) => (
                      <div key={line} className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-primary opacity-60 shrink-0" />
                        <span className="font-mono-label text-[10px] text-muted-foreground tracking-wide">{line}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 opacity-40">
                      <div className="w-1 h-1 rounded-full bg-muted-foreground shrink-0" />
                      <span className="font-mono-label text-[10px] text-muted-foreground tracking-wide">+ more sections…</span>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="mt-auto pt-5 border-t border-[hsl(0_0%_10%)] flex flex-wrap gap-1.5">
                    {["Structured", "Professional", "Ready-to-use"].map((tag) => (
                      <span key={tag} className="pill bg-secondary border border-border text-muted-foreground font-mono-label text-[11px] px-2 py-0.5">
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>

                {/* Card 2 — Client Format */}
                <div
                  className={`
                    group relative flex flex-col rounded-2xl border bg-card
                    animate-fade-up transition-all duration-200
                    ${selected === "CLIENT"
                      ? "border-primary bg-[hsl(215_50%_8%)] shadow-[0_0_0_1px_hsl(var(--primary)),0_0_28px_rgba(59,130,246,0.18)]"
                      : "border-border hover:border-primary hover:-translate-y-[4px] hover:shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_8px_32px_rgba(59,130,246,0.08)]"
                    }
                  `}
                  style={{ animationDelay: "60ms" }}
                >
                  <button
                    onClick={handleSelectClient}
                    className="text-left flex flex-col p-8 pb-5 w-full"
                  >
                    {selected === "CLIENT" && (
                      <div className="absolute top-4 right-4">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      </div>
                    )}

                    <div className="flex items-start justify-between mb-4">
                      <div className="w-11 h-11 rounded-xl bg-secondary border border-border flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <span className="font-mono-label text-[10px] tracking-widest text-primary">
                        OPTION 02
                      </span>
                    </div>

                    <h2 className="text-[17px] font-semibold text-foreground leading-snug">
                      Client's Custom Format
                    </h2>
                    <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed">
                      Upload your client's template and we'll generate the {docType} in their format.
                    </p>
                    <p className="text-[12px] text-[hsl(0_0%_53%)] italic mt-1.5">
                      Best for client-specific requirements
                    </p>
                  </button>

                  {/* Expandable upload area */}
                  <div
                    className="overflow-hidden transition-all duration-300 ease-out"
                    style={{ maxHeight: selected === "CLIENT" ? "300px" : "0px", opacity: selected === "CLIENT" ? 1 : 0 }}
                  >
                    <div className="px-8 pb-6">
                      <div className="h-px bg-[hsl(0_0%_10%)] mb-5" />

                      {!uploadedFile ? (
                        <div
                          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                          onDragLeave={() => setIsDragging(false)}
                          onDrop={handleDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className={`
                            relative rounded-xl border-2 border-dashed cursor-pointer
                            flex flex-col items-center justify-center gap-2 py-7 px-4
                            transition-all duration-200
                            ${isDragging
                              ? "border-primary bg-[hsl(215_50%_5%)]"
                              : "border-[hsl(0_0%_16%)] hover:border-[hsl(0_0%_24%)] bg-secondary"
                            }
                          `}
                        >
                          <Upload className="w-5 h-5 text-muted-foreground" />
                          <p className="text-[13px] text-muted-foreground text-center">
                            Drop your template here or <span className="text-primary">browse</span>
                          </p>
                          <p className="font-mono-label text-[10px] text-[hsl(0_0%_33%)] tracking-wider">
                            DOCX · PDF
                          </p>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            className="hidden"
                            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary px-4 py-3">
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-foreground truncate">{uploadedFile.name}</p>
                            <p className="font-mono-label text-[10px] text-muted-foreground mt-0.5">
                              {(uploadedFile.size / 1024).toFixed(0)} KB
                            </p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }}
                            className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tags (always visible) */}
                  <div className="px-8 pb-6 mt-auto">
                    <div className="pt-4 border-t border-[hsl(0_0%_10%)] flex flex-wrap gap-1.5">
                      {["Custom", "Client-ready", "Template-based"].map((tag) => (
                        <span key={tag} className="pill bg-secondary border border-border text-muted-foreground font-mono-label text-[11px] px-2 py-0.5">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Export format toggle */}
              <div
                className="max-w-[900px] mx-auto mt-6 animate-fade-up"
                style={{ animationDelay: "120ms" }}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono-label text-[11px] text-muted-foreground tracking-wider">
                    EXPORT AS
                  </span>
                  <div className="flex items-center gap-1 bg-secondary border border-border rounded-lg p-1">
                    {(["docx", "pdf"] as FileExport[]).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setExportFormat(fmt)}
                        className={`
                          px-3 py-1 rounded-md font-mono-label text-[11px] tracking-wider
                          transition-all duration-150
                          ${exportFormat === fmt
                            ? "bg-primary text-white"
                            : "text-muted-foreground hover:text-foreground"
                          }
                        `}
                      >
                        {fmt === "docx" ? "Word (.docx)" : "PDF"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom CTA */}
              <div className="max-w-[900px] mx-auto mt-8 pb-16 flex items-center gap-4 animate-fade-up" style={{ animationDelay: "160ms" }}>
                <button
                  onClick={handleGenerate}
                  disabled={!canGenerate || isGenerating}
                  className={`
                    flex items-center gap-2.5 px-6 py-3 rounded-xl font-medium text-sm
                    transition-all duration-200
                    ${canGenerate
                      ? "bg-primary text-white hover:bg-primary/90 hover:shadow-[0_0_24px_rgba(59,130,246,0.3)] hover:-translate-y-0.5"
                      : "bg-secondary text-muted-foreground border border-border cursor-not-allowed"
                    }
                  `}
                >
                  <Zap className="w-4 h-4" />
                  Generate {docType}
                  <ArrowRight className="w-4 h-4" />
                </button>

                {selected === "CLIENT" && !uploadedFile && (
                  <p className="text-[12px] text-muted-foreground italic">
                    Upload a template to continue
                  </p>
                )}

                {!selected && (
                  <p className="text-[12px] text-muted-foreground italic">
                    Select a format above to continue
                  </p>
                )}
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default OutputFormat;
