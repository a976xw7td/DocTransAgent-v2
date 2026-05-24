"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { obsidianApi, graphApi } from "@/lib/api";
import Link from "next/link";

export default function ObsidianImportPage() {
  const { t, i18n } = useTranslation();
  const [vaultPath, setVaultPath] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [graphStats, setGraphStats] = useState<any>(null);
  const [recentImports, setRecentImports] = useState<any[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchState = useCallback(async () => {
    try {
      const [stats, imports] = await Promise.all([graphApi.stats(), obsidianApi.listImports()]);
      setGraphStats(stats);
      setRecentImports(imports.imports || []);
    } catch {}
  }, []);

  useEffect(() => { fetchState(); }, [fetchState]);

  const handleImport = async () => {
    if (!vaultPath.trim()) return;
    setImporting(true); setError(""); setResult(null);
    try {
      const res = await obsidianApi.importVault(vaultPath.trim());
      setResult(res);
      await fetchState();
    } catch (e: any) {
      setError(e.message || t("common.error"));
    } finally { setImporting(false); }
  };

  const handleFileImport = async () => {
    if (uploadedFiles.length === 0) return;
    setImporting(true); setError(""); setResult(null);
    try {
      const res = await obsidianApi.uploadFiles(uploadedFiles);
      setResult(res);
      setUploadedFiles([]);
      await fetchState();
    } catch (e: any) {
      setError(e.message || t("common.error"));
    } finally { setImporting(false); }
  };

  const handleFiles = (files: FileList | File[]) => {
    const mdFiles = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".md"));
    if (mdFiles.length === 0) { setError(t("common.error")); return; }
    setUploadedFiles(mdFiles); setError(""); setResult(null);
  };

  const handleDeleteImport = async (importId: string) => {
    if (!window.confirm(t("obsidian.delete_confirm"))) return;
    setDeletingId(importId);
    try {
      await obsidianApi.deleteImport(importId);
      await fetchState();
    } catch (e: any) {
      alert(t("common.error") + ": " + (e.message ?? t("common.error")));
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAllImports = async () => {
    if (!window.confirm(t("obsidian.clear_confirm", { count: recentImports.length }))) return;
    setClearingAll(true);
    try {
      await obsidianApi.clearImports();
      await fetchState();
    } catch (e: any) {
      alert(t("common.error") + ": " + (e.message ?? t("common.error")));
    } finally {
      setClearingAll(false);
    }
  };

  const nodeTypes = graphStats?.nodes_by_type || {};
  const edgeRelations = graphStats?.edges_by_relation || {};
  const hasGraph = graphStats && (graphStats.nodes_total > 0);

  const statCards = [
    { labelKey: "node_label",  value: graphStats?.nodes_total ?? 0 },
    { labelKey: "edge_label",    value: graphStats?.edges_total ?? 0 },
    { labelKey: "note_label",  value: nodeTypes.note ?? 0 },
    { labelKey: "tag_label",  value: nodeTypes.tag ?? 0 },
  ];

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>
            {t("obsidian.page_title")}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            {t("obsidian.page_subtitle")}
          </p>
        </div>
        {hasGraph && (
          <Link href="/graph" className="btn-secondary text-sm">
            {t("obsidian.explore_graph")}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Import form */}
        <div className="lg:col-span-3 space-y-4">
          <div className="card">
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-faint)", letterSpacing: "0.08em" }}>
              {t("obsidian.import_title")}
            </h2>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-150"
              style={{
                borderColor: dragOver ? "var(--primary)" : "var(--border)",
                background: dragOver ? "var(--primary-subtle)" : "var(--bg)",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".md"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                style={{ background: dragOver ? "var(--primary)" : "var(--bg-card)", color: dragOver ? "white" : "var(--text-faint)", border: "1px solid var(--border)" }}
              >
                ↑
              </div>
              {uploadedFiles.length > 0 ? (
                <div>
                  <div className="text-sm font-semibold mb-1" style={{ color: "var(--primary)" }}>
                    {t("obsidian.files_selected", { count: uploadedFiles.length })}
                  </div>
                  <div className="text-xs max-h-24 overflow-y-auto space-y-0.5" style={{ color: "var(--text-muted)" }}>
                    {uploadedFiles.map((f, i) => <div key={i} className="truncate">{f.name}</div>)}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setUploadedFiles([]); }}
                    className="text-xs underline mt-2"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {t("common.clear")}
                  </button>
                </div>
              ) : (
                <>
                  <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    {t("obsidian.drop_hint")}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
                    {t("obsidian.drop_subtitle")}
                  </div>
                </>
              )}
            </div>

            {uploadedFiles.length > 0 && (
              <button
                onClick={handleFileImport}
                disabled={importing}
                className="btn-primary w-full justify-center mt-3"
              >
                {importing ? (
                  <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> {t("obsidian.importing")}</>
                ) : t("obsidian.import_btn", { count: uploadedFiles.length })}
              </button>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1" style={{ borderTop: "1px solid var(--border-light)" }} />
              <span className="text-xs" style={{ color: "var(--text-faint)" }}>{t("obsidian.or_path")}</span>
              <div className="flex-1" style={{ borderTop: "1px solid var(--border-light)" }} />
            </div>

            {/* Path input */}
            <div className="flex gap-3">
              <input
                type="text"
                value={vaultPath}
                onChange={(e) => setVaultPath(e.target.value)}
                placeholder={t("obsidian.path_placeholder")}
                className="input flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleImport()}
              />
              <button
                onClick={handleImport}
                disabled={importing || !vaultPath.trim()}
                className="btn-primary"
              >
                {importing ? t("obsidian.importing") : t("obsidian.import_path_btn")}
              </button>
            </div>

            {/* Feedback */}
            {error && (
              <div
                className="mt-3 px-4 py-3 rounded-lg text-sm"
                style={{ background: "oklch(97% 0.015 20)", color: "var(--error)", border: "1px solid oklch(90% 0.04 20)" }}
              >
                {error}
              </div>
            )}
            {result && (
              <div
                className="mt-3 px-4 py-3 rounded-lg text-sm"
                style={{
                  background: result.status === "completed" ? "var(--primary-subtle)" : "var(--bg-input)",
                  color: result.status === "completed" ? "var(--primary)" : "var(--text-muted)",
                  border: `1px solid ${result.status === "completed" ? "var(--primary-dim)" : "var(--border)"}`,
                }}
              >
                {result.status === "completed"
                  ? t("obsidian.import_success", { count: result.imported_count })
                  : `${t("common.loading")}: ${result.status}`}
              </div>
            )}
          </div>
        </div>

        {/* Stats sidebar */}
        <div className="lg:col-span-2 space-y-4">
          {/* Overview numbers */}
          <div className="grid grid-cols-2 gap-3">
            {statCards.map((s) => (
              <div key={s.labelKey} className="card-sm text-center">
                <div
                  className="text-2xl font-semibold tabular-nums"
                  style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}
                >
                  {s.value}
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{t(`obsidian.${s.labelKey}`)}</div>
              </div>
            ))}
          </div>

          {/* Node type breakdown */}
          {Object.keys(nodeTypes).length > 0 && (
            <div className="card">
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-faint)", letterSpacing: "0.08em" }}>
                {t("obsidian.node_types_title")}
              </h2>
              <div className="space-y-1">
                {Object.entries(nodeTypes).map(([type, count]) => (
                  <div
                    key={type}
                    className="flex justify-between items-center px-3 py-2 rounded-md text-xs"
                    style={{ background: "var(--bg)" }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>{type}</span>
                    <span style={{ color: "var(--text)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                      {String(count)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Edge relation breakdown */}
          {Object.keys(edgeRelations).length > 0 && (
            <div className="card">
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-faint)", letterSpacing: "0.08em" }}>
                {t("obsidian.edge_types_title")}
              </h2>
              <div className="space-y-1">
                {Object.entries(edgeRelations).map(([rel, count]) => (
                  <div
                    key={rel}
                    className="flex justify-between items-center px-3 py-2 rounded-md text-xs"
                    style={{ background: "var(--bg)" }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>{rel}</span>
                    <span style={{ color: "var(--text)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                      {String(count)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent imports */}
      {recentImports.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)", letterSpacing: "0.08em" }}>
              {t("obsidian.import_records_title")}
            </h2>
            <button
              onClick={handleClearAllImports}
              disabled={clearingAll}
              className="text-xs px-3 py-1 rounded-md border transition-colors"
              style={{ borderColor: "var(--border)", color: clearingAll ? "var(--text-faint)" : "var(--danger, #e11d48)" }}
            >
              {clearingAll ? t("common.clearing") : t("obsidian.clear_all")}
            </button>
          </div>
          <div className="space-y-1.5">
            {recentImports.map((imp: any) => (
              <div
                key={imp.id}
                className="flex items-center justify-between px-4 py-3 rounded-lg text-sm"
                style={{ background: "var(--bg)" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      background:
                        imp.status === "completed" ? "var(--success)"
                        : imp.status === "error" ? "var(--error)"
                        : "var(--warning)",
                    }}
                  />
                  <span className="text-sm font-medium truncate" style={{ color: "var(--text)", maxWidth: 260 }}>
                    {imp.source_path.split("/").pop() || imp.source_path}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs flex-shrink-0" style={{ color: "var(--text-faint)" }}>
                  <span style={{ fontFamily: "var(--font-mono)" }}>{imp.imported_count}{t("obsidian.items")}</span>
                  <span style={{
                    color: imp.status === "completed" ? "var(--success)"
                      : imp.status === "error" ? "var(--error)" : "var(--warning)"
                  }}>
                    {imp.status === "completed" ? t("obsidian.status_completed") : imp.status === "error" ? t("obsidian.status_error") : t("obsidian.status_processing")}
                  </span>
                  {imp.created_at && (
                    <span>{new Date(imp.created_at).toLocaleDateString(i18n.language === "zh" ? "zh-CN" : "en-US")}</span>
                  )}
                  <button
                    onClick={() => handleDeleteImport(imp.id)}
                    disabled={deletingId === imp.id}
                    className="text-xs px-2 py-0.5 rounded transition-colors"
                    style={{ color: "var(--text-faint)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--error)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-faint)"; }}
                  >
                    {deletingId === imp.id ? t("common.deleting") : t("common.delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentImports.length === 0 && !hasGraph && (
        <div className="card text-center py-8">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {t("obsidian.empty_hint")}
          </p>
        </div>
      )}
    </div>
  );
}
