# 🚀 INICIO RÁPIDO: AGENTE DE IA (DANY) - 5 MINUTOS

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### PASO 1: BASE DE DATOS (5 minutos)

1. **Abrir Supabase Dashboard**
   - Ve a: https://supabase.com/dashboard
   - Selecciona tu proyecto: `newsocialmedia20-create/academia-crystal`

2. **Ejecutar Migración SQL**
   ```
   📁 Archivo: migrations/2026-02-07-ai-agent-integration.sql
   ```
   - Click en **SQL Editor** (barra lateral)
   - Click en **New query**
   - Copia TODO el contenido del archivo de migración
   - Click en **RUN** (esquina inferior derecha)
   - Verifica mensaje: ✅ "MIGRACIÓN COMPLETADA"

3. **Verificar Instalación**
   ```
   📁 Archivo: migrations/verificar-integracion-ia.sql
   ```
   - En SQL Editor, nueva query
   - Copia el contenido del archivo de verificación
   - Click en **RUN**
   - Lee el reporte de verificación

---

### PASO 2: STORAGE (2 minutos)

1. **Crear Bucket**
   - Click en **Storage** (barra lateral)
   - Click en **New bucket**
   - Nombre: `marketing`
   - Public bucket: ✅ **SÍ** (marcar checkbox)
   - Click en **Create bucket**

2. **Verificar**
   - Debe aparecer el bucket "marketing" en la lista
   - Estado: Public ✅

---

### PASO 3: OBTENER CREDENCIALES (1 minuto)

1. **API Keys**
   - Click en **Settings** (engranaje en barra lateral)
   - Click en **API**
   - Copia estos 2 valores:

   ```
   📋 PROJECT URL: 
   https://xqcsfhvkcrbcettdula.supabase.co
   
   📋 SERVICE ROLE KEY (secreto):
   eyJhbGc...
   ```

   ⚠️ **IMPORTANTE:** El Service Role Key es SECRETO. No lo compartas públicamente.

---

### PASO 4: COMPONENTE REACT (Ya está listo)

El componente ya está creado en:
```
📁 src/app/marketing-center/page.tsx
```

**Para acceder:**
1. Ejecuta tu app: `npm run dev`
2. Ve a: http://localhost:3000/marketing-center
3. Debes ver el panel "Marketing Center"

---

### PASO 5: MAKE.COM (10 minutos)

1. **Crear Cuenta en Make.com**
   - Ve a: https://www.make.com
   - Regístrate (gratis hasta 1,000 operaciones/mes)

2. **Crear Nuevo Escenario**
   - Click en **Scenarios** → **Create a new scenario**
   - Nombre: "Agente IA Dany - WhatsApp"

3. **Configurar Módulos**
   - Sigue la guía detallada en:
   ```
   📁 GUIA-INTEGRACION-AGENTE-IA-MAKE.md
   ```
   - Usa los ejemplos de configuración en:
   ```
   📁 make-config-examples.json
   ```

4. **Configurar Data Store**
   - En Make, ve a **Data stores**
   - Click en **Add data store**
   - Nombre: `Config`
   - Agrega estas keys:
     ```
     SUPABASE_URL: https://[tu-project].supabase.co
     SUPABASE_SERVICE_KEY: [tu-service-key]
     OPENAI_API_KEY: [tu-openai-key]
     ```

---

## 🧪 TESTING RÁPIDO

### Test 1: Verificar Base de Datos

```sql
-- En Supabase SQL Editor:

-- Ver estructura de leads
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'leads';

-- Ver funciones creadas
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%ia%';
```

### Test 2: Probar Función Upsert

```sql
-- Crear un lead de prueba
SELECT * FROM upsert_lead_por_telefono(
    p_telefono := '+573001234567',
    p_nombre := 'Juan Prueba',
    p_interes := 'Manicure'
);

-- Verificar que se creó
SELECT * FROM leads WHERE telefono = '+573001234567';
```

### Test 3: Obtener Cursos para IA

```sql
-- Ver texto plano de cursos
SELECT * FROM get_cursos_para_ia_texto();
```

---

## 📝 ENDPOINTS PARA MAKE.COM

Una vez configurado, estos son tus endpoints:

### 1. Upsert Lead
```
POST https://[PROJECT].supabase.co/rest/v1/rpc/upsert_lead_por_telefono
Headers:
  apikey: [SERVICE_KEY]
  Authorization: Bearer [SERVICE_KEY]
  Content-Type: application/json
Body:
{
  "p_telefono": "+573001234567",
  "p_nombre": "Cliente",
  "p_interes": "Manicure"
}
```

### 2. Obtener Cursos
```
POST https://[PROJECT].supabase.co/rest/v1/rpc/get_cursos_para_ia_texto
Headers:
  apikey: [SERVICE_KEY]
  Authorization: Bearer [SERVICE_KEY]
Body: {}
```

### 3. Buscar Marketing Assets
```
POST https://[PROJECT].supabase.co/rest/v1/rpc/get_marketing_assets_para_ia
Headers:
  apikey: [SERVICE_KEY]
  Authorization: Bearer [SERVICE_KEY]
Body:
{
  "p_programa": "Manicure",
  "p_keyword": "promoción"
}
```

---

## 🎯 PRÓXIMOS PASOS

1. ✅ Base de datos configurada
2. ✅ Storage creado
3. ✅ Credenciales obtenidas
4. ⏳ Configurar Make.com
5. ⏳ Subir primeros assets en /marketing-center
6. ⏳ Probar flujo completo

---

## 📚 DOCUMENTACIÓN COMPLETA

- **Guía detallada Make.com:** `GUIA-INTEGRACION-AGENTE-IA-MAKE.md`
- **Ejemplos de configuración:** `make-config-examples.json`
- **Script SQL migración:** `migrations/2026-02-07-ai-agent-integration.sql`
- **Script verificación:** `migrations/verificar-integracion-ia.sql`

---

## 💡 TIPS

1. **Service Key vs Anon Key:**
   - Anon Key: Para frontend (navegador)
   - Service Key: Para Make.com (backend)
   - NUNCA uses Service Key en el frontend

2. **Seguridad:**
   - El Service Key bypasea RLS
   - Úsalo solo en Make.com (servidor)
   - No lo expongas en código cliente

3. **Testing:**
   - Prueba cada endpoint en Postman antes de Make
   - Verifica respuestas en Supabase Logs
   - Usa teléfono de prueba para WhatsApp

---

## 🆘 SOPORTE

Si algo no funciona:

1. **Revisa logs de Supabase:**
   - Dashboard → Logs → API

2. **Revisa ejecuciones de Make:**
   - Make Dashboard → Scenario → History

3. **Consulta troubleshooting:**
   - Ver sección en `GUIA-INTEGRACION-AGENTE-IA-MAKE.md`

---

## ✅ CHECKLIST FINAL

- [ ] Migración SQL ejecutada correctamente
- [ ] Bucket "marketing" creado y público
- [ ] Service Role Key copiado y guardado
- [ ] Componente /marketing-center funciona
- [ ] Make.com configurado con webhook
- [ ] Primer asset subido
- [ ] Flujo probado con teléfono de prueba
- [ ] Lead creado exitosamente en Supabase

---

**¡Listo para lanzar! 🚀**

Una vez completados todos los pasos, tu Agente de IA (Dany) estará respondiendo automáticamente a los clientes por WhatsApp.
