import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const isHttpUrl = (value?: string | null): boolean => {
  const text = String(value || "").trim();
  return /^https?:\/\//i.test(text);
};

async function getConfiguredLogoUrl(request: NextRequest): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const apiKey = serviceRoleKey || anonKey;

  if (!supabaseUrl || !apiKey) return null;

  const endpoint = `${supabaseUrl}/rest/v1/configuracion?select=logo_url&order=updated_at.desc.nullslast,created_at.desc.nullslast&limit=1`;

  try {
    const response = await fetch(endpoint, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const rows = (await response.json()) as Array<{ logo_url?: string | null }>;
    const logoUrl = rows?.[0]?.logo_url || null;

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
