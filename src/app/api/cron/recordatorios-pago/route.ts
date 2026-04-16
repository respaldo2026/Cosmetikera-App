import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { WhatsAppService } from '@/services/whatsapp-service';

export const runtime = 'nodejs';

const DEFAULT_TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_RECORDATORIO_PAGO || 'recordatorio_pago_v2';
const MAX_SENDS_PER_RUN = Number(process.env.WHATSAPP_MAX_BULK_PER_RUN || 30);
const DELAY_BETWEEN_SENDS_MS = Number(process.env.WHATSAPP_DELAY_BETWEEN_SENDS_MS || 1200);
const ALLOW_TEXT_FALLBACK = String(process.env.WHATSAPP_ALLOW_TEXT_FALLBACK || 'false').toLowerCase() === 'true';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePhone(telefono: string): string {
  const digits = String(telefono || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10 && digits.startsWith('3')) return `57${digits}`;
  if (digits.startsWith('00') && digits.length > 2) return digits.slice(2);
  return digits;
}

// Función para enviar WhatsApp usando plantilla aprobada por Meta
async function enviarWhatsAppDirecto(telefono: string, nombre: string, monto: string, fecha: string, curso: string) {
  const mensaje = `Hola ${nombre} 👋

Te recordamos que tu cuota de ${fecha} está próxima a vencer.

💰 *Monto:* ${monto}
📖 *Curso:* ${curso}

Puedes pagar en línea o en nuestra oficina. ¡Gracias!

_Academia Crystal_`;

  try {
    const templateVariables = [
      nombre,
      monto,
      curso,
      fecha,
    ];

    const response = await WhatsAppService.sendTemplate(
      telefono,
      DEFAULT_TEMPLATE_NAME,
      templateVariables,
      'es_CO'
    );

    console.log(`[Recordatorio] Enviado template a ${telefono}: ${response.messages?.[0]?.id || 'sin ID'}`);
    return response;
  } catch (error) {
    if (ALLOW_TEXT_FALLBACK) {
      console.warn(`[Recordatorio] Falló template, usando fallback texto para ${telefono}`);
      const fallback = await WhatsAppService.sendText(telefono, mensaje);
      return fallback;
    }

    console.error(`[Recordatorio] Error enviando a ${telefono}:`, error);
    throw error;
  }
}

type CookieOptions = {
  path?: string;
  maxAge?: number;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
};

export async function POST(request: NextRequest) {
  // Verificar x-api-key para evitar ejecuciones no autorizadas
  const apiKey = request.headers.get('x-api-key');
  if (apiKey !== process.env.CRON_API_KEY) {
    console.log('[Recordatorio] Intento no autorizado');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => cookieStore.get(name)?.value,
          set: (_name: string, _value: string, _options?: CookieOptions) => {
            // No-op en cron: no se requieren cookies de sesión
          },
          remove: (_name: string, _options?: CookieOptions) => {
            // No-op en cron: no se requieren cookies de sesión
          },
        },
      }
    );

    // Obtener cuotas pendientes que vencen en los próximos 3 días
    const hoy = new Date().toISOString().split('T')[0];
    const en3Dias = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: cuotas, error } = await supabase
      .from('pagos')
      .select(
        `
        id,
        monto,
        fecha_vencimiento,
        numero_cuota,
        estudiante_id,
        perfiles(nombre_completo, telefono, notif_whatsapp),
        matriculas(cursos(nombre))
      `
      )
      .eq('estado', 'pendiente')
      .gte('fecha_vencimiento', hoy)
      .lte('fecha_vencimiento', en3Dias);

    if (error) {
      console.error('[Recordatorio] Error en query:', error);
      throw error;
    }

    console.log(`[Recordatorio] Encontradas ${cuotas?.length || 0} cuotas pendientes`);

    let enviados = 0;
    let fallidos = 0;
    let omitidos = 0;
    const telefonosProcesados = new Set<string>();

    for (const cuota of cuotas || []) {
      const perfil = cuota.perfiles as any;
      const matricula = cuota.matriculas as any;

      if (enviados >= MAX_SENDS_PER_RUN) {
        console.log(`[Recordatorio] Límite por corrida alcanzado (${MAX_SENDS_PER_RUN})`);
        break;
      }

      // Validar que tenga teléfono y notificaciones habilitadas
      if (!perfil?.telefono) {
        console.log(`[Recordatorio] Sin teléfono para estudiante ${cuota.estudiante_id}`);
        omitidos++;
        continue;
      }

      if (perfil.notif_whatsapp === false) {
        console.log(`[Recordatorio] Notificaciones deshabilitadas para ${perfil.nombre_completo}`);
        omitidos++;
        continue;
      }

      const telefonoNormalizado = normalizePhone(perfil.telefono);
      if (!telefonoNormalizado) {
        console.log(`[Recordatorio] Teléfono inválido para ${perfil.nombre_completo}`);
        omitidos++;
        continue;
      }

      if (telefonosProcesados.has(telefonoNormalizado)) {
        console.log(`[Recordatorio] Duplicado evitado para ${telefonoNormalizado}`);
        omitidos++;
        continue;
      }

      try {
        const telefono = telefonoNormalizado;
        const fecha = new Date(cuota.fecha_vencimiento).toLocaleDateString('es-CO', { month: 'long' });
        const monto = `$${Number(cuota.monto).toLocaleString()}`;
        const curso = matricula?.cursos?.nombre || 'Curso';

        await enviarWhatsAppDirecto(
          telefono,
          perfil.nombre_completo,
          monto,
          fecha,
          curso
        );

        telefonosProcesados.add(telefonoNormalizado);
        enviados++;

        if (DELAY_BETWEEN_SENDS_MS > 0) {
          await sleep(DELAY_BETWEEN_SENDS_MS);
        }
      } catch (err) {
        console.error(`[Recordatorio] Error enviando a ${perfil.nombre_completo}:`, err);
        fallidos++;
      }
    }

    return NextResponse.json({
      success: true,
      mensaje: `${enviados} recordatorios enviados, ${fallidos} fallidos, ${omitidos} omitidos`,
      recomendaciones: {
        template: DEFAULT_TEMPLATE_NAME,
        textFallback: ALLOW_TEXT_FALLBACK,
        maxSendsPerRun: MAX_SENDS_PER_RUN,
        delayBetweenSendsMs: DELAY_BETWEEN_SENDS_MS,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Recordatorio] Error general:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}
