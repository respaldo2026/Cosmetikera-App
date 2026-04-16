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

function buildSupabaseClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY");
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  return { admin, anon };
}

async function ensureAuthUser(adminClient, def) {
  const { data, error } = await adminClient.auth.admin.listUsers({ email: def.email, page: 1, perPage: 50 });
  if (error) throw new Error(`Error consultando auth para ${def.email}: ${error.message}`);
  let user = data.users.find((u) => u.email === def.email);

  if (!user) {
    const password = def.password || "Cambiar123!";
    const payload = {
      email: def.email,
      password,
      email_confirm: true,
      user_metadata: {
        nombre_completo: def.nombre,
        rol: def.rol,
        identificacion: def.identificacion,
        telefono: def.telefono ?? null,
      },
    };
    const { data: creation, error: createError } = await adminClient.auth.admin.createUser(payload);
    if (createError) {
      throw new Error(`No se pudo crear el usuario ${def.email}: ${createError.message}`);
    }
    user = creation.user;
    console.log(`✔ Usuario auth creado: ${def.email}`);
  } else {
    const meta = { ...(user.user_metadata || {}) };
    let metaUpdated = false;
    for (const [key, value] of Object.entries({
      nombre_completo: def.nombre,
      rol: def.rol,
      identificacion: def.identificacion,
      telefono: def.telefono ?? null,
    })) {
      if (value && !meta[key]) {
        meta[key] = value;
        metaUpdated = true;
      }
    }
    if (metaUpdated) {
      const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
        user_metadata: meta,
      });
      if (updateError) {
        console.warn(`⚠ No se pudo actualizar metadata de ${def.email}: ${updateError.message}`);
      } else {
        console.log(`✔ Metadata actualizada para ${def.email}`);
      }
    }
  }

  return user;
}

async function ensurePerfil(adminClient, user, def) {
  const { data: duplicados } = await adminClient
    .from("perfiles")
    .select("id, nombre_completo, identificacion, telefono")
    .eq("email", def.email)
    .neq("id", user.id);

  const duplicadoPreferido = duplicados && duplicados.length > 0 ? duplicados[0] : null;

  const desiredNombre =
    def.nombre || user.user_metadata?.nombre_completo || duplicadoPreferido?.nombre_completo || user.email;
  const desiredIdentificacion =
    def.identificacion || user.user_metadata?.identificacion || duplicadoPreferido?.identificacion || null;
  const desiredTelefono =
    def.telefono ?? user.user_metadata?.telefono ?? duplicadoPreferido?.telefono ?? null;

  if (duplicados && duplicados.length > 0) {
    for (const dup of duplicados) {
      const { error: deleteError } = await adminClient.from("perfiles").delete().eq("id", dup.id);
      if (deleteError) {
        console.warn(`⚠ No se pudo eliminar perfil duplicado ${dup.id}: ${deleteError.message}`);
      } else {
        console.log(`✔ Perfil duplicado eliminado (${dup.id})`);
      }
    }
  }

  const { data: perfilActual, error: perfilError } = await adminClient
    .from("perfiles")
    .select("id, nombre_completo, rol, identificacion, telefono")
    .eq("id", user.id)
    .maybeSingle();

  if (perfilError) {
    throw new Error(`Error consultando perfil ${user.email}: ${perfilError.message}`);
  }

  if (!perfilActual) {
    await adminClient.from("perfiles").upsert({
      id: user.id,
      email: def.email,
      nombre_completo: desiredNombre,
      rol: def.rol,
      identificacion: desiredIdentificacion,
      telefono: desiredTelefono,
    });
    console.log(`✔ Perfil creado/actualizado para ${def.email}`);
    return;
  }

  const updates = {};
  if (perfilActual.nombre_completo !== desiredNombre) updates.nombre_completo = desiredNombre;
  if (perfilActual.rol !== def.rol) updates.rol = def.rol;
  if (desiredIdentificacion && perfilActual.identificacion !== desiredIdentificacion) {
    updates.identificacion = desiredIdentificacion;
  }
  if (desiredTelefono !== undefined && perfilActual.telefono !== desiredTelefono) {
    updates.telefono = desiredTelefono;
  }

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await adminClient
      .from("perfiles")
      .update(updates)
      .eq("id", user.id);
    if (updateError) {
      throw new Error(`No se pudo actualizar perfil de ${def.email}: ${updateError.message}`);
    }
    console.log(`✔ Perfil sincronizado para ${def.email}`);
  }
}

async function main() {
  applyEnvFromFile(path.resolve(__dirname, "../.env.local"));
  const { admin } = buildSupabaseClients();

  const objetivos = [
    {
      email: "admin@gmail.com",
      rol: "admin",
      nombre: "admin",
      identificacion: "000000",
    },
    {
      email: "director@gmail.com",
      rol: "director",
      nombre: "Director",
      identificacion: "555555",
      password: process.env.DIRECTOR_DEFAULT_PASSWORD || "Director123!",
    },
    {
      email: "secretaria@gmail.com",
      rol: "secretaria",
      nombre: "Secretaria",
      identificacion: "333333",
    },
  ];

  for (const def of objetivos) {
    console.log(`\n=== Sincronizando ${def.email} (${def.rol}) ===`);
    const user = await ensureAuthUser(admin, def);
    await ensurePerfil(admin, user, def);
  }

  console.log("\nSincronización completada.");
}

main().catch((error) => {
  console.error("Error en sincronización:", error.message || error);
  process.exit(1);
});
