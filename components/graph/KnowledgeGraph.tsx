"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import type { ForceGraphMethods } from "react-force-graph-3d";
import type { GraphData, GraphLink, GraphNode } from "@/lib/types";

const ForceGraph3D = dynamic(
  () => import("./ForceGraph3DClient").then((m) => m.ForceGraph3DClient),
  { ssr: false }
);

export type KnowledgeGraphRef = {
  zoomToNode: (id: string) => void;
  resetCamera: () => void;
};

type Props = {
  data: GraphData;
  onNodeClick?: (node: GraphNode) => void;
  onNodeRightClick?: (node: GraphNode, ev: MouseEvent) => void;
  onBackgroundDblClick?: () => void;
  highlightIds: Set<string>;
  newNodeIds: Set<string>;
  hiddenCategoryIds: Set<string>;
  searchMatchIds: Set<string>;
  loading?: boolean;
};

export const KnowledgeGraph = forwardRef<KnowledgeGraphRef, Props>(function KnowledgeGraph(
  {
    data,
    onNodeClick,
    onNodeRightClick,
    onBackgroundDblClick,
    highlightIds,
    newNodeIds,
    hiddenCategoryIds,
    searchMatchIds,
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
        if (node.id === hover.current.n) return "#e2e8f0";
        if (hover.current.nbr.has(node.id)) return node.color;
        return "#334155";
      }
      return node.color;
    },
    [highlightIds, searchMatchIds]
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
      const nbr = new Set<string>();
      for (const l of filtered.links) {
        const s = String(l.source);
        const t = String(l.target);
        if (s === node.id) nbr.add(t);
        if (t === node.id) nbr.add(s);
      }
      hover.current = { n: node.id, nbr };
    },
    [filtered.links]
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
        onNodeClick={(n) => onNodeClick?.(n as GraphNode)}
        onNodeRightClick={
          onNodeRightClick ? (n, e) => onNodeRightClick(n as GraphNode, e) : undefined
        }
        onNodeHover={(n) => onNodeHover(n)}
        onBackgroundClick={() => {
          // single click: no-op; dbl on container
        }}
        linkColor={() => "rgba(148,163,184,0.45)"}
        linkWidth={(l) => 0.35 + 0.9 * (l as GraphLink).strength}
        linkDirectionalParticles={0}
        linkOpacity={0.5}
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
    </div>
  );
});
