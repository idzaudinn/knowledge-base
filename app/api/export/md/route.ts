import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseService } from "@/lib/supabase-server";
import { buildMarkdownExport } from "@/lib/export-md";
import type { Category, KnowledgeEdge, KnowledgeNode } from "@/lib/types";

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    const kbId = req.nextUrl.searchParams.get("kbId");
    if (!kbId || !/^[0-9a-f-]{36}$/i.test(kbId)) {
      return NextResponse.json({ error: "Invalid kbId" }, { status: 400 });
    }
    const supabase = getSupabaseService();
    const { data: categories, error: cErr } = await supabase
      .from("categories")
      .select("*")
      .eq("knowledge_base_id", kbId)
      .order("name");
    if (cErr) throw cErr;
    const { data: nodeRows, error: nErr } = await supabase
      .from("nodes")
      .select("*")
      .eq("knowledge_base_id", kbId);
    if (nErr) throw nErr;
    const { data: edgeRows, error: eErr } = await supabase
      .from("edges")
      .select("*")
      .eq("knowledge_base_id", kbId);
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
