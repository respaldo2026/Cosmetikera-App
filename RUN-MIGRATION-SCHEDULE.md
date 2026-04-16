# Ejecutar Migration de Horarios en Supabase

## Pasos:

1. Abre el **Supabase Console** de tu proyecto
   - Ve a: https://supabase.com/dashboard
   - Selecciona tu proyecto

2. Ve a **SQL Editor** en el menú lateral

3. Copia y ejecuta este SQL:

```sql
-- Add schedule fields to cursos table
ALTER TABLE cursos 
ADD COLUMN IF NOT EXISTS dias_semana TEXT DEFAULT 'Lunes, Miércoles, Viernes' COMMENT 'Días de la semana en que se dicta (ej: Lunes, Miércoles, Viernes)',
ADD COLUMN IF NOT EXISTS hora_inicio TIME DEFAULT '09:00:00' COMMENT 'Hora de inicio de la clase',
ADD COLUMN IF NOT EXISTS hora_fin TIME DEFAULT '10:30:00' COMMENT 'Hora de finalización de la clase';

-- Create index for better performance on estado queries
CREATE INDEX IF NOT EXISTS idx_cursos_estado ON cursos(estado);
```

4. Haz clic en **RUN** (botón azul)

## Resultado Esperado:
- ✅ Tres columnas nuevas en la tabla `cursos`
- ✅ Un índice nuevo para mejorar queries por estado

## Campos Añadidos:
- **dias_semana**: TEXT - Días de la semana (default: "Lunes, Miércoles, Viernes")
- **hora_inicio**: TIME - Hora de inicio (default: "09:00:00")
- **hora_fin**: TIME - Hora de finalización (default: "10:30:00")

## Cambios en la App:
✅ Página de cursos muestra estudiantes inscritos, días y horarios
✅ Formularios create/edit ahora permiten editar horarios
✅ Matriculas muestra conteos correctos de Activos, Graduados y Desertores
