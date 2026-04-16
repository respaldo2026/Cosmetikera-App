# 🔧 CORRECCIÓN INMEDIATA - SQL Error Arreglado

## ⚠️ El Error que Recibiste

```
ERROR: 2BP01: cannot drop function generar_cuotas_automaticas() 
because other objects depend on it
DETAIL: trigger trigger_generar_cuotas on table matriculas 
depends on function generar_cuotas_automaticas()
```

## ✅ Ya Está Arreglado

El archivo `migration-complete-pagos-2026-01-12.sql` ha sido corregido.

**El problema:** El script intentaba eliminar la función ANTES de eliminar el trigger que depende de ella.

**La solución:** Ahora eliminamos el trigger PRIMERO, luego la función, luego la recreamos con el trigger.

## 🚀 Qué Hacer Ahora

### Opción 1: Ejecutar el SQL Corregido Nuevamente
1. Abre `migration-complete-pagos-2026-01-12.sql`
2. Copia TODO el contenido (ya está corregido)
3. Ve a Supabase → SQL Editor
4. Pega y haz click en ▶ RUN
5. Debería ejecutarse sin errores esta vez ✅

### Opción 2: Si Ejecutaste Parte del Script Antes
Si ejecutaste el script antes y falló a mitad, posiblemente ya creó algunas columnas pero no el trigger/función.

Ejecuta esto en SQL Editor para verificar:

```sql
-- Verificar qué existe
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pagos' AND column_name = 'numero_cuota'
) as columna_numero_cuota_existe,

EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'generar_cuotas_automaticas'
) as funcion_existe,

EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_generar_cuotas'
) as trigger_existe;
```

- Si todo es **false**: Ejecuta el SQL completo
- Si algunos son **true**: Ejecuta el SQL (está diseñado para ser idempotente)

## ✅ Cambios Realizados al Script

1. **Moved** `DROP TRIGGER IF EXISTS` al inicio (PASO 5.5)
2. **Changed** `DROP FUNCTION IF EXISTS generar_cuotas_automaticas();` a `DROP FUNCTION IF EXISTS generar_cuotas_automaticas() CASCADE;`
3. **Removed** el `DROP TRIGGER` duplicado de PASO 7

## 🔄 El SQL Ahora Hace Esto:

```
1. Crea tabla programas (IF NOT EXISTS)
   ↓
2. Agrega columnas a cursos
   ↓
3. Agrega columnas a pagos
   ↓
4. Crea índices
   ↓
5. Habilita RLS en programas
   ↓
5.5. 🆕 ELIMINA TRIGGER PRIMERO (si existe)
   ↓
6. ELIMINA FUNCIÓN (con CASCADE si es necesario)
   ↓
7. CREA FUNCIÓN NUEVA
   ↓
8. CREA TRIGGER NUEVO
   ↓
✅ LISTO - Sin errores
```

## 📝 Próximo Paso

Ahora sí: **Copia el SQL corregido y ejecuta en Supabase.** 

El archivo ya fue actualizado automáticamente.

---

**¡El error está resuelto!** ⚡

Ejecuta nuevamente y debería funcionar sin problemas.
