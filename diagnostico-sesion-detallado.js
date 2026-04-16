// ====================================================
// DIAGNÓSTICO DETALLADO DE SESIÓN
// ====================================================
// 
// Copia este código en la consola del navegador (F12)
// mientras estás en https://app.crystaldiamante.com
//
// ====================================================

(function diagnosticarSesion() {
  console.log("====================================");
  console.log("🔍 DIAGNÓSTICO DETALLADO DE SESIÓN");
  console.log("====================================\n");
  
  // 1. VERIFICAR COOKIES
  console.log("🍪 COOKIES:");
  const cookies = document.cookie.split(';').map(c => c.trim());
  const supabaseCookies = cookies.filter(c => 
    c.includes('supabase') || 
    c.includes('sb-') || 
    c.includes('auth')
  );
  
  if (supabaseCookies.length > 0) {
    console.log("✅ Se encontraron cookies de Supabase:");
    supabaseCookies.forEach(cookie => {
      const [name, ...rest] = cookie.split('=');
      const value = rest.join('=');
      console.log(`├─ ${name}: ${value.substring(0, 50)}...`);
    });
  } else {
    console.log("❌ NO se encontraron cookies de Supabase");
    console.log("⚠️ Esto indica que NO estás autenticado");
  }
  console.log("");
  
  // 2. VERIFICAR localStorage
  console.log("💾 localStorage:");
  const localStorageKeys = Object.keys(localStorage);
  const supabaseKeys = localStorageKeys.filter(k => 
    k.includes('supabase') || 
    k.includes('sb-')
  );
  
  if (supabaseKeys.length > 0) {
    console.log("✅ Se encontraron datos de Supabase en localStorage:");
    supabaseKeys.forEach(key => {
      const value = localStorage.getItem(key);
      console.log(`├─ ${key}:`);
      try {
        const parsed = JSON.parse(value || '{}');
        if (parsed.user) {
          console.log("│  ├─ User ID:", parsed.user.id);
          console.log("│  ├─ Email:", parsed.user.email);
          console.log("│  └─ Role:", parsed.user.role);
        }
        if (parsed.expires_at) {
          const expiresAt = new Date(parsed.expires_at * 1000);
          const now = new Date();
          const expired = expiresAt < now;
          console.log("│  ├─ Expira:", expiresAt.toLocaleString());
          console.log("│  └─", expired ? "❌ EXPIRADO" : "✅ Válido");
        }
      } catch {
        console.log("│  └─", value?.substring(0, 50) + "...");
      }
    });
  } else {
    console.log("❌ NO se encontraron datos de Supabase en localStorage");
  }
  console.log("");
  
  // 3. VERIFICAR URL ACTUAL
  console.log("🌐 UBICACIÓN:");
  console.log("├─ URL:", window.location.href);
  console.log("├─ Hostname:", window.location.hostname);
  console.log("└─ Protocol:", window.location.protocol);
  console.log("");
  
  // 4. RESUMEN
  console.log("====================================");
  console.log("📋 RESUMEN:");
  console.log("====================================");
  
  if (supabaseCookies.length === 0 && supabaseKeys.length === 0) {
    console.log("❌ NO ESTÁS AUTENTICADO");
    console.log("⚠️  Necesitas:");
    console.log("   1. Ir a https://app.crystaldiamante.com/login");
    console.log("   2. Iniciar sesión con tus credenciales");
    console.log("   3. Verificar que te redirija correctamente");
  } else if (supabaseKeys.length > 0) {
    console.log("⚠️  Hay datos de sesión pero pueden estar EXPIRADOS");
    console.log("💡 Prueba:");
    console.log("   1. Cerrar sesión (logout)");
    console.log("   2. Iniciar sesión de nuevo");
  } else {
    console.log("✅ Hay cookies pero necesitamos verificar si funcionan");
    console.log("💡 Ejecuta el otro script: verificar-auth-navegador.js");
  }
  
  console.log("\n====================================");
})();
