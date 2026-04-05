import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import {
  AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Download, Eye,
  FileText, Image, MessageSquare, RefreshCw, Upload, X,
} from "lucide-react";
import { uploadFile, generateBacklog, type BacklogData, type UserStory } from "@/lib/api";

type Stage = "input" | "processing" | "result" | "error";
type DocFile    = { id: string; name: string; size: number; file: File };
type ScreenFile = { id: string; name: string; url: string };

const PROCESSING_MESSAGES = [
  "Analyzing documents…",
  "Understanding user journeys…",
  "Generating user stories…",
  "Structuring backlog…",
];

const TABLE_HEADERS = [
  "Page Name", "High Level Flow", "User Story",
  "Acceptance Criteria", "Data Points", "Edge Cases",
  "Non-Functional", "Project ID", "Project Name", "Analyzed At",
];

const UserStories = () => {
  const navigate = useNavigate();

  const [stage, setStage]                       = useState<Stage>("input");
  const [docFiles, setDocFiles]                 = useState<DocFile[]>([]);
  const [screenFiles, setScreenFiles]           = useState<ScreenFile[]>([]);
  const [flowDesc, setFlowDesc]                 = useState("");
  const [isDraggingDoc, setIsDraggingDoc]       = useState(false);
  const [isDraggingScreen, setIsDraggingScreen] = useState(false);
  const [processingMsg, setProcessingMsg]       = useState(0);
  const [processingPct, setProcessingPct]       = useState(0);
  const [showFullTable, setShowFullTable]       = useState(false);
  const [exportToast, setExportToast]           = useState(false);
  const [errorMsg, setErrorMsg]                 = useState("");
  const [stories, setStories]                   = useState<UserStory[]>([]);
  const [downloadUrl, setDownloadUrl]           = useState("");

  const docInputRef    = useRef<HTMLInputElement>(null);
  const screenInputRef = useRef<HTMLInputElement>(null);

  const addDocFiles = useCallback((incoming: FileList | File[]) => {
    setDocFiles(prev => [
      ...prev,
      ...Array.from(incoming).map(f => ({ id: `${f.name}_${Date.now()}`, name: f.name, size: f.size, file: f })),
    ]);
  }, []);

  const addScreenFiles = useCallback((incoming: FileList | File[]) => {
    Array.from(incoming).forEach(f => {
      const reader = new FileReader();
      reader.onload = e => {
        setScreenFiles(prev => [...prev, { id: `${f.name}_${Date.now()}`, name: f.name, url: e.target?.result as string }]);
      };
      reader.readAsDataURL(f);
    });
  }, []);

  const startProcessing = async () => {
    if (docFiles.length === 0) return;
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
      const uploadRes = await uploadFile(docFiles[0].file);
      const project_name = docFiles[0].name.rsplit?.(".", 1)?.[0] || "Project";
      const backlogRes = await generateBacklog({
        session_id: uploadRes.session_id,
        project_name: docFiles[0].name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " "),
        project_id: `PRJ-${Date.now().toString().slice(-6)}`,
      });
      setStories(backlogRes.data.stories || []);
      setDownloadUrl(backlogRes.download_url);
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
      a.download = "Product_Backlog.xlsx";
      a.click();
      setExportToast(true);
      setTimeout(() => setExportToast(false), 2500);
    }
  };

  const summary = {
    stories: stories.length,
    criteria: stories.reduce((a, r) => a + (r.acceptance_criteria?.split("\n").length || 0), 0),
    edgeCases: stories.reduce((a, r) => a + (r.edge_cases?.split(";").length || 0), 0),
  };

  const previewRows = showFullTable ? stories : stories.slice(0, 5);
  const canGenerate = docFiles.length > 0;

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
              <span className="text-foreground">Product Backlog & User Stories</span>
            </nav>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
          <div className="glow-top">
            <div className="max-w-[760px] mx-auto px-6 lg:px-8">

              {/* INPUT */}
              {stage === "input" && (
                <>
                  <div className="mt-5 animate-fade-up flex justify-center">
                    <div className="inline-flex items-center gap-2 bg-secondary border border-border rounded-[20px] py-1.5 px-3.5">
                      <span className="w-1.5 h-1.5 rounded-sm bg-primary flex-shrink-0" />
                      <span className="font-mono-label text-xs text-foreground tracking-wide">Product Backlog & User Stories Generator</span>
                    </div>
                  </div>
                  <div className="text-center pt-6 pb-8 animate-fade-up">
                    <h1 className="text-[28px] font-semibold text-foreground tracking-tight">Upload your documents & screens</h1>
                    <p className="text-muted-foreground text-sm mt-3 max-w-[460px] mx-auto leading-relaxed">
                      Upload project files, UI screens, and describe your flow — we'll generate complete user stories automatically.
                    </p>
                  </div>

                  {/* Documents */}
                  <div className="rounded-2xl border border-border bg-card p-6 mb-4 animate-fade-up">
                    <div className="flex items-center gap-2.5 mb-1">
                      <FileText className="w-4 h-4 text-primary" />
                      <p className="text-[14px] font-semibold text-foreground">Project documents</p>
                      <span className="font-mono-label text-[10px] text-muted-foreground bg-secondary border border-border rounded px-2 py-0.5">REQUIRED</span>
                    </div>
                    <p className="text-[12px] text-muted-foreground mb-4">SOW, PRD, FRD or any relevant files</p>
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDraggingDoc(true); }}
                      onDragLeave={() => setIsDraggingDoc(false)}
                      onDrop={(e) => { e.preventDefault(); setIsDraggingDoc(false); addDocFiles(e.dataTransfer.files); }}
                      onClick={() => docInputRef.current?.click()}
                      className={`rounded-xl border-2 border-dashed cursor-pointer flex flex-col items-center justify-center gap-2 py-8 transition-all duration-200
                        ${isDraggingDoc ? "border-primary bg-[hsl(215_50%_5%)]" : "border-[hsl(0_0%_14%)] hover:border-[hsl(0_0%_24%)] bg-[hsl(0_0%_5%)]"}`}>
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <p className="text-[13px] text-foreground">Drop documents here or <span className="text-primary">browse</span></p>
                      <p className="font-mono-label text-[10px] text-muted-foreground tracking-wider">PDF · DOCX</p>
                      <input ref={docInputRef} type="file" multiple accept=".pdf,.docx" className="hidden"
                        onChange={(e) => e.target.files && addDocFiles(e.target.files)} />
                    </div>
                    {docFiles.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {docFiles.map((f) => (
                          <div key={f.id} className="flex items-center gap-3 rounded-lg border border-border bg-secondary px-3 py-2.5">
                            <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] text-foreground truncate">{f.name}</p>
                              <p className="font-mono-label text-[10px] text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</p>
                            </div>
                            <button onClick={() => setDocFiles(p => p.filter(x => x.id !== f.id))}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Screens (optional) */}
                  <div className="rounded-2xl border border-border bg-card p-6 mb-4 animate-fade-up">
                    <div className="flex items-center gap-2.5 mb-1">
                      <Image className="w-4 h-4 text-primary" />
                      <p className="text-[14px] font-semibold text-foreground">UI screens</p>
                      <span className="font-mono-label text-[10px] text-muted-foreground bg-secondary border border-border rounded px-2 py-0.5">OPTIONAL</span>
                    </div>
                    <p className="text-[12px] text-muted-foreground mb-4">AI uses screens to understand flows more accurately</p>
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDraggingScreen(true); }}
                      onDragLeave={() => setIsDraggingScreen(false)}
                      onDrop={(e) => { e.preventDefault(); setIsDraggingScreen(false); addScreenFiles(e.dataTransfer.files); }}
                      onClick={() => screenInputRef.current?.click()}
                      className={`rounded-xl border-2 border-dashed cursor-pointer flex flex-col items-center justify-center gap-2 py-7 transition-all duration-200
                        ${isDraggingScreen ? "border-primary bg-[hsl(215_50%_5%)]" : "border-[hsl(0_0%_14%)] hover:border-[hsl(0_0%_24%)] bg-[hsl(0_0%_5%)]"}`}>
                      <Image className="w-5 h-5 text-muted-foreground" />
                      <p className="text-[13px] text-foreground">Drop screens here or <span className="text-primary">browse</span></p>
                      <p className="font-mono-label text-[10px] text-muted-foreground tracking-wider">PNG · JPG</p>
                      <input ref={screenInputRef} type="file" multiple accept="image/*" className="hidden"
                        onChange={(e) => e.target.files && addScreenFiles(e.target.files)} />
                    </div>
                    {screenFiles.length > 0 && (
                      <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                        {screenFiles.map(f => (
                          <div key={f.id} className="relative group rounded-lg overflow-hidden border border-border aspect-video bg-secondary">
                            <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button onClick={() => setScreenFiles(p => p.filter(x => x.id !== f.id))}
                                className="p-1.5 rounded-full bg-background/80 text-foreground hover:bg-background transition-colors">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Flow description */}
                  <div className="rounded-2xl border border-border bg-card p-6 mb-6 animate-fade-up">
                    <div className="flex items-center gap-2.5 mb-1">
                      <MessageSquare className="w-4 h-4 text-primary" />
                      <p className="text-[14px] font-semibold text-foreground">Describe user flow</p>
                      <span className="font-mono-label text-[10px] text-muted-foreground bg-secondary border border-border rounded px-2 py-0.5">OPTIONAL</span>
                    </div>
                    <p className="text-[12px] text-muted-foreground mb-4">Helps AI connect logic between screens and documents</p>
                    <textarea value={flowDesc} onChange={e => setFlowDesc(e.target.value)} rows={4}
                      placeholder="Explain how users interact with your product…"
                      className="w-full bg-[hsl(0_0%_5%)] border border-border rounded-xl px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary transition-colors leading-relaxed" />
                  </div>

                  <div className="pb-16 animate-fade-up">
                    <button onClick={startProcessing} disabled={!canGenerate}
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200
                        ${canGenerate ? "bg-primary text-white hover:bg-primary/90 hover:-translate-y-0.5" : "bg-secondary text-muted-foreground border border-border cursor-not-allowed"}`}>
                      <MessageSquare className="w-4 h-4" />Generate Backlog<ArrowRight className="w-4 h-4" />
                    </button>
                    {!canGenerate && <p className="text-[12px] text-muted-foreground italic mt-3">Upload at least one document to continue</p>}
                  </div>
                </>
              )}

              {/* PROCESSING */}
              {stage === "processing" && (
                <div className="flex flex-col items-center justify-center min-h-[70vh] animate-fade-up">
                  <div className="text-center w-full max-w-[380px]">
                    <div className="relative w-16 h-16 mx-auto mb-6">
                      <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-ping" style={{ animationDuration: "2.5s" }} />
                      <div className="w-16 h-16 rounded-2xl bg-secondary border border-border flex items-center justify-center">
                        <MessageSquare className="w-7 h-7 text-primary" />
                      </div>
                    </div>
                    <h2 className="text-[22px] font-semibold text-foreground mb-2">{PROCESSING_MESSAGES[processingMsg]}</h2>
                    <p className="text-sm text-muted-foreground mb-8">Analyzing {docFiles.length} document{docFiles.length !== 1 ? "s" : ""}</p>
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
                  <button onClick={() => { setStage("input"); setDocFiles([]); setErrorMsg(""); }}
                    className="px-6 py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all">
                    Try again
                  </button>
                </div>
              )}

              {/* RESULT */}
              {stage === "result" && (
                <>
                  <div className="mt-5 animate-fade-up flex justify-center">
                    <div className="inline-flex items-center gap-2 bg-[hsl(142_50%_8%)] border border-[hsl(142_40%_18%)] rounded-[20px] py-1.5 px-3.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                      <span className="font-mono-label text-xs text-green-400 tracking-wide">Product backlog ready</span>
                    </div>
                  </div>
                  <div className="text-center pt-6 pb-6 animate-fade-up">
                    <h1 className="text-[28px] font-semibold text-foreground tracking-tight">Your product backlog is ready</h1>
                    <p className="text-muted-foreground text-sm mt-3 max-w-[440px] mx-auto leading-relaxed">
                      Generated structured user stories, acceptance criteria, and edge cases from your inputs.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-6 animate-fade-up">
                    {[
                      { label: "User Stories",        value: summary.stories,   color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
                      { label: "Acceptance Criteria", value: summary.criteria,  color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
                      { label: "Edge Cases",          value: summary.edgeCases, color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className={`rounded-xl border p-4 text-center ${color}`}>
                        <p className="text-[28px] font-bold text-foreground">{value}</p>
                        <p className={`font-mono-label text-[10px] tracking-wide mt-0.5 ${color.split(" ")[0]}`}>{label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-border bg-card overflow-hidden mb-6 animate-fade-up">
                    <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                      <p className="text-[13px] font-medium text-foreground">Backlog Preview</p>
                      <p className="font-mono-label text-[10px] text-muted-foreground tracking-wider">{stories.length} USER STORIES</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full" style={{ minWidth: "900px" }}>
                        <thead>
                          <tr className="border-b border-border">
                            {TABLE_HEADERS.map(h => (
                              <th key={h} className="px-3 py-3 text-left font-mono-label text-[10px] text-muted-foreground tracking-wider whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.map((row, i) => (
                            <tr key={i} className="border-b border-[hsl(0_0%_8%)] hover:bg-secondary/50 transition-colors align-top">
                              <td className="px-3 py-3 text-[12px] font-medium text-foreground whitespace-nowrap">{row.page_name}</td>
                              <td className="px-3 py-3 text-[11px] text-muted-foreground max-w-[180px]"><span className="line-clamp-3">{row.high_level_flow}</span></td>
                              <td className="px-3 py-3 text-[11px] text-muted-foreground max-w-[200px]"><span className="line-clamp-3">{row.user_story}</span></td>
                              <td className="px-3 py-3 text-[11px] text-muted-foreground max-w-[180px]"><span className="line-clamp-3 whitespace-pre-line">{row.acceptance_criteria}</span></td>
                              <td className="px-3 py-3 text-[11px] text-muted-foreground max-w-[140px]"><span className="line-clamp-2">{row.data_points}</span></td>
                              <td className="px-3 py-3 text-[11px] text-muted-foreground max-w-[160px]"><span className="line-clamp-2">{row.edge_cases}</span></td>
                              <td className="px-3 py-3 text-[11px] text-muted-foreground max-w-[140px]"><span className="line-clamp-2">{row.non_functional}</span></td>
                              <td className="px-3 py-3 text-[11px] text-muted-foreground font-mono-label whitespace-nowrap">{row.project_id}</td>
                              <td className="px-3 py-3 text-[11px] text-muted-foreground whitespace-nowrap">{row.project_name}</td>
                              <td className="px-3 py-3 text-[11px] text-muted-foreground font-mono-label whitespace-nowrap">{row.analyzed_at}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!showFullTable && stories.length > 5 && (
                      <button onClick={() => setShowFullTable(true)}
                        className="w-full py-3 text-[12px] text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1.5 border-t border-border">
                        <Eye className="w-3.5 h-3.5" />Show all {stories.length} user stories
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pb-16 animate-fade-up">
                    <button onClick={handleExport}
                      className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 hover:-translate-y-0.5 transition-all duration-200">
                      <Download className="w-4 h-4" />Download Excel (.xlsx)
                    </button>
                    <button onClick={() => { setStage("input"); setDocFiles([]); setScreenFiles([]); setFlowDesc(""); setShowFullTable(false); setStories([]); }}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-muted-foreground border border-border hover:text-foreground transition-all duration-200">
                      <RefreshCw className="w-4 h-4" />Start over
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
          <span className="text-[13px] text-foreground">Product backlog downloaded</span>
        </div>
      )}
    </div>
  );
};

export default UserStories;
