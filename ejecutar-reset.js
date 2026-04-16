// Script para ejecutar el reset de datos en Supabase
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Faltan las credenciales de Supabase en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function ejecutarReset() {
  console.log('🚀 Iniciando reset de datos...\n');

  try {
    // PASO 1: Eliminar datos existentes
    console.log('🗑️  Eliminando datos existentes...');
    
    console.log('   - Eliminando calificaciones...');
    await supabase.from('calificaciones').delete().neq('id', 0);
    
    console.log('   - Eliminando asistencias...');
    await supabase.from('asistencias').delete().neq('id', 0);
    
    console.log('   - Eliminando pagos...');
    await supabase.from('pagos').delete().neq('id', 0);
    
      console.log('   - Eliminando sesiones_clase...');
      await supabase.from('sesiones_clase').delete().neq('id', 0);
    
    console.log('   - Eliminando matrículas...');
    await supabase.from('matriculas').delete().neq('id', 0);
    
    console.log('   - Eliminando cursos...');
    await supabase.from('cursos').delete().neq('id', 0);
    
    console.log('   - Eliminando programas...');
    await supabase.from('programas').delete().neq('id', 0);
    
    console.log('   - Eliminando perfiles (estudiantes y profesores)...');
    await supabase.from('perfiles').delete().in('rol', ['estudiante', 'profesor']);
    
    console.log('✅ Datos eliminados correctamente\n');

    // PASO 2: Crear programas (nivel superior)
    console.log('📚 Creando programas...');
    const { data: programas, error: errorProgramas } = await supabase
      .from('programas')
      .insert([
        {
          nombre: 'Artista Integral en Uñas',
          descripcion: 'Programa integral de manicure, pedicure, diseño de uñas y técnicas avanzadas de nail art',
          duracion: '4 meses',
          duracion_horas: 192,
          precio: 1400000,
          precio_inscripcion: 0,
          precio_mensualidad: 350000,
          activo: true,
        },
        {
          nombre: 'Miradas Perfectas',
          descripcion: 'Diseño y aplicación de pestañas, cejas perfectas, laminado de cejas y pestañas',
          duracion: '3 meses',
          duracion_horas: 144,
          precio: 900000,
          precio_inscripcion: 0,
          precio_mensualidad: 300000,
          activo: true,
        },
        {
          nombre: 'Maquillaje Profesional',
          descripcion: 'Maquillaje social, artístico, caracterización, técnicas de contorno, color y estilos para eventos',
          duracion: '3 meses',
          duracion_horas: 144,
          precio: 960000,
          precio_inscripcion: 0,
          precio_mensualidad: 320000,
          activo: true,
        }
      ])
      .select();

    if (errorProgramas) throw errorProgramas;
    console.log(`✅ ${programas.length} programas creados\n`);

    // PASO 3: Crear cursos (grupos) vinculados a programas
    console.log('🧩 Creando grupos/cohortes vinculados a programas...');
    const idPorNombre = new Map(programas.map(p => [p.nombre, p.id]));
    const { data: cursos, error: errorCursos } = await supabase
      .from('cursos')
      .insert([
        {
          nombre: 'Artista Integral en Uñas',
          descripcion: 'Curso completo de manicure, pedicure, diseño de uñas, técnicas avanzadas de nail art y gestión de negocio de belleza',
          duracion: '4 meses',
          duracion_horas: 192,
          precio_mensualidad: 350000,
          precio: 1400000,
          total_clases: 48,
          porcentaje_minimo: 80,
          estado: 'activo',
          programa_id: idPorNombre.get('Artista Integral en Uñas')
        },
        {
          nombre: 'Miradas Perfectas',
          descripcion: 'Técnicas profesionales de diseño y aplicación de pestañas, cejas perfectas, laminado de cejas y pestañas',
          duracion: '3 meses',
          duracion_horas: 144,
          precio_mensualidad: 300000,
          precio: 900000,
          total_clases: 36,
          porcentaje_minimo: 80,
          estado: 'activo',
          programa_id: idPorNombre.get('Miradas Perfectas')
        },
        {
          nombre: 'Maquillaje Profesional',
          descripcion: 'Maquillaje social, artístico, caracterización, técnicas de contorno, color y estilos para eventos',
          duracion: '3 meses',
          duracion_horas: 144,
          precio_mensualidad: 320000,
          precio: 960000,
          total_clases: 36,
          porcentaje_minimo: 80,
          estado: 'activo',
          programa_id: idPorNombre.get('Maquillaje Profesional')
        }
      ])
      .select();

    if (errorCursos) throw errorCursos;
    console.log(`✅ ${cursos.length} grupos/cohortes creados\n`);

    // PASO 3: Crear profesores
    console.log('👩‍🏫 Creando profesores...');
    const { data: profesores, error: errorProfesores } = await supabase
      .from('perfiles')
      .insert([
        {
          nombre_completo: 'Martha Cristina Rodríguez',
          email: 'martha.rodriguez@academia-crystal.com',
          telefono: '3201234567',
          direccion: 'Calle 45 #23-10, Bogotá',
          fecha_nacimiento: '1985-03-15',
          identificacion: '52345678',
          rol: 'profesor'
        },
        {
          nombre_completo: 'Diana Carolina López',
          email: 'diana.lopez@academia-crystal.com',
          telefono: '3109876543',
          direccion: 'Carrera 30 #12-45, Bogotá',
          fecha_nacimiento: '1990-07-22',
          identificacion: '52876543',
          rol: 'profesor'
        },
        {
          nombre_completo: 'Laura Marcela Gómez',
          email: 'laura.gomez@academia-crystal.com',
          telefono: '3156543210',
          direccion: 'Avenida 68 #80-23, Bogotá',
          fecha_nacimiento: '1988-11-08',
          identificacion: '52543210',
          rol: 'profesor'
        }
      ])
      .select();

    if (errorProfesores) throw errorProfesores;
    console.log(`✅ ${profesores.length} profesores creados\n`);

    // PASO 4: Crear estudiantes
    console.log('👩‍🎓 Creando estudiantes...');
    const { data: estudiantes, error: errorEstudiantes } = await supabase
      .from('perfiles')
      .insert([
        {
          nombre_completo: 'Valentina Martínez Pérez',
          email: 'valentina.martinez@email.com',
          telefono: '3001234567',
          direccion: 'Calle 80 #15-20, Bogotá',
          fecha_nacimiento: '2000-05-10',
          identificacion: '1001234567',
          rol: 'estudiante'
        },
        {
          nombre_completo: 'Camila Andrea Torres',
          email: 'camila.torres@email.com',
          telefono: '3112345678',
          direccion: 'Carrera 15 #45-67, Bogotá',
          fecha_nacimiento: '1999-08-25',
          identificacion: '1002345678',
          rol: 'estudiante'
        },
        {
          nombre_completo: 'Sara Juliana Ramírez',
          email: 'sara.ramirez@email.com',
          telefono: '3123456789',
          direccion: 'Calle 127 #9-34, Bogotá',
          fecha_nacimiento: '2001-02-14',
          identificacion: '1003456789',
          rol: 'estudiante'
        },
        {
          nombre_completo: 'María Fernanda Castro',
          email: 'maria.castro@email.com',
          telefono: '3134567890',
          direccion: 'Avenida 19 #104-25, Bogotá',
          fecha_nacimiento: '1998-11-30',
          identificacion: '1004567890',
          rol: 'estudiante'
        },
        {
          nombre_completo: 'Daniela Sofia Moreno',
          email: 'daniela.moreno@email.com',
          telefono: '3145678901',
          direccion: 'Transversal 23 #56-12, Bogotá',
          fecha_nacimiento: '2002-06-18',
          identificacion: '1005678901',
          rol: 'estudiante'
        },
        {
          nombre_completo: 'Isabella Alejandra Vargas',
          email: 'isabella.vargas@email.com',
          telefono: '3156789012',
          direccion: 'Diagonal 40 #28-90, Bogotá',
          fecha_nacimiento: '1997-09-05',
          identificacion: '1006789012',
          rol: 'estudiante'
        }
      ])
      .select();

    if (errorEstudiantes) throw errorEstudiantes;
    console.log(`✅ ${estudiantes.length} estudiantes creados\n`);

    // RESUMEN FINAL
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ RESET COMPLETADO EXITOSAMENTE\n');
    console.log('📊 RESUMEN:');
    console.log(`   • Programas: ${programas.length}`);
    console.log(`   • Grupos/Cursos: ${cursos.length}`);
    console.log(`   • Profesores: ${profesores.length}`);
    console.log(`   • Estudiantes: ${estudiantes.length}`);
    console.log('\n📚 PROGRAMAS CREADOS:');
    programas.forEach(p => console.log(`   • ${p.nombre} ($${(p.precio_mensualidad||0).toLocaleString()} mensualidad)`));
    console.log('\n🧩 GRUPOS/CURSOS CREADOS:');
    cursos.forEach(c => console.log(`   • ${c.nombre} (Programa: ${programas.find(p=>p.id===c.programa_id)?.nombre || 'N/A'})`));
    console.log('\n👩‍🏫 PROFESORES CREADOS:');
    profesores.forEach(p => console.log(`   • ${p.nombre_completo}`));
    console.log('\n👩‍🎓 ESTUDIANTES CREADOS:');
    estudiantes.forEach(e => console.log(`   • ${e.nombre_completo} (CC: ${e.identificacion})`));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error durante el reset:', error);
    process.exit(1);
  }
}

ejecutarReset();
