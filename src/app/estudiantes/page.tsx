"use client";

import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { 
    List, 
    useTable, 
    EditButton, 
    ShowButton, 
    CreateButton
} from "@refinedev/antd";
import { Table, Space, Tag, Button, Tooltip, Avatar, Input, Card, Row, Col, Tabs, Select, Typography, App, Grid, Dropdown } from "antd";
import { 
    WhatsAppOutlined, 
    UserOutlined, 
    MailOutlined,
    PhoneOutlined,
    SearchOutlined,
    IdcardOutlined,
    DeleteOutlined,
    EllipsisOutlined
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@hooks/useCurrentUser";
import { enviarWhatsapp } from "@utils/whatsapp";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { construirNombreGrupo } from "@utils/grupos";
const { Text } = Typography;

export default function EstudiantesList() {
    const router = useRouter();
    const { message: antMessage, modal } = App.useApp();
    const { user } = useCurrentUser();
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.md;
    const isTablet = screens.md && !screens.lg;
    const [searchValue, setSearchValue] = useState("");
    const [deletedIds, setDeletedIds] = useState<string[]>([]);
    
    // Construcción dinámica de filtros según rol
    const permanentFilters = () => {
        const filters: any[] = [
            { field: "rol", operator: "eq", value: "estudiante" }
            // Removido el filtro de activo para mostrar todos
        ];
        
        // Si es profesor, solo ve estudiantes de sus cursos
        if (user?.rol === "profesor") {
            filters.push({ field: "perfiles.profesor_id", operator: "eq", value: user.id });
        }
        
        return filters;
    };

    const { tableProps, setFilters } = useTable({
        resource: "perfiles",
        // TRUCO AVANZADO: Especificar explícitamente la FK para evitar ambigüedad
        meta: {
            select: "*, matriculas!matriculas_estudiante_id_fkey(id, estado, created_at, fecha_inicio, cursos(nombre, porcentaje_minimo, dias_semana, hora_inicio, hora_fin, programas(nombre)))"
        },
        sorters: { initial: [{ field: "nombre_completo", order: "asc" }] },
        pagination: {
            pageSize: 50 // Limitar a 50 por página para mejor rendimiento
        },
        // Filtro base: Solo estudiantes
        filters: {
            permanent: permanentFilters()
        },
        // Lógica del Buscador
        onSearch: (values: any) => {
            const search = values.q;
            if (!search) return [];
            return [
                {
                    field: "nombre_completo",
                    operator: "contains",
                    value: search,
                }
            ];
        }
    });

    // Búsqueda en tiempo real mientras se escribe
    const handleSearchChange = (value: string) => {
        setSearchValue(value);
        if (value) {
            setFilters([
                {
                    field: "nombre_completo",
                    operator: "contains",
                    value,
                }
            ], "replace");
        } else {
            setFilters([], "replace");
        }
    };

    // Tabs: activos, graduados, desertores
    const [activeTab, setActiveTab] = useState<string>('activos');
    const [attFilter, setAttFilter] = useState<'all' | 'bajo' | 'sin'>('all');
    const [asistStats, setAsistStats] = useState<Record<number, { total: number; present: number; porcentaje: number; minimo: number; cumple: boolean; tieneDatos: boolean }>>({});
    const [loadingAsist, setLoadingAsist] = useState(false);
    const [pagosStats, setPagosStats] = useState<Record<number, {
        pagados: number;
        pendientes: number;
        pendientesVencidos: number;
        inscripcionPagada: number;
        mensualidadesPagadas: number;
        mensualidadesPendientes: number;
        mensualidadesPendientesVencidas: number;
        mensualidadesPagadasMesActual: number;
        mensualidadesPendientesMesActual: number;
        mensualidadesPendientesVencidasMesActual: number;
    }>>({});
    const [loadingPagos, setLoadingPagos] = useState(false);
    const [calcularAsistencia, setCalcularAsistencia] = useState(false);
    const activoEstados = useMemo(() => ["activo", "en curso", "pendiente", "inscrito", "preinscrito", "matriculado"], []);
    const graduadoEstados = useMemo(() => ["aprobado", "certificado", "finalizado"], []);

    const normalizarEstado = (value: any) => String(value || "").toLowerCase().trim();
    const esEstadoInactivo = (estado: string) => ["cancelado", "cancelada", "retirado", "retirada", "anulado", "anulada"].includes(estado);
    const esEstadoGraduado = (estado: string) => graduadoEstados.includes(estado);
    const esPagoInscripcion = (pago: any) => {
        const numero = Number(pago?.numero_cuota);
        const periodo = String(pago?.periodo_pagado || "").toLowerCase();
        return numero === 0 || periodo.includes("inscrip") || periodo.includes("matric");
    };
    const obtenerMatriculasVigentes = (record: any) => {
        const matriculas = (record?.matriculas || []).slice();
        const filtradas = matriculas.filter((m: any) => {
            const estado = normalizarEstado(m?.estado);
            if (!estado) return true;
            return !esEstadoInactivo(estado) && !esEstadoGraduado(estado);
        });
        return filtradas.sort((a: any, b: any) => {
            const fechaA = dayjs(a?.fecha_inicio || a?.created_at || 0).valueOf();
            const fechaB = dayjs(b?.fecha_inicio || b?.created_at || 0).valueOf();
            return fechaB - fechaA;
        });
    };
    const obtenerEstadoPago = (record: any) => {
        const mats = obtenerMatriculasVigentes(record);
        if (mats.length === 0) return { label: 'Sin pagos', color: 'default' as const };

        let matriculasConPagoVigente = 0;
        let matriculasConPendienteMesActual = 0;
        let mensualidadesPendientesVencidasMesActual = 0;

        mats.forEach((m: any) => {
            const st = pagosStats[m.id];
            if ((st?.mensualidadesPagadas || 0) > 0) {
                matriculasConPagoVigente += 1;
            }
            if ((st?.mensualidadesPendientesMesActual || 0) > 0) {
                matriculasConPendienteMesActual += 1;
            }
            mensualidadesPendientesVencidasMesActual += st?.mensualidadesPendientesVencidasMesActual || 0;
        });

        if (mensualidadesPendientesVencidasMesActual > 0) {
            return { label: 'Pendiente', color: 'orange' as const };
        }

        if (matriculasConPendienteMesActual > 0) {
            return { label: 'Pendiente', color: 'gold' as const };
        }

        if (matriculasConPagoVigente > 0) {
            return { label: 'Pagado', color: 'green' as const };
        }

        return { label: 'Pendiente', color: 'gold' as const };
    };

    const dataSource = useMemo(
        () => ((tableProps.dataSource as any[]) || []).filter((s: any) => !deletedIds.includes(s.id)),
        [tableProps.dataSource, deletedIds]
    );

    // Calcular asistencia por matrícula para cada estudiante (SOLO cuando se solicite)
    useEffect(() => {
        if (!calcularAsistencia) return;
        
        const matriculaIds: number[] = [];
        dataSource.forEach((s: any) => {
            (s.matriculas || []).forEach((m: any) => {
                if (m?.id) matriculaIds.push(m.id);
            });
        });
        if (matriculaIds.length === 0) {
            setAsistStats({});
            setLoadingAsist(false);
            return;
        }
        const fetchAsist = async () => {
            setLoadingAsist(true);
            try {
                const { data: asistencias } = await supabaseBrowserClient
                    .from('asistencias')
                    .select('matricula_id, estado')
                    .in('matricula_id', matriculaIds);

                const stats: Record<number, any> = {};
                dataSource.forEach((s: any) => {
                    (s.matriculas || []).forEach((m: any) => {
                        const arr = asistencias?.filter(a => a.matricula_id === m.id) || [];
                        const total = arr.length;
                        const present = arr.filter(a => a.estado === 'presente').length;
                        const pct = total > 0 ? (present / total) * 100 : 0;
                        const minimo = m.cursos?.porcentaje_minimo ?? 80;
                        stats[m.id] = {
                            total,
                            present,
                            porcentaje: Math.round(pct),
                            minimo,
                            cumple: pct >= minimo,
                            tieneDatos: total > 0,
                        };
                    });
                });
                setAsistStats(stats);
            } catch (e) {
                console.error('Error calculando asistencia estudiantes:', e);
            } finally {
                setLoadingAsist(false);
            }
        };
        fetchAsist();
    }, [calcularAsistencia, dataSource]);

    useEffect(() => {
        const matriculaIds: number[] = [];
        dataSource.forEach((s: any) => {
            (s.matriculas || []).forEach((m: any) => {
                if (m?.id) matriculaIds.push(m.id);
            });
        });
        if (matriculaIds.length === 0) {
            setPagosStats({});
            return;
        }
        const fetchPagos = async () => {
            setLoadingPagos(true);
            try {
                const { data: pagos } = await supabaseBrowserClient
                    .from('pagos')
                    .select('matricula_id, estado, fecha_pago, fecha_vencimiento, numero_cuota, periodo_pagado')
                    .in('matricula_id', matriculaIds);

                const hoy = dayjs().startOf('day');
                const finMesActual = hoy.endOf('month');
                const stats: Record<number, {
                    pagados: number;
                    pendientes: number;
                    pendientesVencidos: number;
                    inscripcionPagada: number;
                    mensualidadesPagadas: number;
                    mensualidadesPendientes: number;
                    mensualidadesPendientesVencidas: number;
                    mensualidadesPagadasMesActual: number;
                    mensualidadesPendientesMesActual: number;
                    mensualidadesPendientesVencidasMesActual: number;
                }> = {};
                (pagos || []).forEach((p: any) => {
                    const matriculaId = p?.matricula_id;
                    if (!matriculaId) return;
                    if (!stats[matriculaId]) {
                        stats[matriculaId] = {
                            pagados: 0,
                            pendientes: 0,
                            pendientesVencidos: 0,
                            inscripcionPagada: 0,
                            mensualidadesPagadas: 0,
                            mensualidadesPendientes: 0,
                            mensualidadesPendientesVencidas: 0,
                            mensualidadesPagadasMesActual: 0,
                            mensualidadesPendientesMesActual: 0,
                            mensualidadesPendientesVencidasMesActual: 0,
                        };
                    }
                    const esInscripcion = esPagoInscripcion(p);
                    const fechaVencimiento = p.fecha_vencimiento ? dayjs(p.fecha_vencimiento) : null;
                    const fechaPago = p.fecha_pago ? dayjs(p.fecha_pago) : null;
                    const esExigibleEsteMes = !fechaVencimiento || !fechaVencimiento.endOf('day').isAfter(finMesActual);

                    if (p.estado === 'pagado') stats[matriculaId].pagados += 1;
                    if (p.estado === 'pagado' && esInscripcion) stats[matriculaId].inscripcionPagada += 1;
                    if (p.estado === 'pagado' && !esInscripcion) {
                        stats[matriculaId].mensualidadesPagadas += 1;
                        if ((fechaPago && fechaPago.isSame(hoy, 'month')) || esExigibleEsteMes) {
                            stats[matriculaId].mensualidadesPagadasMesActual += 1;
                        }
                    }
                    if (p.estado === 'pendiente') {
                        stats[matriculaId].pendientes += 1;
                        if (!esInscripcion) {
                            stats[matriculaId].mensualidadesPendientes += 1;
                            if (esExigibleEsteMes) stats[matriculaId].mensualidadesPendientesMesActual += 1;
                        }
                        if (p.fecha_vencimiento && dayjs(p.fecha_vencimiento).endOf('day').isBefore(hoy)) {
                            stats[matriculaId].pendientesVencidos += 1;
                            if (!esInscripcion) {
                                stats[matriculaId].mensualidadesPendientesVencidas += 1;
                                if (esExigibleEsteMes) stats[matriculaId].mensualidadesPendientesVencidasMesActual += 1;
                            }
                        }
                    }
                });
                setPagosStats(stats);
            } catch (e) {
                console.error('Error cargando pagos estudiantes:', e);
            } finally {
                setLoadingPagos(false);
            }
        };
        fetchPagos();
    }, [dataSource]);
    const activos = useMemo(() => dataSource.filter(s => {
        const mats = obtenerMatriculasVigentes(s);
        if (mats.length === 0) return s.activo !== false; // Estudiantes sin matrícula (activos por defecto)
        return mats.some((m: any) => {
            const estado = normalizarEstado(m.estado);
            if (!estado) return true;
            return activoEstados.includes(estado) || (!esEstadoInactivo(estado) && !esEstadoGraduado(estado));
        });
    }), [dataSource, activoEstados]);
    const graduados = useMemo(() => dataSource.filter(s => (s.matriculas || []).some((m: any) => graduadoEstados.includes(String(m.estado || '').toLowerCase()))), [dataSource, graduadoEstados]);
    const desertores = useMemo(() => dataSource.filter(s => (s.matriculas || []).some((m: any) => {
        const st = asistStats[m.id];
        return st && st.tieneDatos && !st.cumple;
    })), [dataSource, asistStats]);

    let filteredDataSource = activeTab === 'activos' ? activos : activeTab === 'graduados' ? graduados : desertores;

    // Apply attendance quick filters
    if (attFilter === 'bajo') {
        filteredDataSource = filteredDataSource.filter((s: any) => {
            const mats = s.matriculas || [];
            let worst: any = null;
            mats.forEach((m: any) => {
                const st = asistStats[m.id];
                if (st && st.tieneDatos) {
                    worst = worst ? (st.porcentaje < worst.porcentaje ? st : worst) : st;
                }
            });
            return worst && !worst.cumple;
        });
    } else if (attFilter === 'sin') {
        filteredDataSource = filteredDataSource.filter((s: any) => {
            const mats = s.matriculas || [];
            const anyDatos = mats.some((m: any) => {
                const st = asistStats[m.id];
                return st && st.tieneDatos;
            });
            return !anyDatos;
        });
    }

    return (
        <List
            title={isMobile ? "Estudiantes" : "Gestión de Estudiantes"}
            headerButtons={<CreateButton resource="perfiles" />}
        >
            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                size={isMobile ? "small" : "middle"}
                items={[
                { key: 'activos', label: `Activos (${activos.length})` },
                { key: 'graduados', label: `Graduados (${graduados.length})` },
                { key: 'desertores', label: `Desertores (${desertores.length})` },
            ]}
            />

            {/* --- BARRA DE BÚSQUEDA EN TIEMPO REAL --- */}
            <Card variant="borderless" style={{ marginBottom: 12, background: '#f9f9f9' }}>
                <Input 
                    placeholder="🔍 Buscar por nombre (escribe para filtrar en tiempo real)..." 
                    prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                    allowClear
                    size={isMobile ? "middle" : "large"}
                    value={searchValue}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    style={{ width: '100%', maxWidth: isMobile ? '100%' : '500px' }}
                />
            </Card>

            {/* Quick attendance filters */}
            <Space style={{ marginBottom: 16 }} wrap>
                <Button type={attFilter === 'all' ? 'primary' : 'default'} size="small" onClick={() => setAttFilter('all')}>Todas</Button>
                <Button type={attFilter === 'bajo' ? 'primary' : 'default'} size="small" onClick={() => setAttFilter('bajo')}>Bajo Asistencia</Button>
                <Button type={attFilter === 'sin' ? 'primary' : 'default'} size="small" onClick={() => setAttFilter('sin')}>Sin Asistencia</Button>
            </Space>

            {isMobile ? (
                <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                    {filteredDataSource.length === 0 && (
                        <Text type="secondary">Sin estudiantes para mostrar</Text>
                    )}
                    {filteredDataSource.map((record: any) => {
                        const mats = obtenerMatriculasVigentes(record);
                        const cursoNombre = construirNombreGrupo(mats[0]?.cursos);
                        const pagoTag = obtenerEstadoPago(record);

                        return (
                            <Card key={record.id} style={{ borderRadius: 10 }} bodyStyle={{ padding: 10, position: "relative" }}>
                                <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 6 }}>
                                    <Tooltip title="Enviar WhatsApp">
                                        <Button 
                                            shape="circle"
                                            icon={<WhatsAppOutlined />} 
                                            size="small"
                                            style={{ 
                                                backgroundColor: '#f6ffed', 
                                                borderColor: '#b7eb8f', 
                                                color: '#389e0d' 
                                            }}
                                            onClick={() => {
                                                const msg = `Hola ${record.nombre_completo}, te contactamos de la Academia...`;
                                                enviarWhatsapp(record.telefono, msg);
                                            }}
                                        />
                                    </Tooltip>

                                    <Dropdown
                                        trigger={["click"]}
                                        menu={{
                                            items: [
                                                {
                                                    key: `ver-${record.id}`,
                                                    label: "Ver perfil",
                                                    onClick: () => router.push(`/estudiantes/show/${record.id}`),
                                                },
                                                {
                                                    key: `editar-${record.id}`,
                                                    label: "Editar",
                                                    onClick: () => router.push(`/estudiantes/edit/${record.id}`),
                                                },
                                                { type: "divider" as const },
                                                {
                                                    key: `archivar-${record.id}`,
                                                    label: "Archivar",
                                                    danger: true,
                                                    onClick: () => handleArchivarEstudiante(record, antMessage, modal, router),
                                                },
                                                {
                                                    key: `eliminar-${record.id}`,
                                                    label: "Eliminar",
                                                    danger: true,
                                                    disabled: user?.rol !== "admin",
                                                    onClick: () => confirmarEliminarEstudiante(record, antMessage, modal, router, setDeletedIds),
                                                },
                                            ],
                                        }}
                                    >
                                        <Button size="small" icon={<EllipsisOutlined />} />
                                    </Dropdown>
                                </div>

                                <Space direction="vertical" size={6} style={{ width: "100%", paddingRight: 56 }}>
                                    <Space>
                                        <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#87d068' }} />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <Text strong>{record.nombre_completo || "Sin Nombre"}</Text>
                                            <Text type="secondary" style={{ fontSize: 12 }}>ID: {record.identificacion || 'N/A'}</Text>
                                        </div>
                                    </Space>

                                    <Space size={4} wrap style={{ marginTop: 2 }}>
                                        {cursoNombre && <Tag color="blue">{cursoNombre}</Tag>}
                                        <Tag color={pagoTag.color}>{pagoTag.label}</Tag>
                                    </Space>

                                    {(record.telefono || record.email) && (
                                        <Space direction="vertical" size={0} style={{ marginTop: 2 }}>
                                            {record.telefono && (
                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                    <PhoneOutlined /> {record.telefono}
                                                </Text>
                                            )}
                                            {record.email && (
                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                    <MailOutlined /> {record.email}
                                                </Text>
                                            )}
                                        </Space>
                                    )}

                                </Space>
                            </Card>
                        );
                    })}
                </Space>
            ) : (
                <Table
                    {...tableProps}
                    dataSource={filteredDataSource}
                    rowKey="id"
                    loading={tableProps.loading || loadingAsist || loadingPagos}
                    size={"middle"}
                    scroll={isTablet ? { x: 1100 } : undefined}
                    pagination={{
                        ...(tableProps.pagination || {}),
                        simple: false,
                        showSizeChanger: true,
                    }}
                >
                
                {/* 1. Estudiante (Foto + Nombre) */}
                <Table.Column 
                    dataIndex="nombre_completo" 
                    title="Estudiante"
                    render={(value, record: any) => (
                        <Space>
                            <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#87d068' }} />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 600, fontSize: '15px' }}>{value || "Sin Nombre"}</span>
                                {/* Badge de asistencia (peor caso entre sus matrículas) */}
                                {(() => {
                                    const mats = obtenerMatriculasVigentes(record);
                                    let worst: any = null;
                                    mats.forEach((m: any) => {
                                        const st = asistStats[m.id];
                                        if (st && st.tieneDatos) {
                                            worst = worst ? (st.porcentaje < worst.porcentaje ? st : worst) : st;
                                        }
                                    });
                                    if (!worst) {
                                        return <span style={{ fontSize: '11px', color: '#999' }}>Asist: —</span>;
                                    }
                                    const ok = worst.cumple;
                                    const color = ok ? 'green' : 'red';
                                    return (
                                        <Tooltip title={`Presentes: ${worst.present}/${worst.total} · Mínimo: ${worst.minimo}%`}>
                                            <Tag color={color} style={{ marginTop: 4, width: 'fit-content' }}>
                                                Asist: {worst.porcentaje}%
                                            </Tag>
                                        </Tooltip>
                                    );
                                })()}
                                {/* ID de referencia rápida */}
                                <span style={{ fontSize: '11px', color: '#999' }}>ID: {record.identificacion || 'N/A'}</span>
                                {isMobile && (() => {
                                    const mats = obtenerMatriculasVigentes(record);
                                    const cursoNombre = mats[0]?.cursos?.nombre;
                                    const pagoTag = obtenerEstadoPago(record);
                                    return (
                                        <Space size={6} wrap style={{ marginTop: 6 }}>
                                            {cursoNombre && <Tag color="blue">{cursoNombre}</Tag>}
                                            <Tag color={pagoTag.color}>{pagoTag.label}</Tag>
                                        </Space>
                                    );
                                })()}
                            </div>
                        </Space>
                    )}
                />

                {/* 2. Identificación (Columna Dedicada) */}
                {!isMobile && (
                    <Table.Column 
                        dataIndex="identificacion" 
                        title="Identificación"
                        render={(value) => (
                            <div style={{ color: '#555' }}>
                                <IdcardOutlined style={{ marginRight: 6 }} />
                                {value ? <span style={{ fontWeight: 500 }}>{value}</span> : <span style={{color:'#ccc'}}>--</span>}
                            </div>
                        )}
                    />
                )}

                {/* 3. Cursos Inscritos (¡NUEVO!) */}
                {!isMobile && (
                    <Table.Column 
                        title="Cursos Activos"
                        render={(_, record: any) => {
                            const matriculas = obtenerMatriculasVigentes(record);
                            if (matriculas.length === 0) return <Tag>Ninguno</Tag>;

                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {matriculas.map((mat: any, index: number) => {
                                        const nombreCurso = construirNombreGrupo(mat.cursos) || "Curso sin nombre";
                                        const estadoRaw = mat.estado || "";
                                        const estado = (typeof estadoRaw === "string" ? estadoRaw.toLowerCase() : estadoRaw);
                                        const color = estado === 'activo' ? 'blue' : estado === 'finalizado' ? 'green' : 'default';
                                        return (
                                            <Tag key={index} color={color} style={{ margin: 0 }}>
                                                {nombreCurso}
                                            </Tag>
                                        );
                                    })}
                                </div>
                            );
                        }}
                    />
                )}

                {!isMobile && (
                    <Table.Column
                        title="Pago"
                        render={(_, record: any) => {
                            const pagoTag = obtenerEstadoPago(record);
                            return <Tag color={pagoTag.color}>{pagoTag.label}</Tag>;
                        }}
                    />
                )}

                {/* 4. Contacto */}
                {!isMobile && (
                    <Table.Column 
                        title="Contacto"
                        width={200}
                        render={(_, record: any) => (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {record.telefono && (
                                    <Tag icon={<PhoneOutlined />} color="geekblue" style={{ border: 'none', background: 'transparent', padding: 0, color: '#1d39c4' }}>
                                        {record.telefono}
                                    </Tag>
                                )}
                                {record.email && (
                                    <span style={{ fontSize: '12px', color: '#888' }}>
                                        <MailOutlined style={{ marginRight: 4 }} />
                                        {record.email}
                                    </span>
                                )}
                            </div>
                        )}
                    />
                )}

                {/* 5. Acciones */}
                <Table.Column 
                    title="Acciones"
                    fixed="right"
                    width={70}
                    align="center"
                    render={(_, record: any) => (
                        <Space direction="vertical" size={4} align="center">
                            <Tooltip title="Enviar WhatsApp">
                                <Button 
                                    shape="circle"
                                    icon={<WhatsAppOutlined />} 
                                    style={{ 
                                        backgroundColor: '#f6ffed', 
                                        borderColor: '#b7eb8f', 
                                        color: '#389e0d' 
                                    }}
                                    onClick={() => {
                                        const msg = `Hola ${record.nombre_completo}, te contactamos de la Academia...`;
                                        enviarWhatsapp(record.telefono, msg);
                                    }}
                                />
                            </Tooltip>

                            <Dropdown
                                trigger={["click"]}
                                menu={{
                                    items: [
                                        {
                                            key: `ver-${record.id}`,
                                            label: "Ver perfil",
                                            onClick: () => router.push(`/estudiantes/show/${record.id}`),
                                        },
                                        {
                                            key: `editar-${record.id}`,
                                            label: "Editar",
                                            onClick: () => router.push(`/estudiantes/edit/${record.id}`),
                                        },
                                        { type: "divider" as const },
                                        {
                                            key: `archivar-${record.id}`,
                                            label: "Archivar",
                                            danger: true,
                                            onClick: () => handleArchivarEstudiante(record, antMessage, modal, router),
                                        },
                                        {
                                            key: `eliminar-${record.id}`,
                                            label: "Eliminar",
                                            danger: true,
                                            disabled: user?.rol !== "admin",
                                            onClick: () => confirmarEliminarEstudiante(record, antMessage, modal, router, setDeletedIds),
                                        },
                                    ],
                                }}
                            >
                                <Button size="small" icon={<EllipsisOutlined />} />
                            </Dropdown>
                        </Space>
                    )}
                />
                </Table>
            )}
        </List>
    );
}

async function handleEliminarEstudiante(record: any, msg: any, _modalInstance: any, router: any, setDeletedIds: React.Dispatch<React.SetStateAction<string[]>>) {
    const estudianteId = record.id;

    try {
        const response = await fetch("/api/auth/delete-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: estudianteId }),
        });

        const result = await response.json();

        if (!response.ok || !result?.success) {
            throw new Error(result?.error || "No se pudo eliminar el usuario");
        }

        msg.success("✅ Estudiante eliminado en app y Supabase");
        setDeletedIds((prev) => [...prev, estudianteId]);
        router.refresh();
    } catch (err: any) {
        console.error('Error eliminando estudiante:', err);
        msg.error('Error al eliminar: ' + (err?.message || 'Desconocido'));
    }
}

function confirmarEliminarEstudiante(record: any, msg: any, modalInstance: any, router: any, setDeletedIds: React.Dispatch<React.SetStateAction<string[]>>) {
    const estudianteId = record.id;
    
    // Usar el modal desde el contexto de App correctamente
    modalInstance.confirm({
        title: "¿Eliminar este estudiante?",
        width: 600,
        content: (
            <div>
                <p>Estás a punto de eliminar permanentemente a:</p>
                <p><strong>{record.nombre_completo}</strong></p>
                <p>ID: {record.identificacion || 'N/A'}</p>
                <div style={{ marginTop: 16, padding: 12, background: '#fff0f0', border: '1px solid #ffccc7', borderRadius: 4 }}>
                    <strong>⚠️ Esta acción eliminará automáticamente:</strong>
                    <ul style={{ margin: '8px 0 0 0' }}>
                        <li>✋ Todas sus matrículas</li>
                        <li>💰 Todos sus pagos</li>
                        <li>📊 Todos sus registros de asistencia</li>
                        <li>📝 Todas sus calificaciones</li>
                        <li>🔔 Todas sus notificaciones</li>
                        <li>👤 Su perfil completo</li>
                    </ul>
                    <p style={{ marginTop: 8, marginBottom: 0, fontWeight: 'bold', color: '#cf1322' }}>
                        Esta operación es PERMANENTE e IRREVERSIBLE.
                    </p>
                </div>
                <div style={{ marginTop: 12, padding: 10, background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 4 }}>
                    <strong>💡 Alternativa recomendada:</strong>
                    <p style={{ margin: '4px 0 0 0' }}>Usa el botón <strong>&quot;Archivar&quot;</strong> para ocultar al estudiante sin perder su historial.</p>
                </div>
            </div>
        ),
        okText: "Sí, ELIMINAR PERMANENTEMENTE",
        okType: "danger",
        cancelText: "Cancelar",
        onOk: async () => {
            await handleEliminarEstudiante(record, msg, modalInstance, router, setDeletedIds);
        }
    });
}

function handleArchivarEstudiante(record: any, msg: any, modalInstance: any, router: any) {
    const estudianteId = record.id;
    
    modalInstance.confirm({
        title: "¿Archivar este estudiante?",
        content: (
            <div>
                <p><strong>{record.nombre_completo}</strong> será archivado (marcado como inactivo).</p>
                <p>El estudiante desaparecerá de la lista pero sus datos se conservan:</p>
                <ul>
                    <li>✓ Historial de matrículas y calificaciones se mantiene</li>
                    <li>✓ Registros de pagos intactos</li>
                    <li>✓ Datos históricos para auditoría</li>
                </ul>
                <div style={{ marginTop: 16, padding: 12, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
                    <strong>ℹ️ Nota:</strong> No aparecerá en el dropdown de selección de estudiantes para nuevos pagos.
                </div>
            </div>
        ),
        okText: "Sí, archivar",
        okType: "default",
        cancelText: "Cancelar",
        onOk: async () => {
            try {
                const { error } = await supabaseBrowserClient
                    .from("perfiles")
                    .update({ 
                        activo: false,
                        fecha_baja: new Date().toISOString()
                    })
                    .eq("id", estudianteId);
                
                if (error) {
                    msg.error("Error al archivar: " + (error.message || 'Desconocido'));
                    return;
                }
                
                msg.success("Estudiante archivado correctamente");
                router.refresh();
            } catch (err: any) {
                msg.error(err?.message || "Error al archivar estudiante");
            }
        }
    });
}