const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function applyEnvFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`No se encontró el archivo de entorno en ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    if (!line || line.trim().startsWith("#")) return;
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) return;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

async function main() {
  applyEnvFromFile(path.resolve(__dirname, "../.env.local"));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }

  const adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const email = process.env.DEFAULT_ADMIN_EMAIL || "admin@gmail.com";
  const password = process.env.DEFAULT_ADMIN_PASSWORD || "000000";

  const { data, error } = await adminClient.auth.admin.listUsers({
    email,
    page: 1,
    perPage: 50,
  });

  if (error) {
    throw new Error(`No se pudo consultar auth users: ${error.message}`);
  }

  const user = data.users.find((u) => u.email === email);
  if (!user) {
    throw new Error(`No se encontró el usuario ${email} en auth`);
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    user_metadata: {
      ...(user.user_metadata || {}),
      nombre_completo: "admin",
      rol: "admin",
      identificacion: "000000",
    },
  });

  if (updateError) {
    throw new Error(`No se pudo actualizar password: ${updateError.message}`);
  }

  console.log(`Password actualizado para ${email}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
