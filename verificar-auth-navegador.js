// ====================================================
// VERIFICAR AUTENTICACIÓN EN LA APP WEB
// ====================================================
// 
// INSTRUCCIONES:
// 1. Abre https://app.crystaldiamante.com/leads
// 2. Presiona F12 (Consola de Desarrollador)
// 3. Ve a la pestaña "Console"
// 4. Copia TODO este código y pégalo en la consola
// 5. Presiona Enter
// 6. Copia los resultados y envíamelos
//
// ====================================================

(async function verificarAuth() {
  console.log("====================================");
  console.log("🔍 VERIFICANDO AUTENTICACIÓN");
  console.log("====================================\n");
  
  try {
    // Obtener el cliente Supabase del window (si está disponible)
    const supabaseUrl = 'https://zfzhqxfsxtqsawyemkua.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmemhxeGZzeHRxc2F3eWVta3VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTczNzg3MzYsImV4cCI6MjAzMjk1NDczNn0.1rSy0r8HqWzGi6zVDZGljQOPXZw-2LzNdJJtJw3QrUo';
    
    // Importar createBrowserClient
    const { createBrowserClient } = await import('https://esm.sh/@supabase/ssr@0.5.2');
    const supabase = createBrowserClient(supabaseUrl, supabaseKey);
    
    console.log("✅ Cliente Supabase creado\n");
    
    // 1. VERIFICAR SESIÓN
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("❌ Error obteniendo sesión:", sessionError);
      return;
    }
    
    if (!sessionData.session) {
      console.error("❌ NO HAY SESIÓN ACTIVA");
      console.log("⚠️ Por favor, inicia sesión en la aplicación");
      return;
    }
    
    console.log("🔑 SESIÓN ACTIVA:");
    console.log("├─ User ID:", sessionData.session.user.id);
    console.log("├─ Email:", sessionData.session.user.email);
    console.log("├─ Role:", sessionData.session.user.role);
    console.log("└─ Aud:", sessionData.session.user.aud);
    console.log("");
    
    // 2. VERIFICAR PERFIL
    const userId = sessionData.session.user.id;
    const { data: perfil, error: perfilError } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (perfilError) {
      console.error("❌ Error obteniendo perfil:", perfilError.message);
      console.log("\n⚠️ TU USUARIO NO TIENE PERFIL EN LA TABLA 'perfiles'");
      console.log("Ejecuta este SQL en Supabase:");
      console.log(`
INSERT INTO perfiles (id, email, rol, nombre_completo)
VALUES (
  '${userId}',
  '${sessionData.session.user.email}',
  'admin',
  'TU NOMBRE AQUÍ'
);
      `);
      return;
    }
    
    console.log("👤 PERFIL:");
    console.log("├─ ID:", perfil.id);
    console.log("├─ Email:", perfil.email);
    console.log("├─ Rol:", perfil.rol);
    console.log("├─ Nombre:", perfil.nombre_completo);
    console.log("");
    
    // 3. VERIFICAR PERMISOS
    const rolesValidos = ['admin', 'director', 'administrativo'];
    const puedeEliminar = rolesValidos.includes(perfil.rol);
    
    console.log("🔒 PERMISOS:");
    console.log("├─ Rol actual:", perfil.rol);
    console.log("├─ Roles válidos:", rolesValidos.join(', '));
    console.log("└─ ¿Puede eliminar leads?", puedeEliminar ? "✅ SÍ" : "❌ NO");
    console.log("");
    
    if (!puedeEliminar) {
      console.error("❌ TU ROL NO PERMITE ELIMINAR LEADS");
      console.log("Ejecuta este SQL para cambiar tu rol:");
      console.log(`
UPDATE perfiles 
SET rol = 'admin' 
WHERE id = '${userId}';
      `);
      return;
    }
    
    // 4. PROBAR DELETE (con ID falso para no borrar nada real)
    console.log("🧪 PROBANDO PERMISOS DELETE...");
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const { error: deleteError } = await supabase
      .from('leads')
      .delete()
      .eq('id', fakeId);
    
    if (deleteError) {
      console.error("❌ ERROR AL INTENTAR DELETE:", deleteError);
      console.log("\nDetalles del error:");
      console.log("├─ Message:", deleteError.message);
      console.log("├─ Code:", deleteError.code);
      console.log("├─ Details:", deleteError.details);
      console.log("└─ Hint:", deleteError.hint);
    } else {
      console.log("✅ PERMISOS DELETE FUNCIONAN CORRECTAMENTE");
      console.log("(No se eliminó nada porque usamos un ID falso)\n");
    }
    
    // 5. LISTAR ALGUNOS LEADS
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, nombre, email, estado')
      .limit(3);
    
    if (leadsError) {
      console.error("❌ Error listando leads:", leadsError.message);
    } else {
      console.log("📋 ALGUNOS LEADS:", leads);
    }
    
    console.log("\n====================================");
    console.log("✅ DIAGNÓSTICO COMPLETO");
    console.log("====================================");
    
  } catch (error) {
    console.error("💥 ERROR EN DIAGNÓSTICO:", error);
  }
})();
