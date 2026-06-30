import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { extractTenantFromHostname, extractTenantFromPathname, getDefaultTenantSlug, normalizeTenantSlug } from "@/utils/tenant/tenant-context";

export type TenantContext = {
  tenantSlug: string;
  tenantId: string;
};

export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) {
    throw new Error("Faltan variables de Supabase para resolver tenant");
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function resolveTenantSlugFromRequest(request: NextRequest): string {
  const fromHeader = request.headers.get("x-tenant")?.trim();
  const fromCookie = request.cookies.get("lc_tenant")?.value?.trim();
  const fromPath = extractTenantFromPathname(request.nextUrl.pathname);
  const fromHost = extractTenantFromHostname(request.headers.get("x-forwarded-host")?.trim() || request.headers.get("host")?.trim());
  return normalizeTenantSlug(fromHeader || fromPath || fromHost || fromCookie || getDefaultTenantSlug());
}

export async function resolveTenantContext(request: NextRequest): Promise<TenantContext> {
  const tenantSlug = resolveTenantSlugFromRequest(request);
  console.log("[resolveTenantContext] Resolviendo tenant slug:", tenantSlug);
  
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from("tenants")
    .select("id,slug")
    .eq("slug", tenantSlug)
    .eq("estado", "active")
    .maybeSingle();

  if (error) {
    console.error(`[resolveTenantContext] Query error para slug '${tenantSlug}':`, error.message);
    throw new Error(`No se pudo resolver tenant: ${error.message}`);
  }

  if (!data?.id) {
    console.error(`[resolveTenantContext] Tenant no encontrado o inactivo: ${tenantSlug}`);
    throw new Error(`Tenant no existe o está inactivo: ${tenantSlug}`);
  }

  console.log(`[resolveTenantContext] Tenant resuelto: ID=${data.id}, slug=${data.slug}`);
  
  return {
    tenantSlug: String(data.slug),
    tenantId: String(data.id),
  };
}
