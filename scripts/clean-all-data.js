const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xqcsftjkvcrbcetrdulq.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxY3NmdGprdmNyYmNldHJkdWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMTI1NjQsImV4cCI6MjA4MTU4ODU2NH0.sFp55IsqCP0AbypQbtnHKF1Z1OJDpNHxs7LKs7AlXg8";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function cleanAllData() {
  try {
    console.log("\n🧹 LIMPIANDO TODOS LOS DATOS DE PRUEBA\n");

    // Tablas a limpiar en orden (respetando relaciones)
    const tables = [
      "asistencias",
      "temas_curso",
      "sesiones_clase",
      "pagos_nomina",
      "matriculas",
      "cursos",
      "pagos",
      "perfiles",
    ];

    for (const table of tables) {
      console.log(`🗑️  Limpiando ${table}...`);
      
      try {
        // Usar delete sin filtro (elimina todos)
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .gt("id", "0");  // Selecciona todos usando un filtro válido

        if (deleteError) {
          // Intentar con un delete sin condición
          const { error: error2 } = await supabase
            .from(table)
            .delete()
            .not("id", "is", null);  // Mejor sintaxis para "eliminar todos"
          
          console.log(`   ⚠️  Verificar tabla manualmente`);
        } else {
          console.log(`   ✓ Limpiado`);
        }
      } catch (error) {
        console.log(`   ⚠️  Error: ${error.message}`);
      }
    }

    console.log("\n✅ Limpieza completada\n");

  } catch (error) {
    console.error("❌ Error general:", error.message);
  }
}

cleanAllData();
