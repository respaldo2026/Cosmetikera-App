-- Carga masiva: Quiz de Bioseguridad (25 preguntas)
-- Requisito de aprobación: MÁS de 75% (ya aplicado en la app)
--
-- PASOS:
-- 1) Reemplaza el UUID de v_pensum_curso_id por el ID real del tema/clase "Bioseguridad".
-- 2) Ejecuta este script en Supabase SQL Editor.

DO $$
DECLARE
  v_pensum_curso_id uuid := null;
  v_nombre_tema text := 'bioseguridad';
  v_pensum_id uuid;
  v_programa_id bigint;
  v_quiz_id uuid;
BEGIN
  IF v_pensum_curso_id IS NOT NULL THEN
    SELECT pc.id, pc.pensum_id, p.programa_id
      INTO v_pensum_curso_id, v_pensum_id, v_programa_id
    FROM public.pensum_cursos pc
    JOIN public.pensum p ON p.id = pc.pensum_id
    WHERE pc.id = v_pensum_curso_id;
  ELSE
    SELECT pc.id, pc.pensum_id, p.programa_id
      INTO v_pensum_curso_id, v_pensum_id, v_programa_id
    FROM public.pensum_cursos pc
    JOIN public.pensum p ON p.id = pc.pensum_id
    WHERE lower(coalesce(pc.nombre_curso, '')) LIKE '%' || lower(v_nombre_tema) || '%'
    ORDER BY pc.id DESC
    LIMIT 1;
  END IF;

  IF v_pensum_curso_id IS NULL OR v_pensum_id IS NULL OR v_programa_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró tema/clase para "%". Define v_pensum_curso_id manualmente o verifica el nombre.', v_nombre_tema;
  END IF;

  INSERT INTO public.quizzes_clase (
    programa_id,
    pensum_id,
    pensum_curso_id,
    titulo,
    descripcion,
    total_preguntas,
    activo,
    publicado
  ) VALUES (
    v_programa_id,
    v_pensum_id,
    v_pensum_curso_id,
    'Quiz de Bioseguridad',
    'Cuestionario oficial de bioseguridad (25 preguntas). Aprobación: más de 75%.',
    25,
    true,
    true
  )
  ON CONFLICT (pensum_curso_id)
  DO UPDATE SET
    programa_id = EXCLUDED.programa_id,
    pensum_id = EXCLUDED.pensum_id,
    titulo = EXCLUDED.titulo,
    descripcion = EXCLUDED.descripcion,
    total_preguntas = EXCLUDED.total_preguntas,
    activo = EXCLUDED.activo,
    publicado = EXCLUDED.publicado,
    updated_at = now()
  RETURNING id INTO v_quiz_id;

  DELETE FROM public.quiz_preguntas_clase
  WHERE quiz_id = v_quiz_id;

  INSERT INTO public.quiz_preguntas_clase (
    quiz_id,
    orden,
    pregunta,
    opcion_a,
    opcion_b,
    opcion_c,
    opcion_d,
    respuesta_correcta,
    activo
  ) VALUES
  (
    v_quiz_id,
    1,
    'Según el Módulo 1, ¿qué es la bioseguridad para una profesional de la estética?',
    'Una opción recomendada por los salones.',
    'Una sugerencia para mejorar el servicio.',
    'Un compromiso ético y legal adquirido desde el primer día de formación.',
    'Un protocolo exclusivo para hospitales.',
    'C',
    true
  ),
  (
    v_quiz_id,
    2,
    'En la anatomía de la mano, ¿qué consecuencia puede tener la presión excesiva con fresa sobre la falange distal?',
    'Crecimiento acelerado de la uña.',
    'Periostitis.',
    'Parestesias.',
    'Sangrado pulsátil.',
    'B',
    true
  ),
  (
    v_quiz_id,
    3,
    '¿Qué complicación puede generar una laceración accidental en los tendones extensores de la falange distal?',
    'Deformidad en dedo en martillo.',
    'Verrugas periungueales.',
    'Onicomicosis.',
    'Paroniquia.',
    'A',
    true
  ),
  (
    v_quiz_id,
    4,
    'En la red vascular digital, ¿qué puede generar un corte profundo que active el protocolo de accidente biológico?',
    'Daño axonal permanente.',
    'Sangrado pulsátil.',
    'Desprendimiento de la placa ungueal.',
    'Infección por Pseudomonas.',
    'B',
    true
  ),
  (
    v_quiz_id,
    5,
    '¿Qué parte de la uña se describe como el tejido rosado debajo de la placa que la nutre y cuyo color indica su estado de salud?',
    'Matriz ungueal.',
    'Eponiquio.',
    'Lecho ungueal.',
    'Hiponiquio.',
    'C',
    true
  ),
  (
    v_quiz_id,
    6,
    '¿Qué función cumple el hiponiquio en la anatomía de la uña humana?',
    'Es donde nace la uña.',
    'Es la membrana fina sobre la placa.',
    'Es un sello natural bajo la punta de la uña y barrera clave contra hongos y bacterias.',
    'Es la lámina dura de queratina que crece 3 mm por mes.',
    'C',
    true
  ),
  (
    v_quiz_id,
    7,
    '¿Cuánto tiempo tarda aproximadamente la uña en crecer completamente desde la matriz hasta el borde libre?',
    'De 1 a 2 semanas.',
    'De 1 a 2 meses.',
    'De 4 a 6 meses.',
    'De 10 a 12 meses.',
    'C',
    true
  ),
  (
    v_quiz_id,
    8,
    'Ante signos de alerta como enrojecimiento, supuración o dolor en la placa ungueal, ¿cuál es el protocolo de acción a seguir?',
    'Continuar el servicio con precaución.',
    'Aplicar alcohol al 70% y seguir trabajando.',
    'Suspender el servicio inmediatamente, informar al cliente y referir a valoración dermatológica.',
    'Cortar la zona afectada y aplicar acrílico.',
    'C',
    true
  ),
  (
    v_quiz_id,
    9,
    '¿Cuál es el principal vector de transmisión de enfermedades como la Hepatitis B, C y VIH en el salón de uñas?',
    'El aire del salón.',
    'Instrumental contaminado (limas, alicates, fresas) que no ha sido esterilizado.',
    'Contacto piel a piel.',
    'El polvo de uña.',
    'B',
    true
  ),
  (
    v_quiz_id,
    10,
    '¿Qué nivel de riesgo representa el instrumental cortopunzante o el contacto con sangre, y qué procedimiento requiere?',
    'Riesgo Bajo / Requiere ventilación.',
    'Riesgo Medio / Requiere limpieza con agua y jabón.',
    'Riesgo Alto / Requiere esterilización en autoclave.',
    'Riesgo Alto / Requiere inmersión en detergente enzimático.',
    'C',
    true
  ),
  (
    v_quiz_id,
    11,
    '¿Qué microorganismo causa verrugas alrededor de las uñas y se transmite por contacto directo con instrumental o superficies contaminadas?',
    'Virus del Papiloma Humano (VPH).',
    'Staphylococcus aureus.',
    'Dermatofitos.',
    'Poxvirus.',
    'A',
    true
  ),
  (
    v_quiz_id,
    12,
    '¿Qué infección fúngica destruye la placa ungueal, volviéndola amarilla, gruesa y quebradiza?',
    'Pseudomonas aeruginosa.',
    'Candida albicans.',
    'Onicomicosis (causada por dermatofitos del género Trichophyton).',
    'Sarcoptes scabiei.',
    'C',
    true
  ),
  (
    v_quiz_id,
    13,
    '¿Cuánto tiempo puede sobrevivir el virus de la Hepatitis B en superficies secas a temperatura ambiente?',
    'Hasta 2 horas.',
    'Hasta 24 horas.',
    'Hasta 7 días.',
    'Hasta 7 meses.',
    'C',
    true
  ),
  (
    v_quiz_id,
    14,
    '¿Qué condición clínica se manifiesta por una coloración verde-negra causada por bacterias en espacios húmedos?',
    'Leuconiquia.',
    'Mancha Verde (Pseudomonas aeruginosa).',
    'Melanoniquia.',
    'Panadizo Herpético.',
    'B',
    true
  ),
  (
    v_quiz_id,
    15,
    '¿Qué enfermedad ungueal se caracteriza por la penetración del borde lateral de la uña en el tejido blando periférico y es contraindicación absoluta para servicios estéticos?',
    'Onicolisis.',
    'Psoriasis ungueal.',
    'Onicocriptosis (Uña Encarnada).',
    'Paroniquia.',
    'C',
    true
  ),
  (
    v_quiz_id,
    16,
    'Según el cuadro de agentes químicos, ¿cuál es el mecanismo de acción de los detergentes enzimáticos?',
    'Destruir esporas y virus.',
    'Desnaturalizar proteínas celulares.',
    'Degradación de materia orgánica (sangre, tejido) facilitando la limpieza mecánica.',
    'Esterilización de instrumental cortopunzante.',
    'C',
    true
  ),
  (
    v_quiz_id,
    17,
    '¿Cuál es el único agente químico mencionado capaz de destruir todas las formas de vida microbiana, incluyendo esporas?',
    'Alcohol al 70%.',
    'Amonio Cuaternario de 5ta Generación.',
    'Glutaraldehído al 2% o superior.',
    'Detergente enzimático.',
    'C',
    true
  ),
  (
    v_quiz_id,
    18,
    'En el Protocolo Operativo Estandarizado (POE), ¿cuál es la Fase 1 innegociable del procesamiento del instrumental?',
    'Esterilización térmica.',
    'Limpieza por Arrastre Mecánico.',
    'Desinfección química.',
    'Empacado en bolsas de grado médico.',
    'B',
    true
  ),
  (
    v_quiz_id,
    19,
    '¿Cuál es el tiempo de inmersión recomendado para la solución de detergente enzimático en la fase de limpieza?',
    '1 a 5 minutos.',
    '10 a 15 minutos.',
    '30 minutos.',
    '8 a 10 horas.',
    'B',
    true
  ),
  (
    v_quiz_id,
    20,
    'En la esterilización térmica por Autoclave (Vapor a Presión), ¿cuáles son los parámetros de temperatura y tiempo requeridos?',
    '170 °C por 60 minutos.',
    '121 °C por 15-20 minutos.',
    '100 °C por 30 minutos.',
    '200 °C por 10 minutos.',
    'B',
    true
  ),
  (
    v_quiz_id,
    21,
    '¿Qué temperatura y tiempo se requieren para esterilizar instrumental en una Estufa de Calor Seco?',
    '121 °C por 15 minutos.',
    '100 °C por 30 minutos.',
    '170 °C por 60 minutos.',
    '200 °C por 10 minutos.',
    'C',
    true
  ),
  (
    v_quiz_id,
    22,
    '¿Cómo deben procesarse los materiales de uso único como las limas de cartón y los palitos de naranjo?',
    'Esterilizarlos en autoclave.',
    'Sumergirlos en Glutaraldehído por 10 horas.',
    'Descartarlos inmediatamente después de cada servicio, sin reutilizarlos.',
    'Lavarlos con agua y jabón para el siguiente cliente.',
    'C',
    true
  ),
  (
    v_quiz_id,
    23,
    '¿En qué tipo de contenedor deben depositarse de forma obligatoria las agujas, cuchillas y material cortante desechable?',
    'Bolsa negra.',
    'Bolsa roja.',
    'Guardián (Contenedores rígidos para residuos cortopunzantes).',
    'Basurero común.',
    'C',
    true
  ),
  (
    v_quiz_id,
    24,
    'Los residuos contaminados como guantes usados, gasas o algodones con sangre deben clasificarse y desecharse en:',
    'Bolsa negra.',
    'Bolsa roja.',
    'Guardián.',
    'Recipiente de vidrio.',
    'B',
    true
  ),
  (
    v_quiz_id,
    25,
    'En el protocolo de accidente biológico, ¿qué acción específica se debe realizar de inmediato en el Paso 2?',
    'Exprimir la herida y aplicar alcohol directamente.',
    'Aplicar povidona yodada y cubrir.',
    'Lavar la zona con agua y jabón antiséptico durante mínimo 5 minutos.',
    'Acudir a urgencias médicas.',
    'C',
    true
  );

  RAISE NOTICE 'Quiz cargado correctamente. quiz_id=%', v_quiz_id;
END $$;
