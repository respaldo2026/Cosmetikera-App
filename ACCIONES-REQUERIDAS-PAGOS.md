# ⚡ ACCIONES REQUERIDAS - PAGOS NO VISIBLES (2026-01-12)

## 🎯 RESUMEN EJECUTIVO

**Problema:** Pagos de estudiantes no aparecen en Tesorería, Dashboard ni Perfil  
**Causa:** Tabla `pagos` incompleta en base de datos  
**Solución:** Aplicar 1 migración SQL (2-3 minutos)  
**Estado:** ✅ LISTO PARA EJECUTAR

---

## 🚀 PASOS A SEGUIR

### PASO 1: Abre Supabase SQL Editor
```
1. Ve a: https://supabase.com/dashboard
2. Selecciona tu proyecto "academia-crystal"
3. Click izquierda en "SQL Editor"
```

### PASO 2: Ejecuta la Migración
```
1. Abre el archivo: migration-complete-pagos-2026-01-12.sql
2. Copia TODO el contenido
3. Pega en SQL Editor de Supabase
4. Click en ▶ RUN (arriba derecha)
5. Espera 2-3 segundos a que termine
```

### PASO 3: Verifica que Todo Está Bien
En el mismo SQL Editor, ejecuta esto:

```sql
SELECT 
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'programas') as tabla_programas,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pagos' AND column_name = 'numero_cuota') as columna_numero_cuota,
    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generar_cuotas_automaticas') as funcion_existe,
    EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_generar_cuotas') as trigger_existe;
```

**Resultado esperado:** `true | true | true | true` ✅

### PASO 4: Prueba Rápida
```
1. Admin → Módulo Matriculas
2. Click "Nueva Matrícula"
3. Selecciona estudiante y curso
4. Guardar
5. Ve a SQL Editor y ejecuta:

SELECT COUNT(*) as total_pagos 
FROM pagos 
WHERE numero_cuota IS NOT NULL;
```

Deberías ver números > 0 ✅

### PASO 5: Verifica en Tesorería
```
1. Admin → Tesorería
2. Deberían aparecer los pagos creados
```

✅ **LISTO**

---

## 📚 DOCUMENTACIÓN

| Archivo | Propósito |
|---------|----------|
| `schema.sql` | **Schema completo actualizado** (usa esto para nuevos proyectos) |
| `migration-complete-pagos-2026-01-12.sql` | **Migración SQL para proyectos existentes** (copia y ejecuta en Supabase) |
| `REPORTE-FIX-PAGOS-2026-01-12.md` | **Explicación técnica completa** (para entender qué pasó) |
| `INSTRUCCIONES-FIX-PAGOS-2026-01-12.md` | **Guía detallada paso a paso** (si necesitas más detalles) |

---

## ⚠️ IMPORTANTE

### Si aún no ejecutas la migración:
1. **No crearás nuevas matrículas sin pagos**
2. Los pagos seguirán sin aparecer

### Después de ejecutar la migración:
1. ✅ Los pagos aparecerán automáticamente
2. ✅ El sistema volverá a la normalidad
3. ✅ No necesitas hacer nada más

---

## 🆘 Si algo falla

### Error: "relation does not exist"
→ La tabla no se creó. Verifica que ejecutaste TODO el script.

### Error: "column does not exist"
→ Las columnas no se agregaron. Verifica que copiaste TODO el contenido del SQL.

### Aún no veo pagos después de ejecutar migración
→ Ejecuta esto para verificar:
```sql
-- ¿El trigger está activo?
SELECT * FROM pg_trigger WHERE tgname = 'trigger_generar_cuotas';

-- ¿Se crearon pagos en la última matrícula?
SELECT * FROM pagos WHERE numero_cuota IS NOT NULL ORDER BY created_at DESC LIMIT 5;
```

---

## ⏱️ TIEMPO ESTIMADO

- **Ejecutar migración:** 2-3 minutos
- **Verificar:** 1 minuto
- **Prueba:** 2-3 minutos
- **Total:** 5-10 minutos

---

## ✅ CHECKLIST

Antes de continuar:

- [ ] Abrí Supabase
- [ ] Ejecuté `migration-complete-pagos-2026-01-12.sql`
- [ ] Verifiqué que todo existe (SELECT EXISTS...)
- [ ] Creé una matrícula de prueba
- [ ] Verifiqué que hay pagos en la BD
- [ ] Verifiqué en Tesorería
- [ ] Sistema funciona ✅

---

**🎉 Una vez hecho esto, tu sistema de pagos volverá a funcionar correctamente.**

Cualquier duda, revisa los archivos de documentación.
