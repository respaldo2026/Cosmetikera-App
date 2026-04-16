const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function applyEnvFromFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^"|"$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

(async () => {
  try {
    applyEnvFromFile(path.resolve(__dirname, '../.env.local'));

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.error('Faltan credenciales de Supabase');
      process.exit(1);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: estadosRows, error: estadosError } = await supabase
      .from('cursos')
      .select('estado');

    if (estadosError) throw estadosError;

    const estadoCounts = {};
    for (const row of estadosRows || []) {
      const key = String(row.estado || 'NULL');
      estadoCounts[key] = (estadoCounts[key] || 0) + 1;
    }

    const { data: withFilter, error: withFilterError } = await supabase
      .from('cursos')
      .select('id,nombre,estado,dias_semana,hora_inicio,hora_fin,fecha_inicio')
      .in('estado', ['activo', 'proximo'])
      .order('fecha_inicio', { ascending: true, nullsFirst: true })
      .limit(20);

    if (withFilterError) throw withFilterError;

    const { data: allSample, error: allSampleError } = await supabase
      .from('cursos')
      .select('id,nombre,estado,dias_semana,hora_inicio,hora_fin,fecha_inicio')
      .order('fecha_inicio', { ascending: true, nullsFirst: true })
      .limit(20);

    if (allSampleError) throw allSampleError;

    console.log('ESTADOS:', estadoCounts);
    console.log('\nMUESTRA CON FILTRO (activo|proximo):', withFilter?.length || 0);
    console.log(withFilter || []);
    console.log('\nMUESTRA SIN FILTRO:', allSample?.length || 0);
    console.log(allSample || []);

    process.exit(0);
  } catch (error) {
    console.error('Error diagnóstico horarios:', error);
    process.exit(1);
  }
})();
