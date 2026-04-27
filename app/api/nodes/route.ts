import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseService } from "@/lib/supabase-server";
import { z } from "zod";

const postSchema = z.object({
  knowledge_base_id: z.string().uuid(),
  label: z.string().min(1).max(500),
  content: z.string().min(1).max(200000),
  category_id: z.string().uuid().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const kbId = req.nextUrl.searchParams.get("kbId");
    if (!kbId || !/^[0-9a-f-]{36}$/i.test(kbId)) {
      return NextResponse.json({ error: "Invalid kbId" }, { status: 400 });
    }
    const supabase = getSupabaseService();
    const { data: nodes, error } = await supabase
      .from("nodes")
      .select("*")
      .eq("knowledge_base_id", kbId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ nodes });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const json: unknown = await req.json();
    const parsed = postSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const supabase = getSupabaseService();
    const { data, error } = await supabase
      .from("nodes")
      .insert({
        knowledge_base_id: parsed.data.knowledge_base_id,
        label: parsed.data.label,
        content: parsed.data.content,
        category_id: parsed.data.category_id ?? null,
        metadata: parsed.data.metadata ?? {},
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ node: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}
