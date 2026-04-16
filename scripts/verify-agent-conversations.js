const fs = require('fs');
const path = require('path');

function loadEnv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    env[key] = value;
  }
  return env;
}

function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

(async () => {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) {
      console.error('No existe .env.local');
      process.exit(1);
    }

    const env = loadEnv(envPath);
    const url = env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRole) {
      console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
      process.exit(1);
    }

    const headers = {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
    };

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const countAllRes = await fetch(`${url}/rest/v1/agent_conversations?select=id`, { headers });
    const count24Res = await fetch(
      `${url}/rest/v1/agent_conversations?select=id&created_at=gte.${encodeURIComponent(yesterday)}`,
      { headers }
    );
    const recentRes = await fetch(
      `${url}/rest/v1/agent_conversations?select=id,phone_number,user_message,agent_response,created_at&order=created_at.desc&limit=10`,
      { headers }
    );

    if (!countAllRes.ok || !count24Res.ok || !recentRes.ok) {
      console.error('Error consultando Supabase', {
        countAllStatus: countAllRes.status,
        count24Status: count24Res.status,
        recentStatus: recentRes.status,
      });
      const txt = await recentRes.text();
      console.error('Detalle:', txt.slice(0, 500));
      process.exit(1);
    }

    const allRows = await countAllRes.json();
    const rows24 = await count24Res.json();
    const recent = await recentRes.json();

    const unknownRecent = recent.filter((r) => {
      const p = String(r.phone_number || '').trim().toLowerCase();
      return !p || p === 'unknown' || p === 'desconocido';
    }).length;

    console.log('=== Verificación agent_conversations ===');
    console.log('Total registros:', allRows.length);
    console.log('Registros últimas 24h:', rows24.length);
    console.log('Últimos 10 (resumen):');

    for (const row of recent) {
      const userLen = String(row.user_message || '').length;
      const agentLen = String(row.agent_response || '').length;
      console.log(`- ${row.created_at} | ${maskPhone(row.phone_number)} | user:${userLen} chars | agent:${agentLen} chars`);
    }

    console.log('Últimos 10 con teléfono unknown/desconocido:', unknownRecent);
  } catch (error) {
    console.error('Error ejecutando verificación:', error?.message || error);
    process.exit(1);
  }
})();
