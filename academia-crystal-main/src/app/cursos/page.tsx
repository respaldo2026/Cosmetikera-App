"use client";

import React, { useEffect, useState } from "react";
import { 
  List, Card, Typography, Tag, Button, Spin, Statistic, Divider, Tooltip, Tabs, Badge, Input 
} from "antd";
import { 
  PlusOutlined, EditOutlined, EyeOutlined, 
  CalendarOutlined, UserOutlined, SearchOutlined, HistoryOutlined, RocketOutlined, CheckCircleOutlined 
} from "@ant-design/icons";
import { useNavigation } from "@refinedev/core";
import { createClient } from "@supabase/supabase-js";
import dayjs from "dayjs";
import 'dayjs/locale/es'; // Importante para fechas en español

dayjs.locale('es');

const { Title, Text, Paragraph } = Typography;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CursosList() {
  const { edit, create, show } = useNavigation();
  const [cursos, setCursos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    cargarCursos();
  }, []);

  const cargarCursos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cursos")
      .select(`*, perfiles (nombre_completo)`)
      .order("fecha_inicio", { ascending: false }); // Los más nuevos primero

    if (!error) setCursos(data || []);
    setLoading(false);
  };

  // --- LÓGICA DE FILTRADO INTELIGENTE ---
  const hoy = dayjs();
  
  // 1. Filtrar por búsqueda de texto
  const cursosFiltrados = cursos.filter(c => 
      c.nombre.toLowerCase().includes(searchText.toLowerCase()) || 
      c.perfiles?.nombre_completo?.toLowerCase().includes(searchText.toLowerCase())
  );

  // 2. Clasificar en grupos (Buckets)
  const cursosEnCurso = cursosFiltrados.filter(c => 
      c.estado === 'activo' && c.fecha_inicio && dayjs(c.fecha_inicio).isBefore(hoy) && (!c.fecha_fin || dayjs(c.fecha_fin).isAfter(hoy))
  );

  const cursosProximos = cursosFiltrados.filter(c => 
      c.estado === 'activo' && c.fecha_inicio && dayjs(c.fecha_inicio).isAfter(hoy)
  );

  const cursosFinalizados = cursosFiltrados.filter(c => 
      c.estado === 'inactivo' || (c.fecha_fin && dayjs(c.fecha_fin).isBefore(hoy))
  );


  // COMPONENTE DE TARJETA REUTILIZABLE
  const CursoCard = ({ curso, tipo }: { curso: any, tipo: 'actual' | 'futuro' | 'pasado' }) => {
      let colorBanner = '#bfbfbf'; // Gris (Pasado)
      if (tipo === 'actual') colorBanner = 'linear-gradient(135deg, #13c2c2 0%, #006d75 100%)'; // Cyan
      if (tipo === 'futuro') colorBanner = 'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)'; // Morado

      return (
        <Card
            hoverable
            style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #f0f0f0', marginBottom: 20 }}
            actions={[
                <Tooltip title="Ver Aula" key="show"><Button type="text" icon={<EyeOutlined />} onClick={() => show("cursos", curso.id)}>Gestionar</Button></Tooltip>,
                <Tooltip title="Editar Datos" key="edit"><Button type="text" icon={<EditOutlined />} onClick={() => edit("cursos", curso.id)}>Editar</Button></Tooltip>,
            ]}
            cover={
                <div style={{ height: 80, background: colorBanner, padding: 15, color: 'white' }}>
                    <div style={{display:'flex', justifyContent:'space-between'}}>
                         <Text style={{color:'white', fontWeight: 600, fontSize: 16}} ellipsis>{curso.nombre}</Text>
                         {tipo === 'futuro' && <Tag color="gold">Inscripciones Abiertas</Tag>}
                    </div>
                    <div style={{fontSize: 12, opacity: 0.9, marginTop: 5}}>
                        <CalendarOutlined /> Inicio: {dayjs(curso.fecha_inicio).format("D MMMM YYYY")}
                    </div>
                </div>
            }
        >
            <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
                {/* Profesor */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <UserOutlined style={{color: '#8c8c8c'}} />
                    <Text strong>{curso.perfiles?.nombre_completo || "Sin asignar"}</Text>
                </div>

                {/* Horario (CRUCIAL PARA TU PREGUNTA) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f5f5f5', padding: '5px 10px', borderRadius: 4 }}>
                    <HistoryOutlined style={{color: '#fa8c16'}} />
                    <Text style={{fontSize: 13}}>{curso.horario || "Horario por definir"}</Text>
                </div>
                
                {/* Precios */}
                <div style={{display:'flex', justifyContent: 'space-between', marginTop: 10}}>
                    <div>
                        <Text type="secondary" style={{fontSize: 11}}>Mensualidad</Text><br/>
                        <Text strong>${Number(curso.precio_mensualidad).toLocaleString()}</Text>
                    </div>
                    <div style={{textAlign: 'right'}}>
                         <Text type="secondary" style={{fontSize: 11}}>Duración</Text><br/>
                         <Tag>{curso.duracion}</Tag>
                    </div>
                </div>
            </div>
        </Card>
      );
  };

  if (loading) return <div style={{ padding: 50, textAlign: "center" }}><Spin size="large" /></div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
            <Title level={2} style={{ marginBottom: 0 }}>Oferta Académica</Title>
            <Text type="secondary">Gestiona cohortes, horarios y profesores</Text>
        </div>
        <div style={{display:'flex', gap: 10}}>
            <Input 
                placeholder="Buscar curso o profesor..." 
                prefix={<SearchOutlined />} 
                onChange={e => setSearchText(e.target.value)}
                style={{width: 250}}
            />
            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => create("cursos")}>
            Crear Cohorte
            </Button>
        </div>
      </div>

      <Tabs 
        defaultActiveKey="1" 
        type="card"
        items={[
            {
                key: '1',
                label: <span><RocketOutlined /> En Curso <Badge count={cursosEnCurso.length} style={{backgroundColor: '#52c41a'}} /></span>,
                children: (
                    <List
                        grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 3, xl: 3, xxl: 4 }}
                        dataSource={cursosEnCurso}
                        renderItem={item => <List.Item><CursoCard curso={item} tipo="actual" /></List.Item>}
                    />
                )
            },
            {
                key: '2',
                label: <span><CalendarOutlined /> Próximos Inicios <Badge count={cursosProximos.length} style={{backgroundColor: '#1890ff'}} /></span>,
                children: (
                    <List
                        grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 3, xl: 3, xxl: 4 }}
                        dataSource={cursosProximos}
                        renderItem={item => <List.Item><CursoCard curso={item} tipo="futuro" /></List.Item>}
                    />
                )
            },
            {
                key: '3',
                label: <span><HistoryOutlined /> Historial / Finalizados</span>,
                children: (
                    <List
                        grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 3, xl: 3, xxl: 4 }}
                        dataSource={cursosFinalizados}
                        renderItem={item => <List.Item><CursoCard curso={item} tipo="pasado" /></List.Item>}
                    />
                )
            }
        ]}
      />
    </div>
  );
}