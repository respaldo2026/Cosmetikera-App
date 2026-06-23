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

function maskPhone(value: unknown) {
  if (typeof value !== "string") return "";
  const digits = value.replace(/\D/g, "").trim();
  if (digits.length < 4) return "";
  const visibleStart = digits.slice(0, Math.min(3, digits.length - 2));
  const visibleEnd = digits.slice(-2);
  const hidden = "•".repeat(Math.max(0, digits.length - visibleStart.length - visibleEnd.length));
  return `${visibleStart}${hidden}${visibleEnd}`;
}

function normalizeDigits(value: unknown) {
  return String(value || "").replace(/\D/g, "").trim();
}

/**
 * GET /api/club?acceso=1234567890
 * Busca el perfil de un cliente por cédula.
 * Usa service role para evitar problemas de RLS.
 */
export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await resolveTenantContext(request);
    const { searchParams } = new URL(request.url);
    const acceso = (searchParams.get("acceso") || searchParams.get("cedula") || "")
      .replace(/\D/g, "")
      .trim();

    if (!acceso) {
      return NextResponse.json({ error: "dato de acceso requerido" }, { status: 400 });
    }

    // Validar que sea solo dígitos (evitar inyecciones)
    if (!/^\d{4,15}$/.test(acceso)) {
      return NextResponse.json({ error: "Dato de acceso inválido" }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("perfiles")
      .select(
        "id,nombre_completo,telefono,cedula,puntos_fidelidad,puntos_canjeados,nivel_fidelidad,fecha_nacimiento"
      )
      .eq("tenant_id", tenantId)
      .eq("cedula", acceso)
      .eq("rol", "cliente")
      .or("activo.is.null,activo.eq.true")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[GET /api/club]", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        ...data,
        telefono: normalizeDigits(data.telefono),
        telefono_masked: maskPhone(data.telefono),
      },
    });
  } catch (err) {
    console.error("[GET /api/club] unexpected", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * GET /api/club/historial?perfil_id=UUID
 * Devuelve el historial de puntos del cliente.
 */
export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await resolveTenantContext(request);
    const { perfil_id } = await request.json();
    if (!perfil_id) return NextResponse.json({ error: "perfil_id requerido" }, { status: 400 });

    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("puntos_historial")
      .select("id,tipo,puntos,concepto,created_at")
      .eq("tenant_id", tenantId)
      .eq("perfil_id", perfil_id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data: data || [] });
  } catch (err) {
    console.error("[POST /api/club]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { tenantId } = await resolveTenantContext(request);
    const body = await request.json();
    const perfilId = String(body?.perfilId || "").trim();
    const acceso = normalizeDigits(body?.acceso);
    const nombreCompleto = String(body?.nombre_completo || "").trim().replace(/\s+/g, " ");
    const telefono = normalizeDigits(body?.telefono);

    if (!perfilId || !acceso) {
      return NextResponse.json({ error: "perfilId y acceso son requeridos" }, { status: 400 });
    }

    if (!nombreCompleto) {
      return NextResponse.json({ error: "El nombre completo es obligatorio" }, { status: 400 });
    }

    if (nombreCompleto.length < 3 || nombreCompleto.length > 120) {
      return NextResponse.json({ error: "Ingresa un nombre válido" }, { status: 400 });
    }

    if (!/^\d{7,15}$/.test(telefono)) {
      return NextResponse.json({ error: "Ingresa un número de teléfono válido" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { data: perfil, error } = await supabase
      .from("perfiles")
      .select("id,cedula,telefono,rol")
      .eq("id", perfilId)
      .eq("tenant_id", tenantId)
      .eq("rol", "cliente")
      .maybeSingle();

    if (error || !perfil) {
      return NextResponse.json({ error: error?.message || "Cliente no encontrado" }, { status: 404 });
    }

    if (normalizeDigits(perfil.cedula) !== acceso) {
      return NextResponse.json({ error: "Los datos de acceso no coinciden con este perfil" }, { status: 403 });
    }

    const { data: existingPhone, error: existingPhoneError } = await supabase
      .from("perfiles")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("telefono", telefono)
      .neq("id", perfilId)
      .limit(1)
      .maybeSingle();

    if (existingPhoneError) {
      return NextResponse.json({ error: existingPhoneError.message }, { status: 400 });
    }

    if (existingPhone?.id) {
      return NextResponse.json({ error: "Ese teléfono ya está registrado en otra cuenta" }, { status: 409 });
    }

    const oldPhone = normalizeDigits(perfil.telefono);
    const { data: updated, error: updateError } = await supabase
      .from("perfiles")
      .update({
        nombre_completo: nombreCompleto,
        telefono,
      })
      .eq("id", perfilId)
      .eq("tenant_id", tenantId)
      .select("id,nombre_completo,telefono,cedula,puntos_fidelidad,puntos_canjeados,nivel_fidelidad,fecha_nacimiento")
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: updateError?.message || "No se pudo actualizar el perfil" }, { status: 400 });
    }

    try {
      await supabase
        .from("whatsapp_customer_memory")
        .update({ nombre: nombreCompleto, telefono })
        .eq("perfil_id", perfilId)
        .eq("tenant_id", tenantId);

      if (oldPhone && oldPhone !== telefono) {
        await supabase
          .from("whatsapp_customer_memory")
          .update({ nombre: nombreCompleto, telefono })
          .eq("telefono", oldPhone)
          .eq("tenant_id", tenantId);
      }
    } catch {
      // No bloquear actualización del portal si la sincronización secundaria falla.
    }

    return NextResponse.json({
      data: {
        ...updated,
        telefono_masked: maskPhone(updated.telefono),
      },
    });
  } catch (err) {
    console.error("[PATCH /api/club]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
