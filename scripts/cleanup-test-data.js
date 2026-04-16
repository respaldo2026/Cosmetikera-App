#!/usr/bin/env node

/**
 * Script para eliminar datos de prueba de la base de datos
 * Uso: node scripts/cleanup-test-data.js
 */

const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

async function deleteTable(tableName, count) {
  try {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .neq('id', -1); // Truco: elimina todos excepto los que no existen
    
    if (error) {
      console.error(`❌ Error eliminando ${tableName}:`, error.message);
      return false;
    }
    console.log(`✅ ${tableName}: ${count} registros eliminados`);
    return true;
  } catch (err) {
    console.error(`❌ Error en ${tableName}:`, err.message);
    return false;
  }
}

async function getTableCounts() {
  const tables = ['perfiles', 'cursos', 'matriculas', 'asistencias', 'pagos', 'pagos_nomina'];
  const counts = {};

  for (const table of tables) {
    try {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      counts[table] = count || 0;
    } catch (err) {
      counts[table] = 'Error';
    }
  }

  return counts;
}

async function main() {
  console.log('\n🗑️  SCRIPT DE LIMPIEZA - La Cosmetikera\n');
  console.log('Este script eliminará TODOS los datos de las tablas.\n');

  // Mostrar conteos actuales
  console.log('📊 Estado actual de la base de datos:');
  const counts = await getTableCounts();
  
  for (const [table, count] of Object.entries(counts)) {
    console.log(`   ${table}: ${count} registros`);
  }

  console.log('\n⚠️  ADVERTENCIA: Esta acción NO se puede deshacer.\n');

  const confirm = await question('¿Deseas continuar? Escribe "ELIMINAR TODO" para confirmar: ');

  if (confirm !== 'ELIMINAR TODO') {
    console.log('\n❌ Operación cancelada.\n');
    rl.close();
    return;
  }

  console.log('\n🔄 Iniciando limpieza...\n');

  // Orden de eliminación (respetando relaciones foráneas)
  const orden = ['asistencias', 'pagos', 'pagos_nomina', 'matriculas', 'cursos', 'perfiles'];

  for (const table of orden) {
    const count = counts[table];
    if (count > 0) {
      await deleteTable(table, count);
      // Pequeña pausa para evitar saturar la API
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n✅ Limpieza completada.\n');
  
  // Mostrar conteos finales
  console.log('📊 Estado final de la base de datos:');
  const finalCounts = await getTableCounts();
  for (const [table, count] of Object.entries(finalCounts)) {
    console.log(`   ${table}: ${count} registros`);
  }

  console.log('\n🎉 Base de datos limpia y lista para nuevos datos.\n');
  rl.close();
}

main().catch(err => {
  console.error('❌ Error fatal:', err.message);
  rl.close();
  process.exit(1);
});
