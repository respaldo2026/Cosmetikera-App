import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const getVar = (name) => {
  const m = env.match(new RegExp(`^${name}=(.+)$`, 'm'))
  return m ? m[1].trim() : ''
}

const url = getVar('NEXT_PUBLIC_SUPABASE_URL')
const key = getVar('SUPABASE_SERVICE_ROLE_KEY')
const supabase = createClient(url, key)

async function getColumns(table) {
  const { data, error } = await supabase.rpc('get_table_columns', { p_table: table }).catch(() => ({ data: null, error: 'no rpc' }))
  if (data) return data.map(r => r.column_name)
  
  // fallback: insert vacío para ver el error con las columnas reales
  // o usar pg con information_schema via SQL directo
  const { data: d2, error: e2 } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type')
    .eq('table_name', table)
    .eq('table_schema', 'public')
  if (!e2 && d2) return d2
  return null
}

// Usar SQL via rpc exec o REST directo
const tablas = ['articulos', 'ventas']

for (const tabla of tablas) {
  // Intentar con postgrest usando el endpoint de definición
  const res = await fetch(`${url}/rest/v1/${tabla}?limit=0`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json', Prefer: 'count=estimated' }
  })
  const contentRange = res.headers.get('content-range')
  const headers = [...res.headers.entries()]
  
  // Intentar obtener schema via OPTIONS
  const opt = await fetch(`${url}/rest/v1/${tabla}`, {
    method: 'OPTIONS',
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  })
  const body = await opt.text()
  console.log(`\n=== ${tabla.toUpperCase()} OPTIONS ===`)
  
  // Parsear columnas del body JSON si viene
  try {
    const def = JSON.parse(body)
    const props = def?.definitions?.[tabla]?.properties || def?.properties || {}
    console.log('Columnas:', Object.keys(props).join(', '))
    const cols = Object.keys(props)
    if (tabla === 'articulos') {
      console.log('  descuento_porcentaje:', cols.includes('descuento_porcentaje') ? '✅ EXISTE' : '❌ FALTA')
      console.log('  promocion_texto:', cols.includes('promocion_texto') ? '✅ EXISTE' : '❌ FALTA')
      console.log('  stock:', cols.includes('stock') ? '✅ EXISTE' : '❌ FALTA')
      console.log('  nombre:', cols.includes('nombre') ? '✅ EXISTE' : '❌ FALTA')
    }
    if (tabla === 'ventas') {
      console.log('  items:', cols.includes('items') ? '✅ EXISTE' : '❌ FALTA')
      console.log('  cliente_id:', cols.includes('cliente_id') ? '✅ EXISTE' : '❌ FALTA')
    }
  } catch {
    console.log('Body (raw):', body.substring(0, 500))
  }
}
