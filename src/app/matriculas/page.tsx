"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { List, useTable, EditButton, DeleteButton, CreateButton, useSelect } from "@refinedev/antd";
import { Table, Space, Tag, Typography, Button, Tooltip, Progress, Select, Modal, message, Tabs, Card, Row, Col, App, Grid } from "antd";
import { 
  FileTextOutlined, 
  CheckCircleOutlined, 
  SyncOutlined, 
  CloseCircleOutlined, 
  DownloadOutlined,
  WarningOutlined,
  LockOutlined
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { DiplomaPDF } from "@components/pdf/DiplomaPDF";
import { useCurrentUser } from "@hooks/useCurrentUser";
import { obtenerStatsAsistenciasYPagos } from "@modules/academico/asistencias.service";
import { enviarWhatsappConPlantilla } from "@utils/whatsapp";
import { formatDate } from "@utils/date";
import { construirNombreGrupo } from "@utils/grupos";

import { supabaseBrowserClient } from "@utils/supabase/client";

const { Text } = Typography;

export default function MatriculasList() {
    const { user } = useCurrentUser();
    const { modal, message: antMessage } = App.useApp();
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.md;
    const isTablet = screens.md && !screens.lg;
    const [asistenciasPorMatricula, setAsistenciasPorMatricula] = useState<Record<number, any>>({});
    const [loadingAsistencias, setLoadingAsistencias] = useState(false);
    const [activeTab, setActiveTab] = useState<string>('nuevo');
    const [listFilter, setListFilter] = useState<'all' | 'sin_pagos' | 'con_pagos' | 'bajo_asistencia'>('all');
    const router = useRouter();

    // Construcción de filtros según rol
    const permanentFilters = () => {
        const filters: any[] = [];
        
        // Profesor solo ve sus matrículas (de sus cursos)
        if (user?.rol === "profesor") {
            filters.push({ field: "cursos.profesor_id", operator: "eq", value: user.id });
        }
        
        return filters;
    };

    // Traemos las matrículas junto con los datos del Estudiante (perfiles) y el Curso (cursos)
    const { tableProps, setFilters } = useTable({
        resource: "matriculas",
        meta: {
            select: "*, perfiles!matriculas_estudiante_id_fkey(nombre_completo, email), cursos(nombre, porcentaje_minimo, precio_mensualidad, programas(nombre))"
        },
        sorters: {
            initial: [
                {
                    field: "created_at",
                    order: "desc",
                },
            ],
        },
        filters: {
            permanent: permanentFilters()
        }
    });

    const matriculas = useMemo(() => (tableProps.dataSource as any[]) || [], [tableProps.dataSource]);

    const calcularAsistencias = useCallback(async () => {
        setLoadingAsistencias(true);
        try {
            const matriculaIds = matriculas.map((m: any) => m.id);
            const cursosPorMatricula = Object.fromEntries(matriculas.map((m: any) => [m.id, m.cursos]));
            const statsMap = await obtenerStatsAsistenciasYPagos(matriculaIds, cursosPorMatricula);
            setAsistenciasPorMatricula(statsMap);
        } catch (error) {
            console.error("Error calculando asistencias:", error);
        } finally {
            setLoadingAsistencias(false);
        }
    }, [matriculas]);

    // Calcular asistencias cuando cambian las matrículas
    useEffect(() => {
        if (matriculas.length > 0) {
            calcularAsistencias();
        }
    }, [matriculas, calcularAsistencias]);

    // Clasificación y conteos - Usar filteredByQuick que refleja el estado actual de datos
    const activoEstados = useMemo(() => ["activo", "en curso"], []);
    const graduadoEstados = useMemo(() => ["aprobado", "certificado", "finalizado"], []);
    
    // Calcular conteos basados en los datos que tenemos ahora (después de asistencias)
    const activosCount = matriculas.filter((m: any) => activoEstados.includes(String(m.estado || '').toLowerCase())).length;
    const graduadosCount = matriculas.filter((m: any) => graduadoEstados.includes(String(m.estado || '').toLowerCase())).length;
    const desertoresCount = matriculas.filter((m: any) => {
        const stats = asistenciasPorMatricula[m.id];
        // Desertor: tiene datos de asistencia Y no cumple el mínimo
        return stats && stats.tieneDatos && !stats.cumple;
    }).length;

    const filteredDataSource = (() => {
        if (activeTab === 'activos') {
            return (tableProps.dataSource as any[] || []).filter((m: any) => activoEstados.includes(String(m.estado || '').toLowerCase()));
        }
        if (activeTab === 'graduados') {
            return (tableProps.dataSource as any[] || []).filter((m: any) => graduadoEstados.includes(String(m.estado || '').toLowerCase()));
        }
        if (activeTab === 'desertores') {
            return (tableProps.dataSource as any[] || []).filter((m: any) => {
                const s = asistenciasPorMatricula[m.id];
                return s && s.tieneDatos && !s.cumple;
            });
        }
        return tableProps.dataSource;
    })();

    const filteredByQuick = (() => {
        let arr = filteredDataSource as any[] || [];
        if (listFilter === 'sin_pagos') {
            arr = arr.filter((m: any) => {
                const s = asistenciasPorMatricula[m.id];
                return s && (s.pagosCount || 0) === 0;
            });
        } else if (listFilter === 'con_pagos') {
            arr = arr.filter((m: any) => {
                const s = asistenciasPorMatricula[m.id];
                return s && (s.pagosCount || 0) > 0;
            });
        } else if (listFilter === 'bajo_asistencia') {
            arr = arr.filter((m: any) => {
                const s = asistenciasPorMatricula[m.id];
                return s && s.tieneDatos && !s.cumple;
            });
        }
        return arr;
    })();

    // Selector para filtrar por curso
    const { selectProps: cursoFilterSelect } = useSelect({
        resource: "cursos",
        optionLabel: "nombre",
        optionValue: "id",
    });

    const { selectProps: programaFilterSelect } = useSelect({
        resource: "programas",
        optionLabel: "nombre",
        optionValue: "id",
    });

    const onFilterCurso = (cursoId?: string) => {
        setFilters(
            cursoId ? [{ field: "curso_id", operator: "eq" as const, value: cursoId }] : []
        );
    };

    const onFilterPrograma = (programaId?: string) => {
        setFilters(programaId ? [{ field: "cursos.programa_id", operator: "eq" as const, value: programaId }] : []);
    };

    const handleEliminar = async (record: any) => {
        try {
            const supabase = supabaseBrowserClient;
            
            // Verificar con más detalle qué pagos existen
            const { data: pagosData, error: pagosError } = await supabase
                .from('pagos')
                .select('*')
                .eq('matricula_id', record.id);
            
            const { data: asistData, error: asistError } = await supabase
                .from('asistencias')
                .select('id')
                .eq('matricula_id', record.id);
            
            console.log('Verificación de datos relacionados:', {
                matricula_id: record.id,
                pagos: pagosData,
                pagosError,
                asistencias: asistData,
                asistError
            });

            const asistCount = asistData?.length || 0;
            const pagosCount = pagosData?.length || 0;

            if (asistCount > 0 || pagosCount > 0) {
                const pagosPendientes = pagosData?.filter((p: any) => p.estado === 'pendiente').length || 0;
                const pagosPagados = pagosData?.filter((p: any) => p.estado === 'pagado').length || 0;
                
                modal.confirm({
                    title: 'Esta matrícula tiene registros asociados',
                    width: 600,
                    content: (
                        <div>
                            <p>No se puede eliminar porque existen registros relacionados:</p>
                            <ul>
                                {asistCount > 0 && <li><strong>{asistCount} asistencia(s)</strong></li>}
                                {pagosCount > 0 && (
                                    <li>
                                        <strong>{pagosCount} pago(s):</strong>
                                        <ul>
                                            {pagosPendientes > 0 && <li>{pagosPendientes} pendientes (cuotas generadas automáticamente)</li>}
                                            {pagosPagados > 0 && <li style={{color: '#cf1322'}}>{pagosPagados} pagados (ingresos reales)</li>}
                                        </ul>
                                    </li>
                                )}
                            </ul>
                            <div style={{ marginTop: 16, padding: 12, background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 4 }}>
                                <strong>💡 Opciones:</strong>
                                <ul style={{ margin: '8px 0 0 0' }}>
                                    <li><strong>&quot;Eliminar pagos y continuar&quot;:</strong> Borra todos los pagos (pendientes y pagados) {asistCount > 0 && 'y asistencias'} y luego elimina la matrícula</li>
                                    <li><strong>&quot;Cancelar Matrícula&quot;:</strong> Marca como cancelada sin eliminar datos (recomendado si hay pagos reales)</li>
                                </ul>
                            </div>
                        </div>
                    ),
                    okText: pagosCount > 0 ? 'Eliminar pagos y continuar' : 'Eliminar asistencias y continuar',
                    okType: 'danger',
                    cancelText: 'Cancelar Matrícula',
                    onOk: async () => {
                        try {
                            // Primero eliminar todos los pagos
                            if (pagosCount > 0) {
                                const { error: errorPagos } = await supabase
                                    .from('pagos')
                                    .delete()
                                    .eq('matricula_id', record.id);
                                
                                if (errorPagos) {
                                    antMessage.error('Error eliminando pagos: ' + errorPagos.message);
                                    console.error('Error deleting pagos:', errorPagos);
                                    return;
                                }
                            }
                            
                            // Luego eliminar asistencias si hay
                            if (asistCount > 0) {
                                const { error: errorAsist } = await supabase
                                    .from('asistencias')
                                    .delete()
                                    .eq('matricula_id', record.id);
                                
                                if (errorAsist) {
                                    antMessage.error('Error eliminando asistencias: ' + errorAsist.message);
                                    console.error('Error deleting asistencias:', errorAsist);
                                    return;
                                }
                            }
                            
                            // Finalmente eliminar la matrícula
                            const { error: errorMatricula } = await supabase
                                .from('matriculas')
                                .delete()
                                .eq('id', record.id);
                            
                            if (errorMatricula) {
                                antMessage.error('Error eliminando matrícula: ' + errorMatricula.message);
                                console.error('Error deleting matricula:', errorMatricula);
                            } else {
                                antMessage.success('Matrícula y todos sus registros eliminados correctamente');
                                router.refresh();
                            }
                        } catch (err: any) {
                            antMessage.error(err?.message || 'Error en eliminación en cascada');
                            console.error('Cascade delete exception:', err);
                        }
                    },
                    onCancel: () => {
                        // Cambiar a cancelado en lugar de cerrar
                        handleCancelar(record);
                    }
                });
                return;
            }

            // No hay datos relacionados, eliminar directamente
            modal.confirm({
                title: 'Eliminar Matrícula',
                content: 'Esta acción no se puede deshacer. ¿Deseas continuar?',
                okText: 'Eliminar',
                okType: 'danger',
                cancelText: 'Cancelar',
                async onOk() {
                    try {
                        const { error } = await supabase.from('matriculas').delete().eq('id', record.id);
                        if (error) {
                            antMessage.error(error.message || 'No se pudo eliminar');
                            console.error('Delete error:', error);
                        } else {
                            antMessage.success('Matrícula eliminada');
                            router.refresh();
                        }
                    } catch (err: any) {
                        antMessage.error(err?.message || 'Error al eliminar');
                        console.error('Delete exception:', err);
                    }
                },
            });
        } catch (e: any) {
            antMessage.error(e?.message || 'Error validando dependencias');
        }
    };

    const handleCancelar = async (record: any) => {
        modal.confirm({
            title: 'Cancelar Matrícula',
            content: 'Esto marcará la matrícula como "cancelado" y conservará el historial. ¿Confirmas?',
            okText: 'Cancelar matrícula',
            cancelText: 'Volver',
            async onOk() {
                try {
                    const { error } = await supabaseBrowserClient
                        .from('matriculas')
                        .update({ estado: 'cancelado' })
                        .eq('id', record.id);
                    
                    if (error) {
                        antMessage.error(error.message || 'No se pudo cancelar');
                        console.error('Cancel error:', error);
                    } else {
                        antMessage.success('Matrícula cancelada');
                        
                        // Notificar por WhatsApp si el estudiante lo permite
                        try {
                            const { data: perfil } = await supabaseBrowserClient
                                .from('perfiles')
                                .select('nombre_completo, telefono, notif_whatsapp')
                                .eq('id', record.estudiante_id)
                                .single();
                            const { data: curso } = await supabaseBrowserClient
                                .from('cursos')
                                .select('nombre')
                                .eq('id', record.curso_id)
                                .single();
                            if (perfil?.telefono && (perfil?.notif_whatsapp ?? true)) {
                                await enviarWhatsappConPlantilla(
                                    perfil.telefono,
                                    "matricula_cancelada",
                                    {
                                        nombre_estudiante: perfil.nombre_completo ?? "Estudiante",
                                        nombre_curso: curso?.nombre ?? "curso",
                                    },
                                );
                            }
                        } catch (e) {
                            console.warn('No se pudo enviar WhatsApp de cancelación:', e);
                        }
                        
                        // Recargar para reflejar cambio de estado
                        router.refresh();
                    }
                } catch (err: any) {
                    antMessage.error(err?.message || 'Error al cancelar');
                    console.error('Cancel exception:', err);
                }
            },
        });
    };;
                {/* COLUMNA 6: PAGOS */}
                <Table.Column
                    title="Pagos"
                    align="center"
                    render={(_, record: any) => {
                        const stats = asistenciasPorMatricula[record.id];
                        if (!stats) return <Text type="secondary" style={{fontSize:11}}>—</Text>;
                        const totalFmt = `$ ${Number(stats.pagosTotal || 0).toLocaleString()}`;
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <Tag color="gold">{stats.pagosCount || 0} pago(s)</Tag>
                                <Text type="secondary" style={{fontSize:11}}>{totalFmt}</Text>
                            </div>
                        );
                    }}
                />

                {/* COLUMNA 7: MONTO PAGADO */}
                <Table.Column
                    title="Monto Pagado"
                    dataIndex="id"
                    align="center"
                    render={(_, record: any) => {
                        const stats = asistenciasPorMatricula[record.id];
                        const total = Number(stats?.pagosTotal || 0);
                        return (
                            <Text strong style={{ color: '#3f8600' }}>
                                $ {total.toLocaleString()}
                            </Text>
                        );
                    }}
                />

                {/* COLUMNA 8: SALDO ESTIMADO (mensualidad) */}
                <Table.Column
                    title="Saldo Estimado"
                    align="center"
                    render={(_, record: any) => {
                        const stats = asistenciasPorMatricula[record.id];
                        const mensualidad = Number(record.cursos?.precio_mensualidad || 0);
                        const pagado = Number(stats?.pagosTotal || 0);
                        const saldo = Math.max(0, mensualidad - pagado);
                        const color = saldo > 0 ? '#fa8c16' : '#389e0d';
                        return (
                            <Text strong style={{ color }}>
                                $ {saldo.toLocaleString()}
                            </Text>
                        );
                    }}
                />


    return (
        <>
        <List title="Gestión de Matrículas">
            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                size={isMobile ? "small" : "middle"}
                tabBarGutter={isMobile ? 8 : 16}
                items={[
                { key: 'nuevo', label: 'Nueva Matrícula' },
                { key: 'activos', label: `Activos (${activosCount})` },
                { key: 'graduados', label: `Graduados (${graduadosCount})` },
                { key: 'desertores', label: `Desertores (${desertoresCount})` },
            ]}
            />

            {activeTab === 'nuevo' ? (
                <>
                    <Row gutter={16} style={{ marginBottom: 16 }}>
                        <Col xs={24} md={8}>
                            <Card title="Activos" variant="outlined">
                                <Space direction="vertical">
                                    <Text>Estudiantes actualmente cursando.</Text>
                                    <Tag color="processing">{activosCount} matrícula(s)</Tag>
                                    <Button onClick={() => setActiveTab('activos')}>Ver listado</Button>
                                </Space>
                            </Card>
                        </Col>
                        <Col xs={24} md={8}>
                            <Card title="Graduados" variant="outlined">
                                <Space direction="vertical">
                                    <Text>Finalizaron y pueden certificar.</Text>
                                    <Tag color="success">{graduadosCount} matrícula(s)</Tag>
                                    <Button onClick={() => setActiveTab('graduados')}>Ver listado</Button>
                                </Space>
                            </Card>
                        </Col>
                        <Col xs={24} md={8}>
                            <Card title="Desertores" variant="outlined">
                                <Space direction="vertical">
                                    <Text>Asistencia por debajo del mínimo.</Text>
                                    <Tag color="error">{desertoresCount} matrícula(s)</Tag>
                                    <Button onClick={() => setActiveTab('desertores')}>Ver listado</Button>
                                </Space>
                            </Card>
                        </Col>
                    </Row>
                    <Space direction={isMobile ? "vertical" : "horizontal"} style={{ width: "100%" }}>
                        <CreateButton type="primary" size={isMobile ? "middle" : "large"} icon={<FileTextOutlined />} block={isMobile}>
                            Crear nueva matrícula
                        </CreateButton>
                        <Select
                            options={programaFilterSelect.options}
                            loading={programaFilterSelect.loading}
                            allowClear
                            placeholder="Filtrar por programa"
                            style={{ minWidth: isMobile ? "100%" : 240, width: isMobile ? "100%" : undefined }}
                            onChange={(val) => onFilterPrograma(val as string)}
                        />
                        <Select
                            options={cursoFilterSelect.options}
                            loading={cursoFilterSelect.loading}
                            allowClear
                            placeholder="Filtrar por curso"
                            style={{ minWidth: isMobile ? "100%" : 260, width: isMobile ? "100%" : undefined }}
                            onChange={(val) => onFilterCurso(val as string)}
                        />
                    </Space>
                </>
            ) : (
                <>
                    <Space style={{ marginBottom: 12, width: "100%" }} direction={isMobile ? "vertical" : "horizontal"}>
                        <Select
                            options={programaFilterSelect.options}
                            loading={programaFilterSelect.loading}
                            allowClear
                            placeholder="Filtrar por programa"
                            style={{ minWidth: isMobile ? "100%" : 240, width: isMobile ? "100%" : undefined }}
                            onChange={(val) => onFilterPrograma(val as string)}
                        />
                        <Select
                            options={cursoFilterSelect.options}
                            loading={cursoFilterSelect.loading}
                            allowClear
                            placeholder="Filtrar por curso"
                            style={{ minWidth: isMobile ? "100%" : 260, width: isMobile ? "100%" : undefined }}
                            onChange={(val) => onFilterCurso(val as string)}
                        />
                        <CreateButton type="primary" icon={<FileTextOutlined />} block={isMobile}>Nueva Matrícula</CreateButton>
                    </Space>
                    {/* Quick filters for table */}
                    <Space style={{ marginBottom: 12 }} wrap>
                        <Button size="small" type={listFilter === 'all' ? 'primary' : 'default'} onClick={() => setListFilter('all')}>Todas</Button>
                        <Button size="small" type={listFilter === 'sin_pagos' ? 'primary' : 'default'} onClick={() => setListFilter('sin_pagos')}>Sin Pagos</Button>
                        <Button size="small" type={listFilter === 'con_pagos' ? 'primary' : 'default'} onClick={() => setListFilter('con_pagos')}>Con Pagos</Button>
                        <Button size="small" type={listFilter === 'bajo_asistencia' ? 'primary' : 'default'} onClick={() => setListFilter('bajo_asistencia')}>Bajo Asistencia</Button>
                    </Space>
                </>
            )}
            {activeTab !== 'nuevo' && (
            <Table
                {...tableProps}
                dataSource={filteredByQuick as any}
                rowKey="id"
                loading={loadingAsistencias}
                size={isMobile ? "small" : "middle"}
                scroll={isMobile ? { x: 900 } : isTablet ? { x: 1100 } : undefined}
                pagination={{
                    ...(tableProps.pagination || {}),
                    simple: isMobile,
                    showSizeChanger: !isMobile,
                }}
            >
                
                {/* COLUMNA 1: ESTUDIANTE */}
                <Table.Column
                    title="Estudiante"
                    dataIndex={["perfiles", "nombre_completo"]}
                    render={(val, record: any) => (
                        <div style={{display:'flex', flexDirection:'column'}}>
                            <Text strong>{val || "Sin nombre"}</Text>
                            <Text type="secondary" style={{fontSize:12}}>{record.perfiles?.email}</Text>
                        </div>
                    )}
                />

                {/* COLUMNA 2: CURSO */}
                <Table.Column
                    title="Curso Inscrito"
                    dataIndex={["cursos", "nombre"]}
                    render={(_, record: any) => <Tag color="blue">{construirNombreGrupo(record.cursos) || "Curso General"}</Tag>}
                />

                {!isMobile && (
                    <Table.Column
                        title="Programa"
                        dataIndex={["cursos", "programas", "nombre"]}
                        render={(val) => <Tag color="purple">{val || "Sin programa"}</Tag>}
                    />
                )}

                {/* COLUMNA 3: ASISTENCIA */}
                {!isMobile && (
                    <Table.Column
                        title="Asistencia"
                        align="center"
                        render={(_, record: any) => {
                            const stats = asistenciasPorMatricula[record.id];
                            
                            if (!stats || !stats.tieneDatos) {
                                return <Text type="secondary" style={{fontSize:11}}>Sin datos</Text>;
                            }

                            const { porcentaje, minimoRequerido, cumple } = stats;

                            return (
                                <Tooltip 
                                    title={`${stats.presentes}/${stats.totalClases} clases. Mínimo requerido: ${minimoRequerido}%`}
                                >
                                    <div style={{ minWidth: 80 }}>
                                        <Progress 
                                            type="circle" 
                                            percent={porcentaje} 
                                            size={50}
                                            status={cumple ? 'success' : 'exception'}
                                            format={(percent) => `${percent}%`}
                                        />
                                    </div>
                                </Tooltip>
                            );
                        }}
                    />
                )}

                {/* COLUMNA 4: ESTADO ACADÉMICO */}
                <Table.Column
                    title="Estado"
                    dataIndex="estado"
                    render={(val, record: any) => {
                        let color = "default";
                        let icon = <SyncOutlined spin />;
                        
                        const estado = (val || "").toLowerCase();

                        if (estado === "aprobado" || estado === "certificado") {
                            color = "success";
                            icon = <CheckCircleOutlined />;
                        } else if (estado === "cancelado" || estado === "retirado") {
                            color = "error";
                            icon = <CloseCircleOutlined />;
                        } else if (estado === "activo" || estado === "en curso") {
                            color = "processing";
                        }

                        return <Tag color={color} icon={icon}>{val?.toUpperCase()}</Tag>;
                    }}
                />

                {/* COLUMNA 5: FECHA MATRÍCULA (creación) */}
                {!isMobile && (
                    <Table.Column
                        title="Fecha Matrícula"
                        dataIndex="created_at"
                        render={(val) => formatDate(val)}
                    />
                )}

                {/* COLUMNA 6: DIPLOMA CON VALIDACIÓN */}
                {!isMobile && (
                    <Table.Column
                        title="Certificado"
                        align="center"
                        render={(_, record: any) => {
                            const estado = (record.estado || "").toLowerCase();
                            const esAprobado = estado === "aprobado" || estado === "certificado" || estado === "finalizado";
                            const stats = asistenciasPorMatricula[record.id];
                            
                            // Si no está aprobado, mostrar mensaje
                            if (!esAprobado) {
                                return <Text type="secondary" style={{fontSize:11}}>En progreso...</Text>;
                            }

                            // VALIDACIÓN: Verificar asistencia
                            if (stats && stats.tieneDatos && !stats.cumple) {
                                return (
                                    <Tooltip title={`No cumple el porcentaje mínimo de asistencia (${stats.porcentaje}% < ${stats.minimoRequerido}%)`}>
                                        <Tag color="error" icon={<LockOutlined />}>
                                            BLOQUEADO
                                        </Tag>
                                    </Tooltip>
                                );
                            }

                            // Si cumple todo, mostrar diploma
                            return (
                                <PDFDownloadLink
                                    document={
                                        <DiplomaPDF 
                                            estudiante={record.perfiles?.nombre_completo || "Estudiante"}
                                            curso={record.cursos?.nombre || "Curso"}
                                            fechaFin={record.updated_at || new Date().toISOString()} 
                                            folio={record.id}
                                        />
                                    }
                                    fileName={`Diploma_${record.perfiles?.nombre_completo || 'Alumno'}.pdf`}
                                >
                                    {({ loading }: { loading: boolean }) => 
                                        loading ? (
                                            <Button size="small" loading>...</Button>
                                        ) : (
                                            <Button 
                                                type="primary" 
                                                size="small" 
                                                icon={<DownloadOutlined />} 
                                                style={{ backgroundColor: '#D4AF37', borderColor: '#D4AF37', color: '#fff' }}
                                                title="Descargar Diploma Oficial"
                                            >
                                                Diploma
                                            </Button>
                                        )
                                    }
                                </PDFDownloadLink>
                            );
                        }}
                    />
                )}
                

                {/* COLUMNA 9: ACCIONES */}
                <Table.Column
                    title="Acciones"
                    render={(_, record: any) => (
                        <Space wrap>
                            <EditButton hideText size="small" recordItemId={record.id} />
                            <Button size="small" type="dashed" onClick={() => {
                                const url = `/tesoreria/create?estudiante_id=${record.estudiante_id}&matricula_id=${record.id}`;
                                router.push(url);
                            }}>
                                Registrar Pago
                            </Button>
                            <Button size="small" onClick={() => handleCancelar(record)}>
                                Cancelar Matrícula
                            </Button>
                            <Button danger size="small" onClick={() => handleEliminar(record)}>
                                Eliminar
                            </Button>
                        </Space>
                    )}
                />
            </Table>
            )}
        </List>
        </>
    );
}
