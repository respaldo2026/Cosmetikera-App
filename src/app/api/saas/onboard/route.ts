import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeTenantSlug } from "@/utils/tenant/tenant-context";

type OnboardBody = {
  storeName?: string;
  tenantSlug?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPassword?: string;
  ownerPhone?: string;
};

function buildAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !key) {
    throw new Error("Faltan variables de Supabase para onboarding");
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function validateBody(body: OnboardBody) {
  const storeName = String(body.storeName || "").trim();
  const ownerName = String(body.ownerName || "").trim();
  const ownerEmail = String(body.ownerEmail || "").trim().toLowerCase();
  const ownerPassword = String(body.ownerPassword || "").trim();
  const ownerPhone = String(body.ownerPhone || "").trim();

  const rawSlug = String(body.tenantSlug || "").trim().toLowerCase();
  const tenantSlug = normalizeTenantSlug(rawSlug);

  if (!storeName || !ownerName || !ownerEmail || !ownerPassword || !rawSlug) {
    throw new Error("Todos los campos obligatorios deben completarse");
  }

  if (tenantSlug === "default") {
    throw new Error("Debes ingresar un slug válido para la tienda");
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenantSlug)) {
    throw new Error("El slug solo permite letras minúsculas, números y guiones");
  }

  if (!ownerEmail.includes("@")) {
    throw new Error("Email de administrador inválido");
  }

  if (ownerPassword.length < 6) {
    throw new Error("La contraseña debe tener mínimo 6 caracteres");
  }

  return {
    storeName,
    tenantSlug,
    ownerName,
    ownerEmail,
    ownerPassword,
    ownerPhone,
  };
}

export async function POST(request: NextRequest) {
  try {
    if ((process.env.SAAS_ONBOARDING_ENABLED || "true").toLowerCase() === "false") {
      return NextResponse.json(
        { success: false, error: "El onboarding de tiendas está deshabilitado" },
        { status: 403 },
      );
    }

    const body = (await request.json()) as OnboardBody;
    const payload = validateBody(body);

    const supabaseAdmin = buildAdminClient();

    const { data: existingTenant, error: existingTenantError } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("slug", payload.tenantSlug)
      .maybeSingle();

    if (existingTenantError) {
      return NextResponse.json(
        { success: false, error: `No se pudo validar slug: ${existingTenantError.message}` },
        { status: 500 },
      );
    }

    if (existingTenant?.id) {
      return NextResponse.json(
        { success: false, error: "Ese slug ya está en uso. Elige otro." },
        { status: 409 },
      );
    }

    const { data: tenantData, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .insert({
        slug: payload.tenantSlug,
        nombre: payload.storeName,
        estado: "active",
        metadata: { onboarding: true },
      })
      .select("id,slug")
      .single();

    if (tenantError || !tenantData?.id) {
      return NextResponse.json(
        { success: false, error: `No se pudo crear la tienda: ${tenantError?.message || "error desconocido"}` },
        { status: 500 },
      );
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: payload.ownerEmail,
      password: payload.ownerPassword,
      email_confirm: true,
      user_metadata: {
        nombre_completo: payload.ownerName,
        rol: "administrador",
        telefono: payload.ownerPhone || null,
      },
    });

    if (userError || !userData.user?.id) {
      await supabaseAdmin.from("tenants").delete().eq("id", tenantData.id);
      return NextResponse.json(
        { success: false, error: `No se pudo crear el usuario administrador: ${userError?.message || "error desconocido"}` },
        { status: 500 },
      );
    }

    const userId = userData.user.id;

    const { error: membershipError } = await supabaseAdmin.from("tenant_memberships").insert({
      tenant_id: tenantData.id,
      user_id: userId,
      role: "owner",
      is_default: true,
      metadata: { created_by: "self_onboarding" },
    });

    if (membershipError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      await supabaseAdmin.from("tenants").delete().eq("id", tenantData.id);
      return NextResponse.json(
        { success: false, error: `No se pudo asociar el usuario a la tienda: ${membershipError.message}` },
        { status: 500 },
      );
    }

    const { error: profileError } = await supabaseAdmin.from("perfiles").upsert(
      {
        id: userId,
        tenant_id: tenantData.id,
        nombre_completo: payload.ownerName,
        email: payload.ownerEmail,
        telefono: payload.ownerPhone || null,
        rol: "administrador",
        activo: true,
      },
      { onConflict: "id" },
    );

    if (profileError) {
      return NextResponse.json(
        {
          success: true,
          warning: `Tienda creada, pero perfil incompleto: ${profileError.message}`,
          data: {
            tenantId: tenantData.id,
            tenantSlug: tenantData.slug,
            loginUrl: "/login",
          },
        },
        { status: 201 },
      );
    }

    const response = NextResponse.json(
      {
        success: true,
        data: {
          tenantId: tenantData.id,
          tenantSlug: tenantData.slug,
          loginUrl: "/login",
        },
        message: "Tienda creada correctamente. Ya puedes iniciar sesión.",
      },
      { status: 201 },
    );

    response.cookies.set("lc_tenant", tenantData.slug, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Error interno creando tienda" },
      { status: 500 },
    );
  }
}
