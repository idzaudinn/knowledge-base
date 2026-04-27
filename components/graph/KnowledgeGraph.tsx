"use client";

import dynamic from "next/dynamic";
import { useCallback, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import type { ForceGraphMethods } from "react-force-graph-3d";
import type { GraphData, GraphLink, GraphNode } from "@/lib/types";
import { createLabeledNode } from "./graph-node-three";

const ForceGraph3D = dynamic(
  () => import("./ForceGraph3DClient").then((m) => m.ForceGraph3DClient),
  { ssr: false }
);

/** After the force simulation runs, link.source/target are often node object refs, not id strings. */
function linkEndpointId(u: unknown): string {
  if (u == null) return "";
  if (typeof u === "string" || typeof u === "number") return String(u);
  if (typeof u === "object" && "id" in u) return String((u as { id: string }).id);
  return String(u);
}

function neighborIds(nodeId: string, links: GraphLink[]): Set<string> {
  const nbr = new Set<string>();
  for (const l of links) {
    const s = linkEndpointId(l.source);
    const t = linkEndpointId(l.target);
    if (s === nodeId) nbr.add(t);
    if (t === nodeId) nbr.add(s);
  }
  return nbr;
}

function isEdgeBetweenCenterAndNeighbor(
  sourceId: string,
  targetId: string,
  centerId: string,
  nbr: Set<string>
): boolean {
  return (sourceId === centerId && nbr.has(targetId)) || (targetId === centerId && nbr.has(sourceId));
}

export type KnowledgeGraphRef = {
  zoomToNode: (id: string) => void;
  resetCamera: () => void;
};

type Props = {
  data: GraphData;
  onNodeClick?: (node: GraphNode) => void;
  onNodeRightClick?: (node: GraphNode, ev: MouseEvent) => void;
  onBackgroundClick?: () => void;
  onBackgroundDblClick?: () => void;
  highlightIds: Set<string>;
  newNodeIds: Set<string>;
  hiddenCategoryIds: Set<string>;
  searchMatchIds: Set<string>;
  /** When set, node + 1-hop neighbors stay vivid (same as hover) until cleared. */
  focusNodeId?: string | null;
  loading?: boolean;
};

export const KnowledgeGraph = forwardRef<KnowledgeGraphRef, Props>(function KnowledgeGraph(
  {
    data,
    onNodeClick,
    onNodeRightClick,
    onBackgroundClick,
    onBackgroundDblClick,
    highlightIds,
    newNodeIds,
    hiddenCategoryIds,
    searchMatchIds,
    focusNodeId = null,
    loading,
  },
  ref
) {
  const [dim, setDim] = useState({ w: 800, h: 500 });
  const fgRef = useRef<ForceGraphMethods | null>(null);
  /** Hovered node + 1-hop; state (not a ref) so link accessors stay in sync, without thrashing like the old 100ms tick. */
  const [hoverHalo, setHoverHalo] = useState<{ id: string; nbr: Set<string> } | null>(null);
  const filtered = useMemo(() => {
    const show = (n: GraphNode) => {
      if (!n.categoryId) return true;
      return !hiddenCategoryIds.has(n.categoryId);
    };
    const nodes = data.nodes.filter(show);
    const idSet = new Set(nodes.map((n) => n.id));
    const links = data.links.filter(
      (l) => idSet.has(linkEndpointId(l.source)) && idSet.has(linkEndpointId(l.target))
    );
    return { nodes, links };
  }, [data, hiddenCategoryIds]);

  const focusNbr = useMemo(
    () => (focusNodeId ? neighborIds(focusNodeId, filtered.links) : new Set<string>()),
    [focusNodeId, filtered.links]
  );
  const focusNodeLabel = useMemo(() => {
    if (!focusNodeId) return null;
    return filtered.nodes.find((n) => n.id === focusNodeId)?.label ?? null;
  }, [focusNodeId, filtered.nodes]);

  const nodeColor = useCallback(
    (n: object) => {
      const node = n as GraphNode;
      if (searchMatchIds.size > 0 && !searchMatchIds.has(node.id)) {
        return "#1e293b";
      }
      if (highlightIds.has(node.id)) return "#fbbf24";
      if (hoverHalo) {
        if (node.id === hoverHalo.id) return "#f8fafc";
        return node.color;
      }
      if (focusNodeId) {
        if (node.id === focusNodeId) return "#f8fafc";
        return node.color;
      }
      return node.color;
    },
    [highlightIds, searchMatchIds, focusNodeId, hoverHalo]
  );

  const nodeVal = useCallback(
    (n: object) => {
      const node = n as GraphNode;
      const base = 1 + (node.val || 1) * 0.3;
      if (newNodeIds.has(node.id)) {
        const t = (Date.now() % 1500) / 1500;
        return base * (0.5 + 0.5 * Math.min(1, t * 2.5));
      }
      return base;
    },
    [newNodeIds]
  );

  const onNodeHover = useCallback(
    (n: object | null) => {
      if (!n) {
        setHoverHalo((prev) => (prev == null ? prev : null));
        return;
      }
      const node = n as GraphNode;
      const id = node.id;
      const nbr = neighborIds(id, filtered.links);
      setHoverHalo((prev) => {
        if (prev && prev.id === id) {
          if (prev.nbr.size === nbr.size) {
            let same = true;
            for (const x of nbr) {
              if (!prev.nbr.has(x)) {
                same = false;
                break;
              }
            }
            if (same) return prev;
          }
        }
        return { id, nbr };
      });
    },
    [filtered.links]
  );

  const linkColor = useCallback(
    (l: object) => {
      // Default + search: lighter slate so thin lines read on dark bg
      if (searchMatchIds.size > 0) {
        return "rgba(186, 201, 222, 0.78)";
      }
      const link = l as GraphLink;
      const s = linkEndpointId((link as { source: unknown }).source);
      const t = linkEndpointId((link as { target: unknown }).target);
      if (hoverHalo) {
        if (isEdgeBetweenCenterAndNeighbor(s, t, hoverHalo.id, hoverHalo.nbr)) {
          return "rgb(34, 211, 238)";
        }
        // Non-highlight: still visible, not near-black
        return "rgba(148, 163, 184, 0.62)";
      }
      if (focusNodeId) {
        if (isEdgeBetweenCenterAndNeighbor(s, t, focusNodeId, focusNbr)) {
          return "rgb(34, 211, 238)";
        }
        return "rgba(148, 163, 184, 0.62)";
      }
      return "rgba(186, 201, 222, 0.78)";
    },
    [searchMatchIds, focusNodeId, focusNbr, hoverHalo]
  );

  const linkWidth = useCallback(
    (l: object) => {
      const link = l as GraphLink;
      const base = 0.35 + 0.9 * (link.strength || 0);
      const s = linkEndpointId((link as { source: unknown }).source);
      const t = linkEndpointId((link as { target: unknown }).target);
      if (searchMatchIds.size > 0) {
        return base;
      }
      if (hoverHalo) {
        if (isEdgeBetweenCenterAndNeighbor(s, t, hoverHalo.id, hoverHalo.nbr)) {
          return base + 0.9;
        }
        return Math.max(0.5, base * 0.55);
      }
      if (focusNodeId) {
        if (isEdgeBetweenCenterAndNeighbor(s, t, focusNodeId, focusNbr)) {
          return base + 0.9;
        }
        return Math.max(0.5, base * 0.55);
      }
      return base;
    },
    [searchMatchIds, focusNodeId, focusNbr, hoverHalo]
  );

  useImperativeHandle(
    ref,
    () => ({
      zoomToNode: (id: string) => {
        fgRef.current?.zoomToFit(600, 60, (n) => (n as GraphNode).id === id);
      },
      resetCamera: () => {
        fgRef.current?.zoomToFit(400, 40);
        fgRef.current?.cameraPosition({ x: 0, y: 0, z: 280 } as { x: number; y: number; z: number });
      },
    }),
    []
  );

  const nodeThreeObject = useCallback(
    (o: object) => {
      const n = o as GraphNode;
      return createLabeledNode(n, {
        meshColor: nodeColor(n),
        size: nodeVal(n),
      });
    },
    [nodeColor, nodeVal]
  );

  return (
    <div
      className="relative h-full w-full min-h-[200px] overflow-hidden rounded-lg border border-slate-800/80 bg-[#0b0f1a]/90"
      onDoubleClick={(e) => {
        e.preventDefault();
        onBackgroundDblClick?.();
      }}
      ref={(el) => {
        if (!el) return;
        const r = new ResizeObserver(() => {
          setDim({ w: el.clientWidth, h: el.clientHeight });
        });
        r.observe(el);
        return () => r.disconnect();
      }}
    >
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm">
          <p className="text-sm text-slate-300">Thinking with your graph…</p>
        </div>
      )}
      <ForceGraph3D
        ref={fgRef}
        width={dim.w}
        height={dim.h}
        graphData={filtered}
        nodeId="id"
        linkSource="source"
        linkTarget="target"
        nodeLabel={(n) => (n as GraphNode).label}
        linkLabel={(l) => (l as GraphLink).label}
        nodeColor={nodeColor}
        nodeVal={nodeVal}
        nodeThreeObject={nodeThreeObject}
        onNodeClick={(n) => onNodeClick?.(n as GraphNode)}
        onNodeRightClick={
          onNodeRightClick ? (n, e) => onNodeRightClick(n as GraphNode, e) : undefined
        }
        onNodeHover={(n) => onNodeHover(n)}
        onBackgroundClick={() => onBackgroundClick?.()}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkDirectionalParticles={0}
        linkOpacity={0.9}
        backgroundColor="rgba(11, 15, 26, 0.95)"
        showNavInfo={false}
        cooldownTicks={120}
        d3AlphaDecay={0.022}
        d3VelocityDecay={0.35}
        enableNodeDrag
        enablePointerInteraction
      />
      <div className="pointer-events-none absolute left-2 top-2 max-w-[220px] rounded border border-slate-700/50 bg-slate-900/80 px-2 py-1 text-xs text-slate-400">
        <div>Drag: rotate · Scroll: zoom</div>
        <div>Drag node: move · Double-click: reset view</div>
      </div>
      {focusNodeLabel && (
        <div className="pointer-events-none absolute left-2 top-[52px] max-w-[260px] rounded border border-sky-400/35 bg-slate-950/85 px-2 py-1 text-xs text-slate-200">
          Selected: <span className="text-sky-300">{focusNodeLabel}</span>
        </div>
      )}
    </div>
  );
});
