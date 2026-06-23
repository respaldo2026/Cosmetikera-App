import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { extractTenantFromPathname, getDefaultTenantSlug, normalizeTenantSlug } from "@/utils/tenant/tenant-context";

export type TenantContext = {
  tenantSlug: string;
  tenantId: string;
};

function getAdminClient() {
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
  const fromHeader = request.headers.get("x-tenant");
  const fromCookie = request.cookies.get("lc_tenant")?.value;
  const fromPath = extractTenantFromPathname(request.nextUrl.pathname);
  return normalizeTenantSlug(fromHeader ?? fromCookie ?? fromPath ?? getDefaultTenantSlug());
}

export async function resolveTenantContext(request: NextRequest): Promise<TenantContext> {
  const tenantSlug = resolveTenantSlugFromRequest(request);
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from("tenants")
    .select("id,slug")
    .eq("slug", tenantSlug)
    .eq("estado", "active")
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo resolver tenant: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error(`Tenant no existe o está inactivo: ${tenantSlug}`);
  }

  return {
    tenantSlug: String(data.slug),
    tenantId: String(data.id),
  };
}
