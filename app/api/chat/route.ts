import { NextResponse, type NextRequest } from "next/server";
import { getAnthropic, createMessageWithFallback } from "@/lib/anthropic";
import { getSupabaseService } from "@/lib/supabase-server";
import { parseFeedJsonFromText } from "@/lib/parse-claude-json";
import { selectRelevantNodes, formatKnowledgeForPrompt, formatRelationshipsForAsk, nextCategoryColor } from "@/lib/graph-helpers";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import type { Category, KnowledgeNode } from "@/lib/types";
import { z } from "zod";

const bodySchema = z.object({
  message: z.string().min(1).max(32000),
  mode: z.enum(["feed", "ask"]),
  kbId: z.string().uuid(),
});

type NodeWithCat = KnowledgeNode & { category: Category | null };

function normalizeLabel(s: string): string {
  return s.trim().toLowerCase();
}

async function loadGraph(supabase: ReturnType<typeof getSupabaseService>, kbId: string) {
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
  const catById = new Map((categories as Category[]).map((c) => [c.id, c] as const));
  const nodes: NodeWithCat[] = (nodeRows as KnowledgeNode[]).map((n) => ({
    ...n,
    category: n.category_id ? (catById.get(n.category_id) ?? null) : null,
  }));
  return {
    categories: (categories as Category[]) ?? [],
    nodes,
    edges: edgeRows ?? [],
  };
}

function buildFeedPrompt(cats: Category[], nodeLabels: { label: string; category: string | null }[]) {
  return `You are a knowledge graph builder. When the user provides information, extract knowledge entities and relationships.

EXISTING CATEGORIES in the database:
${cats.map((c) => `- ${c.name} (id context only; new categories are allowed with broad names like Technology, Science, People, Concepts, Projects)`).join("\n")}

EXISTING NODES in the database (use exact label if updating):
${nodeLabels.map((n) => `- ${n.label}${n.category ? ` [${n.category}]` : ""}`).join("\n")}

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "nodes": [
    {
      "label": "short label (2-4 words max)",
      "content": "full description of this knowledge entity",
      "category": "category name (reuse existing if applicable, or suggest new)",
      "isExisting": false
    }
  ],
  "edges": [
    {
      "source": "node label",
      "target": "node label",
      "relationship": "describes relationship (e.g., 'uses', 'is a', 'part of', 'related to')",
      "strength": 0.8
    }
  ],
  "summary": "one line summary of what was learned"
}

Rules:
- Extract ALL meaningful entities from the input
- ALWAYS check for connections to existing nodes
- Category names should be broad (e.g., "Technology", "Science", "People", "Concepts", "Projects")
- If a node already exists, set isExisting to true and use the exact existing label
- Assign a relationship strength: 1.0 = direct/strong, 0.5 = moderate, 0.2 = weak
- Do not create self-referencing edges.`;
}

export async function POST(req: NextRequest) {
  const lim = rateLimit(getClientIp(req));
  if (!lim.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(lim.retryAfter) } }
    );
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { message, mode, kbId } = parsed.data;
  const supabase = getSupabaseService();
  const anthropic = getAnthropic();

  try {
    if (mode === "feed") {
      const { categories, nodes } = await loadGraph(supabase, kbId);
      const nodeLabels = nodes.map((n) => ({
        label: n.label,
        category: n.category?.name ?? null,
      }));
      const system = buildFeedPrompt(categories, nodeLabels);
      const { response: res, model: usedModel } = await createMessageWithFallback(anthropic, {
        max_tokens: 8192,
        system,
        messages: [{ role: "user", content: message }],
      });
      const textBlock = res.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        return NextResponse.json({ error: "No text response" }, { status: 500 });
      }
      let data;
      try {
        data = parseFeedJsonFromText(textBlock.text);
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Failed to parse AI response" },
          { status: 422 }
        );
      }
      const labelToId = new Map<string, string>();
      for (const n of nodes) {
        labelToId.set(normalizeLabel(n.label), n.id);
      }
      const nameToCategory = new Map<string, Category>();
      for (const c of categories) {
        nameToCategory.set(normalizeLabel(c.name), c);
      }
      const created: string[] = [];
      const linked: string[] = [];
      for (const item of data.nodes) {
        const k = normalizeLabel(item.label);
        let cat: Category;
        const cn = nameToCategory.get(normalizeLabel(item.category));
        if (cn) {
          cat = cn;
        } else {
          const name = item.category.trim().slice(0, 200) || "Concepts";
          const color = nextCategoryColor();
          const { data: ins, error } = await supabase
            .from("categories")
            .insert({ name, color, knowledge_base_id: kbId })
            .select()
            .single();
          if (error) throw error;
          cat = ins as Category;
          nameToCategory.set(normalizeLabel(cat.name), cat);
        }
        if (labelToId.has(k)) {
          const { error: uErr } = await supabase
            .from("nodes")
            .update({
              content: item.content,
              category_id: cat.id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", labelToId.get(k)!);
          if (uErr) throw uErr;
          linked.push(item.label);
        } else {
          const { data: nIns, error: nErr } = await supabase
            .from("nodes")
            .insert({
              knowledge_base_id: kbId,
              label: item.label.slice(0, 500),
              content: item.content,
              category_id: cat.id,
              metadata: {},
            })
            .select()
            .single();
          if (nErr) throw nErr;
          const row = nIns as KnowledgeNode;
          labelToId.set(k, row.id);
          created.push(item.label);
        }
      }
      const { data: reloaded } = await supabase
        .from("nodes")
        .select("*")
        .eq("knowledge_base_id", kbId);
      const reNodes = (reloaded as KnowledgeNode[]) ?? [];
      for (const n of reNodes) {
        labelToId.set(normalizeLabel(n.label), n.id);
      }
      for (const e of data.edges) {
        const a = labelToId.get(normalizeLabel(e.source));
        const b = labelToId.get(normalizeLabel(e.target));
        if (!a || !b || a === b) continue;
        const { error: eErr } = await supabase.from("edges").insert({
          knowledge_base_id: kbId,
          source_id: a,
          target_id: b,
          relationship: e.relationship.slice(0, 500),
          strength: Math.min(1, Math.max(0, e.strength ?? 0.5)),
        });
        if (eErr) {
          if (eErr.code === "23505" || eErr.message?.includes("unique")) continue;
          throw eErr;
        }
      }
      await supabase.from("chat_history").insert([
        { knowledge_base_id: kbId, role: "user", content: message, message_type: "feed" },
        {
          knowledge_base_id: kbId,
          role: "assistant",
          content: `✅ ${data.summary}

Created: ${created.length ? created.join(", ") : "(none new)"}  
Linked/updated: ${linked.length ? linked.join(", ") : "(none)"}`,
          message_type: "feed",
        },
      ]);
      return NextResponse.json({
        ok: true,
        mode: "feed",
        summary: data.summary,
        created,
        linked,
        model: usedModel,
        message: "feed_complete",
      });
    }
    const { nodes, edges } = await loadGraph(supabase, kbId);
    const byId = new Map(nodes.map((n) => [n.id, n] as const));
    let selected = nodes;
    const combined = formatKnowledgeForPrompt(nodes);
    if (combined.length > 100000) {
      selected = selectRelevantNodes(message, nodes);
    }
    const rel = edges.filter((e) => {
      if (!selected.find((n) => n.id === e.source_id)) return false;
      if (!selected.find((n) => n.id === e.target_id)) return false;
      return true;
    });
    const relText = formatRelationshipsForAsk(rel, byId);
    const kb = `${formatKnowledgeForPrompt(selected)}

RELATIONSHIPS (among listed nodes when possible):
${relText}
`;
    const system = `You are a personal knowledge assistant. Answer the user's question based ONLY on the following knowledge base. If the answer is not in the knowledge base, say exactly: "I don't have this information in your knowledge base yet. Try feeding me this knowledge first!"

At the end of your answer, add a new line: REFERENCES: followed by a pipe-separated list of the exact node labels you used to answer, or "NONE" if you could not use the knowledge base (including when you refused).

KNOWLEDGE BASE:
${kb}
`;
    const { response: res, model: usedModel } = await createMessageWithFallback(anthropic, {
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: message }],
    });
    const textBlock = res.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No text response" }, { status: 500 });
    }
    const out = textBlock.text;
    const refMatch = out.match(/REFERENCES:\s*(.+)$/im);
    const referencedLabels: string[] = [];
    if (refMatch) {
      const rest = refMatch[1].trim();
      if (rest && rest.toUpperCase() !== "NONE") {
        for (const p of rest.split("|")) {
          const l = p.trim();
          if (l) referencedLabels.push(l);
        }
      }
    }
    const referencedIds: string[] = [];
    for (const lab of referencedLabels) {
      const m = nodes.find((n) => normalizeLabel(n.label) === normalizeLabel(lab));
      if (m) referencedIds.push(m.id);
    }
    await supabase.from("chat_history").insert([
      { knowledge_base_id: kbId, role: "user", content: message, message_type: "question" },
      { knowledge_base_id: kbId, role: "assistant", content: out, message_type: "question" },
    ]);
    return NextResponse.json({
      ok: true,
      mode: "ask",
      answer: out,
      referencedNodeIds: referencedIds,
      model: usedModel,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
