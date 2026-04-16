# 🧪 GUÍA COMPLETA DE PRUEBAS - OPERACIONES CRUD

## 📋 Resumen Ejecutivo

Esta guía te permite verificar que TODOS los formularios de edición guardan datos correctamente en Vercel. El problema reportado ayer (cambios no se guardaban en estudiantes) se debe a **políticas RLS incompletas en UPDATE**.

**Solución aplicada:** Script SQL `FIX-ACTUALIZACIONES-TABLAS-2026.sql` que agrega políticas `FOR UPDATE` a todas las tablas críticas.

---

## 🔧 PASO 0: EJECUTAR EL FIX

Antes de cualquier prueba:

1. Abre **Supabase Dashboard** → **SQL Editor**
2. Copia el contenido de: `FIX-ACTUALIZACIONES-TABLAS-2026.sql`
3. Pégalo en el editor
4. Haz click en **Run** o presiona `Ctrl+Enter`
5. Espera el mensaje: ✅ **FIX COMPLETADO**
6. Cierra el browser y vuelve a abrir Vercel (limpia caché: `Ctrl+Shift+R`)

---

## ✅ CHECKLIST DE PRUEBAS FUNCIONALES

### 🎓 MÓDULO: ESTUDIANTES

#### Prueba 1: Crear Estudiante
- [ ] Ir a: `/estudiantes`
- [ ] Click en **+ Nuevo Estudiante**
- [ ] Rellenar campos:
  - Nombre: `Juan Prueba` (o similar)
  - Cédula: `123456789`
  - Email: `juan@ejemplo.com`
  - Teléfono: `3001234567`
  - Fecha nacimiento: `2000-01-01`
- [ ] Click **Guardar**
- [ ] ✅ Aparece en la lista

#### Prueba 2: Editar Estudiante
- [ ] Buscar el estudiante creado
- [ ] Click en **Editar** (lápiz)
- [ ] Cambiar campos:
  - Nombre: de `Juan Prueba` a `Juan Carlos Prueba`
  - Teléfono: cambiar dígito
  - Observaciones: agregar texto
- [ ] Click **Guardar**
- [ ] ✅ Vuelve a la lista
- [ ] ✅ Verifica que los cambios se guardaron (abre de nuevo)

#### Prueba 3: Ver Detalles Estudiante
- [ ] Click en **Ver** (ojo)
- [ ] ✅ Se abre modal con datos

#### Prueba 4: Eliminar Estudiante
- [ ] Click en **Eliminar** (papelera)
- [ ] Confirmar en modal
- [ ] ✅ Desaparece de la lista

---

### 👨‍🏫 MÓDULO: PROFESORES

#### Prueba 5: Crear Profesor
- [ ] Ir a: `/profesores`
- [ ] Click en **+ Nuevo Profesor**
- [ ] Rellenar:
  - Nombre: `Carlos López`
  - Email: `carlos@ejemplo.com`
  - Teléfono: `3109876543`
  - Valor por hora: `50000`
- [ ] Click **Guardar**
- [ ] ✅ Aparece en la lista

#### Prueba 6: Editar Profesor
- [ ] Click en **Editar**
- [ ] Cambiar:
  - Nombre: agregar apellido
  - Valor por hora: cambiar a `60000`
  - Teléfono 2: agregar segundo teléfono
- [ ] Click **Guardar**
- [ ] ✅ Cambios se guardan (verifica abriendo de nuevo)

#### Prueba 7: Ver Detalles Profesor
- [ ] Click en **Ver**
- [ ] ✅ Se muestra información completa

---

### 📚 MÓDULO: GRUPOS (CURSOS)

#### Prueba 8: Editar Grupo
- [ ] Ir a: `/cursos`
- [ ] Seleccionar un grupo existente
- [ ] Click en **Editar**
- [ ] Cambiar campos como:
  - Nombre: agregar "(actualizado)"
  - Horario: cambiar horas
  - Salón: cambiar a otro
- [ ] Click **Guardar**
- [ ] ✅ Vuelve a lista
- [ ] ✅ Verifica cambios al abrir de nuevo

#### Prueba 9: Cambiar Profesor de Grupo
- [ ] Click en **Editar** en un grupo
- [ ] En campo "Profesor": selecciona otro profesor
- [ ] Click **Guardar**
- [ ] ✅ El profesor cambia correctamente

---

### 📝 MÓDULO: MATRÍCULAS

#### Prueba 10: Editar Matrícula
- [ ] Ir a: `/matriculas`
- [ ] Seleccionar una matrícula existente
- [ ] Click en **Editar**
- [ ] Cambiar:
  - Estado: de un valor a otro (ej: "activo" a "completado")
  - Observaciones: agregar nota
- [ ] Click **Guardar**
- [ ] ✅ Cambios se guardan
- [ ] ✅ Si cambias a "Aprobado", el estudiante puede descargar diploma

---

### 👥 MÓDULO: LEADS

#### Prueba 11: Editar Lead
- [ ] Ir a: `/leads`
- [ ] Seleccionar un lead existente
- [ ] Click en **Editar**
- [ ] Cambiar:
  - Estado: de "nuevo" a "contactado"
  - Canal: cambiar a otro
  - Notas: agregar observación
- [ ] Click **Guardar**
- [ ] ✅ Los cambios se guardan

#### Prueba 12: Crear Lead Inline
- [ ] En `/leads`, click en **+ Nuevo Lead**
- [ ] Rellenar:
  - Nombre: `María Pérez`
  - Teléfono: `3201234567`
  - Email: `maria@ejemplo.com`
  - Interés: seleccionar programa
  - Estado: `nuevo`
- [ ] Click **Guardar**
- [ ] ✅ Aparece en tabla

---

### ⚙️ MÓDULO: CONFIGURACIÓN

#### Prueba 13: Editar Configuración
- [ ] Ir a: `/configuracion` (si existe)
- [ ] Click en **Editar**
- [ ] Cambiar valores como:
  - Nombre academia
  - Email de contacto
  - Logo/imagen
- [ ] Click **Guardar**
- [ ] ✅ Los cambios persisten

---

## 🔍 PRUEBAS AVANZADAS (Validar RLS)

### Prueba 14: Verificar RLS Estudiante
**Objetivo:** Confirmar que un estudiante NO puede editar datos de otro

- [ ] Crea 2 cuentas de estudiante diferentes
- [ ] Clave privada para Estudiante A (email: `estA@ejemplo.com`)
- [ ] Intenta editar el perfil:
  - ✅ Puede editar su PROPIO perfil
  - ❌ NO puede editar perfil de Estudiante B
- [ ] Intenta acceder a URL de otro: `/estudiantes/edit/[otro-id]`
  - ❌ Debe mostrar error o datos vacíos

### Prueba 15: Verificar RLS Profesor
**Objetivo:** Profesor ve solo sus cursos

- [ ] Login como Profesor A
- [ ] Lista de `/cursos`:
  - ✅ Ve solo sus propios cursos
  - ✅ Ve estudiantes de sus cursos
  - ❌ NO ve cursos de Profesor B

### Prueba 16: Verificar RLS Admin
**Objetivo:** Admin puede editar TODO

- [ ] Login como Admin
- [ ] Ir a `/estudiantes`
  - ✅ Edita cualquier estudiante
- [ ] Ir a `/profesores`
  - ✅ Edita cualquier profesor
- [ ] Ir a `/cursos`
  - ✅ Edita cualquier curso
- [ ] Ir a `/matriculas`
  - ✅ Edita cualquier matrícula

---

## 📊 TABLA DE RESULTADOS

Guarda esta tabla para documentar tus pruebas:

```
PRUEBA                              ESTADO    NOTAS
─────────────────────────────────────────────────────────────
1. Crear Estudiante                 [ ]
2. Editar Estudiante                [ ]
3. Ver Detalles Estudiante          [ ]
4. Eliminar Estudiante              [ ]
5. Crear Profesor                   [ ]
6. Editar Profesor                  [ ]
7. Ver Detalles Profesor            [ ]
8. Editar Grupo                     [ ]
9. Cambiar Profesor de Grupo        [ ]
10. Editar Matrícula                [ ]
11. Editar Lead                     [ ]
12. Crear Lead                      [ ]
13. Editar Configuración            [ ]
14. RLS Estudiante (no ve otros)    [ ]
15. RLS Profesor (ve solo suyos)    [ ]
16. RLS Admin (ve todo)             [ ]
```

---

## 🐛 Si una prueba FALLA

### Error: "Permission denied"
**Causa:** RLS aún bloqueando UPDATE  
**Solución:**
1. Verifica que ejecutaste el script SQL completo
2. Revisa que Supabase confirmó con ✅
3. Limpia caché (Ctrl+Shift+R)
4. Si persiste, revisa console del navegador (F12 → Network)

### Error: "Campo no se guarda pero no hay error"
**Causa:** El formulario se envía pero Supabase rechaza silenciosamente  
**Solución:**
1. Abre F12 → Console
2. Busca mensajes rojos de Supabase
3. Verifica que el `resource` en `useForm()` coincida con el nombre de tabla

### Error: "No puedo editar mi propio perfil"
**Causa:** Política RLS requiere que `id = auth.uid()` pero falló  
**Solución:**
1. Verifica que el ID del usuario coincide con `auth.uid()`
2. Revisa que el token no expiró (desloguea y loguea)

---

## 🚀 PRÓXIMOS PASOS DESPUÉS DE COMPLETAR PRUEBAS

Si TODAS las pruebas pasan:

1. ✅ Documentar en: `VERIFICACION-CRUD-COMPLETADA-2026.md`
2. ✅ Notificar al equipo que puede editar datos sin problemas
3. ✅ Si hay fallos, abrir issue con el error específico

Si hay fallos:

1. 🔴 Reporte de error (pantalla + F12 console)
2. 🔴 Tabla de tabla afectada
3. 🔴 Rol del usuario que lo intenta
4. 🔴 Acción específica que falla

---

## 📱 PRUEBAS EN MOBILE (Vercel)

Repite las pruebas clave en celular:

- [ ] Acceso a `/estudiantes` en mobile
- [ ] Edición de campos en pantalla pequeña
- [ ] Guardado de cambios desde mobile
- [ ] RLS funciona igual en mobile que desktop

---

## 📞 Contacto si necesitas ayuda

Si una prueba falla y no sabes qué hacer:

1. Toma screenshot del error
2. Abre F12 y copia el error de console
3. Abre issue con:
   - Paso exacto donde falló
   - Error completo
   - Rol del usuario
   - URL donde ocurrió

¡Gracias por probar! 🎉
