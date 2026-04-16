# 🔍 INVESTIGACIÓN: Pago NO Aparece en Tesorería

## 📋 Síntomas Reportados
1. ❌ El pago NO aparece en tesorería
2. ❌ El pago NO aparece en estado financiero del estudiante
3. ⚠️ El dashboard muestra un valor que NO corresponde a lo inscrito
4. ❌ El monto aparece incorrecto

---

## 🎯 DIAGNÓSTICO EN 5 PASOS

### PASO 1: Ejecutar el Fix Robusto

**Antes que nada**, ejecuta el script `fix-rls-pagos.sql` en Supabase SQL Editor.

Este script:
- ✅ Crea/recrea la función `generar_cuotas_automaticas()`
- ✅ Crea/recrea el trigger `trigger_generar_cuotas`
- ✅ Corrige el RLS conflictivo
- ✅ Agrega campos faltantes

**Instrucciones:**
1. Abre Supabase Dashboard
2. Ve a SQL Editor
3. Copia TODO de `fix-rls-pagos.sql`
4. Pega en el editor
5. Ejecuta (Ctrl+Enter)

---

### PASO 2: Verificar el Fix

Después de ejecutar el fix, ejecuta este SQL en Supabase:

```sql
-- ✅ Verificar que el trigger existe y está habilitado
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname = 'trigger_generar_cuotas';
```

**Resultado esperado:**
```
trigger_generar_cuotas | true
```

Si NO aparece o está en `false` = El fix no funcionó, vuelve a intentar.

---

### PASO 3: Verificar que el Trigger Crea Pagos

Ejecuta este SQL:

```sql
-- Ver las últimas 5 matrículas con sus pagos asociados
SELECT 
    m.id as matricula_id,
    m.estado,
    m.created_at,
    COUNT(p.id) as total_pagos,
    COUNT(CASE WHEN p.numero_cuota = 0 THEN 1 END) as pagos_inscripcion,
    SUM(p.monto) as suma_montos
FROM matriculas m
LEFT JOIN pagos p ON m.id = p.matricula_id
GROUP BY m.id, m.estado, m.created_at
ORDER BY m.created_at DESC
LIMIT 5;
```

**Resultado esperado:**
```
matricula_id | estado     | total_pagos | pagos_inscripcion | suma_montos
1            | pendiente  | 5           | 1                 | 250000
```

Si `total_pagos = 0` = **El trigger NO está creando pagos**
Si `pagos_inscripcion = 0` = **Falta el pago de inscripción**

---

### PASO 4: Verificar que los Pagos son Visibles (RLS)

Ejecuta este SQL:

```sql
-- Ver todos los pagos creados
SELECT 
    id,
    numero_cuota,
    periodo_pagado,
    monto,
    estado,
    created_at
FROM pagos
ORDER BY created_at DESC
LIMIT 10;
```

Si aparecen registros = **Los pagos SÍ existen pero están bloqueados por RLS**

---

### PASO 5: Verificar el Formulario de Pago

Cuando llenes el formulario de pago en `/matriculas/create`:

1. **Abre DevTools:** F12
2. **Consola:** Ctrl+Shift+K
3. **Copia los logs que digan:**
   - `"Error registrando pago"`
   - `"Pago registrado y matrícula activada"`
   - Cualquier error en rojo

---

## 🚀 SOLUCIÓN DEFINITIVA (Si aún no funciona)

Si después del fix aún NO funciona, ejecuta este script SQL en Supabase:

```sql
-- ================================================
-- LIMPIAR Y RECONSTRUIR DESDE CERO
-- ================================================

-- 1. Eliminar el trigger viejo
DROP TRIGGER IF EXISTS trigger_generar_cuotas ON matriculas;

-- 2. Eliminar la función vieja
DROP FUNCTION IF EXISTS generar_cuotas_automaticas();

-- 3. Crear la función NUEVAMENTE (copiar de fix-rls-pagos.sql líneas 74-124)
CREATE OR REPLACE FUNCTION generar_cuotas_automaticas()
RETURNS TRIGGER AS $$
DECLARE
    duracion_meses INTEGER;
    precio_programa NUMERIC(10,2);
    precio_inscripcion NUMERIC(10,2);
    precio_cuota NUMERIC(10,2);
    fecha_base DATE;
    i INTEGER;
    fecha_vencimiento_cuota DATE;
BEGIN
    SELECT c.duracion::INTEGER, c.precio, COALESCE(p.precio_inscripcion, 50000)
    INTO duracion_meses, precio_programa, precio_inscripcion
    FROM cursos c
    LEFT JOIN programas p ON c.programa_id = p.id
    WHERE c.id = NEW.curso_id;

    IF duracion_meses IS NULL OR duracion_meses = 0 THEN
        duracion_meses := 4;
    END IF;

    fecha_base := COALESCE(NEW.fecha_inicio, CURRENT_DATE);

    INSERT INTO pagos (
        estudiante_id, matricula_id, monto, estado, numero_cuota,
        periodo_pagado, fecha_pago, fecha_vencimiento, 
        metodo_pago, observaciones, created_at
    ) VALUES (
        NEW.estudiante_id,
        NEW.id,
        precio_inscripcion,
        'pagado',
        0,
        'Inscripción',
        NOW(),
        fecha_base,
        'inscripcion',
        'Inscripción pagada automáticamente al matricular',
        NOW()
    );

    FOR i IN 1..duracion_meses LOOP
        fecha_vencimiento_cuota := fecha_base + (i * INTERVAL '1 month');
        
        INSERT INTO pagos (
            estudiante_id, matricula_id, monto, estado, numero_cuota,
            periodo_pagado, fecha_vencimiento, created_at
        ) VALUES (
            NEW.estudiante_id,
            NEW.id,
            CEIL((precio_programa / duracion_meses)),
            'pendiente',
            i,
            'Mes ' || i,
            fecha_vencimiento_cuota,
            NOW()
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Crear el trigger nuevamente
CREATE TRIGGER trigger_generar_cuotas
AFTER INSERT ON matriculas
FOR EACH ROW
EXECUTE FUNCTION generar_cuotas_automaticas();

-- 5. Verificar
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'trigger_generar_cuotas';
```

---

## 📞 PASOS FINALES

Después de cualquier fix:

1. **Refrescar el navegador:**
   ```
   Ctrl + Shift + R
   ```

2. **Borrar caché (opcional):**
   ```
   Ctrl + Shift + Del
   ```

3. **Probar con un estudiante NUEVO:**
   - Ir a `/matriculas/create`
   - Crear nuevo estudiante O seleccionar existente
   - Seleccionar curso
   - Registrar pago de inscripción
   - Verificar que aparece en `/tesoreria`

4. **Verificar estado financiero:**
   - Ir a `/estudiantes/show/[id]`
   - Debe mostrar el pago en el historial

---

## ⚠️ PROBLEMAS CONOCIDOS

### Problema A: "El trigger no crea pagos"

**Causa:** Función no existe o está mal

**Solución:** Ejecutar `fix-rls-pagos.sql` completo nuevamente

### Problema B: "Los pagos se crean pero dicen 'pendiente' no 'pagado'"

**Causa:** El trigger crea la inscripción como pendiente en lugar de pagada

**Verifica:** La línea en la función que dice `estado = 'pagado'` debe estar presente en PASO 1 (inscripción)

### Problema C: "El monto es incorrecto"

**Causa:** El formulario está enviando un monto diferente

**Solución:** 
1. Abre DevTools (F12)
2. Consola
3. Rellena el formulario
4. Busca logs que muestren qué monto se está enviando
5. Verifica que coincida con `precio_inscripcion`

### Problema D: "El pago se guarda pero no aparece en tesorería"

**Causa:** RLS bloqueando la visualización

**Solución:** Ejecutar `fix-rls-pagos.sql` PASO 1-6 completo

---

## 📊 RESUMEN RÁPIDO

| Síntoma | Causa Probable | Solución |
|---------|---|---|
| No aparece en tesorería | RLS conflictivo | Ejecutar fix-rls-pagos.sql |
| Monto incorrecto en dashboard | Pagos con monto inválido | Ejecutar INVESTIGACION-PAGOS-MONTOS.sql |
| No aparece en estado financiero | Pago no se creó | Ejecutar DEBUG-PASO-A-PASO.sql |
| Trigger no crea pagos | Función no existe | Ejecutar fix-rls-pagos.sql PASO 7-8 |
| Aparece pero con estado "pendiente" | Trigger creó mal el pago | Verificar función en fix-rls-pagos.sql |

---

## 🔧 ARCHIVOS DISPONIBLES

1. **`fix-rls-pagos.sql`** - Fix COMPLETO (Ejecutar primero)
2. **`DEBUG-PASO-A-PASO.sql`** - Diagnóstico rápido
3. **`INVESTIGACION-PAGOS-MONTOS.sql`** - Ver montos y estructura
4. **`DIAGNOSTICO-PAGOS-COMPLETO.sql`** - Análisis profundo
5. **`PROBLEMA-Y-SOLUCION-PAGOS.md`** - Documentación

---

Generated: 2026-01-12  
Status: **EJECUTAR FIX-RLS-PAGOS.SQL PRIMERO**
