import { supabase } from "@/lib/supabaseClient";

const CONFIGURED_BASE_URL = import.meta.env.VITE_API_URL ?? "";
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
const UPLOAD_REQUEST_TIMEOUT_MS = 120000;
const GENERATION_REQUEST_TIMEOUT_MS = 600000;
const GENERATION_POLL_INTERVAL_MS = 1500;
const DEFAULT_GET_RETRIES = 2;

type ApiErrorPayload = {
  detail?: string;
  request_id?: string;
};

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function getApiBaseUrls(): string[] {
  const urls = new Set<string>([normalizeBaseUrl(CONFIGURED_BASE_URL)]);

  try {
    const configured = new URL(CONFIGURED_BASE_URL);
    if (configured.hostname === "localhost") {
      configured.hostname = "127.0.0.1";
      urls.add(normalizeBaseUrl(configured.toString()));
    } else if (configured.hostname === "127.0.0.1") {
      configured.hostname = "localhost";
      urls.add(normalizeBaseUrl(configured.toString()));
    }

    // Local dev safety net: previous runs can leave localhost/IPv6 listeners
    // alive, and Windows may prefer one over the other.
    if (["localhost", "127.0.0.1"].includes(new URL(CONFIGURED_BASE_URL).hostname)) {
      urls.add("http://127.0.0.1:8010");
      urls.add("http://localhost:8010");
    }
  } catch {
    // Keep the configured value; request handling will surface a useful error.
  }

  return Array.from(urls);
}

function createTimeoutSignal(timeoutMs: number, externalSignal?: AbortSignal) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  const abortFromExternalSignal = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", abortFromExternalSignal, { once: true });
    }
  }

  const cleanup = () => {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
  };

  return { signal: controller.signal, cleanup };
}

function isRetriableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function isNetworkFetchError(error: unknown): boolean {
  return (
    error instanceof TypeError
    && (error.message.toLowerCase().includes("failed to fetch") || error.message.toLowerCase().includes("networkerror"))
  );
}

function formatApiError(payload: ApiErrorPayload, fallback: string): string {
  const detail = payload.detail || fallback;
  return payload.request_id ? `${detail} (Ref: ${payload.request_id})` : detail;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getRequiredStringField(
  result: Record<string, unknown> | null | undefined,
  field: string,
  errorMessage: string,
): string {
  const value = result?.[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(errorMessage);
  }
  return value;
}

async function request<T>(path: string, options?: RequestInit, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS): Promise<T> {
  const method = (options?.method || "GET").toUpperCase();
  const retries = method === "GET" ? DEFAULT_GET_RETRIES : 0;
  const baseUrls = getApiBaseUrls();
  const triedUrls: string[] = [];
  const authHeaders = await getAuthHeaders();
  try {
    for (const baseUrl of baseUrls) {
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        const requestUrl = `${baseUrl}${path}`;
        triedUrls.push(requestUrl);
        const { signal, cleanup } = createTimeoutSignal(timeoutMs, options?.signal);
        try {
          const res = await fetch(requestUrl, {
            headers: { "Content-Type": "application/json", ...authHeaders, ...options?.headers },
            cache: "no-store",
            ...options,
            signal,
          });

          if (!res.ok) {
            if (res.status === 401) {
              await supabase.auth.signOut();
            }
            const err = await res.json().catch(() => ({ detail: res.statusText })) as ApiErrorPayload;
            if (attempt < retries && isRetriableStatus(res.status)) {
              const retryAfter = Number(res.headers.get("Retry-After") || "");
              const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
                ? retryAfter * 1000
                : 400 * 2 ** attempt;
              await delay(waitMs);
              continue;
            }
            throw new Error(formatApiError(err, `Request failed: ${res.status}`));
          }

          return res.json();
        } catch (error) {
          const isAbort = error instanceof DOMException && error.name === "AbortError";
          const isFinalAttempt = attempt === retries;
          if (isAbort) {
            throw new Error("The request took too long. Please try again.");
          }
          if (isNetworkFetchError(error) && isFinalAttempt) {
            break;
          }
          if (isFinalAttempt) {
            throw error;
          }
          await delay(400 * 2 ** attempt);
        } finally {
          cleanup();
        }
      }
    }

    throw new Error(`Cannot reach the server. Tried: ${Array.from(new Set(triedUrls)).join(", ")}`);
  } catch (error) {
    if (isNetworkFetchError(error)) {
      throw new Error(`Cannot reach the server. Tried: ${Array.from(new Set(triedUrls)).join(", ")}`);
    }
    throw error instanceof Error ? error : new Error("Request failed. Please try again.");
  }
}

async function uploadWithBaseUrl(baseUrl: string, file: File, sessionId?: string) {
  const form = new FormData();
  form.append("file", file);
  if (sessionId) {
    form.append("session_id", sessionId);
  }

  const { signal, cleanup } = createTimeoutSignal(UPLOAD_REQUEST_TIMEOUT_MS);
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${baseUrl}/api/upload`, {
      method: "POST",
      body: form,
      cache: "no-store",
      headers: authHeaders,
      signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText })) as ApiErrorPayload;
      throw new Error(formatApiError(err, "Upload failed"));
    }
    return res.json();
  } finally {
    cleanup();
  }
}

async function uploadWithFallback(file: File, sessionId?: string) {
  const triedUrls: string[] = [];
  for (const baseUrl of getApiBaseUrls()) {
    triedUrls.push(`${baseUrl}/api/upload`);
    try {
      return await uploadWithBaseUrl(baseUrl, file, sessionId);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("The upload took too long. Please try again.");
      }
      if (!isNetworkFetchError(error)) {
          throw error;
      }
    }
  }

  throw new Error(`Cannot reach the upload server. Tried: ${triedUrls.join(", ")}`);
}

export async function uploadFile(file: File, sessionId?: string): Promise<{
  session_id: string;
  document_id: string;
  filename: string;
  file_type: string;
  storage_path: string;
  extracted_length: number;
}> {
  return uploadWithFallback(file, sessionId);
}

export const fetchRecentProjects = () =>
  request<Session[]>("/api/sessions?limit=10");

export const getSession = (sessionId: string) =>
  request<SessionDetail>(`/api/sessions/${sessionId}`);

export const getSystemCapabilities = () =>
  request<SystemCapabilities>("/api/system/capabilities");

export const getReadiness = () =>
  request<ReadinessResponse>("/ready");

export async function createSession(module_type: string, metadata?: Record<string, unknown>): Promise<Session> {
  return request("/api/sessions", {
    method: "POST",
    body: JSON.stringify({ module_type, metadata: metadata ?? {} }),
  });
}

export async function updateSessionMetadata(sessionId: string, metadata: Record<string, unknown>): Promise<Session> {
  return request(`/api/sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify({ metadata }),
  });
}

export async function generateDocument(params: {
  doc_type: "sow" | "prd" | "frd";
  session_id: string;
  answers: Record<string, string>;
  export_format: "docx" | "pdf";
  template: "invuric" | "client";
  onProgress?: (status: GenerationStatusResponse) => void;
}): Promise<{ download_url: string; session_id: string }> {
  const { doc_type, onProgress, ...body } = params;
  return request<{ session_id: string; status: string; job_id?: string }>(`/api/generate/${doc_type}`, {
    method: "POST",
    body: JSON.stringify(body),
  }).then(async (response) => {
    const finalStatus = await waitForGeneration(params.session_id, doc_type, response.job_id, onProgress);
    const downloadUrl = getRequiredStringField(
      finalStatus.result,
      "download_url",
      "The generated document is ready, but no download link was returned.",
    );
    return { download_url: downloadUrl, session_id: params.session_id };
  });
}

export async function generateRaid(sessionId: string, onProgress?: (status: GenerationStatusResponse) => void): Promise<{
  download_url: string;
  session_id: string;
  data: RaidData;
}> {
  return request<{ session_id: string; status: string; job_id?: string }>("/api/generate/raid", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  }).then(async (response) => {
    const finalStatus = await waitForGeneration(sessionId, "raid", response.job_id, onProgress);
    if (!isObject(finalStatus.result) || !("data" in finalStatus.result)) {
      throw new Error("The RAID register finished generating, but the result payload was incomplete.");
    }
    return {
      download_url: getRequiredStringField(
        finalStatus.result,
        "download_url",
        "The RAID register finished generating, but no download link was returned.",
      ),
      session_id: sessionId,
      data: finalStatus.result.data as RaidData,
    };
  });
}

export async function generateWbs(
  sessionId: string,
  audience: string[],
  onProgress?: (status: GenerationStatusResponse) => void,
): Promise<{
  download_url: string;
  session_id: string;
  data: WbsData;
}> {
  return request<{ session_id: string; status: string; job_id?: string }>("/api/generate/wbs", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, audience }),
  }).then(async (response) => {
    const finalStatus = await waitForGeneration(sessionId, "wbs", response.job_id, onProgress);
    if (!isObject(finalStatus.result) || !("data" in finalStatus.result)) {
      throw new Error("The WBS finished generating, but the result payload was incomplete.");
    }
    return {
      download_url: getRequiredStringField(
        finalStatus.result,
        "download_url",
        "The WBS finished generating, but no download link was returned.",
      ),
      session_id: sessionId,
      data: finalStatus.result.data as WbsData,
    };
  });
}

export async function generateBacklog(params: {
  session_id: string;
  project_name: string;
  project_id: string;
  supplemental_context?: string;
  onProgress?: (status: GenerationStatusResponse) => void;
}): Promise<{ download_url: string; session_id: string; data: BacklogData }> {
  const { onProgress, ...body } = params;
  return request<{ session_id: string; status: string; job_id?: string }>("/api/generate/backlog", {
    method: "POST",
    body: JSON.stringify(body),
  }).then(async (response) => {
    const finalStatus = await waitForGeneration(params.session_id, "backlog", response.job_id, onProgress);
    if (!isObject(finalStatus.result) || !("data" in finalStatus.result)) {
      throw new Error("The product backlog finished generating, but the result payload was incomplete.");
    }
    return {
      download_url: getRequiredStringField(
        finalStatus.result,
        "download_url",
        "The product backlog finished generating, but no download link was returned.",
      ),
      session_id: params.session_id,
      data: finalStatus.result.data as BacklogData,
    };
  });
}

export async function generatePfd(params: {
  session_id: string;
  flow_type: string;
  style: string;
  onProgress?: (status: GenerationStatusResponse) => void;
}): Promise<{ mermaid_code: string; session_id: string }> {
  const { onProgress, ...body } = params;
  return request<{ session_id: string; status: string; job_id?: string }>("/api/generate/pfd", {
    method: "POST",
    body: JSON.stringify(body),
  }).then(async (response) => {
    const finalStatus = await waitForGeneration(params.session_id, "pfd", response.job_id, onProgress);
    const mermaidCode = getRequiredStringField(
      finalStatus.result,
      "mermaid_code",
      "The process flow diagram finished generating, but no Mermaid code was returned.",
    );
    return { mermaid_code: mermaidCode, session_id: params.session_id };
  });
}

export const openModule = (moduleId: string) => {
  console.log("[API] openModule:", moduleId);
};

export const fetchProjects = (_filter: string) =>
  request<Session[]>("/api/sessions?limit=20");

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

function getOutputExtension(outputType: string): string {
  if (outputType.endsWith("_pdf")) return "pdf";
  if (outputType.endsWith("_xlsx")) return "xlsx";
  if (outputType.endsWith("_mermaid")) return "mmd";
  return "docx";
}

function getOutputPriority(outputType: string): number {
  if (outputType.endsWith("_pdf")) return 0;
  if (outputType.endsWith("_docx")) return 1;
  if (outputType.endsWith("_xlsx")) return 2;
  if (outputType.endsWith("_mermaid")) return 3;
  return 4;
}

function getModuleOutputPrefix(moduleType?: string): string | null {
  if (!moduleType) return null;
  if (moduleType === "backlog") return "backlog_";
  if (moduleType === "pfd") return "pfd_";
  if (["sow", "prd", "frd", "raid", "wbs"].includes(moduleType)) {
    return `${moduleType}_`;
  }
  return null;
}

function selectBestOutput(session: SessionDetail, moduleType?: string): OutputRecord | null {
  const outputs = [...(session.outputs ?? [])];
  if (outputs.length === 0) return null;

  const prefix = getModuleOutputPrefix(moduleType ?? session.module_type);
  const candidates = prefix
    ? outputs.filter((output) => output.output_type.startsWith(prefix))
    : outputs;
  const source = candidates.length > 0 ? candidates : outputs;

  source.sort((left, right) => {
    const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;
    const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
    if (rightTime !== leftTime) return rightTime - leftTime;
    return getOutputPriority(left.output_type) - getOutputPriority(right.output_type);
  });

  return source[0] ?? null;
}

async function getOutputDownloadUrl(projectId: string, outputType: string): Promise<string> {
  const result = await request<{ download_url: string }>(
    `/api/sessions/${projectId}/outputs/${outputType}/download`
  );
  return result.download_url;
}

// PFD never writes a file to storage — its Mermaid source lives directly on the
// outputs row, so it has no signed URL to fetch. Read it straight from the session
// instead of hitting the storage-backed download endpoint (which 404s for it).
async function getMermaidSource(projectId: string): Promise<string> {
  const session = await getSession(projectId);
  const output = (session.outputs ?? []).find((o) => o.output_type === "pfd_mermaid");
  if (!output?.mermaid_code) {
    throw new Error("This diagram's source could not be found. Try regenerating it.");
  }
  return output.mermaid_code;
}

function downloadTextAsFile(text: string, filename: string): void {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function resolveOutput(projectId: string, outputType?: string, moduleType?: string): Promise<OutputRecord> {
  if (outputType) {
    return { output_type: outputType, storage_path: "" };
  }

  const session = await getSession(projectId);
  const resolved = selectBestOutput(session, moduleType);
  if (!resolved) {
    throw new Error("No generated output is available for this project yet.");
  }
  return resolved;
}

export async function downloadDocument(
  projectId: string,
  outputType?: string,
  moduleType?: string,
): Promise<void> {
  const resolved = await resolveOutput(projectId, outputType, moduleType);
  if (resolved.output_type === "pfd_mermaid") {
    const code = await getMermaidSource(projectId);
    downloadTextAsFile(code, "process-flow-diagram.mmd");
    return;
  }
  const downloadUrl = await getOutputDownloadUrl(projectId, resolved.output_type);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = `${resolved.output_type}.${getOutputExtension(resolved.output_type)}`;
  // Supabase signed URLs are cross-origin — the `download` attr is ignored by
  // browsers for cross-origin URLs unless target="_blank" is set.
  a.target = "_blank";
  a.rel = "noreferrer noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function previewDocument(
  projectId: string,
  outputType?: string,
  moduleType?: string,
): Promise<void> {
  const resolved = await resolveOutput(projectId, outputType, moduleType);
  if (resolved.output_type === "pfd_mermaid") {
    const code = await getMermaidSource(projectId);
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noreferrer,noopener");
    // Give the new tab time to load the blob before revoking it.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return;
  }
  const downloadUrl = await getOutputDownloadUrl(projectId, resolved.output_type);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.target = "_blank";
  a.rel = "noreferrer noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export const exportAllDocuments = (projectId: string) =>
  console.log("[API] exportAllDocuments:", projectId);

export const continueProject = (projectId: string) =>
  console.log("[API] continueProject:", projectId);

export const renameProject = (projectId: string) =>
  console.log("[API] renameProject:", projectId);

export const duplicateProject = (projectId: string) =>
  console.log("[API] duplicateProject:", projectId);

export const deleteProject = (projectId: string) =>
  request(`/api/sessions/${projectId}`, { method: "DELETE" });

export const startFullPipeline = () =>
  console.log("[API] startFullPipeline");

export interface Session {
  id: string;
  module_type: string;
  status: string;
  created_at: string;
  project_name?: string;
  metadata: Record<string, unknown>;
}

export interface SessionDetail extends Session {
  documents?: DocumentRecord[];
  outputs?: OutputRecord[];
}

export interface DocumentRecord {
  id?: string;
  filename?: string;
  file_name?: string;
  storage_path: string;
  created_at?: string;
}

export interface OutputRecord {
  id?: string;
  output_type: string;
  storage_path: string;
  created_at?: string;
  // Only set for output_type "pfd_mermaid" — PFD never writes a file to storage,
  // it stores the raw diagram source directly in this column instead.
  mermaid_code?: string;
}

export interface SystemCapabilities {
  pdf_export_available: boolean;
  pdf_export_reason?: string | null;
  client_template_available: boolean;
  client_template_reason?: string | null;
  supported_templates: string[];
}

export interface ReadinessResponse {
  status: "ready" | "degraded";
  checks: {
    anthropic_api_key: boolean;
    supabase_url: boolean;
    supabase_service_role_key: boolean;
    database_connectivity: boolean;
  };
}

export interface GenerationState {
  job_id?: string | null;
  module_type?: string | null;
  status?: string | null;
  stage?: string | null;
  message?: string | null;
  progress?: number | null;
  started_at?: string | null;
  finished_at?: string | null;
  error?: string | null;
  result?: Record<string, unknown> | null;
}

export interface GenerationStatusResponse {
  session_id: string;
  status: string;
  module_type?: string | null;
  generation?: GenerationState | null;
  result?: Record<string, unknown> | null;
}

export const __testing = {
  getOutputExtension,
  getOutputPriority,
  getModuleOutputPrefix,
  selectBestOutput,
};

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

async function getGenerationStatus(sessionId: string, moduleType?: string): Promise<GenerationStatusResponse> {
  const suffix = moduleType ? `?module_type=${encodeURIComponent(moduleType)}` : "";
  return request<GenerationStatusResponse>(`/api/sessions/${sessionId}/generation${suffix}`);
}

async function waitForGeneration(
  sessionId: string,
  moduleType: string,
  expectedJobId?: string,
  onProgress?: (status: GenerationStatusResponse) => void,
): Promise<GenerationStatusResponse> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < GENERATION_REQUEST_TIMEOUT_MS) {
    const status = await getGenerationStatus(sessionId, moduleType);
    onProgress?.(status);

    const generationStatus = status.generation?.status?.toLowerCase();
    const generationJobId = status.generation?.job_id ?? undefined;
    const jobMatches = !expectedJobId || generationJobId === expectedJobId;

    if (jobMatches && generationStatus === "completed") {
      return status;
    }
    if (jobMatches && generationStatus === "failed") {
      throw new Error(
        status.generation?.error
        || status.generation?.message
        || "Generation failed. Please try again.",
      );
    }

    await delay(GENERATION_POLL_INTERVAL_MS);
  }

  throw new Error("Generation is taking too long. Please check back in a moment.");
}
