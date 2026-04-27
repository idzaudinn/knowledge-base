import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL_CANDIDATES = [
  "claude-haiku-4-5",
  "claude-haiku-4-5-latest",
  "claude-sonnet-4-20250514",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
  "claude-3-haiku-20240307",
] as const;

let _client: Anthropic | null = null;
let _lastKey: string | null = null;

export function getAnthropic(): Anthropic {
  const key = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not set (add it to .env.local or Vercel → Environment Variables, then restart / redeploy)");
  }
  if (key !== _lastKey) {
    _client = null;
    _lastKey = key;
  }
  if (!_client) {
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}

export function getAnthropicModelCandidates(): string[] {
  const configured = (process.env.ANTHROPIC_MODEL ?? "").trim();
  if (configured) {
    return [configured, ...DEFAULT_MODEL_CANDIDATES.filter((m) => m !== configured)];
  }
  return [...DEFAULT_MODEL_CANDIDATES];
}

function isModelNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; message?: string };
  if (e.status === 404) return true;
  return (e.message ?? "").toLowerCase().includes("model");
}

type CreateMessageInput = Omit<Anthropic.MessageCreateParams, "model">;

export async function createMessageWithFallback(
  anthropic: Anthropic,
  params: CreateMessageInput
) {
  const candidates = getAnthropicModelCandidates();
  let lastErr: unknown;
  for (const model of candidates) {
    try {
      const response = await anthropic.messages.create({
        ...params,
        model,
        stream: false,
      });
      return { response: response as Anthropic.Message, model };
    } catch (err) {
      lastErr = err;
      if (!isModelNotFoundError(err)) throw err;
    }
  }
  if (isModelNotFoundError(lastErr)) {
    throw new Error(
      `No available Anthropic model was found for this API key. Tried: ${candidates.join(
        ", "
      )}. Set ANTHROPIC_MODEL in your environment to a model ID your account can access.`
    );
  }
  throw lastErr ?? new Error("No available Anthropic model was found");
}
