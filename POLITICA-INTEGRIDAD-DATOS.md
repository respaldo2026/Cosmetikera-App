# 🔐 Política de Integridad de Datos - Academia Crystal

## Eliminación de Cursos

### ❌ ¿Qué NO se puede hacer?
**No se puede eliminar un curso si contiene:**
- ✗ Matrículas activas o inactivas (estudiantes inscritos)
- ✗ Pagos realizados (historial financiero)
- ✗ Sesiones de clase registradas (horas laboradas del profesor)
- ✗ Asistencias o calificaciones

**¿Por qué?** Para evitar perder historial académico y financiero que es necesario para auditoría y reportes.

### ✅ ¿Qué SÍ se puede hacer?

#### Opción 1: Cambiar estado a "Finalizado"
**Ideal cuando el curso ya terminó:**
1. Edita el curso
2. Cambia estado a **"Finalizado"** o **"Cerrado"**
3. El curso desaparece de listas activas pero conserva TODO el historial
4. Puedes seguir viendo matrículas, pagos y notas históricamente

#### Opción 2: Eliminar solo cursos sin datos
**Solo funciona si:**
- El curso está COMPLETAMENTE vacío (sin estudiantes)
- No hay pagos registrados
- No hay sesiones de clase
- No hay asistencias ni calificaciones

**Pasos:**
1. Edita el curso
2. Haz clic en "Eliminar Curso" (botón rojo)
3. Si el sistema te muestra un aviso, significa que hay datos
4. Si se permite eliminar, confirma la acción

### 📋 Flujo de datos preservados

Cuando **archivas** un curso (en lugar de eliminarlo):

```
✅ PRESERVADO:
├─ Matrículas del estudiante (histórico de inscripción)
├─ Pagos realizados (auditoría financiera)
├─ Sesiones de clase (horas trabajadas del profesor)
├─ Asistencias (historial de asistencia)
├─ Calificaciones (notas finales)
└─ Certificados generados

❌ ELIMINADO:
└─ Acceso del estudiante al portal del curso (no aparece en activos)
```

### 🎓 Caso de uso: Corrección de errores

**Si creaste un curso por error y quieres eliminarlo:**

1. **Si no has inscrito estudiantes:**
   - Haz clic en "Editar" → "Eliminar Curso" → Confirma
   - ✅ Se elimina sin problemas

2. **Si ya hay estudiantes inscritos:**
   - Opción A: Cambiar estado a "Finalizado" y dejarlos inscritos
   - Opción B: Cancelar todas las matrículas primero
   - Opción C: Contactar administración para auditoría manual

### ⚠️ Notas importantes

- **Cambiar estado es lo seguro**: Siempre que dudes, cambia el estado a "Finalizado"
- **Los estudiantes aún verán el curso**: En su historial académico
- **Los reportes incluirán el curso**: Será parte del historial permanente
- **No se puede deshacer**: Una vez eliminado, solo se recupera desde backup

### 📞 Dudas o excepciones

Si necesitas eliminar un curso con datos por una razón válida:
1. Documenta la razón
2. Contacta al administrador del sistema
3. Se revisarán los datos antes de proceder
