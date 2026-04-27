import type { Category, GraphData, GraphLink, GraphNode, KnowledgeEdge, KnowledgeNode } from "./types";

export function countConnections(
  nodeId: string,
  edges: Pick<KnowledgeEdge, "source_id" | "target_id">[]
): number {
  let c = 0;
  for (const e of edges) {
    if (e.source_id === nodeId || e.target_id === nodeId) c += 1;
  }
  return c;
}

export function buildGraphData(
  nodes: (KnowledgeNode & { category: Category | null })[],
  edges: KnowledgeEdge[]
): GraphData {
  const colors = new Map<string, string>();
  for (const n of nodes) {
    if (n.category) colors.set(n.id, n.category.color);
  }

  const gNodes: GraphNode[] = nodes.map((n) => ({
    id: n.id,
    label: n.label,
    content: n.content,
    color: n.category?.color ?? "#6b7280",
    categoryId: n.category_id,
    val: countConnections(n.id, edges) + 1,
  }));

  const gLinks: GraphLink[] = edges
    .filter((e) => e.source_id !== e.target_id)
    .map((e) => ({
      id: e.id,
      source: e.source_id,
      target: e.target_id,
      label: e.relationship,
      strength: e.strength,
    }));

  return { nodes: gNodes, links: gLinks };
}

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "as",
  "is",
  "was",
  "are",
  "were",
  "been",
  "be",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "this",
  "that",
  "these",
  "those",
  "what",
  "which",
  "who",
  "how",
  "why",
  "when",
  "where",
]);

export function selectRelevantNodes(
  question: string,
  nodes: (KnowledgeNode & { category: Category | null })[]
): (KnowledgeNode & { category: Category | null })[] {
  const text = question.toLowerCase();
  const words = text
    .split(/\W+/)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 2 && !STOP.has(w));

  if (words.length === 0) {
    return nodes.slice(0, 50);
  }

  const scored = nodes
    .map((n) => {
      const label = n.label.toLowerCase();
      const content = n.content.toLowerCase();
      let s = 0;
      for (const w of words) {
        if (label.includes(w)) s += 3;
        if (content.includes(w)) s += 1;
        if (n.category?.name.toLowerCase().includes(w)) s += 2;
      }
      return { n, s };
    })
    .sort((a, b) => b.s - a.s);

  const top = scored.filter((x) => x.s > 0);
  if (top.length > 0) {
    return top.slice(0, 80).map((x) => x.n);
  }
  return nodes.slice(0, 40);
}

const CAT_COLORS = [
  "#4f6bed",
  "#7c3aed",
  "#059669",
  "#d97706",
  "#dc2626",
  "#0ea5e9",
  "#16a34a",
  "#c026d3",
  "#2dd4bf",
  "#f472b6",
  "#a78bfa",
  "#fbbf24",
];

let colorIdx = 0;

export function nextCategoryColor(): string {
  const c = CAT_COLORS[colorIdx % CAT_COLORS.length];
  colorIdx += 1;
  return c;
}

export function formatKnowledgeForPrompt(
  nodes: (KnowledgeNode & { category: Category | null })[]
): string {
  const parts: string[] = [];
  for (const n of nodes) {
    const cat = n.category?.name ?? "Uncategorized";
    parts.push(
      `[${n.label}] (category: ${cat})\n${n.content}\n---`
    );
  }
  return parts.join("\n");
}

export function formatRelationshipsForAsk(
  edges: KnowledgeEdge[],
  byId: Map<string, KnowledgeNode>
): string {
  const lines: string[] = [];
  for (const e of edges) {
    const a = byId.get(e.source_id);
    const b = byId.get(e.target_id);
    if (a && b) {
      lines.push(`${a.label} —[${e.relationship}]→ ${b.label} (strength: ${e.strength})`);
    }
  }
  return lines.join("\n");
}
