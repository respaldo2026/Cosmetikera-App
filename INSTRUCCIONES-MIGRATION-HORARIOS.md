# ⚠️ IMPORTANTE: Ejecutar Migration en Supabase

El código fue actualizado para soportar horarios de cursos, pero **la tabla necesita estas columnas nuevas**.

## Paso a Paso:

### 1. Abre Supabase Console
- Ve a: https://supabase.com/dashboard
- Selecciona tu proyecto `academia-crystal`

### 2. Ve a SQL Editor
- Click en **SQL Editor** (menú lateral izquierdo)

### 3. Copia este SQL:

```sql
-- Add schedule fields to cursos table
ALTER TABLE cursos 
ADD COLUMN IF NOT EXISTS dias_semana TEXT,
ADD COLUMN IF NOT EXISTS hora_inicio TIME,
ADD COLUMN IF NOT EXISTS hora_fin TIME;

-- Set default values
UPDATE cursos SET 
  dias_semana = COALESCE(dias_semana, 'Lunes, Miércoles, Viernes'),
  hora_inicio = COALESCE(hora_inicio, '09:00:00'::TIME),
  hora_fin = COALESCE(hora_fin, '10:30:00'::TIME)
WHERE dias_semana IS NULL OR hora_inicio IS NULL OR hora_fin IS NULL;

-- Create index for better performance on estado queries
CREATE INDEX IF NOT EXISTS idx_cursos_estado ON cursos(estado);
```

### 4. Ejecuta el SQL
- Pega el código en el editor
- Haz click en **RUN** (botón azul abajo a la derecha)

## ✅ Resultado esperado:
- Las 3 columnas nuevas aparecerán en la tabla `cursos`
- Todos los cursos existentes tendrán valores por defecto
- Se creará un índice para mejorar performance

## 🔍 Verificación:
Si quieres verificar que funcionó, puedes ejecutar:
```sql
SELECT id, nombre, dias_semana, hora_inicio, hora_fin FROM cursos LIMIT 1;
```

Deberías ver las columnas con sus valores.

---

**Nota**: Sin ejecutar esta migration, el formulario de editar cursos no funcionará correctamente.
