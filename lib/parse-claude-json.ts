import type { FeedResponseJSON } from "./types";

const FEED_ERROR_PREFIX = "Invalid feed response: ";

function stripJsonFence(s: string): string {
  const t = s.trim();
  if (t.startsWith("```")) {
    const lines = t.split("\n");
    if (lines[0].startsWith("```")) {
      lines.shift();
    }
    if (lines[lines.length - 1].trim() === "```") {
      lines.pop();
    }
    return lines.join("\n").trim();
  }
  return t;
}

export function parseFeedJsonFromText(s: string): FeedResponseJSON {
  const body = stripJsonFence(s);
  const parsed: unknown = JSON.parse(body);
  if (!parsed || typeof parsed !== "object") {
    throw new TypeError(FEED_ERROR_PREFIX + "not an object");
  }
  const p = parsed as Record<string, unknown>;
  if (!Array.isArray(p.nodes) || !Array.isArray(p.edges) || typeof p.summary !== "string") {
    throw new TypeError(FEED_ERROR_PREFIX + "missing nodes, edges, or summary");
  }
  return p as unknown as FeedResponseJSON;
}
