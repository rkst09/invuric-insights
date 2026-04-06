import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import { uploadFile, generatePfd } from "@/lib/api";
import {
  ArrowLeft,
  ArrowRight,
  Database,
  Download,
  FileText,
  GitBranch,
  Layers,
  RefreshCw,
  Server,
  Upload,
  Users,
  Briefcase,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = "upload" | "processing" | "choose-flow" | "choose-style" | "generating" | "preview";

type FlowType = {
  id: string;
  icon: typeof Users;
  title: string;
  description: string;
};

type DiagramStyle = {
  id: "flowchart" | "swimlane" | "sequence";
  title: string;
  description: string;
  preview: React.ReactNode;
};

type UploadedFile = { id: string; name: string; size: number };

// ─── Data ────────────────────────────────────────────────────────────────────

const FLOW_TYPES: FlowType[] = [
  { id: "user-journey",  icon: Users,     title: "User Journey Flow",         description: "How users move through your product step-by-step" },
  { id: "business",      icon: Briefcase, title: "Business Process Flow",      description: "End-to-end business operations and handoffs" },
  { id: "system",        icon: Server,    title: "System Interaction Flow",    description: "How services and components communicate" },
  { id: "data",          icon: Database,  title: "Data Flow",                  description: "How data moves and transforms through the system" },
  { id: "feature",       icon: Layers,    title: "Feature Flow",               description: "How a specific feature works internally" },
  { id: "approval",      icon: GitBranch, title: "Approval & Escalation Flow", description: "Decision gates, approvals, and escalation paths" },
];

const PROCESSING_MESSAGES = [
  "Extracting workflows…",
  "Identifying actors and steps…",
  "Mapping process logic…",
  "Building flow structure…",
];

const GENERATING_MESSAGES = [
  "Designing your diagram…",
  "Structuring flows…",
  "Rendering visual nodes…",
];

// ─── Mock Mermaid diagrams per style ─────────────────────────────────────────

const MOCK_DIAGRAMS: Record<string, string> = {
  flowchart: `graph TD
    A([Start]) --> B[User submits request]
    B --> C{Validation}
    C -->|Valid| D[Process request]
    C -->|Invalid| E[Return error]
    D --> F[Notify stakeholders]
    F --> G[Update records]
    G --> H([End])
    E --> B`,

  swimlane: `graph LR
    subgraph Client
      A[Submit Request] --> B[Receive Confirmation]
    end
    subgraph System
      C[Validate Input] --> D[Process Logic]
      D --> E[Generate Response]
    end
    subgraph Database
      F[(Store Record)]
    end
    B --> C
    E --> F
    F --> B`,

  sequence: `sequenceDiagram
    actor User
    participant Frontend
    participant API
    participant Database
    User->>Frontend: Submit form
    Frontend->>API: POST /request
    API->>Database: Validate & store
    Database-->>API: Success
    API-->>Frontend: 200 OK
    Frontend-->>User: Show confirmation`,
};

// ─── Mini preview SVGs ────────────────────────────────────────────────────────

const FlowchartPreview = () => (
  <svg viewBox="0 0 120 90" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect x="40" y="4" width="40" height="16" rx="8" fill="#1e293b" stroke="#3b82f6" strokeWidth="1"/>
    <text x="60" y="15" fontSize="6" fill="#94a3b8" textAnchor="middle">Start</text>
    <line x1="60" y1="20" x2="60" y2="30" stroke="#334155" strokeWidth="1"/>
    <rect x="30" y="30" width="60" height="16" rx="3" fill="#1e293b" stroke="#475569" strokeWidth="1"/>
    <text x="60" y="41" fontSize="5.5" fill="#94a3b8" textAnchor="middle">Process Step</text>
    <line x1="60" y1="46" x2="60" y2="54" stroke="#334155" strokeWidth="1"/>
    <polygon points="60,54 48,62 60,70 72,62" fill="#1e293b" stroke="#3b82f6" strokeWidth="1"/>
    <text x="60" y="64" fontSize="5" fill="#94a3b8" textAnchor="middle">Decision</text>
    <line x1="48" y1="62" x2="20" y2="62" stroke="#334155" strokeWidth="1"/>
    <line x1="72" y1="62" x2="100" y2="62" stroke="#334155" strokeWidth="1"/>
    <rect x="6" y="54" width="28" height="16" rx="3" fill="#1e293b" stroke="#475569" strokeWidth="1"/>
    <text x="20" y="65" fontSize="5" fill="#94a3b8" textAnchor="middle">No</text>
    <rect x="86" y="54" width="28" height="16" rx="3" fill="#1e293b" stroke="#475569" strokeWidth="1"/>
    <text x="100" y="65" fontSize="5" fill="#94a3b8" textAnchor="middle">Yes</text>
    <line x1="100" y1="70" x2="100" y2="80" stroke="#334155" strokeWidth="1"/>
    <rect x="80" y="78" width="40" height="10" rx="5" fill="#1e293b" stroke="#3b82f6" strokeWidth="1"/>
    <text x="100" y="85" fontSize="5" fill="#94a3b8" textAnchor="middle">End</text>
  </svg>
);

const SwimlanePreview = () => (
  <svg viewBox="0 0 120 90" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="116" height="20" rx="2" fill="#0f172a" stroke="#1e293b" strokeWidth="1"/>
    <text x="10" y="14" fontSize="5.5" fill="#3b82f6" fontFamily="monospace">Client</text>
    <rect x="2" y="24" width="116" height="20" rx="2" fill="#0f172a" stroke="#1e293b" strokeWidth="1"/>
    <text x="10" y="36" fontSize="5.5" fill="#3b82f6" fontFamily="monospace">System</text>
    <rect x="2" y="46" width="116" height="20" rx="2" fill="#0f172a" stroke="#1e293b" strokeWidth="1"/>
    <text x="10" y="58" fontSize="5.5" fill="#3b82f6" fontFamily="monospace">Database</text>
    <rect x="28" y="6" width="24" height="12" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="1"/>
    <text x="40" y="14" fontSize="4.5" fill="#94a3b8" textAnchor="middle">Request</text>
    <rect x="60" y="6" width="24" height="12" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="1"/>
    <text x="72" y="14" fontSize="4.5" fill="#94a3b8" textAnchor="middle">Response</text>
    <rect x="28" y="28" width="24" height="12" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="1"/>
    <text x="40" y="36" fontSize="4.5" fill="#94a3b8" textAnchor="middle">Validate</text>
    <rect x="60" y="28" width="24" height="12" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="1"/>
    <text x="72" y="36" fontSize="4.5" fill="#94a3b8" textAnchor="middle">Process</text>
    <rect x="44" y="50" width="24" height="12" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="1"/>
    <text x="56" y="58" fontSize="4.5" fill="#94a3b8" textAnchor="middle">Store</text>
    <line x1="40" y1="18" x2="40" y2="28" stroke="#3b82f6" strokeWidth="0.8" strokeDasharray="2,1"/>
    <line x1="52" y1="34" x2="60" y2="34" stroke="#334155" strokeWidth="0.8"/>
    <line x1="56" y1="40" x2="56" y2="50" stroke="#3b82f6" strokeWidth="0.8" strokeDasharray="2,1"/>
  </svg>
);

const SequencePreview = () => (
  <svg viewBox="0 0 120 90" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    {[20, 55, 90].map((x, i) => (
      <g key={i}>
        <rect x={x - 12} y="4" width="24" height="12" rx="3" fill="#1e293b" stroke="#3b82f6" strokeWidth="1"/>
        <text x={x} y="12" fontSize="4.5" fill="#94a3b8" textAnchor="middle">{["User","API","DB"][i]}</text>
        <line x1={x} y1="16" x2={x} y2="86" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,2"/>
      </g>
    ))}
    {[
      { y: 28, x1: 20, x2: 55, label: "Request", dir: 1 },
      { y: 42, x1: 55, x2: 90, label: "Query", dir: 1 },
      { y: 56, x1: 90, x2: 55, label: "Result", dir: -1 },
      { y: 70, x1: 55, x2: 20, label: "Response", dir: -1 },
    ].map((arrow, i) => (
      <g key={i}>
        <line x1={arrow.x1} y1={arrow.y} x2={arrow.x2} y2={arrow.y} stroke={i % 2 === 0 ? "#3b82f6" : "#475569"} strokeWidth="0.8"/>
        <polygon
          points={`${arrow.x2},${arrow.y} ${arrow.x2 - arrow.dir * 4},${arrow.y - 2} ${arrow.x2 - arrow.dir * 4},${arrow.y + 2}`}
          fill={i % 2 === 0 ? "#3b82f6" : "#475569"}
        />
        <text x={(arrow.x1 + arrow.x2) / 2} y={arrow.y - 3} fontSize="4" fill="#64748b" textAnchor="middle">{arrow.label}</text>
      </g>
    ))}
  </svg>
);

const DIAGRAM_STYLES: DiagramStyle[] = [
  {
    id: "flowchart",
    title: "Flowchart",
    description: "Linear steps with decision branches",
    preview: <FlowchartPreview />,
  },
  {
    id: "swimlane",
    title: "Swimlane",
    description: "Steps organized by role or system",
    preview: <SwimlanePreview />,
  },
  {
    id: "sequence",
    title: "Sequence Diagram",
    description: "Time-ordered messages between actors",
    preview: <SequencePreview />,
  },
];

// ─── Steps bar ───────────────────────────────────────────────────────────────

const STEPS = ["Upload", "Analyze", "Visualize", "Style", "Preview"];
const STAGE_STEP: Record<Stage, number> = {
  upload: 0, processing: 1, "choose-flow": 2, "choose-style": 3, generating: 3, preview: 4,
};

// ─── Component ───────────────────────────────────────────────────────────────

const ProcessFlowDiagram = () => {
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>("upload");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [fileObjs, setFileObjs] = useState<File[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mermaidCode, setMermaidCode] = useState<string>("");
  const [apiError, setApiError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processingMsg, setProcessingMsg] = useState(0);
  const [processingPct, setProcessingPct] = useState(0);
  const [generatingMsg, setGeneratingMsg] = useState(0);
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<"flowchart" | "swimlane" | "sequence" | null>(null);
  const [zoom, setZoom] = useState(1);
  const [exportToast, setExportToast] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const diagramRef = useRef<HTMLDivElement>(null);

  // ── File handling ─────────────────────────────────────────────────────────

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const mapped = arr.map((f) => ({
      id: `${f.name}_${Date.now()}`,
      name: f.name,
      size: f.size,
    }));
    setFiles((prev) => [...prev, ...mapped]);
    setFileObjs((prev) => [...prev, ...arr]);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  // ── Processing (real API) ─────────────────────────────────────────────────

  const startProcessing = async () => {
    if (fileObjs.length === 0) return;
    setStage("processing");
    setProcessingPct(0);
    setProcessingMsg(0);
    setApiError(null);

    // Animate progress bar while uploading
    let pct = 0;
    const interval = setInterval(() => {
      pct += Math.random() * 12 + 4;
      if (pct >= 90) { pct = 90; clearInterval(interval); }
      setProcessingPct(Math.min(pct, 90));
      setProcessingMsg(Math.floor((pct / 100) * (PROCESSING_MESSAGES.length - 1)));
    }, 400);

    try {
      const res = await uploadFile(fileObjs[0]);
      setSessionId(res.session_id);
      clearInterval(interval);
      setProcessingPct(100);
      setProcessingMsg(PROCESSING_MESSAGES.length - 1);
      setTimeout(() => setStage("choose-flow"), 400);
    } catch (err) {
      clearInterval(interval);
      setApiError(err instanceof Error ? err.message : "Upload failed");
      setStage("upload");
    }
  };

  // ── Generation (real API) ─────────────────────────────────────────────────

  useEffect(() => {
    if (stage !== "generating") return;
    if (!sessionId || !selectedFlow || !selectedStyle) return;

    setGeneratingMsg(0);
    const t1 = setTimeout(() => setGeneratingMsg(1), 600);
    const t2 = setTimeout(() => setGeneratingMsg(2), 1200);

    generatePfd({ session_id: sessionId, flow_type: selectedFlow, style: selectedStyle })
      .then((res) => {
        clearTimeout(t1); clearTimeout(t2);
        setMermaidCode(res.mermaid_code);
        setStage("preview");
      })
      .catch((err) => {
        clearTimeout(t1); clearTimeout(t2);
        setApiError(err instanceof Error ? err.message : "Generation failed");
        setStage("choose-style");
      });

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [stage]);

  // ── Mermaid render ────────────────────────────────────────────────────────

  useEffect(() => {
    if (stage !== "preview" || !mermaidCode || !diagramRef.current) return;
    const code = mermaidCode;

    import("mermaid").then((m) => {
      const mermaid = m.default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        themeVariables: {
          background: "#0a0a0a",
          primaryColor: "#1e293b",
          primaryTextColor: "#e2e8f0",
          lineColor: "#334155",
          edgeLabelBackground: "#0f172a",
          tertiaryColor: "#0f172a",
        },
      });
      const id = `mermaid-${Date.now()}`;
      mermaid.render(id, code).then(({ svg }) => {
        if (diagramRef.current) diagramRef.current.innerHTML = svg;
      }).catch(() => {
        if (diagramRef.current)
          diagramRef.current.innerHTML = `<pre class="text-xs text-muted-foreground p-4 font-mono whitespace-pre-wrap">${code}</pre>`;
      });
    }).catch(() => {
      if (diagramRef.current)
        diagramRef.current.innerHTML = `<pre class="text-xs text-muted-foreground p-4 font-mono whitespace-pre-wrap">${code}</pre>`;
    });
  }, [stage, mermaidCode]);

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExport = (fmt: "png" | "pdf" | "svg") => {
    if (!diagramRef.current) return;
    const svg = diagramRef.current.querySelector("svg");
    if (!svg) return;

    const triggerDownload = (url: string, filename: string) => {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    if (fmt === "svg") {
      const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
      triggerDownload(URL.createObjectURL(blob), "diagram.svg");
      setExportToast(true);
      setTimeout(() => setExportToast(false), 2500);
      return;
    }

    if (fmt === "pdf") {
      // Open print dialog for PDF — no external lib required
      const printWin = window.open("", "_blank");
      if (printWin) {
        printWin.document.write(
          `<html><body style="margin:0;background:#fff">${svg.outerHTML}</body></html>`
        );
        printWin.document.close();
        printWin.focus();
        printWin.print();
        printWin.close();
      }
      setExportToast(true);
      setTimeout(() => setExportToast(false), 2500);
      return;
    }

    // PNG — use Blob URL to avoid btoa Unicode issues; set explicit dimensions
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const rect  = svg.getBoundingClientRect();
    const W = Math.max(rect.width,  svg.viewBox.baseVal.width,  1200);
    const H = Math.max(rect.height, svg.viewBox.baseVal.height,  800);
    clone.setAttribute("width",  String(W));
    clone.setAttribute("height", String(H));
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    const svgBlob = new Blob([new XMLSerializer().serializeToString(clone)], {
      type: "image/svg+xml;charset=utf-8",
    });
    const svgUrl = URL.createObjectURL(svgBlob);

    const canvas = document.createElement("canvas");
    const scale  = 2; // retina quality
    canvas.width  = W * scale;
    canvas.height = H * scale;

    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(scale, scale);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
      canvas.toBlob((blob) => {
        if (!blob) return;
        triggerDownload(URL.createObjectURL(blob), "diagram.png");
      }, "image/png");
      URL.revokeObjectURL(svgUrl);
    };
    img.onerror = () => URL.revokeObjectURL(svgUrl);
    img.src = svgUrl;

    setExportToast(true);
    setTimeout(() => setExportToast(false), 2500);
  };

  const activeStep = STAGE_STEP[stage];

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
        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 lg:px-8 pt-6 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/")}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary transition-all duration-200 hover:-translate-x-1"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <nav className="font-mono-label text-xs tracking-wider flex items-center gap-1.5">
              <span className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors" onClick={() => navigate("/")}>Dashboard</span>
              <span className="text-[hsl(0_0%_20%)]">→</span>
              <span className="text-foreground">Process Flow Diagram</span>
            </nav>
          </div>

          {/* Step indicator */}
          <div className="hidden sm:flex items-center gap-0">
            {STEPS.map((step, i) => (
              <div key={step} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                    i < activeStep ? "bg-primary" :
                    i === activeStep ? "bg-primary ring-2 ring-primary/30" :
                    "border border-[hsl(0_0%_20%)]"
                  }`} />
                  <span className={`font-mono-label text-[10px] tracking-wider ${i === activeStep ? "text-foreground" : "text-[hsl(0_0%_33%)]"}`}>
                    {step}
                  </span>
                </div>
                {i < STEPS.length - 1 && <div className="w-8 h-px bg-[hsl(0_0%_13%)] mx-1 -mt-4" />}
              </div>
            ))}
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          <div className="glow-top">

            {/* ── STAGE: UPLOAD ──────────────────────────────────────────── */}
            {stage === "upload" && (
              <div className="max-w-[720px] mx-auto px-6 lg:px-8">
                <div className="mt-5 animate-fade-up flex justify-center">
                  <div className="inline-flex items-center gap-2 bg-secondary border border-border rounded-[20px] py-1.5 px-3.5">
                    <span className="w-1.5 h-1.5 rounded-sm bg-primary flex-shrink-0" />
                    <span className="font-mono-label text-xs text-foreground tracking-wide">Process Flow Diagram Generator</span>
                  </div>
                </div>

                <div className="text-center pt-6 pb-8 animate-fade-up">
                  <div className="inline-flex items-center pill bg-secondary border border-border text-primary font-mono-label text-[11px] tracking-wider mb-4">
                    #01 — Upload Documents
                  </div>
                  <h1 className="text-[28px] font-semibold text-foreground tracking-tight">Upload your documents</h1>
                  <p className="text-muted-foreground text-sm mt-3 max-w-[400px] mx-auto leading-relaxed">
                    Upload SOW, PRD, FRD or any relevant files — we'll extract flows automatically.
                  </p>
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    animate-fade-up rounded-2xl border-2 border-dashed cursor-pointer
                    flex flex-col items-center justify-center gap-3 py-14 px-8
                    transition-all duration-200
                    ${isDragging ? "border-primary bg-[hsl(215_50%_5%)]" : "border-[hsl(0_0%_16%)] hover:border-[hsl(0_0%_28%)] bg-card"}
                  `}
                  style={{ animationDelay: "80ms" }}
                >
                  <div className="w-12 h-12 rounded-xl bg-secondary border border-border flex items-center justify-center">
                    <Upload className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-[14px] text-foreground">Drop files here or <span className="text-primary">browse</span></p>
                    <p className="font-mono-label text-[11px] text-muted-foreground mt-1 tracking-wider">PDF · DOCX · TXT</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.txt"
                    className="hidden"
                    onChange={(e) => e.target.files && addFiles(e.target.files)}
                  />
                </div>

                {/* File list */}
                {files.length > 0 && (
                  <div className="mt-4 space-y-2 animate-fade-up">
                    {files.map((f) => (
                      <div key={f.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-foreground truncate">{f.name}</p>
                          <p className="font-mono-label text-[10px] text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const idx = files.findIndex((x) => x.id === f.id);
                            setFiles((prev) => prev.filter((x) => x.id !== f.id));
                            setFileObjs((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {apiError && (
                  <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    {apiError}
                  </div>
                )}

                <div className="mt-8 pb-16 animate-fade-up" style={{ animationDelay: "120ms" }}>
                  <button
                    onClick={startProcessing}
                    disabled={files.length === 0}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      files.length > 0
                        ? "bg-primary text-white hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(59,130,246,0.3)]"
                        : "bg-secondary text-muted-foreground border border-border cursor-not-allowed"
                    }`}
                  >
                    Analyze Documents <ArrowRight className="w-4 h-4" />
                  </button>
                  {files.length === 0 && (
                    <p className="text-[12px] text-muted-foreground italic mt-3">Upload at least one file to continue</p>
                  )}
                </div>
              </div>
            )}

            {/* ── STAGE: PROCESSING ──────────────────────────────────────── */}
            {stage === "processing" && (
              <div className="max-w-[480px] mx-auto px-6 flex flex-col items-center justify-center min-h-[70vh]">
                <div className="animate-fade-up text-center">
                  <div className="w-16 h-16 rounded-2xl bg-secondary border border-border flex items-center justify-center mx-auto mb-6">
                    <RefreshCw className="w-7 h-7 text-primary animate-spin" style={{ animationDuration: "2s" }} />
                  </div>
                  <h2 className="text-[22px] font-semibold text-foreground mb-2">Analyzing your documents</h2>
                  <p className="text-sm text-muted-foreground mb-8">{PROCESSING_MESSAGES[processingMsg]}</p>

                  {/* Progress bar */}
                  <div className="w-full bg-secondary border border-border rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${processingPct}%` }}
                    />
                  </div>
                  <p className="font-mono-label text-[11px] text-muted-foreground mt-3 tracking-wider">
                    {Math.round(processingPct)}%
                  </p>
                </div>
              </div>
            )}

            {/* ── STAGE: CHOOSE FLOW ─────────────────────────────────────── */}
            {stage === "choose-flow" && (
              <div className="max-w-[820px] mx-auto px-6 lg:px-8">
                <div className="mt-5 animate-fade-up flex justify-center">
                  <div className="inline-flex items-center gap-2 bg-secondary border border-border rounded-[20px] py-1.5 px-3.5">
                    <span className="w-1.5 h-1.5 rounded-sm bg-primary flex-shrink-0" />
                    <span className="font-mono-label text-xs text-foreground tracking-wide">
                      We identified {files.length * 2 + 3} flows across your documents
                    </span>
                  </div>
                </div>

                <div className="text-center pt-6 pb-8 animate-fade-up">
                  <div className="inline-flex items-center pill bg-secondary border border-border text-primary font-mono-label text-[11px] tracking-wider mb-4">
                    #02 — Choose Flow Type
                  </div>
                  <h1 className="text-[28px] font-semibold text-foreground tracking-tight">What do you want to visualize?</h1>
                  <p className="text-muted-foreground text-sm mt-3">Select the type of flow to generate</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-16">
                  {FLOW_TYPES.map((flow, i) => (
                    <button
                      key={flow.id}
                      onClick={() => { setSelectedFlow(flow.id); setTimeout(() => setStage("choose-style"), 180); }}
                      className="group text-left flex items-start gap-4 rounded-2xl p-5 border bg-card border-border
                        hover:border-primary hover:-translate-y-[3px] hover:shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_8px_24px_rgba(59,130,246,0.08)]
                        transition-all duration-200 animate-fade-up"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center shrink-0 group-hover:border-primary/40 transition-colors">
                        <flow.icon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-[14px] font-semibold text-foreground">{flow.title}</h3>
                        <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{flow.description}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0 mt-0.5" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── STAGE: CHOOSE STYLE ────────────────────────────────────── */}
            {stage === "choose-style" && (
              <div className="max-w-[900px] mx-auto px-6 lg:px-8">
                <div className="text-center pt-10 pb-8 animate-fade-up">
                  <div className="inline-flex items-center pill bg-secondary border border-border text-primary font-mono-label text-[11px] tracking-wider mb-4">
                    #03 — Diagram Style
                  </div>
                  <h1 className="text-[28px] font-semibold text-foreground tracking-tight">Choose your diagram style</h1>
                  <p className="text-muted-foreground text-sm mt-3">Pick the format that best represents your flow</p>
                </div>

                {apiError && (
                  <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    {apiError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-16">
                  {DIAGRAM_STYLES.map((style, i) => (
                    <button
                      key={style.id}
                      onClick={() => { setSelectedStyle(style.id); setTimeout(() => setStage("generating"), 180); }}
                      className="group text-left flex flex-col rounded-2xl border bg-card border-border
                        hover:border-primary hover:-translate-y-[4px] hover:shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_8px_32px_rgba(59,130,246,0.08)]
                        transition-all duration-200 animate-fade-up overflow-hidden"
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      {/* Mini preview */}
                      <div className="h-[140px] bg-[hsl(0_0%_5%)] border-b border-border p-4 flex items-center justify-center">
                        {style.preview}
                      </div>

                      <div className="p-5">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-[15px] font-semibold text-foreground">{style.title}</h3>
                          <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-[12px] text-muted-foreground leading-relaxed">{style.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── STAGE: GENERATING ──────────────────────────────────────── */}
            {stage === "generating" && (
              <div className="max-w-[480px] mx-auto px-6 flex flex-col items-center justify-center min-h-[70vh]">
                <div className="animate-fade-up text-center">
                  <div className="relative w-16 h-16 mx-auto mb-6">
                    <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-ping" style={{ animationDuration: "2s" }} />
                    <div className="w-16 h-16 rounded-2xl bg-secondary border border-border flex items-center justify-center">
                      <GitBranch className="w-7 h-7 text-primary" />
                    </div>
                  </div>
                  <h2 className="text-[22px] font-semibold text-foreground mb-2">
                    {GENERATING_MESSAGES[generatingMsg]}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Building your {DIAGRAM_STYLES.find(s => s.id === selectedStyle)?.title.toLowerCase()}…
                  </p>
                </div>
              </div>
            )}

            {/* ── STAGE: PREVIEW ─────────────────────────────────────────── */}
            {stage === "preview" && (
              <div className="flex gap-0 h-[calc(100vh-80px)]">

                {/* Left controls panel */}
                <div className="w-64 shrink-0 border-r border-border flex flex-col bg-card">
                  <div className="p-5 border-b border-border">
                    <div className="inline-flex items-center pill bg-secondary border border-border text-primary font-mono-label text-[11px] tracking-wider mb-3">
                      #05 — Preview
                    </div>
                    <p className="text-[13px] text-foreground font-medium">
                      {FLOW_TYPES.find(f => f.id === selectedFlow)?.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {DIAGRAM_STYLES.find(s => s.id === selectedStyle)?.title}
                    </p>
                  </div>

                  {/* Controls */}
                  <div className="p-4 space-y-2 border-b border-border">
                    <p className="font-mono-label text-[10px] text-muted-foreground tracking-wider mb-3">CONTROLS</p>
                    <button
                      onClick={() => setZoom(z => Math.min(z + 0.2, 2))}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <ZoomIn className="w-4 h-4" /> Zoom In
                    </button>
                    <button
                      onClick={() => setZoom(z => Math.max(z - 0.2, 0.4))}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <ZoomOut className="w-4 h-4" /> Zoom Out
                    </button>
                    <button
                      onClick={() => setStage("generating")}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" /> Regenerate
                    </button>
                  </div>

                  {/* Change options */}
                  <div className="p-4 space-y-2 border-b border-border">
                    <p className="font-mono-label text-[10px] text-muted-foreground tracking-wider mb-3">CHANGE</p>
                    <button
                      onClick={() => setStage("choose-flow")}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <Layers className="w-4 h-4" /> Flow Type
                    </button>
                    <button
                      onClick={() => setStage("choose-style")}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <GitBranch className="w-4 h-4" /> Diagram Style
                    </button>
                  </div>

                  {/* Export */}
                  <div className="p-4 mt-auto">
                    <p className="font-mono-label text-[10px] text-muted-foreground tracking-wider mb-3">EXPORT</p>
                    {(["png", "svg", "pdf"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => handleExport(fmt)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium
                          bg-secondary border border-border text-muted-foreground hover:text-foreground hover:border-primary
                          transition-all duration-200 mb-2"
                      >
                        <Download className="w-4 h-4" />
                        Export {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right: diagram canvas */}
                <div className="flex-1 overflow-auto bg-[hsl(0_0%_3%)] flex items-start justify-center p-8">
                  <div
                    style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 200ms ease" }}
                  >
                    <div
                      ref={diagramRef}
                      className="min-w-[500px] rounded-2xl border border-border bg-card p-8"
                    >
                      <p className="text-muted-foreground text-sm text-center">Rendering diagram…</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Export toast */}
      {exportToast && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-secondary border border-border rounded-xl px-4 py-3 shadow-lg animate-fade-up">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="text-[13px] text-foreground">Diagram exported successfully</span>
        </div>
      )}
    </div>
  );
};

export default ProcessFlowDiagram;
