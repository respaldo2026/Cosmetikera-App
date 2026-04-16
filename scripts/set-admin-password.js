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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

(async () => {
  applyEnvFromFile(path.resolve(__dirname, "../.env.local"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const email = "director@gmail.com";
  const newPassword = "555555";

  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data, error } = await adminClient.auth.admin.listUsers({ email, page: 1, perPage: 50 });
  if (error) {
    console.error("Error buscando usuario:", error.message);
    process.exit(1);
  }

  const user = data.users.find((u) => u.email === email);
  if (!user) {
    console.error("No se encontró el usuario director@gmail.com en auth.");
    process.exit(1);
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });

  if (updateError) {
    console.error("No se pudo actualizar la contraseña:", updateError.message);
    process.exit(1);
  }

  console.log("Contraseña actualizada para director@gmail.com");
})();
