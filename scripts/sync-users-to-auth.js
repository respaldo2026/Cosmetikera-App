const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xqcsftjkvcrbcetrdulq.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhx Y3NmdGprdmNyYmNldHJkdWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU2ODA0MzQsImV4cCI6MjA1MTI1NjQzNH0.5Y9gJ8Ke-nqV_2h8RqQXH8vZOZXlZ8YjZKZRqGJXKZo";

// IMPORTANTE: Necesitas la Service Role Key (no la anon key)
// Esta la encuentras en: Supabase Dashboard → Settings → API → service_role key
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error("\n❌ ERROR: Falta SUPABASE_SERVICE_KEY");
  console.log("\n📋 PASOS:");
  console.log("1. Ve a: https://app.supabase.com → Tu proyecto → Settings → API");
  console.log("2. Copia el 'service_role' key (NO el anon key)");
  console.log("3. Ejecuta: $env:SUPABASE_SERVICE_KEY='tu_key_aqui' (Windows PowerShell)");
  console.log("   O: export SUPABASE_SERVICE_KEY='tu_key_aqui' (Mac/Linux)");
  console.log("4. Vuelve a ejecutar este script\n");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function syncAllUsers() {
  try {
    console.log("\n🔄 SINCRONIZANDO PERFILES → SUPABASE AUTH\n");

    // 1. Obtener todos los perfiles
    const { data: perfiles, error: errorPerfiles } = await supabase
      .from("perfiles")
      .select("id, nombre_completo, identificacion, email, rol")
      .not("email", "is", null);

    if (errorPerfiles) {
      console.error("❌ Error obteniendo perfiles:", errorPerfiles.message);
      return;
    }

    if (!perfiles || perfiles.length === 0) {
      console.log("⚠️  No hay perfiles con email en la base de datos");
      return;
    }

    console.log(`📋 Encontrados ${perfiles.length} perfiles con email\n`);

    let creados = 0;
    let yaExisten = 0;
    let errores = 0;

    for (const perfil of perfiles) {
      const email = perfil.email;
      const password = perfil.identificacion.replace(/\./g, ""); // Cédula sin puntos

      console.log(`👤 ${perfil.nombre_completo} (${email})...`);

      try {
        const { data, error } = await supabase.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true,
          user_metadata: {
            nombre_completo: perfil.nombre_completo,
            rol: perfil.rol,
            cedula: perfil.identificacion,
          },
        });

        if (error) {
          if (error.message.includes("already registered")) {
            console.log(`   ✓ Ya existe`);
            yaExisten++;
          } else {
            console.log(`   ✗ Error: ${error.message}`);
            errores++;
          }
        } else {
          console.log(`   ✓ Creado - Login: ${email} / ${password}`);
          creados++;
        }
      } catch (error) {
        console.log(`   ✗ Error: ${error.message}`);
        errores++;
      }
    }

    console.log("\n" + "━".repeat(60));
    console.log("📊 RESUMEN:");
    console.log(`   ✅ Creados: ${creados}`);
    console.log(`   ℹ️  Ya existían: ${yaExisten}`);
    console.log(`   ❌ Errores: ${errores}`);
    console.log("━".repeat(60) + "\n");

  } catch (error) {
    console.error("❌ Error general:", error.message);
  }
}

syncAllUsers();
