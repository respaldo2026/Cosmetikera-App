"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, Typography, Descriptions, Button, Space, message, Spin, Alert, Form, Select, Input, DatePicker, Divider, Row, Col, Result } from "antd";
import { PrinterOutlined, DollarCircleOutlined, WhatsAppOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";
import dayjs from "dayjs";
import { enviarWhatsappConPlantilla } from "@utils/whatsapp";
import { registrarIngresoDesdePago } from "@modules/finanzas/movimientos.service";
import { abrirTicketPagoDesdeBlob, generarTicketPagoBlob } from "@utils/pago-ticket";
import { subirTicketPago } from "@utils/ticket-storage";

const { Title, Text } = Typography;

const formatoCOP = (valor: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(valor);

const PORTAL_ESTUDIANTE_URL =
    process.env.NEXT_PUBLIC_PORTAL_ESTUDIANTE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://app.academiacrystal.com";

export default function PagoInscripcionPage() {
    const params = useParams();
    const router = useRouter();
    const matriculaId = params?.id as string;
    const printRef = useRef<HTMLDivElement>(null);

    const [loading, setLoading] = useState(true);
    const [matricula, setMatricula] = useState<any>(null);
    const [estudiante, setEstudiante] = useState<any>(null);
    const [curso, setCurso] = useState<any>(null);
    const [pagoInscripcion, setPagoInscripcion] = useState<any>(null);
    const [procesandoPago, setProcesandoPago] = useState(false);

    const [form] = Form.useForm();

    const cargarDatos = useCallback(async () => {
        try {
            setLoading(true);

            // Cargar matrícula
            const { data: mat, error: errMat } = await supabaseBrowserClient
                .from("matriculas")
                .select(`
                    *,
                    cursos ( id, nombre, descripcion, precio, programa_id, programas(nombre, precio_inscripcion) )
                `)
                .eq("id", matriculaId)
                .single();

            if (errMat || !mat) throw new Error("No se encontró la matrícula");
            setMatricula(mat);
            setCurso(mat.cursos);

            // Cargar estudiante
            const { data: est, error: errEst } = await supabaseBrowserClient
                .from("perfiles")
                .select("*")
                .eq("id", mat.estudiante_id)
                .single();

            if (errEst || !est) throw new Error("No se encontró el estudiante");
            setEstudiante(est);

            // Cargar pago de inscripción (cuota 0)
            const { data: pago, error: errPago } = await supabaseBrowserClient
                .from("pagos")
                .select("*")
                .eq("matricula_id", matriculaId)
                .eq("numero_cuota", 0)
                .single();

            if (errPago) console.warn("No se encontró pago de inscripción:", errPago);
            setPagoInscripcion(pago);

            // Si ya está pagado, actualizar estado de matrícula si es necesario
            if (pago?.estado === "pagado" && mat.estado === "pendiente") {
                await supabaseBrowserClient
                    .from("matriculas")
                    .update({ estado: "activo" })
                    .eq("id", matriculaId);
                message.success("Matrícula activada");
            }
        } catch (error: any) {
            console.error("Error cargando datos:", error);
            message.error(error.message || "Error cargando información");
        } finally {
            setLoading(false);
        }
    }, [matriculaId]);

    useEffect(() => {
        if (matriculaId) {
            cargarDatos();
        }
    }, [matriculaId, cargarDatos]);

    const handlePrint = () => {
        if (printRef.current) {
            const printWindow = window.open("", "_blank");
            if (printWindow) {
                printWindow.document.write(`
                    <html>
                        <head>
                            <title>Recibo de Inscripción</title>
                            <style>
                                body { font-family: Arial, sans-serif; padding: 20px; }
                                .header { text-align: center; margin-bottom: 30px; }
                                .info { margin: 20px 0; }
                                .row { display: flex; margin: 10px 0; }
                                .label { font-weight: bold; width: 200px; }
                                .value { flex: 1; }
                                .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #666; }
                                .pending { color: red; font-weight: bold; }
                                .paid { color: green; font-weight: bold; }
                            </style>
                        </head>
                        <body>
                            ${printRef.current.innerHTML}
                        </body>
                    </html>
                `);
                printWindow.document.close();
                printWindow.print();
            }
        }
    };

    const handleRegistrarPago = async (values: any) => {
        try {
            setProcesandoPago(true);

            const { monto, metodo_pago, referencia, fecha_pago } = values;
            const montoNumero = Number(monto ?? 0) || Number(pagoInscripcion?.monto ?? 0);
            const fechaPagoISO = fecha_pago ? dayjs(fecha_pago).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD");
            const fechaPagoLegible = dayjs(fechaPagoISO).format("DD/MM/YYYY");

            // Actualizar el pago de inscripción
            const { error: errUpdate } = await supabaseBrowserClient
                .from("pagos")
                .update({
                    estado: "pagado",
                    monto: montoNumero,
                    metodo_pago: metodo_pago,
                    referencia: referencia || null,
                    fecha_pago: fechaPagoISO,
                    observaciones: `Pago registrado el ${dayjs().format("DD/MM/YYYY HH:mm")}`
                })
                .eq("id", pagoInscripcion.id);

            if (errUpdate) throw errUpdate;

            // Activar la matrícula
            const { error: errMat } = await supabaseBrowserClient
                .from("matriculas")
                .update({ estado: "activo" })
                .eq("id", matriculaId);

            if (errMat) throw errMat;

            let ticketUrl: string | null = null;

            try {
                const { data: configAcademia } = await supabaseBrowserClient
                    .from("configuracion")
                    .select("*")
                    .order("updated_at", { ascending: false, nullsFirst: false })
                    .order("created_at", { ascending: false, nullsFirst: false })
                    .limit(1)
                    .maybeSingle();

                const ticketData = {
                    academia: {
                        nombre: configAcademia?.nombre_academia || "Academia Crystal Diamante",
                        ruc: configAcademia?.ruc || undefined,
                        logoUrl: configAcademia?.logo_url || undefined,
                        telefono: configAcademia?.telefono || configAcademia?.whatsapp || undefined,
                        direccion: configAcademia?.direccion || undefined,
                        email: configAcademia?.email || undefined,
                        ticketTitulo: configAcademia?.ticket_titulo || undefined,
                        ticketNota: configAcademia?.ticket_nota || undefined,
                        ticketPie: configAcademia?.ticket_pie || undefined,
                        ticketCampos: configAcademia?.ticket_campos || undefined,
                    },
                    estudiante: {
                        nombre: estudiante?.nombre_completo || "Estudiante",
                        identificacion: estudiante?.identificacion || undefined,
                        telefono: estudiante?.telefono || undefined,
                    },
                    pago: {
                        referencia: referencia || pagoInscripcion.id,
                        metodo: metodo_pago || "efectivo",
                        monto: montoNumero,
                        fecha: fechaPagoLegible,
                        concepto: `Inscripción - ${curso?.nombre ?? "Curso"}`,
                        periodo: "Inscripción",
                        numeroCuota: 0,
                    },
                    curso: {
                        nombre: curso?.nombre ?? "Curso",
                    },
                } as const;

                const blob = await generarTicketPagoBlob(ticketData);
                const placeholder = window.open("", "_blank");
                if (placeholder) {
                    abrirTicketPagoDesdeBlob(blob, placeholder);
                } else {
                    abrirTicketPagoDesdeBlob(blob);
                }

                const { publicUrl } = await subirTicketPago({
                    blob,
                    pagoId: pagoInscripcion.id,
                    estudianteId: estudiante?.id,
                });

                ticketUrl = publicUrl;

                await supabaseBrowserClient
                    .from("pagos")
                    .update({ ticket_url: publicUrl } as any)
                    .eq("id", pagoInscripcion.id);
            } catch (ticketError) {
                console.error("Error generando/guardando ticket de inscripción:", ticketError);
                message.warning("Pago registrado, pero no se pudo generar el ticket PDF.");
            }

            try {
                await registrarIngresoDesdePago({
                    fecha: fechaPagoISO,
                    monto: montoNumero,
                    concepto: `Pago de inscripción - ${curso?.nombre ?? "Curso"}`,
                    categoria: "inscripciones",
                    metodo_pago: metodo_pago || null,
                    referencia: referencia || pagoInscripcion.id,
                    descripcion: `Pago de inscripción de matrícula ${matriculaId}`,
                    estudiante_id: estudiante?.id ?? null,
                    ticket_url: ticketUrl,
                    pago_id: pagoInscripcion.id,
                    created_by: null,
                });
            } catch (movError) {
                console.error("Error registrando ingreso en tesorería (inscripción):", movError);
                message.warning("Pago registrado, pero no se pudo reflejar automáticamente en tesorería.");
            }

            message.success("✅ Pago registrado y matrícula activada");

            // Enviar confirmación de pago + bienvenida portal
            if (estudiante?.telefono && (estudiante?.notif_whatsapp ?? true)) {
                try {
                    const { enviarConfirmacionPago, enviarBienvenidaPortalEstudiante } = await import('@/services/whatsapp-messages-module');
                    
                    const resultadoConfirmacion = await enviarConfirmacionPago(estudiante.id, {
                        nombre: estudiante.nombre_completo,
                        telefono: estudiante.telefono,
                        referenciaPago: referencia || 'Contado',
                        monto: montoNumero,
                        fechaPago: dayjs().format('DD/MM/YYYY'),
                        concepto: 'Inscripción',
                        nombreCurso: curso?.nombre ?? 'Curso',
                        fechaVigencia: dayjs().add(1, 'month').format('DD/MM/YYYY'),
                        fechaProximaClase: curso?.fecha_inicio ? 
                            new Date(curso.fecha_inicio).toLocaleDateString('es-CO') : 'Por confirmar'
                    });

                    if (!resultadoConfirmacion.exito) {
                        message.warning('⚠️ Pago registrado, pero no se pudo enviar la confirmación por WhatsApp.');
                        console.error('Error enviando confirmación de pago:', resultadoConfirmacion.error);
                    }

                    await new Promise((resolve) => setTimeout(resolve, 1500));

                    const resultadoBienvenida = await enviarBienvenidaPortalEstudiante(estudiante.id, {
                        nombre: estudiante.nombre_completo,
                        telefono: estudiante.telefono,
                        nombreCurso: curso?.nombre ?? 'Curso',
                        enlacePortal: PORTAL_ESTUDIANTE_URL,
                        usuario: (estudiante.email || estudiante.identificacion) || 'tu usuario registrado',
                        genero: estudiante.genero ?? null,
                    });

                    if (!resultadoBienvenida.exito) {
                        message.warning('⚠️ Pago registrado y confirmación enviada, pero falló la bienvenida al portal.');
                        console.error('Error enviando bienvenida al portal:', resultadoBienvenida.error);
                    }
                } catch (error) {
                    message.warning('⚠️ Pago registrado, pero hubo un problema al enviar mensajes de WhatsApp.');
                    console.error('Error enviando mensajes post-pago:', error);
                }
            }

            // Recargar datos
            await cargarDatos();

            setTimeout(() => {
                router.push(`/estudiantes/show/${estudiante.id}`);
            }, 2000);
        } catch (error: any) {
            console.error("Error registrando pago:", error);
            message.error("Error al registrar el pago");
        } finally {
            setProcesandoPago(false);
        }
    };

    const handleWhatsAppRecordatorio = async () => {
        if (!estudiante?.telefono) {
            message.warning("El estudiante no tiene teléfono registrado");
            return;
        }

        const monto = pagoInscripcion?.monto || curso?.programas?.precio_inscripcion || 50000;
        await enviarWhatsappConPlantilla(
            estudiante.telefono,
            "pago_inscripcion_pendiente",
            {
                nombre: estudiante.nombre_completo,
                curso: curso?.nombre ?? "Curso",
                monto: formatoCOP(Number(monto)),
            }
        );
        message.success("Recordatorio enviado por WhatsApp");
    };

    if (loading) {
        return (
            <div style={{ textAlign: "center", padding: "100px" }}>
                <Spin size="large" />
                <p>Cargando información...</p>
            </div>
        );
    }

    if (!matricula || !estudiante || !curso) {
        return (
            <Alert
                message="Error"
                description="No se pudo cargar la información de la matrícula"
                type="error"
                showIcon
            />
        );
    }

    const yaPagado = pagoInscripcion?.estado === "pagado";
    const montoInscripcion = pagoInscripcion?.monto || curso?.programas?.precio_inscripcion || 50000;

    return (
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px" }}>
            <Title level={2}>
                {yaPagado ? "✅ Inscripción Pagada" : "📝 Pago de Inscripción"}
            </Title>

            {yaPagado && (
                <Alert
                    message="¡Matrícula Activada!"
                    description="El pago de inscripción ha sido confirmado y la matrícula está activa."
                    type="success"
                    showIcon
                    style={{ marginBottom: 20 }}
                    action={
                        <Button size="small" onClick={() => router.push(`/estudiantes/show/${estudiante.id}`)}>
                            Ver Perfil
                        </Button>
                    }
                />
            )}

            {!yaPagado && (
                <Alert
                    message="Inscripción Académica Registrada"
                    description="Para activar la matrícula, por favor registra el pago de inscripción."
                    type="warning"
                    showIcon
                    style={{ marginBottom: 20 }}
                />
            )}

            <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                    {/* Recibo/Factura */}
                    <Card
                        title="📄 Recibo de Inscripción"
                        extra={
                            <Button icon={<PrinterOutlined />} onClick={handlePrint}>
                                Imprimir
                            </Button>
                        }
                    >
                        <div ref={printRef}>
                            <div className="header" style={{ textAlign: "center", marginBottom: 30 }}>
                                <Title level={3}>Academia Crystal Diamante</Title>
                                <Text>Recibo de Inscripción</Text>
                                <br />
                                <Text type="secondary">Fecha: {dayjs().format("DD/MM/YYYY")}</Text>
                            </div>

                            <Divider />

                            <Descriptions column={1} bordered size="small">
                                <Descriptions.Item label="Estudiante">
                                    {estudiante.nombre_completo}
                                </Descriptions.Item>
                                <Descriptions.Item label="Identificación">
                                    {estudiante.identificacion}
                                </Descriptions.Item>
                                <Descriptions.Item label="Teléfono">
                                    {estudiante.telefono || "N/A"}
                                </Descriptions.Item>
                                <Descriptions.Item label="Email">
                                    {estudiante.email || "N/A"}
                                </Descriptions.Item>
                            </Descriptions>

                            <Divider />

                            <Descriptions column={1} bordered size="small">
                                <Descriptions.Item label="Programa">
                                    {curso.programas?.nombre}
                                </Descriptions.Item>
                                <Descriptions.Item label="Curso">
                                    {curso.nombre}
                                </Descriptions.Item>
                                <Descriptions.Item label="Fecha Inicio">
                                    {matricula.fecha_inicio ? dayjs(matricula.fecha_inicio).format("DD/MM/YYYY") : "Por definir"}
                                </Descriptions.Item>
                            </Descriptions>

                            <Divider />

                            <div style={{ padding: "20px", background: yaPagado ? "#f6ffed" : "#fff7e6", borderRadius: 8 }}>
                                <Space direction="vertical" style={{ width: "100%" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <Text strong>Inscripción:</Text>
                                        <Text strong style={{ fontSize: 18 }}>
                                            ${montoInscripcion.toLocaleString()}
                                        </Text>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <Text strong>Estado:</Text>
                                        <Text strong className={yaPagado ? "paid" : "pending"} style={{ color: yaPagado ? "green" : "red" }}>
                                            {yaPagado ? "✅ PAGADO" : "⏳ PENDIENTE"}
                                        </Text>
                                    </div>
                                    {yaPagado && pagoInscripcion?.fecha_pago && (
                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <Text>Fecha de pago:</Text>
                                            <Text>{dayjs(pagoInscripcion.fecha_pago).format("DD/MM/YYYY")}</Text>
                                        </div>
                                    )}
                                    {yaPagado && pagoInscripcion?.metodo_pago && (
                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <Text>Método de pago:</Text>
                                            <Text style={{ textTransform: "capitalize" }}>{pagoInscripcion.metodo_pago}</Text>
                                        </div>
                                    )}
                                    {yaPagado && pagoInscripcion?.referencia && (
                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <Text>Referencia:</Text>
                                            <Text>{pagoInscripcion.referencia}</Text>
                                        </div>
                                    )}
                                </Space>
                            </div>

                            <div className="footer" style={{ marginTop: 50, textAlign: "center", fontSize: 12, color: "#666" }}>
                                <p>Academia Crystal Diamante</p>
                                <p>Este documento es un comprobante de inscripción académica</p>
                                {!yaPagado && <p><strong>Matrícula No. {matriculaId}</strong></p>}
                            </div>
                        </div>

                        {!yaPagado && (
                            <div style={{ marginTop: 20 }}>
                                <Button
                                    icon={<WhatsAppOutlined />}
                                    onClick={handleWhatsAppRecordatorio}
                                    block
                                >
                                    Enviar Recordatorio por WhatsApp
                                </Button>
                            </div>
                        )}
                    </Card>
                </Col>

                <Col xs={24} md={12}>
                    {/* Formulario de Pago */}
                    {!yaPagado && (
                        <Card title={<><DollarCircleOutlined /> Registrar Pago de Inscripción</>}>
                            <Form
                                form={form}
                                layout="vertical"
                                onFinish={handleRegistrarPago}
                                initialValues={{
                                    monto: montoInscripcion,
                                    fecha_pago: dayjs()
                                }}
                            >
                                <Form.Item
                                    label="Monto Pagado"
                                    name="monto"
                                    rules={[{ required: true, message: "Ingresa el monto" }]}
                                >
                                    <Input
                                        prefix="$"
                                        type="number"
                                        placeholder="50000"
                                    />
                                </Form.Item>

                                <Form.Item
                                    label="Método de Pago"
                                    name="metodo_pago"
                                    rules={[{ required: true, message: "Selecciona el método" }]}
                                >
                                    <Select>
                                        <Select.Option value="efectivo">Efectivo</Select.Option>
                                        <Select.Option value="transferencia">Transferencia</Select.Option>
                                        <Select.Option value="tarjeta">Tarjeta</Select.Option>
                                        <Select.Option value="otro">Otro</Select.Option>
                                    </Select>
                                </Form.Item>

                                <Form.Item
                                    label="Referencia / Número de Transacción"
                                    name="referencia"
                                >
                                    <Input placeholder="Ej: TRANS123456" />
                                </Form.Item>

                                <Form.Item
                                    label="Fecha de Pago"
                                    name="fecha_pago"
                                    rules={[{ required: true, message: "Selecciona la fecha" }]}
                                >
                                    <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
                                </Form.Item>

                                <Form.Item>
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        block
                                        size="large"
                                        loading={procesandoPago}
                                        icon={<CheckCircleOutlined />}
                                    >
                                        Confirmar Pago y Activar Matrícula
                                    </Button>
                                </Form.Item>
                            </Form>

                            <Alert
                                message="Importante"
                                description="Una vez registrado el pago, la matrícula se activará automáticamente y el estudiante podrá acceder a todas las funcionalidades del curso."
                                type="info"
                                showIcon
                                style={{ marginTop: 20 }}
                            />
                        </Card>
                    )}

                    {yaPagado && (
                        <Card>
                            <Result
                                status="success"
                                title="¡Pago Confirmado!"
                                subTitle="La matrícula está activa y el estudiante puede comenzar el curso."
                                extra={[
                                    <Button key="perfil" type="primary" onClick={() => router.push(`/estudiantes/show/${estudiante.id}`)}>
                                        Ver Perfil del Estudiante
                                    </Button>,
                                    <Button key="lista" onClick={() => router.push("/matriculas")}>
                                        Ver Matrículas
                                    </Button>
                                ]}
                            />
                        </Card>
                    )}
                </Col>
            </Row>
        </div>
    );
}
