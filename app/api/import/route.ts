import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseService } from "@/lib/supabase-server";
import { z } from "zod";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { nextCategoryColor } from "@/lib/graph-helpers";

const rowCat = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  color: z.string().max(20).optional(),
});

const rowNode = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1).max(500),
  content: z.string().min(1).max(500000),
  category_id: z.string().uuid().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const rowEdge = z.object({
  source_id: z.string().uuid(),
  target_id: z.string().uuid(),
  relationship: z.string().min(1).max(500),
  strength: z.number().min(0).max(1).optional(),
});

const schema = z.object({
  categories: z.array(rowCat).optional(),
  nodes: z.array(rowNode).optional(),
  edges: z.array(rowEdge).optional(),
});

export async function POST(req: NextRequest) {
  const lim = rateLimit(getClientIp(req));
  if (!lim.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(lim.retryAfter) } }
    );
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const p = schema.safeParse(raw);
  if (!p.success) {
    return NextResponse.json({ error: "Invalid import structure" }, { status: 400 });
  }
  const data = p.data;
  if (!data.nodes?.length) {
    return NextResponse.json({ error: "No nodes in import" }, { status: 400 });
  }
  const supabase = getSupabaseService();
  const oldCatIdToNew = new Map<string, string>();
  const oldNodeIdToNew = new Map<string, string>();
  let catN = 0;
  let nodeN = 0;
  let edgeN = 0;
  try {
    if (data.categories?.length) {
      for (const c of data.categories) {
        const { data: found } = await supabase
          .from("categories")
          .select("id")
          .ilike("name", c.name)
          .limit(1)
          .maybeSingle();
        if (found?.id) {
          if (c.id) oldCatIdToNew.set(c.id, found.id);
          continue;
        }
        const { data: ins, error } = await supabase
          .from("categories")
          .insert({ name: c.name, color: c.color || nextCategoryColor() })
          .select("id")
          .single();
        if (error) throw error;
        if (c.id && ins?.id) oldCatIdToNew.set(c.id, ins.id);
        catN += 1;
      }
    }
    for (const n of data.nodes) {
      let cid: string | null = null;
      if (n.category_id) {
        cid = oldCatIdToNew.get(n.category_id) ?? null;
        if (!cid) {
          const { data: cRow } = await supabase
            .from("categories")
            .select("id")
            .eq("id", n.category_id)
            .maybeSingle();
          if (cRow?.id) cid = cRow.id;
        }
      }
      const { data: ins, error } = await supabase
        .from("nodes")
        .insert({
          label: n.label,
          content: n.content,
          category_id: cid,
          metadata: n.metadata ?? {},
        })
        .select("id")
        .single();
      if (error) throw error;
      if (n.id && ins?.id) oldNodeIdToNew.set(n.id, ins.id);
      nodeN += 1;
    }
    for (const e of data.edges ?? []) {
      const a = oldNodeIdToNew.get(e.source_id);
      const b = oldNodeIdToNew.get(e.target_id);
      if (!a || !b || a === b) continue;
      const { error: eErr } = await supabase.from("edges").insert({
        source_id: a,
        target_id: b,
        relationship: e.relationship,
        strength: e.strength ?? 1,
      });
      if (!eErr) {
        edgeN += 1;
        continue;
      }
      if (eErr.code === "23505" || (eErr as { code?: string }).code === "23505") {
        continue;
      }
    }
    return NextResponse.json({
      ok: true,
      message: `Imported ${nodeN} nodes, ${edgeN} edges, ${catN} new categories`,
      imported: { nodes: nodeN, edges: edgeN, categories: catN },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 500 }
    );
  }
}
