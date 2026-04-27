import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseService } from "@/lib/supabase-server";
import { z } from "zod";
import { nextCategoryColor } from "@/lib/graph-helpers";

const postSchema = z.object({
  name: z.string().min(1).max(200),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

export async function GET() {
  try {
    const supabase = getSupabaseService();
    const { data: categories, error } = await supabase
      .from("categories")
      .select("*")
      .order("name");
    if (error) throw error;
    return NextResponse.json({ categories });
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
      .from("categories")
      .insert({
        name: parsed.data.name,
        color: parsed.data.color ?? nextCategoryColor(),
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ category: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}
