# 🚀 INTEGRACIONES WHATSAPP - PASO A PASO

**Status**: ✅ API funcionando | ✅ Database lista | ✅ Módulo compilado

---

## 📍 PUNTO 1: DESPUÉS DE INSCRIPCIÓN (Confirmación)

**Ubicación**: `src/app/matriculas/create/page.tsx` línea 452

**Archivo actual ya tiene código similar, pero aquí está la versión mejorada:**

### Busca esta sección (línea ~452):
```tsx
if (estudiante?.telefono && (estudiante?.notif_whatsapp ?? true)) {
    await enviarWhatsappConPlantilla(
        estudiante.telefono,
        'inscripcion_academica',
        {
            nombre: estudiante.nombre_completo,
            curso: matricula?.cursos?.nombre ?? "Curso"
        }
    );
}
```

### Reemplázalo por esto (para usar la nueva plantilla):
```tsx
if (estudiante?.telefono && (estudiante?.notif_whatsapp ?? true)) {
    try {
        const { enviarConfirmacionInscripcion } = await import('@/services/whatsapp-messages-module');
        
        await enviarConfirmacionInscripcion(estudiante.id, {
            nombre: estudiante.nombre_completo,
            nombre_curso: matricula?.cursos?.nombre ?? "Curso",
            fecha_inicio: matricula?.cursos?.fecha_inicio ? 
                new Date(matricula.cursos.fecha_inicio).toLocaleDateString('es-CO') : 'Por confirmar',
            horario: matricula?.cursos?.horario || 'Por confirmar',
            mensualidad: matricula?.cursos?.precio_mensualidad ? 
                `$${Number(matricula.cursos.precio_mensualidad).toLocaleString()}` : 'Consultar',
            instructor: matricula?.cursos?.profesor_id ? 'Por asignar' : 'Pendiente',
            fecha_pago: pagoInscripcionData?.fecha_vencimiento ? 
                new Date(pagoInscripcionData.fecha_vencimiento).toLocaleDateString('es-CO') : 'Próximamente'
        });
    } catch (error) {
        console.error('Error enviando WhatsApp de inscripción:', error);
        // No rompe el flujo si WhatsApp falla
    }
}
```

---

## 📍 PUNTO 2: DESPUÉS DE PAGO CONFIRMADO

**Ubicación**: `src/app/matriculas/create/page.tsx` línea 524 (dentro de `handleRegistrarPago`)

### Busca (línea ~524):
```tsx
await enviarWhatsappConPlantilla(
    estudianteData.telefono,
    'bienvenida_portal_estudiante',
    {
        nombre: estudianteData.nombre_completo,
        curso: cursoData?.nombre ?? "tu curso",
        enlace_portal: PORTAL_ESTUDIANTE_URL,
        usuario: usuarioPortal,
        contrasena: contrasenaPortal,
    },
);
```

### Agrégale esto justo antes (línea ~520):
```tsx
// Enviar confirmación de pago
if (estudianteData?.telefono && (estudianteData?.notif_whatsapp ?? true)) {
    try {
        const { enviarConfirmacionPago } = await import('@/services/whatsapp-messages-module');
        
        const montoNumero = Number(montoNumero || pagoInscripcionData?.monto || 0);
        
        await enviarConfirmacionPago(estudianteData.id, {
            nombre: estudianteData.nombre_completo,
            referencia_pago: referencia || 'Contado',
            monto: `$${montoNumero.toLocaleString()}`,
            fecha_pago: dayjs().format('DD/MM/YYYY'),
            concepto: 'Inscripción',
            nombre_curso: cursoData?.nombre ?? 'Curso',
            fecha_vigencia: dayjs().add(1, 'month').format('DD/MM/YYYY'),
            fecha_proxima_clase: cursoData?.fecha_inicio ? 
                new Date(cursoData.fecha_inicio).toLocaleDateString('es-CO') : 'Por confirmar'
        });
    } catch (error) {
        console.error('Error enviando confirmación de pago:', error);
    }
}

// Luego sí envía la bienvenida del portal
await enviarWhatsappConPlantilla(
    estudianteData.telefono,
    'bienvenida_portal_estudiante',
    {...}
);
```

---

## 📍 PUNTO 3: BOTÓN WHATSAPP EN PÁGINAS DE CURSO

**Ubicación**: `src/app/catalogo/page.tsx` (página de cursos públicos)

### Busca la función `compartir` (línea ~110):
```tsx
const compartir = async (values: SharePayload) => {
    if (!selectedPrograma) return;
    // ... código existente ...
    const { error } = await supabaseBrowserClient.from("leads").insert(payload);
```

### Agrégale esto después de insertar el lead (línea ~125):
```tsx
// AGREGAR AQUÍ (después de insert leads):
if (!error && selectedPrograma) {
    try {
        const { enviarFormularioInteres } = await import('@/services/whatsapp-messages-module');
        
        await enviarFormularioInteres(telefono, null, {
            nombre: values.nombre,
            curso_interes: selectedPrograma.nombre,
            ciudad: 'Cali', // O detecta dinámicamente
            beneficio_principal: selectedPrograma.nombre + ' profesional',
            beneficio_1: 'Instrucción de calidad',
            beneficio_2: 'Certificado reconocido',
            beneficio_3: 'Bolsa de empleo',
            fecha_inicio: selectedPrograma.fecha_inicio ? 
                new Date(selectedPrograma.fecha_inicio).toLocaleDateString('es-CO') : 'Próximamente',
            cupos: '5', // O del programa
            link_catalogo: 'https://academia.local/catalogo', // Reemplaza con tu URL
            telefono_soporte: '+573006402575' // Del .env
        });
    } catch (error) {
        console.error('Error enviando WhatsApp de interés:', error);
    }
}
```

---

## 📍 PUNTO 4: REMINDERS AUTOMÁTICOS (Próximamente)

Para crear recordatorios automáticos de pagos y clases, necesitamos cron jobs. Aquí está la estructura:

### Archivo nuevo: `src/app/api/cron/recordatorios-pago/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { enviarRecordatorPago } from '@/services/whatsapp-messages-module';

export async function POST(request: NextRequest) {
  // Verificar x-api-key
  const apiKey = request.headers.get('x-api-key');
  if (apiKey !== process.env.CRON_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name) => cookieStore.get(name)?.value,
          set: (name, value, options) => cookieStore.set(name, value, options),
          remove: (name, options) => cookieStore.delete(name),
        },
      }
    );

    // Obtener cuotas vencidas en 3 días
    const { data: cuotas, error } = await supabase
      .from('pagos')
      .select(`
        id,
        monto,
        fecha_vencimiento,
        estudiante_id,
        perfiles(nombre_completo, telefono, notif_whatsapp),
        matriculas(cursos(nombre))
      `)
      .eq('estado', 'pendiente')
      .gte('fecha_vencimiento', new Date().toISOString().split('T')[0])
      .lte('fecha_vencimiento', new Date(Date.now() + 3*24*60*60*1000).toISOString().split('T')[0]);

    if (error) throw error;

    let enviados = 0;
    for (const cuota of cuotas || []) {
      if (cuota.perfiles?.telefono && (cuota.perfiles?.notif_whatsapp ?? true)) {
        try {
          await enviarRecordatorPago(cuota.estudiante_id, {
            nombre: cuota.perfiles.nombre_completo,
            mes: new Date(cuota.fecha_vencimiento).toLocaleDateString('es-CO', { month: 'long' }),
            monto: `$${Number(cuota.monto).toLocaleString()}`,
            fecha_vencimiento: new Date(cuota.fecha_vencimiento).toLocaleDateString('es-CO'),
            nombre_curso: cuota.matriculas?.cursos?.nombre || 'Curso'
          });
          enviados++;
        } catch (err) {
          console.error(`Error enviando recordatorio a ${cuota.estudiante_id}:`, err);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      mensaje: `${enviados} recordatorios enviados` 
    });
  } catch (error: any) {
    console.error('Error en cron recordatorios:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

**Para activar en Vercel:**
1. Ve a Settings → Cron Jobs
2. Crea: POST `/api/cron/recordatorios-pago` → Diario a las 10 AM
3. Header: `x-api-key: tu_valor_secreto`

---

## ✅ CHECKLIST DE INTEGRACIÓN

- [ ] Punto 1: Inscripción confirmada - Copiar + pegar
- [ ] Punto 2: Pago confirmado - Copiar + pegar
- [ ] Punto 3: Botón en catálogo - Copiar + pegar
- [ ] Punto 4: Cron de recordatorios - Crear archivo + Vercel
- [ ] Probar flujo completo end-to-end
- [ ] Verificar logs en `whatsapp_mensajes` table
- [ ] Configurar Make cuando sea necesario (opción D)

---

## 🧪 TESTING RÁPIDO

Después de cada integración:

```sql
-- Verifica que se hayan guardado los mensajes
SELECT 
  creado_en,
  tipo,
  estado,
  SUBSTRING(mensaje_texto, 1, 50) AS preview,
  telefono
FROM whatsapp_mensajes 
ORDER BY creado_en DESC 
LIMIT 5;
```

Debería mostrar el nuevo mensaje con estado **'enviado'**.

---

## 📞 SOPORTE

Si encuentras errors de "enviarConfirmacionInscripcion is not a function", asegúrate de:

1. ✅ El archivo `src/services/whatsapp-messages-module.ts` existe
2. ✅ La app compiló sin errores (`npm run build`)
3. ✅ Las env vars están en `.env.local`
4. ✅ El servidor está corriendo (`npm run dev`)

