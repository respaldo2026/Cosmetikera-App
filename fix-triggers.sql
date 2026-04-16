-- ================================================
-- LIMPIAR TRIGGERS INCORRECTOS
-- ================================================
-- Ejecuta PRIMERO este script antes de seed-data.sql
-- ================================================

-- Eliminar triggers de tablas SIN updated_at
DROP TRIGGER IF EXISTS update_perfiles_updated_at ON profesores_info;
DROP TRIGGER IF EXISTS update_perfiles_updated_at ON pagos;
DROP TRIGGER IF EXISTS update_perfiles_updated_at ON temas_curso;
DROP TRIGGER IF EXISTS update_perfiles_updated_at ON sesiones_clase;
DROP TRIGGER IF EXISTS update_perfiles_updated_at ON asistencias;
DROP TRIGGER IF EXISTS update_perfiles_updated_at ON pagos_nomina;
DROP TRIGGER IF EXISTS update_perfiles_updated_at ON pagos_profesores;

-- Asegurar que SOLO las tablas con updated_at tengan el trigger
DROP TRIGGER IF EXISTS update_perfiles_updated_at ON perfiles;
DROP TRIGGER IF EXISTS update_cursos_updated_at ON cursos;
DROP TRIGGER IF EXISTS update_matriculas_updated_at ON matriculas;
DROP TRIGGER IF EXISTS update_configuracion_updated_at ON configuracion;
DROP TRIGGER IF EXISTS update_inventario_updated_at ON inventario;

-- Recrear triggers SOLO en tablas correctas
CREATE TRIGGER update_perfiles_updated_at
  BEFORE UPDATE ON perfiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cursos_updated_at
  BEFORE UPDATE ON cursos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matriculas_updated_at
  BEFORE UPDATE ON matriculas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_configuracion_updated_at
  BEFORE UPDATE ON configuracion
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventario_updated_at
  BEFORE UPDATE ON inventario
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- Ahora puedes ejecutar seed-data.sql sin errores
-- ================================================
