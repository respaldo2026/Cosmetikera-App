# ✅ FLUJO DE NÓMINA MEJORADO - CICLOS QUINCENALES

## Ahora implementado correctamente:

### 📊 **VISTA EN NÓMINA (Tesorería)**
**Archivo**: `src/app/nomina/page.tsx`

#### SECCIÓN 1: Tabla de Profesores (Vista General)
- Profesor | Valor Hora | Horas Trabajadas | A Pagar | Acción
- Agrupa TODAS las horas pendientes del período seleccionado
- Botón "Pagar" para cada profesor

#### SECCIÓN 2: Tabla de Clases Diarias (Vista Detallada)
**NUEVO**: Ahora muestra registro DIARIO completo
- Fecha | Profesor | Curso | Tema | Horas
- Cada fila = UNA clase trabajada
- PERMANECE en el registro incluso después de pagar
- Este es el historial detallado

---

### 🏫 **VISTA EN MI OFICINA (Profesor)**
**Archivo**: `src/app/mi-oficina/page.tsx`

#### Dashboard del Profesor
- **Cursos Activos**: lista cursos
- **Horas Pendientes por Curso**: `horasPendientesMap`
  - Curso A: 6 horas
  - Curso B: 4 horas
  - Curso C: 3 horas
  
#### Historial de Pagos (Vista General)
- Fecha Pago | Total Pagado | Total Horas | Período
- Muestra resumen de cada quincena pagada
- NO muestra detalle clase por clase

---

## 🔄 **CICLO QUINCENAL IMPLEMENTADO**

### **PRIMERA QUINCENA (1-15)**
```
Día 1-14:
  ├─ Profesor registra clases diariamente
  ├─ Cada clase → sesiones_clase (estado_pago='pendiente')
  ├─ Horas se acumulan en horasPendientesMap
  └─ Se ven en Nómina (tabla clases pendientes)

Día 15:
  ├─ Admin: selecciona rango MANUAL 1-15 o llama generarPagoQuincenal('primera')
  ├─ Sistema filtra SOLO sesiones del 1-15
  ├─ Crea registro en pagos_nomina con:
  │  ├─ fecha_pago: 15
  │  ├─ fecha_inicio_periodo: 1
  │  ├─ fecha_fin_periodo: 15
  │  ├─ total_horas: suma de horas del 1-15
  │  ├─ total_pagado: horas × valor_hora
  │  └─ observaciones: "Primera quincena enero 2025 - 13 horas × $20,000 = $260,000"
  │
  ├─ Marca sesiones como estado_pago='pagado' (1-15 solamente)
  ├─ Vacía horasPendientesMap del profesor
  └─ ✅ Historial permanece en pagos_nomina + sesiones_clase
```

### **SEGUNDA QUINCENA (16-30/31)**
```
Día 16-29:
  ├─ Profesor registra nuevas clases
  ├─ Nuevas sesiones_clase con estado_pago='pendiente'
  ├─ horasPendientesMap se rellena nuevamente
  └─ Se ven en Nómina (tabla clases pendientes)

Día 30/31:
  ├─ Admin: selecciona rango MANUAL 16-30 o llama generarPagoQuincenal('segunda')
  ├─ Sistema filtra SOLO sesiones del 16-30/31
  ├─ Crea nuevo registro en pagos_nomina con:
  │  ├─ fecha_pago: 30/31
  │  ├─ fecha_inicio_periodo: 16
  │  ├─ fecha_fin_periodo: 30/31
  │  ├─ total_horas: suma de horas del 16-30/31
  │  ├─ total_pagado: horas × valor_hora
  │  └─ observaciones: "Segunda quincena enero 2025 - 10 horas × $20,000 = $200,000"
  │
  ├─ Marca sesiones como estado_pago='pagado' (16-30/31 solamente)
  ├─ Vacía horasPendientesMap del profesor
  └─ ✅ Historial completo permanece
```

---

## 📋 **REGISTROS EN BASE DE DATOS**

### Tabla `sesiones_clase` (Registro Diario Detallado)
```
ID | Profesor | Curso | Fecha | Horas | Tema | Estado_Pago
1  | Prof1    | A     | 01-01 | 2     | Tema1 | pendiente (luego pagado)
2  | Prof1    | A     | 01-02 | 3     | Tema2 | pendiente (luego pagado)
3  | Prof1    | B     | 01-05 | 2     | Tema3 | pendiente (luego pagado)
... hasta el 15 ...
16 | Prof1    | A     | 01-16 | 2     | Tema4 | pendiente
17 | Prof1    | A     | 01-17 | 3     | Tema5 | pendiente
... hasta el 30/31 ...

NOTA: Todas las filas permanecen en la tabla
Cambio: estado_pago: pendiente → pagado
```

### Tabla `pagos_nomina` (Resumen Quincenales)
```
ID | Profesor | Fecha_Pago | Total_Horas | Total_Pagado | Periodo_Inicio | Periodo_Fin | Observaciones
1  | Prof1    | 15-01-2025 | 7           | 140,000      | 01-01-2025     | 15-01-2025  | "Primera quincena enero 2025 - 7 horas..."
2  | Prof1    | 31-01-2025 | 5           | 100,000      | 16-01-2025     | 31-01-2025  | "Segunda quincena enero 2025 - 5 horas..."

TOTAL AÑO Prof1: 12 horas, $240,000
```

---

## 🎯 **DIFERENCIAS CLAVE**

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| **Ciclos** | Paga TODO cuando se llama función | Ciclos separados 1-15 y 16-30 ✅ |
| **Filtro por fecha** | No hay filtro | Filtra por fecha_inicio y fecha_fin ✅ |
| **Registro diario** | No visible | Tabla detallada en Nómina ✅ |
| **Vista profesor** | Todo junto | Vista general en Mi Oficina ✅ |
| **Historial** | Se perdía en reset | Permanece en pagos_nomina ✅ |
| **Reset de horas** | Todas a cero | Solo las del ciclo pagado ✅ |

---

## 🚀 **CÓMO USAR**

### Admin/Tesorería - DÍA 15:
1. Ir a **Nómina**
2. Seleccionar rango: **01 - 15 del mes actual**
3. Ver tabla "Registro Diario Detallado" con todas las clases
4. Revisar tabla superior con totales por profesor
5. Hacer clic en **"Pagar"** para cada profesor
6. ✅ Registro queda en `pagos_nomina` + `sesiones_clase` (estado_pago='pagado')
7. ✅ Horas en Mi Oficina del profesor → a CERO

### Admin/Tesorería - DÍA 30/31:
1. Ir a **Nómina**
2. Seleccionar rango: **16 - 30/31 del mes actual**
3. Mismos pasos anteriores
4. ✅ Crea segundo registro de pago en `pagos_nomina`
5. ✅ Registra second ciclo en `sesiones_clase`

### Profesor - MI OFICINA:
1. Ve **Horas Pendientes** por curso (general)
2. Registra clases → horas se acumulan
3. Después del día 15: ✅ Horas → a CERO (pero registro permanece)
4. Del 16-30: Nuevas horas se acumulan
5. Ve historial en **"Pagos Nómina"** con fechas de cada quincena

---

## 📌 **IMPORTANTE**

✅ **Tabla `sesiones_clase`**: Historial PERMANENTE de cada clase trabajada
- Nunca se elimina
- Solo cambia estado_pago: pendiente → pagado

✅ **Tabla `pagos_nomina`**: Resumen de pagos quincenales
- Cada quincena = 1 fila
- Contiene período completo (inicio y fin)

✅ **Visualización**:
- **Nómina**: Registro DIARIO detallado (para auditoría y pagos)
- **Mi Oficina**: Vista GENERAL (para profesor, resumen)

✅ **Horas en oficina**: Se limpian SOLO las del ciclo pagado
- Día 15: limpia horas del 1-15
- Día 30: limpia horas del 16-30
- Las nuevas se van acumulando
