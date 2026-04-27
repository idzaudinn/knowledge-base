import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv, isValidSupabaseUrl } from "@/lib/supabase-env";

function requireEnv() {
  const { url, key } = getSupabaseEnv();
  if (!key || !isValidSupabaseUrl(url)) {
    throw new Error("Supabase is not configured (check NEXT_PUBLIC_SUPABASE_URL and ANON key)");
  }
  return { url, key };
}

export function getSupabaseService(): SupabaseClient {
  const { url, key } = requireEnv();
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
