-- Actualiza o crea la plantilla de WhatsApp para la bienvenida al portal del estudiante
-- Ejecutar en Supabase (SQL editor) antes de habilitar el flujo en producción

INSERT INTO plantillas_whatsapp (nombre, descripcion, plantilla, variables, activa)
VALUES (
    'bienvenida_portal_estudiante',
    'Bienvenida al portal con credenciales iniciales',
    'Hola {{nombre}}, ¡bienvenida al Curso: {{curso}}!\n\n*Ya puedes ingresar a la app:* {{enlace_portal}}\n\n*Usuario*: {{usuario}}\n\n*En la app podrás ver:*\n• Asistencias\n• Notas\n• Material didáctico\n• Materiales necesarios por clase',
    ARRAY['nombre', 'curso', 'enlace_portal', 'usuario'],
    true
)
ON CONFLICT (nombre) DO UPDATE SET
    descripcion = EXCLUDED.descripcion,
    plantilla = EXCLUDED.plantilla,
    variables = EXCLUDED.variables,
    activa = true,
    updated_at = NOW();