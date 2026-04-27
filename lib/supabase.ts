"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: true },
    });
  }
  return client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(url && key);
}
