# Portal de Estudiante - Instrucciones de Configuración

## 📋 Pasos para Implementar

### 1. Ejecutar Migración en Supabase

Copia el contenido del archivo `migrations-student-portal.sql` y ejecútalo en **Supabase SQL Editor**:

1. Ve a [Supabase Dashboard](https://supabase.com)
2. Selecciona tu proyecto
3. Ve a **SQL Editor**
4. Crea una nueva consulta
5. Copia todo el contenido de `migrations-student-portal.sql`
6. Ejecuta la consulta

**Esto creará:**
- Tabla `calificaciones` (estudiante → tema → calificación)
- Tabla `notificaciones` (para historial de avisos)
- Columnas nuevas en `perfiles`: `activo`, `fecha_baja`, `motivo_baja`, `foto_url`, `notif_whatsapp`
- Índices para mejor rendimiento
- Políticas RLS

### 2. Cargar Datos de Ejemplo (Opcional)

Si quieres probar con datos, descomenta el SQL de ejemplo al final de `migrations-student-portal.sql`

### 3. Acceder al Portal

El portal está disponible en:
```
http://localhost:3000/portal-estudiante
```

## 🎯 Funcionalidades del Portal

### 📊 Pestaña: Asistencia
- Ver todas las asistencias registradas
- Filtrado por curso
- Estadísticas: Total de clases, Presentes, Ausentes

### 📝 Pestaña: Calificaciones
- Ver todas las notas por evaluación
- Tipo de evaluación (examen, quiz, taller, etc.)
- Fecha de evaluación

### 📈 Pestaña: Avance
- Progreso de cada curso (círculo con %)
- Calificación actual
- Visual de progreso

### 🏆 Pestaña: Certificados
- Descargar diploma de cursos completados
- Solo aparecen cursos con nota ≥ 70
- PDF con fecha y calificación

### 💬 WhatsApp
- Botón para contactar directamente
- Mensajes personalizados
- Integrado en header del portal

## 🔧 Estructura de Base de Datos

### Tabla: calificaciones
```sql
- id (PK)
- matricula_id (FK → matriculas)
- tema_id (FK → temas_curso)
- calificacion (0-100)
- tipo_evaluacion (taller, quiz, examen, participacion, otro)
- fecha_evaluacion
- observaciones
- created_at, updated_at
```

### Tabla: notificaciones
```sql
- id (PK)
- perfil_id (FK → perfiles)
- tipo (asistencia, calificacion, aviso, certificado)
- mensaje
- enviado (boolean)
- fecha_creacion, fecha_envio
```

### Columnas nuevas en perfiles
```sql
- activo (boolean, default: true) - soft delete
- fecha_baja (timestamp)
- motivo_baja (text)
- foto_url (text) - para avatar
- notif_whatsapp (boolean, default: true) - preferencia de notificaciones
```

## 🚀 Próximas Mejoras

- [x] Descarga de certificado en PDF
- [x] Notificaciones automáticas por WhatsApp (bajas notas, ausencias)
- [ ] Chat en tiempo real con profesor
- [ ] Tareas y entregas
- [ ] Calendario de clases

## 📱 Integración WhatsApp

El portal usa la función `enviarWhatsapp()` que está configurada en `src/utils/whatsapp.ts`.

Para enviar notificaciones automáticas:
1. Verificar que `notif_whatsapp = true` en perfil del estudiante
2. Llamar a `enviarWhatsapp(telefono, mensaje)` en eventos (nueva calificación, ausencia, etc.)

### Ejemplo:
```typescript
import { enviarWhatsapp } from "@utils/whatsapp";

// Cuando se registra una calificación baja
if (calificacion < 70) {
  await enviarWhatsapp(
    estudiante.telefono,
    `Hola ${estudiante.nombre}, obtuviste una calificación de ${calificacion} en ${curso.nombre}. Contacta a tu profesor para apoyo.`
  );
}
```

## ⚠️ Notas Importantes

1. **Autenticación**: El portal obtiene el estudiante del usuario autenticado (`auth.getUser()`)
2. **Permisos**: Asegúrate de que los estudiantes tengan rol `"estudiante"` en la tabla `perfiles`
3. **Datos**: Las asistencias y calificaciones deben ser registradas por profesores en sus dashboards
4. **Horarios**: Las clases son registradas por profesores en profesores/show/[id]

## 🐛 Troubleshooting

### El portal no carga datos
- Verifica que hayas ejecutado la migración SQL
- Comprueba que estés autenticado
- Revisa la consola del navegador (F12) para errores

### Las asistencias no aparecen
- Asegúrate de que el profesor haya registrado asistencias
- Verifica que la matrícula esté activa (`estado = 'activo'`)
- Comprueba en Supabase que los datos existan

### El botón WhatsApp no funciona
- Verifica que el estudiante tenga teléfono registrado
- Comprueba que `enviarWhatsapp()` esté correctamente configurado
- Revisa logs de Supabase para errores

## 📞 Soporte

Para preguntas o problemas, contacta al equipo de desarrollo.
