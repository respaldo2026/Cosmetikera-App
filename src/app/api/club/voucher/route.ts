import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getRewardByKey, parseRewardCanjeDescription } from "@/constants/clubRewards";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zgqrhzuhrwudckweslzr.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findVoucherByCode(code: string) {
  const normalizedCode = code.trim().toUpperCase();
  const { data, error } = await supabaseAdmin
    .from("canjes")
    .select("id,perfil_id,puntos,valor_cop,descripcion,estado,created_at")
    .ilike("descripcion", `%${normalizedCode}%`)
    .limit(10);

  if (error) {
    throw error;
  }

  const voucher = (data || []).find((item) => parseRewardCanjeDescription(item.descripcion)?.code === normalizedCode);
  if (!voucher) {
    return null;
  }

  const meta = parseRewardCanjeDescription(voucher.descripcion);
  const reward = getRewardByKey(meta?.rewardKey);
  return {
    ...voucher,
    code: normalizedCode,
    rewardKey: reward?.key || meta?.rewardKey || null,
    rewardTitle: reward?.title || meta?.cleanDescription || voucher.descripcion,
    rewardIcon: reward?.icon || "🎁",
    cleanDescription: meta?.cleanDescription || voucher.descripcion,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { action, code, clienteId, ventaId } = await request.json();
    if (!action || !code) {
      return NextResponse.json({ error: "action y code son requeridos" }, { status: 400 });
    }

    const voucher = await findVoucherByCode(code);
    if (!voucher) {
      return NextResponse.json({ error: "Voucher no encontrado" }, { status: 404 });
    }

    if (clienteId && voucher.perfil_id !== clienteId) {
      return NextResponse.json({ error: "Este voucher pertenece a otro cliente" }, { status: 403 });
    }

    if (action === "validate") {
      if (voucher.estado === "redimido" || voucher.estado === "aplicado") {
        return NextResponse.json({ error: "Este voucher ya fue usado" }, { status: 409 });
      }

      return NextResponse.json({
        data: {
          id: voucher.id,
          perfilId: voucher.perfil_id,
          code: voucher.code,
          puntos: voucher.puntos,
          valueCop: voucher.valor_cop,
          status: voucher.estado || "emitido",
          rewardKey: voucher.rewardKey,
          rewardTitle: voucher.rewardTitle,
          rewardIcon: voucher.rewardIcon,
          description: voucher.cleanDescription,
        },
      });
    }

    if (action === "consume") {
      if (!clienteId || !ventaId) {
        return NextResponse.json({ error: "clienteId y ventaId son requeridos para consumir el voucher" }, { status: 400 });
      }
      if (voucher.estado === "redimido" || voucher.estado === "aplicado") {
        return NextResponse.json({ error: "Este voucher ya fue usado" }, { status: 409 });
      }

      const nextDescription = voucher.descripcion.includes(`Venta ${ventaId}`)
        ? voucher.descripcion
        : `${voucher.descripcion} · Venta ${ventaId}`;

      const { error } = await supabaseAdmin
        .from("canjes")
        .update({ estado: "redimido", descripcion: nextDescription })
        .eq("id", voucher.id)
        .eq("perfil_id", clienteId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Error inesperado" }, { status: 500 });
  }
}