# 🔧 GUÍA: Diagnosticar y Fijar Área Financiera de Estudiante

## Resumen del Problema
Los pagos no aparecen en el área financiera del estudiante aunque:
- ✅ La migración SQL se ejecutó
- ✅ Se creó una nueva matrícula
- ❌ Los pagos no se ven en perfil del estudiante

## Pasos para Resolver

### PASO 1: Verificar que los pagos se están creando en la BD
```
1. Abre Supabase Dashboard → SQL Editor
2. Pega y ejecuta: check-pagos-created.sql
3. Busca tu matrícula reciente en los resultados
4. Si ves "total_pagos: 0" → El trigger NO está funcionando
5. Si ves pagos pero con monto en 0 → Problema en los valores
6. Si ves pagos con montos correctos → Problema en el UI
```

### PASO 2: Recargar el Perfil del Estudiante
```
1. Ve a http://localhost:3001/estudiantes
2. Busca el estudiante que creaste la matrícula
3. Haz click en su nombre
4. En la página que se abre, busca el botón "Actualizar" (arriba a la derecha)
5. Haz click en "Actualizar" para refrescar los datos
6. Los pagos deberían aparecer en la pestaña "Información Financiera"
```

### PASO 3: Si aún no aparecen los pagos

**Opción A: Re-ejecutar la migración completa**
```sql
-- En Supabase SQL Editor, ejecuta COMPLETO:
-- migration-consolidated-2026-01-12.sql
-- Esto recreará la función y el trigger correctamente
```

**Opción B: Crear una matrícula NUEVA después de la migración**
```
1. Ve a http://localhost:3001/matriculas/create
2. Selecciona un estudiante (puede ser el mismo o diferente)
3. Selecciona un programa y curso
4. Selecciona fecha de inicio (sin problemas ahora que arreglamos el DatePicker)
5. Haz click en "Crear Inscripción Académica"
6. Completa el pago de inscripción
7. Luego ve al perfil del estudiante y verifica el área financiera
```

## Qué Debería Ver

### En Tesorería (http://localhost:3001/tesoreria)
```
Debe aparecer UNA fila de pago pendiente:
- Estudiante: [nombre]
- Curso: [nombre del curso]
- Monto: [precio_inscripcion del programa]
- Período: Inscripción
- Número de Cuota: 0
- Estado: pendiente
```

### En Perfil del Estudiante → Información Financiera
```
Debe aparecer:
- Total Pagado: $0 (si no ha pagado)
- Deuda Pendiente: [suma de inscripción + todas las cuotas mensuales]

En la tabla "Estado de Pagos por Curso":
- Curso: [nombre]
- Cuotas de Pago: Botones mostrando cada cuota
  - Inscripción (estado: PENDIENTE)
  - Mes 1 (estado: PENDIENTE)
  - Mes 2 (estado: PENDIENTE)
  - etc.

En "Historial Completo de Transacciones":
- Debe aparecer la lista de TODOS los pagos generados
```

## Verificación Final

Copia y pega en la consola del navegador (F12) para ver si hay errores:
```javascript
// En DevTools Console:
console.log('¿Están mostrándose los pagos?');
// Los pagos se obtienen de la tabla con dataSource={pagosHistorial}
```

## Notas Importantes

1. **Button "Actualizar"**: Acabamos de agregar este botón a la página
   - Permite refrescar datos sin hacer F5
   - Muy útil para verificar cambios inmediatos

2. **DatePicker arreglado**: Ya no da error al seleccionar fecha

3. **Función generar_cuotas_automaticas**: 
   - Lee `precio_mensualidad` del programa (no calcula)
   - Genera 1 inscripción + N cuotas (donde N = duración en meses)
   - Se ejecuta automáticamente al crear una matrícula

4. **Caching**: Si aún no ves los cambios después de 10 segundos:
   - Haz F5 (refresh completo de la página)
   - O usa el botón "Actualizar" recién agregado

## Archivos Modificados

✅ [src/app/estudiantes/show/[id]/page.tsx](src/app/estudiantes/show/[id]/page.tsx)
  - Agregado botón "Actualizar" con icono ReloadOutlined
  - Agregado import de ReloadOutlined

✅ [schema.sql](schema.sql)
  - Función generar_cuotas_automaticas actualizada

✅ [migration-consolidated-2026-01-12.sql](migration-consolidated-2026-01-12.sql)
  - Listo para ejecutar si necesitas recrear la función

## Próximos Pasos

1. ✅ Ya ejecutaste las migraciones anteriores
2. 🔄 Ejecuta: check-pagos-created.sql (para diagnosticar)
3. 📱 Abre perfil del estudiante y haz click en "Actualizar"
4. 👀 Verifica si aparecen los pagos

¿Qué ves en los resultados de check-pagos-created.sql?
