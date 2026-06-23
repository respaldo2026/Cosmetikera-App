import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "../_utils/tenant-resolver";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// GET /api/fidelizacion/clientes - cargar lista de clientes con datos de fidelización
export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await resolveTenantContext(request);
    const supabase = getAdminClient();
    const { searchParams } = new URL(request.url);
    const clienteId = searchParams.get("clienteId");

    // Si se pide un cliente específico con sus canjes
    if (clienteId) {
      const { data: canjes, error: canjesError } = await supabase
        .from("canjes")
        .select("id,puntos,valor_cop,descripcion,created_at")
        .eq("tenant_id", tenantId)
        .eq("perfil_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (canjesError) {
        return NextResponse.json({ error: canjesError.message }, { status: 400 });
      }

      return NextResponse.json({ data: canjes || [] });
    }

    // Si no, retorna lista de clientes
    const { data, error } = await supabase
      .from("perfiles")
      .select(
        "id,nombre_completo,telefono,email,cedula,puntos_fidelidad,puntos_canjeados,puntos_ganados,nivel_fidelidad,fecha_nacimiento,total_compras,logros,racha_visitas,fecha_ultima_visita"
      )
      .eq("tenant_id", tenantId)
      .eq("rol", "cliente")
      .order("puntos_fidelidad", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[GET /api/fidelizacion]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/fidelizacion/canje - procesar canje de puntos
export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await resolveTenantContext(request);
    const { clienteId, puntosACanjear, valorDescuento, nivelKey } = await request.json();

    if (!clienteId || !puntosACanjear || valorDescuento === undefined) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Obtener cliente actual
    const { data: cliente, error: clienteError } = await supabase
      .from("perfiles")
      .select("puntos_fidelidad,puntos_canjeados")
      .eq("tenant_id", tenantId)
      .eq("id", clienteId)
      .single();

    if (clienteError || !cliente) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const nuevosPuntos = (cliente.puntos_fidelidad || 0) - puntosACanjear;

    // Actualizar perfiles
    const { error: updateError } = await supabase
      .from("perfiles")
      .update({
        puntos_fidelidad: nuevosPuntos,
        nivel_fidelidad: nivelKey,
        puntos_canjeados: (cliente.puntos_canjeados || 0) + puntosACanjear,
        tenant_id: tenantId,
      })
      .eq("tenant_id", tenantId)
      .eq("id", clienteId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Registrar canje
    const { error: canjeError } = await supabase.from("canjes").insert({
      tenant_id: tenantId,
      perfil_id: clienteId,
      puntos: puntosACanjear,
      valor_cop: valorDescuento,
      descripcion: `Canje ${puntosACanjear} pts = $${valorDescuento.toLocaleString()} de descuento`,
      estado: "aplicado",
    });

    if (canjeError) {
      return NextResponse.json({ error: canjeError.message }, { status: 400 });
    }

    // Registrar en puntos_historial
    const { error: historicoError } = await supabase.from("puntos_historial").insert({
      tenant_id: tenantId,
      perfil_id: clienteId,
      tipo: "canjeados",
      puntos: -puntosACanjear,
      concepto: `Canje por $${valorDescuento.toLocaleString()} de descuento`,
    });

    if (historicoError) {
      console.warn("[POST /api/fidelizacion] Error guardando histórico (no crítico):", historicoError);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/fidelizacion]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
