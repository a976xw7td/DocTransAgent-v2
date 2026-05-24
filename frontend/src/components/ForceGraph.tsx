"use client";

import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";

export interface GraphNode {
  id: string;
  node_type: string;
  label: string;
  stable_key?: string;
  doc_id?: string;
  content_snippet?: string;
  metadata?: any;
  // d3 simulation fields (mutable)
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphEdge {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  relation: string;
  weight?: number;
}

interface ForceGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId?: string | null;
  onSelectNode: (node: GraphNode) => void;
  width?: number;
  height?: number;
}

// Node type → colour mapping (Obsidian-ish palette)
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
const DEFAULT_COLOR = "#8b8fa8";

const RELATION_LABEL: Record<string, string> = {
  contains: "包含",
  links_to: "关联",
  tagged_with: "标记",
  alias_of: "别名",
  mentions: "引用",
  derived_from: "派生",
  translated_to: "翻译",
  has_heading: "标题",
};

const NODE_RADIUS: Record<string, number> = {
  note:     10,
  document: 10,
  heading:   7,
  tag:       6,
  alias:     5,
  wikilink_target: 5,
};
const DEFAULT_RADIUS = 6;

function nodeColor(type: string) { return TYPE_COLOR[type] ?? DEFAULT_COLOR; }
function nodeRadius(type: string) { return NODE_RADIUS[type] ?? DEFAULT_RADIUS; }

export default function ForceGraph({
  nodes,
  edges,
  selectedId,
  onSelectNode,
  width = 900,
  height = 600,
}: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);

  const draw = useCallback(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // ── Zoom layer ──────────────────────────────────────────────────
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    svg.call(zoom);

    const g = svg.append("g");

    // ── Arrow marker ────────────────────────────────────────────────
    svg.append("defs").append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -4 8 8")
      .attr("refX", 18)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-4L8,0L0,4")
      .attr("fill", "#3a3f5c");

    // ── Edges ───────────────────────────────────────────────────────
    const link = g.append("g")
      .selectAll<SVGLineElement, GraphEdge>("line")
      .data(edges)
      .join("line")
      .attr("stroke", "#2a2e45")
      .attr("stroke-width", 1.2)
      .attr("stroke-opacity", 0.55)
      .attr("marker-end", "url(#arrow)");

    // ── Edge labels ─────────────────────────────────────────────────
    const edgeLabel = g.append("g")
      .selectAll<SVGTextElement, GraphEdge>("text")
      .data(edges)
      .join("text")
      .text((d) => RELATION_LABEL[d.relation] ?? d.relation)
      .attr("font-size", 9)
      .attr("fill", "#5a6080")
      .attr("text-anchor", "middle")
      .attr("dy", -3)
      .style("pointer-events", "none")
      .style("user-select", "none");

    // ── Nodes ───────────────────────────────────────────────────────
    const nodeG = g.append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes, (d) => d.id)
      .join("g")
      .style("cursor", "pointer")
      .on("click", (_event, d) => { onSelectNode(d); })
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on("start", (event, d) => {
            event.sourceEvent.stopPropagation();
            if (!event.active) simRef.current?.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on("end", (event, d) => {
            if (!event.active) simRef.current?.alphaTarget(0);
            d.fx = null; d.fy = null;
          }) as any
      );

    // Outer glow ring for selected
    nodeG.append("circle")
      .attr("r", (d) => nodeRadius(d.node_type) + 5)
      .attr("fill", "none")
      .attr("stroke", (d) => d.id === selectedId ? nodeColor(d.node_type) : "none")
      .attr("stroke-width", 2.5)
      .attr("stroke-opacity", 0.5);

    // Main circle
    nodeG.append("circle")
      .attr("r", (d) => nodeRadius(d.node_type))
      .attr("fill", (d) => nodeColor(d.node_type))
      .attr("fill-opacity", (d) => d.id === selectedId ? 1 : 0.82)
      .attr("stroke", (d) => d.id === selectedId ? "#fff" : "transparent")
      .attr("stroke-width", 1.5);

    // Label
    nodeG.append("text")
      .text((d) => d.label.length > 18 ? d.label.slice(0, 16) + "…" : d.label)
      .attr("font-size", (d) => d.node_type === "note" || d.node_type === "document" ? 11 : 9)
      .attr("font-weight", (d) => d.node_type === "note" ? "600" : "400")
      .attr("fill", "#c8ccdf")
      .attr("dy", (d) => -(nodeRadius(d.node_type) + 4))
      .attr("text-anchor", "middle")
      .style("pointer-events", "none")
      .style("user-select", "none");

    // ── Simulation ──────────────────────────────────────────────────
    if (simRef.current) simRef.current.stop();

    const sim = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphEdge>(edges)
        .id((d) => d.id)
        .distance(90)
        .strength(0.4))
      .force("charge", d3.forceManyBody().strength(-220).distanceMax(400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<GraphNode>((d) => nodeRadius(d.node_type) + 8))
      .alphaDecay(0.025);

    simRef.current = sim;

    sim.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode).y ?? 0);

      edgeLabel
        .attr("x", (d) => (((d.source as GraphNode).x ?? 0) + ((d.target as GraphNode).x ?? 0)) / 2)
        .attr("y", (d) => (((d.source as GraphNode).y ?? 0) + ((d.target as GraphNode).y ?? 0)) / 2);

      nodeG.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // Initial fit after simulation settles
    sim.on("end", () => {
      if (!nodes.length) return;
      const xs = nodes.map((n) => n.x ?? 0);
      const ys = nodes.map((n) => n.y ?? 0);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const gw = maxX - minX || 1, gh = maxY - minY || 1;
      const scale = Math.min(0.9, 0.9 * Math.min(width / gw, height / gh));
      const tx = width / 2 - scale * (minX + gw / 2);
      const ty = height / 2 - scale * (minY + gh / 2);
      svg.transition().duration(600).call(
        zoom.transform,
        d3.zoomIdentity.translate(tx, ty).scale(scale)
      );
    });

    return () => { sim.stop(); };
  }, [nodes, edges, selectedId, width, height, onSelectNode]);

  useEffect(() => {
    const cleanup = draw();
    return () => { cleanup?.(); };
  }, [draw]);

  // Update selected ring without full redraw
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll<SVGCircleElement, GraphNode>("g > circle:first-child")
      .attr("stroke", (d) => d.id === selectedId ? nodeColor(d.node_type) : "none");
    svg.selectAll<SVGCircleElement, GraphNode>("g > circle:nth-child(2)")
      .attr("fill-opacity", (d) => d.id === selectedId ? 1 : 0.82)
      .attr("stroke", (d) => d.id === selectedId ? "#fff" : "transparent");
  }, [selectedId]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{ display: "block", background: "var(--bg)", borderRadius: 12 }}
    />
  );
}
