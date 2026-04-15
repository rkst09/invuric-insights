import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  HelpCircle,
  Link2,
  RefreshCw,
  Upload,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { uploadFile, generateRaid, type GenerationStatusResponse, type RaidData, type RaidItem } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = "upload" | "processing" | "result" | "error";
type RAIDType = "Risk" | "Assumption" | "Issue" | "Dependency";

type RAIDRow = {
  id: string;
  type: RAIDType;
  description: string;
  impact: string;
  owner: string;
};

const TYPE_CONFIG: Record<RAIDType, { icon: typeof AlertTriangle; color: string; bg: string }> = {
  Risk:        { icon: AlertTriangle, color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20" },
  Assumption:  { icon: HelpCircle,   color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  Issue:       { icon: RefreshCw,    color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  Dependency:  { icon: Link2,        color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20" },
};

const IMPACT_COLOR: Record<string, string> = {
  High:     "text-red-400 bg-red-500/10 border-red-500/20",
  Critical: "text-red-400 bg-red-500/10 border-red-500/20",
  Medium:   "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  Low:      "text-green-400 bg-green-500/10 border-green-500/20",
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
};

// ─── Flatten API response into table rows ─────────────────────────────────────

function flattenRaid(data: RaidData): RAIDRow[] {
  const rows: RAIDRow[] = [];
  data.risks?.forEach(r => rows.push({ id: r.id, type: "Risk", description: r.description, impact: r.impact || r.probability || "Medium", owner: r.owner || "" }));
  data.assumptions?.forEach(r => rows.push({ id: r.id, type: "Assumption", description: r.description, impact: r.impact || "Medium", owner: r.owner || "" }));
  data.issues?.forEach(r => rows.push({ id: r.id, type: "Issue", description: r.description, impact: r.severity || r.impact || "Medium", owner: r.owner || "" }));
  data.dependencies?.forEach(r => rows.push({ id: r.id, type: "Dependency", description: r.description, impact: r.type || r.impact || "Medium", owner: r.owner || "" }));
  return rows;
}

// ─── Component ────────────────────────────────────────────────────────────────

const RaidDocument = () => {
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>("upload");
  const [fileObjs, setFileObjs] = useState<File[]>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [processingMsg, setProcessingMsg] = useState(0);
  const [processingPct, setProcessingPct] = useState(0);
  const [processingLabel, setProcessingLabel] = useState("Preparing your RAID document...");
  const [showFullTable, setShowFullTable] = useState(false);
  const [exportToast, setExportToast] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [raidRows, setRaidRows] = useState<RAIDRow[]>([]);
  const [downloadUrl, setDownloadUrl] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File handling ───────────────────────────────────────────────────────────

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    setFileObjs(prev => [...prev, ...arr]);
    setFileNames(prev => [...prev, ...arr.map(f => f.name)]);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  // ── Auto-trigger when file added ────────────────────────────────────────────


  // ── Processing: upload + generate ──────────────────────────────────────────

  const startProcessing = useCallback(async () => {
    if (fileObjs.length === 0) {
      return;
    }

    setStage("processing");
    setProcessingPct(0);
    setProcessingMsg(0);
    setProcessingLabel("Uploading and preparing your documents...");

    try {
      let activeSessionId: string | undefined;

      for (const file of fileObjs) {
        const uploadRes = await uploadFile(file, activeSessionId);
        activeSessionId = uploadRes.session_id;
      }

      if (!activeSessionId) {
        throw new Error("No files were uploaded.");
      }

      setSessionId(activeSessionId);

      const raidRes = await generateRaid(activeSessionId, (status: GenerationStatusResponse) => {
        const progress = status.generation?.progress;
        const message = status.generation?.message;
        if (typeof progress === "number") {
          setProcessingPct(progress);
          setProcessingMsg(Math.min(Math.floor((progress / 100) * 4), 3));
        }
        if (message) {
          setProcessingLabel(message);
        }
      });
      setDownloadUrl(raidRes.download_url);
      setRaidRows(flattenRaid(raidRes.data));

      setProcessingPct(100);
      setProcessingLabel("RAID register ready.");
      setTimeout(() => setStage("result"), 400);
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err));
      setStage("error");
    }
  }, [fileObjs]);

  // ── Export (backend .xlsx) ──────────────────────────────────────────────────

  useEffect(() => {
    if (fileObjs.length === 0 || stage !== "upload") return;

    const timer = setTimeout(() => {
      void startProcessing();
    }, 600);

    return () => clearTimeout(timer);
  }, [fileObjs, stage, startProcessing]);

  const handleExport = () => {
    if (downloadUrl) {
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = "RAID_Document.xlsx";
      a.click();
      setExportToast(true);
      setTimeout(() => setExportToast(false), 2500);
    }
  };

  const summary = {
    Risk:       raidRows.filter(r => r.type === "Risk").length,
    Assumption: raidRows.filter(r => r.type === "Assumption").length,
    Issue:      raidRows.filter(r => r.type === "Issue").length,
    Dependency: raidRows.filter(r => r.type === "Dependency").length,
  };

  const previewRows = showFullTable ? raidRows : raidRows.slice(0, 6);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar activeItem="New Project" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 lg:px-8 pt-6 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/")}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary transition-all duration-200 hover:-translate-x-1"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <nav className="font-mono-label text-xs tracking-wider flex items-center gap-1.5">
              <span className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors" onClick={() => navigate("/")}>
                Dashboard
              </span>
              <span className="text-[hsl(0_0%_20%)]">→</span>
              <span className="text-foreground">RAID Document Generator</span>
            </nav>
          </div>
        </div>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          <div className="glow-top">
            <div className="max-w-[720px] mx-auto px-6 lg:px-8">

              {/* ── UPLOAD ─────────────────────────────────────────────────── */}
              {stage === "upload" && (
                <>
                  <div className="mt-5 animate-fade-up flex justify-center">
                    <div className="inline-flex items-center gap-2 bg-secondary border border-border rounded-[20px] py-1.5 px-3.5">
                      <span className="w-1.5 h-1.5 rounded-sm bg-primary flex-shrink-0" />
                      <span className="font-mono-label text-xs text-foreground tracking-wide">RAID Document Generator</span>
                    </div>
                  </div>

                  <div className="text-center pt-6 pb-8 animate-fade-up">
                    <h1 className="text-[28px] font-semibold text-foreground tracking-tight">Upload your documents</h1>
                    <p className="text-muted-foreground text-sm mt-3 max-w-[440px] mx-auto leading-relaxed">
                      Upload your project documents and we'll extract risks, assumptions, issues, and dependencies automatically.
                    </p>
                  </div>

                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`animate-fade-up rounded-2xl border-2 border-dashed cursor-pointer flex flex-col items-center justify-center gap-3 py-16 px-8 transition-all duration-200 ${
                      isDragging ? "border-primary bg-[hsl(215_50%_5%)]" : "border-[hsl(0_0%_16%)] hover:border-[hsl(0_0%_28%)] bg-card"
                    }`}
                    style={{ animationDelay: "60ms" }}
                  >
                    <div className="w-12 h-12 rounded-xl bg-secondary border border-border flex items-center justify-center">
                      <Upload className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="text-[14px] text-foreground">Drop your documents here or <span className="text-primary">browse</span></p>
                      <p className="font-mono-label text-[11px] text-muted-foreground mt-1.5 tracking-wider">PDF · DOCX</p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.docx"
                      className="hidden"
                      onChange={(e) => e.target.files && addFiles(e.target.files)}
                    />
                  </div>

                  <p className="text-[12px] text-muted-foreground text-center mt-3 animate-fade-up" style={{ animationDelay: "80ms" }}>
                    You can upload SOW, PRD, FRD or any project documents
                  </p>
                </>
              )}

              {/* ── PROCESSING ─────────────────────────────────────────────── */}
              {stage === "processing" && (
                <div className="flex flex-col items-center justify-center min-h-[70vh] animate-fade-up">
                  <div className="text-center w-full max-w-[380px]">
                    <div className="w-16 h-16 rounded-2xl bg-secondary border border-border flex items-center justify-center mx-auto mb-6">
                      <RefreshCw className="w-7 h-7 text-primary animate-spin" style={{ animationDuration: "2s" }} />
                    </div>
                    <h2 className="text-[22px] font-semibold text-foreground mb-2">{processingLabel}</h2>
                    <p className="text-sm text-muted-foreground mb-8">Analyzing {fileNames.length} document{fileNames.length > 1 ? "s" : ""}</p>
                    <div className="w-full bg-secondary border border-border rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-500 ease-out" style={{ width: `${processingPct}%` }} />
                    </div>
                    <p className="font-mono-label text-[11px] text-muted-foreground mt-3 tracking-wider">{Math.round(processingPct)}%</p>
                  </div>
                </div>
              )}

              {/* ── ERROR ──────────────────────────────────────────────────── */}
              {stage === "error" && (
                <div className="flex flex-col items-center justify-center min-h-[70vh] animate-fade-up text-center">
                  <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle className="w-7 h-7 text-red-400" />
                  </div>
                  <h2 className="text-[22px] font-semibold text-foreground mb-2">Generation failed</h2>
                  <p className="text-sm text-muted-foreground mb-8 max-w-[360px]">{errorMsg}</p>
                  <button
                    onClick={() => { setStage("upload"); setFileObjs([]); setFileNames([]); setErrorMsg(""); }}
                    className="px-6 py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all"
                  >
                    Try again
                  </button>
                </div>
              )}

              {/* ── RESULT ─────────────────────────────────────────────────── */}
              {stage === "result" && (
                <>
                  <div className="mt-5 animate-fade-up flex justify-center">
                    <div className="inline-flex items-center gap-2 bg-[hsl(142_50%_8%)] border border-[hsl(142_40%_18%)] rounded-[20px] py-1.5 px-3.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                      <span className="font-mono-label text-xs text-green-400 tracking-wide">RAID document ready</span>
                    </div>
                  </div>

                  <div className="text-center pt-6 pb-6 animate-fade-up">
                    <h1 className="text-[28px] font-semibold text-foreground tracking-tight">Your RAID document is ready</h1>
                    <p className="text-muted-foreground text-sm mt-3 max-w-[440px] mx-auto leading-relaxed">
                      We identified key risks, assumptions, issues, and dependencies from your documents.
                    </p>
                  </div>

                  {/* Summary counts */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 animate-fade-up" style={{ animationDelay: "60ms" }}>
                    {(Object.entries(summary) as [RAIDType, number][]).map(([type, count]) => {
                      const cfg = TYPE_CONFIG[type];
                      return (
                        <div key={type} className={`rounded-xl border p-4 text-center ${cfg.bg}`}>
                          <p className="text-[24px] font-bold text-foreground">{count}</p>
                          <div className="flex items-center justify-center gap-1.5 mt-1">
                            <cfg.icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                            <p className={`font-mono-label text-[11px] tracking-wide ${cfg.color}`}>{type}s</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Preview table */}
                  <div className="rounded-2xl border border-border bg-card overflow-hidden mb-6 animate-fade-up" style={{ animationDelay: "100ms" }}>
                    <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                      <p className="text-[13px] font-medium text-foreground">Preview</p>
                      <p className="font-mono-label text-[10px] text-muted-foreground tracking-wider">{raidRows.length} ITEMS TOTAL</p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            {["Type", "Description", "Impact", "Owner"].map((h) => (
                              <th key={h} className="px-4 py-3 text-left font-mono-label text-[10px] text-muted-foreground tracking-wider">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.map((row) => {
                            const cfg = TYPE_CONFIG[row.type];
                            return (
                              <tr key={row.id} className="border-b border-[hsl(0_0%_8%)] hover:bg-secondary/50 transition-colors">
                                <td className="px-4 py-3">
                                  <div className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 ${cfg.bg}`}>
                                    <cfg.icon className={`w-3 h-3 ${cfg.color}`} />
                                    <span className={`font-mono-label text-[10px] tracking-wide ${cfg.color}`}>{row.type}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-[12px] text-muted-foreground max-w-[300px]">
                                  <span className="line-clamp-2">{row.description}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`font-mono-label text-[10px] tracking-wide border rounded-md px-2 py-0.5 ${IMPACT_COLOR[row.impact] || IMPACT_COLOR["Medium"]}`}>
                                    {row.impact}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-[12px] text-muted-foreground">{row.owner}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {!showFullTable && raidRows.length > 6 && (
                      <button
                        onClick={() => setShowFullTable(true)}
                        className="w-full py-3 text-[12px] text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1.5 border-t border-border"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Show all {raidRows.length} items
                      </button>
                    )}
                  </div>

                  {/* Export CTA */}
                  <div className="flex items-center gap-3 pb-16 animate-fade-up" style={{ animationDelay: "140ms" }}>
                    <button
                      onClick={handleExport}
                      className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(59,130,246,0.3)] transition-all duration-200"
                    >
                      <Download className="w-4 h-4" />
                      Download Excel (.xlsx)
                    </button>

                    <button
                      onClick={() => { setStage("upload"); setFileObjs([]); setFileNames([]); setShowFullTable(false); setRaidRows([]); }}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-muted-foreground border border-border hover:text-foreground hover:border-[hsl(0_0%_24%)] transition-all duration-200"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Upload new documents
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>
        </main>
      </div>

      {/* Export toast */}
      {exportToast && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-secondary border border-border rounded-xl px-4 py-3 shadow-lg animate-fade-up z-50">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          <span className="text-[13px] text-foreground">RAID document downloaded</span>
        </div>
      )}
    </div>
  );
};

export default RaidDocument;
