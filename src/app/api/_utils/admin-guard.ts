import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

function normalizeRole(rawRole: unknown): string {
  let normalized = typeof rawRole === "string" ? rawRole.toLowerCase() : "";
  if (["admin", "director", "administrativo"].includes(normalized)) {
    normalized = "administrador";
  }
  if (["secretaria", "asesor"].includes(normalized)) {
    normalized = "vendedor";
  }
  if (["estudiante", "egresado"].includes(normalized)) {
    normalized = "cliente";
  }
  return normalized;
}

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function requireAdmin(
  request: NextRequest
): Promise<{ ok: true; userId: string } | { ok: false; response: NextResponse }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Configuración de Supabase incompleta" }, { status: 500 }),
    };
  }

  const admin = getAdminClient();
  let userId: string | null = null;

  // 1. Intentar verificar por Bearer token (Authorization header)
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (bearerToken) {
    const { data: userData, error: userError } = await admin.auth.getUser(bearerToken);
    if (!userError && userData.user?.id) {
      userId = userData.user.id;
    }
  }

  // 2. Fallback: verificar por cookies de sesión
  if (!userId) {
    const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // No se requiere mutar cookies en este flujo.
        },
      },
    });

    const { data: authData, error: authError } = await supabaseAuth.auth.getUser();
    if (!authError && authData.user?.id) {
      userId = authData.user.id;
    }
  }

  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }

  const { data: perfil, error: perfilError } = await admin
    .from("perfiles")
    .select("rol")
    .eq("id", userId)
    .maybeSingle();

  if (perfilError) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No se pudo validar rol" }, { status: 500 }),
    };
  }

  const role = normalizeRole((perfil as any)?.rol);
  if (role !== "administrador") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Permisos insuficientes" }, { status: 403 }),
    };
  }

  return { ok: true, userId };
}
