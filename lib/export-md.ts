import type { Category, KnowledgeEdge, KnowledgeNode } from "./types";

function dateLine() {
  return new Date().toISOString();
}

function groupBy<T>(list: T[], key: (t: T) => string) {
  const m = new Map<string, T[]>();
  for (const x of list) {
    const k = key(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(x);
  }
  return m;
}

export function buildMarkdownExport(
  nodes: (KnowledgeNode & { category: Category | null })[],
  edges: KnowledgeEdge[],
  categories: Category[]
): string {
  const byCat = groupBy(nodes, (n) => n.category?.name ?? "Uncategorized");
  const lines: string[] = [];
  lines.push("# My Knowledge Base");
  lines.push(`Exported on: ${dateLine()}`);
  lines.push("");
  lines.push("## Categories");
  for (const c of categories) {
    const n = nodes.filter((x) => x.category_id === c.id).length;
    lines.push(`- **${c.name}** (${n} nodes)`);
  }
  lines.push("");
  for (const [catName, ns] of byCat) {
    lines.push("## " + (catName === "Uncategorized" ? "Other" : catName));
    for (const node of ns) {
      const label = node.label;
      lines.push(`### ${label}`);
      lines.push("");
      lines.push(node.content);
      const rels = edges.filter((e) => e.source_id === node.id || e.target_id === node.id);
      if (rels.length) {
        const bits = rels.map((e) => {
          const other =
            e.source_id === node.id
              ? nodes.find((x) => x.id === e.target_id)
              : nodes.find((x) => x.id === e.source_id);
          return `${other?.label ?? "?"} (${e.relationship})`;
        });
        lines.push("");
        lines.push(`- **Related to**: ${bits.join(", ")}`);
      }
      lines.push("");
    }
  }
  lines.push("## Relationships");
  for (const e of edges) {
    const a = nodes.find((n) => n.id === e.source_id);
    const b = nodes.find((n) => n.id === e.target_id);
    if (a && b) {
      lines.push(`- ${a.label} → ${e.relationship} → ${b.label}`);
    }
  }
  return lines.join("\n");
}
