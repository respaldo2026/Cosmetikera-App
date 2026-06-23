import { resolveTenantFromBrowserLocation } from "@/utils/tenant/tenant-context";
import { getTenantSupabaseConfig } from "./tenant-config";

export function getSupabasePublicConfigForTenant(tenantSlug?: string) {
  return getTenantSupabaseConfig(tenantSlug);
}

const browserTenant = resolveTenantFromBrowserLocation();
const browserConfig = getSupabasePublicConfigForTenant(browserTenant);

export const SUPABASE_URL = browserConfig.url;
export const SUPABASE_KEY = browserConfig.anonKey;

if (!SUPABASE_URL) {
  console.error("Supabase URL env var missing at runtime");
}

if (!SUPABASE_KEY) {
  console.error("Supabase anon key env var missing at runtime");
}
