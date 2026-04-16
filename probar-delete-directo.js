// ====================================================
// PROBAR DELETE DESDE LA CONSOLA DEL NAVEGADOR
// ====================================================
// 
// Ejecuta esto en la consola (F12) mientras estás en
// https://app.crystaldiamante.com/leads
//
// Esto usa el cliente Supabase que YA ESTÁ en tu app
// ====================================================

(async function probarDelete() {
  console.log("====================================");
  console.log("🧪 PROBANDO DELETE DE LEAD");
  console.log("====================================\n");
  
  try {
    // Importar el módulo
    const supabaseModule = await import('/src/utils/supabase/client.ts');
    const { supabaseBrowserClient } = supabaseModule;
    
    console.log("✅ Cliente Supabase obtenido de la app\n");
    
    // 1. Verificar sesión actual
    const { data: sessionData } = await supabaseBrowserClient.auth.getSession();
    
    console.log("🔑 SESIÓN:");
    console.log("├─ User ID:", sessionData?.session?.user?.id || "❌ NO HAY SESIÓN");
    console.log("└─ Email:", sessionData?.session?.user?.email || "❌ NO HAY EMAIL");
    console.log("");
    
    if (!sessionData?.session) {
      console.error("❌ NO HAY SESIÓN ACTIVA");
      return;
    }
    
    // 2. Listar algunos leads
    console.log("📋 LISTANDO LEADS...");
    const { data: leads, error: listError } = await supabaseBrowserClient
      .from('leads')
      .select('id, nombre, email, estado')
      .limit(5);
    
    if (listError) {
      console.error("❌ Error listando leads:", listError);
      return;
    }
    
    console.log(`✅ Encontrados ${leads.length} leads:`);
    leads.forEach((lead, i) => {
      console.log(`  ${i+1}. ${lead.nombre} (${lead.email || 'sin email'}) - ID: ${lead.id}`);
    });
    console.log("");
    
    // 3. Intentar DELETE con ID falso (no borra nada real)
    console.log("🧪 PROBANDO DELETE CON ID FALSO...");
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const { error: deleteError1 } = await supabaseBrowserClient
      .from('leads')
      .delete()
      .eq('id', fakeId);
    
    if (deleteError1) {
      console.error("❌ ERROR EN DELETE:", deleteError1);
      console.log("\n🔍 DETALLES:");
      console.log("├─ Message:", deleteError1.message);
      console.log("├─ Code:", deleteError1.code);
      console.log("├─ Details:", deleteError1.details);
      console.log("└─ Hint:", deleteError1.hint);
      console.log("\n❌ NO PUEDES ELIMINAR LEADS");
      console.log("Problema: Las políticas RLS están bloqueando la eliminación");
      return;
    }
    
    console.log("✅ DELETE funcionó (0 registros afectados porque era ID falso)\n");
    
    // 4. OPCIONAL: Eliminar el primer lead real (descomenta si quieres probarlo)
    console.log("💡 PARA ELIMINAR UN LEAD REAL:");
    console.log("Descomenta las líneas al final del script\n");
    
    /*
    if (leads.length > 0) {
      const leadToDelete = leads[0];
      console.log(`🗑️ ELIMINANDO: ${leadToDelete.nombre}...`);
      
      const { error: deleteError2 } = await supabaseBrowserClient
        .from('leads')
        .delete()
        .eq('id', leadToDelete.id);
      
      if (deleteError2) {
        console.error("❌ ERROR:", deleteError2);
      } else {
        console.log("✅ LEAD ELIMINADO CORRECTAMENTE");
      }
    }
    */
    
    console.log("====================================");
    console.log("✅ PRUEBA COMPLETADA");
    console.log("====================================");
    
  } catch (error) {
    console.error("💥 ERROR:", error);
  }
})();
