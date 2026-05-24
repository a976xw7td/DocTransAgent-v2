"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const navItems = [
  {
    href: "/",
    labelKey: "dashboard",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="1" width="5.5" height="5.5" rx="1.2" />
        <rect x="8.5" y="1" width="5.5" height="5.5" rx="1.2" />
        <rect x="1" y="8.5" width="5.5" height="5.5" rx="1.2" />
        <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.2" />
      </svg>
    ),
  },
  {
    href: "/upload",
    labelKey: "documents",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 1.5H3a1 1 0 00-1 1v10a1 1 0 001 1h9a1 1 0 001-1V6L8.5 1.5z" />
        <path d="M8.5 1.5V6H13" />
        <path d="M5 9.5h5M5 11.5h3" />
      </svg>
    ),
  },
  {
    href: "/kb",
    labelKey: "kb",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3.5h11M2 7.5h11M2 11.5h6" />
        <circle cx="12.5" cy="11.5" r="1.5" />
        <path d="M12.5 10V8" />
      </svg>
    ),
  },
  {
    href: "/qa",
    labelKey: "qa",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 9.5a1 1 0 01-1 1H4.5L2 13V2a1 1 0 011-1h9a1 1 0 011 1v7.5z" />
      </svg>
    ),
  },
  {
    href: "/glossary",
    labelKey: "glossary",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 1h7a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z" />
        <path d="M5.5 5h4M5.5 7.5h4M5.5 10h2.5" />
      </svg>
    ),
  },
  {
    href: "/obsidian",
    labelKey: "import",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.5 1.5v8M4.5 6.5l3 3 3-3" />
        <path d="M2.5 10.5v2a1 1 0 001 1h8a1 1 0 001-1v-2" />
      </svg>
    ),
  },
  {
    href: "/graph",
    labelKey: "graph",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7.5" cy="7.5" r="1.5" />
        <circle cx="2.5" cy="3.5" r="1.5" />
        <circle cx="12.5" cy="3.5" r="1.5" />
        <circle cx="2.5" cy="11.5" r="1.5" />
        <circle cx="12.5" cy="11.5" r="1.5" />
        <path d="M3.8 4.6l2.5 2M8.7 6.6l2.5-2M3.8 10.4l2.5-2M8.7 8.4l2.5 2" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-56 flex flex-col z-40"
      style={{
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--sidebar-border)",
      }}
    >
      <div className="px-5 pt-6 pb-5" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
        <Link href="/" className="flex items-center gap-3 group" style={{ textDecoration: "none" }}>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: "var(--primary)",
              color: "white",
              boxShadow: "0 6px 16px oklch(52% 0.085 210 / 0.16)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 1.5L2.5 4v5.5L7 12l4.5-2.5V4L7 1.5z" />
              <path d="M7 1.5v10.5M2.5 4L7 6.5 11.5 4" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold leading-snug" style={{ color: "var(--text)" }}>
              DocTransAgent
            </div>
            <div className="text-xs" style={{ color: "var(--sidebar-text-dim)" }}>
              {t("sidebar.subtitle")}
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-2.5 py-4 space-y-0.5 overflow-y-auto">
        <div className="px-2.5 mb-3">
          <span className="text-xs font-semibold" style={{ color: "var(--sidebar-text-dim)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {t("sidebar.nav")}
          </span>
        </div>
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
              style={{
                background: isActive ? "var(--sidebar-active)" : "transparent",
                color: isActive ? "var(--sidebar-active-text)" : "var(--sidebar-text)",
                textDecoration: "none",
                boxShadow: isActive ? "inset 0 0 0 1px var(--primary-dim)" : "none",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "var(--sidebar-hover)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "var(--sidebar-text)";
                }
              }}
            >
              <span
                className="flex-shrink-0"
                style={{ color: isActive ? "var(--primary)" : "var(--sidebar-icon)" }}
              >
                {item.icon}
              </span>
              <span className="font-medium">{t(`sidebar.${item.labelKey}`)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 space-y-3" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{
              background: "var(--primary)",
              boxShadow: "0 0 0 4px var(--primary-subtle)",
            }}
          />
          <span className="text-xs" style={{ color: "var(--sidebar-text-dim)" }}>{t("sidebar.status_ok")}</span>
        </div>
        <LanguageSwitcher />
      </div>
    </aside>
  );
}
