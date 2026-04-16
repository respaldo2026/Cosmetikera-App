const { createClient } = require("@supabase/supabase-js");

// Configuración de Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jczwfsxwpitasutsqqla.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjendmc3h3cGl0YXN1dHNxcWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzExNjk1NDQsImV4cCI6MjA0Njc0NTU0NH0.gHjPQvLX6pxcA2C4YYLXz4jZuJ5KTlvSQUvC8KPl3G0";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function createAdmin() {
  try {
    console.log("🔐 Creando administrador...\n");

    // Datos del administrador
    const adminData = {
      identificacion: "1.000.000.001",
      nombre_completo: "Administrador Crystal",
      rol: "admin",
      email: "admin@academia.crystal",
      telefono: "300 000 0001",
    };

    // 1. Crear el perfil en la base de datos
    console.log("📝 Insertando perfil en perfiles...");
    const { data: perfil, error: perfilError } = await supabase
      .from("perfiles")
      .insert([adminData])
      .select()
      .single();

    if (perfilError) {
      console.error("❌ Error al crear perfil:", perfilError.message);
      return;
    }

    console.log("✅ Perfil creado exitosamente");
    console.log(`   ID: ${perfil.id}`);
    console.log(`   Nombre: ${perfil.nombre_completo}`);
    console.log(`   Email: ${perfil.email}\n`);

    // 2. Crear usuario en Supabase Auth
    console.log("🔐 Creando usuario en Supabase Auth...");
    
    // Nota: Para esto necesitarías tener permisos de admin en Supabase
    // Por ahora mostraremos las credenciales para que se creen manualmente si es necesario
    
    console.log("\n✅ Administrador creado correctamente!\n");
    console.log("📊 CREDENCIALES DE LOGIN:");
    console.log("━".repeat(50));
    console.log(`Usuario (Email): ${adminData.email}`);
    console.log(`Contraseña (Cédula): ${adminData.identificacion.replace(/\./g, '')}`);
    console.log("━".repeat(50));
    console.log("\n💡 Próximo paso: Crear el usuario en Supabase Auth");
    console.log("   Ve a: https://app.supabase.com/project/jczwfsxwpitasutsqqla/auth/users");
    console.log(`   Y crea un usuario con:`);
    console.log(`   - Email: ${adminData.email}`);
    console.log(`   - Password: ${adminData.identificacion.replace(/\./g, '')}`);
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

createAdmin();
