"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { documentsApi, translationApi, kbApi } from "@/lib/api";
import { StatusBadge } from "@/components/Badges";
import { useTranslationProgress } from "@/hooks/useTranslationProgress";

const LANG_OPTIONS: { code: string; labelKey: string }[] = [
  { code: "en", labelKey: "lang_en" },
  { code: "zh", labelKey: "lang_zh" },
  { code: "ja", labelKey: "lang_ja" },
  { code: "ko", labelKey: "lang_ko" },
  { code: "fr", labelKey: "lang_fr" },
  { code: "de", labelKey: "lang_de" },
  { code: "es", labelKey: "lang_es" },
  { code: "pt", labelKey: "lang_pt" },
  { code: "ar", labelKey: "lang_ar" },
  { code: "ru", labelKey: "lang_ru" },
];

export default function UploadPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [docs, setDocs] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [targetLangs, setTargetLangs] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const { progress, startPolling } = useTranslationProgress(activeDocId);

  const loadDocs = useCallback(async () => {
    try {
      setDocs(await documentsApi.list());
    } catch {}
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      try {
        await documentsApi.upload(files[i]);
      } catch (err) {
        alert(`${t("common.error")} (${files[i].name}): ` + (err instanceof Error ? err.message : t("common.error")));
      }
    }
    await loadDocs();
    setUploading(false);
    e.target.value = "";
  };

  const pollDocStatus = (docId: string, expectedStatus: string) => {
    const interval = setInterval(async () => {
      try {
        const doc = await documentsApi.get(docId);
        if (doc.status === expectedStatus || doc.status === "error") {
          clearInterval(interval);
          setTranslatingIds((cur) => { const n = new Set(cur); n.delete(docId); return n; });
          if (doc.status === "translated") {
            router.push(`/translate/${docId}`);
          } else {
            loadDocs();
          }
        }
      } catch {
        clearInterval(interval);
        setTranslatingIds((cur) => { const n = new Set(cur); n.delete(docId); return n; });
      }
    }, 1000);
    setTimeout(() => {
      clearInterval(interval);
      setTranslatingIds((cur) => { const n = new Set(cur); n.delete(docId); return n; });
      loadDocs();
    }, 30000);
  };

  const handleTranslate = async (docId: string) => {
    if (translatingIds.has(docId)) return;
    setTranslatingIds((cur) => new Set(cur).add(docId));
    setActiveDocId(docId);
    const targetLang = targetLangs[docId];
    try {
      await translationApi.start(docId, targetLang);
      startPolling(docId);
      loadDocs();
      pollDocStatus(docId, "translated");
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.error");
      if (message.includes("status translating")) {
        startPolling(docId);
        pollDocStatus(docId, "translated");
        return;
      }
      setTranslatingIds((cur) => { const n = new Set(cur); n.delete(docId); return n; });
      alert(t("common.translate") + ": " + message);
    }
  };

  const handleIndex = async (docId: string) => {
    try {
      await kbApi.index(docId);
      pollDocStatus(docId, "indexed");
    } catch (err) {
      alert(t("common.error") + ": " + (err instanceof Error ? err.message : t("common.error")));
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm(t("upload.confirm_delete"))) return;
    try {
      await documentsApi.delete(docId);
      loadDocs();
    } catch (err) {
      alert(t("common.error") + ": " + (err instanceof Error ? err.message : t("common.error")));
    }
  };

  const [clearingAll, setClearingAll] = useState(false);
  const [batchLang, setBatchLang] = useState("en");
  const [batchTranslating, setBatchTranslating] = useState(false);
  const [batchIndexing, setBatchIndexing] = useState(false);

  const handleBatchTranslate = async () => {
    const eligible = docs.filter((d) => ["uploaded", "parsed"].includes(d.status));
    if (eligible.length === 0) { alert(t("upload.no_eligible")); return; }
    if (!window.confirm(t("upload.confirm_batch", { count: eligible.length, lang: t(`upload.${LANG_OPTIONS.find(l => l.code === batchLang)?.labelKey ?? "lang_en"}`) }))) return;
    setBatchTranslating(true);
    try {
      const res = await translationApi.batch(batchLang);
      (res.doc_ids ?? []).forEach((id: string) => {
        setTranslatingIds((cur) => new Set(cur).add(id));
        setActiveDocId(id);
        startPolling(id);
        pollDocStatus(id, "translated");
      });
      await loadDocs();
    } catch (err) {
      alert(t("common.error") + ": " + (err instanceof Error ? err.message : t("common.error")));
    } finally {
      setBatchTranslating(false);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm(t("upload.confirm_clear"))) return;
    setClearingAll(true);
    try {
      await documentsApi.clearAll();
      setDocs([]);
    } catch {} finally { setClearingAll(false); }
  };

  const handleBatchIndex = async () => {
    const eligible = docs.filter((d) => d.status === "translated");
    if (eligible.length === 0) { alert(t("upload.no_translated")); return; }
    if (!window.confirm(t("upload.confirm_batch_index", { count: eligible.length }))) return;
    setBatchIndexing(true);
    try {
      await kbApi.batchIndex();
      await loadDocs();
    } catch (err) {
      alert(t("common.error") + ": " + (err instanceof Error ? err.message : t("common.error")));
    } finally {
      setBatchIndexing(false);
    }
  };

  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [previewSections, setPreviewSections] = useState<any[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handleViewSource = async (docId: string) => {
    setPreviewLoading(true);
    setPreviewSections(null);
    try {
      const doc = await documentsApi.get(docId);
      setPreviewDoc(doc);
      setPreviewSections(doc.sections || []);
    } catch {} finally { setPreviewLoading(false); }
  };

  const paged = docs.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(docs.length / pageSize);

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>
            {t("upload.page_title")}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {t("upload.page_subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {docs.some((d) => ["uploaded", "parsed"].includes(d.status)) && (
            <div className="flex items-center gap-1.5">
              <select
                value={batchLang}
                onChange={(e) => setBatchLang(e.target.value)}
                disabled={batchTranslating}
                className="text-xs rounded-md px-2 py-1.5 border"
                style={{
                  background: "var(--bg-input)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                  fontFamily: "var(--font-sans)",
                  height: 32,
                }}
              >
                {LANG_OPTIONS.map((l) => (
                  <option key={l.code} value={l.code}>{t(`upload.${l.labelKey}`)}</option>
                ))}
              </select>
              <button
                onClick={handleBatchTranslate}
                disabled={batchTranslating}
                className="btn-secondary text-sm flex items-center gap-1.5"
                style={{ padding: "5px 14px", color: "var(--primary)", borderColor: "var(--primary)" }}
              >
                {batchTranslating ? (
                  <><span className="w-3 h-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />{t("common.translating")}</>
                ) : t("upload.batch_translate")}
              </button>
            </div>
          )}
          {docs.some((d) => d.status === "translated") && (
            <button
              onClick={handleBatchIndex}
              disabled={batchIndexing}
              className="btn-secondary text-sm flex items-center gap-1.5"
              style={{ padding: "5px 14px", color: "var(--success)", borderColor: "var(--success)" }}
            >
              {batchIndexing ? (
                <><span className="w-3 h-3 rounded-full border-2 border-green-500/30 border-t-green-500 animate-spin" />{t("upload.indexing")}</>
              ) : t("upload.batch_index")}
            </button>
          )}
          {docs.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearingAll}
              className="btn-secondary text-sm"
              style={{ padding: "6px 16px", color: "var(--danger, #e11d48)" }}
            >
              {clearingAll ? t("upload.clear_all") + "..." : t("upload.clear_all")}
            </button>
          )}
          <label className="btn-primary cursor-pointer">
          {uploading ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              {t("upload.uploading")}
            </>
          ) : (
            <>
              <span style={{ fontSize: "13px" }}>↑</span>
              {t("upload.upload_doc")}
            </>
          )}
          <input
            type="file"
            className="hidden"
            accept=".pdf,.docx,.md,.txt"
            multiple
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>
      </div>

      {/* Translation progress */}
      {progress && progress.total > 0 && (
        <div
          className="rounded-lg px-5 py-4 border"
          style={{ background: "var(--primary-subtle)", borderColor: "var(--primary-dim)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-sm font-medium" style={{ color: "var(--primary)" }}>{t("upload.translate_progress")}</span>
              <span className="text-xs ml-3" style={{ color: "var(--text-muted)" }}>
                {progress.completed} / {progress.total} {t("upload.sections_completed")}
                {progress.failed > 0 && <span style={{ color: "var(--error)" }}> · {progress.failed} {t("upload.failed")}</span>}
              </span>
            </div>
            <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--primary)", fontFamily: "var(--font-mono)" }}>
              {progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0}%
            </span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--primary-dim)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%`,
                background: "var(--primary)",
              }}
            />
          </div>
        </div>
      )}

      {/* Document list */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-8">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-xl"
              style={{ background: "var(--bg-input)", color: "var(--text-faint)" }}
            >
              ↑
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: "var(--text)" }}>
              {t("upload.empty_title")}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {t("upload.empty_desc")}
            </p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                  {["table_filename", "table_type", "table_words", "table_lang", "table_status", "table_actions"].map((h, i) => (
                    <th
                      key={h}
                      className="py-3 px-4 font-medium text-xs uppercase tracking-wide"
                      style={{
                        color: "var(--text-faint)",
                        textAlign: i === 5 ? "right" : "left",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {t(`upload.${h}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((doc) => {
                  const canTranslate = ["uploaded", "parsed"].includes(doc.status);
                  const isTranslating = translatingIds.has(doc.id) || ["translating", "parsing"].includes(doc.status);
                  const selectedTarget = targetLangs[doc.id] || doc.target_lang || "en";

                  return (
                    <tr
                      key={doc.id}
                      style={{ borderBottom: "1px solid var(--border-light)" }}
                    >
                      <td className="py-3 px-4">
                        <span className="font-medium text-sm" style={{ color: "var(--text)" }}>
                          {doc.filename}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className="badge"
                          style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}
                        >
                          {doc.file_type?.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 tabular-nums text-sm" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                        {doc.word_count?.toLocaleString() ?? "—"}
                      </td>
                      <td className="py-3 px-4 text-xs" style={{ color: "var(--text-muted)" }}>
                        {doc.source_lang?.toUpperCase() ?? "—"}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={doc.status} />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end items-center gap-2">
                          {canTranslate && (
                            <select
                              value={selectedTarget}
                              onChange={(e) => setTargetLangs((cur) => ({ ...cur, [doc.id]: e.target.value }))}
                              disabled={isTranslating}
                              className="text-xs rounded-md px-2 py-1.5 border"
                              style={{
                                background: "var(--bg-input)",
                                borderColor: "var(--border)",
                                color: "var(--text)",
                                fontFamily: "var(--font-sans)",
                              }}
                            >
                              {LANG_OPTIONS.map((l) => (
                                <option key={l.code} value={l.code}>{t(`upload.${l.labelKey}`)}</option>
                              ))}
                            </select>
                          )}

                          <button
                            onClick={() => handleViewSource(doc.id)}
                            className="btn-secondary text-xs"
                            style={{ padding: "5px 12px" }}
                          >
                            {t("upload.view_source")}
                          </button>

                          {["uploaded", "parsed", "translating", "parsing"].includes(doc.status) && (
                            <button
                              onClick={() => handleTranslate(doc.id)}
                              disabled={isTranslating}
                              className="btn-primary text-xs"
                              style={{ padding: "5px 12px" }}
                            >
                              {isTranslating ? (
                                <>
                                  <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                  {t("common.translating")}
                                </>
                              ) : t("common.translate")}
                            </button>
                          )}

                          {["translated", "indexed"].includes(doc.status) && (
                            <Link
                              href={`/translate/${doc.id}`}
                              className="btn-secondary text-xs"
                              style={{ padding: "5px 12px", color: "var(--accent)", borderColor: "var(--accent)" }}
                            >
                              {t("upload.bilingual")}
                            </Link>
                          )}

                          {doc.status === "translated" && (
                            <button
                              onClick={() => handleIndex(doc.id)}
                              className="btn-secondary text-xs"
                              style={{ padding: "5px 12px", color: "var(--success)", borderColor: "var(--success)" }}
                            >
                              {t("upload.index")}
                            </button>
                          )}

                          {doc.status === "indexed" && (
                            <span className="text-xs" style={{ color: "var(--success)" }}>{t("upload.done")}</span>
                          )}

                          {doc.status === "error" && (
                            <span className="text-xs" style={{ color: "var(--error)" }}>{t("common.error")}</span>
                          )}

                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="text-xs px-2 py-1 rounded transition-colors"
                            style={{ color: "var(--text-faint)" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--error)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-faint)"; }}
                          >
                            {t("common.delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div
                className="flex items-center justify-between px-4 py-3 text-xs"
                style={{ borderTop: "1px solid var(--border-light)", color: "var(--text-muted)" }}
              >
                <span>{t("upload.pagination", { total: docs.length, page, pages: totalPages })}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="btn-secondary text-xs"
                    style={{ padding: "4px 10px" }}
                  >
                    {t("upload.prev_page")}
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    className="btn-secondary text-xs"
                    style={{ padding: "4px 10px" }}
                  >
                    {t("upload.next_page")}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Preview modal */}
      {(previewLoading || previewSections) && (
        <div
          onClick={() => { setPreviewDoc(null); setPreviewSections(null); }}
          style={{
            position: "fixed", inset: 0, zIndex: 999,
            background: "rgba(0,0,0,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "2rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-card)",
              borderRadius: 16,
              maxWidth: 800, width: "100%",
              maxHeight: "80vh",
              display: "flex", flexDirection: "column",
              boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "1rem 1.25rem",
                borderBottom: "1px solid var(--border-light)",
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                  {previewDoc?.filename || t("upload.preview_loading")}
                </span>
                {previewDoc?.source_lang && (
                  <span className="badge text-xs" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>
                    {previewDoc.source_lang.toUpperCase()}
                  </span>
                )}
              </div>
              <button
                onClick={() => { setPreviewDoc(null); setPreviewSections(null); }}
                className="text-sm px-2 py-1 rounded-md hover:opacity-70"
                style={{ color: "var(--text-faint)" }}
              >
                ✕
              </button>
            </div>
            <div
              style={{
                padding: "1.25rem",
                overflowY: "auto",
                flex: 1,
              }}
            >
              {previewLoading && (
                <div className="text-center py-10 text-sm" style={{ color: "var(--text-faint)" }}>
                  {t("upload.preview_loading")}
                </div>
              )}
              {!previewLoading && previewSections?.length === 0 && (
                <div className="text-center py-10 text-sm" style={{ color: "var(--text-muted)" }}>
                  {t("upload.preview_empty")}
                </div>
              )}
              {!previewLoading && previewSections?.map((sec: any, i: number) => (
                <div key={i} style={{ marginBottom: "1.5rem" }}>
                  {sec.heading && (
                    <h3 style={{ fontSize: Math.max(14, 20 - sec.level * 2) as any, color: "var(--text)", fontWeight: 600, marginBottom: "0.375rem" }}>
                      {sec.heading}
                    </h3>
                  )}
                  <p style={{ fontSize: "0.8125rem", lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--text-muted)", margin: 0 }}>{sec.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
