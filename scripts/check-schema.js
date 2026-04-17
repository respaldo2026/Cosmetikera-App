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
        try { resolve(JSON.parse(out)); } catch { resolve(out); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('Verificando esquema en Supabase:', supabaseUrl, '\n');

  // Usar select con columna inexistente para obtener el schema cache error que lista columnas válidas
  // Estrategia: insert con columna inválida devuelve hint con columnas disponibles en algunos casos
  // Mejor: usar RPC exec_sql si existe, o select de pg_attribute

  // Intentar pg_attribute via función RPC si existe
  const tables = ['articulos', 'ventas'];
  
  for (const tabla of tables) {
    console.log(`\n📋 TABLA: ${tabla.toUpperCase()}`);
    
    // Trick: hacer un select con columna que no existe → el error PGRST204 dice las columnas válidas no
    // Mejor: insertar con todos los campos en null y ver qué acepta
    // O usar: select=id para verificar que existe
    const testSelect = await request(`/rest/v1/${tabla}?select=id,nombre,stock,precio_venta,categoria,marca,referencia,activo,imagen_url,descripcion,stock_minimo,precio_costo&limit=0`);
    
    if (Array.isArray(testSelect)) {
      console.log('  Columnas básicas: ✅ todas existen (id,nombre,stock,precio_venta,categoria,marca,referencia,activo,imagen_url,descripcion,stock_minimo,precio_costo)');
    } else if (testSelect?.code === 'PGRST204') {
      console.log('  Error de columna:', testSelect.message);
    } else {
      console.log('  Respuesta:', JSON.stringify(testSelect).substring(0, 150));
    }
  }

  // Verificar específicamente las nuevas columnas requeridas
  console.log('\n\n=== VERIFICACIÓN COLUMNAS NUEVAS (para el módulo detalle) ===\n');
  
  // descuento_porcentaje y promocion_texto en articulos
  const testNewCols = await request('/rest/v1/articulos?select=descuento_porcentaje,promocion_texto&limit=0');
  if (Array.isArray(testNewCols)) {
    console.log('✅ articulos.descuento_porcentaje - EXISTE');
    console.log('✅ articulos.promocion_texto - EXISTE');
  } else {
    const msg = testNewCols?.message || '';
    if (msg.includes('descuento_porcentaje')) console.log('❌ articulos.descuento_porcentaje - FALTA (necesita migración)');
    else console.log('✅ articulos.descuento_porcentaje - EXISTE');
    if (msg.includes('promocion_texto')) console.log('❌ articulos.promocion_texto - FALTA (necesita migración)');
    else console.log('✅ articulos.promocion_texto - EXISTE');
    if (msg) console.log('   Detalle:', msg);
  }

  // items en ventas
  const testVentas = await request('/rest/v1/ventas?select=id,fecha,total,cliente_id,items,metodo_pago&limit=0');
  if (Array.isArray(testVentas)) {
    console.log('✅ ventas.items - EXISTE');
    console.log('✅ ventas.cliente_id - EXISTE');
  } else {
    const msg = testVentas?.message || '';
    console.log(msg.includes('items') ? '❌ ventas.items - FALTA' : '✅ ventas.items - EXISTE');
    console.log(msg.includes('cliente_id') ? '❌ ventas.cliente_id - FALTA' : '✅ ventas.cliente_id - EXISTE');
    if (msg) console.log('   Detalle:', msg);
  }
}

main().catch(console.error);
