-- Script para unificar "Artista en uñas" con "Artista Integral en Uñas"
-- Mueve el pensum al programa correcto y elimina el duplicado

DO $$
DECLARE
    v_programa_correcto_id INTEGER; -- El que ya tenía estudiantes (Artista Integral...)
    v_programa_duplicado_id INTEGER; -- El que se creó nuevo (Artista en uñas)
BEGIN
    -- 1. Buscar los IDs por nombre exacto
    SELECT id INTO v_programa_correcto_id FROM programas WHERE nombre = 'Artista Integral en Uñas' LIMIT 1;
    SELECT id INTO v_programa_duplicado_id FROM programas WHERE nombre = 'Artista en uñas' LIMIT 1;

    -- 2. Validar que existan ambos para proceder
    IF v_programa_correcto_id IS NOT NULL AND v_programa_duplicado_id IS NOT NULL THEN
        
        RAISE NOTICE 'Procesando unificación: Duplicado ID % -> Correcto ID %', v_programa_duplicado_id, v_programa_correcto_id;

        -- 3. Mover SOLO los ciclos que NO existen en el programa correcto
        -- Esto evita el error de llave duplicada (duplicate key value violates unique constraint)
        UPDATE pensum 
        SET programa_id = v_programa_correcto_id 
        WHERE programa_id = v_programa_duplicado_id
        AND numero_ciclo NOT IN (
            SELECT numero_ciclo FROM pensum WHERE programa_id = v_programa_correcto_id
        );

        -- 4. Eliminar el programa duplicado
        -- Los ciclos restantes en el duplicado (que ya existían en el correcto) se eliminarán en cascada
        DELETE FROM programas WHERE id = v_programa_duplicado_id;
        
        RAISE NOTICE '¡Éxito! Programa duplicado eliminado y pensum unificado.';
        
    ELSE
        RAISE NOTICE 'No se requiere acción: No se encontraron ambos programas simultáneamente.';
        RAISE NOTICE 'ID Correcto: %, ID Duplicado: %', v_programa_correcto_id, v_programa_duplicado_id;
    END IF;
END $$;