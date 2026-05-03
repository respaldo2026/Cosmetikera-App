import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { normalizePhone } from "@/utils/whatsapp-memory";

type RetryRequestBody = {
  limit?: number;
  dry_run?: boolean;
};

type PerfilRow = {
  id: string;
  nombre_completo?: string | null;
  telefono?: string | null;
  cedula?: string | null;
  created_at?: string | null;
};

type NotificacionRow = {
  perfil_id?: string | null;
  estado?: string | null;
  created_at?: string | null;
};

/** Acepta x-api-key O sesión de Supabase autenticada */
async function isAuthorized(request: NextRequest): Promise<boolean> {
  // 1) API key
  const apiKey = request.headers.get("x-api-key") || "";
  const expected = process.env.WHATSAPP_API_KEY || process.env.AGENT_API_KEY || "";
  if (expected && apiKey === expected) return true;

  // 2) Sesión autenticada de Supabase (cualquier usuario logueado en la app)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return false;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll() {},
    },
  });

  const { data, error } = await supabase.auth.getUser();
  return !error && Boolean(data.user?.id);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function normalizeCedula(value: unknown): string {
  return String(value || "").replace(/\D/g, "").trim();
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthorized(request))) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as RetryRequestBody;
    const dryRun = body?.dry_run === true;
    const limit = Math.min(500, Math.max(1, Number(body?.limit || 100)));
    const scanLimit = Math.min(1000, Math.max(100, limit * 8));

    const supabase = getAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Faltan credenciales de Supabase service role" },
        { status: 500 }
      );
    }

    const { data: perfiles, error: perfilesError } = await supabase
      .from("perfiles")
      .select("id,nombre_completo,telefono,cedula,created_at")
      .eq("rol", "cliente")
      .order("created_at", { ascending: false })
      .limit(scanLimit);

    if (perfilesError) {
      return NextResponse.json(
        { success: false, error: perfilesError.message },
        { status: 400 }
      );
    }

    const perfilRows = (perfiles || []) as PerfilRow[];
    const perfilIds = perfilRows.map((p) => p.id).filter(Boolean);

    let latestByPerfil = new Map<string, NotificacionRow>();
    if (perfilIds.length > 0) {
      const { data: notifs, error: notifError } = await supabase
        .from("notificaciones_enviadas")
        .select("perfil_id,estado,created_at")
        .eq("tipo", "bienvenida_club")
        .in("perfil_id", perfilIds)
        .order("created_at", { ascending: false })
        .limit(scanLimit * 3);

      if (notifError) {
        return NextResponse.json(
          { success: false, error: notifError.message },
          { status: 400 }
        );
      }

      for (const row of (notifs || []) as NotificacionRow[]) {
        const pid = String(row.perfil_id || "").trim();
        if (!pid || latestByPerfil.has(pid)) continue;
        latestByPerfil.set(pid, row);
      }
    }

    const candidates = perfilRows
      .filter((perfil) => {
        const latest = latestByPerfil.get(perfil.id);
        const estado = String(latest?.estado || "").toLowerCase();
        return !latest || estado !== "enviado";
      })
      .slice(0, limit);

    const summary = {
      success: true,
      dry_run: dryRun,
      scanned: perfilRows.length,
      candidates: candidates.length,
      sent: 0,
      already_sent: 0,
      failed: 0,
      skipped_invalid: 0,
      details: [] as Array<Record<string, unknown>>,
    };

    const origin = new URL(request.url).origin;
    const apiKey = process.env.WHATSAPP_API_KEY || process.env.AGENT_API_KEY || "";

    for (const perfil of candidates) {
      const telefono = normalizePhone(String(perfil.telefono || ""));
      const cedula = normalizeCedula(perfil.cedula);

      if (!telefono || !cedula) {
        summary.skipped_invalid += 1;
        summary.details.push({
          perfil_id: perfil.id,
          nombre: perfil.nombre_completo || null,
          status: "skipped_invalid",
          reason: "telefono o cedula faltante",
        });
        continue;
      }

      if (dryRun) {
        summary.details.push({
          perfil_id: perfil.id,
          nombre: perfil.nombre_completo || null,
          telefono,
          status: "would_send",
        });
        continue;
      }

      // Pausa entre envíos para respetar rate-limits de Meta (~1 template/600ms en lotes)
      if (summary.sent + summary.failed > 0) {
        await sleep(600);
      }

      const res = await fetch(`${origin}/api/whatsapp/send-club-welcome`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          perfil_id: perfil.id,
          cedula,
          telefono,
        }),
        cache: "no-store",
      });

      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const alreadySent = Boolean(json?.already_sent);

      if (res.ok && alreadySent) {
        summary.already_sent += 1;
        summary.details.push({
          perfil_id: perfil.id,
          nombre: perfil.nombre_completo || null,
          status: "already_sent",
        });
        continue;
      }

      if (res.ok) {
        summary.sent += 1;
        summary.details.push({
          perfil_id: perfil.id,
          nombre: perfil.nombre_completo || null,
          status: "sent",
        });
        continue;
      }

      summary.failed += 1;
      summary.details.push({
        perfil_id: perfil.id,
        nombre: perfil.nombre_completo || null,
        status: "failed",
        error: String(json?.error || `HTTP ${res.status}`),
      });
    }

    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error interno",
      },
      { status: 500 }
    );
  }
}
