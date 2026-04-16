// ====================================================
// DIAGNÓSTICO DE CLIENTE SUPABASE EN EL NAVEGADOR
// ====================================================
// Copia y pega esto en la consola del navegador (F12)
// mientras estás en la página de leads

(async function diagnosticarSupabase() {
  console.log("🔍 Iniciando diagnóstico...");
  
  try {
    // 1. Verificar que el cliente existe
    const { createBrowserClient } = await import('@supabase/ssr');
    console.log("✅ Cliente Supabase importado");
    
    // Crear cliente
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zfzhqxfsxtqsawyemkua.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmenhxeGZzeHRxc2F3eWVta3VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTczNzg3MzYsImV4cCI6MjAzMjk1NDczNn0.1rSy0r8HqWzGi6zVDZGljQOPXZw-2LzNdJJtJw3QrUo'
    );
    
    // 2. Verificar sesión
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("❌ Error obteniendo sesión:", sessionError);
      return;
    }
    
    console.log("📋 Sesión:", {
      user_id: sessionData.session?.user?.id,
      email: sessionData.session?.user?.email,
      role: sessionData.session?.user?.role,
      aud: sessionData.session?.user?.aud
    });
    
    // 3. Verificar perfil
    const { data: perfil, error: perfilError } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', sessionData.session?.user?.id)
      .single();
    
    if (perfilError) {
      console.error("❌ Error obteniendo perfil:", perfilError);
    } else {
      console.log("👤 Perfil:", {
        id: perfil.id,
        email: perfil.email,
        rol: perfil.rol,
        nombre: perfil.nombre_completo
      });
    }
    
    // 4. Probar SELECT en leads
    const { data: leadsData, error: leadsError } = await supabase
      .from('leads')
      .select('id, nombre')
      .limit(1);
    
    if (leadsError) {
      console.error("❌ Error en SELECT leads:", leadsError);
    } else {
      console.log("✅ SELECT leads funciona:", leadsData);
    }
    
    // 5. Intentar DELETE de prueba con un ID inexistente
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const { error: deleteError } = await supabase
      .from('leads')
      .delete()
      .eq('id', fakeId);
    
    if (deleteError) {
      console.error("❌ Error en DELETE de prueba:", {
        message: deleteError.message,
        code: deleteError.code,
        details: deleteError.details,
        hint: deleteError.hint
      });
    } else {
      console.log("✅ DELETE funciona (ningún registro afectado, era ID falso)");
    }
    
    // 6. Verificar headers del cliente
    console.log("🔑 Cliente configurado con:");
    console.log("- URL:", supabase.supabaseUrl);
    console.log("- Key (primeros 20 chars):", supabase.supabaseKey?.substring(0, 20) + "...");
    
    console.log("\n✅ Diagnóstico completo");
    
  } catch (error) {
    console.error("💥 Error en diagnóstico:", error);
  }
})();
