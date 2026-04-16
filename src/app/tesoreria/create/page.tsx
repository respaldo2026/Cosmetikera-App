"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Create, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, Select, InputNumber, DatePicker, Row, Col, message, Card, Alert } from "antd";
import dayjs from "dayjs";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { formatDate } from "@utils/date";
import { UserOutlined, DollarCircleOutlined, SolutionOutlined } from "@ant-design/icons";
import type { DefaultOptionType } from "antd/es/select";
import { enviarWhatsappConPlantilla } from "@utils/whatsapp";
import { abrirTicketPagoDesdeBlob, generarTicketPagoBlob } from "@utils/pago-ticket";
import { subirTicketPago } from "@utils/ticket-storage";
import { registrarIngresoDesdePago } from "@modules/finanzas/movimientos.service";

type EstudianteDetalle = {
    id: string;
    nombre_completo: string;
    identificacion?: string | null;
    telefono?: string | null;
    notif_whatsapp?: boolean | null;
};

type ConfiguracionAcademia = {
    nombre_academia?: string | null;
    ruc?: string | null;
    logo_url?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    whatsapp?: string | null;
    email?: string | null;
    ticket_titulo?: string | null;
    ticket_nota?: string | null;
    ticket_pie?: string | null;
    ticket_campos?: {
        logo?: boolean;
        nombreAcademia?: boolean;
        ruc?: boolean;
        direccion?: boolean;
        telefono?: boolean;
        email?: boolean;
        fecha?: boolean;
        concepto?: boolean;
        monto?: boolean;
        nota?: boolean;
        pie?: boolean;
        titulo?: boolean;
    } | null;
};

const formatoCOP = (valor: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(valor);

export default function PagoCreate() {
    const { formProps, saveButtonProps } = useForm({ redirect: "list" });

    const [cursosDelEstudiante, setCursosDelEstudiante] = useState<any[]>([]);
    const [buscandoCursos, setBuscandoCursos] = useState(false);
    const [cuotasPendientes, setCuotasPendientes] = useState<any[]>([]);
    const [cargandoCuotas, setCargandoCuotas] = useState(false);
    const [cuotaSeleccionada, setCuotaSeleccionada] = useState<any | null>(null);
    const [estudianteSeleccionado, setEstudianteSeleccionado] = useState<EstudianteDetalle | null>(null);
    const [registrandoPago, setRegistrandoPago] = useState(false);
    const [configuracion, setConfiguracion] = useState<ConfiguracionAcademia | null>(null);

    // 1. Selector de Estudiantes (Buscamos en Perfiles donde rol = estudiante Y activo = true)
    const { selectProps: allEstudianteSelectProps } = useSelect({
        resource: "perfiles",
        optionLabel: "nombre_completo",
        optionValue: "id",
        filters: [
            { field: "rol", operator: "eq", value: "estudiante" },
            { field: "activo", operator: "eq", value: true }
        ],
        sorters: [{ field: "nombre_completo", order: "asc" }]
    });

    useEffect(() => {
        const cargarConfiguracion = async () => {
            try {
                const { data, error } = await supabaseBrowserClient
                    .from("configuracion")
                    .select("*")
                    .order("updated_at", { ascending: false, nullsFirst: false })
                    .order("created_at", { ascending: false, nullsFirst: false })
                    .limit(1)
                    .maybeSingle();

                if (!error && data) {
                    setConfiguracion(data);
                }
            } catch (error) {
                console.error("No se pudo cargar la configuración de la academia", error);
            }
        };

        cargarConfiguracion();
    }, []);

    const estudianteSelectProps = {
        options: allEstudianteSelectProps.options,
        loading: allEstudianteSelectProps.loading
    };

    // 2. Cuando eliges un estudiante, buscamos sus matrículas activas y cuotas pendientes
    const handleEstudianteChange = async (estudianteId?: string) => {
        if (!estudianteId) {
            setEstudianteSeleccionado(null);
            setCursosDelEstudiante([]);
            setCuotasPendientes([]);
            setCuotaSeleccionada(null);
            formProps.form?.setFieldsValue({
                estudiante_id: undefined,
                matricula_id: undefined,
                cuota_id: undefined,
                monto: undefined,
            });
            return;
        }

        setBuscandoCursos(true);
        setCursosDelEstudiante([]);
        setCuotasPendientes([]);
        setCuotaSeleccionada(null);
        formProps.form?.setFieldsValue({ matricula_id: undefined, cuota_id: undefined, monto: undefined });

        try {
            const [
                { data: estudianteDetalle, error: errorEstudiante },
                { data: matriculas, error: errorMatriculas },
            ] = await Promise.all([
                supabaseBrowserClient
                    .from("perfiles")
                    .select("id, nombre_completo, telefono, identificacion, notif_whatsapp")
                    .eq("id", estudianteId)
                    .maybeSingle(),
                supabaseBrowserClient
                    .from("matriculas")
                    .select("id, cursos(nombre, precio_mensualidad)")
                    .eq("estudiante_id", estudianteId),
            ]);

            if (estudianteDetalle) {
                setEstudianteSeleccionado(estudianteDetalle as EstudianteDetalle);
            } else if (errorEstudiante) {
                console.warn("Sin información detallada del estudiante", errorEstudiante);
            }

            if (errorMatriculas) {
                message.error("Error buscando cursos del estudiante");
            } else if (matriculas) {
                setCursosDelEstudiante(matriculas);

                if (matriculas.length === 1) {
                    const [unicaMatricula] = matriculas;
                    if (unicaMatricula) {
                        formProps.form?.setFieldValue("matricula_id", unicaMatricula.id);
                        await cargarCuotasPendientes(unicaMatricula.id);
                    }
                }
            }
        } catch (error) {
            console.error("Error cargando información del estudiante", error);
            message.error("No se pudo obtener la información del estudiante");
        } finally {
            setBuscandoCursos(false);
        }
    };

    // 3. Cuando se selecciona una matrícula, cargar sus cuotas pendientes
    const cargarCuotasPendientes = async (matriculaId: string) => {
        if (!matriculaId) return;
        setCargandoCuotas(true);
        formProps.form?.setFieldsValue({ cuota_id: undefined, monto: undefined });
        setCuotaSeleccionada(null);
        
        const { data, error } = await supabaseBrowserClient
            .from("pagos")
            .select("*")
            .eq("matricula_id", matriculaId)
            .in("estado", ["pendiente", "vencido"]) // Solo cuotas no pagadas
            .order("numero_cuota", { ascending: true });
        
        if (error) {
            message.error("Error cargando cuotas pendientes");
            setCuotasPendientes([]);
        } else {
            setCuotasPendientes(data || []);
            // Pre-seleccionar la primera cuota pendiente
            if (data && data.length > 0) {
                const cuotaInicial = data[0];
                formProps.form?.setFieldValue("cuota_id", cuotaInicial.id);
                formProps.form?.setFieldValue("monto", cuotaInicial.monto);
                setCuotaSeleccionada(cuotaInicial);
            }
        }
        setCargandoCuotas(false);
    };

    // Al seleccionar el curso, cargar sus cuotas pendientes
    const handleCursoChange = (matriculaId?: string) => {
        if (!matriculaId) {
            formProps.form?.setFieldsValue({ cuota_id: undefined, monto: undefined });
            setCuotasPendientes([]);
            setCuotaSeleccionada(null);
            return;
        }
        setCuotaSeleccionada(null);
        cargarCuotasPendientes(matriculaId);
    };

    // Al seleccionar una cuota específica, autocompletar el monto
    const handleCuotaChange = (cuotaId?: string) => {
        if (!cuotaId) {
            setCuotaSeleccionada(null);
            formProps.form?.setFieldValue("monto", undefined);
            return;
        }
        const cuota = cuotasPendientes.find((c) => c.id === cuotaId);
        if (cuota) {
            formProps.form?.setFieldValue("monto", cuota.monto);
            setCuotaSeleccionada(cuota);
        }
    };

    // Definir parser fuera del JSX para evitar error de sintaxis
    const montoParser = (value: string | undefined): number => {
        const parsed = value?.replace(/\$\s?|(,*)/g, '');
        return parsed ? parseInt(parsed, 10) : 0;
    };

    const cursoOptions = useMemo<DefaultOptionType[]>(
        () => cursosDelEstudiante.map((m) => ({
            label: m.cursos?.nombre ?? "Curso sin nombre",
            value: m.id,
        })),
        [cursosDelEstudiante]
    );

    const cuotaOptions = useMemo<DefaultOptionType[]>(
        () =>
            cuotasPendientes.map((c) => {
                const montoTexto = c.monto ? c.monto.toLocaleString() : "0";
                const vencimiento = c.fecha_vencimiento ? ` · Vence: ${formatDate(c.fecha_vencimiento)}` : "";
                const estado = c.estado === "vencido" ? " · Vencida" : "";
                return {
                    label: `Cuota #${c.numero_cuota || "?"} · $${montoTexto}${vencimiento}${estado}`,
                    value: c.id,
                };
            }),
        [cuotasPendientes]
    );

    const handleOnFinish = async (values: any) => {
        const { cuota_id, monto, metodo_pago, fecha_pago, referencia } = values;

        if (!cuota_id) {
            message.error("Debes seleccionar una cuota a pagar");
            return;
        }

        const cuota = cuotasPendientes.find((c) => c.id === cuota_id) || cuotaSeleccionada;

        if (!cuota) {
            message.error("No se encontró la cuota seleccionada");
            return;
        }

        const montoNumero = Number(monto || 0);
        if (Number.isNaN(montoNumero) || montoNumero <= 0) {
            message.error("El monto debe ser mayor a 0");
            return;
        }

        if (montoNumero > 999999999) {
            message.error("El monto es demasiado alto");
            return;
        }

        setRegistrandoPago(true);

        try {
            const fechaPagoISO = fecha_pago ? dayjs(fecha_pago).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD");
            const fechaPagoLegible = dayjs(fechaPagoISO).format("DD/MM/YYYY");

            const { error } = await supabaseBrowserClient
                .from("pagos")
                .update({
                    estado: "pagado",
                    monto: montoNumero,
                    metodo_pago,
                    referencia: referencia || null,
                    fecha_pago: fechaPagoISO,
                    observaciones: `Pago registrado manualmente el ${dayjs().format("DD/MM/YYYY HH:mm")}`,
                })
                .eq("id", cuota.id);

            if (error) {
                throw error;
            }

            const cursoRelacionado = cursosDelEstudiante.find((m) => String(m.id) === String(cuota.matricula_id));
            const periodoLegible = cuota.periodo_pagado || `Cuota ${cuota.numero_cuota ?? ""}`.trim();

            const { data: configActual } = await supabaseBrowserClient
                .from("configuracion")
                .select("*")
                .order("updated_at", { ascending: false, nullsFirst: false })
                .order("created_at", { ascending: false, nullsFirst: false })
                .limit(1)
                .maybeSingle();

            const configTicket = configActual || configuracion;

            const ticketData = {
                academia: {
                    nombre: configTicket?.nombre_academia ?? "Academia Crystal",
                    ruc: configTicket?.ruc ?? undefined,
                    logoUrl: configTicket?.logo_url ?? undefined,
                    telefono: configTicket?.telefono ?? configTicket?.whatsapp ?? undefined,
                    direccion: configTicket?.direccion ?? undefined,
                    email: configTicket?.email ?? undefined,
                    ticketTitulo: configTicket?.ticket_titulo ?? undefined,
                    ticketNota: configTicket?.ticket_nota ?? undefined,
                    ticketPie: configTicket?.ticket_pie ?? undefined,
                    ticketCampos: configTicket?.ticket_campos ?? undefined,
                },
                estudiante: {
                    nombre: estudianteSeleccionado?.nombre_completo ?? "Estudiante",
                    identificacion: estudianteSeleccionado?.identificacion ?? undefined,
                    telefono: estudianteSeleccionado?.telefono ?? undefined,
                },
                pago: {
                    referencia: referencia || cuota.id,
                    metodo: metodo_pago,
                    monto: montoNumero,
                    fecha: fechaPagoLegible,
                    concepto: `${periodoLegible} - ${cursoRelacionado?.cursos?.nombre ?? "Curso"}`,
                    periodo: periodoLegible,
                    numeroCuota: cuota.numero_cuota ?? undefined,
                },
                curso: {
                    nombre: cursoRelacionado?.cursos?.nombre ?? "Curso",
                },
            } as const;

            const placeholder = window.open("", "_blank");

            try {
                const blob = await generarTicketPagoBlob(ticketData);

                if (placeholder) {
                    abrirTicketPagoDesdeBlob(blob, placeholder);
                } else {
                    abrirTicketPagoDesdeBlob(blob);
                }

                const { publicUrl } = await subirTicketPago({
                    blob,
                    pagoId: cuota.id,
                    estudianteId: estudianteSeleccionado?.id ?? values.estudiante_id,
                });

                await supabaseBrowserClient
                    .from("pagos")
                    .update({ ticket_url: publicUrl } as any)
                    .eq("id", cuota.id);

                await registrarIngresoDesdePago({
                    fecha: fechaPagoISO,
                    monto: montoNumero,
                    concepto: `${periodoLegible} - ${cursoRelacionado?.cursos?.nombre ?? "Curso"}`,
                    categoria: "matriculas",
                    metodo_pago,
                    referencia: referencia || cuota.id,
                    estudiante_id: estudianteSeleccionado?.id ?? values.estudiante_id,
                    ticket_url: publicUrl,
                    pago_id: cuota.id,
                });

                message.success("Pago registrado y ticket generado.");
            } catch (ticketError) {
                if (placeholder) {
                    placeholder.close();
                }
                throw ticketError;
            }

            if (estudianteSeleccionado?.telefono && (estudianteSeleccionado?.notif_whatsapp ?? true)) {
                try {
                  const { enviarConfirmacionPago } = await import('@/services/whatsapp-messages-module');
                  
                  await enviarConfirmacionPago(estudianteSeleccionado.id, {
                    nombre: estudianteSeleccionado.nombre_completo,
                    telefono: estudianteSeleccionado.telefono,
                    referenciaPago: referencia || 'Pago registrado',
                    monto: montoNumero,
                    fechaPago: dayjs().format('DD/MM/YYYY'),
                    concepto: cuota.periodo_pagado || `Cuota ${cuota.numero_cuota}`,
                    nombreCurso: cursoRelacionado?.cursos?.nombre ?? 'Curso',
                    fechaVigencia: dayjs().add(1, 'month').format('DD/MM/YYYY'),
                    fechaProximaClase: 'Por confirmar'
                  });
                } catch (error) {
                  console.error('Error enviando confirmación de pago:', error);
                }
            }

            await cargarCuotasPendientes(String(cuota.matricula_id));
        } catch (error) {
            console.error("Error registrando pago", error);
            message.error("No se pudo registrar el pago. Inténtalo nuevamente.");
        } finally {
            setRegistrandoPago(false);
        }
    };

    return (
        <Create 
            saveButtonProps={{ 
                ...saveButtonProps, 
                loading: registrandoPago, 
                disabled: registrandoPago,
                onClick: () => formProps.form?.submit(), 
            }} 
            title="Registrar Nuevo Ingreso"
        >
            <Form 
                {...formProps} 
                form={formProps.form}
                layout="vertical" 
                onFinish={handleOnFinish} 
                initialValues={{ metodo_pago: 'efectivo', fecha_pago: dayjs() }}
            >
                <Row gutter={24}>
                    <Col span={12}>
                        <Form.Item label="Estudiante" name="estudiante_id" rules={[{ required: true, message: "Selecciona un estudiante" }]}> 
                            <Select 
                                {...estudianteSelectProps} 
                                placeholder="Escribe para buscar..." 
                                showSearch
                                optionFilterProp="label"
                                onChange={handleEstudianteChange}
                                allowClear
                                suffixIcon={<UserOutlined />}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="Curso" name="matricula_id" rules={[{ required: true, message: "Selecciona un curso" }]}> 
                            <Select 
                                options={cursoOptions}
                                loading={buscandoCursos}
                                placeholder="Selecciona un curso"
                                onChange={handleCursoChange}
                                allowClear
                                suffixIcon={<SolutionOutlined />}
                            />
                        </Form.Item>
                    </Col>
                </Row>
                <Row gutter={24}>
                    <Col span={12}>
                        <Form.Item label="Cuota" name="cuota_id" rules={[{ required: true, message: "Selecciona una cuota" }]}> 
                            <Select 
                                options={cuotaOptions}
                                loading={cargandoCuotas}
                                placeholder="Selecciona una cuota"
                                onChange={handleCuotaChange}
                                allowClear
                                suffixIcon={<DollarCircleOutlined />}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="Monto a pagar" name="monto" rules={[{ required: true, message: "Ingresa el monto" }]}> 
                            <InputNumber 
                                min={0}
                                max={999999999}
                                style={{ width: "100%" }}
                                parser={montoParser}
                                prefix={<DollarCircleOutlined />}
                                placeholder="Monto"
                            />
                        </Form.Item>
                    </Col>
                </Row>
                <Row gutter={24}>
                    <Col span={12}>
                        <Form.Item label="Método de pago" name="metodo_pago" rules={[{ required: true, message: "Selecciona el método de pago" }]}> 
                            <Select
                                options={[
                                    { label: "Efectivo", value: "efectivo" },
                                    { label: "Transferencia", value: "transferencia" },
                                    { label: "Tarjeta", value: "tarjeta" },
                                    { label: "Otro", value: "otro" },
                                ]}
                                placeholder="Selecciona el método de pago"
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="Fecha de pago" name="fecha_pago" rules={[{ required: true, message: "Selecciona la fecha de pago" }]}> 
                            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
                        </Form.Item>
                    </Col>
                </Row>
                <Row gutter={24}>
                    <Col span={12}>
                        <Form.Item label="Referencia" name="referencia"> 
                            <Input placeholder="Referencia o número de comprobante" />
                        </Form.Item>
                    </Col>
                </Row>

                {cursosDelEstudiante.length === 0 && !buscandoCursos && (
                    <Alert style={{marginBottom: 20}} type="info" message="Nota: Selecciona un estudiante para ver sus cursos inscritos." />
                )}

                {cuotasPendientes.length === 0 && !cargandoCuotas && cursosDelEstudiante.length > 0 && (
                    <Alert style={{marginBottom: 20}} type="warning" message="Este estudiante no tiene cuotas pendientes de pago." />
                )}

                {cuotaSeleccionada && (
                    <Card style={{ marginBottom: 20, background: '#f0f5ff' }} title="Detalle de la cuota seleccionada">
                        <Row gutter={[16, 12]}>
                            <Col xs={24} md={12}>
                                <strong>Período:</strong> {cuotaSeleccionada.periodo_pagado || "Sin período"}
                            </Col>
                            <Col xs={24} md={12}>
                                <strong>Monto:</strong> ${cuotaSeleccionada.monto?.toLocaleString() || 0}
                            </Col>
                            <Col xs={24} md={12}>
                                <strong>Estado:</strong> {cuotaSeleccionada.estado === "vencido" ? "Vencida" : "Pendiente"}
                            </Col>
                            <Col xs={24} md={12}>
                                <strong>Vence:</strong> {cuotaSeleccionada.fecha_vencimiento ? formatDate(cuotaSeleccionada.fecha_vencimiento) : "Sin fecha"}
                            </Col>
                        </Row>
                    </Card>
                )}
            </Form>
        </Create>
    );
}