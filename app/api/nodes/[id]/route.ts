import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseService } from "@/lib/supabase-server";
import { z } from "zod";

const putSchema = z.object({
  label: z.string().min(1).max(500).optional(),
  content: z.string().min(1).max(200000).optional(),
  category_id: z.string().uuid().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, context: Params) {
  const { id } = await context.params;
  const kbId = req.nextUrl.searchParams.get("kbId");
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  if (kbId && !/^[0-9a-f-]{36}$/i.test(kbId)) {
    return NextResponse.json({ error: "Invalid kbId" }, { status: 400 });
  }
  try {
    const json: unknown = await req.json();
    const parsed = putSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const supabase = getSupabaseService();
    const query = supabase
      .from("nodes")
      .update({
        ...parsed.data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    const { data, error } = await (kbId ? query.eq("knowledge_base_id", kbId) : query).select().single();
    if (error) throw error;
    return NextResponse.json({ node: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: Params) {
  const { id } = await context.params;
  const kbId = req.nextUrl.searchParams.get("kbId");
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  if (kbId && !/^[0-9a-f-]{36}$/i.test(kbId)) {
    return NextResponse.json({ error: "Invalid kbId" }, { status: 400 });
  }
  try {
    const supabase = getSupabaseService();
    const query = supabase.from("nodes").delete().eq("id", id);
    const { error } = kbId ? await query.eq("knowledge_base_id", kbId) : await query;
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}
