# Estructura de Programas y Grupos - Academia Crystal

## 📚 Conceptos

La estructura académica tiene **dos niveles jerárquicos**:

### 1. **PROGRAMAS** (Nivel Superior)
Son los cursos académicos generales que ofrece la academia.

**Ejemplos:**
- Micropigmentación Profesional
- Técnicas de Cejas
- Extensión de Pestañas

**Información que contienen:**
- Nombre del programa
- Descripción completa
- Duración total (ej: "3 meses", "120 horas")
- Precio (total, inscripción, mensualidad)
- Contenido/temario
- Requisitos
- Tipo de certificación

### 2. **GRUPOS/COHORTES** (Nivel Secundario)
Son las instancias específicas de un programa, con horarios y fechas concretas.

**Ejemplos dentro del programa "Micropigmentación":**
- Grupo A - Lunes y Miércoles 9am-12pm
- Grupo B - Sábados 2pm-6pm
- Cohorte Nocturna - Martes y Jueves 6pm-9pm

**Información que contienen:**
- Referencia al programa padre (programa_id)
- Nombre del grupo/cohorte
- Días de la semana
- Hora de inicio y fin
- Profesor asignado
- Cupos disponibles
- Fechas de inicio y fin específicas
- Estado (activo, cerrado, finalizado)

## 🎯 Flujo de Trabajo

### Paso 1: Crear Programas
1. Ir a **"Programas"** en el menú
2. Hacer clic en **"Nuevo Programa"**
3. Completar la información general del curso académico
4. Guardar

### Paso 2: Crear Grupos dentro de un Programa
1. Ir a **"Grupos/Cohortes"** en el menú
2. Hacer clic en **"Nueva Cohorte"**
3. **Seleccionar el programa** al que pertenece
4. Ingresar nombre del grupo (ej: "Grupo Mañana", "Fin de Semana")
5. Configurar horarios (días, hora inicio, hora fin)
6. Asignar profesor
7. Establecer cupos y fechas
8. Guardar

### Paso 3: Matricular Estudiantes
- Los estudiantes se matriculan en los **GRUPOS**, no directamente en los programas
- Cada grupo hereda la información del programa (precio, duración)
- Los estudiantes asisten a las clases según el horario del grupo específico

## 📊 Base de Datos

### Tabla: `programas`
```sql
- id (SERIAL PRIMARY KEY)
- nombre (TEXT) - Nombre único del programa
- descripcion (TEXT)
- duracion (TEXT)
- duracion_horas (INTEGER)
- precio (NUMERIC)
- precio_inscripcion (NUMERIC)
- precio_mensualidad (NUMERIC)
- contenido (TEXT)
- requisitos (TEXT)
- certificacion (TEXT)
- activo (BOOLEAN)
```

### Tabla: `cursos` (ahora representa Grupos/Cohortes)
```sql
- id (SERIAL PRIMARY KEY)
- programa_id (INTEGER FK → programas.id) **NUEVO**
- nombre (TEXT) - Nombre del grupo
- descripcion (TEXT) - Notas específicas del grupo
- profesor_id (UUID FK → perfiles.id)
- dias_semana (TEXT) - Ej: "Lunes, Miércoles"
- hora_inicio (TIME)
- hora_fin (TIME)
- cupos (INTEGER)
- fecha_inicio (DATE) - Inicio de este grupo específico
- fecha_fin (DATE) - Fin estimado
- estado (TEXT)
- ...otros campos
```

### Relaciones
- Un **PROGRAMA** puede tener muchos **GRUPOS**
- Un **GRUPO** pertenece a un **PROGRAMA**
- Los estudiantes se matriculan en **GRUPOS** (tabla `matriculas.curso_id`)

## 🔄 Migración de Datos Existentes

El script `migrations-programas-grupos.sql` realiza automáticamente:

1. ✅ Crea la tabla `programas`
2. ✅ Agrega el campo `programa_id` a la tabla `cursos`
3. ✅ Extrae programas únicos de los cursos existentes (basándose en el nombre)
4. ✅ Vincula cada curso existente con su programa correspondiente

**Para ejecutar:**
1. Abre Supabase SQL Editor
2. Copia y pega el contenido de `migrations-programas-grupos.sql`
3. Ejecuta el script
4. Verifica que los datos se migraron correctamente

## 🖥️ Interfaz de Usuario

### Vista de Programas (`/programas`)
- Tabla con todos los programas académicos
- CRUD completo (Crear, Editar, Eliminar)
- Expandir para ver detalles (descripción, contenido, requisitos)

### Vista de Grupos/Cohortes (`/cursos`)
- Agrupados por programa en paneles expandibles
- Muestra información del programa en el header
- Cohortes organizadas por estado:
  - 🟢 **Activos** - En curso actualmente
  - 🔵 **Próximos** - Pendientes de iniciar
  - ⚫ **Terminados** - Finalizados
- Cada cohorte muestra:
  - Días y horarios
  - Profesor asignado
  - Inscritos / Cupos disponibles
  - Botones de acción (Gestionar, Editar)

## ✨ Beneficios de esta Estructura

1. **Claridad Conceptual**
   - Separa la definición del curso (programa) de sus instancias (grupos)
   - Facilita la gestión de múltiples horarios del mismo curso

2. **Eficiencia**
   - No duplicar información de precio, duración, contenido en cada grupo
   - Cambios en el programa se reflejan automáticamente

3. **Escalabilidad**
   - Fácil agregar nuevos grupos a un programa existente
   - Historial completo de todas las cohortes ofrecidas

4. **Reporting**
   - Estadísticas por programa (total de estudiantes en todas las cohortes)
   - Análisis de demanda por horario
   - Comparación de rendimiento entre grupos

## 📝 Ejemplo Real

### Programa: "Micropigmentación Profesional"
- Duración: 3 meses (120 horas)
- Precio: $2,500,000
- Contenido: Módulo 1 (Teoría del color), Módulo 2 (Técnicas básicas), etc.

### Grupos ofrecidos:
1. **Grupo Mañana Enero 2025**
   - Lunes y Miércoles 9am-12pm
   - Profesora: María García
   - Inicio: 13 enero 2025
   - Cupos: 15 estudiantes

2. **Grupo Fin de Semana**
   - Sábados 2pm-6pm
   - Profesor: Juan Pérez
   - Inicio: 18 enero 2025
   - Cupos: 12 estudiantes

3. **Grupo Nocturno**
   - Martes y Jueves 6pm-9pm
   - Profesora: Ana López
   - Inicio: 20 enero 2025
   - Cupos: 10 estudiantes

**Resultado:** 3 grupos diferentes del mismo programa, cada uno con su propio horario, profesor y estudiantes matriculados.

---

## 🚀 Próximos Pasos

Después de ejecutar la migración:

1. Revisar que los programas se crearon correctamente
2. Verificar que los grupos existentes estén vinculados
3. Crear nuevos grupos usando la interfaz actualizada
4. Ajustar precios o información en el programa (se aplicará a todos los grupos)

## 📞 Soporte

Si tienes dudas sobre la nueva estructura, consulta:
- `migrations-programas-grupos.sql` - Script de migración comentado
- `src/app/programas/page.tsx` - Gestión de programas
- `src/app/cursos/page.tsx` - Visualización de grupos por programa
- `src/app/cursos/create/page.tsx` - Creación de grupos con selector de programa
