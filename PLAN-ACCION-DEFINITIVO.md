# 🔴 PROBLEMA PERSISTENTE - PLAN DE ACCIÓN

## 📊 SÍNTOMAS ACTUALES

- ❌ Dashboard muestra: **$1,230,000** (debería mostrar $190,000)
- ❌ Tesorería: **VACÍA** (debería mostrar 1 pago)
- ❌ Estado financiero estudiante: **VACÍO** (debería mostrar 1 pago)

---

## 🎯 DIAGNÓSTICO PASO A PASO

### PASO 1: Verificar Montos Reales

**Ejecuta en Supabase:** `investigar-montos-reales.sql`

**Resultado esperado:**
```
Query 2 debería mostrar:
estado     | cantidad_pagos | suma_monto
pagado     | 1              | 190000
pendiente  | 4              | 1040000
```

**Interpretación:**
- Si suma = 1,230,000 → Dashboard suma TODO (pagado + pendiente) ✅ explicado
- Si inscripción ≠ 190,000 → El monto se guardó mal ❌

---

### PASO 2: Verificar Query de Tesorería

**Ejecuta en Supabase:** `test-query-tesoreria.sql`

**Enfócate en Query 6:**
```sql
SELECT 
    p.id,
    p.monto,
    p.estado,
    prf.nombre_completo,
    c.nombre as curso
FROM pagos p
LEFT JOIN perfiles prf ON p.estudiante_id = prf.id
LEFT JOIN matriculas m ON p.matricula_id = m.id
LEFT JOIN cursos c ON m.curso_id = c.id
WHERE p.estado = 'pagado'
ORDER BY p.fecha_pago DESC NULLS LAST;
```

**Resultado esperado:**
```
1 fila con tu pago de $190,000
```

**Si aparece 1 fila:**
- ✅ El pago existe y está bien
- ❌ Problema de RLS o caché del navegador

**Si NO aparece nada:**
- ❌ El pago no tiene `estudiante_id`
- ❌ El pago está mal relacionado

---

### PASO 3: Verificar RLS (de nuevo)

**Ejecuta en Supabase:**
```sql
SELECT policyname FROM pg_policies WHERE tablename = 'pagos';
```

**Resultado esperado:**
```
Acceso completo a pagos
```

**Si ves más de 1 policy:**
- ❌ fix-rls-simple.sql NO se ejecutó correctamente
- 🔧 Vuelve a ejecutar fix-rls-simple.sql

---

## 🚀 SOLUCIONES SEGÚN RESULTADO

### Caso A: Query 6 muestra el pago PERO tesorería vacía

**Causa:** Problema de caché del navegador o RLS aún activo

**Solución:**
1. Borrar caché completo del navegador:
   ```
   Ctrl + Shift + Del
   → Borrar "Todo" desde "Siempre"
   → Incluir caché e imágenes
   ```

2. Cerrar y reabrir el navegador completamente

3. Volver a http://localhost:3001/tesoreria

4. Si aún no aparece, revisar consola del navegador (F12):
   - Buscar errores en rojo
   - Copiar el mensaje de error

---

### Caso B: Query 6 NO muestra nada

**Causa:** Los pagos no tienen `estudiante_id` correcto

**Solución - Ejecutar en Supabase:**
```sql
-- Actualizar el estudiante_id en los pagos desde las matrículas
UPDATE pagos p
SET estudiante_id = m.estudiante_id
FROM matriculas m
WHERE p.matricula_id = m.id
AND p.estudiante_id IS NULL;

-- Verificar que se actualizó
SELECT COUNT(*) FROM pagos WHERE estudiante_id IS NOT NULL;
```

Luego volver a ejecutar Query 6 de `test-query-tesoreria.sql`

---

### Caso C: Dashboard suma todo (pagado + pendiente)

**Causa:** El código del dashboard suma TODOS los pagos sin filtrar

**Solución:** Necesitamos modificar el código del dashboard

Abre: [src/app/page.tsx](src/app/page.tsx#L150)

Cambia la línea 159:
```tsx
// ANTES (malo - suma todo)
const totalIngresos = pagosMesReal?.reduce((acc, curr) => acc + Number(curr.monto || 0), 0) || 0;

// DESPUÉS (bueno - solo pagados)
const totalIngresos = pagosMesReal?.filter((p: any) => p.estado === 'pagado').reduce((acc, curr) => acc + Number(curr.monto || 0), 0) || 0;
```

Y también modificar el query en línea 150:
```tsx
// ANTES
.from("pagos")
.select("monto");

// DESPUÉS
.from("pagos")
.select("monto, estado");
```

---

## 📋 CHECKLIST DE EJECUCIÓN

- [ ] 1. Ejecutar `investigar-montos-reales.sql` → Copiar resultados Query 2
- [ ] 2. Ejecutar `test-query-tesoreria.sql` → Copiar resultados Query 6
- [ ] 3. Verificar políticas RLS (debe haber solo 1)
- [ ] 4. Según resultado, aplicar Caso A, B o C
- [ ] 5. Borrar caché navegador (Ctrl+Shift+Del)
- [ ] 6. Refrescar tesorería
- [ ] 7. Compartir screenshot si persiste

---

## 🔧 FIX DEFINITIVO (Si nada funciona)

Si después de todo aún no funciona, ejecuta este SQL que RECONSTRUYE todo:

```sql
-- 1. Deshabilitar RLS
ALTER TABLE pagos DISABLE ROW LEVEL SECURITY;

-- 2. Eliminar todas las policies
DO $$ 
DECLARE policy_rec RECORD;
BEGIN
    FOR policy_rec IN SELECT policyname FROM pg_policies WHERE tablename = 'pagos'
    LOOP
        EXECUTE 'DROP POLICY "' || policy_rec.policyname || '" ON pagos';
    END LOOP;
END $$;

-- 3. Actualizar estudiante_id faltante
UPDATE pagos p
SET estudiante_id = m.estudiante_id
FROM matriculas m
WHERE p.matricula_id = m.id
AND (p.estudiante_id IS NULL OR p.estudiante_id != m.estudiante_id);

-- 4. Habilitar RLS
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

-- 5. Crear policy única
CREATE POLICY "full_access" ON pagos FOR ALL USING (true) WITH CHECK (true);

-- 6. Verificar
SELECT 
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'pagos') as policies,
    (SELECT COUNT(*) FROM pagos WHERE estudiante_id IS NOT NULL) as pagos_con_estudiante,
    (SELECT COUNT(*) FROM pagos WHERE estado = 'pagado') as pagos_pagados;
```

---

Generated: 2026-01-12  
Status: **EJECUTAR PASOS 1 y 2 PRIMERO**
