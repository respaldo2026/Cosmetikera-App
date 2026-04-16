"use client";

import React, { useEffect, useState } from "react";
import { Typography, Row, Col, Card, Statistic, List, Avatar, Button, Spin, Tag, Divider } from "antd";
import { 
  DollarCircleOutlined, TeamOutlined, BookOutlined, 
  UserOutlined, RiseOutlined, FallOutlined, WalletOutlined, RightOutlined 
} from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { useNavigation } from "@refinedev/core"; // Usamos la navegación de Refine
import dayjs from "dayjs";
import 'dayjs/locale/es';

dayjs.locale('es');

const { Title, Text } = Typography;

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const { list } = useNavigation(); // Hook para navegar
  
  // Estadísticas
  const [stats, setStats] = useState({
    ingresosMes: 0,
    egresosMes: 0,
    estudiantesActivos: 0,
    cursosActivos: 0,
    profesores: 0
  });

  // Listas recientes
  const [ultimosPagos, setUltimosPagos] = useState<any[]>([]);

  useEffect(() => {
    cargarDashboardGeneral();
  }, []);

  const cargarDashboardGeneral = async () => {
    setLoading(true);
    try {
        const hoy = dayjs();
        const inicioMes = hoy.startOf('month').format('YYYY-MM-DD');

        // 1. Ingresos (Tabla 'pagos')
        const { data: pagosMes } = await supabaseBrowserClient
            .from("pagos")
            .select("monto")
            .gte("fecha_pago", inicioMes);
        
        const totalIngresos = pagosMes?.reduce((acc, curr) => acc + Number(curr.monto), 0) || 0;

        // 2. Egresos (Tabla 'pagos_nomina')
        const { data: nominaMes } = await supabaseBrowserClient
            .from("pagos_nomina")
            .select("monto")
            .gte("fecha_pago", inicioMes);
            
        const totalEgresos = nominaMes?.reduce((acc, curr) => acc + Number(curr.monto), 0) || 0;

        // 3. Contadores básicos
        const { count: countEstudiantes } = await supabaseBrowserClient
            .from("matriculas")
            .select("*", { count: 'exact', head: true })
            .eq("estado", "activa");

        const { count: countProfes } = await supabaseBrowserClient
            .from("perfiles")
            .select("*", { count: 'exact', head: true })
            .eq("rol", "profesor");

        const { count: countCursos } = await supabaseBrowserClient
            .from("cursos")
            .select("*", { count: 'exact', head: true });

        // 4. Últimos Pagos
        const { data: dataUltimosPagos } = await supabaseBrowserClient
            .from("pagos")
            .select(`
                id, monto, created_at,
                perfiles (nombre_completo),
                matriculas ( cursos (nombre) )
            `)
            .order("created_at", { ascending: false })
            .limit(5);

        setStats({
            ingresosMes: totalIngresos,
            egresosMes: totalEgresos,
            estudiantesActivos: countEstudiantes || 0,
            cursosActivos: countCursos || 0,
            profesores: countProfes || 0
        });

        setUltimosPagos(dataUltimosPagos || []);

    } catch (error) {
        console.error("Error cargando dashboard:", error);
    } finally {
        setLoading(false);
    }
  };

  const balanceNeto = stats.ingresosMes - stats.egresosMes;

  // Función genérica para navegar
  const irA = (ruta: string) => {
      window.location.href = ruta;
  };

  if (loading) return <div style={{padding: 50, textAlign: 'center'}}><Spin size="large"/></div>;

  return (
    <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 24 }}>
            <Title level={2}>¡Hola, Directora! 👋</Title>
            <Text type="secondary">Resumen interactivo. Haz clic en las tarjetas para ver más detalles.</Text>
        </div>

        {/* --- TARJETAS FINANCIERAS (CLICKEABLES) --- */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            
            {/* INGRESOS -> Ir a Tesorería */}
            <Col xs={24} sm={8}>
                <Card 
                    hoverable 
                    onClick={() => irA('/tesoreria')}
                    style={{ background: '#f6ffed', borderColor: '#b7eb8f', height: '100%', cursor: 'pointer' }}
                >
                    <Statistic 
                        title={<div style={{display:'flex', justifyContent:'space-between'}}>Ingresos (Mes) <RightOutlined style={{fontSize:12}}/></div>}
                        value={stats.ingresosMes}
                        precision={0}
                        prefix={<DollarCircleOutlined style={{color: '#52c41a'}}/>}
                        valueStyle={{ color: '#3f8600', fontWeight: 'bold' }}
                        suffix="COP"
                    />
                    <div style={{ marginTop: 8, color: '#3f8600', fontSize: 12 }}>
                        <RiseOutlined /> Ver detalles en Tesorería
                    </div>
                </Card>
            </Col>

            {/* EGRESOS -> Ir a Nómina */}
            <Col xs={24} sm={8}>
                <Card 
                    hoverable
                    onClick={() => irA('/nomina')}
                    style={{ background: '#fff1f0', borderColor: '#ffa39e', height: '100%', cursor: 'pointer' }}
                >
                    <Statistic 
                        title={<div style={{display:'flex', justifyContent:'space-between'}}>Nómina (Mes) <RightOutlined style={{fontSize:12}}/></div>}
                        value={stats.egresosMes}
                        precision={0}
                        prefix={<FallOutlined style={{color: '#cf1322'}}/>}
                        valueStyle={{ color: '#cf1322', fontWeight: 'bold' }}
                        suffix="COP"
                    />
                    <div style={{ marginTop: 8, color: '#cf1322', fontSize: 12 }}>
                        <TeamOutlined /> Gestionar pagos a profesores
                    </div>
                </Card>
            </Col>

            {/* BALANCE -> Ir a Tesorería */}
            <Col xs={24} sm={8}>
                <Card 
                    hoverable
                    onClick={() => irA('/tesoreria')}
                    style={{ background: '#f0f5ff', borderColor: '#adc6ff', height: '100%', cursor: 'pointer' }}
                >
                    <Statistic 
                        title="Balance Neto"
                        value={balanceNeto}
                        precision={0}
                        prefix={<WalletOutlined style={{color: '#2f54eb'}}/>}
                        valueStyle={{ color: balanceNeto >= 0 ? '#1d39c4' : '#cf1322', fontWeight: 'bold' }}
                        suffix="COP"
                    />
                    <div style={{ marginTop: 8, color: '#1d39c4', fontSize: 12 }}>
                        Ganancia real operativa
                    </div>
                </Card>
            </Col>
        </Row>

        {/* --- TARJETAS OPERATIVAS (CLICKEABLES) --- */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            
            {/* ESTUDIANTES -> Ir a Matriculas/Estudiantes */}
            <Col xs={12} sm={8}>
                 <Card hoverable onClick={() => irA('/estudiantes')} style={{cursor: 'pointer'}}>
                    <Statistic 
                        title={<div style={{display:'flex', justifyContent:'space-between'}}>Estudiantes <RightOutlined style={{fontSize:10}}/></div>}
                        value={stats.estudiantesActivos} 
                        prefix={<UserOutlined style={{color: '#1890ff'}} />} 
                    />
                 </Card>
            </Col>
            
            {/* CURSOS -> Ir a Cursos */}
            <Col xs={12} sm={8}>
                 <Card hoverable onClick={() => irA('/cursos')} style={{cursor: 'pointer'}}>
                    <Statistic 
                        title={<div style={{display:'flex', justifyContent:'space-between'}}>Cursos <RightOutlined style={{fontSize:10}}/></div>}
                        value={stats.cursosActivos} 
                        prefix={<BookOutlined style={{color: '#fa8c16'}} />} 
                    />
                 </Card>
            </Col>
            
            {/* PROFESORES -> Ir a Profesores */}
            <Col xs={12} sm={8}>
                 <Card hoverable onClick={() => irA('/profesores')} style={{cursor: 'pointer'}}>
                    <Statistic 
                        title={<div style={{display:'flex', justifyContent:'space-between'}}>Profesores <RightOutlined style={{fontSize:10}}/></div>}
                        value={stats.profesores} 
                        prefix={<TeamOutlined style={{color: '#eb2f96'}} />} 
                    />
                 </Card>
            </Col>
        </Row>

        <Row gutter={24}>
            {/* ÚLTIMOS PAGOS */}
            <Col xs={24} lg={16}>
                <Card title="💰 Ingresos Recientes" extra={<Button type="link" onClick={() => irA('/tesoreria')}>Ver todo</Button>}>
                    <List
                        itemLayout="horizontal"
                        dataSource={ultimosPagos}
                        renderItem={(item) => (
                            <List.Item>
                                <List.Item.Meta
                                    avatar={<Avatar style={{backgroundColor: '#f6ffed', color: '#52c41a'}} icon={<DollarCircleOutlined />} />}
                                    title={<Text strong>{item.perfiles?.nombre_completo || "Estudiante"}</Text>}
                                    description={
                                        <span>
                                            {dayjs(item.created_at).format("DD MMM HH:mm")} • 
                                            {item.matriculas?.cursos?.nombre ? ` Curso: ${item.matriculas.cursos.nombre}` : ' Pago general'}
                                        </span>
                                    }
                                />
                                <div style={{fontWeight: 'bold', color: '#3f8600'}}>
                                    + ${Number(item.monto).toLocaleString()}
                                </div>
                            </List.Item>
                        )}
                    />
                    {ultimosPagos.length === 0 && <div style={{padding:20, textAlign:'center', color:'#999'}}>No hay pagos recientes</div>}
                </Card>
            </Col>

            {/* ACCESOS RÁPIDOS */}
            <Col xs={24} lg={8}>
                <Card title="⚡ Accesos Directos" style={{ height: '100%' }}>
                    <Button type="primary" block size="large" icon={<UserOutlined />} onClick={() => irA('/matriculas')} style={{ marginBottom: 15 }}>
                        Matricular Estudiante
                    </Button>
                    <Button block size="large" icon={<DollarCircleOutlined />} onClick={() => irA('/tesoreria/create')} style={{ marginBottom: 15 }}>
                        Registrar Ingreso
                    </Button>
                    <Button block size="large" danger icon={<FallOutlined />} onClick={() => irA('/nomina')} style={{ marginBottom: 15 }}>
                        Pagar Nómina
                    </Button>
                    
                    <Divider />
                    
                    <div style={{ background: '#fff7e6', padding: 15, borderRadius: 8, border: '1px solid #ffd591' }}>
                        <Text strong style={{ color: '#d46b08' }}>💡 Tip:</Text>
                        <p style={{ marginTop: 5, fontSize: 13, color: '#874d00' }}>
                           Haz clic en las tarjetas de colores arriba para ir directamente a administrar Estudiantes, Cursos o Finanzas.
                        </p>
                    </div>
                </Card>
            </Col>
        </Row>
    </div>
  );
}