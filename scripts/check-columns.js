const https = require('https');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim();
const SERVICE_KEY = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)[1].trim();
const hostname = new URL(SUPABASE_URL).hostname;

function req(path, method) {
  return new Promise((resolve, reject) => {
    const r = https.request({
      hostname, path, method: method || 'GET',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Accept': 'application/json',
        'Content-Range': '0-0'
      }
    }, (res) => {
      let out = '';
      res.on('data', d => out += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(out), headers: res.headers }); }
        catch { resolve({ status: res.statusCode, body: out, headers: res.headers }); }
      });
    });
    r.on('error', reject);
    r.end();
  });
}

async function getColumns(table) {
  // Usar el endpoint de información de schema vía introspección
  const r = await req(`/rest/v1/${table}?limit=0`);
  // Las columnas disponibles se ven en el header o en el cuerpo vacío
  // También podemos intentar con una row inválida
  console.log(`\n📋 ${table.toUpperCase()} - Status: ${r.status}`);
  if (r.status === 200) {
    console.log('  Headers Range:', r.headers['content-range']);
  }
  // Traer 1 fila para ver qué columnas devuelve
  const r2 = await req(`/rest/v1/${table}?limit=1`);
  if (Array.isArray(r2.body) && r2.body.length > 0) {
    console.log('  Columnas:', Object.keys(r2.body[0]).join(', '));
  } else {
    console.log('  Sin datos aún (tabla vacía o error)');
    console.log('  Body:', JSON.stringify(r2.body).slice(0, 200));
  }
}

async function main() {
  await getColumns('proveedores');
  await getColumns('ventas');
  await getColumns('perfiles');
  
  // Ver constraint de rol en perfiles
  const r = await req(`/rest/v1/perfiles?limit=2`);
  if (Array.isArray(r.body) && r.body.length > 0) {
    console.log('\n📋 Ejemplo de perfil existente (para ver rol válido):', JSON.stringify(r.body[0], null, 2));
  }
}

main().catch(console.error);
