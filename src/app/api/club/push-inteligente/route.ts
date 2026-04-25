/**
 * POST /api/club/push-inteligente
 *
 * Envía notificaciones push personalizadas basadas en historial de compra.
 * Para cada cliente suscrito:
 *  1. Analiza su historial de ventas.
 *  2. Estima la duración de los productos comprados.
 *  3. Detecta qué productos probablemente ya se agotaron.
 *  4. Obtiene recomendaciones de productos relacionados.
 *  5. Usa Gemini para generar el texto del push personalizado.
 *  6. Envía la notificación solo a ese cliente.
 *
 * Body (JSON):
 *  { perfil_id?: string }   — si se omite, se procesan todos los suscritos activos.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as webpush from "web-push";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── Config ──────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@lacosmetikera.com";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── Duración estimada de consumo por categoría (días) ──────────────────

const DURACION_CATALOGO: Array<{ palabras: string[]; dias: number }> = [
  { palabras: ["tinte", "coloracion", "color", "decoloración", "mechas"],    dias: 35  },
  { palabras: ["shampoo", "champú", "acondicionador", "tratamiento capilar"], dias: 45  },
  { palabras: ["crema corporal", "crema hidratante", "humectante", "loción"], dias: 45  },
  { palabras: ["sérum", "serum", "ampolla", "vitamina c"],                    dias: 30  },
  { palabras: ["mascarilla", "mask", "barro", "arcilla"],                     dias: 21  },
  { palabras: ["base", "polvo", "rubor", "sombra", "maquillaje", "bb cream"], dias: 90  },
  { palabras: ["esmalte", "nail", "uñas", "gel uñas"],                        dias: 90  },
  { palabras: ["perfume", "colonia", "fragancia", "eau de"],                  dias: 120 },
  { palabras: ["labial", "lip", "bálsamo labial", "gloss"],                   dias: 60  },
  { palabras: ["crema facial", "facial", "contorno"],                         dias: 40  },
  { palabras: ["jabón", "gel de baño", "espuma"],                             dias: 30  },
  { palabras: ["protector solar", "solar", "spf"],                            dias: 60  },
  { palabras: ["depilación", "cera", "depilatorio"],                          dias: 30  },
];

const DURACION_DEFECTO = 60;

function estimarDuracion(nombre: string, categoria: string | null): number {
  const haystack = `${nombre} ${categoria || ""}`.toLowerCase();
  for (const entry of DURACION_CATALOGO) {
    if (entry.palabras.some((p) => haystack.includes(p))) return entry.dias;
  }
  return DURACION_DEFECTO;
}

// ─── Tipos ───────────────────────────────────────────────────────────────

type VentaItem = { id?: string; nombre?: string; cantidad?: number };

type Articulo = {
  id: string;
  nombre: string | null;
  categoria: string | null;
  marca: string | null;
  precio_venta: number | null;
  stock: number | null;
  stock_minimo: number | null;
  descuento_porcentaje?: number | null;
};

type Suscripcion = {
  endpoint: string;
  p256dh: string;
  auth: string;
  perfil_id: string | null;
};

type Perfil = {
  id: string;
  nombre_completo: string;
  puntos_fidelidad: number | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────

function toItems(v: unknown): VentaItem[] {
  if (!Array.isArray(v)) return [];
  return v.filter((i) => i && typeof i === "object") as VentaItem[];
}

function safeNum(v: unknown, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function normalize(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

function diasDesde(fechaIso: string): number {
  return Math.floor((Date.now() - new Date(fechaIso).getTime()) / 86_400_000);
}

async function generarTextoIA(
  nombre: string,
  productoAgotado: string | null,
  recomendaciones: string[],
): Promise<{ title: string; body: string }> {
  if (!GEMINI_API_KEY) {
    return {
      title: "Tu próximo favorito te espera 💄",
      body: `${nombre.split(" ")[0]}, tenemos productos perfectos para ti. ¡Ven a conocerlos!`,
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Eres el asistente de marketing de La Cosmetikera, una tienda de cosméticos.
Escribe una notificación push personalizada en español colombiano para esta clienta.
REGLAS:
- title: máximo 50 caracteres, llamativo y personal.
- body: máximo 100 caracteres, menciona al menos un producto o categoría, añade urgencia suave.
- Tono: cercano, femenino, sin exagerar.
- NO uses signos de moneda ni precios.
- Devuelve SOLO JSON válido con estas dos claves: {"title":"...","body":"..."}

Datos de la clienta:
- Nombre: ${nombre.split(" ")[0]}
${productoAgotado ? `- Producto que probablemente ya terminó: ${productoAgotado}` : ""}
${recomendaciones.length > 0 ? `- Productos recomendados para ella: ${recomendaciones.slice(0, 3).join(", ")}` : ""}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    const fenced = text.match(/```json\s*([\s\S]*?)```/i)?.[1] ?? text;
    const start = fenced.indexOf("{");
    const end = fenced.lastIndexOf("}");
    const parsed = JSON.parse(fenced.slice(start, end + 1));

    return {
      title: String(parsed.title || "").slice(0, 60),
      body: String(parsed.body || "").slice(0, 120),
    };
  } catch {
    // Fallback si Gemini falla
    return {
      title: "Tus productos favoritos te esperan 💄",
      body: `${nombre.split(" ")[0]}, basado en tus compras tenemos algo especial para ti.`,
    };
  }
}

// ─── Handler principal ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "Faltan claves VAPID (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)" },
      { status: 500 }
    );
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const body = await request.json().catch(() => ({}));
  const perfilIdFiltro: string | null = typeof body?.perfil_id === "string" ? body.perfil_id.trim() : null;

  const supabase = getSupabase();

  // 1. Obtener suscripciones activas (filtradas por cliente si se especificó)
  const susQuery = supabase
    .from("web_push_subscriptions")
    .select("endpoint,p256dh,auth,perfil_id")
    .eq("active", true)
    .not("perfil_id", "is", null);

  if (perfilIdFiltro) {
    susQuery.eq("perfil_id", perfilIdFiltro);
  }

  const { data: suscripciones, error: susError } = await susQuery.limit(500);
  if (susError) {
    return NextResponse.json({ error: susError.message }, { status: 500 });
  }

  const rows = (suscripciones || []) as Suscripcion[];
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, enviadas: 0, sin_historial: 0, detalle: "Sin suscripciones activas" });
  }

  // 2. Agrupar suscripciones por perfil_id (un cliente puede tener varios dispositivos)
  const porPerfil = new Map<string, Suscripcion[]>();
  for (const row of rows) {
    if (!row.perfil_id) continue;
    const arr = porPerfil.get(row.perfil_id) ?? [];
    arr.push(row);
    porPerfil.set(row.perfil_id, arr);
  }

  // 3. Cargar catálogo de artículos con stock
  const { data: articulosData } = await supabase
    .from("articulos")
    .select("id,nombre,categoria,marca,precio_venta,stock,stock_minimo,descuento_porcentaje")
    .gt("stock", 0)
    .limit(600);

  const articulos: Articulo[] = (articulosData ?? []) as Articulo[];
  const articuloMap = new Map(articulos.map((a) => [a.id, a]));

  // 4. Cargar perfiles de los clientes en un batch
  const perfilIds = [...porPerfil.keys()];
  const { data: perfilesData } = await supabase
    .from("perfiles")
    .select("id,nombre_completo,puntos_fidelidad")
    .in("id", perfilIds);

  const perfilMap = new Map<string, Perfil>(
    ((perfilesData ?? []) as Perfil[]).map((p) => [p.id, p])
  );

  // 5. Fecha de corte: no considerar compras de más de 180 días
  const fechaCorte = new Date(Date.now() - 180 * 86_400_000).toISOString();

  let enviadas = 0;
  let sinHistorial = 0;
  const toDeactivate: string[] = [];
  const resultados: Array<{ perfil_id: string; estado: string; mensaje?: string }> = [];

  for (const [perfilId, subs] of porPerfil) {
    const perfil = perfilMap.get(perfilId);
    if (!perfil) continue;

    // 6. Obtener compras del cliente
    const { data: ventasData } = await supabase
      .from("ventas")
      .select("id,fecha,items")
      .eq("cliente_id", perfilId)
      .gte("fecha", fechaCorte)
      .order("fecha", { ascending: false })
      .limit(80);

    const ventas = ventasData ?? [];

    if (ventas.length === 0) {
      sinHistorial++;
      resultados.push({ perfil_id: perfilId, estado: "sin_historial" });
      continue;
    }

    // 7. Calcular último producto comprado con estimación de agotamiento
    // Estructura: Map<articuloId, { nombre, ultimaFechaIso, diasDesdeCompra, duracionEstimada }>
    const ultimaCompra = new Map<string, { nombre: string; fecha: string; diasTranscurridos: number; duracion: number }>();

    for (const venta of ventas) {
      const items = toItems(venta.items);
      for (const item of items) {
        const id = String(item.id || "").trim();
        if (!id) continue;

        const ya = ultimaCompra.get(id);
        if (!ya || venta.fecha > ya.fecha) {
          const articulo = articuloMap.get(id);
          const nombre = articulo?.nombre ?? String(item.nombre ?? "");
          const duracion = articulo
            ? estimarDuracion(articulo.nombre ?? nombre, articulo.categoria)
            : estimarDuracion(nombre, null);

          ultimaCompra.set(id, {
            nombre,
            fecha: String(venta.fecha || ""),
            diasTranscurridos: diasDesde(String(venta.fecha || "")),
            duracion,
          });
        }
      }
    }

    // 8. Encontrar el producto más probable de haberse agotado
    //    Criterio: diasTranscurridos >= duracion * 0.85 (85% del tiempo de uso)
    let productoAgotado: string | null = null;
    let maxExceso = -Infinity;

    for (const [, info] of ultimaCompra) {
      const exceso = info.diasTranscurridos - info.duracion * 0.85;
      if (exceso > maxExceso) {
        maxExceso = exceso;
        productoAgotado = info.nombre;
      }
    }

    // Si ninguno supera el 85% del tiempo estimado, no enviamos push (el cliente
    // probablemente aún tiene productos vigentes, salvo que tenga pocas compras)
    const debeNotificar = maxExceso > 0 || ventas.length <= 2;
    if (!debeNotificar) {
      resultados.push({ perfil_id: perfilId, estado: "productos_vigentes" });
      continue;
    }

    // 9. Recomendar nuevos productos por afinidad de categoría/marca
    const categoryAffinity = new Map<string, number>();
    const brandAffinity = new Map<string, number>();
    const compradosIds = new Set<string>();

    for (const [, info] of ultimaCompra) {
      compradosIds.add(info.nombre); // usamos nombre como aproximación
    }
    for (const [id] of ultimaCompra) compradosIds.add(id);

    for (const venta of ventas) {
      const items = toItems(venta.items);
      for (const item of items) {
        const id = String(item.id || "");
        const articulo = articuloMap.get(id);
        if (!articulo) continue;
        const cat = normalize(articulo.categoria);
        const marca = normalize(articulo.marca);
        if (cat) categoryAffinity.set(cat, (categoryAffinity.get(cat) || 0) + 1);
        if (marca) brandAffinity.set(marca, (brandAffinity.get(marca) || 0) + 1);
      }
    }

    const recomendados = articulos
      .filter((a) => !compradosIds.has(a.id) && safeNum(a.stock) > safeNum(a.stock_minimo, 0))
      .map((a) => {
        const catScore = (categoryAffinity.get(normalize(a.categoria)) || 0) * 3;
        const marcaScore = (brandAffinity.get(normalize(a.marca)) || 0) * 2;
        const promoBonus = safeNum(a.descuento_porcentaje) > 0 ? 10 : 0;
        return { nombre: a.nombre || "", score: catScore + marcaScore + promoBonus };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((r) => r.nombre)
      .filter(Boolean);

    // 10. Generar texto con IA
    const { title, body: notifBody } = await generarTextoIA(
      perfil.nombre_completo,
      productoAgotado,
      recomendados
    );

    const payload = JSON.stringify({
      title,
      body: notifBody,
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: `smart-${perfilId}-${Date.now()}`,
      data: { url: "/club", perfil_id: perfilId },
    });

    // 11. Enviar a todos los dispositivos del cliente
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        enviadas++;
      } catch (err: unknown) {
        const statusCode = Number((err as Record<string, unknown>)?.statusCode ?? 0);
        if (statusCode === 404 || statusCode === 410) {
          toDeactivate.push(sub.endpoint);
        }
      }
    }

    resultados.push({ perfil_id: perfilId, estado: "enviada", mensaje: `${title} / ${notifBody}` });
  }

  // 12. Desactivar suscripciones expiradas
  if (toDeactivate.length > 0) {
    await supabase
      .from("web_push_subscriptions")
      .update({ active: false, updated_at: new Date().toISOString() })
      .in("endpoint", toDeactivate);
  }

  return NextResponse.json({
    ok: true,
    enviadas,
    sin_historial: sinHistorial,
    suscripciones_inactivas: toDeactivate.length,
    detalle: resultados,
  });
}
