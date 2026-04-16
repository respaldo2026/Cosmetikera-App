const { createClient } = require("@supabase/supabase-js");

// Configuración de Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno.");
  process.exit(1);
}

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
    console.log("   Ve a: https://app.supabase.com/project/[tu-project-ref]/auth/users");
    console.log(`   Y crea un usuario con:`);
    console.log(`   - Email: ${adminData.email}`);
    console.log(`   - Password: ${adminData.identificacion.replace(/\./g, '')}`);
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

createAdmin();
