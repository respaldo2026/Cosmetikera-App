import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId es requerido" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ success: false, error: "Faltan llaves de Supabase" }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const errors: string[] = [];

    const safeUpdate = async (table: string, values: Record<string, any>, key: string) => {
      const { error } = await supabaseAdmin.from(table).update(values).eq(key, userId);
      if (error) errors.push(`${table}: ${error.message || "update_failed"}`);
    };

    const safeDelete = async (table: string, key: string) => {
      const { error } = await supabaseAdmin.from(table).delete().eq(key, userId);
      if (error) errors.push(`${table}: ${error.message || "delete_failed"}`);
    };

    await safeUpdate("cursos", { profesor_id: null }, "profesor_id");
    await safeUpdate("clases", { profesor_id: null }, "profesor_id");
    await safeUpdate("sesiones_clase", { profesor_id: null }, "profesor_id");
    await safeUpdate("grupos", { profesor_id: null }, "profesor_id");
    await safeUpdate("nomina", { profesor_id: null }, "profesor_id");
    await safeDelete("pagos_profesores", "profesor_id");
    await safeDelete("pagos_nomina", "profesor_id");
    await safeDelete("profesores_info", "perfil_id");

    const { error: perfilError } = await supabaseAdmin
      .from("perfiles")
      .delete()
      .eq("id", userId);

    let softDeleted = false;
    if (perfilError) {
      errors.push(`perfiles: ${perfilError.message || "delete_failed"}`);

      const softStrategies: Array<Record<string, any>> = [
        { activo: false },
        { rol: "administrativo" },
      ];

      let softErrorMessage = "";
      for (const strategy of softStrategies) {
        const { error: softError } = await supabaseAdmin
          .from("perfiles")
          .update(strategy)
          .eq("id", userId);

        if (!softError) {
          softDeleted = true;
          break;
        }

        softErrorMessage = softError.message || "soft_delete_failed";
        errors.push(`perfiles_soft: ${softErrorMessage}`);
      }

      if (!softDeleted) {
        throw new Error(`No se pudo eliminar ni desactivar el profesor: ${softErrorMessage || "error"}`);
      }
    }

    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authErr) {
      const msg = String(authErr.message || "").toLowerCase();
      if (!msg.includes("not exist") && !msg.includes("not found")) {
        errors.push(`auth: ${authErr.message || "delete_failed"}`);
      }
    }

    return NextResponse.json({ success: true, softDeleted, errors });
  } catch (error: any) {
    console.error("🔴 Error borrando profesor:", error);
    return NextResponse.json({ success: false, error: error?.message || "Error desconocido" }, { status: 500 });
  }
}
