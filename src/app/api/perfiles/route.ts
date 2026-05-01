import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { sendClubWelcomeWhatsApp } from "@/utils/club-whatsapp";
import { requireAdmin } from "../_utils/admin-guard";
import { isMissingSupabaseRelationError } from "@/utils/supabase/optional";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function limpiarNumero(valor: unknown) {
  if (typeof valor !== "string") return null;
  const digits = valor.replace(/\D/g, "").trim();
  return digits || null;
}

function normalizarFechaNacimiento(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const raw = valor.trim();
  if (!raw) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
      return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    return null;
  }

  const dm = /^(\d{2})\/(\d{2})$/.exec(raw);
  if (!dm) return null;

  const day = Number(dm[1]);
  const month = Number(dm[2]);
  const dt = new Date(Date.UTC(2000, month - 1, day));
  if (dt.getUTCFullYear() !== 2000 || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return null;
  }

  return `2000-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizarPayload(body: Record<string, unknown>) {
  const payload = { ...body };

  if ("nombre_completo" in payload && typeof payload.nombre_completo === "string") {
    payload.nombre_completo = payload.nombre_completo.trim();
  }

  if ("cedula" in payload) payload.cedula = limpiarNumero(payload.cedula);
  if ("telefono" in payload) payload.telefono = limpiarNumero(payload.telefono);
  if ("telefono_2" in payload) delete payload.telefono_2;

  return payload;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rol = searchParams.get("rol") || "cliente";

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("perfiles")
      .select("id,nombre_completo,telefono,email,cedula,puntos_fidelidad,nivel_fidelidad,fecha_nacimiento,activo,created_at")
      .eq("rol", rol)
      .order("nombre_completo");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[GET /api/perfiles]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const body = normalizarPayload(await request.json());
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("perfiles")
      .update(body)
      .eq("id", id)
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (err) {
    console.error("[PATCH /api/perfiles]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      nombre_completo,
      telefono,
      email,
      cedula,
      fecha_nacimiento,
      rol = "cliente",
      puntos_fidelidad = 0,
      nivel_fidelidad = "bronce",
      puntos_ganados = 0,
      activo = true,
    } = body;

    const cedulaNormalizada = limpiarNumero(cedula);
    const telefonoNormalizado = limpiarNumero(telefono);
    const fechaNacimientoNormalizada = normalizarFechaNacimiento(fecha_nacimiento);

    if (!nombre_completo?.trim()) {
      return NextResponse.json(
        { error: "nombre_completo es obligatorio" },
        { status: 400 }
      );
    }

    if (!cedulaNormalizada) {
      return NextResponse.json(
        { error: "La cédula es obligatoria — es uno de los accesos al portal Club" },
        { status: 400 }
      );
    }

    if (!/^\d{4,15}$/.test(cedulaNormalizada)) {
      return NextResponse.json(
        { error: "La cédula debe contener solo dígitos (4-15 caracteres)" },
        { status: 400 }
      );
    }

    if (!telefonoNormalizado) {
      return NextResponse.json(
        { error: "El teléfono principal es obligatorio" },
        { status: 400 }
      );
    }

    if (!/^\d{7,15}$/.test(telefonoNormalizado)) {
      return NextResponse.json(
        { error: "El teléfono principal debe contener solo dígitos (7-15 caracteres)" },
        { status: 400 }
      );
    }

    if (!fechaNacimientoNormalizada) {
      return NextResponse.json(
        { error: "El cumpleaños (día/mes) es obligatorio y debe tener formato DD/MM" },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("perfiles")
      .insert({
        nombre_completo: nombre_completo.trim(),
        telefono: telefonoNormalizado,
        email: email || null,
        cedula: cedulaNormalizada,
        fecha_nacimiento: fechaNacimientoNormalizada,
        rol,
        puntos_fidelidad,
        nivel_fidelidad,
        puntos_ganados,
        activo,
      })
      .select("id,nombre_completo,rol")
      .single();

    if (error) {
      console.error("[POST /api/perfiles]", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (rol === "cliente") {
      try {
        await sendClubWelcomeWhatsApp({
          nombre: nombre_completo.trim(),
          telefono: telefonoNormalizado,
          usuarioClub: cedulaNormalizada,
        });
      } catch (whatsappError) {
        console.warn("[POST /api/perfiles] No se pudo enviar WhatsApp de bienvenida", whatsappError);
      }
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/perfiles] unexpected", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const adminCheck = await requireAdmin(request);
    if (!adminCheck.ok) return adminCheck.response;

    const { searchParams } = new URL(request.url);
    const id = String(searchParams.get("id") || "").trim();
    if (!id) {
      return NextResponse.json({ error: "id requerido" }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { data: perfil, error: perfilError } = await supabase
      .from("perfiles")
      .select("id,telefono,rol")
      .eq("id", id)
      .maybeSingle();

    if (perfilError) {
      return NextResponse.json({ error: perfilError.message }, { status: 400 });
    }

    if (!perfil?.id) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const telefono = String((perfil as any).telefono || "").replace(/\D/g, "");

    const cascadeDeletes: any[] = [
      supabase.from("ventas").delete().eq("cliente_id", id),
      supabase.from("movimientos_financieros").delete().eq("estudiante_id", id),
      supabase.from("movimientos_financieros").delete().eq("proveedor_id", id),
      supabase.from("puntos_historial").delete().eq("perfil_id", id),
      supabase.from("canjes").delete().eq("perfil_id", id),
      supabase.from("club_inscripciones").delete().eq("perfil_id", id),
      supabase.from("notificaciones_enviadas").delete().eq("perfil_id", id),
      supabase.from("whatsapp_conversation_history").delete().eq("perfil_id", id),
      supabase.from("whatsapp_customer_memory").delete().eq("perfil_id", id),
    ];

    if (telefono) {
      cascadeDeletes.push(
        supabase.from("whatsapp_conversation_history").delete().ilike("telefono", `%${telefono.slice(-10)}%`),
        supabase.from("whatsapp_customer_memory").delete().ilike("telefono", `%${telefono.slice(-10)}%`),
        supabase.from("agent_conversations").delete().ilike("phone_number", `%${telefono.slice(-10)}%`),
      );
    }

    const cascadeResults = await Promise.all(cascadeDeletes);
    const blockingErrors = cascadeResults
      .map((r) => r?.error)
      .filter((err) => err && !isMissingSupabaseRelationError(err));

    if (blockingErrors.length > 0) {
      return NextResponse.json(
        { error: blockingErrors.map((err: any) => err.message).join(" | ") },
        { status: 400 }
      );
    }

    const { error: deletePerfilError } = await supabase.from("perfiles").delete().eq("id", id);
    if (deletePerfilError) {
      return NextResponse.json({ error: deletePerfilError.message }, { status: 400 });
    }

    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(id);
    if (deleteAuthError) {
      const msg = String(deleteAuthError.message || "").toLowerCase();
      if (!msg.includes("not") && !msg.includes("exist") && !msg.includes("found")) {
        return NextResponse.json({ error: deleteAuthError.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/perfiles]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
