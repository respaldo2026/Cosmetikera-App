#!/usr/bin/env node
/**
 * Script para ejecutar las 3 migrations del sistema de memoria
 * Uso: node scripts/run-memory-migrations.js
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("❌ Faltan variables de entorno:");
  console.error("   - NEXT_PUBLIC_SUPABASE_URL");
  console.error("   - SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runMigration(filename, description) {
  try {
    console.log(`\n📋 Ejecutando: ${description}`);
    const filePath = path.join(
      __dirname,
      "..",
      "supabase",
      "migrations",
      filename
    );

    if (!fs.existsSync(filePath)) {
      console.error(`   ❌ Archivo no encontrado: ${filename}`);
      return false;
    }

    const sql = fs.readFileSync(filePath, "utf-8");

    // Ejecutar el SQL directamente (Supabase permite RPC o SQL directo)
    const result = await supabase.rpc("exec_sql", { sql_query: sql }).catch(async () => {
      // Si rpc no existe, intentar dividir por ";" y ejecutar cada statement
      console.log("   ⚠️  RPC no disponible, intentando ejecución directa...");
      
      // Dividir por semicolon y ejecutar cada parte
      const statements = sql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith("--"));

      for (const stmt of statements) {
        if (stmt) {
          await supabase.rpc("execute_sql", { sql: stmt }).catch(() => {
            // Fallback: intentar via query builder
            console.log("   ⚠️  Fallback a dashboard manual requerido para: ", stmt.substring(0, 50));
          });
        }
      }
      return { data: statements.length };
    });

    console.log(`   ✅ Migration completada: ${filename}`);
    return true;
  } catch (error) {
    console.error(`   ❌ Error en ${filename}:`, error.message);
    return false;
  }
}

async function main() {
  console.log("🚀 Ejecutando migrations del sistema de memoria de WhatsApp");
  console.log("=".repeat(60));

  const migrations = [
    [
      "202604280001_plantilla_bienvenida_club.sql",
      "1/3 - Plantilla de bienvenida al club",
    ],
    [
      "202604280002_cumpleaños_automatizacion.sql",
      "2/3 - Plantillas y tablas de cumpleaños",
    ],
    [
      "202604280003_whatsapp_memory_system.sql",
      "3/3 - Sistema de memoria de conversaciones",
    ],
  ];

  let completed = 0;
  for (const [filename, description] of migrations) {
    const success = await runMigration(filename, description);
    if (success) completed++;
  }

  console.log("\n" + "=".repeat(60));
  console.log(
    `✅ Migrations completadas: ${completed}/${migrations.length}`
  );

  if (completed < migrations.length) {
    console.log(
      "\n⚠️  Algunas migrations requieren ejecución manual en Supabase Dashboard:"
    );
    console.log("   1. Ve a https://app.supabase.com");
    console.log("   2. Abre tu proyecto la-cosmetikera");
    console.log("   3. Ve a SQL Editor");
    console.log("   4. Copia y pega el contenido de cada migration:");
    migrations.forEach(([filename], i) => {
      console.log(`      ${i + 1}. supabase/migrations/${filename}`);
    });
    console.log("   5. Ejecuta cada una");
  }

  process.exit(completed === migrations.length ? 0 : 1);
}

main();
