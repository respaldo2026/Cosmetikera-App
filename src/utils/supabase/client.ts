"use client";

import { createBrowserClient } from "@supabase/ssr";
import { resolveTenantFromBrowserLocation } from "@/utils/tenant/tenant-context";
import { getTenantSupabaseConfig } from "./tenant-config";

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>;

const clientsByTenant = new Map<string, BrowserSupabaseClient>();

export function getSupabaseBrowserClient(tenantSlug?: string): BrowserSupabaseClient {
  const tenant = tenantSlug || resolveTenantFromBrowserLocation();

  const cached = clientsByTenant.get(tenant);
  if (cached) return cached;

  const config = getTenantSupabaseConfig(tenant);
  if (!config.url || !config.anonKey) {
    throw new Error(`Supabase no configurado para tenant '${tenant}'`);
  }

  const client = createBrowserClient(config.url, config.anonKey);
  clientsByTenant.set(tenant, client);
  return client;
}

export const supabaseBrowserClient: BrowserSupabaseClient = new Proxy({} as BrowserSupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseBrowserClient();
    const value = (client as any)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});