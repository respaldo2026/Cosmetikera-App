const { createClient } = require("@supabase/supabase-js");
const readline = require("readline");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno.");
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createTestUser() {
  try {
    console.log("\n🔐 CREAR USUARIO DE PRUEBA\n");

    const email = await question("📧 Email (ej: admin@academia.crystal): ");
    const password = await question("🔑 Contraseña/Cédula (ej: 1000000001): ");

    if (!email || !password) {
      console.error("❌ Email y contraseña son obligatorios");
      rl.close();
      return;
    }

    console.log(`\n⚙️ Creando usuario en Supabase Auth...`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}\n`);

    // Crear cliente Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Intentar crear usuario (esto fallará sin permisos de admin)
    // Por eso, abriremos el navegador para que lo cree manualmente
    
    console.log("⚠️  No se puede crear usuarios desde el cliente.\n");
    console.log("📋 PASOS MANUALES EN SUPABASE:\n");
    console.log("1. Abre: https://app.supabase.com");
    console.log("2. Selecciona tu proyecto");
    console.log("3. Ve a: Authentication → Users");
    console.log("4. Click: 'Add user'");
    console.log("5. Ingresa:");
    console.log(`   - Email: ${email}`);
    console.log(`   - Password: ${password}`);
    console.log("6. Click: 'Create user'");
    console.log("\n✅ Después podrás hacer login con esas credenciales\n");

    rl.close();

  } catch (error) {
    console.error("❌ Error:", error.message);
    rl.close();
  }
}

createTestUser();
