const buckets = new Map<string, { count: number; reset: number }>();

const WINDOW_MS = 60_000;
const MAX = 30;

function key(k: string) {
  return k;
}

export function rateLimit(ip: string | null): { ok: true } | { ok: false; retryAfter: number } {
  const k = key(ip || "unknown");
  const now = Date.now();
  const b = buckets.get(k);
  if (!b || now > b.reset) {
    buckets.set(k, { count: 1, reset: now + WINDOW_MS });
    return { ok: true };
  }
  if (b.count >= MAX) {
    return { ok: false, retryAfter: Math.ceil((b.reset - now) / 1000) };
  }
  b.count += 1;
  return { ok: true };
}

export function getClientIp(req: Request): string | null {
  const h = new Headers(req.headers);
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    null
  );
}
