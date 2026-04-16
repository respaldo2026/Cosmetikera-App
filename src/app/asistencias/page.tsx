"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { List, useTable, EditButton, DeleteButton, useSelect, CreateButton } from "@refinedev/antd";
import { Table, Space, Tag, Card, Row, Col, Progress, Typography, Statistic, Alert, Button, FloatButton, Select, Grid } from "antd";
import { 
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, 
  InfoCircleOutlined, WarningOutlined, TrophyOutlined, UserOutlined,
  ReloadOutlined, CheckOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useCurrentUser } from "@hooks/useCurrentUser";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { useSearchParams } from "next/navigation";

const { Text } = Typography;

export default function ListAsistencias() {
  const { user } = useCurrentUser();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [cursoSeleccionado, setCursoSeleccionado] = useState<number | null>(null);
  const [estadisticas, setEstadisticas] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const searchParams = useSearchParams();

  const { tableProps } = useTable({
    resource: "asistencias",
    sorters: { initial: [{ field: "fecha", order: "desc" }] },
    meta: {
      select: "*, matriculas(id, perfiles(nombre_completo), cursos(nombre, porcentaje_minimo))"
    },
    filters: {
      permanent: cursoSeleccionado ? [
        { field: "matriculas.curso_id", operator: "eq", value: cursoSeleccionado }
      ] : []
    }
  });

  // Selector de cursos: filtrar por rol
  const cursoSelectMeta = user?.rol === "profesor" 
    ? { filters: [{ field: "profesor_id", operator: "eq", value: user.id }] }
    : {};

  const { selectProps: cursoSelect } = useSelect({
    resource: "cursos",
    optionLabel: "nombre",
    optionValue: "id",
    meta: cursoSelectMeta
  });

  // Curso fijo desde URL (dentro del grupo)
  useEffect(() => {
    const cursoId = searchParams.get("curso_id") || searchParams.get("cursoId");
    if (cursoId) {
      setCursoSeleccionado(Number(cursoId));
    }
  }, [searchParams, setCursoSeleccionado]);

  const cursoActualLabel = useMemo(() => {
    const match = cursoSelect.options?.find((opt: any) => opt.value === cursoSeleccionado);
    if (typeof match?.label === "string") return match.label;
    const nombreParam = searchParams.get("curso_nombre") || searchParams.get("cursoNombre");
    return nombreParam || "";
  }, [cursoSeleccionado, cursoSelect.options, searchParams]);

  // Calcular estadísticas por estudiante
  const calcularEstadisticas = useCallback(async () => {
    if (!cursoSeleccionado) return;
    
    setLoadingStats(true);
    try {
      // 1. Obtener todas las matrículas del curso
      const { data: matriculas } = await supabaseBrowserClient
        .from("matriculas")
        .select("id, estudiante_id, perfiles(nombre_completo), cursos(nombre, porcentaje_minimo, total_clases)")
        .eq("curso_id", cursoSeleccionado)
        .eq("estado", "activo");

      // 2. Obtener todas las asistencias de estas matrículas
      const matriculaIds = matriculas?.map(m => m.id) || [];
      
      const { data: asistencias } = await supabaseBrowserClient
        .from("asistencias")
        .select("matricula_id, estado")
        .in("matricula_id", matriculaIds);

      // 3. Calcular porcentaje por estudiante
      const stats = matriculas?.map(matricula => {
        const asistenciasAlumno = asistencias?.filter(a => a.matricula_id === matricula.id) || [];
        const totalClases = asistenciasAlumno.length;
        const presentes = asistenciasAlumno.filter(a => a.estado === 'presente').length;
        const porcentaje = totalClases > 0 ? (presentes / totalClases) * 100 : 0;
        const cursoInfo = Array.isArray(matricula.cursos) ? matricula.cursos[0] : matricula.cursos;
        const minimoRequerido = cursoInfo?.porcentaje_minimo || 80;

        const perfilInfo = Array.isArray(matricula.perfiles) ? matricula.perfiles[0] : matricula.perfiles;
        return {
          matricula_id: matricula.id,
          estudiante: perfilInfo?.nombre_completo || "Sin nombre",
          totalClases,
          presentes,
          ausentes: totalClases - presentes,
          porcentaje: Math.round(porcentaje),
          minimoRequerido,
          cumple: porcentaje >= minimoRequerido,
          estado: porcentaje >= minimoRequerido ? 'ok' : porcentaje >= (minimoRequerido - 10) ? 'warning' : 'danger'
        };
      }) || [];

      setEstadisticas(stats);
    } catch (error) {
      console.error("Error calculando estadísticas:", error);
    } finally {
      setLoadingStats(false);
    }
  }, [cursoSeleccionado]);

  useEffect(() => {
    if (cursoSeleccionado) {
      calcularEstadisticas();
    } else {
      setEstadisticas([]);
    }
  }, [cursoSeleccionado, calcularEstadisticas]);

  // Calcular resumen general
  const estudiantesEnRiesgo = estadisticas.filter(e => !e.cumple).length;
  const promedioAsistencia = estadisticas.length > 0 
    ? Math.round(estadisticas.reduce((sum, e) => sum + e.porcentaje, 0) / estadisticas.length)
    : 0;

  return (
    <List 
      title="Control de Asistencias"
      headerButtons={
        <Space>
          <CreateButton
            type="primary"
            size="large"
            icon={<CheckOutlined />}
            onClick={() => {
              const url = cursoSeleccionado
                ? `/asistencias/create?curso_id=${cursoSeleccionado}${cursoActualLabel ? `&curso_nombre=${encodeURIComponent(cursoActualLabel)}` : ""}`
                : '/asistencias/create';
              window.location.href = url;
            }}
          >
            Tomar Asistencia
          </CreateButton>
        </Space>
      }
    >

      {/* TARJETAS DE RESUMEN */}
      {cursoSeleccionado && estadisticas.length > 0 && (
        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Promedio de Asistencia"
                value={promedioAsistencia}
                suffix="%"
                valueStyle={{ color: promedioAsistencia >= 80 ? '#3f8600' : '#cf1322' }}
                prefix={<TrophyOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Estudiantes en Riesgo"
                value={estudiantesEnRiesgo}
                valueStyle={{ color: estudiantesEnRiesgo > 0 ? '#cf1322' : '#3f8600' }}
                prefix={<WarningOutlined />}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                No cumplen % mínimo
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Total Estudiantes"
                value={estadisticas.length}
                prefix={<UserOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* TABLA DE ESTADÍSTICAS POR ESTUDIANTE */}
      {cursoSeleccionado && estadisticas.length > 0 && (
        <Card title={isMobile ? "📊 Asistencia" : "📊 Estadísticas de Asistencia por Estudiante"} style={{ marginBottom: 20 }}>
          <Table 
            dataSource={estadisticas}
            rowKey="matricula_id"
            loading={loadingStats}
            pagination={{ pageSize: 10 }}
            size={isMobile ? "small" : "middle"}
            scroll={isMobile ? { x: 720 } : undefined}
          >
            <Table.Column
              title="Estudiante"
              dataIndex="estudiante"
              width={isMobile ? 220 : 320}
              render={(nombre, record: any) => (
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  {record.estado === 'danger' && <WarningOutlined style={{ color: '#ff4d4f' }} />}
                  <Text
                    strong={record.estado === 'danger'}
                    style={{
                      display: "inline-block",
                      maxWidth: "100%",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={nombre}
                  >
                    {nombre}
                  </Text>
                </div>
              )}
            />
            <Table.Column
              title="Clases Totales"
              dataIndex="totalClases"
              align="center"
              responsive={["md"]}
            />
            <Table.Column
              title="Presentes"
              dataIndex="presentes"
              align="center"
              responsive={["md"]}
              render={(val) => <Tag color="green">{val}</Tag>}
            />
            <Table.Column
              title="Ausentes"
              dataIndex="ausentes"
              align="center"
              responsive={["md"]}
              render={(val) => <Tag color="red">{val}</Tag>}
            />
            <Table.Column
              title="% Asistencia"
              dataIndex="porcentaje"
              align="center"
              width={isMobile ? 130 : 220}
              render={(val, record: any) => (
                isMobile
                  ? <Tag color={record.estado === 'ok' ? 'success' : record.estado === 'warning' ? 'warning' : 'error'} style={{ marginInlineEnd: 0 }}>{val}%</Tag>
                  : (
                    <div style={{ minWidth: 100 }}>
                      <Progress 
                        percent={val} 
                        size="small"
                        status={record.estado === 'ok' ? 'success' : record.estado === 'warning' ? 'normal' : 'exception'}
                        format={(percent) => `${percent}%`}
                      />
                    </div>
                  )
              )}
              sorter={(a, b) => a.porcentaje - b.porcentaje}
            />
            <Table.Column
              title="Estado"
              dataIndex="cumple"
              align="center"
              width={isMobile ? 160 : 260}
              render={(cumple, record: any) => {
                if (cumple) {
                  return <Tag color="success" icon={<CheckCircleOutlined />}>APTO</Tag>;
                }
                return (
                  <Tag color="error" icon={<WarningOutlined />}>
                    {isMobile ? 'RIESGO' : `RIESGO (${record.porcentaje}% < ${record.minimoRequerido}%)`}
                  </Tag>
                );
              }}
              filters={[
                { text: 'Apto', value: true },
                { text: 'En Riesgo', value: false }
              ]}
              onFilter={(value, record) => record.cumple === value}
            />
          </Table>

          {estudiantesEnRiesgo > 0 && (
            <Alert
              message="⚠️ Acción Requerida"
              description={`${estudiantesEnRiesgo} estudiante(s) no cumplen con el porcentaje mínimo de asistencia. No podrán certificarse hasta mejorar su asistencia.`}
              type="warning"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
        </Card>
      )}

      {/* TABLA DE ASISTENCIAS (HISTÓRICO) — temporalmente ocultada por corrección de compilación */}
    </List>
  );
}