// En cliente solo deben usarse env públicas estáticas (NEXT_PUBLIC_*).
// Evita leer process.env dinámicamente para no romper en runtime browser/edge.
const normalizeSupabaseUrl = (url: string) => {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

export function getSupabasePublicConfigForTenant() {
  return {
    tenant: "default",
    url: SUPABASE_URL,
    anonKey: SUPABASE_KEY,
    serviceRoleKey: "",
  };
}

export const SUPABASE_URL = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

if (!SUPABASE_URL) {
  console.error("Supabase URL env var missing at runtime");
}

if (!SUPABASE_KEY) {
  console.error("Supabase anon key env var missing at runtime");
}
