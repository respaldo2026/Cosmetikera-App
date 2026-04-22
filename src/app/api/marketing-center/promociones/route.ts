import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type MarketingAsset = {
  id: string;
  titulo: string | null;
  descripcion: string | null;
  descripcion_ia: string | null;
  categoria: string | null;
  url_archivo: string | null;
  estado: string | null;
  keywords: string[] | string | null;
  created_at: string | null;
};

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function extractKeywords(value: MarketingAsset["keywords"]) {
  if (Array.isArray(value)) return value.map((item) => normalizeText(item)).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }
  return [];
}

function extractPushTs(value: string | null) {
  if (!value) return 0;
  const matches = value.match(/\[PUSH_TS:(\d{10,16})\]/g);
  if (!matches || matches.length === 0) return 0;
  const last = matches[matches.length - 1];
  const numeric = last?.match(/\d{10,16}/)?.[0];
  return numeric ? Number(numeric) : 0;
}

function isPromoAsset(asset: MarketingAsset) {
  const keywords = extractKeywords(asset.keywords);
  const desc = normalizeText(asset.descripcion);
  const title = normalizeText(asset.titulo);
  const hayKeywordPromo = keywords.some((key) =>
    ["promo", "promocion", "descuento", "oferta", "2x1", "lanzamiento"].some((needle) => key.includes(needle))
  );
  return hayKeywordPromo || desc.includes("promo") || desc.includes("descuento") || title.includes("promo");
}

export async function GET() {
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("marketing_assets")
      .select("id,titulo,descripcion,descripcion_ia,categoria,url_archivo,estado,keywords,created_at")
      .eq("estado", "activo")
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const assets = ((data ?? []) as MarketingAsset[])
      .filter(isPromoAsset)
      .map((asset) => {
        const pushTs = extractPushTs(asset.descripcion_ia);
        const fallbackTs = asset.created_at ? new Date(asset.created_at).getTime() : 0;
        const eventTs = pushTs || fallbackTs;
        return {
          id: asset.id,
          titulo: asset.titulo || "Promoción La Cosmetikera",
          descripcion: asset.descripcion || "Tenemos una promoción activa para ti.",
          categoria: asset.categoria,
          url_archivo: asset.url_archivo,
          created_at: asset.created_at,
          pushTs,
          eventTs,
          notificationKey: `${asset.id}:${eventTs}`,
        };
      })
      .sort((a, b) => b.eventTs - a.eventTs)
      .slice(0, 10);

    return NextResponse.json({ data: assets });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 500 }
    );
  }
}
