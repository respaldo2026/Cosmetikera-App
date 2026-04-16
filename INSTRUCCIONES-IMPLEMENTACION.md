# 🎯 Instrucciones de Implementación - Estructura Programas/Grupos

## 📋 Resumen
Se ha reestructurado el sistema para separar **PROGRAMAS** (cursos académicos generales) de **GRUPOS/COHORTES** (instancias específicas con horarios). Los estudiantes se matriculan en grupos, no directamente en programas.

---

## ✅ Paso 1: Ejecutar Migración en Supabase

### 1.1. Abrir Supabase SQL Editor
1. Ir a tu proyecto en [Supabase](https://supabase.com)
2. Hacer clic en **SQL Editor** en el menú lateral
3. Hacer clic en **New Query**

### 1.2. Ejecutar Script de Migración
1. Abrir el archivo: `migrations-programas-grupos.sql`
2. **Copiar TODO el contenido** del archivo
3. **Pegar** en el SQL Editor de Supabase
4. Hacer clic en **Run** (▶️)
5. Verificar que el resultado diga "Success"

### 1.3. Verificar la Migración
```sql
-- Verificar que la tabla programas existe
SELECT * FROM programas;

-- Verificar que el campo programa_id se agregó a cursos
SELECT id, nombre, programa_id FROM cursos LIMIT 5;

-- Ver cuántos programas se crearon
SELECT COUNT(*) FROM programas;
```

**Resultado esperado:**
- La tabla `programas` existe con registros
- Los cursos existentes tienen `programa_id` poblado
- No hay errores en la consola

---

## ✅ Paso 2: Verificar Cambios en la Interfaz

### 2.1. Reiniciar el Servidor de Desarrollo
```powershell
# Si el servidor está corriendo, detenerlo (Ctrl+C)
# Luego reiniciar:
npm run dev
```

### 2.2. Navegar a las Nuevas Páginas

#### A. Página de Programas
1. Abrir: http://localhost:3000/programas
2. **Verificar:**
   - Se muestra la tabla de programas
   - Los programas existentes aparecen (migrados desde cursos)
   - El botón "Nuevo Programa" funciona
3. **Probar:**
   - Crear un nuevo programa
   - Editar un programa existente
   - Expandir un programa para ver detalles

#### B. Página de Grupos/Cohortes
1. Abrir: http://localhost:3000/cursos
2. **Verificar:**
   - Los grupos están organizados por programa
   - Cada panel muestra el nombre del programa, duración, precio
   - Los grupos se clasifican en Activos/Próximos/Terminados
   - Se muestran los horarios, profesor, inscritos/cupos

#### C. Crear Nuevo Grupo
1. Hacer clic en **"Nueva Cohorte"**
2. **Verificar campos:**
   - ✅ Selector de "Programa Académico" (campo nuevo)
   - ✅ Nombre del Grupo/Cohorte
   - ✅ Descripción/Notas
   - ✅ Profesor Asignado
   - ✅ Días de la Semana (multi-select)
   - ✅ Hora Inicio y Hora Fin
   - ✅ Cupos
   - ✅ Fecha Inicio y Fecha Fin
3. **Probar:**
   - Seleccionar un programa
   - Crear un nuevo grupo con horario específico
   - Verificar que se guarda correctamente

#### D. Editar Grupo Existente
1. En la vista de grupos, hacer clic en **"Editar"** de cualquier grupo
2. **Verificar:**
   - El selector de programa muestra el programa actual
   - Se puede cambiar a otro programa
   - Los demás campos funcionan normalmente
3. **Probar:**
   - Cambiar el programa de un grupo
   - Modificar horarios
   - Guardar cambios

---

## ✅ Paso 3: Probar el Flujo Completo

### 3.1. Crear un Programa Nuevo
1. Ir a `/programas`
2. Crear programa: "Extensión de Pestañas"
   - Duración: "2 meses"
   - Precio: $1,500,000
   - Descripción: "Curso completo de extensión de pestañas..."
3. Guardar

### 3.2. Crear Grupos del Programa
1. Ir a `/cursos`
2. Hacer clic en "Nueva Cohorte"
3. Crear **Grupo A**:
   - Programa: "Extensión de Pestañas"
   - Nombre: "Grupo Mañana"
   - Días: Lunes, Miércoles, Viernes
   - Hora: 9:00 - 12:00
   - Profesor: [Seleccionar]
   - Cupos: 15
4. Crear **Grupo B**:
   - Programa: "Extensión de Pestañas"
   - Nombre: "Grupo Fin de Semana"
   - Días: Sábados
   - Hora: 14:00 - 18:00
   - Profesor: [Seleccionar]
   - Cupos: 10

### 3.3. Verificar Vista Agrupada
1. Ir a `/cursos`
2. **Buscar el panel** "Extensión de Pestañas"
3. **Verificar:**
   - Se muestran los 2 grupos creados
   - Aparece la info del programa (duración, precio)
   - Cada grupo muestra su horario específico
   - Los badges muestran cuántos grupos activos/próximos hay

### 3.4. Matricular un Estudiante
1. Ir a `/matriculas/create`
2. Buscar un estudiante
3. En "Curso/Grupo", seleccionar: "Extensión de Pestañas - Grupo Mañana"
4. Completar y guardar
5. Verificar que la matrícula se creó correctamente

---

## ✅ Paso 4: Validar Datos Migrados

### 4.1. Consultas de Verificación en Supabase
```sql
-- Ver todos los programas
SELECT id, nombre, duracion, precio 
FROM programas 
ORDER BY nombre;

-- Ver grupos y sus programas
SELECT 
  c.id,
  c.nombre AS grupo,
  p.nombre AS programa,
  c.dias_semana,
  c.hora_inicio,
  c.hora_fin,
  c.cupos
FROM cursos c
LEFT JOIN programas p ON c.programa_id = p.id
ORDER BY p.nombre, c.nombre;

-- Contar grupos por programa
SELECT 
  p.nombre AS programa,
  COUNT(c.id) AS cantidad_grupos
FROM programas p
LEFT JOIN cursos c ON p.id = c.programa_id
GROUP BY p.nombre
ORDER BY cantidad_grupos DESC;
```

---

## 🐛 Solución de Problemas

### Problema: "Column programa_id does not exist"
**Solución:**
- Ejecuta nuevamente la migración `migrations-programas-grupos.sql`
- Verifica que el comando `ALTER TABLE cursos ADD COLUMN` se ejecutó correctamente

### Problema: Los grupos no muestran el nombre del programa
**Solución:**
- Ejecuta el UPDATE que vincula cursos con programas:
```sql
UPDATE cursos c
SET programa_id = p.id
FROM programas p
WHERE c.nombre = p.nombre;
```

### Problema: Error al crear grupo "programa_id is required"
**Solución:**
- Asegúrate de que existan programas en la base de datos
- Verifica que el select de programas esté cargando datos
- Revisa la consola del navegador para errores de API

### Problema: Los programas no aparecen en el menú
**Solución:**
- Verifica que `src/app/layout.tsx` tenga el recurso "programas" registrado
- Reinicia el servidor de desarrollo
- Limpia la caché del navegador

---

## 📊 Checklist de Validación

Marca cada ítem después de verificarlo:

### Base de Datos
- [ ] Tabla `programas` creada
- [ ] Campo `programa_id` agregado a `cursos`
- [ ] Programas migrados correctamente
- [ ] Cursos vinculados a programas

### Interfaz - Programas
- [ ] Página `/programas` carga correctamente
- [ ] Botón "Nuevo Programa" funciona
- [ ] Formulario de crear programa funciona
- [ ] Editar programa funciona
- [ ] Expandir detalles del programa funciona

### Interfaz - Grupos/Cohortes
- [ ] Página `/cursos` muestra grupos por programa
- [ ] Paneles expandibles funcionan
- [ ] Clasificación Activos/Próximos/Terminados correcta
- [ ] Información de horarios se muestra bien
- [ ] Botones Gestionar/Editar funcionan

### Formularios
- [ ] Crear grupo: selector de programa funciona
- [ ] Crear grupo: todos los campos funcionan
- [ ] Editar grupo: selector de programa funciona
- [ ] Editar grupo: guardar cambios funciona

### Flujo Completo
- [ ] Crear programa nuevo
- [ ] Crear grupos dentro del programa
- [ ] Matricular estudiante en un grupo
- [ ] Ver estadísticas por programa

---

## 📚 Archivos Modificados

### Nuevos Archivos
- `migrations-programas-grupos.sql` - Script de migración
- `src/app/programas/page.tsx` - CRUD de programas
- `README-PROGRAMAS-GRUPOS.md` - Documentación completa
- `INSTRUCCIONES-IMPLEMENTACION.md` - Este archivo

### Archivos Modificados
- `src/app/layout.tsx` - Agregado recurso "programas"
- `src/app/cursos/page.tsx` - Vista agrupada por programas
- `src/app/cursos/create/page.tsx` - Selector de programa_id
- `src/app/cursos/edit/[id]/page.tsx` - Selector de programa_id

---

## 🎉 ¡Listo!

Si todos los checkmarks están marcados, la implementación está completa y funcionando correctamente.

**Siguiente paso:** Capacitar a los usuarios sobre la nueva estructura:
1. Los **programas** son las ofertas académicas generales
2. Los **grupos/cohortes** son las clases específicas con horarios
3. Los estudiantes se matriculan en **grupos**, no en programas directamente

---

## 📞 Referencia Rápida

- **Ver programas:** `/programas`
- **Ver grupos:** `/cursos`
- **Crear programa:** `/programas` → "Nuevo Programa"
- **Crear grupo:** `/cursos` → "Nueva Cohorte"
- **Documentación completa:** `README-PROGRAMAS-GRUPOS.md`
- **Script SQL:** `migrations-programas-grupos.sql`
