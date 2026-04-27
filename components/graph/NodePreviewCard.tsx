"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { NodeWithCategory } from "@/lib/types";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  node: NodeWithCategory | null;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  className?: string;
  compact?: boolean;
};

export function NodePreviewCard({ node, onEdit, onDelete, onClose, className, compact }: Props) {
  if (!node) return null;
  return (
    <Card
      className={cn(
        "flex h-full min-h-0 min-w-0 max-w-sm flex-col border-slate-800/80 bg-slate-950 p-0 shadow-sm",
        compact ? "max-h-[38vh] w-full max-w-full" : "w-full max-w-sm shrink-0",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 px-3 py-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-slate-100">{node.label}</h2>
          <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">{node.id}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose} aria-label="Deselect">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ScrollArea className="max-h-[40vh] min-h-[120px] flex-1 px-3 py-2 md:max-h-none">
        <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-200">{node.content || "—"}</p>
      </ScrollArea>
      <div className="flex flex-wrap gap-2 border-t border-slate-800/80 px-3 py-2">
        <Button type="button" size="sm" variant="secondary" onClick={onEdit} className="h-8">
          Edit
        </Button>
        <Button type="button" size="sm" variant="destructive" onClick={onDelete} className="h-8">
          Delete
        </Button>
      </div>
    </Card>
  );
}
