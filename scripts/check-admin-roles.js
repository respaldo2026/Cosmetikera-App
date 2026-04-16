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

async function main() {
  try {
    applyEnvFromFile(path.resolve(__dirname, "../.env.local"));
  } catch (error) {
    console.error("No se pudieron cargar las variables de entorno:", error.message);
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    process.exit(1);
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false },
  });

  const rolesObjetivo = ["admin", "director", "secretaria"];

  const { data, error } = await supabase
    .from("perfiles")
    .select("id, nombre_completo, email, rol, identificacion, telefono, created_at")
    .in("rol", rolesObjetivo)
    .order("rol", { ascending: true })
    .order("nombre_completo", { ascending: true });

  if (error) {
    console.error("Error consultando perfiles:", error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.warn("No se encontraron perfiles con los roles solicitados.");
    process.exit(1);
  }

  const resumen = rolesObjetivo.map((rol) => ({
    rol,
    cantidad: data.filter((row) => row.rol === rol).length,
  }));

  console.log("Resumen por rol:");
  console.table(resumen);

  console.log("Detalle de perfiles:");
  console.table(
    data.map((row) => ({
      id: row.id,
      rol: row.rol,
      nombre: row.nombre_completo,
      email: row.email,
      identificacion: row.identificacion,
      telefono: row.telefono,
      creado: row.created_at,
    }))
  );

  const faltantes = resumen.filter((item) => item.cantidad === 0).map((item) => item.rol);
  if (faltantes.length > 0) {
    console.warn(`Roles sin registros: ${faltantes.join(", ")}`);
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error("Error inesperado:", error);
  process.exit(1);
});
