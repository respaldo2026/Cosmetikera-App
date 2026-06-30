const TENANT_PATH_REGEX = /^\/t\/([a-z0-9-]+)(?:\/|$)/i;

export function normalizeTenantSlug(value?: string | null): string {
  const raw = String(value ?? "").trim().toLowerCase();
  const cleaned = raw.replace(/[^a-z0-9-]/g, "").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
  return cleaned || "default";
}

export function toTenantEnvSuffix(tenantSlug?: string | null): string {
  return normalizeTenantSlug(tenantSlug).replace(/-/g, "_").toUpperCase();
}

export function getDefaultTenantSlug(): string {
  return normalizeTenantSlug(
    process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? process.env.DEFAULT_TENANT_SLUG ?? "principal",
  );
}

export function getAppBaseHostname(): string | null {
  const rawUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "";
  if (!rawUrl) return null;

  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function extractTenantFromHostname(hostname?: string | null): string | null {
  const rawHost = String(hostname ?? "")
    .trim()
    .toLowerCase()
    .split(":")[0] || "";

  if (!rawHost || rawHost === "localhost" || rawHost === "127.0.0.1" || rawHost === "www") {
    return null;
  }

  const baseHostname = getAppBaseHostname();
  if (!baseHostname || rawHost === baseHostname || !rawHost.endsWith(`.${baseHostname}`)) {
    return null;
  }

  const subdomain = rawHost.slice(0, -(baseHostname.length + 1)).split(".")[0] || "";
  const normalized = normalizeTenantSlug(subdomain);
  return normalized === "default" ? null : normalized;
}

export function extractTenantFromPathname(pathname?: string | null): string | null {
  const path = String(pathname ?? "").trim();
  const match = path.match(TENANT_PATH_REGEX);
  if (!match?.[1]) return null;
  return normalizeTenantSlug(match[1]);
}

export function resolveTenantFromBrowserLocation(pathname?: string): string {
  const currentPath =
    typeof pathname === "string"
      ? pathname
      : typeof window !== "undefined"
        ? window.location.pathname
        : "";

  return extractTenantFromPathname(currentPath) ?? getDefaultTenantSlug();
}
