# 💳 Sistema de Cuotas Automáticas - Documentación

## 🎯 Descripción

Sistema que genera automáticamente las cuotas de pago cuando se matricula un estudiante, basado en la duración del programa y con fechas de vencimiento inteligentes.

---

## ✨ Características Principales

### 1. Generación Automática
- ✅ Al matricular un estudiante, se crean automáticamente todas las cuotas
- ✅ **Inscripción** (cuota 0): Se marca como PAGADA automáticamente
- ✅ **Cuotas mensuales**: Basado en la duración del programa (ej: 6 meses = 6 cuotas)
- ✅ Precio del programa dividido equitativamente (SIN incluir inscripción)
- ✅ Inscripción es un valor APARTE del precio del programa

### 2. Fechas de Vencimiento Inteligentes
- ✅ Vencimiento: **Primeros 5 días de cada mes**
- ✅ Basado en la fecha de inicio del curso
- ✅ Cálculo automático mes a mes

### 3. Estados Visuales
- 🟢 **Pagado**: Cuota pagada completamente
- 🔴 **Vencido**: Pasó la fecha de vencimiento sin pagar
- 🟡 **Por vencer**: Faltan 7 días o menos
- 🔵 **Pendiente**: Aún no vence

### 4. Interfaz Mejorada
- Botones visuales por cada cuota
- Tooltip con información detallada
- Click para redirigir a tesorería
- Colores según estado

---

## 🗄️ Estructura de Base de Datos

### Tabla `pagos` (actualizada)

```sql
CREATE TABLE pagos (
    id UUID PRIMARY KEY,
    estudiante_id UUID,              -- FK a perfiles
    matricula_id INTEGER,            -- FK a matriculas
    monto NUMERIC(10,2),             -- Monto de la cuota
    metodo_pago TEXT,                -- efectivo|transferencia|tarjeta|inscripcion
    fecha_pago TIMESTAMP,            -- Fecha en que se pagó
    fecha_vencimiento DATE,          -- ⭐ NUEVO: Fecha máxima de pago
    numero_cuota INTEGER,            -- ⭐ NUEVO: 0 (inscripción), 1, 2, 3, 4...
    periodo_pagado TEXT,             -- ⭐ NUEVO: "Inscripción", "Mes 1", "Mes 2", etc.
    estado TEXT,                     -- ⭐ NUEVO: pendiente|pagado|vencido|cancelado
    referencia TEXT,
    observaciones TEXT
);

-- Tabla programas (actualizada)
ALTER TABLE programas
ADD COLUMN precio_inscripcion NUMERIC(10,2) DEFAULT 50000; -- ⭐ NUEVO
```

### Índices Creados
```sql
CREATE INDEX idx_pagos_estado ON pagos(estado);
CREATE INDEX idx_pagos_vencimiento ON pagos(fecha_vencimiento);
CREATE INDEX idx_pagos_matricula_estado ON pagos(matricula_id, estado);
```

---

## ⚙️ Cómo Funciona

### 1. Al Matricular un Estudiante

```
Usuario: Crear matrícula para Juan en "Inglés Básico"
   ↓
Sistema: Busca duración del programa → 4 meses
   ↓
Sistema: Busca precio del programa → $200,000
   ↓
Sistema: Busca precio de inscripción → $50,000
   ↓
Sistema: Calcula precio por cuota → $50,000 ($200,000 / 4)
   ↓
Trigger SQL: Genera 5 cuotas automáticamente
   ↓
Cuota 0: "Inscripción" - $50,000 - PAGADA ✅
Cuota 1: "Mes 1" - $50,000 - Vence 05/Ene
Cuota 2: "Mes 2" - $50,000 - Vence 05/Feb
Cuota 3: "Mes 3" - $50,000 - Vence 05/Mar
Cuota 4: "Mes 4" - $50,000 - Vence 05/Abr

TOTAL: $250,000 (inscripción + programa)
```

### 2. Cálculo de Fechas de Vencimiento

```typescript
// Fecha base = Fecha de inicio del curso (o hoy si no tiene)
fecha_base = curso.fecha_inicio || CURRENT_DATE

// Para cada mes:
fecha_vencimiento = 5 de [mes + i]

// Ejemplo si curso inicia 15/Enero:
Cuota 1: 05/Enero (mismo mes)
Cuota 2: 05/Febrero
Cuota 3: 05/Marzo
Cuota 4: 05/Abril
```

### 3. Actualización de Estados

El sistema actualiza automáticamente los estados:

- **Pendiente → Vencido**: Si pasa la fecha de vencimiento
- **Pendiente/Vencido → Pagado**: Al registrar el pago

---

## 💻 Uso en el Frontend

### Vista del Estudiante

En la ficha del estudiante (`/estudiantes/show/[id]`), verás:

```
┌─────────────────────────────────────────┐
│ Cuotas de Pago                           │
├─────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │Inscripción│ │  Mes 1  │ │  Mes 2  │ │
│ │  PAGADA  │ │Por vencer│ │Pendiente│ │
│ │  $50,000 │ │  05/02  │ │  05/03  │ │
│ └──────────┘ └──────────┘ └──────────┘ │
└─────────────────────────────────────────┘
```

**Colores:**
- Verde: Pagado ✅
- Amarillo: Por vencer (≤7 días) ⚠️
- Rojo: Vencido ❌
- Azul: Pendiente 🔵

**Al hacer click en una cuota pendiente:**
- Modal con información de la cuota
- Botón para redirigir a tesorería
- Datos pre-cargados (estudiante, monto, periodo)

---

## 🔧 Funciones SQL Disponibles

### 1. Generar Cuotas Automáticas (Trigger)
```sql
-- Se ejecuta automáticamente al insertar matrícula
CREATE TRIGGER trigger_generar_cuotas
    AFTER INSERT ON matriculas
    EXECUTE FUNCTION generar_cuotas_automaticas();
```

### 2. Actualizar Cuotas Vencidas
```sql
-- Ejecutar periódicamente (cron job)
SELECT actualizar_cuotas_vencidas();
```

### 3. Marcar Cuota como Pagada
```sql
SELECT marcar_cuota_pagada(
    'uuid-del-pago'::UUID,
    50000,           -- monto pagado
    'efectivo',      -- método
    'REF-12345'      -- referencia
);
```

### 4. Vista de Estado de Cuotas
```sql
-- Ver todas las cuotas con su estado visual
SELECT * FROM vista_estado_cuotas
WHERE estudiante_id = 'uuid-del-estudiante'
ORDER BY numero_cuota;
```

---

## 📋 Pasos para Implementar

### 1. Ejecutar Migración SQL ✅
```bash
# En Supabase SQL Editor
1. Abrir archivo: migrations-cuotas-automaticas.sql
2. Ejecutar completo
3. Verificar que no haya errores
```

### 2. Verificar Funcionamiento ✅
```bash
# Crear una matrícula nueva
1. Ir a /matriculas/create
2. Seleccionar estudiante y curso
3. Guardar matrícula
4. Verificar en /estudiantes/show/[id]
   → Deben aparecer las cuotas automáticamente
```

### 3. Configurar Cron Job (Opcional) ⚙️
```sql
-- Para actualizar estados automáticamente cada día
-- Configurar en Supabase Dashboard > Database > Cron Jobs

SELECT cron.schedule(
    'actualizar-cuotas-vencidas',
    '0 0 * * *', -- Cada día a medianoche
    $$ SELECT actualizar_cuotas_vencidas(); $$
);
```

---

## 🧪 Casos de Uso

### Caso 1: Programa de 4 Meses

**Datos:**
- Programa: Inglés Básico
- Duración: 4 meses
- Precio programa: $200,000
- Precio inscripción: $50,000
- Fecha inicio: 15 de Enero

**Resultado:**
| Cuota | Periodo | Monto | Vencimiento | Estado |
|-------|---------|-------|-------------|--------|
| 0 | Inscripción | $50,000 | 15/Ene | ✅ PAGADA |
| 1 | Mes 1 | $50,000 | 05/Ene | Pendiente |
| 2 | Mes 2 | $50,000 | 05/Feb | Pendiente |
| 3 | Mes 3 | $50,000 | 05/Mar | Pendiente |
| 4 | Mes 4 | $50,000 | 05/Abr | Pendiente |

**TOTAL: $250,000** (inscripción + programa)

### Caso 2: Programa Intensivo (1 mes)

**Datos:**
- Programa: Excel Avanzado
- Duración: 1 mes
- Precio programa: $80,000
- Precio inscripción: $50,000
- Fecha inicio: 20 de Febrero

**Resultado:**
| Cuota | Periodo | Monto | Vencimiento | Estado |
|-------|---------|-------|-------------|--------|
| 0 | Inscripción | $50,000 | 20/Feb | ✅ PAGADA |
| 1 | Mes 1 | $80,000 | 05/Feb | Pendiente |

**TOTAL: $130,000** (inscripción + programa)

### Caso 3: Programa Largo (12 meses)

**Datos:**
- Programa: Desarrollo Web Full Stack
- Duración: 12 meses
- Precio programa: $1,200,000
- Precio inscripción: $50,000
- Fecha inicio: 01 de Marzo

**Resultado:**
- **1 Inscripción**: $50,000 (PAGADA)
- **12 cuotas mensuales**: $100,000 cada una
- Vencimientos: 05/Mar, 05/Abr, 05/May... hasta 05/Feb (año siguiente)

**TOTAL: $1,250,000** (inscripción + programa)

---

## 🎨 Personalización

### Cambiar Día de Vencimiento

Por defecto es el **día 5** de cada mes. Para cambiarlo:

```sql
-- En la función generar_cuotas_automaticas()
-- Línea actual:
fecha_vencimiento_cuota := DATE_TRUNC('month', fecha_base + INTERVAL '1 month' * (i - 1)) + INTERVAL '4 days';

-- Cambiar a día 10:
fecha_vencimiento_cuota := DATE_TRUNC('month', fecha_base + INTERVAL '1 month' * (i - 1)) + INTERVAL '9 days';
```

### Cambiar Lógica de "Por Vencer"

Por defecto alerta **7 días antes**. Para cambiarlo:

```typescript
// En src/app/estudiantes/show/[id]/page.tsx
// Línea actual:
const isPorVencer = cuota.fecha_vencimiento && dayjs(cuota.fecha_vencimiento).diff(dayjs(), 'day') <= 7

// Cambiar a 3 días:
const isPorVencer = cuota.fecha_vencimiento && dayjs(cuota.fecha_vencimiento).diff(dayjs(), 'day') <= 3
```

---

## 🚨 Solución de Problemas

### Problema: No se generan cuotas al matricular

**Solución:**
```sql
-- Verificar que el trigger esté activo
SELECT * FROM pg_trigger WHERE tgname = 'trigger_generar_cuotas';

-- Si no existe, ejecutar de nuevo:
CREATE TRIGGER trigger_generar_cuotas
    AFTER INSERT ON matriculas
    EXECUTE FUNCTION generar_cuotas_automaticas();
```

### Problema: Todas las cuotas aparecen como "Vencidas"

**Solución:**
```sql
-- Ejecutar función de actualización
SELECT actualizar_cuotas_vencidas();

-- Verificar fechas de vencimiento
SELECT id, periodo_pagado, fecha_vencimiento, estado
FROM pagos
WHERE estudiante_id = 'uuid'
ORDER BY numero_cuota;
```

### Problema: Monto de cuota es $0

**Solución:**
- Verificar que el programa tenga precio definido
- Si no tiene, actualizar el monto manualmente:

```sql
UPDATE pagos
SET monto = 50000  -- Monto deseado
WHERE matricula_id = XXX AND estado = 'pendiente';
```

---

## 📊 Reportes Útiles

### Ver Cuotas Vencidas
```sql
SELECT 
    perf.nombre_completo,
    c.nombre AS curso,
    p.periodo_pagado,
    p.monto,
    p.fecha_vencimiento,
    CURRENT_DATE - p.fecha_vencimiento AS dias_vencido
FROM pagos p
JOIN perfiles perf ON p.estudiante_id = perf.id
JOIN matriculas m ON p.matricula_id = m.id
JOIN cursos c ON m.curso_id = c.id
WHERE p.estado = 'vencido'
ORDER BY p.fecha_vencimiento;
```

### Ver Cuotas Por Vencer (próximos 7 días)
```sql
SELECT 
    perf.nombre_completo,
    c.nombre AS curso,
    p.periodo_pagado,
    p.monto,
    p.fecha_vencimiento
FROM pagos p
JOIN perfiles perf ON p.estudiante_id = perf.id
JOIN matriculas m ON p.matricula_id = m.id
JOIN cursos c ON m.curso_id = c.id
WHERE p.estado = 'pendiente'
  AND p.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
ORDER BY p.fecha_vencimiento;
```

### Total Pendiente por Estudiante
```sql
SELECT 
    perf.nombre_completo,
    COUNT(*) AS cuotas_pendientes,
    SUM(p.monto) AS total_pendiente
FROM pagos p
JOIN perfiles perf ON p.estudiante_id = perf.id
WHERE p.estado IN ('pendiente', 'vencido')
GROUP BY perf.id, perf.nombre_completo
ORDER BY total_pendiente DESC;
```

---

## 📚 Referencias

### Archivos Relacionados
- `migrations-cuotas-automaticas.sql` → Migración de base de datos
- `src/app/estudiantes/show/[id]/page.tsx` → Vista de cuotas
- `src/app/matriculas/create/page.tsx` → Creación de matrículas
- `schema.sql` → Esquema de base de datos

### Tablas Relacionadas
- `pagos` → Cuotas y pagos
- `matriculas` → Inscripciones
- `cursos` → Grupos
- `programas` → Catálogo de cursos
- `perfiles` → Estudiantes

---

## ✅ Checklist de Implementación

- [ ] Ejecutar `migrations-cuotas-automaticas.sql` en Supabase
- [ ] Verificar que la función `generar_cuotas_automaticas()` existe
- [ ] Verificar que el trigger `trigger_generar_cuotas` está activo
- [ ] Crear una matrícula de prueba
- [ ] Verificar que las cuotas se generaron automáticamente
- [ ] Verificar fechas de vencimiento correctas
- [ ] Verificar colores y estados en la interfaz
- [ ] Probar click en cuota pendiente → redirige a tesorería
- [ ] Probar marcar cuota como pagada
- [ ] Verificar que el estado cambia a "Pagado"
- [ ] Configurar cron job para actualizar estados (opcional)

---

## 🎉 Beneficios del Sistema

✅ **Automatización**: No más generación manual de cuotas  
✅ **Claridad**: Estudiantes ven exactamente qué deben y cuándo  
✅ **Organización**: Todas las cuotas en un solo lugar  
✅ **Alertas visuales**: Fácil identificar cuotas vencidas  
✅ **Facilita cobro**: Click para registrar pago con datos pre-cargados  
✅ **Reportes**: Fácil extraer estadísticas de pagos  
✅ **Escalable**: Funciona para cualquier cantidad de estudiantes  

---

**Desarrollado para Academia Crystal Diamante** 💎✨
