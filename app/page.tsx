"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { KnowledgeGraph, type KnowledgeGraphRef } from "@/components/graph/KnowledgeGraph";
import { NodeDetailPanel } from "@/components/graph/NodeDetailPanel";
import { NodePreviewCard } from "@/components/graph/NodePreviewCard";
import { GraphControls } from "@/components/graph/GraphControls";
import { NodeContextMenu } from "@/components/graph/NodeContextMenu";
import { ChatPanel, type UiMessage } from "@/components/chat/ChatPanel";
import { ResizablePanels } from "@/components/layout/ResizablePanels";
import { Header } from "@/components/layout/Header";
import { BottomBar } from "@/components/layout/BottomBar";
import { useKnowledgeData } from "@/hooks/use-knowledge-data";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { GraphNode, NodeWithCategory } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function randomId() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalize(s: string) {
  return s.trim().toLowerCase();
}

type KnowledgeBaseTab = { id: string; name: string };

const KB_ACTIVE_KEY = "kb.active.v1";

function validKbName(value: string) {
  return value.trim().length >= 2 && value.trim().length <= 40;
}

export default function Home() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseTab[]>([]);
  const [activeKbId, setActiveKbId] = useState("");
  const { status, error, nodes, edges, categories, graphData, refetch } = useKnowledgeData(activeKbId);
  const [mode, setMode] = useState<"feed" | "ask">("feed");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [selected, setSelected] = useState<NodeWithCategory | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [hiddenCat, setHiddenCat] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState("");
  const [hl, setHl] = useState<Set<string>>(() => new Set());
  const [newIds, setNewIds] = useState<Set<string>>(() => new Set());
  const graphRef = useRef<KnowledgeGraphRef | null>(null);
  const [ctx, setCtx] = useState<{ node: GraphNode; x: number; y: number } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isNarrow, setNarrow] = useState(false);
  const [createKbOpen, setCreateKbOpen] = useState(false);
  const [newKbName, setNewKbName] = useState("");
  const [clearAllOpen, setClearAllOpen] = useState(false);

  useEffect(() => {
    const q = () => setNarrow(typeof window !== "undefined" && window.innerWidth < 900);
    q();
    window.addEventListener("resize", q);
    return () => window.removeEventListener("resize", q);
  }, []);

  useEffect(() => {
    const loadKnowledgeBases = async () => {
      try {
        const res = await fetch("/api/knowledge-bases");
        const j = (await res.json().catch(() => ({}))) as {
          knowledgeBases?: Array<{ id: string; name: string }>;
          error?: string;
        };
        if (!res.ok) throw new Error(j.error || "Could not load knowledge bases");
        const rows = (j.knowledgeBases ?? []).filter(
          (row) => typeof row.id === "string" && typeof row.name === "string" && row.name.trim().length > 0
        );
        setKnowledgeBases(rows.map((row) => ({ id: row.id, name: row.name.trim() })));
        if (!rows.length) {
          setActiveKbId("");
          return;
        }
        const savedActive = typeof window !== "undefined" ? window.localStorage.getItem(KB_ACTIVE_KEY) : null;
        const resolved = rows.find((x) => x.id === savedActive)?.id ?? rows[0].id;
        setActiveKbId(resolved);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load knowledge bases");
      }
    };
    void loadKnowledgeBases();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!activeKbId) return;
    window.localStorage.setItem(KB_ACTIVE_KEY, activeKbId);
  }, [activeKbId]);

  useEffect(() => {
    setSelected(null);
    setPanelOpen(false);
    setCtx(null);
    setSearch("");
    setHl(new Set());
    setNewIds(new Set());
  }, [activeKbId]);

  const loadChat = useCallback(async () => {
    if (!isSupabaseConfigured() || !activeKbId) {
      setMessages([]);
      return;
    }
    const supabase = getSupabaseBrowser();
    const { data, error: err } = await supabase
      .from("chat_history")
      .select("id, role, content, message_type, created_at")
      .eq("knowledge_base_id", activeKbId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (err) return;
    if (!data?.length) {
      setMessages([]);
      return;
    }
    setMessages(
      data.map(
        (r) =>
          ({
            id: (r as { id: string }).id,
            role: (r as { role: "user" | "assistant" }).role,
            content: (r as { content: string }).content,
            messageType: (r as { message_type: "feed" | "question" | "system" }).message_type,
          }) satisfies UiMessage
      )
    );
  }, [activeKbId]);

  useEffect(() => {
    void loadChat();
  }, [loadChat]);

  const searchMatchIds = useMemo(() => {
    if (!search.trim()) return new Set<string>();
    const q = normalize(search);
    const s = new Set<string>();
    for (const n of graphData.nodes) {
      if (normalize(n.label).includes(q) || n.content.toLowerCase().includes(q)) {
        s.add(n.id);
      }
    }
    return s;
  }, [search, graphData.nodes]);

  const send = useCallback(async () => {
    const t = input.trim();
    if (!t || busy || !activeKbId) return;
    setBusy(true);
    setInput("");
    setMessages((m) => [
      ...m,
      {
        id: randomId(),
        role: "user",
        content: t,
        messageType: mode === "feed" ? "feed" : "question",
      },
    ]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: t, mode, kbId: activeKbId }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        answer?: string;
        referencedNodeIds?: string[];
        created?: string[];
        summary?: string;
        mode?: string;
      };
      if (!res.ok) {
        throw new Error(j.error || "Request failed");
      }
      if (mode === "ask" && j.answer) {
        setMessages((m) => [
          ...m,
          { id: randomId(), role: "assistant", content: j.answer ?? "", messageType: "question" },
        ]);
        if (j.referencedNodeIds?.length) {
          setHl(new Set(j.referencedNodeIds));
          setTimeout(() => setHl(new Set()), 12000);
        }
      } else if (mode === "feed") {
        const line = j.summary
          ? `✅ ${j.summary}

Created: ${(j.created ?? []).join(", ") || "—"}.`
          : "Knowledge updated.";
        setMessages((m) => [
          ...m,
          { id: randomId(), role: "assistant", content: line, messageType: "feed" },
        ]);
        const r = await refetch();
        if (j.created?.length) {
          const nset = new Set<string>();
          for (const la of j.created) {
            const f = r.nodes.find((x) => normalize(x.label) === normalize(la));
            if (f) nset.add(f.id);
          }
          if (nset.size) {
            setNewIds(nset);
            setTimeout(() => {
              const first = Array.from(nset)[0];
              if (first) graphRef.current?.zoomToNode(first);
            }, 300);
            setTimeout(() => setNewIds(new Set()), 5000);
          }
        }
      }
      void loadChat();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
      setMessages((m) => [
        ...m,
        {
          id: randomId(),
          role: "assistant",
          content: e instanceof Error ? e.message : "Error",
          messageType: "system",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }, [input, busy, mode, refetch, loadChat, activeKbId]);

  const resolveNode = useCallback(
    (g: GraphNode) => {
      return nodes.find((n) => n.id === g.id) ?? null;
    },
    [nodes]
  );

  const focusSearch = useCallback(() => {
    const first = Array.from(searchMatchIds)[0];
    if (first) graphRef.current?.zoomToNode(first);
  }, [searchMatchIds]);

  useEffect(() => {
    if (!search.trim() || searchMatchIds.size === 0) return;
    const t = setTimeout(focusSearch, 600);
    return () => clearTimeout(t);
  }, [search, searchMatchIds, focusSearch]);

  const onToggleCategory = (id: string, shown: boolean) => {
    setHiddenCat((prev) => {
      const n = new Set(prev);
      if (shown) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const createKnowledgeBase = async () => {
    const cleanName = newKbName.trim();
    if (!validKbName(cleanName)) {
      toast.error("Knowledge base name must be 2 to 40 characters.");
      return;
    }
    try {
      const res = await fetch("/api/knowledge-bases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanName }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        knowledgeBase?: { id: string; name: string };
      };
      if (!res.ok || !j.knowledgeBase) throw new Error(j.error || "Could not create knowledge base");
      setKnowledgeBases((prev) => [...prev, { id: j.knowledgeBase!.id, name: j.knowledgeBase!.name }]);
      setActiveKbId(j.knowledgeBase.id);
      setNewKbName("");
      setCreateKbOpen(false);
      toast.success(`Switched to "${j.knowledgeBase.name}"`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create knowledge base");
    }
  };

  const clearAllKnowledge = useCallback(async () => {
    if (!isSupabaseConfigured() || !activeKbId) {
      toast.error("Supabase is not configured");
      return;
    }
    if (!nodes.length) {
      toast("This knowledge base is already empty.");
      setClearAllOpen(false);
      return;
    }
    try {
      const supabase = getSupabaseBrowser();
      const { error: delErr } = await supabase.from("nodes").delete().eq("knowledge_base_id", activeKbId);
      if (delErr) throw delErr;
      const ids = nodes.map((n) => n.id);
      toast.success(`Deleted ${ids.length} node${ids.length > 1 ? "s" : ""}`);
      setSelected(null);
      setPanelOpen(false);
      setCtx(null);
      setHl(new Set());
      setNewIds(new Set());
      setClearAllOpen(false);
      void refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not clear this knowledge base");
    }
  }, [activeKbId, nodes, refetch]);

  const deleteSelectedNode = useCallback(async () => {
    if (!selected) return;
    const res = await fetch(`/api/nodes/${selected.id}?kbId=${encodeURIComponent(activeKbId)}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Node deleted");
      setPanelOpen(false);
      setSelected(null);
      setCtx(null);
      void refetch();
    } else {
      toast.error("Could not delete");
    }
  }, [activeKbId, refetch, selected]);

  const leftPanel = (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2 pl-0">
      <GraphControls
        search={search}
        onSearchChange={setSearch}
        categories={categories}
        hiddenCategoryIds={hiddenCat}
        onToggleCategory={onToggleCategory}
        knowledgeBases={knowledgeBases}
        activeKnowledgeBaseId={activeKbId}
        onSwitchKnowledgeBase={setActiveKbId}
        onCreateKnowledgeBase={() => setCreateKbOpen(true)}
        onClearAll={() => setClearAllOpen(true)}
        clearAllDisabled={nodes.length === 0}
        className="z-20"
      />
      <div
        className={
          isNarrow
            ? "flex min-h-0 w-full min-w-0 flex-1 flex-col gap-2"
            : "flex min-h-0 w-full min-w-0 flex-1 flex-row gap-2"
        }
      >
        {selected && (
          <NodePreviewCard
            node={selected}
            compact={isNarrow}
            onClose={() => {
              setSelected(null);
              setPanelOpen(false);
            }}
            onEdit={() => setPanelOpen(true)}
            onDelete={() => void deleteSelectedNode()}
            className={isNarrow ? "max-h-[38vh] shrink-0" : "self-stretch"}
          />
        )}
        <div className="min-h-0 min-w-0 flex-1">
          <KnowledgeGraph
            ref={graphRef}
            data={graphData}
            onNodeClick={(n) => {
              const w = resolveNode(n);
              if (w) {
                setSelected(w);
                setPanelOpen(false);
              }
              setCtx(null);
            }}
            onNodeRightClick={(n, ev) => {
              ev.preventDefault();
              setCtx({ node: n, x: (ev as MouseEvent).clientX, y: (ev as MouseEvent).clientY });
              setPanelOpen(false);
            }}
            onBackgroundClick={() => {
              setSelected(null);
              setPanelOpen(false);
            }}
            onBackgroundDblClick={() => graphRef.current?.resetCamera()}
            highlightIds={hl}
            newNodeIds={newIds}
            hiddenCategoryIds={hiddenCat}
            searchMatchIds={searchMatchIds}
            focusNodeId={selected?.id ?? null}
            loading={busy}
          />
        </div>
      </div>
    </div>
  );

  const chatBlock = (
    <Card className="flex h-full min-h-0 flex-col border-slate-800/60 bg-slate-950/40 p-3">
      <ChatPanel
        messages={messages}
        mode={mode}
        onModeChange={setMode}
        input={input}
        onInput={setInput}
        onSend={send}
        busy={busy}
        compact={isNarrow}
      />
    </Card>
  );

  if (error && status === "error") {
    return (
      <div className="min-h-screen bg-[#0c101b] p-6 text-slate-200">
        <p className="text-red-300">{error}</p>
        <p className="mt-2 text-sm text-slate-400">
          Copy <code className="rounded bg-slate-800 px-1">.env.example</code> to{" "}
          <code className="rounded bg-slate-800 px-1">.env.local</code> and add Supabase + Anthropic keys. Run
          the SQL in <code className="rounded bg-slate-800 px-1">supabase/schema.sql</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#0c101b] text-slate-100">
      <Header activeKnowledgeBaseId={activeKbId} onImportResult={() => void refetch()} />
      <Separator className="bg-slate-800/50" />
      <div className="min-h-0 flex-1">
        {!isNarrow ? (
          <ResizablePanels
            defaultLeft={65}
            left={leftPanel}
            right={
              <div className="flex h-full p-2 pr-3 pt-0">
                {chatBlock}
              </div>
            }
          />
        ) : (
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1 p-2">
              {leftPanel}
            </div>
            <div className="p-2 pt-0">
              <Button
                type="button"
                className="w-full gap-2 bg-slate-800/90"
                onClick={() => setMobileOpen(true)}
              >
                <MessageCircle className="h-4 w-4" />
                Open chat
              </Button>
            </div>
          </div>
        )}
      </div>
      <BottomBar
        nodeCount={nodes.length}
        edgeCount={edges.length}
        categories={categories}
        className="shrink-0"
      />
      <NodeContextMenu
        open={!!ctx}
        x={ctx?.x ?? 0}
        y={ctx?.y ?? 0}
        onClose={() => setCtx(null)}
        node={ctx?.node ?? null}
        onEdit={() => {
          if (!ctx) return;
          const w = resolveNode(ctx.node);
          if (w) {
            setSelected(w);
            setPanelOpen(true);
          }
          setCtx(null);
        }}
        onFindRelated={() => {
          if (!ctx) return;
          graphRef.current?.zoomToNode(ctx.node.id);
          setCtx(null);
        }}
        onDelete={async () => {
          if (!ctx) return;
          const id = ctx.node.id;
          setCtx(null);
          const res = await fetch(`/api/nodes/${id}?kbId=${encodeURIComponent(activeKbId)}`, { method: "DELETE" });
          if (res.ok) {
            toast.success("Node deleted");
            void refetch();
            setPanelOpen(false);
            setSelected(null);
          } else {
            toast.error("Could not delete");
          }
        }}
      />
      <NodeDetailPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        node={selected}
        categories={categories}
        graph={graphData}
        onSaved={() => void refetch()}
        onDeleted={() => {
          void refetch();
          setSelected(null);
        }}
      />
      <Dialog open={createKbOpen} onOpenChange={setCreateKbOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create knowledge base</DialogTitle>
            <DialogDescription>
              This creates a new tab and keeps its nodes separated from your other knowledge.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs text-slate-400" htmlFor="new-kb-name">
              Name
            </label>
            <Input
              id="new-kb-name"
              value={newKbName}
              onChange={(e) => setNewKbName(e.target.value)}
              placeholder="e.g. Product Research"
              maxLength={40}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setCreateKbOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void createKnowledgeBase()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={clearAllOpen} onOpenChange={setClearAllOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Clear all knowledge?</DialogTitle>
            <DialogDescription>
              This will remove every node and edge in the current knowledge base tab.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setClearAllOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void clearAllKnowledge()}>
              Clear all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet open={isNarrow && mobileOpen} onOpenChange={setMobileOpen} modal>
        <SheetContent side="bottom" className="h-[80vh] border-slate-800">
          <SheetHeader>
            <SheetTitle>Chat</SheetTitle>
          </SheetHeader>
          <div className="mt-2 h-[calc(100%-2rem)]">{chatBlock}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
