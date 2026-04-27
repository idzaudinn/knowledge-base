import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseService } from "@/lib/supabase-server";

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
    const [ca, n, e] = await Promise.all([
      supabase.from("categories").select("*").eq("knowledge_base_id", kbId).order("name"),
      supabase.from("nodes").select("*").eq("knowledge_base_id", kbId).order("created_at"),
      supabase.from("edges").select("*").eq("knowledge_base_id", kbId),
    ]);
    if (ca.error) throw ca.error;
    if (n.error) throw n.error;
    if (e.error) throw e.error;
    const body = JSON.stringify(
      { categories: ca.data, nodes: n.data, edges: e.data },
      null,
      2
    );
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="knowledge-base-${dateStamp()}.json"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
