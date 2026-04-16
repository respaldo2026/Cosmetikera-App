# 🚨 SOLUCIÓN DEFINITIVA - Error 403 al Crear Grupos

## ¿Por qué sigue fallando?

El script SQL **NO** se ejecuta en tu computadora. Debe ejecutarse en **Supabase Dashboard**.

---

## 📋 INSTRUCCIONES PASO A PASO (5 minutos)

### ✅ PASO 1: Abrir Supabase Dashboard

1. Abre tu navegador
2. Ve a: **https://supabase.com/dashboard/sign-in**
3. Inicia sesión con tu cuenta
4. Selecciona el proyecto: **academia-crystal** (xqcsftjkvcrbcetrdulq)

### ✅ PASO 2: Abrir SQL Editor

1. En el menú lateral IZQUIERDO, busca el ícono: 📝 **SQL Editor**
2. Haz clic en él
3. Haz clic en el botón **+ New query** (arriba a la derecha)

### ✅ PASO 3: Ejecutar el Script

**Copia esto COMPLETO:**

```sql
ALTER TABLE cursos DISABLE ROW LEVEL SECURITY;

SELECT 
  tablename,
  rowsecurity,
  CASE 
    WHEN rowsecurity = false THEN '✅ LISTO'
    ELSE '❌ FALLÓ'
  END as estado
FROM pg_tables
WHERE tablename = 'cursos';
```

1. **Pégalo** en el editor SQL (donde está el cursor parpadeando)
2. Haz clic en el botón **▶️ RUN** (esquina inferior derecha)
3. Espera 1-2 segundos
4. **Debes ver en los resultados:**
   ```
   tablename: cursos
   rowsecurity: false
   estado: ✅ LISTO
   ```

**Si ves `rowsecurity: true`**, repite el paso 3 de nuevo.

### ✅ PASO 4: Recargar la Aplicación

1. **Cierra TODAS las pestañas** de tu aplicación (app.crystaldiamante.com)
2. **Abre una NUEVA PESTAÑA**
3. Ve a: https://app.crystaldiamante.com
4. **Inicia sesión** de nuevo
5. Ve a **Cursos** → **Crear nuevo grupo**
6. **Intenta crear el grupo**

---

## 🎯 ¿Cómo sé que funcionó?

- ✅ El grupo se guarda sin errores
- ✅ Te redirige a la lista de grupos
- ✅ Ves el nuevo grupo creado en la tabla

---

## ❌ Si aún falla después de seguir TODOS los pasos

Ejecuta esto en Supabase para ver el error exacto:

```sql
-- Ver tu usuario y rol
SELECT 
  auth.uid() as mi_id,
  auth.email() as mi_email,
  (SELECT rol FROM perfiles WHERE id = auth.uid()) as mi_rol;

-- Intentar insertar manualmente
INSERT INTO cursos (
  nombre, 
  programa_id,
  profesor_id,
  cupo_maximo,
  precio,
  estado,
  modalidad
) VALUES (
  'TEST - ELIMINAR DESPUÉS',
  (SELECT id FROM programas LIMIT 1),
  auth.uid(),
  20,
  0,
  'proximo',
  'presencial'
);

-- Si funcionó, bórralo:
DELETE FROM cursos WHERE nombre = 'TEST - ELIMINAR DESPUÉS';
```

Si este test manual funciona, el problema está en la aplicación web (no en Supabase).

---

## 🔧 Script Adicional Ejecutado

También actualicé el código para mostrar errores más claros:
- **Archivo modificado**: `src/app/cursos/create/page.tsx`
- **Cambio**: Ahora muestra el mensaje exacto del error de Supabase
- **Commit**: `16525a7`
- **Vercel**: Se desplegará automáticamente en 1-2 minutos

---

## 📞 Si nada funciona

Comparte:
1. Screenshot de los resultados del PASO 3 (la tabla con `rowsecurity`)
2. El error EXACTO que aparece en la consola del navegador (F12 → Console)
3. Tu email registrado en Supabase

Así puedo verificar los permisos de tu usuario específico.
