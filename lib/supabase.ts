"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv, isSupabaseEnvReady, isValidSupabaseUrl } from "@/lib/supabase-env";

let client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  const { url, key } = getSupabaseEnv();
  if (!key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  if (!isValidSupabaseUrl(url)) {
    throw new Error(
      "Invalid NEXT_PUBLIC_SUPABASE_URL. It must be a full URL like https://abcdefgh.supabase.co (no spaces; check Vercel → Settings → Environment Variables and redeploy)."
    );
  }
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: true },
    });
  }
  return client;
}

export function isSupabaseConfigured(): boolean {
  return isSupabaseEnvReady();
}
