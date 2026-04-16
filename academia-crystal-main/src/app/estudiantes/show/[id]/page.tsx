"use client";

import React, { useEffect, useState } from "react";
import { Show } from "@refinedev/antd";
import { 
  Typography, Row, Col, Card, Button, 
  Statistic, Table, Tag, Timeline, Calendar, Badge,
  Spin, Avatar, Alert, Progress, Tabs, message 
} from "antd";
import { 
  UserOutlined, CalendarOutlined, DollarCircleOutlined, 
  ReadOutlined, TrophyOutlined, ClockCircleOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { Dayjs } from 'dayjs';
import { useParams } from "next/navigation"; 
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const { Title, Text } = Typography;

export default function StudentDashboard() {
  const params = useParams();
  const idEstudiante = params?.id as string;
  const [messageApi, contextHolder] = message.useMessage();

  // Estados
  const [loading, setLoading] = useState(true);
  const [perfil, setPerfil] = useState<any>(null);
  const [matriculaActiva, setMatriculaActiva] = useState<any>(null);
  
  // Datos específicos
  const [asistencias, setAsistencias] = useState<any[]>([]);
  const [calificaciones, setCalificaciones] = useState<any[]>([]);
  const [proximoPago, setProximoPago] = useState<string | null>(null);
  const [estadisticas, setEstadisticas] = useState({
    asistidas: 0,
    faltas: 0,
    promedio: 0
  });

  useEffect(() => {
    if (idEstudiante) cargarDatosEstudiante();
  }, [idEstudiante]);

  const cargarDatosEstudiante = async () => {
    try {
      setLoading(true);

      // 1. Perfil
      const { data: dataPerfil, error: errPerfil } = await supabase
        .from("perfiles")
        .select("*")
        .eq("id", idEstudiante)
        .single();
      if (errPerfil) throw errPerfil;
      setPerfil(dataPerfil);

      // 2. Buscar Matrícula Activa
      const { data: dataMatricula, error: errMat } = await supabase
        .from("matriculas")
        .select(`
            id, fecha_inicio, estado,
            cursos ( id, nombre, descripcion, precio_mensualidad, perfiles(nombre_completo) )
        `)
        .eq("estudiante_id", idEstudiante)
        .eq("estado", "activo")
        .single(); // Asumimos una activa a la vez

      if (dataMatricula) {
        setMatriculaActiva(dataMatricula);

        // 3. Asistencias
        const { data: dataAsis } = await supabase
            .from("asistencias")
            .select("fecha, estado, tema:temas_curso(titulo)")
            .eq("matricula_id", dataMatricula.id);
        
        const listaAsis = dataAsis || [];
        setAsistencias(listaAsis);

        // Calcular asistencias/faltas
        const total = listaAsis.length;
        const presentes = listaAsis.filter((a: any) => a.estado === 'presente').length;
        const faltas = listaAsis.filter((a: any) => a.estado === 'ausente').length;

        // 4. Calificaciones (Asumiendo tabla 'calificaciones')
        // Si no tienes esta tabla, esto vendrá vacío y no romperá el código.
        const { data: dataNotas } = await supabase
            .from("calificaciones") 
            .select("*")
            .eq("matricula_id", dataMatricula.id);
            
        const notas = dataNotas || [];
        setCalificaciones(notas);

        // Calcular Promedio
        const sumaNotas = notas.reduce((acc: number, curr: any) => acc + (curr.nota || 0), 0);
        const promedio = notas.length > 0 ? (sumaNotas / notas.length).toFixed(1) : 0;

        setEstadisticas({ 
            asistidas: presentes, 
            faltas: faltas, 
            promedio: Number(promedio) 
        });

        // 5. Calcular Próximo Pago (Lógica simple)
        // Buscamos el último pago realizado
        const { data: ultimosPagos } = await supabase
            .from("pagos")
            .select("fecha_pago, periodo_pagado")
            .eq("matricula_id", dataMatricula.id)
            .order("fecha_pago", { ascending: false })
            .limit(1);

        let fechaProx = dayjs(dataMatricula.fecha_inicio).add(1, 'month');
        
        if (ultimosPagos && ultimosPagos.length > 0) {
            // Si ya pagó, el próximo es 1 mes después del último periodo pagado
            const ultimo = dayjs(ultimosPagos[0].fecha_pago);
            fechaProx = ultimo.add(1, 'month');
        }
        
        setProximoPago(fechaProx.format("YYYY-MM-DD"));

      }
    } catch (error) {
      console.error(error);
      messageApi.error("Error cargando datos del estudiante");
    } finally {
      setLoading(false);
    }
  };

  // Renderizado de calendario para ver faltas visualmente
  const dateCellRender = (value: Dayjs) => {
    const fechaStr = value.format("YYYY-MM-DD");
    const asistenciaDia = asistencias.find((a: any) => a.fecha === fechaStr);

    if (asistenciaDia) {
      return (
        <Badge 
            status={asistenciaDia.estado === 'presente' ? 'success' : 'error'} 
            text={asistenciaDia.estado === 'presente' ? 'Asistió' : 'Faltó'} 
        />
      );
    }
    return null;
  };

  if (loading) return <div style={{padding:50, textAlign:'center'}}><Spin size="large" /></div>;

  return (
    <Show title="Portal del Estudiante" headerButtons={() => <Button href="/estudiantes">Volver a Lista</Button>}>
        {contextHolder}
        
        {/* ENCABEZADO PERFIL */}
        <Card style={{marginBottom: 24, background: 'linear-gradient(to right, #4facfe 0%, #00f2fe 100%)', border:0}}>
            <Row align="middle" gutter={24}>
                <Col>
                    <Avatar size={80} style={{backgroundColor: '#fff', color: '#1890ff'}} icon={<UserOutlined />} />
                </Col>
                <Col>
                    <Title level={2} style={{color: '#fff', margin: 0}}>Hola, {perfil?.nombre_completo?.split(" ")[0]}</Title>
                    <Text style={{color: '#fff', opacity: 0.9}}>Bienvenido a tu panel académico</Text>
                </Col>
            </Row>
        </Card>

        {matriculaActiva ? (
            <>
                {/* TARJETAS DE RESUMEN (KPIs) */}
                <Row gutter={[16, 16]} style={{marginBottom: 24}}>
                    
                    {/* PRÓXIMO PAGO */}
                    <Col xs={24} sm={8}>
                        <Card hoverable>
                            <Statistic 
                                title="Próximo Pago" 
                                value={proximoPago || "Pendiente"} 
                                prefix={<CalendarOutlined />}
                                valueStyle={ dayjs(proximoPago).isBefore(dayjs()) ? { color: '#cf1322' } : { color: '#3f8600' } }
                            />
                            {dayjs(proximoPago).isBefore(dayjs()) && <Tag color="red" style={{marginTop:10}}>Vencido</Tag>}
                            <Text type="secondary" style={{display:'block', marginTop: 5}}>Mensualidad Curso</Text>
                        </Card>
                    </Col>

                    {/* PROMEDIO */}
                    <Col xs={24} sm={8}>
                        <Card hoverable>
                            <Statistic 
                                title="Promedio Actual" 
                                value={estadisticas.promedio} 
                                precision={1}
                                prefix={<TrophyOutlined />}
                                suffix="/ 5.0"
                                valueStyle={{ color: '#1890ff' }}
                            />
                            <Progress percent={(estadisticas.promedio / 5) * 100} showInfo={false} size="small" />
                        </Card>
                    </Col>

                    {/* ASISTENCIA */}
                    <Col xs={24} sm={8}>
                        <Card hoverable>
                            <Statistic 
                                title="Clases Faltadas" 
                                value={estadisticas.faltas} 
                                prefix={<Alert message="" type="error" style={{padding:0, background:'transparent', border:0}} />}
                                valueStyle={{ color: estadisticas.faltas > 3 ? '#cf1322' : '#333' }}
                            />
                            <Text type="secondary">Has asistido a {estadisticas.asistidas} clases</Text>
                        </Card>
                    </Col>
                </Row>

                {/* CONTENIDO PRINCIPAL TABS */}
                <Card>
                    <Tabs defaultActiveKey="1" items={[
                        {
                            key: '1', 
                            label: <span><ReadOutlined /> Mi Curso</span>,
                            children: (
                                <div style={{padding: 20}}>
                                    <Title level={4}>{matriculaActiva.cursos.nombre}</Title>
                                    <p>{matriculaActiva.cursos.descripcion}</p>
                                    <Divider />
                                    <Row gutter={16}>
                                        <Col span={12}>
                                            <Statistic title="Profesor" value={matriculaActiva.cursos.perfiles?.nombre_completo || "No asignado"} valueStyle={{fontSize: 16}} />
                                        </Col>
                                        <Col span={12}>
                                            <Statistic title="Valor Mensualidad" value={matriculaActiva.cursos.precio_mensualidad} prefix="$" valueStyle={{fontSize: 16}} />
                                        </Col>
                                    </Row>
                                </div>
                            )
                        },
                        {
                            key: '2', 
                            label: <span><ClockCircleOutlined /> Asistencia</span>,
                            children: (
                                <Row gutter={24}>
                                    <Col xs={24} md={16}>
                                        <Alert message="Registro Visual" description="Los puntos verdes son asistencias, los rojos faltas." type="info" showIcon style={{marginBottom: 10}}/>
                                        <Calendar fullscreen={false} cellRender={dateCellRender} />
                                    </Col>
                                    <Col xs={24} md={8}>
                                        <Title level={5}>Historial de Faltas</Title>
                                        {asistencias.filter((a:any) => a.estado === 'ausente').length === 0 ? (
                                            <Alert message="¡Excelente! No tienes faltas." type="success" />
                                        ) : (
                                            <Timeline style={{marginTop: 20}}>
                                                {asistencias.filter((a:any) => a.estado === 'ausente').map((falta: any, idx: number) => (
                                                    <Timeline.Item color="red" key={idx}>
                                                        <Text strong>{falta.fecha}</Text>
                                                        <br/>
                                                        <Text type="secondary">Tema perdido: {falta.tema?.titulo || "No registrado"}</Text>
                                                    </Timeline.Item>
                                                ))}
                                            </Timeline>
                                        )}
                                    </Col>
                                </Row>
                            )
                        },
                        {
                            key: '3', 
                            label: <span><TrophyOutlined /> Calificaciones</span>,
                            children: (
                                <Table 
                                    dataSource={calificaciones}
                                    rowKey="id"
                                    pagination={false}
                                    columns={[
                                        { title: 'Actividad / Tema', dataIndex: 'concepto', key: 'concepto' },
                                        { title: 'Fecha', dataIndex: 'created_at', key: 'fecha', render: (val: string) => dayjs(val).format("DD/MM/YYYY") },
                                        { 
                                            title: 'Nota', 
                                            dataIndex: 'nota', 
                                            key: 'nota',
                                            render: (nota: number) => (
                                                <Tag color={nota >= 3 ? 'green' : 'red'}>{nota}</Tag>
                                            )
                                        },
                                        { title: 'Comentarios', dataIndex: 'observaciones', key: 'observaciones' }
                                    ]}
                                />
                            )
                        }
                    ]} />
                </Card>
            </>
        ) : (
            <Alert 
                message="No tienes matrícula activa" 
                description="Actualmente no estás inscrito en ningún curso activo. Contacta a administración." 
                type="warning" 
                showIcon 
            />
        )}
    </Show>
  );
}
import { Divider } from "antd"; // Asegurando importación de Divider usada arriba