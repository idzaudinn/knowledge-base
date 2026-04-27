"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import type { ForceGraphMethods } from "react-force-graph-3d";
import type { GraphData, GraphLink, GraphNode } from "@/lib/types";
import { createLabeledNode } from "./graph-node-three";

const ForceGraph3D = dynamic(
  () => import("./ForceGraph3DClient").then((m) => m.ForceGraph3DClient),
  { ssr: false }
);

function neighborIds(nodeId: string, links: GraphLink[]): Set<string> {
  const nbr = new Set<string>();
  for (const l of links) {
    const s = String(l.source);
    const t = String(l.target);
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
  const [tick, setTick] = useState(0);
  const filtered = useMemo(() => {
    const show = (n: GraphNode) => {
      if (!n.categoryId) return true;
      return !hiddenCategoryIds.has(n.categoryId);
    };
    const nodes = data.nodes.filter(show);
    const idSet = new Set(nodes.map((n) => n.id));
    const links = data.links.filter(
      (l) => idSet.has(String(l.source)) && idSet.has(String(l.target))
    );
    return { nodes, links };
  }, [data, hiddenCategoryIds]);

  const hover = useRef<{ n: string | null; nbr: Set<string> }>({ n: null, nbr: new Set() });

  const focusNbr = useMemo(
    () => (focusNodeId ? neighborIds(focusNodeId, filtered.links) : new Set<string>()),
    [focusNodeId, filtered.links]
  );
  const focusNodeLabel = useMemo(() => {
    if (!focusNodeId) return null;
    return filtered.nodes.find((n) => n.id === focusNodeId)?.label ?? null;
  }, [focusNodeId, filtered.nodes]);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 100);
    return () => clearInterval(t);
  }, []);

  const nodeColor = useCallback(
    (n: object) => {
      const node = n as GraphNode;
      if (searchMatchIds.size > 0 && !searchMatchIds.has(node.id)) {
        return "#1e293b";
      }
      if (highlightIds.has(node.id)) return "#fbbf24";
      if (hover.current.n) {
        if (node.id === hover.current.n) return "#f8fafc";
        return node.color;
      }
      if (focusNodeId) {
        if (node.id === focusNodeId) return "#f8fafc";
        return node.color;
      }
      return node.color;
    },
    [highlightIds, searchMatchIds, focusNodeId]
  );

  const nodeVal = useCallback(
    (n: object) => {
      const node = n as GraphNode;
      const base = 1 + (node.val || 1) * 0.3;
      if (newNodeIds.has(node.id)) {
        const t = (Date.now() % 1500) / 1500;
        return base * (0.5 + 0.5 * Math.min(1, t * 2.5));
      }
      return base + 0.08 * Math.sin(tick * 0.12 + (node.id.charCodeAt(0) % 7));
    },
    [newNodeIds, tick]
  );

  const onNodeHover = useCallback(
    (n: object | null) => {
      if (!n) {
        hover.current = { n: null, nbr: new Set() };
        return;
      }
      const node = n as GraphNode;
      hover.current = { n: node.id, nbr: neighborIds(node.id, filtered.links) };
    },
    [filtered.links]
  );

  const linkColor = useCallback(
    (l: object) => {
      if (searchMatchIds.size > 0) {
        return "rgba(148,163,184,0.45)";
      }
      const link = l as GraphLink;
      const s = String(link.source);
      const t = String(link.target);
      if (hover.current.n) {
        if (isEdgeBetweenCenterAndNeighbor(s, t, hover.current.n, hover.current.nbr)) {
          return "rgba(56,189,248,1)";
        }
        return "rgba(51,65,85,0.12)";
      }
      if (focusNodeId) {
        if (isEdgeBetweenCenterAndNeighbor(s, t, focusNodeId, focusNbr)) {
          return "rgba(56,189,248,1)";
        }
        return "rgba(51,65,85,0.12)";
      }
      return "rgba(148,163,184,0.45)";
    },
    [searchMatchIds, focusNodeId, focusNbr]
  );

  const linkWidth = useCallback(
    (l: object) => {
      const link = l as GraphLink;
      const base = 0.35 + 0.9 * (link.strength || 0);
      const s = String(link.source);
      const t = String(link.target);
      if (searchMatchIds.size > 0) {
        return base;
      }
      if (hover.current.n) {
        if (isEdgeBetweenCenterAndNeighbor(s, t, hover.current.n, hover.current.nbr)) {
          return base + 0.9;
        }
        return Math.max(0.2, base * 0.3);
      }
      if (focusNodeId) {
        if (isEdgeBetweenCenterAndNeighbor(s, t, focusNodeId, focusNbr)) {
          return base + 0.9;
        }
        return Math.max(0.2, base * 0.3);
      }
      return base;
    },
    [searchMatchIds, focusNodeId, focusNbr]
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
        linkOpacity={0.75}
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
