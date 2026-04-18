import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildRewardCanjeDescription,
  buildVoucherCode,
  getClubLevel,
  getEligibleRewards,
  getRewardByKey,
  parseRewardCanjeDescription,
} from "@/constants/clubRewards";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zgqrhzuhrwudckweslzr.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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
    const { perfilId, rewardKey } = await request.json();
    if (!perfilId || !rewardKey) {
      return NextResponse.json({ error: "perfilId y rewardKey son requeridos" }, { status: 400 });
    }

    const { data: client, error: clientError } = await supabaseAdmin
      .from("perfiles")
      .select("id,nombre_completo,puntos_fidelidad,puntos_canjeados,nivel_fidelidad,fecha_nacimiento")
      .eq("id", perfilId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: clientError?.message || "Cliente no encontrado" }, { status: 404 });
    }

    const reward = getRewardByKey(rewardKey);
    if (!reward) {
      return NextResponse.json({ error: "Recompensa no encontrada" }, { status: 404 });
    }

    const unlockedRewards = getEligibleRewards(client);
    if (!unlockedRewards.some((item) => item.key === reward.key)) {
      return NextResponse.json({ error: "No cumples las condiciones para esta recompensa" }, { status: 403 });
    }

    const voucherCode = buildVoucherCode();
    const currentPoints = client.puntos_fidelidad || 0;
    const nextPoints = currentPoints - reward.pointsCost;
    const nextLevel = getClubLevel(nextPoints);

    const { error: updateError } = await supabaseAdmin
      .from("perfiles")
      .update({
        puntos_fidelidad: nextPoints,
        puntos_canjeados: (client.puntos_canjeados || 0) + reward.pointsCost,
        nivel_fidelidad: nextLevel.key,
      })
      .eq("id", client.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { data: insertedCanje, error: insertError } = await supabaseAdmin
      .from("canjes")
      .insert({
        perfil_id: client.id,
        puntos: reward.pointsCost,
        valor_cop: reward.valueCop,
        descripcion: buildRewardCanjeDescription(reward, voucherCode),
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
      puntos: -reward.pointsCost,
      concepto: `Canje ${reward.title} · código ${voucherCode}`,
    });

    return NextResponse.json({ data: normalizeCanje(insertedCanje) });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Error inesperado" }, { status: 500 });
  }
}