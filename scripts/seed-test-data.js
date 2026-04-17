/**
 * Seed de datos de prueba para La Cosmetikera
 * - 3 artículos
 * - 3 clientes (perfiles con rol cliente)
 * - 3 proveedores
 * - 3 ventas
 * - 3 compras
 *
 * Usa SERVICE_ROLE key para bypasear RLS
 */
const https = require('https');
const fs = require('fs');

// Leer .env.local
const env = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim();
const SERVICE_KEY = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)[1].trim();
const ANON_KEY = env.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m)[1].trim();

const hostname = new URL(SUPABASE_URL).hostname;

function req(path, method, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const request = https.request({
      hostname,
      path,
      method: method || 'GET',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Prefer': 'return=representation',
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
    request.on('error', reject);
    if (data) request.write(data);
    request.end();
  });
}

async function insert(table, rows, label) {
  const r = await req(`/rest/v1/${table}`, 'POST', rows);
  if (r.status === 201 || r.status === 200) {
    console.log(`✅ ${label}: ${rows.length} registros insertados`);
    return r.body;
  } else {
    console.error(`❌ ${label} ERROR (${r.status}):`, JSON.stringify(r.body));
    return null;
  }
}

async function main() {
  console.log('\n🌱 Insertando datos de prueba en La Cosmetikera...\n');

  // ─── 1. ARTÍCULOS ─────────────────────────────────────────
  const articulos = [
    {
      nombre: 'Esmalte Rojo Pasión',
      referencia: 'ESM-001',
      categoria: 'Esmaltes',
      precio_venta: 12000,
      precio_costo: 5000,
      stock: 25,
      stock_minimo: 5,
      marca: 'OPI',
      descripcion: 'Esmalte de larga duración color rojo intenso',
      activo: true,
    },
    {
      nombre: 'Base Coat Protectora',
      referencia: 'BASE-002',
      categoria: 'Bases y Tops',
      precio_venta: 18000,
      precio_costo: 8000,
      stock: 15,
      stock_minimo: 3,
      marca: 'Sally Hansen',
      descripcion: 'Base protectora para uñas naturales',
      activo: true,
    },
    {
      nombre: 'Removedor sin Acetona',
      referencia: 'REM-003',
      categoria: 'Accesorios',
      precio_venta: 8000,
      precio_costo: 3000,
      stock: 40,
      stock_minimo: 10,
      marca: 'Cutex',
      descripcion: 'Removedor suave para esmaltes normales y de gel',
      activo: true,
    },
  ];

  const artInsertados = await insert('articulos', articulos, 'Artículos');

  // ─── 2. PROVEEDORES ────────────────────────────────────────
  const proveedores = [
    {
      nombre: 'Distribuidora Belleza Total',
      contacto: 'María López',
      telefono: '3001234567',
      email: 'ventas@bellezatotal.com',
      ciudad: 'Bogotá',
      productos: 'Esmaltes, bases, tops coat',
      notas: 'Entrega cada 15 días',
    },
    {
      nombre: 'Cosméticos del Valle S.A.S',
      contacto: 'Carlos Ramírez',
      telefono: '3109876543',
      email: 'pedidos@cosmeticosvalle.com',
      ciudad: 'Cali',
      productos: 'Maquillaje, cuidado de piel',
      notas: 'Descuento por volumen >$500,000',
    },
    {
      nombre: 'ProNails Colombia',
      contacto: 'Ana Gómez',
      telefono: '3205551234',
      email: 'info@pronailscol.com',
      ciudad: 'Medellín',
      productos: 'Nail art, accesorios, herramientas',
      notas: 'Especialistas en productos para nail art',
    },
  ];

  await insert('proveedores', proveedores, 'Proveedores');

  // ─── 3. CLIENTES (perfiles con rol cliente) ────────────────
  // Nota: perfiles normalmente se crean desde auth.
  // Si tiene restricción de FK con auth.users, usamos un workaround con UUID fijo.
  const clientes = [
    {
      nombre_completo: 'Laura Martínez',
      email: 'laura.martinez.test@cosmetikera.com',
      telefono: '3001112233',
      rol: 'estudiante',
      puntos_fidelidad: 150,
      nivel_fidelidad: 'plata',
      activo: true,
    },
    {
      nombre_completo: 'Sofía Herrera',
      email: 'sofia.herrera.test@cosmetikera.com',
      telefono: '3112223344',
      rol: 'estudiante',
      puntos_fidelidad: 80,
      nivel_fidelidad: 'bronce',
      activo: true,
    },
    {
      nombre_completo: 'Valentina Ruiz',
      email: 'valentina.ruiz.test@cosmetikera.com',
      telefono: '3223334455',
      rol: 'estudiante',
      puntos_fidelidad: 320,
      nivel_fidelidad: 'oro',
      activo: true,
    },
  ];

  const clientesInsertados = await insert('perfiles', clientes, 'Clientes');

  // ─── 4. VENTAS ─────────────────────────────────────────────
  // Obtener IDs de clientes insertados (o usar los recién creados)
  let clienteIds = [];
  if (clientesInsertados && Array.isArray(clientesInsertados)) {
    clienteIds = clientesInsertados.map(c => c.id);
  }
  // Obtener IDs de artículos insertados
  let articuloIds = [];
  if (artInsertados && Array.isArray(artInsertados)) {
    articuloIds = artInsertados.map(a => ({ id: a.id, nombre: a.nombre, precio: a.precio_venta }));
  }

  // Fallback: si no hay IDs, igual crear ventas sin cliente_id
  const ventas = [
    {
      fecha: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      subtotal: 30000,
      descuento: 0,
      total: 30000,
      metodo_pago: 'efectivo',
      ...(clienteIds[0] ? { cliente_id: clienteIds[0] } : {}),
      items: articuloIds.length > 0
        ? [{ id: articuloIds[0].id, nombre: articuloIds[0].nombre, cantidad: 1, precio: articuloIds[0].precio, subtotal: articuloIds[0].precio }]
        : [{ nombre: 'Esmalte Rojo Pasión', cantidad: 1, precio: 12000, subtotal: 12000 }],
    },
    {
      fecha: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      subtotal: 26000,
      descuento: 0,
      total: 26000,
      metodo_pago: 'transferencia',
      ...(clienteIds[1] ? { cliente_id: clienteIds[1] } : {}),
      items: articuloIds.length > 1
        ? [{ id: articuloIds[1].id, nombre: articuloIds[1].nombre, cantidad: 1, precio: articuloIds[1].precio, subtotal: articuloIds[1].precio }]
        : [{ nombre: 'Base Coat Protectora', cantidad: 1, precio: 18000, subtotal: 18000 }],
    },
    {
      fecha: new Date().toISOString(),
      subtotal: 36000,
      descuento: 0,
      total: 36000,
      metodo_pago: 'tarjeta',
      ...(clienteIds[2] ? { cliente_id: clienteIds[2] } : {}),
      items: articuloIds.length > 2
        ? [
            { id: articuloIds[0]?.id, nombre: articuloIds[0]?.nombre, cantidad: 2, precio: articuloIds[0]?.precio, subtotal: articuloIds[0]?.precio * 2 },
            { id: articuloIds[2]?.id, nombre: articuloIds[2]?.nombre, cantidad: 1, precio: articuloIds[2]?.precio, subtotal: articuloIds[2]?.precio },
          ]
        : [{ nombre: 'Esmalte x2 + Removedor', cantidad: 3, precio: 12000, subtotal: 36000 }],
    },
  ];

  await insert('ventas', ventas, 'Ventas');

  // ─── 5. COMPRAS ────────────────────────────────────────────
  const proveedoresInsertados = (await req(`/rest/v1/proveedores?limit=3`, 'GET', null)).body;
  const prov = Array.isArray(proveedoresInsertados) ? proveedoresInsertados : [];

  const compras = [
    {
      proveedor_id: prov[0]?.id || null,
      proveedor_nombre: prov[0]?.nombre || 'Distribuidora Belleza Total',
      fecha: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      total: 150000,
      estado: 'recibida',
      notas: 'Pedido mensual de esmaltes',
      items: [
        { nombre: 'Esmalte Rojo Pasión', cantidad: 10, precio_unitario: 5000 },
        { nombre: 'Esmalte Nude Natural', cantidad: 10, precio_unitario: 5000 },
        { nombre: 'Esmalte Azul Marino', cantidad: 10, precio_unitario: 5000 },
      ],
    },
    {
      proveedor_id: prov[1]?.id || null,
      proveedor_nombre: prov[1]?.nombre || 'Cosméticos del Valle S.A.S',
      fecha: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      total: 80000,
      estado: 'pendiente',
      notas: 'Bases y tops coat',
      items: [
        { nombre: 'Base Coat Protectora', cantidad: 5, precio_unitario: 8000 },
        { nombre: 'Top Coat Brillante', cantidad: 5, precio_unitario: 8000 },
      ],
    },
    {
      proveedor_id: prov[2]?.id || null,
      proveedor_nombre: prov[2]?.nombre || 'ProNails Colombia',
      fecha: new Date().toISOString(),
      total: 60000,
      estado: 'parcial',
      notas: 'Removedores y accesorios - llegó solo el 50%',
      items: [
        { nombre: 'Removedor sin Acetona', cantidad: 10, precio_unitario: 3000 },
        { nombre: 'Limas de cartón x10', cantidad: 5, precio_unitario: 6000 },
      ],
    },
  ];

  await insert('compras', compras, 'Compras');

  console.log('\n✨ Datos de prueba insertados correctamente!\n');
  console.log('Puedes verlos en:');
  console.log('  → http://localhost:3001/articulos');
  console.log('  → http://localhost:3001/proveedores');
  console.log('  → http://localhost:3001/ventas');
  console.log('  → http://localhost:3001/compras');
}

main().catch(console.error);
