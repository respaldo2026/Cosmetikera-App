# 🔄 CAMBIOS: Inscripción Separada y Pagada Automáticamente

## ✅ Cambios Realizados

### 1. **Base de Datos**
- ✅ Agregado campo `precio_inscripcion` a tabla `programas` (valor por defecto: $50,000)
- ✅ Modificada función `generar_cuotas_automaticas()` para crear inscripción como cuota separada
- ✅ Inscripción se marca automáticamente como PAGADA al matricular

### 2. **Lógica de Generación de Cuotas**

**ANTES:**
```
Programa de 4 meses a $200,000
→ 4 cuotas de $50,000 cada una
→ Primera cuota llamada "Inscripción (Mes 1)"
→ Todas pendientes
```

**AHORA:**
```
Programa de 4 meses a $200,000 + Inscripción $50,000
→ Cuota 0: Inscripción $50,000 (PAGADA ✅)
→ Cuota 1-4: Mes 1-4 de $50,000 cada una (PENDIENTES)
→ TOTAL: $250,000
```

### 3. **Flujo al Matricular**

```
1. Usuario matricula estudiante
   ↓
2. Sistema lee:
   - Precio programa: $200,000
   - Duración: 4 meses
   - Precio inscripción: $50,000
   ↓
3. Trigger SQL genera:
   
   Cuota 0 (Inscripción):
   - Monto: $50,000
   - Estado: PAGADA ✅
   - Fecha pago: NOW()
   - Método: 'inscripcion'
   - Observación: "Inscripción pagada automáticamente"
   
   Cuota 1 (Mes 1):
   - Monto: $50,000 ($200,000 / 4)
   - Estado: PENDIENTE
   - Vence: 05/Febrero
   
   Cuota 2 (Mes 2):
   - Monto: $50,000
   - Estado: PENDIENTE
   - Vence: 05/Marzo
   
   ... y así sucesivamente
```

---

## 📋 Configuración del Valor de Inscripción

### Por Programa
```sql
-- Actualizar precio de inscripción de un programa específico
UPDATE programas
SET precio_inscripcion = 100000  -- $100,000
WHERE nombre = 'Inglés Avanzado';
```

### Global (todos los programas nuevos)
```sql
-- Cambiar valor por defecto
ALTER TABLE programas
ALTER COLUMN precio_inscripcion SET DEFAULT 80000;
```

---

## 🎨 Visualización en la Interfaz

En la ficha del estudiante verás:

```
┌─────────────────────────────────────────────────┐
│ CUOTAS DE PAGO                                   │
├─────────────────────────────────────────────────┤
│                                                  │
│  [Inscripción]   [Mes 1]   [Mes 2]   [Mes 3]   │
│    PAGADA ✅    Pendiente  Pendiente  Pendiente │
│   $50,000       $50,000    $50,000   $50,000    │
│                 05/Feb     05/Mar    05/Abr     │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Colores:**
- 🟢 **Verde** (Inscripción): Ya pagada
- 🔵 **Azul** (Mes 1-4): Pendientes
- 🟡 **Amarillo**: Por vencer (≤7 días)
- 🔴 **Rojo**: Vencidas

---

## 💡 Beneficios

✅ **Claridad contable**: Inscripción separada del costo del programa
✅ **Automatización**: No hay que marcar inscripción como pagada manualmente
✅ **Flexibilidad**: Cada programa puede tener diferente precio de inscripción
✅ **Visibilidad**: Estudiante ve que su inscripción está pagada
✅ **Reportes**: Fácil separar ingresos por inscripciones vs cuotas mensuales

---

## 🔧 Pasos para Aplicar

### 1. Ejecutar Migración SQL
```bash
1. Abrir Supabase Dashboard
2. SQL Editor
3. Copiar contenido de: migrations-cuotas-automaticas.sql
4. Ejecutar (ya incluye el nuevo campo precio_inscripcion)
```

### 2. Verificar Funcionamiento
```bash
1. Crear una matrícula nueva
2. Ir a /estudiantes/show/[id]
3. Verificar que aparezcan:
   - Cuota 0: Inscripción (PAGADA ✅)
   - Cuota 1-N: Meses (PENDIENTES)
```

### 3. Ajustar Precios de Inscripción (Opcional)
```sql
-- Si quieres cambiar el precio de inscripción de algunos programas
UPDATE programas
SET precio_inscripcion = 80000
WHERE id IN (1, 2, 3);
```

---

## 📊 Ejemplo Completo

**Programa: Inglés Básico**
- Duración: 6 meses
- Precio programa: $300,000
- Precio inscripción: $50,000

**Al matricular a Juan Pérez:**

| # | Periodo | Monto | Estado | Vencimiento | Observación |
|---|---------|-------|--------|-------------|-------------|
| 0 | Inscripción | $50,000 | ✅ PAGADA | 15/Ene | Pagada automáticamente |
| 1 | Mes 1 | $50,000 | Pendiente | 05/Ene | - |
| 2 | Mes 2 | $50,000 | Pendiente | 05/Feb | - |
| 3 | Mes 3 | $50,000 | Pendiente | 05/Mar | - |
| 4 | Mes 4 | $50,000 | Pendiente | 05/Abr | - |
| 5 | Mes 5 | $50,000 | Pendiente | 05/May | - |
| 6 | Mes 6 | $50,000 | Pendiente | 05/Jun | - |

**Totales:**
- Inscripción: $50,000 ✅
- Pendiente: $300,000 (6 cuotas)
- **TOTAL: $350,000**

---

## 🚨 Importante

1. **Matrículas anteriores**: NO se verán afectadas. Solo las nuevas matrículas generarán inscripción separada.

2. **Si ya ejecutaste la migración anterior**: Ejecuta esta nueva versión que incluye el campo `precio_inscripcion`.

3. **Modificar inscripción existente**: Si necesitas cambiar una inscripción ya creada:
```sql
UPDATE pagos
SET monto = 80000
WHERE periodo_pagado = 'Inscripción' 
  AND estudiante_id = 'uuid-del-estudiante';
```

---

## 📚 Archivos Actualizados

- ✅ `migrations-cuotas-automaticas.sql` - Incluye precio_inscripcion y lógica actualizada
- ✅ `SISTEMA-CUOTAS-AUTOMATICAS.md` - Documentación completa actualizada
- ✅ `CAMBIOS-INSCRIPCION-SEPARADA.md` - Este documento (resumen de cambios)

---

**¡Sistema listo para usar!** 🎉

La inscripción ahora:
- ✅ Es un valor separado
- ✅ Se paga automáticamente al matricular
- ✅ Aparece como primera cuota (cuota 0)
- ✅ No se incluye en el cálculo de cuotas mensuales
