import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, resolveTenantContext } from "../../_utils/tenant-resolver";

export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await resolveTenantContext(request);
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId es requerido" }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();

    // 1) Obtener matrículas para borrar en cascada
    const { data: matriculas, error: errMatriculas } = await supabaseAdmin
      .from("matriculas")
      .select("id")
      .eq("estudiante_id", userId);

    if (errMatriculas) throw errMatriculas;

    const matriculaIds = matriculas?.map((m: any) => m.id) || [];

    if (matriculaIds.length > 0) {
      await supabaseAdmin.from("asistencias").delete().in("matricula_id", matriculaIds);
      await supabaseAdmin.from("calificaciones").delete().in("matricula_id", matriculaIds);
      await supabaseAdmin.from("pagos").delete().in("matricula_id", matriculaIds);
    }

    // 2) Borrar pagos directos del estudiante
    await supabaseAdmin.from("pagos").delete().eq("estudiante_id", userId);

    // 3) Borrar matrículas
    await supabaseAdmin.from("matriculas").delete().eq("estudiante_id", userId);

    // 4) Borrar perfil
    await supabaseAdmin.from("perfiles").delete().eq("tenant_id", tenantId).eq("id", userId);

    // 5) Borrar usuario auth
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authErr) {
      const msg = String(authErr.message || "").toLowerCase();
      if (!msg.includes("not exist") && !msg.includes("not found")) {
        throw authErr;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("🔴 Error borrando usuario:", error);
    return NextResponse.json({ success: false, error: error?.message || "Error desconocido" }, { status: 500 });
  }
}
