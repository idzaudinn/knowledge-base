import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseService } from "@/lib/supabase-server";
import { z } from "zod";

const postSchema = z.object({
  knowledge_base_id: z.string().uuid(),
  source_id: z.string().uuid(),
  target_id: z.string().uuid(),
  relationship: z.string().min(1).max(500),
  strength: z.number().min(0).max(1).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const kbId = req.nextUrl.searchParams.get("kbId");
    if (!kbId || !/^[0-9a-f-]{36}$/i.test(kbId)) {
      return NextResponse.json({ error: "Invalid kbId" }, { status: 400 });
    }
    const supabase = getSupabaseService();
    const { data: edges, error } = await supabase
      .from("edges")
      .select("*")
      .eq("knowledge_base_id", kbId);
    if (error) throw error;
    return NextResponse.json({ edges });
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
    if (parsed.data.source_id === parsed.data.target_id) {
      return NextResponse.json({ error: "Self-referencing edge not allowed" }, { status: 400 });
    }
    const supabase = getSupabaseService();
    const { data, error } = await supabase
      .from("edges")
      .insert({
        knowledge_base_id: parsed.data.knowledge_base_id,
        source_id: parsed.data.source_id,
        target_id: parsed.data.target_id,
        relationship: parsed.data.relationship,
        strength: parsed.data.strength ?? 1,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Edge already exists" }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ edge: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}
