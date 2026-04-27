import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseService } from "@/lib/supabase-server";
import { z } from "zod";

const postSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export async function GET() {
  try {
    const supabase = getSupabaseService();
    const { data, error } = await supabase.from("knowledge_bases").select("*").order("created_at");
    if (error) throw error;
    return NextResponse.json({ knowledgeBases: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
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
      .from("knowledge_bases")
      .insert({ name: parsed.data.name })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ knowledgeBase: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
