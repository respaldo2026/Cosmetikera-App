# ⚡ INSTRUCCIONES RÁPIDAS: Aplicar FIX en 5 MINUTOS

## 🎯 Objetivo
Permitir que se guarden cambios en formularios de edición (estudiantes, profesores, cursos, etc.)

## ⏱️ Tiempo estimado
**5 minutos**

---

## 📋 PASO 1: Verificar el problema (1 minuto)

### Opción A: Visual (Rápido)
```
Vercel → /estudiantes
  ↓
Click editar estudiante
  ↓
Cambiar nombre + guardar
  ↓
Recargar página
  ↓
¿El nombre cambió?
  ❌ NO → Tienes el problema
  ✅ SÍ → Ya está arreglado (skip al PASO 4)
```

### Opción B: SQL (Más riguroso)

1. Abre Supabase Dashboard
2. SQL Editor → New Query
3. Copia contenido de: `VERIFICAR-RLS-ACTUAL.sql`
4. Run → Busca ❌ en los resultados
   - Si hay ❌ → Continúa al PASO 2
   - Si todo está ✅ → Problema es otro, ver sección "Debugging" al final

---

## 📋 PASO 2: Acceder a Supabase (1 minuto)

1. Abre [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Login con tu cuenta
3. Selecciona proyecto: **Academia Crystal** (o tu proyecto)
4. Sidebar izquierdo → **SQL Editor**
5. Click en **+ New Query** (botón azul arriba)

---

## 📋 PASO 3: Ejecutar el FIX (2 minutos)

1. Abre archivo: `FIX-ACTUALIZACIONES-TABLAS-2026.sql` (en el repo)
2. **IMPORTANTE:** Lee los primeros 3 comentarios (líneas 1-5)
3. Selecciona TODO el contenido (`Ctrl+A`)
4. Copia (`Ctrl+C`)
5. En Supabase SQL Editor, pega (`Ctrl+V`)
6. Click en **Run** (botón azul) o presiona `Ctrl+Enter`
7. **Espera a que termine** (verás un checkmark ✅)
8. Lee el mensaje final: debe decir `FIX COMPLETADO ✅`

### Qué pasa si hay error?

**Error: "Permission denied"**
- [ ] Verifica que estés logueado como admin en Supabase
- [ ] Intenta desloguear y loguear de nuevo
- [ ] Si persiste, copia solo el PASO 1 del script (PERFILES)

**Error: "Policy already exists"**
- [ ] Esto es NORMAL (significa ya lo ejecutaste antes)
- [ ] Continúa al PASO 4

**Otro error**
- [ ] Copia el mensaje de error
- [ ] Revisa en [DIAGNOSTICO-ACTUALIZACIONES-NO-GUARDAN.md](DIAGNOSTICO-ACTUALIZACIONES-NO-GUARDAN.md) sección "Debugging"

---

## 📋 PASO 4: Validar que funciona (1 minuto)

### En Vercel
```
1. Abre tu app: https://academia-crystal.vercel.app
2. Limpia caché: Ctrl+Shift+R (importante!)
3. Login como admin
4. Ir a: /estudiantes
5. Click en "Editar" en cualquier estudiante
6. Cambiar UN campo (ej: nombre)
7. Click "Guardar"
8. Debe volver a la lista sin errores
9. Abre el estudiante de nuevo
   ✅ Si el nombre cambió → FIX FUNCIONÓ
   ❌ Si no cambió → Ver "Debugging" abajo
```

### Verificación más completa

Sigue la [GUIA-PRUEBAS-CRUD-2026.md](GUIA-PRUEBAS-CRUD-2026.md) (16 pruebas, 10 minutos)

---

## 🐛 Debugging si algo no funciona

### Síntoma: "Cambios no se guardan"

**Paso 1: Verifica que ejecutaste TODO el script**
```
Supabase SQL Editor
  ↓
Busca: SELECT 'FIX COMPLETADO
  ↓
¿Ves la query? 
  ✅ SÍ → Ve a Paso 2
  ❌ NO → Copiaste solo parcialmente, repite PASO 3
```

**Paso 2: Limpia caché del navegador**
```
En Vercel:
  Ctrl+Shift+R (limpieza fuerza)
  O: Ctrl+F5
  O: Settings → Limpiar cookies y caché
```

**Paso 3: Verifica RLS nuevamente**
```
Supabase SQL Editor → New Query
Copia: VERIFICAR-RLS-ACTUAL.sql
Run
Busca: "❌ PROBLEMA" en los resultados
  ✅ Si no hay ❌ → RLS está OK
  ❌ Si hay ❌ → Repite PASO 3 (FIX)
```

**Paso 4: Revisa errores en consola**
```
Vercel → /estudiantes/edit/1
F12 (abre consola)
Cambiar campo + click Guardar
Busca texto rojo en la consola
  → Si dice "403 Forbidden" = RLS aún bloqueando
  → Si dice "400 Bad Request" = Formato de datos incorrecto
  → Copia el error y revisa DIAGNOSTICO-ACTUALIZACIONES
```

### Síntoma: "Error 'Permission denied' al ejecutar SQL"

**Solución rápida:**
1. Supabase Dashboard → Settings → User Management
2. Verifica que tu usuario es "Owner" o "Admin"
3. Si no lo es, pídele a otro admin que ejecute el SQL

### Síntoma: "El cambio se guarda pero es incorrecto"

**Cause:** Validación de datos
```
Revisa que:
  ✅ Email tenga @ símbolo
  ✅ Teléfono sea numérico
  ✅ Fechas en formato YYYY-MM-DD
  ✅ Campos requeridos no estén vacíos
```

---

## ✅ Checklist Final

- [ ] Ejecuté `VERIFICAR-RLS-ACTUAL.sql` y vi el problema
- [ ] Abrí `FIX-ACTUALIZACIONES-TABLAS-2026.sql` completo
- [ ] Pegué TODO en Supabase SQL Editor
- [ ] Hice click en Run
- [ ] Esperé a ver ✅ "FIX COMPLETADO"
- [ ] Limpié caché del navegador (Ctrl+Shift+R)
- [ ] Probé editar un estudiante
- [ ] ✅ El cambio se guardó (recargué página y aún estaba)
- [ ] Probé otra tabla (profesor, curso, etc.)
- [ ] ✅ También funciona

---

## 🎉 ¡Listo!

Si checklist está completo y todo funciona:

1. Documenta en: `VERIFICACION-CRUD-COMPLETADA-2026.md`
2. Notifica al equipo que ya pueden editar datos
3. Guarda este documento para futuras referencias

---

## 📞 Si nada funciona

**Opción 1: Contacto directo**
- Abre issue en repo con:
  - Screenshot del error
  - Resultado de `VERIFICAR-RLS-ACTUAL.sql`
  - Console del navegador (F12)

**Opción 2: Ejecutar análisis completo**
- Sigue [GUIA-PRUEBAS-CRUD-2026.md](GUIA-PRUEBAS-CRUD-2026.md)
- Documenta exactamente dónde falla
- Envía reporte detallado

---

**Versión:** 1.0  
**Fecha:** 30 Enero 2026  
**Tiempo total:** 5-10 minutos  
**Riesgo:** Ninguno (SQL es idempotent)
