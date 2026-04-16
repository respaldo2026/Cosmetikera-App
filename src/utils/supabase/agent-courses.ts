import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("[agent-courses] Missing Supabase credentials. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
    throw new Error("Missing Supabase credentials")
  }

  return createClient(SUPABASE_URL, SUPABASE_KEY)
}

interface AcademyInfo {
  id: string
  nombre_academia: string | null
  direccion: string | null
  maps_url: string | null
  telefono: string | null
  email: string | null
  ruc: string | null
  logo_url: string | null
  instagram: string | null
  facebook: string | null
  youtube: string | null
  website: string | null
  whatsapp: string | null
}

interface ProgramInfo {
  id: number
  nombre: string
  descripcion: string | null
  duracion: string | null
  duracion_horas: number | null
  precio: number | null
  precio_inscripcion: number | null
  precio_mensualidad: number | null
  horas_por_clase: number | null
  contenido: string | null
  requisitos: string | null
  certificacion: string | null
  activo: boolean
  total_clases: number | null
}

interface PensumCiclo {
  id: string
  numero_ciclo: number
  nombre_ciclo: string | null
  descripcion: string | null
  duracion_semanas: number | null
  total_horas: number | null
  orden: number | null
  cursos: PensumCurso[]
}

interface PensumCurso {
  id: string
  nombre_curso: string
  descripcion: string | null
  horas: number | null
  creditos: number | null
  tipo_curso: string | null
  orden: number | null
}

interface MaterialCicloInfo {
  id: string
  nombre: string | null
  cantidad: string | number | null
  unidad: string | null
  observaciones: string | null
  orden: number | null
  pensum_id: string | null
  incluido_kit: boolean | null
  activo: boolean | null
}

interface MaterialClaseInfo {
  id: string
  nombre_material: string | null
  cantidad: string | number | null
  unidad: string | null
  observaciones: string | null
  orden: number | null
  pensum_id: string | null
  pensum_curso_id: string | null
  material_ciclo_id: string | null
  activo: boolean | null
}

interface MedioPago {
  id: number
  nombre: string
  codigo: string
  descripcion: string | null
  icono: string | null
  activo: boolean
  orden: number
}

interface CourseInfo {
  id: number
  nombre: string
  descripcion: string | null
  horario: string | null
  cupos: number
  precio: number | null
  precio_inscripcion: number | null
  precio_mensualidad: number | null
  estado: string
  fecha_inicio: string | null
  fecha_fin: string | null
  profesor_nombre: string | null
  programa_nombre: string | null
  resumen_texto_ia: string | null
  matriculados: number
  cupos_disponibles: number
  programa_id: number
}

interface StudentEnrollmentInfo {
  matriculaId: string
  estadoMatricula: string | null
  cursoId: number | null
  cursoNombre: string
  programaId: number | null
  programaNombre: string | null
  diasSemana: string | null
  horaInicio: string | null
  horaFin: string | null
  deudaPendiente: number
}

interface StudentPendingPaymentInfo {
  id: string
  matriculaId: string | null
  monto: number
  estado: string | null
  fechaVencimiento: string | null
  numeroCuota: number | null
  periodoPagado: string | null
}

export interface StudentAgentContext {
  estudianteId: string
  estudianteNombre: string
  identificacion: string
  telefono: string | null
  enrollments: StudentEnrollmentInfo[]
  enrolledProgramIds: number[]
  pendingPayments: StudentPendingPaymentInfo[]
  deudaTotal: number
  nextMonthlyPayment: StudentPendingPaymentInfo | null
  nextClass: {
    cursoNombre: string
    programaNombre: string | null
    fechaHoraIso: string
    fechaHoraTexto: string
  } | null
  contextText: string
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractUsefulTokens(value: string): string[] {
  const stopwords = new Set([
    'curso', 'cursos', 'de', 'del', 'la', 'el', 'los', 'las', 'en', 'para', 'con',
    'quiero', 'informacion', 'info', 'sobre', 'me', 'interesa', 'tienen', 'hay',
    'que', 'como', 'cuando', 'cuanto', 'precio', 'costa', 'valor'
  ])

  return normalizeText(value)
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !stopwords.has(t))
}

function normalizeIdentification(value: string): string {
  return String(value || '').replace(/\D/g, '')
}

function formatIdentificationWithDots(value: string): string {
  const digits = normalizeIdentification(value)
  if (!digits) return ''
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function buildIdentificationCandidates(rawIdentification: string): string[] {
  const raw = String(rawIdentification || '').trim()
  const digits = normalizeIdentification(raw)
  const dotted = formatIdentificationWithDots(digits)

  return Array.from(new Set([raw, digits, dotted].filter(Boolean)))
}

function parseHourToMinutes(value: string | null): number {
  if (!value) return 8 * 60
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!match) return 8 * 60
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 8 * 60
  return Math.max(0, Math.min(23, hours)) * 60 + Math.max(0, Math.min(59, minutes))
}

function detectDayIndexesFromSchedule(diasSemana: string | null): number[] {
  const normalized = normalizeText(diasSemana || '')
  if (!normalized) return []

  const map: Array<{ tokens: string[]; day: number }> = [
    { tokens: ['domingo', 'dom'], day: 0 },
    { tokens: ['lunes', 'lun'], day: 1 },
    { tokens: ['martes', 'mar'], day: 2 },
    { tokens: ['miercoles', 'mie', 'mier'], day: 3 },
    { tokens: ['jueves', 'jue'], day: 4 },
    { tokens: ['viernes', 'vie'], day: 5 },
    { tokens: ['sabado', 'sab'], day: 6 },
  ]

  const indexes = new Set<number>()

  if (/\b(lunes\s*a\s*viernes|lunes\s*-\s*viernes|lun\s*a\s*vie|lv|l\s*a\s*v)\b/i.test(normalized)) {
    indexes.add(1)
    indexes.add(2)
    indexes.add(3)
    indexes.add(4)
    indexes.add(5)
  }

  map.forEach((entry) => {
    if (entry.tokens.some((token) => new RegExp(`\\b${token}\\b`, 'i').test(normalized))) {
      indexes.add(entry.day)
    }
  })

  return Array.from(indexes.values()).sort((a, b) => a - b)
}

function calculateNextClassDate(diasSemana: string | null, horaInicio: string | null, now: Date): Date | null {
  const dayIndexes = detectDayIndexesFromSchedule(diasSemana)
  if (!dayIndexes.length) return null

  const minutes = parseHourToMinutes(horaInicio)
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60

  let best: Date | null = null
  for (let offset = 0; offset < 14; offset++) {
    const candidate = new Date(now)
    candidate.setHours(0, 0, 0, 0)
    candidate.setDate(candidate.getDate() + offset)
    if (!dayIndexes.includes(candidate.getDay())) continue

    candidate.setHours(hour, minute, 0, 0)
    if (candidate <= now) continue

    if (!best || candidate < best) {
      best = candidate
    }
  }

  return best
}

function formatDateTimeForStudent(value: Date): string {
  return value.toLocaleString('es-CO', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0)
}

function formatDateShort(value: string | null): string {
  if (!value) return 'Sin fecha definida'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha definida'
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export async function getStudentContextByIdentification(rawIdentification: string): Promise<StudentAgentContext | null> {
  try {
    const supabase = getSupabaseClient()
    const candidates = buildIdentificationCandidates(rawIdentification)

    if (!candidates.length) {
      return null
    }

    let studentProfile: any = null

    const { data: directProfiles, error: directError } = await supabase
      .from('perfiles')
      .select('id, nombre_completo, identificacion, telefono, rol')
      .in('identificacion', candidates)
      .limit(10)

    if (directError) {
      console.error('[getStudentContextByIdentification] Error perfiles direct:', directError)
    }

    const normalizedTarget = normalizeIdentification(rawIdentification)
    studentProfile = (directProfiles || []).find((profile: any) => normalizeIdentification(profile?.identificacion || '') === normalizedTarget)
      || (directProfiles || []).find((profile: any) => String(profile?.rol || '').toLowerCase() === 'estudiante')
      || (directProfiles || [])[0]

    if (!studentProfile && normalizedTarget) {
      const searchTail = normalizedTarget.slice(-6)
      const { data: fuzzyProfiles, error: fuzzyError } = await supabase
        .from('perfiles')
        .select('id, nombre_completo, identificacion, telefono, rol')
        .ilike('identificacion', `%${searchTail}%`)
        .limit(60)

      if (fuzzyError) {
        console.error('[getStudentContextByIdentification] Error perfiles fuzzy:', fuzzyError)
      }

      studentProfile = (fuzzyProfiles || []).find((profile: any) => normalizeIdentification(profile?.identificacion || '') === normalizedTarget) || null
    }

    if (!studentProfile?.id) {
      return null
    }

    const { data: matriculasRows, error: matriculasError } = await supabase
      .from('matriculas')
      .select('id, estado, fecha_inicio, deuda_pendiente, cursos(id, nombre, programa_id, dias_semana, hora_inicio, hora_fin, programas:programa_id(nombre))')
      .eq('estudiante_id', studentProfile.id)
      .order('created_at', { ascending: false })

    if (matriculasError) {
      console.error('[getStudentContextByIdentification] Error matrículas:', matriculasError)
      return null
    }

    const enrollments: StudentEnrollmentInfo[] = ((matriculasRows || []) as any[])
      .map((row: any) => ({
        matriculaId: String(row?.id || ''),
        estadoMatricula: row?.estado ?? null,
        cursoId: row?.cursos?.id ?? null,
        cursoNombre: row?.cursos?.nombre || 'Curso',
        programaId: row?.cursos?.programa_id ?? null,
        programaNombre: row?.cursos?.programas?.nombre || null,
        diasSemana: row?.cursos?.dias_semana ?? null,
        horaInicio: row?.cursos?.hora_inicio ?? null,
        horaFin: row?.cursos?.hora_fin ?? null,
        deudaPendiente: Number(row?.deuda_pendiente || 0),
      }))
      .filter((item) => Boolean(item.matriculaId))

    const enrollmentIds = enrollments.map((item) => item.matriculaId).filter(Boolean)
    const activeEnrollments = enrollments.filter((item) => !['cancelada', 'retirada', 'inactiva'].includes(String(item.estadoMatricula || '').toLowerCase()))

    let pendingPayments: StudentPendingPaymentInfo[] = []
    if (enrollmentIds.length > 0) {
      const { data: pagosRows, error: pagosError } = await supabase
        .from('pagos')
        .select('id, matricula_id, monto, estado, fecha_vencimiento, numero_cuota, periodo_pagado')
        .eq('estudiante_id', studentProfile.id)
        .in('matricula_id', enrollmentIds)
        .order('fecha_vencimiento', { ascending: true, nullsFirst: false })

      if (pagosError) {
        console.error('[getStudentContextByIdentification] Error pagos:', pagosError)
      } else {
        pendingPayments = ((pagosRows || []) as any[])
          .filter((row: any) => String(row?.estado || '').toLowerCase() !== 'pagado')
          .map((row: any) => ({
            id: String(row?.id || ''),
            matriculaId: row?.matricula_id ? String(row.matricula_id) : null,
            monto: Number(row?.monto || 0),
            estado: row?.estado ?? null,
            fechaVencimiento: row?.fecha_vencimiento ?? null,
            numeroCuota: typeof row?.numero_cuota === 'number' ? row.numero_cuota : row?.numero_cuota ? Number(row.numero_cuota) : null,
            periodoPagado: row?.periodo_pagado ?? null,
          }))
      }
    }

    const pendingDebtFromPayments = pendingPayments.reduce((sum, item) => sum + Math.max(0, Number(item.monto || 0)), 0)
    const pendingDebtFromEnrollments = enrollments.reduce((sum, item) => sum + Math.max(0, Number(item.deudaPendiente || 0)), 0)
    const deudaTotal = pendingDebtFromPayments > 0 ? pendingDebtFromPayments : pendingDebtFromEnrollments

    const nextMonthlyPayment = pendingPayments
      .filter((item) => Number(item.numeroCuota || 0) > 0)
      .sort((a, b) => {
        const dateA = a.fechaVencimiento ? new Date(a.fechaVencimiento).getTime() : Number.MAX_SAFE_INTEGER
        const dateB = b.fechaVencimiento ? new Date(b.fechaVencimiento).getTime() : Number.MAX_SAFE_INTEGER
        return dateA - dateB
      })[0] || null

    const now = new Date()
    let nextClass: StudentAgentContext['nextClass'] = null
    for (const enrollment of activeEnrollments) {
      const nextDate = calculateNextClassDate(enrollment.diasSemana, enrollment.horaInicio, now)
      if (!nextDate) continue

      if (!nextClass || nextDate.getTime() < new Date(nextClass.fechaHoraIso).getTime()) {
        nextClass = {
          cursoNombre: enrollment.cursoNombre,
          programaNombre: enrollment.programaNombre,
          fechaHoraIso: nextDate.toISOString(),
          fechaHoraTexto: formatDateTimeForStudent(nextDate),
        }
      }
    }

    const enrolledProgramIds = Array.from(
      new Set(activeEnrollments.map((item) => Number(item.programaId)).filter((value) => Number.isFinite(value) && value > 0))
    )

    const studentName = studentProfile?.nombre_completo || 'Estudiante'
    const identified = studentProfile?.identificacion || rawIdentification

    const coursesText = activeEnrollments.length
      ? activeEnrollments
          .map((item) => {
            const scheduleParts = [
              item.diasSemana || null,
              item.horaInicio && item.horaFin ? `${item.horaInicio} - ${item.horaFin}` : item.horaInicio || null,
            ].filter(Boolean)
            const schedule = scheduleParts.length ? ` | Horario: ${scheduleParts.join(' | ')}` : ''
            return `- ${item.cursoNombre}${item.programaNombre ? ` (${item.programaNombre})` : ''}${schedule}`
          })
          .join('\n')
      : '- No tiene cursos activos en este momento.'

    const nextClassText = nextClass
      ? `- ${nextClass.cursoNombre}${nextClass.programaNombre ? ` (${nextClass.programaNombre})` : ''}: ${nextClass.fechaHoraTexto}`
      : '- No se pudo calcular próxima clase (faltan días/horarios en la matrícula).'

    const nextMonthlyText = nextMonthlyPayment
      ? `- Cuota ${nextMonthlyPayment.numeroCuota ?? '?'} | Vence: ${formatDateShort(nextMonthlyPayment.fechaVencimiento)} | Valor: ${formatCurrency(nextMonthlyPayment.monto)}`
      : '- No tiene mensualidades pendientes registradas.'

    const contextText = `
## CONTEXTO PRIVADO DE ESTUDIANTE (IDENTIFICACIÓN VALIDADA)
Estudiante: ${studentName}
Identificación: ${identified}

Cursos inscritos (activos):
${coursesText}

Próxima clase estimada:
${nextClassText}

Estado financiero del estudiante:
- Deuda total pendiente: ${formatCurrency(deudaTotal)}
Próxima mensualidad pendiente:
${nextMonthlyText}

Reglas obligatorias con este contexto:
- Si pregunta "cuánto debo", responde con "Deuda total pendiente".
- Si pregunta "cuándo debo pagar" o "próxima mensualidad", responde con "Próxima mensualidad pendiente".
- Si pregunta por materiales sin mencionar curso, prioriza los cursos inscritos arriba.
- Nunca mezcles datos de otro estudiante ni inventes cuotas/fechas no listadas.
`.trim()

    return {
      estudianteId: String(studentProfile.id),
      estudianteNombre: studentName,
      identificacion: identified,
      telefono: studentProfile?.telefono ?? null,
      enrollments: activeEnrollments,
      enrolledProgramIds,
      pendingPayments,
      deudaTotal,
      nextMonthlyPayment,
      nextClass,
      contextText,
    }
  } catch (error) {
    console.error('[getStudentContextByIdentification] Exception:', error)
    return null
  }
}

function buildProgramPriceText(
  programa: ProgramInfo,
  fallback?: { precio_inscripcion?: number | null; precio_mensualidad?: number | null }
): string {
  const inscripcion = Number(programa.precio_inscripcion ?? fallback?.precio_inscripcion ?? 0)
  const mensualidad = Number(programa.precio_mensualidad ?? fallback?.precio_mensualidad ?? 0)

  if (inscripcion > 0 || mensualidad > 0) {
    const parts: string[] = []
    if (inscripcion > 0) parts.push(`Inscripcion: $${inscripcion} COP`)
    if (mensualidad > 0) parts.push(`Mensualidad: $${mensualidad} COP`)
    return parts.join(' | ')
  }

  if (programa.precio) {
    return `Precio: $${programa.precio} COP`
  }

  return 'Precio a definir'
}

function formatTimeToAmPm(value?: string | null): string | null {
  if (!value) return null

  const normalized = value.trim()
  const match = normalized.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!match) return normalized

  const hours = Number(match[1])
  const minutes = Number(match[2])

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return normalized
  }

  const suffix = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

function formatSchedule(horaInicio?: string | null, horaFin?: string | null, diasSemana?: string | null): string | null {
  const timeRange = [formatTimeToAmPm(horaInicio), formatTimeToAmPm(horaFin)].filter(Boolean).join(' - ')
  const dias = diasSemana
    ? diasSemana
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean)
        .join(', ')
    : ''

  if (timeRange && dias) return `${timeRange} (${dias})`
  if (timeRange) return timeRange
  if (dias) return dias
  return null
}

function normalizeMatriculasCount(value: any): number {
  const list = Array.isArray(value) ? value : value ? [value] : []
  return list.reduce((acc, item) => acc + Number(item?.count || 0), 0)
}

function normalizeCursoRow(row: any): CourseInfo {
  const programa = Array.isArray(row.programas) ? row.programas[0] ?? null : row.programas
  const profesor = Array.isArray(row.profesor) ? row.profesor[0] ?? null : row.profesor
  const matriculados = normalizeMatriculasCount(row.matriculas)
  const cupos = Number(row.cupos || 0)

  return {
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion ?? null,
    horario: formatSchedule(row.hora_inicio, row.hora_fin, row.dias_semana),
    cupos,
    precio: row.precio ?? null,
    precio_inscripcion: row.precio_inscripcion ?? null,
    precio_mensualidad: row.precio_mensualidad ?? null,
    estado: row.estado ?? 'sin_estado',
    fecha_inicio: row.fecha_inicio ?? null,
    fecha_fin: row.fecha_fin ?? null,
    profesor_nombre: profesor?.nombre_completo ?? null,
    programa_nombre: programa?.nombre ?? null,
    resumen_texto_ia: null,
    matriculados,
    cupos_disponibles: Math.max(cupos - matriculados, 0),
    programa_id: row.programa_id,
  }
}

const PROGRAM_SYNONYM_GROUPS: Record<string, string[]> = {
  unas: [
    'unas', 'uñas', 'nails', 'manicure', 'pedicure', 'acrilico', 'acrilicas', 'acrylic',
    'gel', 'semipermanente', 'polygel', 'nailart', 'nail', 'esmaltado'
  ],
  pestanas: [
    'pestanas', 'pestañas', 'lashes', 'lash', 'lifting', 'laminado', 'extensiones',
    'rimel', 'cejas', 'brow', 'microblading'
  ],
  maquillaje: [
    'maquillaje', 'makeup', 'make', 'visagismo', 'novias', 'social', 'artistico'
  ],
  barberia: [
    'barberia', 'barbería', 'barber', 'corte', 'fade', 'degradado', 'afeitado'
  ],
  peluqueria: [
    'peluqueria', 'peluquería', 'cabello', 'hair', 'peinado', 'colorimetria', 'balayage',
    'alisado', 'keratina'
  ],
  esteticafacial: [
    'facial', 'estetica', 'estética', 'limpieza', 'piel', 'skincare', 'cosmetologia'
  ]
}

function findSynonymGroup(token: string): string | null {
  const normalizedToken = normalizeText(token)
  for (const [group, words] of Object.entries(PROGRAM_SYNONYM_GROUPS)) {
    if (words.some((word) => normalizeText(word) === normalizedToken)) {
      return group
    }
  }
  return null
}

function expandTokensWithSynonyms(tokens: string[]): string[] {
  const expanded = new Set<string>(tokens.map((t) => normalizeText(t)))

  for (const token of tokens) {
    const group = findSynonymGroup(token)
    if (!group) continue

    const synonyms = PROGRAM_SYNONYM_GROUPS[group as keyof typeof PROGRAM_SYNONYM_GROUPS]
    if (!synonyms) continue

    for (const synonym of synonyms) {
      expanded.add(normalizeText(synonym))
    }
  }

  return Array.from(expanded).filter(Boolean)
}

/**
 * Obtener medios de pago activos
 */
export async function getMediosPago(): Promise<MedioPago[]> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('medios_pago')
      .select('*')
      .eq('activo', true)
      .order('orden', { ascending: true })

    if (error) {
      console.error('[getMediosPago] Error:', error)
      return []
    }

    return data as MedioPago[]
  } catch (err) {
    console.error('[getMediosPago] Error:', err)
    return []
  }
}

/**
 * Formatear medios de pago para el agente
 */
export function formatMediosPago(mediosPago: MedioPago[]): string {
  if (!mediosPago.length) {
    return ''
  }

  let info = `\n## MEDIOS DE PAGO ACEPTADOS\n\n`
  info += `Aceptamos los siguientes medios de pago:\n`
  
  mediosPago.forEach(medio => {
    const descripcion = medio.descripcion ? ` - ${medio.descripcion}` : ''
    info += `  💳 **${medio.nombre}**${descripcion}\n`
  })
  
  info += `\n`
  return info
}

/**
 * Obtener información de la academia (dirección, redes sociales, contacto)
 */
export async function getAcademyInfo(): Promise<AcademyInfo | null> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('configuracion')
      .select('*')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[getAcademyInfo] Error:', error)
      return null
    }

    return data as AcademyInfo | null
  } catch (err) {
    console.error('[getAcademyInfo] Error:', err)
    return null
  }
}

/**
 * Obtener pensum (temario) de un programa específico
 */
export async function getPensumByProgram(programaId: number): Promise<PensumCiclo[]> {
  try {
    const supabase = getSupabaseClient()

    // Obtener ciclos del pensum
    const { data: ciclos, error: errorCiclos } = await supabase
      .from('pensum')
      .select('*')
      .eq('programa_id', programaId)
      .eq('activo', true)
      .order('orden', { ascending: true })

    if (errorCiclos) {
      console.error('[getPensumByProgram] Error obteniendo ciclos:', errorCiclos)
      return []
    }

    if (!ciclos || ciclos.length === 0) {
      return []
    }

    // Para cada ciclo, obtener sus cursos
    const pensumCompleto: PensumCiclo[] = []
    for (const ciclo of ciclos) {
      const { data: cursos, error: errorCursos } = await supabase
        .from('pensum_cursos')
        .select('*')
        .eq('pensum_id', ciclo.id)
        .order('orden', { ascending: true })

      pensumCompleto.push({
        id: ciclo.id,
        numero_ciclo: ciclo.numero_ciclo,
        nombre_ciclo: ciclo.nombre_ciclo,
        descripcion: ciclo.descripcion,
        duracion_semanas: ciclo.duracion_semanas,
        total_horas: ciclo.total_horas,
        orden: ciclo.orden,
        cursos: (cursos || []).map((c: any) => ({
          id: c.id,
          nombre_curso: c.nombre_curso,
          descripcion: c.descripcion,
          horas: c.horas,
          creditos: c.creditos,
          tipo_curso: c.tipo_curso,
          orden: c.orden,
        }))
      })
    }

    return pensumCompleto
  } catch (err) {
    console.error('[getPensumByProgram] Error:', err)
    return []
  }
}

function formatMaterialQuantity(cantidad?: string | number | null, unidad?: string | null): string {
  const value = cantidad !== null && cantidad !== undefined && `${cantidad}`.trim() !== '' ? `${cantidad}`.trim() : ''
  const unit = unidad?.trim() || ''

  if (value && unit) return `${value} ${unit}`
  if (value) return value
  if (unit) return unit
  return 'Cantidad a confirmar'
}

async function getMaterialsByPensum(
  pensum: PensumCiclo[]
): Promise<{ materialesCiclo: MaterialCicloInfo[]; materialesClase: MaterialClaseInfo[] }> {
  try {
    const pensumIds = pensum.map((c) => c.id).filter(Boolean)
    if (pensumIds.length === 0) {
      return { materialesCiclo: [], materialesClase: [] }
    }

    const supabase = getSupabaseClient()

    const [materialesCicloRes, materialesClaseRes, pensumCursosRes] = await Promise.all([
      supabase
        .from('materiales_ciclo')
        .select('*')
        .in('pensum_id', pensumIds)
        .order('orden', { ascending: true, nullsFirst: true }),
      supabase
        .from('materiales_clase')
        .select('*')
        .in('pensum_id', pensumIds)
        .order('orden', { ascending: true, nullsFirst: true }),
      supabase
        .from('pensum_cursos')
        .select('id, pensum_id, nombre_curso, orden')
        .in('pensum_id', pensumIds),
    ])

    if (materialesCicloRes.error) {
      console.error('[getMaterialsByPensum] Error materiales_ciclo:', materialesCicloRes.error)
    }
    if (materialesClaseRes.error) {
      console.error('[getMaterialsByPensum] Error materiales_clase:', materialesClaseRes.error)
    }
    if (pensumCursosRes.error) {
      console.error('[getMaterialsByPensum] Error pensum_cursos:', pensumCursosRes.error)
    }

    const pensumCursoById = new Map<string, { pensum_id: string | null; nombre_curso: string | null; orden: number | null }>()
    ;((pensumCursosRes.data || []) as any[]).forEach((row) => {
      pensumCursoById.set(String(row.id), {
        pensum_id: row.pensum_id ?? null,
        nombre_curso: row.nombre_curso ?? null,
        orden: row.orden ?? null,
      })
    })

    const materialesCiclo = ((materialesCicloRes.data || []) as any[])
      .filter((m) => m?.activo !== false)
      .map((m) => ({
        id: `${m.id}`,
        nombre: m.nombre ?? null,
        cantidad: m.cantidad ?? null,
        unidad: m.unidad ?? null,
        observaciones: m.observaciones ?? null,
        orden: m.orden ?? null,
        pensum_id: m.pensum_id ?? null,
        incluido_kit: m.incluido_kit ?? null,
        activo: m.activo ?? null,
      }))

    const materialesClase = ((materialesClaseRes.data || []) as any[])
      .filter((m) => m?.activo !== false)
      .filter((m) => {
        const cursoId = m?.pensum_curso_id ? String(m.pensum_curso_id) : ''
        if (!cursoId) return true

        const curso = pensumCursoById.get(cursoId)
        if (!curso) return false

        const pensumIdMaterial = m?.pensum_id ? String(m.pensum_id) : ''
        const pensumIdCurso = curso.pensum_id ? String(curso.pensum_id) : ''

        if (pensumIdMaterial && pensumIdCurso && pensumIdMaterial !== pensumIdCurso) {
          return false
        }

        return true
      })
      .map((m) => ({
        id: `${m.id}`,
        nombre_material: m.nombre_material ?? null,
        cantidad: m.cantidad ?? null,
        unidad: m.unidad ?? null,
        observaciones: m.observaciones ?? null,
        orden: m.orden ?? null,
        pensum_id: m.pensum_id ?? null,
        pensum_curso_id: m.pensum_curso_id ?? null,
        material_ciclo_id: m.material_ciclo_id ?? null,
        activo: m.activo ?? null,
      }))

    return { materialesCiclo, materialesClase }
  } catch (err) {
    console.error('[getMaterialsByPensum] Error:', err)
    return { materialesCiclo: [], materialesClase: [] }
  }
}

function buildMaterialsContext(
  pensum: PensumCiclo[],
  materialesCiclo: MaterialCicloInfo[],
  materialesClase: MaterialClaseInfo[]
): string {
  if (materialesCiclo.length === 0 && materialesClase.length === 0) {
    return ''
  }

  const cicloById = new Map<string, PensumCiclo>()
  const cursoById = new Map<string, {
    nombre: string
    cicloNombre: string
    cicloNumero: number
    cicloOrden: number
    cicloId: string
    cursoOrden: number
  }>()
  pensum.forEach((ciclo) => {
    cicloById.set(ciclo.id, ciclo)
    const cicloNombre = ciclo.nombre_ciclo || `Ciclo ${ciclo.numero_ciclo}`
    const cicloNumero = Number(ciclo.numero_ciclo || 0)
    const cicloOrden = Number(ciclo.orden || ciclo.numero_ciclo || 9999)
    ciclo.cursos.forEach((curso) => {
      cursoById.set(curso.id, {
        nombre: curso.nombre_curso,
        cicloNombre,
        cicloNumero,
        cicloOrden,
        cicloId: ciclo.id,
        cursoOrden: Number(curso.orden || 9999),
      })
    })
  })

  const materialCicloById = new Map<string, MaterialCicloInfo>()
  materialesCiclo.forEach((material) => materialCicloById.set(material.id, material))

  let text = `\n  📦 **MATERIALES NECESARIOS:**\n`

  if (materialesCiclo.length > 0) {
    const byCiclo = new Map<string, MaterialCicloInfo[]>()
    materialesCiclo.forEach((m) => {
      const key = m.pensum_id || 'sin-ciclo'
      if (!byCiclo.has(key)) byCiclo.set(key, [])
      byCiclo.get(key)!.push(m)
    })

    text += `  **Materiales por Ciclo (lista general):**\n`
    const ciclosOrdenados = Array.from(byCiclo.entries()).sort((a, b) => {
      const cicloA = a[0] !== 'sin-ciclo' ? cicloById.get(a[0]) : null
      const cicloB = b[0] !== 'sin-ciclo' ? cicloById.get(b[0]) : null
      const ordenA = Number(cicloA?.orden || cicloA?.numero_ciclo || 9999)
      const ordenB = Number(cicloB?.orden || cicloB?.numero_ciclo || 9999)
      return ordenA - ordenB
    })

    for (const [cicloId, items] of ciclosOrdenados) {
      const ciclo = cicloId !== 'sin-ciclo' ? cicloById.get(cicloId) : null
      const cicloNombre = ciclo ? ciclo.nombre_ciclo || `Ciclo ${ciclo.numero_ciclo}` : 'Sin ciclo asignado'
      text += `    • ${cicloNombre}:\n`

      items
        .slice()
        .sort((a, b) => Number(a.orden || 9999) - Number(b.orden || 9999))
        .forEach((item) => {
        const nombre = item.nombre || 'Material'
        const qty = formatMaterialQuantity(item.cantidad, item.unidad)
        const kit = item.incluido_kit ? ' (incluido en kit)' : ''
        text += `      - ${qty} de ${nombre}${kit}\n`
      })
    }
  }

  if (materialesClase.length > 0) {
    const byCurso = new Map<string, MaterialClaseInfo[]>()
    materialesClase.forEach((m) => {
      const key = m.pensum_curso_id || 'sin-tema'
      if (!byCurso.has(key)) byCurso.set(key, [])
      byCurso.get(key)!.push(m)
    })

    text += `  **Materiales por Tema/Clase (detalle):**\n`
    const cursosOrdenados = Array.from(byCurso.entries()).sort((a, b) => {
      const cursoA = a[0] !== 'sin-tema' ? cursoById.get(a[0]) : null
      const cursoB = b[0] !== 'sin-tema' ? cursoById.get(b[0]) : null

      const cicloOrdenA = Number(cursoA?.cicloOrden || 9999)
      const cicloOrdenB = Number(cursoB?.cicloOrden || 9999)
      if (cicloOrdenA !== cicloOrdenB) return cicloOrdenA - cicloOrdenB

      const cursoOrdenA = Number(cursoA?.cursoOrden || 9999)
      const cursoOrdenB = Number(cursoB?.cursoOrden || 9999)
      return cursoOrdenA - cursoOrdenB
    })

    for (const [cursoId, items] of cursosOrdenados) {
      const curso = cursoId !== 'sin-tema' ? cursoById.get(cursoId) : null
      const temaNombre = curso
        ? `Clase ${curso.cursoOrden === 9999 ? '?' : curso.cursoOrden} · ${curso.nombre} (Ciclo ${curso.cicloNumero}: ${curso.cicloNombre})`
        : 'Tema sin asignar'
      text += `    • ${temaNombre}:\n`

      items
        .slice()
        .sort((a, b) => Number(a.orden || 9999) - Number(b.orden || 9999))
        .forEach((item) => {
        const nombreBase = item.nombre_material?.trim()
        const fromCiclo = item.material_ciclo_id ? materialCicloById.get(item.material_ciclo_id) : null
        const nombre = nombreBase || fromCiclo?.nombre || 'Material'
        const qty = formatMaterialQuantity(item.cantidad, item.unidad)
        const obs = item.observaciones ? ` (${item.observaciones})` : ''
        text += `      - ${qty} de ${nombre}${obs}\n`
      })
    }

    text += `  ⚠️ Regla crítica para responder: "Clase N" corresponde al tema con orden N dentro del ciclo consultado. Si el usuario no indica ciclo y existe Clase N en varios ciclos, primero pide aclaración de ciclo.\n`
  }

  return text
}

/**
 * Obtener TODOS los programas activos (información primaria)
 */
export async function getProgramsForAgent(): Promise<ProgramInfo[]> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('programas')
      .select('*')
      .eq('activo', true)
      .order('nombre', { ascending: true })

    if (error) {
      console.error('[getProgramsForAgent] Error:', error)
      return []
    }

    return data as ProgramInfo[]
  } catch (error) {
    console.error('[getProgramsForAgent] Exception:', error)
    return []
  }
}

/**
 * Obtener cursos/grupos de un programa específico (información secundaria)
 */
export async function getCoursesByProgram(programId: number): Promise<CourseInfo[]> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('cursos')
      .select(`
        id,
        nombre,
        descripcion,
        estado,
        fecha_inicio,
        fecha_fin,
        dias_semana,
        hora_inicio,
        hora_fin,
        cupos,
        precio,
        precio_inscripcion,
        precio_mensualidad,
        programa_id,
        profesor_id,
        programas:programa_id ( id, nombre ),
        profesor:profesor_id ( id, nombre_completo ),
        matriculas:matriculas ( count )
      `)
      .eq('programa_id', programId)
      .in('estado', ['activo', 'proximo'])
      .order('fecha_inicio', { ascending: true, nullsFirst: true })
      .order('hora_inicio', { ascending: true, nullsFirst: true })

    if (error) {
      console.error('[getCoursesByProgram] Error:', error)
      return []
    }

    return (data || []).map(normalizeCursoRow)
  } catch (error) {
    console.error('[getCoursesByProgram] Exception:', error)
    return []
  }
}

/**
 * Detectar qué programa menciona el usuario en su mensaje
 */
export function detectProgramFromMessage(message: string, programs: ProgramInfo[]): ProgramInfo | null {
  const normalizedMessage = normalizeText(message)
  const messageTokens = extractUsefulTokens(message)
  const messageTokensExpanded = expandTokensWithSynonyms(messageTokens)

  if (!normalizedMessage || programs.length === 0) {
    return null
  }

  let bestMatch: ProgramInfo | null = null
  let bestScore = 0

  for (const program of programs) {
    const normalizedProgramName = normalizeText(program.nombre)

    // Coincidencia exacta del nombre completo
    if (normalizedProgramName && normalizedMessage.includes(normalizedProgramName)) {
      return program
    }

    // Coincidencia por palabras clave del nombre del programa
    const programTokens = extractUsefulTokens(program.nombre)
    if (programTokens.length === 0) continue

    let score = 0
    for (const token of programTokens) {
      const normalizedToken = normalizeText(token)
      if (normalizedMessage.includes(normalizedToken) || messageTokensExpanded.includes(normalizedToken)) {
        score += 1
      }
    }

    // Bono por sinónimos compartidos entre mensaje y nombre de programa
    const programGroups = new Set(
      programTokens
        .map((t) => findSynonymGroup(t))
        .filter((g): g is string => Boolean(g))
    )
    const messageGroups = new Set(
      messageTokensExpanded
        .map((t) => findSynonymGroup(t))
        .filter((g): g is string => Boolean(g))
    )
    for (const group of messageGroups) {
      if (programGroups.has(group)) {
        score += 2
      }
    }

    // Bono por frases típicas: "curso de uñas", "info pestañas", etc.
    const phraseMatch = /(curso|info|informacion)\s+de\s+([a-z0-9\s]+)/i.exec(normalizedMessage)
    if (phraseMatch?.[2]) {
      const requestedTopic = phraseMatch[2].trim()
      if (requestedTopic && normalizedProgramName.includes(requestedTopic)) {
        score += 2
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = program
    }
  }

  // Umbral mínimo para evitar falsos positivos
  return bestScore >= 1 ? bestMatch : null
}

/**
 * Obtener cursos para consulta actual (jerarquía: si menciona programa, solo esos cursos)
 */
export async function getCoursesForQuery(message: string, programs: ProgramInfo[]): Promise<CourseInfo[]> {
  const detectedProgram = detectProgramFromMessage(message, programs)
  
  if (detectedProgram) {
    // Si menciona un programa específico, obtener solo sus cursos
    return getCoursesByProgram(detectedProgram.id)
  }
  
  // Si no menciona programa específico, intentar filtrar por palabras clave
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cursos')
      .select(`
        id,
        nombre,
        descripcion,
        estado,
        fecha_inicio,
        fecha_fin,
        dias_semana,
        hora_inicio,
        hora_fin,
        cupos,
        precio,
        precio_inscripcion,
        precio_mensualidad,
        programa_id,
        profesor_id,
        programas:programa_id ( id, nombre ),
        profesor:profesor_id ( id, nombre_completo ),
        matriculas:matriculas ( count )
      `)
      .in('estado', ['activo', 'proximo'])
      .order('programa_id', { ascending: true })
      .order('fecha_inicio', { ascending: true, nullsFirst: true })
      .order('hora_inicio', { ascending: true, nullsFirst: true })

    if (error) {
      console.error('[getCoursesForQuery] Error:', error)
      return []
    }

    const allCourses = (data || []).map(normalizeCursoRow)
    const messageTokens = extractUsefulTokens(message)
    const messageTokensExpanded = expandTokensWithSynonyms(messageTokens)

    if (messageTokensExpanded.length === 0) {
      return allCourses
    }

    const filteredCourses = allCourses.filter((course) => {
      const normalizedCourseName = normalizeText(course.nombre || '')
      const normalizedProgramName = normalizeText(course.programa_nombre || '')
      return messageTokensExpanded.some((token) =>
        normalizedCourseName.includes(token) || normalizedProgramName.includes(token)
      )
    })

    // Si el filtro no encontró nada, devolver todos para no perder contexto
    return filteredCourses.length > 0 ? filteredCourses : allCourses
  } catch (error) {
    console.error('[getCoursesForQuery] Exception:', error)
    return []
  }
}

export function formatCoursesForAgent(courses: CourseInfo[]): string {
  if (!courses.length) {
    return 'No hay cursos disponibles en este momento.'
  }

  const coursesList = courses
    .map((course) => {
      const cuposText = course.cupos_disponibles > 0 
        ? `✅ ${course.cupos_disponibles} cupos disponibles`
        : '❌ SIN CUPOS'
      
      const precioText = course.precio_inscripcion || course.precio_mensualidad
        ? `Precio: $${course.precio_inscripcion || course.precio_mensualidad} COP`
        : 'Precio a definir'
      
      const scheduleText = course.horario 
        ? `Horario: ${course.horario}`
        : 'Horario a confirmar'

      const datesText = course.fecha_inicio 
        ? `Inicia: ${course.fecha_inicio}`
        : 'Fecha a confirmar'

      return `
📚 **${course.nombre}** (${course.programa_nombre})
   ${cuposText}
   📅 ${datesText}
   ⏰ ${scheduleText}
   💵 ${precioText}
   👨‍🏫 Profesor: ${course.profesor_nombre || 'A confirmar'}
   ${course.descripcion ? `   ℹ️ ${course.descripcion.substring(0, 100)}...` : ''}`.trim()
    })
    .join('\n\n')

  return `📖 **CURSOS DISPONIBLES**\n\n${coursesList}`
}

/**
 * Formato de contexto JERÁRQUICO:
 * 1. Todos los programas disponibles (información primaria)
 * 2. Si el usuario pregunta por un programa específico, sus cursos
 */

/**
 * Convertir URLs de redes sociales a formato corto y amigable
 */
function shortenSocialUrl(url: string, platform: 'instagram' | 'facebook' | 'youtube'): string {
  if (!url) return url
  
  // Limpiar URL
  let cleanUrl = url.trim()
  
  // Remover protocolo
  cleanUrl = cleanUrl.replace(/^https?:\/\/(www\.)?/, '')
  
  // Procesar según plataforma
  if (platform === 'instagram') {
    // instagram.com/username → @username
    const match = cleanUrl.match(/instagram\.com\/([^\/\?\s]+)/)
    if (match && match[1]) {
      return `@${match[1]}`
    }
    return cleanUrl
  }
  
  if (platform === 'facebook') {
    // facebook.com/username → fb.com/username
    // facebook.com/pages/name/123 → fb.com/name
    let cleaned = cleanUrl.replace(/facebook\.com/, 'fb.com')
    // Simplificar /pages/name/id a /name
    cleaned = cleaned.replace(/\/pages\/([^\/]+)\/\d+/, '/$1')
    // Remover parámetros query
    cleaned = cleaned.split('?')[0] || cleaned
    return cleaned
  }
  
  if (platform === 'youtube') {
    // youtube.com/channel/UC123 → youtube.com/c/NombreCanal (si existe)
    // youtube.com/@username → @username
    const atMatch = cleanUrl.match(/youtube\.com\/@([^\/\?\s]+)/)
    if (atMatch && atMatch[1]) {
      return `@${atMatch[1]}`
    }
    
    // Acortar youtube a yt para canales
    let cleaned = cleanUrl.replace(/youtube\.com/, 'yt.com')
    cleaned = cleaned.split('?')[0] || cleaned
    return cleaned
  }
  
  return cleanUrl
}

/**
 * Formatear información de la academia para el agente
 */
export function formatAcademyInfo(academy: AcademyInfo | null): string {
  if (!academy) {
    return ''
  }

  let info = `\n## INFORMACIÓN DE LA ACADEMIA\n\n`

  if (academy.nombre_academia) {
    info += `**${academy.nombre_academia}**\n\n`
  }

  // Datos de contacto
  const contactInfo = []
  if (academy.direccion) contactInfo.push(`📍 Dirección: ${academy.direccion}`)
  if (academy.maps_url) contactInfo.push(`🗺️ Google Maps: ${academy.maps_url}`)
  if (academy.telefono) contactInfo.push(`📞 Teléfono: ${academy.telefono}`)
  if (academy.whatsapp) contactInfo.push(`💬 WhatsApp: ${academy.whatsapp}`)
  if (academy.email) contactInfo.push(`📧 Email: ${academy.email}`)
  if (academy.website) contactInfo.push(`🌐 Web: ${academy.website}`)
  if (academy.ruc) contactInfo.push(`🏢 RUC/NIT: ${academy.ruc}`)

  if (contactInfo.length > 0) {
    info += `### Contacto:\n${contactInfo.join('\n')}\n\n`
  }

  // Redes sociales (URLs cortas y amigables)
  const socialMedia = []
  if (academy.instagram) {
    const shortUrl = shortenSocialUrl(academy.instagram, 'instagram')
    socialMedia.push(`📸 Instagram: ${shortUrl}`)
  }
  if (academy.facebook) {
    const shortUrl = shortenSocialUrl(academy.facebook, 'facebook')
    socialMedia.push(`👤 Facebook: ${shortUrl}`)
  }
  if (academy.youtube) {
    const shortUrl = shortenSocialUrl(academy.youtube, 'youtube')
    socialMedia.push(`🎥 YouTube: ${shortUrl}`)
  }

  if (socialMedia.length > 0) {
    info += `### Redes Sociales:\n${socialMedia.join('\n')}\n\n`
  }

  return info
}

export function buildHierarchicalContext(
  programs: ProgramInfo[],
  courses: CourseInfo[],
  detectedProgram: ProgramInfo | null,
  academy: AcademyInfo | null = null
): string {
  let context = ``

  const priceFallbackByProgram = new Map<number, { precio_inscripcion?: number | null; precio_mensualidad?: number | null }>();
  courses.forEach((course) => {
    if (!course.programa_id) return;
    if (course.precio_inscripcion || course.precio_mensualidad) {
      if (!priceFallbackByProgram.has(course.programa_id)) {
        priceFallbackByProgram.set(course.programa_id, {
          precio_inscripcion: course.precio_inscripcion ?? null,
          precio_mensualidad: course.precio_mensualidad ?? null,
        });
      }
    }
  });

  // Agregar información de la academia si está disponible
  if (academy) {
    context += formatAcademyInfo(academy)
  }

  context += `
## PROGRAMAS Y GRUPOS DISPONIBLES

### 📚 Programas Activos:
${programs
  .map((prog) => {
    const durationText = prog.duracion_horas 
      ? `(${prog.duracion_horas} horas)`
      : prog.duracion 
      ? `(${prog.duracion})`
      : ''
    
    const clasesText = prog.total_clases ? ` - ${prog.total_clases} clases` : ''
    
    const priceText = buildProgramPriceText(prog, priceFallbackByProgram.get(prog.id))
    
    const reqText = prog.requisitos ? `Requisitos: ${prog.requisitos}` : ''
    const certText = prog.certificacion ? `Certificación: ${prog.certificacion}` : ''
    const contenidoText = prog.contenido ? `Temario: ${prog.contenido.substring(0, 200)}${prog.contenido.length > 200 ? '...' : ''}` : ''
    
    return `
- **${prog.nombre}** ${durationText}${clasesText}
  Descripción: ${prog.descripcion || 'N/A'}
  ${contenidoText ? `${contenidoText}` : ''}
  ${reqText ? `${reqText}` : ''}
  ${certText ? `${certText}` : ''}
  Inversión: ${priceText}`
  })
  .join('\n')}

${detectedProgram ? `
### 📖 Grupos Disponibles del Programa "${detectedProgram.nombre}":
${courses.length > 0 
  ? courses
      .map((course) => {
        const matriculados = course.matriculados || 0
        const cupos = course.cupos || 0
        const disponibles = course.cupos_disponibles || 0
        const today = new Date(); today.setHours(0,0,0,0);
        const fechaInicio = course.fecha_inicio ? new Date(course.fecha_inicio) : null
        const fechaInicioFmt = fechaInicio && !isNaN(fechaInicio.getTime())
          ? fechaInicio.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
          : 'Por confirmar'
        const esFutura = fechaInicio && fechaInicio >= today
        const fechaFin = course.fecha_fin ? new Date(course.fecha_fin) : null
        const fechaFinFmt = fechaFin && !isNaN(fechaFin.getTime())
          ? fechaFin.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
          : 'Por confirmar'
        
        return `
- **${course.nombre}**
  Inicio: ${fechaInicioFmt}${esFutura ? ' ✅' : ' (ya inició)'}
  Fin estimado: ${fechaFinFmt}
  Horario: ${course.horario || 'Por confirmar'}
  Cupos: ${matriculados}/${cupos} disponibles: ${disponibles}
  Profesor: ${course.profesor_nombre || 'Por confirmar'}`
      })
      .join('\n') + '\n\n💰 Inversión: Ver información del programa arriba'
  : 'No hay grupos disponibles para este programa en este momento.'
}
` : ''}

${!detectedProgram && courses.length === 1 && courses[0] ? `
### 📖 Grupo Activo Actual (Total: 1):
${(() => {
  const c = courses[0]
  const today = new Date(); today.setHours(0,0,0,0);
  const fi = c.fecha_inicio ? new Date(c.fecha_inicio) : null
  const fiFmt = fi && !isNaN(fi.getTime()) ? fi.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Por confirmar'
  return `- **${c.nombre}** (${c.programa_nombre || 'Programa'})
  Inicio: ${fiFmt}
  Horario: ${c.horario || 'Por confirmar'}
  Cupos disponibles: ${c.cupos_disponibles || 0} de ${c.cupos || 0}
  Profesor: ${c.profesor_nombre || 'Por confirmar'}`
})()}

` : ''}

INSTRUCCIONES PARA RESPONDER PREGUNTAS DE FECHA/INICIO:
- Usa SIEMPRE las fechas exactas del contexto anterior, NO inventes fechas ni pongas emojis de fecha antes del texto de la fecha.
- Formato correcto: "martes, 10 de marzo de 2026" — NO uses "📅 Próximo inicio: 📅 Día:"
- Si la fecha dice "Por confirmar", di exactamente eso.
- Si no hay fecha futura, di que está por confirmar.
Cuando un cliente pregunte por un programa específico, muestra sus grupos con horarios y cupos disponibles.
Los PRECIOS están en el PROGRAMA (nivel superior), NO en los grupos individuales.
Si pregunta "¿Cuánto cuesta [programa]?", usa el precio del PROGRAMA, no del grupo.
Si preguntan por el profesor, usa el nombre del profesor del grupo mostrado (si no hay, responde "Por confirmar").
`

  return context.trim()
}

/**
 * Versión async de buildHierarchicalContext que incluye información detallada del pensum
 * cuando se detecta un programa específico
 */
export async function buildHierarchicalContextWithPensum(
  programs: ProgramInfo[],
  courses: CourseInfo[],
  detectedProgram: ProgramInfo | null,
  academy: AcademyInfo | null = null,
  mediosPago: MedioPago[] = []
): Promise<string> {
  let context = ``

  const priceFallbackByProgram = new Map<number, { precio_inscripcion?: number | null; precio_mensualidad?: number | null }>();
  courses.forEach((course) => {
    if (!course.programa_id) return;
    if (course.precio_inscripcion || course.precio_mensualidad) {
      if (!priceFallbackByProgram.has(course.programa_id)) {
        priceFallbackByProgram.set(course.programa_id, {
          precio_inscripcion: course.precio_inscripcion ?? null,
          precio_mensualidad: course.precio_mensualidad ?? null,
        });
      }
    }
  });

  // Agregar información de la academia si está disponible
  if (academy) {
    context += formatAcademyInfo(academy)
  }
  
  // Agregar medios de pago si están disponibles
  if (mediosPago.length > 0) {
    context += formatMediosPago(mediosPago)
  }

  context += `
## PROGRAMAS Y GRUPOS DISPONIBLES

### 📚 Programas Activos:
`

  for (const prog of programs) {
    const durationText = prog.duracion_horas 
      ? `${prog.duracion_horas} horas`
      : prog.duracion 
      ? prog.duracion
      : 'Duración a definir'
    
    const clasesText = prog.total_clases ? ` (${prog.total_clases} clases)` : ''
    
    const priceText = buildProgramPriceText(prog, priceFallbackByProgram.get(prog.id))
    
    context += `
- **${prog.nombre}**
  Duración: ${durationText}${clasesText}
  Descripción: ${prog.descripcion || 'N/A'}`
    
    if (prog.requisitos) {
      context += `\n  Requisitos: ${prog.requisitos}`
    }
    if (prog.certificacion) {
      context += `\n  Certificación: ${prog.certificacion}`
    }
    context += `\n  Inversión: ${priceText}\n`
    
    // Mostrar temario si existe (solo para el programa detectado o si es general)
    if (detectedProgram && detectedProgram.id === prog.id) {
      // Si hay contenido general, mostrarlo
      if (prog.contenido) {
        context += `  📚 TEMARIO DETALLADO POR CLASES:\n${prog.contenido}\n`
      }
      
      // Obtener pensum estructurado
      const pensum = await getPensumByProgram(prog.id)
      if (pensum.length > 0) {
        context += `  📚 **Contenido Detallado por Ciclos:**\n`
        pensum.forEach(ciclo => {
          const cicloNombre = ciclo.nombre_ciclo || `Ciclo ${ciclo.numero_ciclo}`
          const cicloHoras = ciclo.total_horas ? ` (${ciclo.total_horas}h)` : ''
          const cicloSemanas = ciclo.duracion_semanas ? ` - ${ciclo.duracion_semanas} semanas` : ''
          context += `    • ${cicloNombre}${cicloHoras}${cicloSemanas}\n`
          if (ciclo.cursos.length > 0) {
            ciclo.cursos.forEach(curso => {
              const cursoHoras = curso.horas ? ` (${curso.horas}h)` : ''
              context += `      - ${curso.nombre_curso}${cursoHoras}\n`
            })
          }
        })
      }

      const { materialesCiclo, materialesClase } = await getMaterialsByPensum(pensum)
      const materialsContext = buildMaterialsContext(pensum, materialesCiclo, materialesClase)
      if (materialsContext) {
        context += `${materialsContext}\n`
      }
    } else if (prog.contenido) {
      // Para programas no detectados, solo mostrar un resumen del contenido
      const contenidoResumen = prog.contenido.substring(0, 150)
      context += `  📝 Temario: ${contenidoResumen}${prog.contenido.length > 150 ? '...' : ''}\n`
    }
  }

  // Mostrar grupos disponibles si hay un programa detectado
  if (detectedProgram) {
    context += `\n### 📖 Grupos Disponibles del Programa "${detectedProgram.nombre}":\n`
    if (courses.length > 0) {
      courses.forEach(course => {
        const matriculados = course.matriculados || 0
        const cupos = course.cupos || 0
        const disponibles = course.cupos_disponibles || 0
        
        context += `
- **${course.nombre}**
  📅 Inicio: ${course.fecha_inicio || 'A confirmar'} | Fin: ${course.fecha_fin || 'A confirmar'}
  ⏰ Horario: ${course.horario || 'A confirmar'}
  👥 Cupos: ${matriculados}/${cupos} (${disponibles} disponibles)
  👨‍🏫 Profesor: ${course.profesor_nombre || 'A confirmar'}\n`
      })
      context += `\n💰 Inversión: Ver información del programa arriba\n`
    } else {
      context += `No hay grupos disponibles para este programa en este momento.\n`
    }
  } else if (courses.length === 1) {
    const course = courses[0]!
    const matriculados = course.matriculados || 0
    const cupos = course.cupos || 0
    const disponibles = course.cupos_disponibles || 0

    context += `\n### 📖 Grupo Activo Actual (Total: 1):\n`
    context += `- **${course.nombre}** (${course.programa_nombre || 'Programa'})\n`
    context += `  📅 Inicio: ${course.fecha_inicio || 'A confirmar'} | Fin: ${course.fecha_fin || 'A confirmar'}\n`
    context += `  ⏰ Horario: ${course.horario || 'A confirmar'}\n`
    context += `  👥 Cupos: ${matriculados}/${cupos} (${disponibles} disponibles)\n`
    context += `  👨‍🏫 Profesor: ${course.profesor_nombre || 'A confirmar'}\n`
  }

  context += `
Cuando un cliente pregunte por un programa específico, muestra sus grupos con horarios, fechas y cupos disponibles.
Los PRECIOS están siempre en el PROGRAMA (nivel superior), NO en los grupos individuales.
Si pregunta "¿Qué programas tienen?", lista todos los programas con precios, duración y temario.
Si pregunta "¿Cuándo inicia [programa]?", muestra los grupos disponibles con sus fechas y horarios específicos.
Si pregunta "¿Cuánto cuesta [programa]?", usa el precio del PROGRAMA (inscripción + mensualidad).
Si pregunta "¿Qué se ve en [programa]?", muestra el temario detallado por ciclos que aparece arriba.
Si pregunta por materiales del programa, responde según su intención:
- Si menciona ciclo/nivel/general/kit, usa "Materiales por Ciclo".
- Si menciona tema/clase/sesión/módulo, usa "Materiales por Tema/Clase".
- Si no especifica, pregunta brevemente: "¿Los necesitas por ciclo o por tema?".
Si solo hay 1 grupo activo en total, dilo directo y muestra sus detalles.
Si preguntan por el profesor, usa el nombre del profesor del grupo mostrado (si no hay, responde "A confirmar").
`

  return context.trim()
}

export function buildCoursesContext(courses: CourseInfo[]): string {
  if (!courses.length) {
    return 'No hay cursos disponibles actualmente.'
  }

  const context = `
## INFORMACIÓN DE CURSOS DISPONIBLES

Tenemos los siguientes cursos activos:

${courses
  .map((course) => {
    const status = course.cupos_disponibles > 0 ? '✅ DISPONIBLE' : '❌ LLENO'
    return `- **${course.nombre}** (${course.programa_nombre}): ${status}
  Matriculados: ${course.matriculados}/${course.cupos}
  Horario: ${course.horario || 'A confirmar'}
  Inicio: ${course.fecha_inicio || 'A confirmar'}
  Fin: ${course.fecha_fin || 'A confirmar'}
  ${course.precio_inscripcion ? `Cuota de inscripción: $${course.precio_inscripcion}` : ''}
  ${course.precio_mensualidad ? `Mensualidad: $${course.precio_mensualidad}` : ''}
  Profesor: ${course.profesor_nombre || 'A confirmar'}`
  })
  .join('\n\n')}

Cuando un cliente pregunte por cursos, horarios o disponibilidad, usa esta información para dar respuestas precisas.
Si preguntan por un curso específico, menciona cupos disponibles, horario exacto y precio.
`

  return context.trim()
}
