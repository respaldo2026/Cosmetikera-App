## ✅ VERIFICACIÓN DEL FLUJO DE NÓMINA Y PAGOS

### FLUJO COMPLETO SEGÚN ESPECIFICACIÓN:

#### **1️⃣ PROFESOR ENTRA A SU OFICINA (Mi Oficina)**
- Archivo: `src/app/mi-oficina/page.tsx`
- El profesor ve sus cursos activos y horas pendientes por curso
- **Estado**: ✅ IMPLEMENTADO
- Ver líneas: 180-220 (cargarDashboard)

---

#### **2️⃣ PROFESOR ABRE UN CURSO**
- Abre el drawer "Gestión de Clase" (abrirGestionClase)
- Carga lista de estudiantes del curso
- Líneas: 270-320
- **Estado**: ✅ IMPLEMENTADO

---

#### **3️⃣ PROFESOR LLAMA LISTA (Registra Asistencia)**
- **ARCHIVO**: `src/app/mi-oficina/page.tsx` líneas 360-440
- **PROCESO**:
  1. Selecciona tema del día (pensum)
  2. Marca presentes/ausentes en asistenciaMap
  3. Define hora inicio y hora fin de clase
  4. Sistema calcula automáticamente horas: `horaFinClase - horaInicioClase`
  5. Confirma y GUARDA

- **QUÉ SE REGISTRA**:
  - ✅ En tabla `asistencias`: estado presente/ausente por estudiante
  - ✅ En tabla `sesiones_clase`: 
    - horas_dictadas (calculadas del horario)
    - tema_visto
    - estado_pago: "pendiente" ← CLAVE
    - profesor_id + fecha + curso_id

- Función: `ejecutarGuardadoReal()` líneas 420-460
- **Estado**: ✅ IMPLEMENTADO

---

#### **4️⃣ HORAS REGISTRADAS EN NÓMINA Y SU OFICINA**
- **En nómina**: 
  - Tabla `sesiones_clase` con estado_pago='pendiente'
  - Visible en `src/app/nomina/page.tsx` línea 180-220
  - Se listan todas las clases pendientes del profesor
  
- **En su oficina**:
  - Mapa `horasPendientesMap` agrupa horas por curso
  - Se muestra en tarjetas del dashboard
  - Se actualiza con `refrescarHorasPendientes()`
  - Líneas: 70-85

- **Estado**: ✅ IMPLEMENTADO

---

#### **5️⃣ HORAS VAN ACUMULÁNDOSE (Día 1-15 Y 16-30)**
- Cada clase registrada suma horas a `sesiones_clase`
- Mientras estado_pago='pendiente', las horas se ven en:
  - `horasPendientesMap` (Mi Oficina)
  - `clasesPendientes` (Nómina)
- **Estado**: ✅ IMPLEMENTADO

---

#### **🔴 POSIBLE PROBLEMA - CICLOS QUINCENALES**
El sistema NO tiene lógica automática para:
- ❌ Distinguir "Primera quincena" (1-15) vs "Segunda quincena" (16-30)
- ❌ Consolidar automáticamente el día 15
- ❌ Limpiar `horasPendientesMap` después del pago

Actualmente usa: `const corteLabel = hoy.date() <= 15 ? "Primera quincena" : "Segunda quincena";`
Pero esto es SOLO una etiqueta en el comment, no separa las transacciones.

---

#### **6️⃣ DÍA 15 DEL MES: CONSOLIDACIÓN Y PAGO**
**ARCHIVO**: `src/app/mi-oficina/page.tsx` líneas 460-530
**Función**: `generarPagoQuincenal()`

**PROCESO ACTUAL**:
1. Trae TODAS las sesiones con estado_pago='pendiente'
2. Suma todas las horas (sin importar si son del 1-15 o 16-30)
3. Calcula monto: horas × valor_hora
4. Inserta en tabla `pagos_nomina`
5. Marca sesiones como estado_pago='pagado'
6. Pone `horasPendientesMap` a CERO

**REGISTRO EN TABLAS**:
- ✅ `pagos_nomina`: nueva fila con fecha_pago=hoy
- ✅ `sesiones_clase`: estado_pago cambia a 'pagado'
- ✅ `Mi Oficina`: `horasPendientesMap` se vacía

**¿EN TESORERÍA?**:
- ✅ Los pagos_nomina PERMANECEN registrados (no se borran)
- Tesorería debería mostrar el historial en tabla `pagos_nomina`

**Estado**: ⚠️ PARCIALMENTE IMPLEMENTADO
- Falta: Automatización del día 15
- Falta: Separación de ciclos (1-15 vs 16-30)

---

#### **7️⃣ HORAS EN "SU OFICINA" VUELVEN A CERO**
- ✅ IMPLEMENTADO: `setHorasPendientesMap({})` línea 505
- Después de generar pago, el mapa se vacía
- Próximas clases (16-30) vuelven a acumular

---

#### **8️⃣ EN TESORERÍA NO SE BORRAN**
**ARCHIVO**: `src/app/tesoreria/page.tsx`
- Tabla `pagos_nomina` es HISTORIAL
- Está separada de `pagos` (ingresos de estudiantes)
- Las filas antigas permanecen en BD
- **Estado**: ✅ IMPLEMENTADO (por diseño)

---

#### **9️⃣ CICLO SE REPITE (DÍA 16-30/31)**
- Profesor vuelve a registrar clases
- Nuevas `sesiones_clase` se crean
- `horasPendientesMap` se rellena nuevamente
- El día 30 sigue acumulando hasta... ¿cuándo?

**❌ PROBLEMA**: No hay lógica para el segundo ciclo del mes
- El sistema paga todo el día 15
- Pero no distingue qué es "segunda quincena"
- El día 20 genera un nuevo pago con TODO lo acumulado desde el 16

---

### 🚨 PROBLEMAS IDENTIFICADOS:

1. **Falta separación por quincena**:
   ```
   ESPERADO:
   - Día 1-15: acumula, paga el 15
   - Día 16-30: acumula, paga el 30/31
   
   ACTUAL:
   - Cada vez que se llama generarPagoQuincenal(), paga TODO
   - No hay "segundo corte" automático
   ```

2. **Sin consolidación automática el día 15**:
   - El admin debe hacer click en "Generar Pago Quincenal"
   - Debería ser automático o al menos alertar

3. **Sin reset automático en el dashboard**:
   - horasPendientesMap no se limpia automáticamente
   - Solo se limpia cuando se genera pago

4. **Tesorería vs Nómina confundidas**:
   - `pagos` = ingresos de estudiantes
   - `pagos_nomina` = pagos a profesores
   - Están bien separadas ✅

---

### ✅ LO QUE FUNCIONA BIEN:

1. ✅ Registro de asistencias
2. ✅ Cálculo automático de horas
3. ✅ Acumulación en sesiones_clase
4. ✅ Visualización en Mi Oficina
5. ✅ Historial en Tesorería (pagos_nomina)
6. ✅ Pago con estado_pago='pagado'
7. ✅ Reset de horas después del pago

---

### 📋 RECOMENDACIONES:

**Para completar el flujo especificado, necesitamos**:

1. **Añadir filtro por rango de fecha en generarPagoQuincenal()**:
   - Parámetro: `rango` (1-15 o 16-30)
   - Filtrar sesiones por `fecha >= inicio AND fecha <= fin`

2. **Automatizar el día 15 y 30**:
   - Usar Edge Function en Supabase
   - O ejecutar desde backend cada día

3. **Mejorar UI de nómina**:
   - Mostrar "Primera quincena" vs "Segunda quincena"
   - Botones separados para cada corte

4. **Auditoría**:
   - Agregar logs de consolidación
   - Historial de cambios en estado_pago

¿Quieres que implemente estas mejoras?
