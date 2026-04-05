import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import {
  AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, ChevronRight,
  Download, Eye, FileText, Network, RefreshCw, Upload, X,
} from "lucide-react";
import { uploadFile, generateWbs, type WbsData, type WbsPhase } from "@/lib/api";

type Stage = "upload" | "processing" | "result" | "error";
type Audience = "PM" | "Developers" | "Designers" | "QA" | "Stakeholders";

const AUDIENCES: { id: Audience; label: string }[] = [
  { id: "PM",           label: "Product Manager (PM)" },
  { id: "Developers",   label: "Developers" },
  { id: "Designers",    label: "Designers" },
  { id: "QA",           label: "QA / Testing" },
  { id: "Stakeholders", label: "Business / Stakeholders" },
];

const PROCESSING_MESSAGES = [
  "Analyzing project requirements…",
  "Breaking down features into tasks…",
  "Structuring phases and subtasks…",
  "Optimizing for selected roles…",
];

const PHASE_COLORS = [
  "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "text-purple-400 bg-purple-500/10 border-purple-500/20",
  "text-green-400 bg-green-500/10 border-green-500/20",
  "text-orange-400 bg-orange-500/10 border-orange-500/20",
];

const WBSGenerator = () => {
  const navigate = useNavigate();

  const [stage, setStage]                   = useState<Stage>("upload");
  const [fileObjs, setFileObjs]             = useState<File[]>([]);
  const [isDragging, setIsDragging]         = useState(false);
  const [selected, setSelected]             = useState<Audience[]>(["PM", "Developers"]);
  const [processingMsg, setProcessingMsg]   = useState(0);
  const [processingPct, setProcessingPct]   = useState(0);
  const [showFullTable, setShowFullTable]   = useState(false);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(["P1"]));
  const [exportToast, setExportToast]       = useState(false);
  const [errorMsg, setErrorMsg]             = useState("");
  const [wbsData, setWbsData]               = useState<WbsData | null>(null);
  const [downloadUrl, setDownloadUrl]       = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    setFileObjs(prev => [...prev, ...Array.from(incoming)]);
  }, []);

  const toggleAudience = (id: Audience) => {
    setSelected(prev => prev.includes(id)
      ? (prev.length > 1 ? prev.filter(a => a !== id) : prev)
      : [...prev, id]);
  };

  const togglePhase = (id: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const startProcessing = async () => {
    if (fileObjs.length === 0) return;
    setStage("processing");
    setProcessingPct(0);
    setProcessingMsg(0);

    let pct = 0;
    const interval = setInterval(() => {
      pct += Math.random() * 12 + 4;
      if (pct >= 88) { pct = 88; clearInterval(interval); }
      setProcessingPct(pct);
      setProcessingMsg(Math.min(Math.floor((pct / 100) * PROCESSING_MESSAGES.length), PROCESSING_MESSAGES.length - 1));
    }, 500);

    try {
      const uploadRes = await uploadFile(fileObjs[0]);
      const wbsRes = await generateWbs(uploadRes.session_id, selected);
      setWbsData(wbsRes.data);
      setDownloadUrl(wbsRes.download_url);
      // expand first phase
      if (wbsRes.data.phases?.length > 0) {
        setExpandedPhases(new Set([wbsRes.data.phases[0].id]));
      }
      clearInterval(interval);
      setProcessingPct(100);
      setTimeout(() => setStage("result"), 400);
    } catch (err: any) {
      clearInterval(interval);
      setErrorMsg(err.message || "Generation failed. Please try again.");
      setStage("error");
    }
  };

  const handleExport = () => {
    if (downloadUrl) {
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = "WBS_Document.xlsx";
      a.click();
      setExportToast(true);
      setTimeout(() => setExportToast(false), 2500);
    }
  };

  const phases = wbsData?.phases || [];
  const allRows = phases.flatMap(phase =>
    phase.tasks.flatMap(task =>
      task.subtasks
        .filter(s => s.assigned_to.some(a => selected.includes(a as Audience)))
        .map(sub => ({ phase: phase.name, task: task.name, subtask: sub.name, assignedTo: sub.assigned_to.join(", "), phaseId: phase.id }))
    )
  );
  const previewRows = showFullTable ? allRows : allRows.slice(0, 7);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar activeItem="New Project" />
      <div className="flex-1 flex flex-col min-w-0">

        <div className="flex items-center px-6 lg:px-8 pt-6 shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/")} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary transition-all duration-200 hover:-translate-x-1">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <nav className="font-mono-label text-xs tracking-wider flex items-center gap-1.5">
              <span className="text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => navigate("/")}>Dashboard</span>
              <span className="text-[hsl(0_0%_20%)]">→</span>
              <span className="text-foreground">Work Breakdown Structure</span>
            </nav>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
          <div className="glow-top">
            <div className="max-w-[720px] mx-auto px-6 lg:px-8">

              {/* UPLOAD */}
              {stage === "upload" && (
                <>
                  <div className="mt-5 animate-fade-up flex justify-center">
                    <div className="inline-flex items-center gap-2 bg-secondary border border-border rounded-[20px] py-1.5 px-3.5">
                      <span className="w-1.5 h-1.5 rounded-sm bg-primary flex-shrink-0" />
                      <span className="font-mono-label text-xs text-foreground tracking-wide">Work Breakdown Structure Generator</span>
                    </div>
                  </div>
                  <div className="text-center pt-6 pb-8 animate-fade-up">
                    <h1 className="text-[28px] font-semibold text-foreground tracking-tight">Upload your documents</h1>
                    <p className="text-muted-foreground text-sm mt-3 max-w-[420px] mx-auto leading-relaxed">
                      Upload documents and generate a structured execution plan with phases, tasks, and subtasks.
                    </p>
                  </div>

                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files); }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`animate-fade-up rounded-2xl border-2 border-dashed cursor-pointer flex flex-col items-center justify-center gap-3 py-14 px-8 transition-all duration-200
                      ${isDragging ? "border-primary bg-[hsl(215_50%_5%)]" : "border-[hsl(0_0%_16%)] hover:border-[hsl(0_0%_28%)] bg-card"}`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-secondary border border-border flex items-center justify-center">
                      <Upload className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="text-[14px] text-foreground">Drop files here or <span className="text-primary">browse</span></p>
                      <p className="font-mono-label text-[11px] text-muted-foreground mt-1.5 tracking-wider">PDF · DOCX</p>
                    </div>
                    <input ref={fileInputRef} type="file" accept=".pdf,.docx" className="hidden"
                      onChange={(e) => e.target.files && addFiles(e.target.files)} />
                  </div>

                  {fileObjs.length > 0 && (
                    <div className="mt-4 space-y-2 animate-fade-up">
                      {fileObjs.map((f, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-foreground truncate">{f.name}</p>
                            <p className="font-mono-label text-[10px] text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</p>
                          </div>
                          <button onClick={() => setFileObjs(prev => prev.filter((_, j) => j !== i))}
                            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-6 rounded-2xl border border-border bg-card p-6 animate-fade-up">
                    <p className="text-[14px] font-semibold text-foreground mb-1">Select audience perspective</p>
                    <p className="text-[12px] text-muted-foreground mt-1 mb-4">Choose how tasks should be structured — multi-select allowed</p>
                    <div className="flex flex-wrap gap-2">
                      {AUDIENCES.map((a) => {
                        const isSel = selected.includes(a.id);
                        return (
                          <button key={a.id} onClick={() => toggleAudience(a.id)}
                            className={`px-4 py-2 rounded-xl text-[13px] font-medium border transition-all duration-150
                              ${isSel ? "bg-primary/10 border-primary text-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground"}`}>
                            {isSel && <span className="mr-1.5">✓</span>}{a.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-6 pb-16 animate-fade-up">
                    <button onClick={startProcessing} disabled={fileObjs.length === 0}
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200
                        ${fileObjs.length > 0 ? "bg-primary text-white hover:bg-primary/90 hover:-translate-y-0.5" : "bg-secondary text-muted-foreground border border-border cursor-not-allowed"}`}>
                      <Network className="w-4 h-4" />Generate WBS<ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}

              {/* PROCESSING */}
              {stage === "processing" && (
                <div className="flex flex-col items-center justify-center min-h-[70vh] animate-fade-up">
                  <div className="text-center w-full max-w-[380px]">
                    <div className="w-16 h-16 rounded-2xl bg-secondary border border-border flex items-center justify-center mx-auto mb-6">
                      <RefreshCw className="w-7 h-7 text-primary animate-spin" style={{ animationDuration: "2s" }} />
                    </div>
                    <h2 className="text-[22px] font-semibold text-foreground mb-2">{PROCESSING_MESSAGES[processingMsg]}</h2>
                    <p className="text-sm text-muted-foreground mb-8">Structuring for: {selected.join(", ")}</p>
                    <div className="w-full bg-secondary border border-border rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-500 ease-out" style={{ width: `${processingPct}%` }} />
                    </div>
                    <p className="font-mono-label text-[11px] text-muted-foreground mt-3 tracking-wider">{Math.round(processingPct)}%</p>
                  </div>
                </div>
              )}

              {/* ERROR */}
              {stage === "error" && (
                <div className="flex flex-col items-center justify-center min-h-[70vh] animate-fade-up text-center">
                  <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle className="w-7 h-7 text-red-400" />
                  </div>
                  <h2 className="text-[22px] font-semibold text-foreground mb-2">Generation failed</h2>
                  <p className="text-sm text-muted-foreground mb-8 max-w-[360px]">{errorMsg}</p>
                  <button onClick={() => { setStage("upload"); setFileObjs([]); setErrorMsg(""); }}
                    className="px-6 py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all">
                    Try again
                  </button>
                </div>
              )}

              {/* RESULT */}
              {stage === "result" && wbsData && (
                <>
                  <div className="mt-5 animate-fade-up flex justify-center">
                    <div className="inline-flex items-center gap-2 bg-[hsl(142_50%_8%)] border border-[hsl(142_40%_18%)] rounded-[20px] py-1.5 px-3.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                      <span className="font-mono-label text-xs text-green-400 tracking-wide">WBS ready</span>
                    </div>
                  </div>
                  <div className="text-center pt-6 pb-6 animate-fade-up">
                    <h1 className="text-[28px] font-semibold text-foreground tracking-tight">Your WBS is ready</h1>
                    <p className="text-muted-foreground text-sm mt-3 max-w-[420px] mx-auto leading-relaxed">
                      Structured for: {selected.join(", ")}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-6 animate-fade-up">
                    {[
                      { label: "Phases",   value: wbsData.total_phases,   color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
                      { label: "Tasks",    value: wbsData.total_tasks,    color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
                      { label: "Subtasks", value: wbsData.total_subtasks, color: "text-green-400 bg-green-500/10 border-green-500/20" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className={`rounded-xl border p-4 text-center ${color}`}>
                        <p className="text-[28px] font-bold text-foreground">{value}</p>
                        <p className={`font-mono-label text-[11px] tracking-wide mt-0.5 ${color.split(" ")[0]}`}>{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Phase tree */}
                  <div className="rounded-2xl border border-border bg-card overflow-hidden mb-4 animate-fade-up">
                    <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                      <p className="text-[13px] font-medium text-foreground">Phase Breakdown</p>
                      <p className="font-mono-label text-[10px] text-muted-foreground tracking-wider">CLICK TO EXPAND</p>
                    </div>
                    {phases.map((phase, pi) => {
                      const isOpen = expandedPhases.has(phase.id);
                      return (
                        <div key={phase.id} className="border-b border-[hsl(0_0%_8%)] last:border-0">
                          <button onClick={() => togglePhase(phase.id)}
                            className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-secondary/50 transition-colors text-left">
                            {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                            <span className={`font-mono-label text-[10px] tracking-widest border rounded-md px-2 py-0.5 ${PHASE_COLORS[pi % PHASE_COLORS.length]}`}>P{pi + 1}</span>
                            <span className="text-[13px] font-medium text-foreground">{phase.name}</span>
                            <span className="ml-auto font-mono-label text-[10px] text-muted-foreground">{phase.tasks.length} tasks</span>
                          </button>
                          {isOpen && (
                            <div className="pb-3">
                              {phase.tasks.map(task => (
                                <div key={task.id} className="px-12 py-2">
                                  <p className="text-[12px] font-medium text-foreground mb-1.5">{task.name}</p>
                                  {task.subtasks.filter(s => s.assigned_to.some(a => selected.includes(a as Audience))).map(sub => (
                                    <div key={sub.id} className="flex items-center gap-2 py-1">
                                      <div className="w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0 ml-1" />
                                      <p className="text-[12px] text-muted-foreground flex-1">{sub.name}</p>
                                      <span className="font-mono-label text-[9px] text-muted-foreground bg-secondary border border-border rounded px-1.5 py-0.5">{sub.assigned_to.join(", ")}</span>
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Flat table */}
                  <div className="rounded-2xl border border-border bg-card overflow-hidden mb-6 animate-fade-up">
                    <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                      <p className="text-[13px] font-medium text-foreground">Flat Table Preview</p>
                      <p className="font-mono-label text-[10px] text-muted-foreground tracking-wider">{allRows.length} ROWS</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            {["Phase", "Task", "Subtask", "Assigned To"].map(h => (
                              <th key={h} className="px-4 py-3 text-left font-mono-label text-[10px] text-muted-foreground tracking-wider">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.map((row, i) => (
                            <tr key={i} className="border-b border-[hsl(0_0%_8%)] hover:bg-secondary/50 transition-colors">
                              <td className="px-4 py-2.5">
                                <span className={`font-mono-label text-[10px] border rounded-md px-2 py-0.5 ${PHASE_COLORS[phases.findIndex(p => p.name === row.phase) % PHASE_COLORS.length]}`}>
                                  {row.phase.split("—")[0].trim().split(" ").slice(0,2).join(" ")}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-[12px] text-muted-foreground">{row.task}</td>
                              <td className="px-4 py-2.5 text-[12px] text-foreground">{row.subtask}</td>
                              <td className="px-4 py-2.5">
                                <span className="font-mono-label text-[10px] text-muted-foreground bg-secondary border border-border rounded px-2 py-0.5">{row.assignedTo}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!showFullTable && allRows.length > 7 && (
                      <button onClick={() => setShowFullTable(true)}
                        className="w-full py-3 text-[12px] text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1.5 border-t border-border">
                        <Eye className="w-3.5 h-3.5" />Show all {allRows.length} rows
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pb-16 animate-fade-up">
                    <button onClick={handleExport}
                      className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 hover:-translate-y-0.5 transition-all duration-200">
                      <Download className="w-4 h-4" />Download Excel (.xlsx)
                    </button>
                    <button onClick={() => { setStage("upload"); setFileObjs([]); setShowFullTable(false); setWbsData(null); }}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-muted-foreground border border-border hover:text-foreground transition-all duration-200">
                      <RefreshCw className="w-4 h-4" />Upload new documents
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      {exportToast && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-secondary border border-border rounded-xl px-4 py-3 shadow-lg animate-fade-up z-50">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          <span className="text-[13px] text-foreground">WBS downloaded successfully</span>
        </div>
      )}
    </div>
  );
};

export default WBSGenerator;
