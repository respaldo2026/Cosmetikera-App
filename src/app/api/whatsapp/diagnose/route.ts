import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

type CheckStatus = "ok" | "warn" | "fail";

type CheckResult = {
  name: string;
  status: CheckStatus;
  detail: string;
  action?: string;
  data?: Record<string, unknown>;
};

type GraphError = {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    type?: string;
    fbtrace_id?: string;
  };
  [key: string]: unknown;
};

const GRAPH_VERSION = "v21.0";
const CLUB_TEMPLATE_NAME =
  process.env.WHATSAPP_TEMPLATE_CLUB_WELCOME || "club_welcome_es";
const CLUB_TEMPLATE_LANG =
  process.env.WHATSAPP_TEMPLATE_CLUB_WELCOME_LANG || "es_ES";

function normalizeLang(value: string): string {
  return String(value || "")
    .trim()
    .replace("-", "_")
    .toLowerCase();
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function validateRequest(request: NextRequest): Promise<boolean> {
  const apiKey = request.headers.get("x-api-key") || "";
  const expectedKey = process.env.WHATSAPP_API_KEY || process.env.AGENT_API_KEY || "";

  if (expectedKey && apiKey === expectedKey) return true;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return false;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {},
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) return false;

  const admin = getAdminClient();
  if (!admin) return false;

  const { data: perfil } = await admin
    .from("perfiles")
    .select("rol")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();

  const rol = String((perfil as { rol?: string } | null)?.rol || "").toLowerCase();
  return rol === "admin" || rol === "superadmin";
}

async function graphGet(path: string, accessToken: string) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${path}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const json = (await response.json().catch(() => ({}))) as GraphError;
  return { ok: response.ok, status: response.status, json };
}

export async function GET(request: NextRequest) {
  try {
    if (!(await validateRequest(request))) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const checks: CheckResult[] = [];

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || "";
    const wabaId = process.env.WHATSAPP_WABA_ID || "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    const missing: string[] = [];
    if (!phoneNumberId) missing.push("WHATSAPP_PHONE_NUMBER_ID");
    if (!accessToken) missing.push("WHATSAPP_ACCESS_TOKEN");
    if (!wabaId) missing.push("WHATSAPP_WABA_ID");
    if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!supabaseAnon) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    if (!supabaseService) missing.push("SUPABASE_SERVICE_ROLE_KEY");

    if (missing.length > 0) {
      checks.push({
        name: "environment",
        status: "fail",
        detail: `Faltan variables: ${missing.join(", ")}`,
        action: "Configurar variables faltantes en Vercel y redeploy.",
      });
    } else {
      checks.push({
        name: "environment",
        status: "ok",
        detail: "Variables críticas presentes.",
      });
    }

    if (phoneNumberId && accessToken) {
      const phoneCheck = await graphGet(
        `${phoneNumberId}?fields=id,display_phone_number,verified_name,name_status,status_quality_rating`,
        accessToken,
      );

      if (!phoneCheck.ok) {
        checks.push({
          name: "meta_phone_access",
          status: "fail",
          detail: `Meta rechazó acceso al número (HTTP ${phoneCheck.status}). ${String(phoneCheck.json?.error?.message || "")}`,
          action: "Regenerar token con permisos whatsapp_business_messaging y verificar Phone Number ID.",
          data: {
            code: phoneCheck.json?.error?.code,
            subcode: phoneCheck.json?.error?.error_subcode,
          },
        });
      } else {
        checks.push({
          name: "meta_phone_access",
          status: "ok",
          detail: "Meta valida el token y acceso al número.",
          data: {
            phone_number_id: (phoneCheck.json as Record<string, unknown>)?.id,
            display_phone_number: (phoneCheck.json as Record<string, unknown>)?.display_phone_number,
            verified_name: (phoneCheck.json as Record<string, unknown>)?.verified_name,
            name_status: (phoneCheck.json as Record<string, unknown>)?.name_status,
            status_quality_rating: (phoneCheck.json as Record<string, unknown>)?.status_quality_rating,
          },
        });
      }
    }

    if (wabaId && accessToken) {
      const templateCheck = await graphGet(
        `${wabaId}/message_templates?fields=name,status,language,category,quality_score,rejected_reason&limit=200`,
        accessToken,
      );

      if (!templateCheck.ok) {
        checks.push({
          name: "meta_templates",
          status: "fail",
          detail: `No se pudieron consultar plantillas (HTTP ${templateCheck.status}). ${String(templateCheck.json?.error?.message || "")}`,
          action: "Validar WABA_ID y permisos del token.",
          data: {
            code: templateCheck.json?.error?.code,
            subcode: templateCheck.json?.error?.error_subcode,
          },
        });
      } else {
        const rows = Array.isArray((templateCheck.json as { data?: unknown[] }).data)
          ? ((templateCheck.json as { data: Array<Record<string, unknown>> }).data || [])
          : [];

        const club = rows.find((t) => String(t?.name || "") === CLUB_TEMPLATE_NAME);

        if (!club) {
          checks.push({
            name: "club_template_exists",
            status: "fail",
            detail: `No existe plantilla '${CLUB_TEMPLATE_NAME}' en Meta.`,
            action: "Crear o corregir WHATSAPP_TEMPLATE_CLUB_WELCOME.",
          });
        } else {
          const metaLang = String(club.language || "");
          const metaStatus = String(club.status || "");
          const langMatches = normalizeLang(metaLang) === normalizeLang(CLUB_TEMPLATE_LANG);

          if (metaStatus !== "APPROVED") {
            checks.push({
              name: "club_template_status",
              status: "fail",
              detail: `La plantilla '${CLUB_TEMPLATE_NAME}' está en estado ${metaStatus}.`,
              action: "Esperar aprobación o enviar otra plantilla aprobada.",
              data: { status: metaStatus, language: metaLang, rejected_reason: club.rejected_reason },
            });
          } else {
            checks.push({
              name: "club_template_status",
              status: "ok",
              detail: `Plantilla '${CLUB_TEMPLATE_NAME}' aprobada en Meta.`,
              data: { status: metaStatus, language: metaLang },
            });
          }

          if (!langMatches) {
            checks.push({
              name: "club_template_language",
              status: "fail",
              detail: `Idioma configurado '${CLUB_TEMPLATE_LANG}' no coincide con Meta '${metaLang}'.`,
              action: "Ajustar WHATSAPP_TEMPLATE_CLUB_WELCOME_LANG para que coincida exactamente.",
            });
          } else {
            checks.push({
              name: "club_template_language",
              status: "ok",
              detail: `Idioma de plantilla correcto (${metaLang}).`,
            });
          }
        }
      }
    }

    const admin = getAdminClient();
    if (!admin) {
      checks.push({
        name: "supabase_service",
        status: "fail",
        detail: "No se pudo crear cliente service-role de Supabase.",
        action: "Verificar NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.",
      });
    } else {
      const { data: notifRows, error: notifError } = await admin
        .from("notificaciones_enviadas")
        .select("estado,created_at")
        .eq("tipo", "bienvenida_club")
        .order("created_at", { ascending: false })
        .limit(50);

      if (notifError) {
        checks.push({
          name: "supabase_notifications",
          status: "fail",
          detail: `No se pudo leer notificaciones_enviadas: ${notifError.message}`,
          action: "Revisar schema/permisos de tabla notificaciones_enviadas.",
        });
      } else {
        const rows = (notifRows || []) as Array<{ estado?: string | null; created_at?: string | null }>;
        const sent = rows.filter((r) => String(r.estado || "").toLowerCase() === "enviado").length;
        const errorCount = rows.filter((r) => String(r.estado || "").toLowerCase() === "error").length;
        const pending = rows.filter((r) => String(r.estado || "").toLowerCase() === "pendiente").length;
        const processing = rows.filter((r) => String(r.estado || "").toLowerCase() === "procesando").length;

        checks.push({
          name: "supabase_notifications",
          status: "ok",
          detail: "Lectura de notificaciones_enviadas correcta.",
          data: {
            total_sample: rows.length,
            sent,
            error: errorCount,
            pending,
            processing,
            latest_created_at: rows[0]?.created_at || null,
          },
        });

        if (rows.length > 0 && sent === 0 && errorCount > 0) {
          checks.push({
            name: "welcome_flow_recent_health",
            status: "warn",
            detail: "Muestra reciente sin envíos exitosos y con errores.",
            action: "Revisar logs de /api/whatsapp/send-club-welcome para códigos de error Meta.",
          });
        }
      }
    }

    const failCount = checks.filter((c) => c.status === "fail").length;
    const warnCount = checks.filter((c) => c.status === "warn").length;

    return NextResponse.json({
      success: failCount === 0,
      summary: {
        fail: failCount,
        warn: warnCount,
        ok: checks.filter((c) => c.status === "ok").length,
      },
      config: {
        template_name: CLUB_TEMPLATE_NAME,
        template_language: CLUB_TEMPLATE_LANG,
        phone_number_id: phoneNumberId || null,
        waba_id: wabaId || null,
      },
      checks,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error interno",
      },
      { status: 500 },
    );
  }
}
