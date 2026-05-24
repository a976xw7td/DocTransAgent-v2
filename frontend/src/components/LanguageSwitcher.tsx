"use client";

import { useTranslation } from "react-i18next";
import { setLanguage } from "@/lib/i18n/i18n";

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  const toggle = () => {
    const next = i18n.language === "zh" ? "en" : "zh";
    setLanguage(next);
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-all border"
      style={{
        background: "var(--sidebar-bg)",
        borderColor: "var(--sidebar-border)",
        color: "var(--sidebar-text)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--primary-dim)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--sidebar-border)";
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
      {i18n.language === "zh" ? "English" : "中文"}
    </button>
  );
}
