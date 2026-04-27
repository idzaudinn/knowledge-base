"use client";

import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  nodeCount: number;
  edgeCount: number;
  categories: Category[];
  className?: string;
};

export function BottomBar({ nodeCount, edgeCount, categories, className }: Props) {
  return (
    <footer
      className={cn(
        "flex flex-wrap items-center gap-4 border-t border-slate-800/80 bg-slate-950/60 px-3 py-2 text-xs text-slate-400",
        className
      )}
    >
      <span>
        Nodes: <strong className="text-slate-200">{nodeCount}</strong>
      </span>
      <span>
        Edges: <strong className="text-slate-200">{edgeCount}</strong>
      </span>
      <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
        <span className="text-slate-500">Categories:</span>
        {categories.length === 0 && <span className="text-slate-500">(none yet)</span>}
        {categories.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/60 px-2 py-0.5"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: c.color }}
              title={c.name}
            />
            {c.name}
          </span>
        ))}
      </div>
    </footer>
  );
}
