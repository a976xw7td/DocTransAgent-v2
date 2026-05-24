"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { documentsApi, exportApi, glossaryApi } from "@/lib/api";
import { StatusBadge } from "@/components/Badges";

interface Section {
  heading: string;
  level: number;
  content: string;
}

interface TransSection {
  heading: string;
  level: number;
  content: string;
}

type ViewMode = "full" | "section";

export default function TranslateReviewPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<number | null>(null);
  const [showGlossary, setShowGlossary] = useState(true);
  const [glossary, setGlossary] = useState<{ source: string; target: string }[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("full");

  useEffect(() => {
    if (!id) return;
    documentsApi
      .get(id as string)
      .then((d) => {
        setDoc(d);
        if (d.sections?.length > 0) setActiveSection(0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    glossaryApi.list().then((entries: any[]) => {
      setGlossary(entries.map((e: any) => ({ source: e.source_term, target: e.target_term })));
    }).catch(() => {});
  }, [id]);

  const renderHighlighted = (text: string, lang: "source" | "target") => {
    if (!showGlossary || glossary.length === 0) return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const terms = lang === "source"
      ? glossary.map((g) => g.source).filter(Boolean)
      : glossary.map((g) => g.target).filter(Boolean);
    if (terms.length === 0) return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length).join("|");
    const pattern = new RegExp(`(${escaped})`, "gi");
    const parts = text.split(pattern);
    let isMatch = true;
    return parts.map((part) => {
      isMatch = !isMatch;
      if (isMatch) return `<mark style="background:var(--primary-subtle);border-radius:2px;padding:0 1px">${part}</mark>`;
      return part.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }).join("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg" style={{ color: "var(--text-muted)" }}>{t("common.loading")}</div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="text-center py-20" style={{ color: "var(--text-muted)" }}>
        <p className="text-lg font-medium mb-2">{t("translate.not_found_title")}</p>
        <p className="text-lg font-medium">{t("translate.not_found_subtitle")}</p>
      </div>
    );
  }

  const sections: Section[] = doc.sections || [];
  const translated: TransSection[] = doc.translated_sections || [];
  const hasTranslation = translated.length > 0;

  const handleExport = async (fmt: "pdf" | "docx" | "md") => {
    try {
      let blob: Blob;
      if (fmt === "pdf") blob = await exportApi.pdf(id as string);
      else if (fmt === "docx") blob = await exportApi.docx(id as string);
      else blob = await exportApi.bilingual(id as string, "md");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.filename.replace(/\.[^.]+$/, "")}${t("translate.bilingual_suffix")}.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{doc.filename}</h1>
            <StatusBadge status={doc.status} />
          </div>
          <div className="flex items-center gap-2 mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            <span>{doc.source_lang?.toUpperCase()} → {doc.target_lang?.toUpperCase()}</span>
            <span>·</span>
            <span>{doc.word_count?.toLocaleString()} {t("translate.words")}</span>
          </div>
        </div>
        {hasTranslation && (
          <div className="flex items-center gap-3">
            {/* View mode toggle */}
            <div
              className="flex items-center rounded-lg p-0.5"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}
            >
              {(["full", "section"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className="text-xs px-3 py-1.5 rounded-md transition-all duration-150 font-medium"
                  style={{
                    background: viewMode === mode ? "var(--primary)" : "transparent",
                    color: viewMode === mode ? "white" : "var(--text-muted)",
                  }}
                >
                  {mode === "full" ? t("translate.full_view") : t("translate.section_view")}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              {[
                { fmt: "pdf" as const, label: "PDF" },
                { fmt: "docx" as const, label: "DOCX" },
                { fmt: "md" as const, label: "MD" },
              ].map(({ fmt, label }) => (
                <button
                  key={fmt}
                  onClick={() => handleExport(fmt)}
                  className="text-xs px-2.5 py-1 rounded-md border transition-colors"
                  style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                {t("translate.glossary_label")}
              </span>
              <button
                onClick={() => setShowGlossary(!showGlossary)}
                style={{
                  background: showGlossary ? "var(--primary)" : "var(--border)",
                }}
                className="relative w-10 h-5 rounded-full transition-colors duration-200"
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                    showGlossary ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            </label>
          </div>
        )}
      </div>

      {/* ── FULL view ── */}
      {viewMode === "full" && (
        <div className="grid grid-cols-2 gap-4">
          {/* Source — full */}
          <div
            className="rounded-xl border"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
          >
            <div
              className="flex items-center gap-2 px-6 py-3 border-b"
              style={{ borderColor: "var(--border-light)" }}
            >
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}
              >
                {doc.source_lang?.toUpperCase()}
              </span>
              <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{t("common.source")}</span>
            </div>
            <div className="p-6 space-y-6">
              {sections.map((sec, i) => (
                <div key={i}>
                  {sec.heading && (
                    <h2
                      className="font-semibold mb-2"
                      style={{ fontSize: Math.max(14, 22 - sec.level * 2), color: "var(--text)" }}
                    >
                      {sec.heading}
                    </h2>
                  )}
                  <div
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    style={{ color: "var(--text-muted)" }}
                    dangerouslySetInnerHTML={{ __html: renderHighlighted(sec.content, "source") }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Translation — full */}
          <div
            className="rounded-xl border"
            style={{
              background: "var(--bg-card)",
              borderColor: hasTranslation ? "var(--primary)" : "var(--border)",
            }}
          >
            <div
              className="flex items-center gap-2 px-6 py-3 border-b"
              style={{ borderColor: "var(--border-light)" }}
            >
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{ background: "var(--primary-subtle)", color: "var(--primary)" }}
              >
                {doc.target_lang?.toUpperCase()}
              </span>
              <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{t("common.translation")}</span>
            </div>
            <div className="p-6 space-y-6">
              {hasTranslation ? (
                translated.map((sec, i) => (
                  <div key={i}>
                    {sec.heading && (
                      <h2
                        className="font-semibold mb-2"
                        style={{ fontSize: Math.max(14, 22 - sec.level * 2), color: "var(--text)" }}
                      >
                        {sec.heading}
                      </h2>
                    )}
                    <div
                      className="text-sm leading-relaxed whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ __html: renderHighlighted(sec.content, "target") }}
                    />
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-32" style={{ color: "var(--text-muted)" }}>
                  <div>
                    <p className="text-sm font-medium mb-1">{t("translate.translation_pending_title")}</p>
                    <p className="text-sm">{t("translate.translation_pending_subtitle")}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION view ── */}
      {viewMode === "section" && (
        <>
          {/* Section navigator */}
          {sections.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {sections.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSection(i)}
                  className="text-xs px-3 py-1.5 rounded-lg transition-colors truncate max-w-[200px]"
                  style={{
                    background: activeSection === i ? "var(--primary)" : "var(--bg-input)",
                    color: activeSection === i ? "white" : "var(--text-muted)",
                  }}
                >
                  {s.heading || t("translate.section_label", { n: i + 1 })}
                </button>
              ))}
            </div>
          )}

          {activeSection !== null && sections[activeSection] && (
            <div className="grid grid-cols-2 gap-4">
              {/* Source */}
              <div className="rounded-xl p-6 border" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>
                    {doc.source_lang?.toUpperCase()}
                  </span>
                  <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{t("common.source")}</span>
                </div>
                <h2 className="font-semibold mb-3" style={{ fontSize: Math.max(14, 22 - sections[activeSection].level * 2), color: "var(--text)" }}>
                  {sections[activeSection].heading}
                </h2>
                <div
                  className="text-sm leading-relaxed whitespace-pre-wrap"
                  style={{ color: "var(--text-muted)" }}
                  dangerouslySetInnerHTML={{ __html: renderHighlighted(sections[activeSection].content, "source") }}
                />
              </div>

              {/* Translation */}
              <div className="rounded-xl p-6 border" style={{
                background: "var(--bg-card)",
                borderColor: hasTranslation ? "var(--primary)" : "var(--border)",
              }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: "var(--primary-subtle)", color: "var(--primary)" }}>
                    {doc.target_lang?.toUpperCase()}
                  </span>
                  <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{t("common.translation")}</span>
                </div>
                {hasTranslation && translated[activeSection] ? (
                  <>
                    <h2 className="font-semibold mb-3" style={{ fontSize: Math.max(14, 22 - translated[activeSection].level * 2), color: "var(--text)" }}>
                      {translated[activeSection].heading}
                    </h2>
                    <div
                      className="text-sm leading-relaxed whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ __html: renderHighlighted(translated[activeSection].content, "target") }}
                    />
                    {!showGlossary && (
                      <div className="mt-3 text-xs italic opacity-50">
                        {t("translate.glossary_disabled")}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-32" style={{ color: "var(--text-muted)" }}>
                    <div>
                      <p className="text-sm font-medium mb-1">{t("translate.translation_pending_title")}</p>
                      <p className="text-sm">{t("translate.translation_pending_subtitle")}</p>
                      <p className="text-xs mt-1">{t("translate.translation_pending_hint")}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}


    </div>
  );
}
