"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL } from "./constants";

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>;

let browserClient: BrowserSupabaseClient | null = null;

export function getSupabaseBrowserClient(): BrowserSupabaseClient {
  if (browserClient) return browserClient;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase no configurado en variables públicas");
  }

  browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
  return browserClient;
}

export const supabaseBrowserClient: BrowserSupabaseClient = new Proxy({} as BrowserSupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseBrowserClient();
    const value = (client as any)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});