"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { 
  Card, Typography, Spin, Tag, Button, Space, Select, DatePicker, Row, Col, Badge, Divider, Tooltip, Grid
} from "antd";
import { 
  CalendarOutlined, ClockCircleOutlined, UserOutlined, TeamOutlined,
  LeftOutlined, RightOutlined, EyeOutlined, BarChartOutlined, UnorderedListOutlined
} from "@ant-design/icons";
import { useNavigation } from "@refinedev/core";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { logger } from "@utils/logger";
import dayjs, { Dayjs } from "dayjs";
import isoWeek from 'dayjs/plugin/isoWeek';
import isBetween from 'dayjs/plugin/isBetween';
import 'dayjs/locale/es';

dayjs.extend(isoWeek);
dayjs.extend(isBetween);
dayjs.locale('es');

const { useBreakpoint } = Grid;

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

type ViewMode = 'timeline' | 'week' | 'month' | 'custom';

interface Curso {
  id: number;
  nombre: string;
  programa_id: number;
  profesor_id: number;
  estado: string;
  fecha_inicio: string;
  fecha_fin?: string;
  dias_semana?: string;
  hora_inicio?: string;
  hora_fin?: string;
  cupos: number;
  perfiles?: {
    nombre_completo: string;
  };
  programas?: {
    nombre: string;
    duracion: string;
  };
}

interface Clase {
  id: number;
  curso_id: number;
  fecha_hora: string;
  estado?: string | null;
  profesor_id?: string | null;
  perfiles?: {
    nombre_completo?: string | null;
  };
}

interface EventoCalendario {
  curso: Curso;
  clase?: Clase;
  estadoClase?: string;
}

export default function PlanificadorPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isTablet = screens.md && !screens.lg;
  const { show } = useNavigation();
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [inscritosPorCurso, setInscritosPorCurso] = useState<Record<number, number>>({});
  const [clases, setClases] = useState<Clase[]>([]);
  const [profesores, setProfesores] = useState<{ id: string; nombre_completo: string }[]>([]);
  const [profesorFiltro, setProfesorFiltro] = useState<string | null>(null);

  const dateRange = useMemo((): { start: Dayjs; end: Dayjs; title: string } => {
    if (viewMode === 'custom' && customRange) {
      return {
        start: customRange[0].startOf('day'),
        end: customRange[1].endOf('day'),
        title: `${customRange[0].format('DD-MMM-YYYY')} - ${customRange[1].format('DD-MMM-YYYY')}`
      };
    }

    if (viewMode === 'week') {
      const startOfWeek = currentDate.startOf('isoWeek');
      const endOfWeek = currentDate.endOf('isoWeek');
      return {
        start: startOfWeek,
        end: endOfWeek,
        title: `Semana del ${startOfWeek.format('DD-MMM')} al ${endOfWeek.format('DD-MMM-YYYY')}`
      };
    }

    const startOfMonth = currentDate.startOf('month');
    const endOfMonth = currentDate.endOf('month');
    return {
      start: startOfMonth,
      end: endOfMonth,
      title: currentDate.format('MMM YYYY').toUpperCase()
    };
  }, [viewMode, currentDate, customRange]);

  useEffect(() => {
    cargarProfesores();
  }, []);

  const cargarProfesores = async () => {
    try {
      const { data, error } = await supabaseBrowserClient
        .from("perfiles")
        .select("id, nombre_completo")
        .eq("rol", "profesor")
        .order("nombre_completo");

      if (!error && data) {
        setProfesores(data as { id: string; nombre_completo: string }[]);
      }
    } catch (err) {
      logger.error("Error cargando profesores:", err);
    }
  };

  const cargarInscritosPorCurso = useCallback(async (cursoIds: number[]) => {
    if (!cursoIds.length) {
      setInscritosPorCurso({});
      return;
    }

    try {
      const { data } = await supabaseBrowserClient
        .from("matriculas")
        .select("curso_id")
        .in("curso_id", cursoIds)
        .neq("estado", "cancelado");

      const conteos: Record<number, number> = {};
      cursoIds.forEach(id => {
        conteos[id] = (data || []).filter((m: any) => m.curso_id === id).length;
      });
      setInscritosPorCurso(conteos);
    } catch (error) {
      logger.error("Error cargando inscritos:", error);
    }
  }, []);

  const cargarClases = useCallback(async (cursoIds: number[], start: Dayjs, end: Dayjs) => {
    if (!cursoIds.length) {
      setClases([]);
      return;
    }

    try {
      let query = supabaseBrowserClient
        .from("clases")
        .select("id, curso_id, fecha_hora, estado, profesor_id, perfiles:profesor_id (nombre_completo)")
        .in("curso_id", cursoIds)
        .gte("fecha_hora", start.startOf('day').toISOString())
        .lte("fecha_hora", end.endOf('day').toISOString());

      if (profesorFiltro) {
        query = query.eq("profesor_id", profesorFiltro);
      }

      const { data, error } = await query;

      if (!error && data) {
        setClases(data as unknown as Clase[]);
      } else {
        setClases([]);
      }
    } catch (err) {
      logger.error("Error cargando clases:", err);
      setClases([]);
    }
  }, [profesorFiltro]);

  const cargarCursos = useCallback(async () => {
    setLoading(true);
    const rango = dateRange;
    try {
      let query = supabaseBrowserClient
        .from("cursos")
        .select(`*, perfiles (nombre_completo), programas (nombre, duracion)`)
        .in('estado', ['activo', 'proximo'])
        .order("fecha_inicio", { ascending: true });

      if (profesorFiltro) {
        query = query.eq("profesor_id", profesorFiltro);
      }

      const { data, error } = await query;

      if (!error && data) {
        setCursos(data || []);
        const cursoIds = data.map((c: any) => c.id);

        if (cursoIds.length) {
          await Promise.all([
            cargarInscritosPorCurso(cursoIds),
            cargarClases(cursoIds, rango.start, rango.end),
          ]);
        } else {
          setInscritosPorCurso({});
          setClases([]);
        }
      } else {
        setCursos([]);
        setClases([]);
        setInscritosPorCurso({});
      }
    } catch (err) {
      logger.error("Error cargando cursos:", err);
      setCursos([]);
      setClases([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange, profesorFiltro, cargarInscritosPorCurso, cargarClases]);

  useEffect(() => {
    cargarCursos();
  }, [cargarCursos]);

  // Filtrar cursos que están en el rango de fechas
  const cursosEnRango = cursos.filter(curso => {
    if (!curso.fecha_inicio) return false;
    
    const fechaInicio = dayjs(curso.fecha_inicio);
    const fechaFin = curso.fecha_fin ? dayjs(curso.fecha_fin) : fechaInicio.add(6, 'month'); // Si no hay fecha fin, asumimos 6 meses
    
    // El curso está en rango si su periodo se solapa con el rango visible
    return fechaInicio.isBefore(dateRange.end) && fechaFin.isAfter(dateRange.start);
  });

  // Generar array de días según el modo de vista
  const getDaysArray = (): Dayjs[] => {
    const days: Dayjs[] = [];
    let current = dateRange.start;
    
    while (current.isBefore(dateRange.end) || current.isSame(dateRange.end, 'day')) {
      days.push(current);
      current = current.add(1, 'day');
    }
    
    return days;
  };

  // Verificar si un curso tiene clase en un día específico
  const cursoTieneClaseEnDia = (curso: Curso, dia: Dayjs): boolean => {
    if (!curso.fecha_inicio) return false;
    
    const fechaInicio = dayjs(curso.fecha_inicio);
    const fechaFin = curso.fecha_fin ? dayjs(curso.fecha_fin) : fechaInicio.add(6, 'month');
    
    // Verificar si el día está dentro del rango del curso
    if (!dia.isBetween(fechaInicio, fechaFin, 'day', '[]')) {
      return false;
    }
    
    // Verificar si el día de la semana coincide
    if (curso.dias_semana) {
      const diasArray = curso.dias_semana.toLowerCase().split(',').map(d => d.trim());
      const diaActual = dia.format('dddd').toLowerCase();
      return diasArray.includes(diaActual);
    }
    
    return false;
  };

  // Navegar entre períodos
  const navigatePeriod = (direction: 'prev' | 'next') => {
    if (viewMode === 'week') {
      setCurrentDate(direction === 'next' 
        ? currentDate.add(1, 'week')
        : currentDate.subtract(1, 'week')
      );
    } else if (viewMode === 'month') {
      setCurrentDate(direction === 'next'
        ? currentDate.add(1, 'month')
        : currentDate.subtract(1, 'month')
      );
    }
  };

  // Obtener color del tag según estado
  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'activo': return '#059669';
      case 'proximo': return '#0284C7';
      case 'finalizado': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const daysArray = getDaysArray();

  const cursosPorId = useMemo(() => {
    const map: Record<number, Curso> = {};
    cursos.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [cursos]);

  const clasesPorFecha = useMemo(() => {
    const map: Record<string, Clase[]> = {};
    clases.forEach((clase) => {
      const fecha = dayjs(clase.fecha_hora).format('YYYY-MM-DD');
      if (!map[fecha]) map[fecha] = [];
      map[fecha].push(clase);
    });
    return map;
  }, [clases]);

  const getEstadoClaseProps = (estado?: string) => {
    const normalized = (estado || 'programada').toLowerCase();
    switch (normalized) {
      case 'cancelada':
        return { color: '#DC2626', label: 'Cancelada', border: '#DC2626' };
      case 'reprogramada':
        return { color: '#D97706', label: 'Reprogramada', border: '#D97706' };
      case 'dictada':
      case 'completada':
        return { color: '#059669', label: 'Dictada', border: '#059669' };
      default:
        return { color: '#0284C7', label: 'Programada', border: '#0284C7' };
    }
  };

  const getHoraEvento = (evento: EventoCalendario) => {
    if (evento.clase?.fecha_hora) {
      return dayjs(evento.clase.fecha_hora);
    }

    if (evento.curso.hora_inicio) {
      return dayjs(evento.curso.hora_inicio, 'HH:mm:ss');
    }

    return dayjs().hour(23).minute(59);
  };

  const getRangoEvento = (evento: EventoCalendario) => {
    const inicio = getHoraEvento(evento);
    // Usamos hora_fin del curso o 1 hora por defecto
    const fin = evento.curso.hora_fin
      ? dayjs(evento.curso.hora_fin, 'HH:mm:ss')
      : inicio.add(1, 'hour');
    return { inicio, fin };
  };

  const marcarConflictos = (eventos: EventoCalendario[]) => {
    const conflictivos = new Set<string>();
    for (let i = 0; i < eventos.length; i++) {
      for (let j = i + 1; j < eventos.length; j++) {
        const eventoA = eventos[i];
        const eventoB = eventos[j];

        if (!eventoA || !eventoB) {
          continue;
        }

        const { inicio: aIni, fin: aFin } = getRangoEvento(eventoA);
        const { inicio: bIni, fin: bFin } = getRangoEvento(eventoB);
        const seSolapan = aIni.isBefore(bFin) && bIni.isBefore(aFin);
        if (seSolapan) {
          conflictivos.add(`${i}`);
          conflictivos.add(`${j}`);
        }
      }
    }
    return conflictivos;
  };

  const obtenerEventosDelDia = (dia: Dayjs): EventoCalendario[] => {
    const fechaClave = dia.format('YYYY-MM-DD');
    const clasesDelDia = (clasesPorFecha[fechaClave] || [])
      .map((clase) => {
        const curso = cursosPorId[clase.curso_id];
        if (!curso) return null;
        return {
          curso,
          clase,
          estadoClase: (clase.estado || 'programada').toLowerCase(),
        } as EventoCalendario;
      })
      .filter(Boolean) as EventoCalendario[];

    const cursosConClaseEnFecha = new Set(clasesDelDia.map((e) => e.curso.id));
    const cursosCanceladosEnFecha = new Set(
      clasesDelDia
        .filter((e) => e.estadoClase === 'cancelada')
        .map((e) => e.curso.id)
    );

    const eventosAuto = cursosEnRango
      .filter((curso) =>
        !cursosCanceladosEnFecha.has(curso.id) &&
        cursoTieneClaseEnDia(curso, dia) &&
        !cursosConClaseEnFecha.has(curso.id)
      )
      .map((curso) => ({ curso, estadoClase: 'programada' as const }));

    return [...clasesDelDia, ...eventosAuto];
  };

  // Vista de lista agrupada por día
  const renderListView = () => {
    let hayEventos = false;
    return (
      <div>
        {daysArray.map(dia => {
          const eventosDelDia = obtenerEventosDelDia(dia).sort((a, b) => getHoraEvento(a).diff(getHoraEvento(b)));
          const conflictos = marcarConflictos(eventosDelDia);
          
          if (eventosDelDia.length === 0) return null;
          hayEventos = true;
          
          return (
            <Card 
              key={dia.format('YYYY-MM-DD')}
              style={{ marginBottom: 16 }}
              title={
                <Space>
                  <CalendarOutlined />
                  <Text strong>{dia.format('dddd DD-MMM-YYYY').toUpperCase()}</Text>
                  <Badge count={eventosDelDia.length} style={{ backgroundColor: '#059669' }} />
                </Space>
              }
            >
              <Row gutter={[16, 16]}>
                {eventosDelDia.map((evento, idx) => {
                  const inscritos = inscritosPorCurso[evento.curso.id] || 0;
                  const disponibles = Math.max(0, evento.curso.cupos - inscritos);
                  const estadoClaseProps = getEstadoClaseProps(evento.estadoClase);
                  const esCancelada = estadoClaseProps.label === 'Cancelada';
                  const horaInicio = getHoraEvento(evento);
                  const horaFin = evento.curso.hora_fin ? dayjs(evento.curso.hora_fin, 'HH:mm:ss') : null;
                  const profesorNombre = evento.clase?.perfiles?.nombre_completo || evento.curso.perfiles?.nombre_completo;
                  const enConflicto = conflictos.has(`${idx}`);

                  return (
                    <Col xs={24} sm={12} md={8} lg={6} key={`${evento.curso.id}-${evento.clase?.id || horaInicio.valueOf()}`}>
                      <Card
                        size="small"
                        hoverable={!esCancelada}
                        onClick={esCancelada ? undefined : () => show("cursos", evento.curso.id)}
                        style={{ 
                          borderLeft: `4px solid ${enConflicto ? '#DC2626' : estadoClaseProps.border || '#0284C7'}`,
                          height: '100%',
                          opacity: esCancelada ? 0.85 : 1,
                          background: esCancelada ? '#FEE2E2' : enConflicto ? '#FEF2F2' : undefined
                        }}
                      >
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text strong ellipsis={{ tooltip: true }}>
                              {evento.curso.programas?.nombre || evento.curso.nombre}
                            </Text>
                            {enConflicto && (
                              <Tag color="red" style={{ fontSize: 10 }}>Conflicto</Tag>
                            )}
                            {evento.clase && evento.estadoClase !== 'programada' && (
                              <Tooltip title="Clase reprogramada/registrada manualmente">
                                <Tag color={estadoClaseProps.color} style={{ fontSize: 10 }}>
                                  {estadoClaseProps.label}
                                </Tag>
                              </Tooltip>
                            )}
                          </div>

                          {(evento.clase || evento.curso.hora_inicio) && (
                            <div>
                              <ClockCircleOutlined style={{ marginRight: 4 }} />
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {horaInicio.format('h:mm A')}
                                {horaFin && ` - ${horaFin.format('h:mm A')}`}
                              </Text>
                            </div>
                          )}
                          
                          {profesorNombre && (
                            <div>
                              <UserOutlined style={{ marginRight: 4 }} />
                              <Text type="secondary" style={{ fontSize: 12 }} ellipsis={{ tooltip: true }}>
                                {profesorNombre}
                              </Text>
                            </div>
                          )}
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Tag color={getEstadoColor(evento.curso.estado)} style={{ fontSize: 11 }}>
                              {evento.curso.estado}
                            </Tag>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              <TeamOutlined /> {inscritos}/{evento.curso.cupos}
                            </Text>
                          </div>
                          
                          <div style={{ fontSize: 11, color: '#999' }}>
                            Inicia: {dayjs(evento.curso.fecha_inicio).format('DD-MMM-YYYY')}
                            {evento.curso.fecha_fin && (
                              <><br/>Termina: {dayjs(evento.curso.fecha_fin).format('DD-MMM-YYYY')}</>
                            )}
                          </div>
                        </Space>
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            </Card>
          );
        })}
        
        {!hayEventos && (
          <Card>
            <div style={{ textAlign: 'center', padding: 40 }}>
              <CalendarOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
              <Text type="secondary">No hay cursos activos en este período</Text>
            </div>
          </Card>
        )}
      </div>
    );
  };

  // Vista Timeline: muestra todos los cursos como barras horizontales con su duración completa
  const renderTimelineView = () => {
    const cursosConFecha = cursos.filter(
      (curso): curso is Curso & { fecha_inicio: string } => Boolean(curso.fecha_inicio)
    );

    if (cursosConFecha.length === 0) {
      return (
        <Card>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <CalendarOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
            <Text type="secondary">No hay cursos activos</Text>
          </div>
        </Card>
      );
    }

    const cursosOrdenados = [...cursosConFecha].sort((a, b) => {
      return dayjs(a.fecha_inicio).valueOf() - dayjs(b.fecha_inicio).valueOf();
    });

    const [primerCurso] = cursosOrdenados;
    if (!primerCurso) {
      return null;
    }
    const referenciaInicio = dayjs(primerCurso.fecha_inicio);

    // Calcular el rango total de fechas
    const fechaMasAntigua = cursosOrdenados.reduce((min, c) => {
      const fecha = dayjs(c.fecha_inicio);
      return fecha.isBefore(min) ? fecha : min;
    }, referenciaInicio);

    const fechaMasLejana = cursosOrdenados.reduce((max, c) => {
      const fechaFin = c.fecha_fin 
        ? dayjs(c.fecha_fin)
        : dayjs(c.fecha_inicio).add(
            c.programas?.duracion ? parseInt(c.programas.duracion, 10) : 6,
            'month'
          );
      return fechaFin.isAfter(max) ? fechaFin : max;
    }, referenciaInicio);

    const totalDias = Math.max(fechaMasLejana.diff(fechaMasAntigua, 'day'), 1);
    const totalMeses = Math.max(Math.ceil(fechaMasLejana.diff(fechaMasAntigua, 'month', true)), 1);

    // Colores para diferenciar cursos - Paleta profesional con buen contraste
    const colores = [
      '#5B21B6', // Púrpura oscuro
      '#059669', // Verde esmeralda
      '#0284C7', // Azul cyan
      '#DC2626', // Rojo
      '#7C3AED', // Violeta
      '#0891B2', // Cyan
      '#D97706', // Ámbar
      '#DB2777', // Rosa
      '#2563EB', // Azul
      '#16A34A', // Verde
    ];

    const getCursoColor = (index: number) => colores[index % colores.length];

    // Generar marcadores de meses en el eje X
    const mesesArray: Dayjs[] = [];
    let mesActual = fechaMasAntigua.startOf('month');
    while (mesActual.isBefore(fechaMasLejana) || mesActual.isSame(fechaMasLejana, 'month')) {
      mesesArray.push(mesActual);
      mesActual = mesActual.add(1, 'month');
    }

    return (
      <Card>
        <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
          {/* Encabezado de meses */}
          <div style={{ 
            display: 'flex', 
            borderBottom: '2px solid #d9d9d9',
            marginBottom: 16,
            position: 'sticky',
            top: 0,
            background: 'white',
            zIndex: 10,
            paddingTop: 8
          }}>
            <div style={{ width: 250, flexShrink: 0, paddingRight: 16 }}>
              <Text strong>Curso / Programa</Text>
            </div>
            <div style={{ display: 'flex', flex: 1, minWidth: Math.max(800, totalMeses * 100) }}>
              {mesesArray.map(mes => {
                const diasEnMes = mes.daysInMonth();
                const porcentajeAncho = diasEnMes / totalDias * 100;
                
                return (
                  <div 
                    key={mes.format('YYYY-MM')}
                    style={{
                      width: `${porcentajeAncho}%`,
                      textAlign: 'center',
                      borderRight: '1px solid #f0f0f0',
                      padding: '4px 0',
                      fontSize: 12
                    }}
                  >
                    <Text strong>{mes.format('MMM YYYY')}</Text>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Barras de cursos */}
          <div>
            {cursosOrdenados.map((curso, index) => {
              const fechaInicio = dayjs(curso.fecha_inicio);
              const fechaFin = curso.fecha_fin 
                ? dayjs(curso.fecha_fin)
                : fechaInicio.add(
                    curso.programas?.duracion ? parseInt(curso.programas.duracion) : 6,
                    'month'
                  );

              const diasDesdeinicio = fechaInicio.diff(fechaMasAntigua, 'day');
              const duracionDias = fechaFin.diff(fechaInicio, 'day');
              
              const porcentajeLeft = (diasDesdeinicio / totalDias) * 100;
              const porcentajeWidth = (duracionDias / totalDias) * 100;

              const inscritos = inscritosPorCurso[curso.id] || 0;
              const color = getCursoColor(index);

              // Obtener días de clase
              const diasClase = curso.dias_semana 
                ? curso.dias_semana.split(',').map(d => d.trim()).join(', ')
                : 'No especificado';

              const horario = curso.hora_inicio && curso.hora_fin
                ? `${dayjs(curso.hora_inicio, 'HH:mm:ss').format('h:mm A')} - ${dayjs(curso.hora_fin, 'HH:mm:ss').format('h:mm A')}`
                : 'No especificado';

              return (
                <div 
                  key={curso.id}
                  style={{ 
                    display: 'flex',
                    marginBottom: 12,
                    alignItems: 'center',
                    minHeight: 60
                  }}
                >
                  {/* Información del curso (columna izquierda) */}
                  <div style={{ 
                    width: 250, 
                    flexShrink: 0, 
                    paddingRight: 16
                  }}>
                    <Tooltip title="Ver detalles del curso">
                      <div 
                        onClick={() => show("cursos", curso.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <Text strong ellipsis style={{ display: 'block' }}>
                          {curso.programas?.nombre || curso.nombre}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                          <UserOutlined /> {curso.perfiles?.nombre_completo || 'Sin profesor'}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                          <TeamOutlined /> {inscritos}/{curso.cupos} estudiantes
                        </Text>
                        <Tag color={getEstadoColor(curso.estado)} style={{ fontSize: 10, marginTop: 4 }}>
                          {curso.estado}
                        </Tag>
                      </div>
                    </Tooltip>
                  </div>

                  {/* Barra de tiempo */}
                  <div style={{ 
                    flex: 1, 
                    position: 'relative',
                    minWidth: Math.max(800, totalMeses * 100),
                    height: 50
                  }}>
                    <Tooltip
                      title={
                        <div>
                          <div><strong>{curso.programas?.nombre || curso.nombre}</strong></div>
                          <Divider style={{ margin: '8px 0', borderColor: 'rgba(255,255,255,0.3)' }} />
                          <div>Inicio: {fechaInicio.format('DD/MMM/YYYY')}</div>
                          <div>Fin: {fechaFin.format('DD/MMM/YYYY')}</div>
                          <div>Duración: {Math.ceil(fechaFin.diff(fechaInicio, 'month', true))} meses</div>
                          <Divider style={{ margin: '8px 0', borderColor: 'rgba(255,255,255,0.3)' }} />
                          <div><ClockCircleOutlined /> {diasClase}</div>
                          <div>{horario}</div>
                        </div>
                      }
                    >
                      <div
                        onClick={() => show("cursos", curso.id)}
                        style={{
                          position: 'absolute',
                          left: `${porcentajeLeft}%`,
                          width: `${porcentajeWidth}%`,
                          height: 40,
                          backgroundColor: color,
                          borderRadius: 6,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                          transition: 'all 0.3s',
                          overflow: 'hidden',
                          padding: '0 8px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                        }}
                      >
                        <div style={{ 
                          color: 'white', 
                          fontSize: 11,
                          fontWeight: 600,
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {diasClase} • {horario}
                        </div>
                      </div>
                    </Tooltip>

                    {/* Marcador de inicio */}
                    <div
                      style={{
                        position: 'absolute',
                        left: `${porcentajeLeft}%`,
                        top: -8,
                        fontSize: 10,
                        color: '#6B7280',
                        fontWeight: 500,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {fechaInicio.format('DD/MMM')}
                    </div>

                    {/* Marcador de fin */}
                    <div
                      style={{
                        position: 'absolute',
                        left: `${porcentajeLeft + porcentajeWidth}%`,
                        top: -8,
                        fontSize: 10,
                        color: '#6B7280',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        transform: 'translateX(-100%)'
                      }}
                    >
                      {fechaFin.format('DD/MMM')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Leyenda */}
          <Divider />
          <div style={{ textAlign: 'center', paddingTop: 16 }}>
            <Space wrap>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <strong>Total:</strong> {cursosOrdenados.length} curso(s)
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <strong>Período:</strong> {fechaMasAntigua.format('DD/MMM/YYYY')} - {fechaMasLejana.format('DD/MMM/YYYY')}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <strong>Duración total:</strong> {totalMeses} meses
              </Text>
            </Space>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div style={{ padding: isMobile ? 12 : isTablet ? 16 : 24 }}>
      <Card style={{ marginBottom: isMobile ? 16 : 24 }}>
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col xs={24} md={12}>
            <Title level={isMobile ? 4 : 3} style={{ margin: 0 }}>
              <CalendarOutlined /> {isMobile ? "Planificador" : "Planificador de Cursos"}
            </Title>
          </Col>
          
          <Col xs={24} md={12}>
            <Space size={isMobile ? 8 : "middle"} wrap style={{ width: isMobile ? "100%" : "auto" }}>
              <Select
                value={viewMode}
                onChange={(value) => {
                  setViewMode(value);
                  setCustomRange(null);
                }}
                size={isMobile ? "middle" : "large"}
                style={{ width: isMobile ? "100%" : 150 }}
              >
                <Select.Option value="timeline">
                  <BarChartOutlined /> Timeline
                </Select.Option>
                <Select.Option value="week">
                  <UnorderedListOutlined /> Semana
                </Select.Option>
                <Select.Option value="month">
                  <UnorderedListOutlined /> Mes
                </Select.Option>
                <Select.Option value="custom">
                  <UnorderedListOutlined /> Rango
                </Select.Option>
              </Select>
              
              {viewMode === 'custom' ? (
                <RangePicker
                  value={customRange}
                  onChange={(dates) => setCustomRange(dates ? (dates as [Dayjs, Dayjs]) : null)}
                  format="DD MMM YYYY"
                  size={isMobile ? "middle" : "large"}
                  style={{ width: isMobile ? "100%" : "auto" }}
                />
              ) : viewMode !== 'timeline' ? (
                <Space.Compact size={isMobile ? "middle" : "large"} style={{ width: isMobile ? "100%" : "auto" }}>
                  <Button icon={<LeftOutlined />} onClick={() => navigatePeriod('prev')} />
                  <Button onClick={() => setCurrentDate(dayjs())}>{isMobile ? "Hoy" : "Hoy"}</Button>
                  <Button icon={<RightOutlined />} onClick={() => navigatePeriod('next')} />
                </Space.Compact>
              ) : null}

              <Select
                allowClear
                showSearch
                placeholder={isMobile ? "Profesor" : "Todos los profesores"}
                optionFilterProp="label"
                value={profesorFiltro || undefined}
                onChange={(value) => setProfesorFiltro(value || null)}
                size={isMobile ? "middle" : "large"}
                style={{ minWidth: isMobile ? "100%" : 220 }}
                options={profesores.map((p) => ({ value: p.id, label: p.nombre_completo }))}
              />
            </Space>
          </Col>
        </Row>
        
        <Divider />
        
        {viewMode !== 'timeline' && (
          <Row justify="center">
            <Col>
              <Title level={4} style={{ margin: 0, textAlign: 'center' }}>
                {dateRange.title}
              </Title>
            </Col>
          </Row>
        )}
      </Card>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: "#666" }}>Cargando cursos...</div>
        </div>
      ) : viewMode === 'timeline' ? (
        renderTimelineView()
      ) : (
        renderListView()
      )}
    </div>
  );
}
