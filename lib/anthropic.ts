import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_MODEL = "claude-sonnet-4-20250514";

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  if (!_client) {
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}
