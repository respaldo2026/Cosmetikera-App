import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildRewardCanjeDescription,
  buildVoucherCode,
  getRewardByKey,
  parseRewardCanjeDescription,
} from "@/constants/clubRewards";
import { isRewardEligibleDynamic, getNivelDinamico, DEFAULT_REGLAS, type DynamicClubReward, type ClubReglas } from "@/hooks/useClubConfig";
import { isBirthdayMonth } from "@/constants/clubRewards";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zgqrhzuhrwudckweslzr.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function normalizePhone(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\D/g, "").trim();
}

function normalizeCanje(canje: any) {
  const meta = parseRewardCanjeDescription(canje.descripcion);
  const reward = getRewardByKey(meta?.rewardKey);
  return {
    id: canje.id,
    perfilId: canje.perfil_id,
    puntos: canje.puntos,
    valorCop: canje.valor_cop,
    estado: canje.estado || "emitido",
    createdAt: canje.created_at,
    description: meta?.cleanDescription || canje.descripcion,
    code: meta?.code || null,
    rewardKey: reward?.key || meta?.rewardKey || null,
    rewardTitle: reward?.title || meta?.cleanDescription || canje.descripcion,
    rewardIcon: reward?.icon || "🎁",
  };
}

export async function GET(request: NextRequest) {
  const perfilId = request.nextUrl.searchParams.get("perfil_id");
  if (!perfilId) {
    return NextResponse.json({ error: "perfil_id es requerido" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("canjes")
    .select("id,perfil_id,puntos,valor_cop,descripcion,estado,created_at")
    .eq("perfil_id", perfilId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: (data || []).map(normalizeCanje) });
}

export async function POST(request: NextRequest) {
  try {
    const { perfilId, rewardKey, telefonoVerificacion } = await request.json();
    if (!perfilId || !rewardKey || !telefonoVerificacion) {
      return NextResponse.json({ error: "perfilId, rewardKey y telefonoVerificacion son requeridos" }, { status: 400 });
    }

    // Cargar config dinámica (recompensas + reglas) desde la BD
    const [clientRes, configRes] = await Promise.all([
      supabaseAdmin
        .from("perfiles")
        .select("id,nombre_completo,telefono,puntos_fidelidad,puntos_canjeados,nivel_fidelidad,fecha_nacimiento")
        .eq("id", perfilId)
        .single(),
      supabaseAdmin
        .from("club_recompensas_config")
        .select("*")
        .eq("activa", true),
    ]);

    const [reglasDbRes] = await Promise.all([
      supabaseAdmin.from("club_reglas_config").select("clave,valor"),
    ]);

    if (clientRes.error || !clientRes.data) {
      return NextResponse.json({ error: clientRes.error?.message || "Cliente no encontrado" }, { status: 404 });
    }
    const client = clientRes.data;

    const telefonoIngresado = normalizePhone(telefonoVerificacion);
    const telefonoPrincipal = normalizePhone(client.telefono);

    if (!telefonoPrincipal) {
      return NextResponse.json({ error: "Este cliente no tiene teléfono registrado. Actualízalo antes de usar puntos." }, { status: 409 });
    }

    if (!telefonoIngresado || telefonoIngresado !== telefonoPrincipal) {
      return NextResponse.json({ error: "La segunda verificación por teléfono no coincide" }, { status: 403 });
    }

    // Construir reglas dinámicas (con fallback a defaults)
    const reglasRaw = reglasDbRes.data ?? [];
    const reglas: ClubReglas = { ...DEFAULT_REGLAS };
    for (const row of reglasRaw) {
      const num = Number(row.valor);
      if (Number.isFinite(num)) (reglas as any)[row.clave] = num;
    }

    // Buscar la recompensa en el catálogo dinámico
    const catalogoDinamico: DynamicClubReward[] = configRes.data ?? [];
    const reward = catalogoDinamico.find(r => r.key === rewardKey);
    if (!reward) {
      return NextResponse.json({ error: "Recompensa no encontrada en el catálogo activo" }, { status: 404 });
    }

    const esCumple = client.fecha_nacimiento ? isBirthdayMonth(client.fecha_nacimiento) : false;

    if (!isRewardEligibleDynamic(reward, client, reglas, esCumple)) {
      return NextResponse.json({ error: "No cumples las condiciones para esta recompensa" }, { status: 403 });
    }

    const voucherCode = buildVoucherCode();
    const currentPoints = client.puntos_fidelidad || 0;
    const nextPoints = currentPoints - reward.points_cost;
    const nextLevel = getNivelDinamico(nextPoints, reglas);

    // Construir ClubReward compatible para buildRewardCanjeDescription
    const rewardCompat = {
      key: reward.key,
      icon: reward.icon,
      title: reward.title,
      description: reward.description,
      category: reward.category,
      pointsCost: reward.points_cost,
      valueCop: reward.value_cop,
    };

    const { error: updateError } = await supabaseAdmin
      .from("perfiles")
      .update({
        puntos_fidelidad: nextPoints,
        puntos_canjeados: (client.puntos_canjeados || 0) + reward.points_cost,
        nivel_fidelidad: nextLevel,
      })
      .eq("id", client.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { data: insertedCanje, error: insertError } = await supabaseAdmin
      .from("canjes")
      .insert({
        perfil_id: client.id,
        puntos: reward.points_cost,
        valor_cop: reward.value_cop,
        descripcion: buildRewardCanjeDescription(rewardCompat as any, voucherCode),
        estado: "emitido",
      })
      .select("id,perfil_id,puntos,valor_cop,descripcion,estado,created_at")
      .single();

    if (insertError || !insertedCanje) {
      return NextResponse.json({ error: insertError?.message || "No se pudo emitir el voucher" }, { status: 500 });
    }

    await supabaseAdmin.from("puntos_historial").insert({
      perfil_id: client.id,
      tipo: "canjeados",
      puntos: -reward.points_cost,
      concepto: `Canje ${reward.title} · código ${voucherCode}`,
    });

    return NextResponse.json({ data: normalizeCanje(insertedCanje) });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error)?.message || "Error inesperado" }, { status: 500 });
  }
}