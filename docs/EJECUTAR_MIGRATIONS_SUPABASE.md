# 📋 Ejecutar Migrations de Memoria en Supabase

## Estado Actual
- ✅ **Endpoint de chat actualizado** (`/api/ai/chat/route.ts`): Ahora integra sistema de memoria
- ✅ **Utilidades de memoria creadas** (`src/utils/whatsapp-memory.ts`): Funciones para gestionar contexto
- ✅ **3 Migrations preparadas** en `supabase/migrations/`
- ⏳ **PENDIENTE**: Ejecutar migrations en Supabase

## Instrucciones Paso a Paso

### Opción 1: Ejecución Automática (CLI - RECOMENDADA)

Si tienes el CLI de Supabase instalado:

```bash
cd "C:\Users\User\Cosmetikera App\Cosmetikera_App"
npx supabase db push
# Responder 'y' cuando pregunte por confirmar
```

---

### Opción 2: Ejecución Manual en Supabase Dashboard (ALTERNATIVA)

Si el CLI falla, ejecuta manualmente:

1. **Abre Supabase Dashboard**
   - Ve a: https://app.supabase.com
   - Selecciona proyecto: `la-cosmetikera` (gzrogwpbkkynhuostxle)

2. **Navega a SQL Editor**
   - Click en "SQL Editor" en el sidebar izquierdo
   - Click en "New Query"

3. **Ejecuta Migration 1: Plantilla de Bienvenida al Club**
   - Abre archivo: `supabase/migrations/202604280001_plantilla_bienvenida_club.sql`
   - Copia TODO el contenido
   - Pégalo en Supabase SQL Editor
   - Click en "Run" (Ctrl+Enter)
   - Espera a que aparezca: **✅ Success**

4. **Ejecuta Migration 2: Plantillas de Cumpleaños**
   - Abre archivo: `supabase/migrations/202604280002_cumpleaños_automatizacion.sql`
   - **IMPORTANTE**: En Windows, Git puede haber convertido el nombre:
     - Si ves `cumpleaños_automatizacion.sql` → Abre ese
     - Si ves `cumpleanos_automatizacion.sql` → Abre ese (sin ñ)
   - Copia TODO el contenido
   - Pégalo en Supabase SQL Editor (nueva query)
   - Click en "Run" (Ctrl+Enter)
   - Espera a que aparezca: **✅ Success**

5. **Ejecuta Migration 3: Sistema de Memoria**
   - Abre archivo: `supabase/migrations/202604280003_whatsapp_memory_system.sql`
   - Copia TODO el contenido
   - Pégalo en Supabase SQL Editor (nueva query)
   - Click en "Run" (Ctrl+Enter)
   - Espera a que aparezca: **✅ Success**

---

## Verificación

Después de ejecutar las 3 migrations, verifica que las tablas se crearon:

1. **Ve a "Table Editor" en Supabase Dashboard**
2. **Busca estas tablas** (scrollea hacia abajo):
   - ✅ `notificaciones_enviadas` (de migration 1)
   - ✅ `club_inscripciones` (de migration 1)
   - ✅ `cumpleaños_notificaciones` (de migration 2)
   - ✅ `whatsapp_conversation_history` (de migration 3)
   - ✅ `whatsapp_customer_memory` (de migration 3)

3. **Busca estas funciones SQL** en "Database" → "Functions":
   - ✅ `get_clientes_cumpleaños_proximos` (de migration 2)
   - ✅ `get_whatsapp_context` (de migration 3)
   - ✅ `update_whatsapp_memory` (de migration 3)

Si ves todas estas, **¡las migrations se ejecutaron exitosamente!** ✅

---

## Solución de Problemas

### Error: "Relation already exists"
- Las tablas ya existen. Esto es normal si corriste las migrations antes.
- Solución: En Supabase SQL, usa: `DROP TABLE IF EXISTS nombre_tabla CASCADE;` antes de ejecutar.

### Error: "Function already exists"
- Las funciones SQL ya existen.
- Solución: En Supabase SQL, usa: `DROP FUNCTION IF EXISTS nombre_función;` antes de ejecutar.

### Error: "Permission denied"
- Tu rol de Supabase no tiene permisos.
- Solución: Usa la cuenta del propietario del proyecto o un rol con permisos `SUPERUSER`.

### Las migrations se ejecutan pero no ves las tablas
- Puede ser que estés mirando un esquema diferente.
- Ve a Supabase: "Schema" y asegúrate de que estés viendo el esquema `public`.

---

## Próximos Pasos (Después de ejecutar migrations)

1. **Crear 4 plantillas en Meta Business Manager**
   - `club_welcome_es` (TRANSACTIONAL)
   - `cumpleanos_recordatorio_2d_es` (TRANSACTIONAL)
   - `cumpleanos_recordatorio_1d_es` (TRANSACTIONAL)
   - `cumpleanos_celebracion_es` (TRANSACTIONAL)
   - Ver: `docs/PLANTILLAS_META_CUMPLEAÑOS.md`

2. **Configurar escenarios en Make.com**
   - Club welcome: Trigger `club_inscripcion` → POST `/api/whatsapp/send-club-welcome`
   - 3 Birthday scenarios: Cron 6 AM → POST `/api/whatsapp/send-birthday-reminder`
   - Ver: `docs/INTEGRACION_BIENVENIDA_CLUB.md` y `AUTOMATIZACION_CUMPLEAÑOS.md`

3. **Testear el sistema**
   - Envía mensaje al chat endpoint con `perfil_id` y `telefono`
   - Verifica que se registren en `whatsapp_conversation_history`
   - Verifica que se actualice `whatsapp_customer_memory`
   - Verifica que el agente reconozca el nombre del cliente en mensajes posteriores

---

## Debug

Si algo falla, checkea los logs:

### Logs de Node.js (endpoint de chat)
```bash
# En el terminal de desarrollo
npm run dev
# Busca en stdout/stderr: "[ai/chat] Error recuperando contexto del cliente"
```

### Logs de Supabase
- Ve a: https://app.supabase.com → tu proyecto → "Logs" → "Functions" o "Database"
- Busca errores de las funciones SQL que creaste

---

## Estado de Integración

| Componente | Estado | Referencia |
|-----------|--------|-----------|
| Migrations SQL | ⏳ PENDIENTE EJECUTAR | `supabase/migrations/2026042800*` |
| Endpoint de chat | ✅ LISTO | `src/app/api/ai/chat/route.ts` |
| Utilidades memoria | ✅ LISTO | `src/utils/whatsapp-memory.ts` |
| Commit Git | ✅ LISTO | `e077867` |
| Documentación | ✅ LISTO | Este archivo |

---

**🎯 RESUMEN**: 
Ejecuta las 3 migrations en Supabase Dashboard, verifica que las tablas existan, y luego el agente estará listo para recordar nombres, temas previos, y ser más personal según el nivel de confianza del cliente.
