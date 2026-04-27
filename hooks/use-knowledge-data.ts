"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase";
import { buildGraphData } from "@/lib/graph-helpers";
import type { Category, GraphData, KnowledgeEdge, KnowledgeNode, NodeWithCategory } from "@/lib/types";

type Status = "idle" | "loading" | "ready" | "error";

export function useKnowledgeData(kbId: string) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<NodeWithCategory[]>([]);
  const [edges, setEdges] = useState<KnowledgeEdge[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const refetch = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setError("Add NEXT_PUBLIC_SUPABASE_URL and ANON key to .env.local");
      setStatus("error");
      return { nodes: [] as NodeWithCategory[] };
    }
    if (!kbId) {
      setNodes([]);
      setEdges([]);
      setCategories([]);
      setStatus("idle");
      return { nodes: [] as NodeWithCategory[] };
    }
    setStatus("loading");
    setError(null);
    try {
      const supabase = getSupabaseBrowser();
      const [cRes, nRes, eRes] = await Promise.all([
        supabase.from("categories").select("*").eq("knowledge_base_id", kbId).order("name"),
        supabase.from("nodes").select("*").eq("knowledge_base_id", kbId).order("created_at", { ascending: false }),
        supabase.from("edges").select("*").eq("knowledge_base_id", kbId),
      ]);
      if (cRes.error) throw cRes.error;
      if (nRes.error) throw nRes.error;
      if (eRes.error) throw eRes.error;
      const catList = (cRes.data as Category[]) ?? [];
      const byId = new Map(catList.map((c) => [c.id, c] as const));
      const nodeRows = (nRes.data as KnowledgeNode[]) ?? [];
      const withCat: NodeWithCategory[] = nodeRows.map((n) => ({
        ...n,
        category: n.category_id ? (byId.get(n.category_id) ?? null) : null,
      }));
      setCategories(catList);
      setNodes(withCat);
      setEdges((eRes.data as KnowledgeEdge[]) ?? []);
      setStatus("ready");
      return { nodes: withCat };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setStatus("error");
      return { nodes: [] as NodeWithCategory[] };
    }
  }, [kbId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowser();
    const ch = supabase
      .channel("kb_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "nodes" }, () => {
        void refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "edges" }, () => {
        void refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () => {
        void refetch();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [refetch]);

  const graphData: GraphData = useMemo(
    () => buildGraphData(nodes, edges),
    [nodes, edges]
  );

  return { status, error, nodes, edges, categories, graphData, refetch };
}
