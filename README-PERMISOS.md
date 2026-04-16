# Sistema de Permisos por Rol

## Cómo funciona

### Para Profesores

Cuando un profesor inicia sesión:
1. Es automáticamente redirigido a `/mi-oficina`
2. **SOLO puede ver**:
   - Sus propios cursos asignados
   - Los alumnos inscritos en SUS cursos
   - Su historial de grupos
   - Sus pagos de nómina
   - Sus horas trabajadas

### Funcionalidades del Profesor

En "Mi Oficina" el profesor puede:

✅ **Gestionar Clases**:
- Abrir el aula virtual de sus cursos
- Tomar lista de asistencia
- Las horas se registran automáticamente (hora inicio → hora fin)
- Solo puede registrar asistencia de estudiantes que estén al día en pagos

✅ **Calificar Estudiantes**:
- Asignar notas a sus estudiantes
- Solo puede calificar estudiantes al día en pagos
- Envía notificación automática si la nota es baja

✅ **Gestionar Pensum**:
- Ver temas del curso
- Agregar nuevos temas
- Marcar temas vistos en clase

✅ **Ver Pagos**:
- Historial de sus pagos de nómina
- Total de horas trabajadas
- Montos pagados

### Para Administrativos

Los administrativos tienen acceso completo a:
- Dashboard general
- Todos los estudiantes
- Todos los profesores
- Todos los cursos
- Matrículas
- Tesorería
- Nómina
- Inventario
- Configuración

## Seguridad

- ✅ Cada profesor solo ve información de SUS cursos
- ✅ No puede acceder a cursos de otros profesores
- ✅ No puede ver información de otros profesores
- ✅ No puede modificar datos que no le pertenecen
- ✅ Las consultas a Supabase filtran por `profesor_id = usuario_actual`

## Configuración

### Crear un usuario profesor en Supabase:

1. En Supabase Auth, crear el usuario con email/password
2. En la tabla `perfiles`, crear un registro:
   ```sql
   INSERT INTO perfiles (id, nombre_completo, email, rol)
   VALUES (
     '<uuid_del_usuario_auth>', 
     'Nombre del Profesor',
     'profesor@academia.com',
     'profesor'
   );
   ```

3. Asignar cursos al profesor:
   ```sql
   UPDATE cursos 
   SET profesor_id = '<uuid_del_profesor>'
   WHERE id IN (1, 2, 3); -- IDs de los cursos
   ```

### Iniciar sesión como profesor:

1. Ir a `/login`
2. Ingresar credenciales del profesor
3. Será redirigido automáticamente a `/mi-oficina`

## Rutas

- `/mi-oficina` - Panel del profesor (solo sus datos)
- `/profesores/show/[id]` - Vista administrativa de cualquier profesor (acceso administrativo)
- `/` - Dashboard general (acceso administrativo)

## Próximas mejoras

- [ ] Dashboard específico para estudiantes (`/mi-portal`)
- [ ] Middleware para proteger rutas según rol
- [ ] Permisos granulares por recurso
- [ ] Logs de acceso y auditoría
