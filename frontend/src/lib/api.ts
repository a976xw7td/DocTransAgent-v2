/**
 * API client — centralized HTTP layer for backend communication.
 * Modular design: each domain has its own sub-module exported here.
 */

// Use relative URL — Next.js rewrites proxy /api/* to the Python backend
const BASE_URL = "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    let message = `Request failed: ${res.status}`;
    const detail = body.detail;
    if (typeof detail === "string") message = detail;
    else if (Array.isArray(detail)) message = detail.map((d: any) => d.msg || JSON.stringify(d)).join("; ");
    throw new Error(message);
  }
  return res.json();
}

// ── Documents ──────────────────────────────────────────
export const documentsApi = {
  upload: async (file: File, sourceLang = "auto", targetLang = "en") => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(
      `${BASE_URL}/api/documents/upload?source_lang=${sourceLang}&target_lang=${targetLang}`,
      { method: "POST", body: form }
    );
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },
  list: () => request<any[]>("/api/documents"),
  get: (id: string) => request<any>(`/api/documents/${id}`),
  delete: (id: string) => request<any>(`/api/documents/${id}`, { method: "DELETE" }),
  clearAll: () => request<any>("/api/documents/clear", { method: "DELETE" }),
};

// ── Translation ────────────────────────────────────────
export const translationApi = {
  start: (docId: string, targetLang?: string) => {
    const qs = targetLang ? `?target_lang=${encodeURIComponent(targetLang)}` : "";
    return request<any>(`/api/translate/${docId}${qs}`, { method: "POST" });
  },
  progress: (docId: string) => request<any>(`/api/translate/${docId}/progress`),
  batch: (targetLang: string) =>
    request<any>("/api/translate/batch", {
      method: "POST",
      body: JSON.stringify({ target_lang: targetLang }),
    }),
};

// ── Knowledge Base ─────────────────────────────────────
export const kbApi = {
  index: (docId: string) =>
    request<any>(`/api/kb/index/${docId}`, { method: "POST" }),
  batchIndex: () =>
    request<any>("/api/kb/index/batch", { method: "POST" }),
  search: (q: string, topK = 10) =>
    request<any>(`/api/kb/search?q=${encodeURIComponent(q)}&top_k=${topK}`),
  stats: () => request<any>("/api/kb/stats"),
  deindex: (docId: string) =>
    request<any>(`/api/kb/index/${docId}`, { method: "DELETE" }),
};

// ── Q&A ────────────────────────────────────────────────
export const qaApi = {
  ask: (question: string, sessionId = "default", topK = 5) =>
    request<any>("/api/qa/ask", {
      method: "POST",
      body: JSON.stringify({ question, session_id: sessionId, top_k: topK }),
    }),
  askStream: (question: string, sessionId = "default", topK = 5) => {
    return fetch(`${BASE_URL}/api/qa/ask/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, session_id: sessionId, top_k: topK }),
    });
  },
  clearSession: (sessionId: string) =>
    request<any>(`/api/qa/session/${sessionId}`, { method: "DELETE" }),
};

// ── Glossary ───────────────────────────────────────────
export const glossaryApi = {
  list: (project = "default") => request<any[]>(`/api/glossary?project=${encodeURIComponent(project)}`),
  create: (data: { source_term: string; target_term: string; category?: string; project?: string }) =>
    request<any>("/api/glossary", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<any>(`/api/glossary/${id}`, { method: "DELETE" }),
  autoExtract: (text: string) =>
    request<any>("/api/glossary/auto-extract", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
};

// ── Dashboard ──────────────────────────────────────────
export const dashboardApi = {
  stats: () => request<any>("/api/dashboard/stats"),
};

// ── Obsidian / Sources ──────────────────────────────────
export const obsidianApi = {
  importVault: (vaultPath: string, sourceLang = "zh", targetLang = "en") =>
    request<any>("/api/sources/obsidian/import", {
      method: "POST",
      body: JSON.stringify({ vault_path: vaultPath, source_lang: sourceLang, target_lang: targetLang }),
    }),
  uploadFiles: async (files: FileList | File[], sourceLang = "zh", targetLang = "en") => {
    const form = new FormData();
    const fileArray = Array.from(files);
    fileArray.forEach((f) => form.append("files", f));
    const res = await fetch(
      `${BASE_URL}/api/sources/obsidian/upload?source_lang=${sourceLang}&target_lang=${targetLang}`,
      { method: "POST", body: form }
    );
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },
  listImports: () => request<any>("/api/sources/imports"),
  getImport: (importId: string) => request<any>(`/api/sources/imports/${importId}`),
  clearImports: () => request<any>("/api/sources/imports", { method: "DELETE" }),
  deleteImport: (importId: string) =>
    request<any>(`/api/sources/imports/${importId}`, { method: "DELETE" }),
  promoteDocument: (docId: string) =>
    request<any>(`/api/sources/documents/${docId}`, { method: "POST" }),
};

// ── Graph ───────────────────────────────────────────────
export const graphApi = {
  stats: () => request<any>("/api/graph/stats"),
  nodes: (params?: { node_type?: string; q?: string; offset?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.node_type) sp.set("node_type", params.node_type);
    if (params?.q) sp.set("q", params.q);
    if (params?.offset != null) sp.set("offset", String(params.offset));
    if (params?.limit != null) sp.set("limit", String(params.limit));
    return request<any>(`/api/graph/nodes?${sp.toString()}`);
  },
  node: (nodeId: string) => request<any>(`/api/graph/nodes/${nodeId}`),
  neighborhood: (nodeId: string) => request<any>(`/api/graph/neighborhood/${nodeId}`),
  all: (limit = 500) => request<any>(`/api/graph/all?limit=${limit}`),
  translateNode: (nodeId: string, targetLang = "en") =>
    request<any>(`/api/graph/nodes/${nodeId}/translate`, {
      method: "POST",
      body: JSON.stringify({ target_lang: targetLang }),
    }),
  clear: () => request<any>("/api/graph/clear", { method: "DELETE" }),
};

// ── Export ─────────────────────────────────────────────
export const exportApi = {
  bilingual: (docId: string, format = "md") =>
    fetch(`${BASE_URL}/api/export/${docId}/bilingual?format=${format}`).then((r) => r.blob()),
  pdf: (docId: string) =>
    fetch(`${BASE_URL}/api/export/${docId}/pdf`).then((r) => r.blob()),
  docx: (docId: string) =>
    fetch(`${BASE_URL}/api/export/${docId}/docx`).then((r) => r.blob()),
};
