# 📚 Sistema de Pensum y Material Didáctico

## Descripción General

Este sistema permite gestionar:
- **Pensum**: Plan de estudios organizados por ciclos/fases para cada programa académico
- **Cursos del Pensum**: Lista de cursos que debe incluir cada ciclo
- **Material Didáctico**: Documentos, videos, presentaciones y otros recursos de apoyo

Los grupos que se crean para un programa heredarán automáticamente el pensum y materiales asociados.

---

## 🚀 Instalación

### Paso 1: Ejecutar la Migración en Supabase

1. Abre el **Supabase Dashboard** en tu navegador
2. Ve a **SQL Editor**
3. Abre el archivo `migration-pensum-materiales-2026.sql`
4. **Copia TODO el contenido**
5. **Pega en el SQL Editor** de Supabase
6. Haz clic en **RUN**

### Paso 2: Verificar la Instalación

Ejecuta esta consulta para verificar que todo se creó:

```sql
-- Verificar tabla pensum
SELECT 'Tabla pensum creada' FROM pensum LIMIT 0;

-- Verificar tabla pensum_cursos
SELECT 'Tabla pensum_cursos creada' FROM pensum_cursos LIMIT 0;

-- Verificar tabla material_didactico
SELECT 'Tabla material_didactico creada' FROM material_didactico LIMIT 0;

-- Verificar tabla grupo_pensum
SELECT 'Tabla grupo_pensum creada' FROM grupo_pensum LIMIT 0;
```

Si no hay errores, ¡está todo listo! ✅

### Paso 3: Crear Bucket de Storage (Importante)

Para subir archivos de material didáctico:

1. Ve a **Supabase Dashboard** → **Storage**
2. Haz clic en **Create a new bucket**
3. Nombre: `material_didactico`
4. **Desactiva "Private bucket"** (debe ser público para descargas)
5. Haz clic en **Create bucket**

---

## 📖 Cómo Usar el Sistema

### 1️⃣ Crear un Pensum para un Programa

1. Ve a **Programas** en el menú
2. Haz clic en **"Gestionar Pensum/Material"** de un programa
3. Ve a la pestaña **"📚 Pensum"**
4. Haz clic en **"Nuevo Ciclo"**
5. Completa los datos:
   - **Número de Ciclo**: 1, 2, 3, etc.
   - **Nombre del Ciclo**: "Ciclo Introductorio", "Fase Avanzada", etc.
   - **Descripción**: Breve descripción del ciclo
   - **Duración (semanas)**: Duración del ciclo
   - **Total de Horas**: Total de horas del ciclo
6. Haz clic en **"Guardar"**

#### Ejemplo de Pensum para un Programa de Micropigmentación:

| Ciclo | Nombre | Duración | Horas |
|-------|--------|----------|-------|
| 1 | Introducción | 4 semanas | 40 |
| 2 | Técnicas Básicas | 6 semanas | 60 |
| 3 | Técnicas Avanzadas | 4 semanas | 40 |

### 2️⃣ Agregar Cursos al Pensum

1. Abre el programa y ve a **"📚 Pensum"**
2. Busca el ciclo donde quieres agregar cursos
3. Haz clic en **"Ver Cursos"** del ciclo
4. Haz clic en **"Agregar Curso"**
5. Completa:
   - **Nombre del Curso**: "Seguridad e Higiene", "Anatomía Básica", etc.
   - **Descripción**: Breve descripción
   - **Horas**: Duración en horas
   - **Créditos**: Créditos académicos (opcional)
   - **Tipo de Curso**: Obligatorio, Electivo o Complementario
6. Haz clic en **"Guardar"**

#### Ejemplo de Cursos para Ciclo 1 de Micropigmentación:

- ✅ **Seguridad e Higiene** (Obligatorio) - 8 horas - 1 crédito
- ✅ **Anatomía Facial** (Obligatorio) - 16 horas - 2 créditos
- ✅ **Introducción a Pigmentos** (Obligatorio) - 10 horas - 1 crédito
- ✅ **Manejo de Herramientas** (Complementario) - 6 horas - 0.5 créditos

### 3️⃣ Subir Material Didáctico

1. Abre el programa y ve a **"📎 Material Didáctico"**
2. Haz clic en **"Subir Material"**
3. Completa:
   - **Título del Material**: "Guía Práctica 1", "Video Técnica Sombreado", etc.
   - **Descripción**: Qué es el material y para qué sirve
   - **Tipo de Material**: Documento, Video, Imagen, Presentación, Recurso, Otro
   - **Ciclo (Opcional)**: Si es específico de un ciclo, selecciónalo
   - **Archivo**: Selecciona el archivo a subir
4. Haz clic en **"Subir Material"**

#### Tipos de Material Soportados:

- 📄 **Documento**: PDFs, Word, etc. (máximo tamaño variable según Supabase)
- 🎥 **Video**: MP4, WebM, etc.
- 🖼️ **Imagen**: PNG, JPG, etc.
- 📊 **Presentación**: PowerPoint, Google Slides exportado como PDF
- 🔧 **Recurso**: Plantillas, ejercicios, herramientas
- 📎 **Otro**: Cualquier otro formato

---

## 🔗 Asignar Pensum a Grupos

Cuando creis un grupo (curso con horario específico) en un programa:

1. El sistema **automáticamente** puede asociar un pensum al grupo
2. De esta forma, todos los estudiantes del grupo ven el mismo pensum y materiales
3. Los profesores del grupo tendrán acceso a los materiales para enseñanza

### Cómo Ver el Pensum en un Grupo:

- Los estudiantes verán el pensum y materiales en su **Portal del Estudiante**
- Los profesores verán el pensum en su **Mi Oficina** (sección de materiales)
- Los administradores verán todo en **Gestión de Cursos**

---

## 📊 Estructura de Datos

### Tabla: `pensum`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único |
| `programa_id` | INTEGER | Programa al que pertenece (FK) |
| `numero_ciclo` | INTEGER | Número del ciclo (1, 2, 3...) |
| `nombre_ciclo` | VARCHAR | Nombre del ciclo |
| `descripcion` | TEXT | Descripción |
| `duracion_semanas` | INTEGER | Semanas de duración |
| `total_horas` | INTEGER | Horas totales |
| `orden` | INTEGER | Orden de presentación |
| `activo` | BOOLEAN | Si está activo |

### Tabla: `pensum_cursos`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único |
| `pensum_id` | UUID | Pensum al que pertenece (FK) |
| `curso_id` | INTEGER | Curso asociado (FK, opcional) |
| `nombre_curso` | VARCHAR | Nombre del curso |
| `horas` | INTEGER | Horas del curso |
| `creditos` | INTEGER | Créditos académicos |
| `tipo_curso` | VARCHAR | obligatorio/electivo/complementario |

### Tabla: `material_didactico`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único |
| `programa_id` | INTEGER | Programa al que pertenece (FK) |
| `pensum_id` | UUID | Ciclo específico (FK, opcional) |
| `titulo` | VARCHAR | Título del material |
| `tipo_material` | VARCHAR | documento/video/imagen/presentacion/recurso/otro |
| `url_archivo` | TEXT | URL del archivo en Supabase Storage |
| `tamano_bytes` | INTEGER | Tamaño en bytes |
| `mime_type` | VARCHAR | Tipo MIME |
| `subido_por` | UUID | Usuario que lo subió (FK) |
| `visible` | BOOLEAN | Si es visible para estudiantes |

### Tabla: `grupo_pensum`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único |
| `grupo_id` | INTEGER | Grupo/Curso (FK) |
| `pensum_id` | UUID | Pensum asignado (FK) |
| `asignado_en` | TIMESTAMP | Fecha de asignación |
| `asignado_por` | UUID | Usuario que lo asignó (FK) |

---

## 🔐 Permisos (RLS)

### Pensum
- ✅ **Ver**: Todos los usuarios autenticados
- ✅ **Crear/Editar/Eliminar**: Solo Admins

### Material Didáctico
- ✅ **Ver**: Todos los usuarios (si `visible=true`)
- ✅ **Subir**: Solo Admins
- ✅ **Editar/Eliminar**: Solo quien lo subió o Admins

### Grupo-Pensum
- ✅ **Ver**: Todos
- ✅ **Asignar**: Solo Admins

---

## 🎯 Flujo de Uso Típico

```
1. Director/Admin crea un programa
   ↓
2. Director/Admin define el pensum (ciclos)
   ↓
3. Director/Admin agrega cursos a cada ciclo del pensum
   ↓
4. Director/Admin sube material didáctico asociado al programa/ciclo
   ↓
5. Director/Admin crea un grupo (curso con horario) para el programa
   ↓
6. Sistema asocia automáticamente el pensum al grupo
   ↓
7. Estudiantes se matriculan en el grupo
   ↓
8. Estudiantes ven el pensum y materiales en su Portal
   ↓
9. Profesor enseña usando el pensum y materiales como guía
```

---

## 📱 Vistas y Funciones SQL

### Vistas Disponibles

```sql
-- Ver pensum completo con conteos
SELECT * FROM v_pensum_completo;

-- Ver material con detalles
SELECT * FROM v_material_completo;

-- Ver grupos con pensum asignado
SELECT * FROM v_grupos_con_pensum;
```

### Funciones SQL

```sql
-- Asignar pensum a un grupo
SELECT * FROM asignar_pensum_a_grupo(grupo_id, pensum_id);

-- Obtener cursos de un pensum
SELECT * FROM obtener_cursos_pensum(pensum_id);

-- Obtener materiales de un programa
SELECT * FROM obtener_materiales_programa(programa_id);
```

---

## ❓ Preguntas Frecuentes

**¿Qué pasa si cambio el pensum de un programa?**
- Solo afecta a los nuevos grupos que se creen. Los grupos existentes mantienen su pensum actual.

**¿Puedo asignar múltiples pensum a un grupo?**
- No, cada grupo tiene máximo un pensum asignado. Pero puedes actualizar el pensum de un grupo creando un nuevo registro.

**¿Los estudiantes pueden descargar los materiales?**
- Sí, el sistema genera URLs públicas para todos los materiales con `visible=true`.

**¿Qué formatos de archivo se aceptan?**
- Cualquier formato que Supabase Storage soporte: PDF, Word, Excel, videos, imágenes, etc. No hay restricción de tipo.

**¿Puedo ocultar un material de los estudiantes?**
- Sí, establece `visible=false` para una material y solo los admins lo verán.

**¿Se pueden eliminar ciclos con grupos asignados?**
- Sí, pero se romperá la asociación. Se recomienda no hacer esto en producción.

---

## 🚨 Troubleshooting

**Error: "Tabla no existe"**
- Ejecuta nuevamente la migración SQL en Supabase

**Error: "Permiso denegado"**
- Verifica que tu usuario tiene rol "admin" o "administrativo"

**Error al subir archivo**
- Verifica que el bucket `material_didactico` existe y es público
- Verifica el tamaño del archivo

**No veo los cursos que agregué**
- Recarga la página
- Verifica que estén en el ciclo correcto

---

**¡Listo!** 🎉 Tu sistema de pensum y materiales está funcionando correctamente.

Para más ayuda, revisa los comentarios en el código del componente `GestorPensum.tsx`.
