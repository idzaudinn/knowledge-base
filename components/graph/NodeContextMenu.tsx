"use client";

import { Pencil, Search, Trash2, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { GraphNode } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFindRelated: () => void;
  node: GraphNode | null;
};

export function NodeContextMenu({
  open,
  x,
  y,
  onClose,
  onEdit,
  onDelete,
  onFindRelated,
  node,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [open, onClose]);
  if (!open || !node) return null;
  return (
    <div
      ref={ref}
      className={cn("fixed z-[100] min-w-[180px] rounded-md border border-slate-600 bg-slate-900/98 p-1 shadow-xl")}
      style={{ left: Math.min(x, typeof window !== "undefined" ? window.innerWidth - 200 : x), top: y }}
    >
      <div className="flex items-center justify-between border-b border-slate-800 px-2 py-1 text-xs text-slate-400">
        <span className="truncate pr-1">{node.label}</span>
        <button type="button" onClick={onClose} className="rounded p-0.5 hover:bg-slate-800">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex flex-col gap-0.5 p-1">
        <Button type="button" variant="ghost" className="h-8 justify-start gap-2" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
        <Button type="button" variant="ghost" className="h-8 justify-start gap-2" onClick={onFindRelated}>
          <Search className="h-3.5 w-3.5" />
          Find related
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-8 justify-start gap-2 text-red-300 hover:text-red-200"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    </div>
  );
}
