import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function requireEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured");
  }
  return { url, key };
}

export function getSupabaseService(): SupabaseClient {
  const { url, key } = requireEnv();
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
