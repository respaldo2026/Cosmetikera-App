import { createClient } from "@supabase/supabase-js";
import {
  extractTenantFromHostname,
  extractTenantFromPathname,
  getDefaultTenantSlug,
  normalizeTenantSlug,
} from "@/utils/tenant/tenant-context";

type RequestedTenantInput = {
  pathname?: string | null;
  host?: string | null;
  cookieTenant?: string | null;
};

export function resolveRequestedTenantSlug(input: RequestedTenantInput): string {
  return normalizeTenantSlug(
    extractTenantFromPathname(input.pathname)
      || extractTenantFromHostname(input.host)
      || input.cookieTenant
      || getDefaultTenantSlug(),
  );
}

export async function shouldRedirectToTenantOnboarding(input: RequestedTenantInput): Promise<{
  shouldRedirect: boolean;
  tenantSlug: string;
}> {
  const tenantSlug = resolveRequestedTenantSlug(input);
  const defaultTenantSlug = getDefaultTenantSlug();

  if (!tenantSlug || tenantSlug === "default" || tenantSlug === defaultTenantSlug || tenantSlug === "principal") {
    return { shouldRedirect: false, tenantSlug };
  }

  if ((process.env.SAAS_ONBOARDING_ENABLED || "true").toLowerCase() === "false") {
    return { shouldRedirect: false, tenantSlug };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) {
    return { shouldRedirect: false, tenantSlug };
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .eq("estado", "active")
    .maybeSingle();

  if (error) {
    console.error("[tenant-onboarding] No se pudo validar tenant:", error.message);
    return { shouldRedirect: false, tenantSlug };
  }

  return {
    shouldRedirect: !data?.id,
    tenantSlug,
  };
}