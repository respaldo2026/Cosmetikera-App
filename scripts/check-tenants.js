const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function checkTenants() {
  console.log("[Check Tenants] Buscando tenants...");
  
  const { data, error } = await supabase
    .from("tenants")
    .select("id,slug,estado,nombre")
    .order("slug");

  if (error) {
    console.error("[Check Tenants] Error:", error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.warn("[Check Tenants] No hay tenants en la BD");
    return;
  }

  console.log(`[Check Tenants] ${data.length} tenant(s) encontrado(s):`);
  data.forEach((t) => {
    console.log(`  - ID: ${t.id}, slug: ${t.slug}, estado: ${t.estado}, nombre: ${t.nombre}`);
  });
}

checkTenants().catch(console.error);
