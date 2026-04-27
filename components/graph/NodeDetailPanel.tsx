"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Category, GraphData, NodeWithCategory } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  node: NodeWithCategory | null;
  categories: Category[];
  graph: GraphData;
  onSaved: () => void;
  onDeleted: () => void;
};

function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

export function NodeDetailPanel({
  open,
  onOpenChange,
  node,
  categories,
  graph,
  onSaved,
  onDeleted,
}: Props) {
  const [label, setLabel] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (node) {
      setLabel(node.label);
      setContent(node.content);
      setCategoryId(node.category_id);
    }
  }, [node]);

  if (!node) return null;

  const neighbors: { id: string; label: string; rel: string; dir: "out" | "in" }[] = [];
  for (const l of graph.links) {
    if (l.source === node.id) {
      const t = graph.nodes.find((n) => n.id === l.target);
      if (t) neighbors.push({ id: t.id, label: t.label, rel: l.label, dir: "out" });
    }
    if (l.target === node.id) {
      const s = graph.nodes.find((n) => n.id === l.source);
      if (s) neighbors.push({ id: s.id, label: s.label, rel: l.label, dir: "in" });
    }
  }

  const save = async () => {
    if (!isSupabaseConfigured()) {
      toast.error("Supabase is not configured");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/nodes/${node.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.slice(0, 500),
          content,
          category_id: categoryId,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Save failed");
      }
      toast.success("Node saved");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!isSupabaseConfigured()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/nodes/${node.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Node removed");
      onDeleted();
      setConfirm(false);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-full max-w-md flex-col overflow-y-auto border-slate-800">
          <SheetHeader>
            <SheetTitle>Node</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-1 flex-col gap-3">
            <div>
              <label className="text-xs text-slate-400">Label</label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Content</label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="mt-1 min-h-[140px]"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Category</label>
              <Select
                value={categoryId ?? "none"}
                onValueChange={(v) => setCategoryId(v === "none" ? null : v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">(none)</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-slate-500">Created: {fmtDate(node.created_at)}</p>
            <div>
              <p className="text-xs text-slate-400">Connected</p>
              <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto text-sm text-slate-300">
                {neighbors.length === 0 && <li className="text-slate-500">No edges yet</li>}
                {neighbors.map((n) => (
                  <li key={n.id + n.dir}>
                    {n.dir === "out" ? "→" : "←"} {n.label}{" "}
                    <span className="text-slate-500">({n.rel})</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-auto flex flex-wrap gap-2 pt-4">
              <Button onClick={save} disabled={saving}>
                Save changes
              </Button>
              <Button type="button" variant="destructive" onClick={() => setConfirm(true)} disabled={saving}>
                Delete
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this node?</DialogTitle>
            <DialogDescription>
              This removes the node and its connected edges. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void del()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
