"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

type KnowledgeBaseTab = {
  id: string;
  name: string;
};

type Props = {
  search: string;
  onSearchChange: (s: string) => void;
  categories: Category[];
  hiddenCategoryIds: Set<string>;
  onToggleCategory: (id: string, shown: boolean) => void;
  knowledgeBases: KnowledgeBaseTab[];
  activeKnowledgeBaseId: string;
  onSwitchKnowledgeBase: (id: string) => void;
  onCreateKnowledgeBase: () => void;
  onClearAll: () => void;
  clearAllDisabled?: boolean;
  className?: string;
};

export function GraphControls({
  search,
  onSearchChange,
  categories,
  hiddenCategoryIds,
  onToggleCategory,
  knowledgeBases,
  activeKnowledgeBaseId,
  onSwitchKnowledgeBase,
  onCreateKnowledgeBase,
  onClearAll,
  clearAllDisabled,
  className,
}: Props) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-md border border-slate-800/80 bg-slate-900/50 p-2", className)}>
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {knowledgeBases.map((kb) => {
          const active = kb.id === activeKnowledgeBaseId;
          return (
            <Button
              key={kb.id}
              type="button"
              size="sm"
              variant={active ? "default" : "secondary"}
              className={cn("h-7 shrink-0 rounded-full px-3 text-xs", !active && "bg-slate-800/80")}
              onClick={() => onSwitchKnowledgeBase(kb.id)}
            >
              {kb.name}
            </Button>
          );
        })}
        <Button type="button" size="sm" variant="outline" className="h-7 shrink-0 px-2 text-xs" onClick={onCreateKnowledgeBase}>
          + New
        </Button>
      </div>
      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="h-7 text-xs"
          onClick={onClearAll}
          disabled={clearAllDisabled}
        >
          Clear all
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          className="pl-8"
          placeholder="Filter nodes in graph…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      {categories.length > 0 && (
        <div className="max-h-28 overflow-y-auto pr-1">
          <p className="mb-1 text-xs text-slate-500">Hide categories from graph</p>
          <div className="flex flex-col gap-1.5">
            {categories.map((c) => {
              const hidden = hiddenCategoryIds.has(c.id);
              return (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 text-xs text-slate-300"
                >
                  <Checkbox
                    checked={!hidden}
                    onCheckedChange={(v) => onToggleCategory(c.id, v === true)}
                    id={`cat-${c.id}`}
                  />
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: c.color }}
                    aria-hidden
                  />
                  <span className="truncate">{c.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
