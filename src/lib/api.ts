const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ── Upload ────────────────────────────────────────────────────────────────────

export async function uploadFile(file: File): Promise<{
  session_id: string;
  document_id: string;
  filename: string;
  extracted_length: number;
}> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE_URL}/api/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export const fetchRecentProjects = () =>
  request<Session[]>("/api/sessions?limit=10");

export const getSession = (sessionId: string) =>
  request<Session>(`/api/sessions/${sessionId}`);

export async function createSession(module_type: string): Promise<Session> {
  return request("/api/sessions", {
    method: "POST",
    body: JSON.stringify({ module_type }),
  });
}

// ── Document Generation (SOW / PRD / FRD) ────────────────────────────────────

export async function generateDocument(params: {
  doc_type: "sow" | "prd" | "frd";
  session_id: string;
  answers: Record<string, string>;
  export_format: "docx" | "pdf";
  template: "invuric" | "client";
}): Promise<{ download_url: string; session_id: string }> {
  const { doc_type, ...body } = params;
  return request(`/api/generate/${doc_type}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── RAID ──────────────────────────────────────────────────────────────────────

export async function generateRaid(sessionId: string): Promise<{
  download_url: string;
  session_id: string;
  data: RaidData;
}> {
  return request("/api/generate/raid", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  });
}

// ── WBS ───────────────────────────────────────────────────────────────────────

export async function generateWbs(sessionId: string, audience: string[]): Promise<{
  download_url: string;
  session_id: string;
  data: WbsData;
}> {
  return request("/api/generate/wbs", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, audience }),
  });
}

// ── Backlog / User Stories ────────────────────────────────────────────────────

export async function generateBacklog(params: {
  session_id: string;
  project_name: string;
  project_id: string;
}): Promise<{ download_url: string; session_id: string; data: BacklogData }> {
  return request("/api/generate/backlog", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ── Process Flow Diagram ──────────────────────────────────────────────────────

export async function generatePfd(params: {
  session_id: string;
  flow_type: string;
  style: string;
}): Promise<{ mermaid_code: string; session_id: string }> {
  return request("/api/generate/pfd", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ── Placeholder stubs (used by existing components, not yet wired) ────────────

export const openModule = (moduleId: string) => {
  console.log("[API] openModule:", moduleId);
};

export const fetchProjects = (filter: string) =>
  request<Session[]>(`/api/sessions?limit=20`);

export const downloadProject = (projectId: string) =>
  console.log("[API] downloadProject:", projectId);

export const openProject = (projectId: string) =>
  console.log("[API] openProject:", projectId);

export const selectDocumentType = (type: string) =>
  console.log("[API] selectDocumentType:", type);

export const continueToNextStep = (type: string) =>
  console.log("[API] continueToNextStep:", type);

export const openDocumentGuide = () =>
  console.log("[API] openDocumentGuide");

export const navigateBack = () =>
  console.log("[API] navigateBack");

export const searchProjects = (query: string) =>
  console.log("[API] searchProjects:", query);

export const openProjectDetail = (projectId: string) =>
  console.log("[API] openProjectDetail:", projectId);

export const closeProjectDetail = () =>
  console.log("[API] closeProjectDetail");

export async function downloadDocument(projectId: string, outputType: string): Promise<void> {
  const result = await request<{ download_url: string }>(
    `/api/sessions/${projectId}/outputs/${outputType}/download`
  );
  const a = document.createElement("a");
  a.href = result.download_url;
  a.download = `${outputType}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export const previewDocument = (projectId: string, docType: string) =>
  console.log("[API] previewDocument:", projectId, docType);

export const exportAllDocuments = (projectId: string) =>
  console.log("[API] exportAllDocuments:", projectId);

export const continueProject = (projectId: string) =>
  console.log("[API] continueProject:", projectId);

export const renameProject = (projectId: string) =>
  console.log("[API] renameProject:", projectId);

export const duplicateProject = (projectId: string) =>
  console.log("[API] duplicateProject:", projectId);

export const deleteProject = (projectId: string) =>
  console.log("[API] deleteProject:", projectId);

export const startFullPipeline = () =>
  console.log("[API] startFullPipeline");

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  module_type: string;
  status: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface RaidData {
  risks: RaidItem[];
  assumptions: RaidItem[];
  issues: RaidItem[];
  dependencies: RaidItem[];
}

export interface RaidItem {
  id: string;
  title: string;
  description: string;
  probability?: string;
  impact?: string;
  mitigation?: string;
  severity?: string;
  resolution?: string;
  type?: string;
  due_date?: string;
  owner?: string;
}

export interface WbsData {
  project_name: string;
  total_phases: number;
  total_tasks: number;
  total_subtasks: number;
  phases: WbsPhase[];
}

export interface WbsPhase {
  id: string;
  name: string;
  duration: string;
  tasks: WbsTask[];
}

export interface WbsTask {
  id: string;
  name: string;
  duration: string;
  assigned_to: string[];
  subtasks: WbsSubtask[];
}

export interface WbsSubtask {
  id: string;
  name: string;
  duration: string;
  assigned_to: string[];
}

export interface BacklogData {
  stories: UserStory[];
}

export interface UserStory {
  page_name: string;
  high_level_flow: string;
  user_story: string;
  acceptance_criteria: string;
  data_points: string;
  edge_cases: string;
  non_functional: string;
  project_id: string;
  project_name: string;
  analyzed_at: string;
}
