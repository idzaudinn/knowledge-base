/**
 * Shared Supabase URL/key parsing. Trims whitespace (common copy-paste issue on Vercel / .env).
 */
export function getSupabaseEnv(): { url: string; key: string } {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  return { url, key };
}

export function isValidSupabaseUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function isSupabaseEnvReady(): boolean {
  const { url, key } = getSupabaseEnv();
  return Boolean(key) && isValidSupabaseUrl(url);
}
