"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { dashboardApi } from "@/lib/api";
import Link from "next/link";

const pipelineSteps = [
  { icon: "↑", label: "upload_step",  desc: "upload_desc" },
  { icon: "⊞", label: "parse_step",  desc: "parse_desc" },
  { icon: "⇄", label: "translate_step",  desc: "translate_desc" },
  { icon: "⊕", label: "embed_step",  desc: "embed_desc" },
  { icon: "◎", label: "qa_step",  desc: "qa_desc" },
];

const quickLinks = [
  { href: "/obsidian", labelKey: "import_vault", descKey: "import_desc", icon: "↑", color: "var(--primary-subtle)", accent: "var(--primary)" },
  { href: "/graph",    labelKey: "explore_graph", descKey: "explore_desc", icon: "◎", color: "oklch(95% 0.025 280)", accent: "oklch(52% 0.10 280)" },
  { href: "/glossary", labelKey: "manage_glossary",  descKey: "manage_desc", icon: "≡", color: "oklch(95% 0.025 35)",  accent: "var(--accent)" },
];

export default function DashboardPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.stats().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  const n = (v: any) => loading ? "—" : (v ?? "0");

  return (
    <div className="space-y-8 animate-fade-in">

      {/* ── Hero row ── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="section-label mb-2">{t("dashboard.section_label")}</p>
          <h1
            className="font-semibold leading-tight"
            style={{ fontSize: "28px", color: "var(--text)", letterSpacing: "-0.02em" }}
          >
            {t("dashboard.page_title")}
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)", maxWidth: "40ch" }}>
            {t("dashboard.page_subtitle")}
          </p>
        </div>
        <div className="flex gap-2 pb-1">
          <Link href="/upload" className="btn-primary">{t("dashboard.upload_doc")}</Link>
          <Link href="/qa" className="btn-secondary">{t("dashboard.start_qa")}</Link>
        </div>
      </div>

      {/* ── Stats + pipeline ── */}
      <div className="grid grid-cols-12 gap-5">

        {/* Stats — 4 numbers in a column */}
        <div className="col-span-3 card flex flex-col justify-between" style={{ padding: "20px 20px" }}>
          <p className="section-label mb-5">{t("dashboard.stats_title")}</p>
          <div className="space-y-4 flex-1">
            {[
              { labelKey: "total_docs",   value: n(stats?.documents?.total),      href: "/upload" },
              { labelKey: "translated",     value: n(stats?.documents?.translated),  href: "/upload" },
              { labelKey: "indexed_entries", value: n(stats?.documents?.indexed),     href: "/kb" },
              { labelKey: "glossary_terms",   value: n(stats?.glossary?.total_terms),  href: "/glossary" },
            ].map((s) => (
              <Link
                key={s.labelKey}
                href={s.href}
                className="flex items-baseline justify-between group"
                style={{ textDecoration: "none" }}
              >
                <span
                  className="text-sm transition-colors"
                  style={{ color: "var(--text-muted)" }}
                >
                  {t(`dashboard.${s.labelKey}`)}
                </span>
                <span
                  className="font-semibold tabular-nums text-lg"
                  style={{ color: "var(--text)", fontFamily: "var(--font-mono)", letterSpacing: "-0.02em" }}
                >
                  {s.value}
                </span>
              </Link>
            ))}
          </div>
          <Link href="/upload" className="btn-secondary w-full mt-5 text-xs">{t("dashboard.view_all")}</Link>
        </div>

        {/* Pipeline — horizontal timeline */}
        <div className="col-span-9 card" style={{ padding: "20px 24px" }}>
          <p className="section-label mb-6">{t("dashboard.pipeline_title")}</p>
          <div className="relative flex items-start justify-between">
            <div
              className="absolute"
              style={{
                top: "20px",
                left: "32px",
                right: "32px",
                height: "1px",
                background: "var(--border)",
              }}
            />
            {pipelineSteps.map((s, i) => (
              <div key={i} className="relative flex flex-col items-center gap-3 flex-1">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-medium z-10"
                  style={{
                    background: i === 0 ? "var(--primary)" : "var(--bg-card)",
                    border: i === 0 ? "none" : "1px solid var(--border)",
                    color: i === 0 ? "oklch(98% 0.006 168)" : "var(--text-muted)",
                    boxShadow: i === 0 ? "var(--shadow-sm)" : "var(--shadow-xs)",
                  }}
                >
                  {s.icon}
                </div>
                <div className="text-center">
                  <div
                    className="text-sm font-semibold"
                    style={{ color: i === 0 ? "var(--primary)" : "var(--text)" }}
                  >
                    {t(`dashboard.${s.label}`)}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>{t(`dashboard.${s.desc}`)}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Usage strip — only if data exists */}
          {stats?.usage && stats.usage.total_tokens > 0 && (
            <div
              className="mt-6 pt-5 grid grid-cols-4 gap-4"
              style={{ borderTop: "1px solid var(--border-light)" }}
            >
              {[
                { labelKey: "usage_translate_tokens", value: (stats.usage.translation_tokens || 0).toLocaleString() },
                { labelKey: "usage_embed_tokens", value: (stats.usage.embedding_tokens || 0).toLocaleString() },
                { labelKey: "usage_total_tokens",   value: (stats.usage.total_tokens || 0).toLocaleString() },
                { labelKey: "usage_estimated_cost",   value: `$${(stats.usage.total_estimated_cost_usd || 0).toFixed(4)}` },
              ].map((item) => (
                <div key={item.labelKey}>
                  <div className="text-xs mb-1" style={{ color: "var(--text-faint)" }}>{t(`dashboard.${item.labelKey}`)}</div>
                  <div
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── ROI bar ── */}
      {stats?.roi && stats.roi.human_translation_estimate_usd > 0 && (
        <div className="card" style={{ padding: "20px 24px" }}>
          <div className="flex items-center justify-between mb-4">
            <p className="section-label">{t("dashboard.roi_title")}</p>
            <span
              className="text-sm font-semibold px-3 py-1 rounded-full"
              style={{ background: "var(--primary-subtle)", color: "var(--primary)" }}
            >
              {t("dashboard.roi_save_badge")}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-6">
            {[
              { labelKey: "roi_human_label", value: `$${(stats.roi.human_translation_estimate_usd || 0).toLocaleString()}`, pct: 100, color: "var(--border)" },
              { labelKey: "roi_ai_label",  value: `$${(stats.roi.ai_translation_cost_usd || 0).toFixed(4)}`, pct: Math.max(0.5, Math.min(100, (stats.roi.ai_translation_cost_usd / stats.roi.human_translation_estimate_usd) * 100)), color: "var(--primary)" },
            ].map((row) => (
              <div key={row.labelKey}>
                <div className="flex justify-between text-sm mb-2">
                  <span style={{ color: "var(--text-muted)" }}>{t(`dashboard.${row.labelKey}`)}</span>
                  <span style={{ color: "var(--text)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{row.value}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-sunken)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${row.pct}%`, background: row.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick links ── */}
      <div>
        <p className="section-label mb-4">{t("dashboard.quick_links")}</p>
        <div className="grid grid-cols-3 gap-4">
          {quickLinks.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="card-sm group block transition-all duration-150"
              style={{ textDecoration: "none" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = card.accent;
                (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-xs)";
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-sm mb-3 font-medium"
                style={{ background: card.color, color: card.accent }}
              >
                {card.icon}
              </div>
              <div className="text-sm font-semibold mb-0.5" style={{ color: "var(--text)" }}>
                {t(`dashboard.${card.labelKey}`)}
              </div>
              <div className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {t(`dashboard.${card.descKey}`)}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
