"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useTranslation } from "react-i18next";
import { graphApi } from "@/lib/api";
import type { GraphNode, GraphEdge } from "@/components/ForceGraph";

// ForceGraph uses d3 which is browser-only — load it client-side only
const ForceGraph = dynamic(() => import("@/components/ForceGraph"), { ssr: false });

const TYPE_COLOR: Record<string, string> = {
  note:            "#7c8cff",
  heading:         "#63d4b0",
  tag:             "#c77dff",
  alias:           "#ffa94d",
  wikilink_target: "#69db7c",
  document:        "#4dabf7",
  section:         "#f06595",
  term:            "#ffd43b",
};

export default function GraphExplorePage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<any>(null);
  const [allNodes, setAllNodes] = useState<GraphNode[]>([]);
  const [allEdges, setAllEdges] = useState<GraphEdge[]>([]);
  const [filteredNodes, setFilteredNodes] = useState<GraphNode[]>([]);
  const [filteredEdges, setFilteredEdges] = useState<GraphEdge[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [filterType, setFilterType] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [neighborhood, setNeighborhood] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [graphSize, setGraphSize] = useState({ w: 900, h: 580 });

  // Per-node translation state
  const [translating, setTranslating] = useState(false);
  const [translationResult, setTranslationResult] = useState<{ text: string; lang: string } | null>(null);
  const [translateLang, setTranslateLang] = useState("en");
  const [showSource, setShowSource] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure container width for responsive canvas
  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const w = Math.max(400, entry.contentRect.width);
        setGraphSize({ w, h: Math.max(420, Math.round(w * 0.6)) });
      }
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, graphData] = await Promise.all([
        graphApi.stats(),
        graphApi.all(500),
      ]);
      setStats(statsData);
      setAllNodes(graphData.nodes ?? []);
      setAllEdges(graphData.edges ?? []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Client-side filter
  useEffect(() => {
    let nodes = allNodes;
    if (filterType) nodes = nodes.filter((n) => n.node_type === filterType);
    if (searchQ.trim()) {
      const q = searchQ.trim().toLowerCase();
      nodes = nodes.filter((n) => n.label.toLowerCase().includes(q));
    }
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = allEdges.filter(
      (e) =>
        nodeIds.has(typeof e.source === "string" ? e.source : (e.source as GraphNode).id) &&
        nodeIds.has(typeof e.target === "string" ? e.target : (e.target as GraphNode).id)
    );
    setFilteredNodes(nodes);
    setFilteredEdges(edges);
  }, [allNodes, allEdges, searchQ, filterType]);

  const handleSelectNode = useCallback(async (node: GraphNode) => {
    setSelectedNode(node);
    setLoadingDetail(true);
    setNeighborhood(null);
    setTranslationResult(null);
    setShowSource(true);
    try {
      const neigh = await graphApi.neighborhood(node.id);
      setNeighborhood(neigh);
    } catch {} finally { setLoadingDetail(false); }
  }, []);

  const handleTranslateNode = async () => {
    if (!selectedNode || translating) return;
    setTranslating(true);
    try {
      const res = await graphApi.translateNode(selectedNode.id, translateLang);
      setTranslationResult({ text: res.translated_text, lang: translateLang });
      setShowSource(false);
    } catch (e: any) {
      alert(t("common.error") + ": " + (e.message ?? t("common.error")));
    } finally {
      setTranslating(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm(t("graph.confirm_clear"))) return;
    setClearing(true);
    try {
      await graphApi.clear();
      setStats(null);
      setAllNodes([]); setAllEdges([]);
      setFilteredNodes([]); setFilteredEdges([]);
      setSelectedNode(null); setNeighborhood(null);
    } catch {} finally { setClearing(false); }
  };

  const hasGraph = !!stats && stats.nodes_total > 0;

  const allTypeOptions: { value: string; label: string }[] = [
    { value: "", label: t("graph.all_types") },
    ...Object.keys(TYPE_COLOR).map((key) => ({ value: key, label: t(`graph.type_${key}`) })),
  ];

  function NodeTypePill({ type }: { type: string }) {
    return (
      <span
        className="badge"
        style={{
          background: TYPE_COLOR[type] ? TYPE_COLOR[type] + "22" : "var(--bg-input)",
          color: TYPE_COLOR[type] ?? "var(--text-muted)",
          border: `1px solid ${TYPE_COLOR[type] ? TYPE_COLOR[type] + "55" : "var(--border)"}`,
        }}
      >
        {t(`graph.type_${type}`)}
      </span>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>
            {t("graph.page_title")}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            {stats
              ? t("graph.page_subtitle_nodes", { count: stats.nodes_total.toLocaleString(), edges: stats.edges_total.toLocaleString() })
              : t("graph.page_subtitle_default")}
          </p>
        </div>
        {hasGraph && (
          <button
            onClick={handleClear}
            disabled={clearing}
            className="btn-secondary text-sm"
            style={{ padding: "6px 16px", color: "var(--danger, #e11d48)" }}
          >
            {clearing ? t("graph.clearing") : t("graph.clear_graph")}
          </button>
        )}
      </div>

      {/* Legend + filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Type filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="input text-xs"
          style={{ width: 130, height: 34, padding: "0 10px" }}
        >
          {allTypeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Search */}
        <input
          type="text"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder={t("graph.search_placeholder")}
          className="input text-xs flex-1"
          style={{ minWidth: 160, height: 34, padding: "0 12px" }}
        />

        {/* Colour legend */}
        <div className="flex flex-wrap gap-2 ml-auto">
          {Object.entries(TYPE_COLOR).map(([type, color]) => (
            <button
              key={type}
              onClick={() => setFilterType(filterType === type ? "" : type)}
              className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-opacity"
              style={{
                background: color + "18",
                border: `1px solid ${color}44`,
                color,
                opacity: filterType && filterType !== type ? 0.4 : 1,
              }}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
              {t(`graph.type_${type}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Main area: graph + detail panel */}
      <div className="flex gap-4" style={{ alignItems: "flex-start" }}>

        {/* Graph canvas */}
        <div
          ref={containerRef}
          className="flex-1 rounded-xl overflow-hidden border"
          style={{ borderColor: "var(--border)", minWidth: 0, position: "relative" }}
        >
          {loading && (
            <div
              className="absolute inset-0 flex items-center justify-center z-10 rounded-xl"
              style={{ background: "var(--bg)" }}
            >
              <span className="text-sm" style={{ color: "var(--text-faint)" }}>{t("common.loading")}</span>
            </div>
          )}

          {!loading && filteredNodes.length === 0 && (
            <div
              className="flex flex-col items-center justify-center"
              style={{ height: graphSize.h, background: "var(--bg)", borderRadius: 12 }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-xl"
                style={{ background: "var(--bg-input)", color: "var(--text-faint)" }}
              >
                ◎
              </div>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {allNodes.length === 0 ? t("graph.no_data") : t("graph.no_match")}
              </p>
            </div>
          )}

          {!loading && filteredNodes.length > 0 && (
            <>
              <ForceGraph
                nodes={filteredNodes}
                edges={filteredEdges}
                selectedId={selectedNode?.id ?? null}
                onSelectNode={handleSelectNode}
                width={graphSize.w}
                height={graphSize.h}
              />
              {/* Node count overlay */}
              <div
                className="absolute bottom-3 left-3 text-xs px-2 py-1 rounded-md"
                style={{ background: "var(--bg-card)", color: "var(--text-faint)", border: "1px solid var(--border-light)" }}
              >
                {filteredNodes.length} {t("graph.legend_nodes")} · {filteredEdges.length} {t("graph.legend_edges")}
                {(searchQ || filterType) && ` · ${t("graph.legend_filtered")}`}
              </div>
              <div
                className="absolute bottom-3 right-3 text-xs px-2 py-1 rounded-md"
                style={{ background: "var(--bg-card)", color: "var(--text-faint)", border: "1px solid var(--border-light)" }}
              >
                {t("graph.legend_hint")}
              </div>
            </>
          )}
        </div>

        {/* Detail panel */}
        <div
          className="rounded-xl border flex-shrink-0"
          style={{
            width: 320,
            background: "var(--bg-card)",
            borderColor: "var(--border)",
            minHeight: 200,
          }}
        >
          {!selectedNode && !loadingDetail && (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                style={{ background: "var(--bg-input)", color: "var(--text-faint)", fontSize: 16 }}
              >
                ◎
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("graph.detail_hint")}</p>
            </div>
          )}

          {loadingDetail && (
            <div className="flex items-center justify-center py-16">
              <span className="text-xs" style={{ color: "var(--text-faint)" }}>{t("common.loading")}</span>
            </div>
          )}

          {!loadingDetail && selectedNode && (
            <div className="p-4 space-y-4">
              {/* Node header */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <NodeTypePill type={selectedNode.node_type} />
                </div>
                <div className="font-semibold text-sm leading-snug" style={{ color: "var(--text)" }}>
                  {selectedNode.label}
                </div>
              </div>

              {/* Stable key */}
              <div>
                <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-faint)", letterSpacing: "0.07em" }}>
                  {t("graph.node_id")}
                </div>
                <div
                  className="text-xs px-2.5 py-1.5 rounded-md break-all"
                  style={{ background: "var(--bg)", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
                >
                  {selectedNode.stable_key ?? selectedNode.id}
                </div>
              </div>

              {/* Source path */}
              {selectedNode.metadata?.relative_path && (
                <div>
                  <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-faint)", letterSpacing: "0.07em" }}>
                    {t("graph.source_file")}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {selectedNode.metadata.relative_path}
                  </div>
                </div>
              )}

              {/* Source content + translate */}
              {selectedNode.content_snippet && (
                <div>
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-2">
                    {/* Source / Translation toggle */}
                    <div
                      className="flex items-center rounded-md p-0.5"
                      style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}
                    >
                      <button
                        onClick={() => setShowSource(true)}
                        className="text-xs px-2 py-0.5 rounded transition-all"
                        style={{
                          background: showSource ? "var(--primary)" : "transparent",
                          color: showSource ? "white" : "var(--text-muted)",
                        }}
                      >
                        {t("common.source")}
                      </button>
                      {translationResult && (
                        <button
                          onClick={() => setShowSource(false)}
                          className="text-xs px-2 py-0.5 rounded transition-all"
                          style={{
                            background: !showSource ? "var(--primary)" : "transparent",
                            color: !showSource ? "white" : "var(--text-muted)",
                          }}
                        >
                          {t("common.translation")}
                        </button>
                      )}
                    </div>

                    {/* Translate controls */}
                    <div className="flex items-center gap-1">
                      <select
                        value={translateLang}
                        onChange={(e) => setTranslateLang(e.target.value)}
                        disabled={translating}
                        className="text-xs rounded border px-1 py-0.5"
                        style={{
                          background: "var(--bg-input)",
                          borderColor: "var(--border)",
                          color: "var(--text-muted)",
                          height: 22,
                        }}
                      >
                        {[
                          { code: "en", labelKey: "translate_lang_en" },
                          { code: "zh", labelKey: "translate_lang_zh" },
                          { code: "ja", labelKey: "translate_lang_ja" },
                          { code: "ko", labelKey: "translate_lang_ko" },
                          { code: "fr", labelKey: "translate_lang_fr" },
                          { code: "de", labelKey: "translate_lang_de" },
                        ].map((l) => (
                          <option key={l.code} value={l.code}>{t(`graph.${l.labelKey}`)}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleTranslateNode}
                        disabled={translating}
                        className="text-xs px-2 py-0.5 rounded transition-colors flex items-center gap-1"
                        style={{
                          background: "var(--primary)",
                          color: "white",
                          opacity: translating ? 0.6 : 1,
                          height: 22,
                        }}
                      >
                        {translating ? (
                          <>
                            <span className="w-2.5 h-2.5 rounded-full border border-white/30 border-t-white animate-spin" />
                            {t("common.translating")}
                          </>
                        ) : t("common.translate")}
                      </button>
                    </div>
                  </div>

                  {/* Content area */}
                  <div
                    className="text-xs leading-relaxed whitespace-pre-wrap rounded-md px-2.5 py-2 max-h-64 overflow-y-auto"
                    style={{ background: "var(--bg)", color: "var(--text-muted)" }}
                  >
                    {showSource
                      ? selectedNode.content_snippet
                      : (translationResult?.text ?? "")}
                  </div>
                </div>
              )}

              {/* Edge summary */}
              {neighborhood && (
                <div
                  className="flex gap-4 pt-3 text-xs"
                  style={{ borderTop: "1px solid var(--border-light)", color: "var(--text-faint)" }}
                >
                  <span>{t("graph.outgoing")} <strong style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {neighborhood.edges?.filter((e: any) => e.source_id === selectedNode.id).length ?? 0}
                  </strong></span>
                  <span>{t("graph.incoming")} <strong style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {neighborhood.edges?.filter((e: any) => e.target_id === selectedNode.id).length ?? 0}
                  </strong></span>
                  <span>{t("graph.neighbor_count")} <strong style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {neighborhood.neighbor_count ?? 0}
                  </strong></span>
                </div>
              )}

              {/* Neighbors list */}
              {neighborhood && neighborhood.neighbors.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--text-faint)", letterSpacing: "0.07em" }}>
                    {t("graph.neighbors")}
                  </div>
                  <div className="space-y-1 max-h-52 overflow-y-auto">
                    {neighborhood.edges?.map((e: any, i: number) => {
                      const srcLabel = e.source_id === selectedNode.id
                        ? selectedNode.label
                        : neighborhood.neighbors.find((nb: any) => nb.id === e.source_id)?.label ?? e.source_id;
                      const tgtLabel = e.target_id === selectedNode.id
                        ? selectedNode.label
                        : neighborhood.neighbors.find((nb: any) => nb.id === e.target_id)?.label ?? e.target_id;
                      const neighbor = e.source_id === selectedNode.id
                        ? neighborhood.neighbors.find((nb: any) => nb.id === e.target_id)
                        : neighborhood.neighbors.find((nb: any) => nb.id === e.source_id);
                      return (
                        <button
                          key={e.id ?? i}
                          onClick={() => neighbor && handleSelectNode(neighbor)}
                          className="w-full text-left rounded-md px-2.5 py-2 text-xs transition-colors"
                          style={{ background: "var(--bg)" }}
                          onMouseEnter={(el) => (el.currentTarget.style.background = "var(--bg-hover)")}
                          onMouseLeave={(el) => (el.currentTarget.style.background = "var(--bg)")}
                        >
                          <span
                            className="inline-block mr-1.5 px-1.5 py-0.5 rounded text-xs"
                            style={{
                              background: "var(--bg-input)",
                              color: "#7a85ab",
                              fontSize: 10,
                            }}
                          >
                            {t(`graph.rel_${e.relation}`)}
                          </span>
                          <span style={{ color: "var(--text-muted)" }}>{srcLabel}</span>
                          <span style={{ color: "var(--text-faint)", margin: "0 4px" }}>→</span>
                          <span style={{ color: "var(--text)" }}>{tgtLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
