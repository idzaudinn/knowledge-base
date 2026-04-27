import { NextResponse } from "next/server";
import { getSupabaseService } from "@/lib/supabase-server";
import { buildMarkdownExport } from "@/lib/export-md";
import type { Category, KnowledgeEdge, KnowledgeNode } from "@/lib/types";

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const supabase = getSupabaseService();
    const { data: categories, error: cErr } = await supabase
      .from("categories")
      .select("*")
      .order("name");
    if (cErr) throw cErr;
    const { data: nodeRows, error: nErr } = await supabase.from("nodes").select("*");
    if (nErr) throw nErr;
    const { data: edgeRows, error: eErr } = await supabase.from("edges").select("*");
    if (eErr) throw eErr;
    const catMap = new Map((categories as Category[]).map((c) => [c.id, c] as const));
    const nodes = (nodeRows as KnowledgeNode[]).map((n) => ({
      ...n,
      category: n.category_id ? (catMap.get(n.category_id) ?? null) : null,
    }));
    const md = buildMarkdownExport(
      nodes,
      (edgeRows as KnowledgeEdge[]) ?? [],
      (categories as Category[]) ?? []
    );
    return new NextResponse(md, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="knowledge-base-${dateStamp()}.md"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
