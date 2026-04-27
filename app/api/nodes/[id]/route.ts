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
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const json: unknown = await req.json();
    const parsed = putSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const supabase = getSupabaseService();
    const { data, error } = await supabase
      .from("nodes")
      .update({
        ...parsed.data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
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

export async function DELETE(_req: NextRequest, context: Params) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const supabase = getSupabaseService();
    const { error } = await supabase.from("nodes").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}
