import { getDefaultTenantSlug, normalizeTenantSlug, toTenantEnvSuffix } from "@/utils/tenant/tenant-context";

export type TenantSupabaseConfig = {
  tenant: string;
  url: string;
  anonKey: string;
  serviceRoleKey: string;
};

const normalizeSupabaseUrl = (url: string) => {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

function readEnv(name: string): string {
  const env = process.env as Record<string, string | undefined>;
  return env[name]?.trim() ?? "";
}

export function getTenantSupabaseConfig(tenantSlug?: string | null): TenantSupabaseConfig {
  const tenant = normalizeTenantSlug(tenantSlug ?? getDefaultTenantSlug());
  const suffix = toTenantEnvSuffix(tenant);

  const tenantUrl = readEnv(`TENANT_${suffix}_SUPABASE_URL`);
  const tenantAnon = readEnv(`TENANT_${suffix}_SUPABASE_ANON_KEY`);
  const tenantService = readEnv(`TENANT_${suffix}_SUPABASE_SERVICE_ROLE_KEY`);

  const defaultUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const defaultAnon = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const defaultService = readEnv("SUPABASE_SERVICE_ROLE_KEY");

  return {
    tenant,
    url: normalizeSupabaseUrl(tenantUrl || defaultUrl),
    anonKey: tenantAnon || defaultAnon,
    serviceRoleKey: tenantService || defaultService,
  };
}
