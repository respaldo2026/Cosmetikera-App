const https = require('https');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim();
const serviceKey = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)[1].trim();
const hostname = new URL(supabaseUrl).hostname;

function request(path, method, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname,
      path,
      method: method || 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': 'Bearer ' + serviceKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let out = '';
      res.on('data', d => out += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(out) }); }
        catch { resolve({ status: res.statusCode, body: out }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // Ejecutar SQL via rpc exec_sql (disponible con service role)
  const sql = `ALTER TABLE articulos ADD COLUMN IF NOT EXISTS descuento_porcentaje numeric(5,2) DEFAULT NULL;`;
  
  const r = await request('/rest/v1/rpc/exec_sql', 'POST', { sql });
  
  if (r.status === 200) {
    console.log('✅ Columna descuento_porcentaje agregada correctamente');
  } else {
    console.log('Estado:', r.status);
    console.log('Respuesta:', JSON.stringify(r.body));
    console.log('\n⚠️  La RPC exec_sql no está disponible.');
    console.log('Ejecuta este SQL manualmente en Supabase Dashboard → SQL Editor:\n');
    console.log(sql);
  }
}

main().catch(console.error);
