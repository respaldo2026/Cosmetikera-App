-- Actualizar duración del curso Artista Integral en Uñas a 5 ciclos
UPDATE cursos 
SET duracion = 5 
WHERE nombre = 'Artista Integral en Uñas - Lun';

-- Verificar que se actualizó
SELECT id, nombre, duracion FROM cursos WHERE nombre = 'Artista Integral en Uñas - Lun';
