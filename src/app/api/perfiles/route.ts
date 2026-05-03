import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { sendClubWelcomeWhatsApp } from "@/utils/club-whatsapp";
import { requireAdmin } from "../_utils/admin-guard";
import { isMissingSupabaseRelationError } from "@/utils/supabase/optional";

const ENABLE_LEGACY_TEXT_WELCOME = process.env.WHATSAPP_PERFILES_TEXT_WELCOME === "true";

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

function normalizarTelefonoWhatsApp(telefono: string | null): string {
  const digits = String(telefono || "").replace(/\D/g, "").trim();
  if (!digits) return "";
  // Si viene en formato local CO (10 dígitos), anteponer 57 para Meta API.
  if (digits.length === 10) return `57${digits}`;
  return digits;
}

async function triggerClubWelcomeTemplate(args: {
  origin: string;
  perfilId: string;
  cedula: string;
  telefono: string;
}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    origin: args.origin,
    referer: `${args.origin}/ventas`,
  };

  const apiKey = process.env.WHATSAPP_API_KEY || process.env.AGENT_API_KEY;
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`${args.origin}/api/whatsapp/send-club-welcome`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        perfil_id: args.perfilId,
        cedula: args.cedula,
        telefono: args.telefono,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const json = await response.json().catch(() => ({}));
    return {
      ok: response.ok,
      alreadySent: Boolean((json as any)?.already_sent),
      message: String((json as any)?.message || ""),
      error: String((json as any)?.error || ""),
    };
  } catch (error) {
    return {
      ok: false,
      alreadySent: false,
      message: "",
      error: error instanceof Error ? error.message : "Error llamando send-club-welcome",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureMonitorEntryForClubWelcome(args: {
  supabase: ReturnType<typeof getAdminClient>;
  perfilId: string;
  telefono: string;
  nombre: string;
  cedula: string;
}) {
  const mensaje = `Plantilla pendiente: club_welcome_es | Bienvenida para ${args.nombre} | Cédula: ${args.cedula}`;

  await args.supabase
    .from("notificaciones_enviadas")
    .upsert(
      {
        perfil_id: args.perfilId,
        tipo: "bienvenida_club",
        telefono: args.telefono,
        mensaje,
        estado: "pendiente",
      },
      { onConflict: "perfil_id,tipo" }
    );

  const { data: existingTemplate } = await args.supabase
    .from("whatsapp_conversation_history")
    .select("id")
    .eq("perfil_id", args.perfilId)
    .eq("tipo_mensaje", "template")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existingTemplate?.id) {
    await args.supabase.from("whatsapp_conversation_history").insert({
      telefono: args.telefono,
      perfil_id: args.perfilId,
      rol: "agente",
      mensaje,
      tipo_mensaje: "template",
      intento: null,
    });
  }
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

    // Por defecto, la bienvenida del club se envía por plantilla (flujo dedicado /api/whatsapp/send-club-welcome).
    // Este envío de texto se mantiene solo como fallback legacy si se habilita explícitamente.
    if (rol === "cliente" && ENABLE_LEGACY_TEXT_WELCOME) {
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

    let welcomeWhatsappStatus: {
      sent: boolean;
      already_sent: boolean;
      error?: string;
    } | null = null;

    if (rol === "cliente") {
      const telefonoWhatsApp = normalizarTelefonoWhatsApp(telefonoNormalizado);
      const perfilId = String((data as any)?.id || "").trim();

      if (perfilId && telefonoWhatsApp && cedulaNormalizada) {
        const origin = new URL(request.url).origin;
        const trigger = await triggerClubWelcomeTemplate({
          origin,
          perfilId,
          cedula: cedulaNormalizada,
          telefono: telefonoWhatsApp,
        });

        welcomeWhatsappStatus = {
          sent: trigger.ok || trigger.alreadySent,
          already_sent: trigger.alreadySent,
          error:
            !trigger.ok && !trigger.alreadySent
              ? trigger.error || trigger.message || "No se pudo enviar bienvenida"
              : undefined,
        };

        if (!trigger.ok && !trigger.alreadySent) {
          console.warn("[POST /api/perfiles] Falló trigger de plantilla bienvenida, se crea fallback visible", trigger.error || trigger.message);
          try {
            await ensureMonitorEntryForClubWelcome({
              supabase,
              perfilId,
              telefono: telefonoWhatsApp,
              nombre: nombre_completo.trim(),
              cedula: cedulaNormalizada,
            });
          } catch (fallbackError) {
            console.warn("[POST /api/perfiles] Falló fallback para monitor WhatsApp", fallbackError);
          }
        }
      } else {
        welcomeWhatsappStatus = {
          sent: false,
          already_sent: false,
          error: "Datos insuficientes para enviar bienvenida (perfil/telefono/cedula)",
        };
      }
    }

    return NextResponse.json(
      {
        data,
        ...(rol === "cliente" ? { welcome_whatsapp: welcomeWhatsappStatus } : {}),
      },
      { status: 201 }
    );
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
