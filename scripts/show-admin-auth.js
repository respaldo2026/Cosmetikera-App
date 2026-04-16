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
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabaseAdmin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const objetivos = ["admin@gmail.com", "director@gmail.com", "secretaria@gmail.com"];

  for (const email of objetivos) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 50,
      email,
    });
    if (error) {
      console.error(`Error buscando ${email}:`, error.message);
      continue;
    }
    const user = data.users.find((u) => u.email === email);
    if (!user) {
      console.log(`${email}: SIN USUARIO EN AUTH`);
      continue;
    }
    console.log("====");
    console.log("Email:", user.email);
    console.log("ID:", user.id);
    console.log("Metadata:", user.user_metadata);
    console.log("Creado:", user.created_at);
  }
})();
