# 🔧 Solución: Error "tipo_mime" Column Not Found

## ❌ El Problema

```
POST https://xqcsftjkvcrbcetrdulq.supabase.co/rest/v1/material_didactico 400 (Bad Request)
{code: 'PGRST204', message: "Could not find the 'tipo_mime' column of 'material_didactico' in the schema cache"}
```

Este error ocurre cuando:
- El código usa nombres de columna antiguos (`tipo_mime`, `url`, `tipo_origen`)
- Supabase tiene una versión en caché del schema de la tabla
- La tabla real tiene otros nombres de columnas (`mime_type`, `url_archivo`, etc.)

## ✅ La Solución

### **Paso 1: Verificar el Schema en Supabase**

1. Ve a [Supabase Dashboard](https://app.supabase.com) → Tu proyecto
2. Ve a **SQL Editor**
3. Copia y ejecuta este script:

```sql
-- Verificar columnas actuales
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'material_didactico'
ORDER BY ordinal_position;
```

**Deberías ver estas columnas:**
- ✅ `mime_type` (no `tipo_mime`)
- ✅ `url_archivo` (no `url`)
- ✅ `nombre_archivo`
- ✅ `tamano_bytes`
- ✅ `visible`
- ✅ `tipo_material`
- ✅ `pensum_id`
- ✅ `programa_id`
- ✅ `titulo`
- ✅ `descripcion`

### **Paso 2: Si faltan columnas, agregarlas**

```sql
-- Agregar columnas faltantes
ALTER TABLE public.material_didactico 
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100);

ALTER TABLE public.material_didactico 
  ADD COLUMN IF NOT EXISTS url_archivo TEXT;

ALTER TABLE public.material_didactico 
  ADD COLUMN IF NOT EXISTS nombre_archivo VARCHAR(255);

ALTER TABLE public.material_didactico 
  ADD COLUMN IF NOT EXISTS tamano_bytes INTEGER;

ALTER TABLE public.material_didactico 
  ADD COLUMN IF NOT EXISTS visible BOOLEAN DEFAULT true;
```

### **Paso 3: Borrar columnas antiguas (si existen)**

```sql
-- Eliminar columnas antiguas que causan confusión
ALTER TABLE public.material_didactico 
  DROP COLUMN IF EXISTS tipo_mime CASCADE;

ALTER TABLE public.material_didactico 
  DROP COLUMN IF EXISTS url CASCADE;

ALTER TABLE public.material_didactico 
  DROP COLUMN IF EXISTS tipo_origen CASCADE;
```

### **Paso 4: Limpiar el caché de Supabase**

**El caché se limpia automáticamente después de 30 segundos**, pero puedes forzarlo:

1. En Supabase Dashboard, ve a cualquier sección
2. Presiona `F12` para abrir DevTools
3. Ve a **Console**
4. Ejecuta:
```javascript
// Limpiar caché local
localStorage.clear();
location.reload();
```

### **Paso 5: Redeploy en Vercel**

1. Ve a [Vercel Dashboard](https://vercel.com)
2. Selecciona tu proyecto
3. Ve a **Deployments**
4. Haz clic en el último deploy
5. Presiona **Redeploy**

O desde CLI:
```bash
vercel --prod
```

### **Paso 6: Probar nuevamente**

1. Ve a tu aplicación en Vercel
2. Intenta subir un material didáctico
3. El error debería desaparecer

---

## 📋 Checklist de Verificación

- [ ] Verificar que `material_didactico` tiene `mime_type` (no `tipo_mime`)
- [ ] Verificar que tiene `url_archivo` (no `url`)
- [ ] Borrar columnas antiguas (`tipo_mime`, `url`, `tipo_origen`)
- [ ] Limpiar caché de Supabase (esperar 30 segundos o forzar reload)
- [ ] Redeploy en Vercel
- [ ] Probar upload de material

---

## 🔍 Si el problema persiste

### Opción A: Recrear la tabla desde cero

```sql
-- ⚠️ ADVERTENCIA: Esto borrará todos los datos existentes
-- Solo haz esto si no tienes datos importantes

DROP TABLE IF EXISTS public.material_didactico CASCADE;

-- Luego copia el SQL de migración y ejecuta para recrearla
```

### Opción B: Contactar a Supabase Support

Si después de estos pasos sigue el error, es posible que sea un problema de caché interno de Supabase:
- Ve a Supabase Dashboard
- Help → Support
- Reporta que el schema cache no se limpia

---

## 💡 Referencia: Nombres de Columnas Correctos

| Campo en Code | Nombre Real en BD | Tipo |
|---|---|---|
| `mime_type` | `mime_type` | VARCHAR(100) |
| `url_archivo` | `url_archivo` | TEXT |
| `nombre_archivo` | `nombre_archivo` | VARCHAR(255) |
| `tamano_bytes` | `tamano_bytes` | INTEGER |
| `visible` | `visible` | BOOLEAN |
| `tipo_material` | `tipo_material` | VARCHAR(50) |
| `pensum_id` | `pensum_id` | UUID |
| `programa_id` | `programa_id` | INTEGER |
| `titulo` | `titulo` | VARCHAR(255) |
| `descripcion` | `descripcion` | TEXT |

**❌ NUNCA uses:**
- `tipo_mime` → usa `mime_type`
- `url` → usa `url_archivo`
- `tipo_origen` → no existe

---

## 📝 Nota

El código en `src/components/GestorPensum.tsx` ya está **100% correcto**. 
El problema es únicamente el caché de schema en Supabase que necesita limpiarse.
