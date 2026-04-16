# 🔴 PROBLEMA: Pagos de Inscripción No Visibles en Tesorería

## 📊 ANÁLISIS EJECUTIVO

### El Problema
Cuando inscribes un estudiante y registras el pago de inscripción, **el pago NO aparece en tesorería** ni en el estado financiero del estudiante.

### Causa Raíz Identificada
**Problema de múltiples niveles:**

1. **RLS Conflictivo**: Hay dos conjuntos de políticas que se sobreescriben
2. **Campos Faltantes**: La tabla `pagos` podría no tener campos `numero_cuota` y `periodo_pagado`
3. **Trigger No Ejecutado**: El trigger que genera cuotas automáticas podría no existir o estar mal

---

## 🎯 SOLUCIÓN PASO A PASO

### Paso 1: Ejecutar el SQL Fix Completo

**Abre Supabase Dashboard → SQL Editor y copia TODO el contenido de:**
```
fix-rls-pagos.sql
```

**Luego pega y ejecuta en el editor de Supabase.**

Este script:
- ✅ Deshabilita RLS conflictivo
- ✅ Elimina todas las políticas antiguas
- ✅ Agrega campos faltantes (`numero_cuota`, `periodo_pagado`, `fecha_vencimiento`)
- ✅ Crea índices para performance
- ✅ Recrea la función de generación de cuotas
- ✅ Recrea el trigger automático
- ✅ Crea una única policy permisiva

### Paso 2: Verificar que el Fix Funcionó

Al final del script hay 3 queries de verificación. **Ejecuta cada una** y verifica:

#### Query 1: Policies activas
```sql
SELECT policyname FROM pg_policies WHERE tablename = 'pagos';
```
**Resultado esperado:** Solo 1 fila con `"Acceso total a pagos para usuarios autenticados"`

#### Query 2: Todos los pagos
```sql
SELECT id, numero_cuota, periodo_pagado, estado, monto 
FROM pagos 
ORDER BY created_at DESC LIMIT 10;
```
**Resultado esperado:** Ver los pagos creados (deberían tener `numero_cuota`, `periodo_pagado` poblados)

#### Query 3: Pagos de inscripción
```sql
SELECT p.id, p.numero_cuota, p.periodo_pagado, p.estado, p.monto,
       prf.nombre_completo, c.nombre
FROM pagos p
LEFT JOIN perfiles prf ON p.estudiante_id = prf.id
LEFT JOIN matriculas m ON p.matricula_id = m.id
LEFT JOIN cursos c ON m.curso_id = c.id
WHERE p.numero_cuota = 0 OR p.periodo_pagado ILIKE 'inscripcion%'
ORDER BY p.created_at DESC LIMIT 20;
```
**Resultado esperado:** Ver pagos de inscripción con `numero_cuota = 0`

### Paso 3: Refrescar la Aplicación

En el navegador, presiona:
```
Ctrl + Shift + R  (fuerza actualización de caché)
```

O usa:
```
Ctrl + Shift + Del  (borra caché de la aplicación)
```

### Paso 4: Prueba con un Estudiante Nuevo

1. **Navega a:** `/matriculas/create`
2. **Busca o crea un estudiante**
3. **Selecciona un curso**
4. **Registra el pago de inscripción** (llena el formulario)
5. **Navega a:** `/tesoreria`
   - ✅ Debe aparecer el pago con estado "pagado"
6. **Navega a:** `/estudiantes/show/[id]` (perfil del estudiante)
   - ✅ Debe mostrar el pago en el historial

---

## 🆘 SI AÚN NO FUNCIONA

### Debug 1: Verificar que el SQL se ejecutó sin errores

En Supabase SQL Editor, ejecuta:
```sql
-- ¿Tiene la tabla pagos el campo numero_cuota?
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'pagos' 
ORDER BY ordinal_position;
```

**Debe incluir:**
- `id`
- `estudiante_id`
- `matricula_id`
- `monto`
- `estado`
- `numero_cuota` ← DEBE EXISTIR
- `periodo_pagado` ← DEBE EXISTIR
- `fecha_vencimiento` ← DEBE EXISTIR

Si faltan, vuelve al **Paso 1** y ejecuta nuevamente.

### Debug 2: Verificar que el trigger existe

```sql
SELECT 
    tgname, 
    tgtype, 
    tgenabled
FROM pg_trigger 
WHERE tgrelid = 'matriculas'::regclass;
```

**Resultado esperado:**
- Debe haver un trigger llamado `trigger_generar_cuotas`
- `tgenabled` debe ser `true`

### Debug 3: Verificar que la función existe

```sql
SELECT proname, prokind
FROM pg_proc 
WHERE proname = 'generar_cuotas_automaticas';
```

**Resultado esperado:** 1 fila con `prokind = 'f'` (función)

### Debug 4: Ver logs del navegador

1. **Abre DevTools:** F12
2. **Consola:** Ctrl+Shift+K
3. **Red:** Ctrl+Shift+E
4. **Vuelve a intentar registrar un pago**
5. **Busca errores en rojo** en la consola

Si ves errores, comparte las líneas de error.

---

## 📋 RESUMEN DE CAMBIOS

| Elemento | Antes | Después |
|----------|-------|---------|
| **RLS Policies** | 2-3 conflictivas | 1 permisiva |
| **Campo `numero_cuota`** | ❌ Podría no existir | ✅ Garantizado |
| **Campo `periodo_pagado`** | ❌ Podría no existir | ✅ Garantizado |
| **Función cuotas** | ❓ Existente pero podría estar mal | ✅ Recreada |
| **Trigger** | ❓ Podría estar deshabilitado | ✅ Recreado y habilitado |
| **Índices** | ❌ Faltaban | ✅ Creados |
| **Visibilidad pagos** | 🔴 Bloqueada | 🟢 Completa |

---

## 🧪 VERIFICACIÓN COMPLETA

Ejecuta esto en Supabase para un diagnóstico final:

```sql
-- RESUMEN COMPLETO DEL SISTEMA DE PAGOS
WITH stats AS (
    SELECT 
        COUNT(*) as total_pagos,
        COUNT(CASE WHEN estado = 'pagado' THEN 1 END) as pagos_pagados,
        COUNT(CASE WHEN estado = 'pendiente' THEN 1 END) as pagos_pendientes,
        COUNT(CASE WHEN numero_cuota = 0 THEN 1 END) as pagos_inscripcion
    FROM pagos
)
SELECT 
    'Tabla pagos' as component,
    'Campos obligatorios' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pagos' AND column_name='numero_cuota') 
        THEN '✅ OK' 
        ELSE '❌ FALTA numero_cuota' 
    END as status
UNION ALL
SELECT 'Tabla pagos', 'Campos obligatorios',
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pagos' AND column_name='periodo_pagado') 
        THEN '✅ OK' 
        ELSE '❌ FALTA periodo_pagado' 
    END
UNION ALL
SELECT 'RLS', 'Policies',
    CASE 
        WHEN (SELECT COUNT(*) FROM pg_policies WHERE tablename='pagos') = 1 
        THEN '✅ OK (1 policy)' 
        ELSE '❌ ' || (SELECT COUNT(*) FROM pg_policies WHERE tablename='pagos')::text || ' policies' 
    END
UNION ALL
SELECT 'Trigger', 'Existe y habilitado',
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trigger_generar_cuotas') 
        THEN '✅ OK' 
        ELSE '❌ NO EXISTE' 
    END
UNION ALL
SELECT 'Pagos', 'Total registrados',
    (SELECT (stats.*).total_pagos::text FROM stats)
UNION ALL
SELECT 'Pagos', 'Inscripción (numero_cuota=0)',
    (SELECT (stats.*).pagos_inscripcion::text FROM stats);
```

---

## 📞 SOPORTE

Si después de ejecutar el fix aún no funciona:

1. **Comparte los resultados de la Query de Debug**
2. **Comparte cualquier error de la consola del navegador** (F12 → Consola)
3. **Indica:** ¿En qué paso se queda? ¿Qué mensaje de error ves?

---

## 🚀 PRÓXIMAS ACCIONES

Después de que funcione:

1. ✅ Inscribe varios estudiantes para probar
2. ✅ Verifica que los pagos aparezcan en tesorería
3. ✅ Verifica que el estado financiero se actualice
4. ✅ Considera hacer backup de la BD

---

Generated: 2026-01-12  
Status: **ACTUALIZADO - FIX MÁS ROBUSTO**  
Priority: **EJECUTAR INMEDIATAMENTE**
