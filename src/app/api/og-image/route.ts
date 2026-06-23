import { NextRequest } from "next/server";
import { getAdminClient, resolveTenantContext } from "../_utils/tenant-resolver";

export const dynamic = "force-dynamic";

const isHttpUrl = (value?: string | null): boolean => {
  const text = String(value || "").trim();
  return /^https?:\/\//i.test(text);
};

async function getConfiguredLogoUrl(request: NextRequest): Promise<string | null> {
  const { tenantId } = await resolveTenantContext(request);
  const supabase = getAdminClient();

  try {
    const { data, error } = await supabase
      .from("configuracion")
      .select("logo_url")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (error) return null;
    const logoUrl = data?.logo_url || null;

    return isHttpUrl(logoUrl) ? logoUrl : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const fallbackUrl = new URL("/og-image.svg", request.url).toString();
  const logoUrl = await getConfiguredLogoUrl(request);
  const sourceUrl = logoUrl || fallbackUrl;

  const imageResponse = await fetch(sourceUrl, { cache: "no-store" }).catch(() => null);

  if (!imageResponse?.ok) {
    const fallbackResponse = await fetch(fallbackUrl, { cache: "no-store" });
    const fallbackBuffer = await fallbackResponse.arrayBuffer();
    return new Response(fallbackBuffer, {
      headers: {
        "Content-Type": fallbackResponse.headers.get("content-type") || "image/svg+xml",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  }

  const buffer = await imageResponse.arrayBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type": imageResponse.headers.get("content-type") || "image/png",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
