"use client";

import React, { useState, useEffect } from "react";
import { Create, useSelect } from "@refinedev/antd";
import { Form, Select, DatePicker, Card, Table, Switch, Button, Row, Col, Alert, message, Tag } from "antd";
import { CheckOutlined, CloseOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { createClient } from "@supabase/supabase-js";

// Conexión directa para buscar alumnos matriculados
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function TomarAsistencia() {
  const [cursoSeleccionado, setCursoSeleccionado] = useState<string | null>(null);
  const [fecha, setFecha] = useState(dayjs());
  const [alumnos, setAlumnos] = useState<any[]>([]);
  const [loadingAlumnos, setLoadingAlumnos] = useState(false);
  
  // Estado local para guardar la asistencia antes de enviarla
  // Formato: { "id_matricula": "presente", ... }
  const [asistenciasMap, setAsistenciasMap] = useState<Record<string, string>>({});

  // 1. Selector de Cursos Activos
  const { selectProps: cursoSelect } = useSelect({
    resource: "cursos",
    optionLabel: "nombre",
    optionValue: "id",
    filters: [{ field: "estado", operator: "eq", value: "activo" }],
  });

  // 2. Cargar Alumnos cuando cambia el curso
  useEffect(() => {
    if (!cursoSeleccionado) return;

    const cargarClase = async () => {
        setLoadingAlumnos(true);
        // Buscamos matriculas ACTIVAS de este curso
        // Hacemos un JOIN manual para traer el nombre del estudiante
        const { data, error } = await supabase
            .from("matriculas")
            .select(`
                id,
                estudiante_id,
                perfiles ( nombre_completo )
            `)
            .eq("curso_id", cursoSeleccionado)
            .eq("estado", "activo");

        if (error) {
            message.error("Error cargando lista de clase");
        } else {
            setAlumnos(data || []);
            // Pre-llenar todos con "presente" para ahorrar tiempo
            const inicial: any = {};
            data?.forEach((m: any) => inicial[m.id] = 'presente');
            setAsistenciasMap(inicial);
        }
        setLoadingAlumnos(false);
    };

    cargarClase();
  }, [cursoSeleccionado]);

  // 3. Función para cambiar estado individual
  const toggleEstado = (matriculaId: string) => {
    setAsistenciasMap(prev => ({
        ...prev,
        [matriculaId]: prev[matriculaId] === 'presente' ? 'ausente' : 'presente'
    }));
  };

  // 4. GUARDAR TODO EN LA BD
  const guardarAsistencia = async () => {
    if (!cursoSeleccionado || alumnos.length === 0) return;

    const registros = alumnos.map(alumno => ({
        matricula_id: alumno.id, // ID numérico de la matrícula
        fecha: fecha.format("YYYY-MM-DD"),
        estado: asistenciasMap[alumno.id],
        observaciones: "Clase regular"
    }));

    const { error } = await supabase.from("asistencias").insert(registros);

    if (error) {
        // Si hay error (ej: ya se tomó lista hoy), avisar
        if (error.message.includes("unique")) {
            message.warning("Ya se tomó asistencia para este curso en esta fecha.");
        } else {
            message.error("Error guardando: " + error.message);
        }
    } else {
        message.success("✅ ¡Asistencia guardada correctamente!");
        setCursoSeleccionado(null); // Reiniciar
        setAlumnos([]);
    }
  };

  return (
    <Card title="⚡ Tomar Asistencia Rápida">
      
      <Row gutter={24} style={{ marginBottom: 20 }}>
        <Col xs={24} md={12}>
            <label>1. Selecciona el Curso:</label>
            <Select 
                {...cursoSelect} 
                style={{ width: '100%' }} 
                placeholder="Elige un curso..."
                onChange={(val) => setCursoSeleccionado(val)}
                value={cursoSeleccionado}
            />
        </Col>
        <Col xs={24} md={12}>
            <label>2. Fecha de la Clase:</label>
            <DatePicker 
                style={{ width: '100%' }} 
                value={fecha} 
                onChange={(val) => setFecha(val || dayjs())} 
                format="DD/MM/YYYY"
            />
        </Col>
      </Row>

      {cursoSeleccionado && (
        <>
            <Alert message={`Lista de clase: ${alumnos.length} estudiantes activos`} type="info" showIcon style={{marginBottom: 15}} />
            
            <Table 
                dataSource={alumnos} 
                rowKey="id" 
                pagination={false}
                loading={loadingAlumnos}
            >
                <Table.Column 
                    title="Estudiante" 
                    dataIndex={['perfiles', 'nombre_completo']} 
                    render={(txt) => <b>{txt || "Estudiante sin nombre"}</b>}
                />
                
                <Table.Column 
                    title="Asistencia" 
                    align="center"
                    render={(_, record: any) => {
                        const esPresente = asistenciasMap[record.id] === 'presente';
                        return (
                            <Switch 
                                checkedChildren={<CheckOutlined />}
                                unCheckedChildren={<CloseOutlined />}
                                checked={esPresente}
                                onChange={() => toggleEstado(record.id)}
                                style={{ backgroundColor: esPresente ? '#52c41a' : '#ff4d4f' }}
                            />
                        )
                    }} 
                />

                <Table.Column 
                    title="Estado" 
                    align="center"
                    render={(_, record: any) => {
                         const esPresente = asistenciasMap[record.id] === 'presente';
                         return esPresente 
                            ? <Tag color="green">PRESENTE</Tag> 
                            : <Tag color="red">AUSENTE</Tag>
                    }}
                />
            </Table>

            <Button 
                type="primary" 
                size="large" 
                block 
                style={{ marginTop: 20, height: 50, fontSize: 18 }}
                onClick={guardarAsistencia}
                disabled={alumnos.length === 0}
            >
                💾 GUARDAR ASISTENCIA DEL DÍA
            </Button>
        </>
      )}
    </Card>
  );
}