# 🔧 INSTRUCCIONES PARA ARREGLAR PAGOS NO VISIBLES - 2026-01-12

## 🎯 Problema Identificado
Los pagos registrados por estudiantes **NO aparecen en:**
- ❌ Tesorería
- ❌ Dashboard
- ❌ Perfil del estudiante (área financiera)

### Causa Raíz
La tabla `pagos` estaba **incompleta** en `schema.sql`. Le faltaban 3 columnas que el trigger `generar_cuotas_automaticas()` intenta insertar:
- `numero_cuota` - Identificar inscripción (0) vs cuotas mensuales (1, 2, 3...)
- `periodo_pagado` - Descripción del período ("Inscripción", "Mes 1", "Mes 2"...)
- `fecha_vencimiento` - Fecha en que vence el pago

Sin estas columnas, **los INSERTs fallaban silenciosamente** y no se creaban registros de pago.

---

## ✅ SOLUCIÓN APLICADA

### Paso 1: Actualizar schema.sql (YA HECHO)
✅ Se agregaron las 3 columnas faltantes a la tabla `pagos`:
```sql
ALTER TABLE pagos
ADD COLUMN IF NOT EXISTS numero_cuota INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS periodo_pagado TEXT,
ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;
```

✅ Se agregaron índices para optimizar búsquedas:
- `idx_pagos_numero_cuota`
- `idx_pagos_matricula_numero`
- `idx_pagos_fecha_vencimiento`
- `idx_pagos_estado_matricula`

✅ Se agregó la función y trigger `generar_cuotas_automaticas()` directamente en `schema.sql`

---

## 🚀 PASOS A SEGUIR (2-5 minutos)

### OPCIÓN A: Si aún no has ejecutado el schema.sql en tu Supabase (RECOMENDADO)
Simply run the updated schema.sql from scratch and you're done!

### OPCIÓN B: Si ya tienes la base de datos creada con esquema antiguo

#### 1️⃣ Abrir Supabase SQL Editor
- Ir a: https://supabase.com/dashboard
- Seleccionar tu proyecto "academia-crystal"
- Click en **SQL Editor** (izquierda)

#### 2️⃣ Ejecutar Migración
Copiar y pegar el contenido de:
```
migration-fix-pagos-columnas-2026-01-12.sql
```

En el editor SQL y hacer click en **▶ Run** (esquina superior derecha)

#### 3️⃣ Ejecutar Función y Trigger
Copiar y pegar esto en SQL Editor:

```sql
-- Crear función generar_cuotas_automaticas si no existe
CREATE OR REPLACE FUNCTION generar_cuotas_automaticas()
RETURNS TRIGGER AS $$
DECLARE
    duracion_meses INTEGER;
    precio_programa NUMERIC(10,2);
    precio_inscripcion NUMERIC(10,2);
    precio_cuota NUMERIC(10,2);
    fecha_base DATE;
    fecha_vencimiento_cuota DATE;
    i INTEGER;
BEGIN
    SELECT 
        COALESCE(CAST(NULLIF(REGEXP_REPLACE(p.duracion, '[^0-9]', '', 'g'), '') AS INTEGER), 1),
        COALESCE(p.precio, 0),
        COALESCE(p.precio_inscripcion, 50000)
    INTO duracion_meses, precio_programa, precio_inscripcion
    FROM cursos c
    LEFT JOIN programas p ON c.programa_id = p.id
    WHERE c.id = NEW.curso_id;

    IF duracion_meses IS NULL OR duracion_meses = 0 THEN
        duracion_meses := 1;
    END IF;

    IF precio_programa > 0 AND duracion_meses > 0 THEN
        precio_cuota := precio_programa / duracion_meses;
    ELSE
        precio_cuota := 0;
    END IF;

    SELECT COALESCE(fecha_inicio, CURRENT_DATE)
    INTO fecha_base
    FROM cursos
    WHERE id = NEW.curso_id;

    INSERT INTO pagos (
        estudiante_id,
        matricula_id,
        monto,
        periodo_pagado,
        numero_cuota,
        fecha_vencimiento,
        fecha_pago,
        estado,
        metodo_pago,
        observaciones
    ) VALUES (
        NEW.estudiante_id,
        NEW.id,
        precio_inscripcion,
        'Inscripción',
        0,
        fecha_base,
        NULL,
        'pendiente',
        NULL,
        'Matrícula académica registrada. Pendiente pago de inscripción para completar matrícula financiera.'
    );

    FOR i IN 1..duracion_meses LOOP
        fecha_vencimiento_cuota := fecha_base + (INTERVAL '1 month' * (i - 1));

        INSERT INTO pagos (
            estudiante_id,
            matricula_id,
            monto,
            periodo_pagado,
            numero_cuota,
            fecha_vencimiento,
            estado,
            metodo_pago,
            observaciones
        ) VALUES (
            NEW.estudiante_id,
            NEW.id,
            precio_cuota,
            'Mes ' || i,
            i,
            fecha_vencimiento_cuota,
            'pendiente',
            NULL,
            'Cuota mensual generada automáticamente'
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear trigger
DROP TRIGGER IF EXISTS trigger_generar_cuotas ON matriculas;
CREATE TRIGGER trigger_generar_cuotas
    AFTER INSERT ON matriculas
    FOR EACH ROW
    EXECUTE FUNCTION generar_cuotas_automaticas();
```

Click en **▶ Run** para ejecutar.

#### 4️⃣ Verificar que la función existe
Copiar y pegar:
```sql
SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'generar_cuotas_automaticas'
) as funcion_existe;
```

Debe devolver `true` ✅

#### 5️⃣ Verificar que el trigger existe
```sql
SELECT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_generar_cuotas'
) as trigger_existe;
```

Debe devolver `true` ✅

---

## 🧪 PRUEBA DEL SISTEMA

### 1. Crear una matrícula nueva
- Ir a **Módulo Matriculas**
- Click en **"Nueva Matrícula"** o similar
- Seleccionar:
  - Estudiante (buscar o crear)
  - Programa/Curso (con precio definido)
- Guardar

### 2. Verificar que se crearon pagos automáticamente
En **SQL Editor**, ejecutar:
```sql
SELECT 
    p.numero_cuota,
    p.periodo_pagado,
    p.monto,
    p.estado,
    p.fecha_vencimiento
FROM pagos p
WHERE p.matricula_id = (
    SELECT id FROM matriculas 
    ORDER BY created_at DESC LIMIT 1
)
ORDER BY p.numero_cuota;
```

Deberías ver:
- 1 pago con `numero_cuota = 0` (inscripción)
- N pagos con `numero_cuota = 1, 2, 3...` (cuotas mensuales)

### 3. Verificar que aparece en Tesorería
- Ir a **Tesorería**
- Deberían aparecer los pagos (estado = 'pagado' o 'pendiente' según el filtro)

### 4. Verificar que aparece en Perfil del Estudiante
- Ir a **Estudiantes**
- Buscar el estudiante
- Click en el estudiante para abrir su perfil
- Ver sección **"Área Financiera"** o **"Pagos"**
- Deberían aparecer los pagos creados

---

## 📊 TABLA DE REFERENCIA - Estados de Pago

| Estado | Significado | Acción |
|--------|-------------|--------|
| `pendiente` | Pagable | Se puede registrar el pago |
| `pagado` | ✅ Completado | Se pagó con éxito |
| `vencido` | ⏰ Atrasado | Se pasó la fecha de vencimiento |
| `cancelado` | ❌ Nulo | No aplica o se canceló |

---

## 🔍 DONDE SE REGISTRAN PAGOS

### Para estudiante que acaba de matricularse
1. **Perfil del Estudiante** → Área financiera → "Registrar Pago"
2. **Módulo Tesorería** → "Registrar Pago"
3. **Matrícula** → Formulario de inscripción

### Filtros en Tesorería
Actualmente filtra por `estado = 'pagado'`, entonces:
- ✅ Muestra: Pagos completados
- ❌ Oculta: Pagos pendientes, vencidos, cancelados

---

## 💡 TROUBLESHOOTING

### Problema: "Aún no aparecen pagos"
1. Verifica que se ejecutó la migración ✓
2. Verifica que existe la función ✓
3. Verifica que existe el trigger ✓
4. **Crea una nueva matrícula** (no edites las antiguas)
5. Espera 2-3 segundos
6. Recarga la página

### Problema: "Error al crear matrícula"
Si ves un error del trigger, probablemente falta:
- Tabla `programas`
- Columna `duracion` en `programas`
- Columna `precio_inscripcion` en `programas`

Verifica que existan todas las tablas requeridas en Supabase.

---

## 📋 CHECKLIST FINAL

- [ ] Ejecuté la migración `migration-fix-pagos-columnas-2026-01-12.sql`
- [ ] Ejecuté la función y trigger en SQL Editor
- [ ] Verifiqué que la función existe con SELECT
- [ ] Verifiqué que el trigger existe con SELECT
- [ ] Creé una nueva matrícula de prueba
- [ ] Verifiqué que aparecen pagos en la base de datos
- [ ] Verifiqué que aparecen en Tesorería
- [ ] Verifiqué que aparecen en el perfil del estudiante

---

## 📞 Si aún no funciona
1. Abre SQL Editor
2. Ejecuta: `SELECT * FROM pagos LIMIT 10;`
3. ¿Hay registros con `numero_cuota` y `periodo_pagado` completos?
   - ✅ SÍ → El trigger funciona, revisar filtros en frontend
   - ❌ NO → El trigger no ejecutó, revisar error en `CREATE FUNCTION`

Comparte el output de SQL en el chat.
