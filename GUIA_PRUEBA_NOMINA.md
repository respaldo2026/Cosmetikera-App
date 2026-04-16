# 🧪 GUÍA DE PRUEBA DEL FLUJO DE NÓMINA

## Objetivo
Verificar que el ciclo quincenal funciona correctamente con registro diario detallado.

---

## 📋 PASOS DE PRUEBA

### FASE 1: PREPARACIÓN (Día 1-14)

#### Paso 1: Crear profesor con valor hora
```
URL: /perfiles
Crear profesor:
- Nombre: "Juan Pérez"
- Email: juan@academy.com
- Rol: profesor
- Valor Hora: 20000
```

#### Paso 2: Crear curso
```
URL: /cursos
Crear curso:
- Nombre: "Manicure Avanzado"
- Profesor: Juan Pérez
- Estado: activo
```

#### Paso 3: Matricular estudiantes
```
URL: /matriculas → Crear Nueva
- Curso: Manicure Avanzado
- Estudiante 1: Ana García
- Estado: activo
```

#### Paso 4: Registrar clases (Día 1-5)
```
Ir a: Mi Oficina
- Seleccionar curso: "Manicure Avanzado"
- Llamar lista 5 veces:
  * 01-01: 2 horas (Tema: "Introducción")
  * 02-01: 3 horas (Tema: "Bases")
  * 03-01: 2 horas (Tema: "Técnica")
  * 04-01: 1 hora (Tema: "Repaso")
  * 05-01: 2 horas (Tema: "Evaluación")

Resultado esperado:
- Horas Pendientes: 10 horas
- En Nómina (tabla clases): 5 registros con estado PENDIENTE
```

#### Paso 5: Registrar más clases (Día 6-14)
```
Repetir 5-6 registros más de clases
Total esperado día 14: 15 horas pendientes
```

---

### FASE 2: PAGO PRIMERA QUINCENA (Día 15)

#### Paso 6: Visualizar en Nómina
```
URL: /nomina
Rango de fechas: 01-01 a 15-01

TABLA 1 - Profesores:
- Juan Pérez | $20,000 | 15 hrs | $300,000 | Botón "Pagar"

TABLA 2 - Registro Diario Detallado:
- 01-01 Juan Pérez Manicure 2h ⏤ Intro ⏤ PENDIENTE ⏤ $40,000
- 02-01 Juan Pérez Manicure 3h ⏤ Bases ⏤ PENDIENTE ⏤ $60,000
- 03-01 Juan Pérez Manicure 2h ⏤ Técnica ⏤ PENDIENTE ⏤ $40,000
... (más registros)
- Totales: 15 horas, $300,000, solo PENDIENTE
```

#### Paso 7: Procesar pago
```
En Nómina:
1. Clickear "Pagar" del profesor Juan Pérez
2. Confirmar en modal
3. Resultado esperado:
   ✅ Mensaje: "Primera quincena pagada correctamente"
   ✅ Historial pagos_nomina creado con:
      - Período: 01-01 a 15-01
      - Total: 15 horas × $20,000 = $300,000
```

#### Paso 8: Verificar registro en Tesorería
```
URL: /tesoreria
Ver tabla pagos_nomina:
- Juan Pérez | 15-01 | $300,000 | 15 hrs | "Primera quincena enero..."
```

#### Paso 9: Verificar Mi Oficina después de pago
```
URL: /mi-oficina
Horas Pendientes: 0 horas (limpias)

Historial de Pagos:
- 15-01 | $300,000 | 15 hrs | 01-01 a 15-01
```

#### Paso 10: Verificar tabla detallada
```
URL: /nomina
Seleccionar mismo rango: 01-01 a 15-01

TABLA 2 - Registro Diario Detallado:
- Ahora TODAS las filas muestran estado: ✓ PAGADO
- Botón de acción: desactivado con "✓ Pagado"
- Rows permanecen (no se borran)
```

---

### FASE 3: SEGUNDA QUINCENA (Día 16-30)

#### Paso 11: Registrar nuevas clases (Día 16-25)
```
Ir a: Mi Oficina → Mismo curso

5-6 clases nuevas:
- 16-01: 2 horas
- 18-01: 1 hora
- 20-01: 3 horas
- 22-01: 2 horas
- 24-01: 1 hora

Total: 9 horas nuevas
```

#### Paso 12: Verificar en Nómina (antes de pagar)
```
URL: /nomina
Rango: 16-01 a 31-01

TABLA 1 - Profesores:
- Juan Pérez | $20,000 | 9 hrs | $180,000 | Botón "Pagar"

TABLA 2 - Registro Diario Detallado:
- 16-01: 2h PENDIENTE
- 18-01: 1h PENDIENTE
- 20-01: 3h PENDIENTE
- 22-01: 2h PENDIENTE
- 24-01: 1h PENDIENTE
Total: solo 9 horas PENDIENTE
(No muestra las del 1-15 que ya están pagadas si filtramos)
```

#### Paso 13: Pagar segunda quincena
```
En Nómina (rango 16-31):
1. Clickear "Pagar" de Juan Pérez
2. Confirmar pago
3. Resultado:
   ✅ Nueva fila en pagos_nomina:
      - 31-01 | $180,000 | 9 hrs | 16-01 a 31-01
   ✅ sesiones_clase del 16-31: estado_pago='pagado'
   ✅ horasPendientesMap: limpio a cero
```

#### Paso 14: Verificar historial completo
```
URL: /mi-oficina → Historial de Pagos

Debe mostrar ambos pagos:
┌──────────┬────────────┬─────────┬─────────────────┐
│Fecha Pago│Total Pagado│Total Hrs│ Período         │
├──────────┼────────────┼─────────┼─────────────────┤
│ 31-01    │ $180,000   │ 9 hrs   │ 16-01 a 31-01   │
│ 15-01    │ $300,000   │ 15 hrs  │ 01-01 a 15-01   │
├──────────┼────────────┼─────────┼─────────────────┤
│ TOTAL    │ $480,000   │ 24 hrs  │ Enero 2025      │
└──────────┴────────────┴─────────┴─────────────────┘
```

---

## ✅ VALIDACIONES

### Tabla sesiones_clase
```
SELECT * FROM sesiones_clase WHERE profesor_id = 'juan_id'
ORDER BY fecha;

Resultado esperado:
- 24 filas (15 del 1-15 + 9 del 16-30)
- Todas con estado_pago = 'pagado'
- Fechas ordenadas
- Temas diferentes
- Horas correctas
```

### Tabla pagos_nomina
```
SELECT * FROM pagos_nomina WHERE profesor_id = 'juan_id'
ORDER BY fecha_pago DESC;

Resultado esperado:
- 2 filas
- Primera: 31-01, 9 horas, $180,000, período 16-01 a 31-01
- Segunda: 15-01, 15 horas, $300,000, período 01-01 a 15-01
- Observaciones: contienen "Primera/Segunda quincena"
```

---

## 🐛 POSIBLES PROBLEMAS Y SOLUCIONES

### Problema 1: Horas no aparecen en Nómina después de registrar
**Solución**:
1. Verificar que sesiones_clase tiene registros
2. Refrescar página (F5)
3. Verificar rango de fechas seleccionado

### Problema 2: Botón "Pagar" deshabilitado
**Solución**:
1. Verificar que profesor tiene valor_hora definido
2. Verificar que hay sesiones PENDIENTE en el rango
3. Verificar que total_horas > 0

### Problema 3: Las horas no se limpian después del pago
**Solución**:
1. Verificar que estado_pago cambió a 'pagado'
2. Refrescar página de Mi Oficina
3. Revisar horasPendientesMap en consola (F12)

### Problema 4: Se ven filas duplicadas en tabla diaria
**Solución**:
1. Verificar que no hay registros duplicados en sesiones_clase
2. Usar DISTINCT en query si es necesario
3. Revisar KEY de table (debe ser único)

### Problema 5: Pago visible en Nómina pero no en Tesorería
**Solución**:
1. Verificar que pagos_nomina tiene registros
2. Tesorería debe incluir filtro correcto
3. Refrescar página /tesoreria

---

## 📊 DATOS DE PRUEBA RECOMENDADOS

```javascript
// Profesor
{
  nombre_completo: "Juan Pérez",
  email: "juan@academy.com",
  rol: "profesor",
  valor_hora: 20000  // $20,000 por hora
}

// Curso
{
  nombre: "Manicure Avanzado",
  profesor_id: "<juan_id>",
  estado: "activo"
}

// Estudiante
{
  nombre_completo: "Ana García López",
  email: "ana@student.com",
  rol: "estudiante"
}

// Clases del 1-15 (total 15 horas)
[
  { fecha: "2025-01-01", horas: 2, tema: "Introducción" },
  { fecha: "2025-01-02", horas: 3, tema: "Bases" },
  { fecha: "2025-01-03", horas: 2, tema: "Técnica" },
  { fecha: "2025-01-04", horas: 1, tema: "Repaso" },
  { fecha: "2025-01-05", horas: 2, tema: "Evaluación" },
  { fecha: "2025-01-08", horas: 2, tema: "Avanzado" },
  { fecha: "2025-01-10", horas: 2, tema: "Casos" },
  { fecha: "2025-01-12", horas: 1, tema: "Revisión" }
]

// Clases del 16-30 (total 9 horas)
[
  { fecha: "2025-01-16", horas: 2, tema: "Nuevos Temas" },
  { fecha: "2025-01-18", horas: 1, tema: "Ejercicios" },
  { fecha: "2025-01-20", horas: 3, tema: "Intensivo" },
  { fecha: "2025-01-22", horas: 2, tema: "Práctico" },
  { fecha: "2025-01-24", horas: 1, tema: "Final" }
]
```

---

## 🎯 CRITERIOS DE ÉXITO

- ✅ Ciclos se separan correctamente (1-15 vs 16-30)
- ✅ Registro diario visible en Nómina
- ✅ Estado (PENDIENTE/PAGADO) se actualiza
- ✅ Horas se limpian en Mi Oficina después de pagar
- ✅ Historial permanece en BD
- ✅ Pagos se registran en pagos_nomina con período completo
- ✅ Reset selectivo (solo ciclo pagado)
- ✅ Botones se deshabilitan después de pagar
- ✅ Observaciones detalladas en pagos_nomina
