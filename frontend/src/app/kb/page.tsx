"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { kbApi } from "@/lib/api";

interface SearchResult {
  chunk_id: string;
  text: string;
  metadata: Record<string, string>;
  score: number;
}

export default function KBPage() {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const data = await kbApi.search(q);
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  // Load stats on mount
  useEffect(() => {
    kbApi.stats().then(setStats).catch(() => {});
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">{t("kb.page_title")}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          {t("kb.page_subtitle")}
          {stats && <span> · {stats.total_chunks} {t("kb.chunks")} · {stats.indexed_documents} {t("kb.documents")}</span>}
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <input
          className="input flex-1 text-lg"
          placeholder={t("kb.search_placeholder")}
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
        />
        <button type="submit" disabled={searching} className="btn-primary">
          {searching ? t("common.searching") : t("common.search")}
        </button>
      </form>

      {/* Results */}
      <div className="space-y-3">
        {results.map((r) => (
          <div key={r.chunk_id} className="card hover:border-indigo-500/30 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="badge" style={{ background: "var(--primary)" }}>{t("kb.score_pct", { score: (r.score * 100).toFixed(0) })}</span>
                {r.metadata.title && (
                  <span className="text-sm font-medium">{r.metadata.title}</span>
                )}
                {r.metadata.lang && (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    ({r.metadata.lang === "en" ? "English" : r.metadata.lang})
                  </span>
                )}
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {r.text.slice(0, 400)}
              {r.text.length > 400 && "..."}
            </p>
          </div>
        ))}

        {!searching && query && results.length === 0 && (
          <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
            <p className="text-lg font-medium mb-1">{t("kb.no_results_title")}</p>
            <p className="text-sm mt-1">{t("kb.no_results_desc")}</p>
          </div>
        )}

        {!query && (
          <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
            <p className="font-medium text-lg mb-1">{t("kb.empty_title")}</p>
            <p className="text-sm mt-1">{t("kb.empty_desc")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
