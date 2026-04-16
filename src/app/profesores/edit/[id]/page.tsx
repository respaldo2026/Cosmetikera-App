"use client";

import React, { useEffect } from "react";
import { Edit, useForm } from "@refinedev/antd";
import { Form, Input, DatePicker, Row, Col, Divider, message, InputNumber, Spin } from "antd";
import dayjs from "dayjs";
import { useParams } from "next/navigation";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { 
    UserOutlined, PhoneOutlined, MailOutlined, HomeOutlined, 
    IdcardOutlined, FileTextOutlined
} from "@ant-design/icons";
import { logger } from "@utils/logger";

export default function ProfesorEdit() {
    const params = useParams();
    const id = params?.id as string;

    const { formProps, saveButtonProps, onFinish, formLoading } = useForm({
        resource: "perfiles",
        action: "edit",
        id: id,
        redirect: "list",
        onMutationError: (error: any) => {
            logger.error("Error al guardar:", error);
            message.error(error?.message || "No se pudo guardar los cambios");
        }
    });

    useEffect(() => {
        if (!id) return;
        const cargarInfoProfesor = async () => {
            const { data, error } = await supabaseBrowserClient
                .from("profesores_info")
                .select("valor_hora, tipo_contrato, especialidad")
                .eq("perfil_id", id)
                .maybeSingle();

            if (!error && data) {
                formProps.form?.setFieldsValue({
                    valor_hora: data.valor_hora ?? undefined,
                    tipo_contrato: data.tipo_contrato ?? undefined,
                    especialidad: data.especialidad ?? undefined,
                });
            }
        };

        cargarInfoProfesor();
    }, [id, formProps.form]);

    const handleOnFinish = async (values: any) => {
        try {
            const datosListos = {
                ...values,
                fecha_nacimiento: values.fecha_nacimiento ? dayjs(values.fecha_nacimiento).format("YYYY-MM-DD") : null,
            };
            // Remover campos que no deben actualizarse
            delete datosListos.created_at;
            delete datosListos.updated_at;
            const { tipo_contrato, especialidad } = datosListos;
            const valorHora = datosListos.valor_hora;

            if (id && (typeof valorHora !== "undefined" || typeof tipo_contrato !== "undefined" || typeof especialidad !== "undefined")) {
                const { error: infoError } = await supabaseBrowserClient
                    .from("profesores_info")
                    .upsert(
                        {
                            perfil_id: id,
                            valor_hora: typeof valorHora !== "undefined" ? valorHora : null,
                            tipo_contrato: typeof tipo_contrato !== "undefined" ? (tipo_contrato || null) : null,
                            especialidad: typeof especialidad !== "undefined" ? (especialidad || null) : null,
                        },
                        { onConflict: "perfil_id" },
                    );
                if (infoError) {
                    throw infoError;
                }
            }
            const perfilData = { ...datosListos };
            delete perfilData.tipo_contrato;
            delete perfilData.especialidad;
            await onFinish(perfilData);
        } catch (err) {
            message.error("Error procesando el formulario");
        }
    };

    return (
        <Edit saveButtonProps={saveButtonProps} title="Editar Profesor" isLoading={formLoading}>
            
            {/* Mensaje de error amigable si falla la carga */}
            {formLoading && (
                <div style={{ textAlign: 'center', padding: '50px 0' }}>
                    <Spin size="large" />
                </div>
            )}

            {!formLoading && (
            <Form 
                {...formProps} 
                layout="vertical" 
                onFinish={handleOnFinish}
            >
                <Divider orientation="left" style={{ borderColor: '#722ed1', color: '#722ed1' }}><UserOutlined /> Información Personal</Divider>
                <Row gutter={24}>
                    <Col span={12}>
                        <Form.Item label="Nombre Completo" name="nombre_completo" rules={[{ required: true }]}>
                            <Input prefix={<UserOutlined style={{color:'rgba(0,0,0,.25)'}}/>} />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item label="Identificación" name="identificacion">
                            <Input prefix={<IdcardOutlined style={{color:'rgba(0,0,0,.25)'}}/>} />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item 
                            label="Cumpleaños" 
                            name="fecha_nacimiento"
                            getValueProps={(value) => ({ value: value ? dayjs(value) : "" })}
                        >
                            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
                        </Form.Item>
                    </Col>
                </Row>

                <Divider orientation="left" style={{ borderColor: '#722ed1', color: '#722ed1' }}><PhoneOutlined /> Contacto</Divider>
                <Row gutter={24}>
                    <Col span={8}>
                        <Form.Item label="Email" name="email">
                            <Input prefix={<MailOutlined style={{color:'rgba(0,0,0,.25)'}}/>} />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item label="Teléfono 1" name="telefono" rules={[{ required: true }]}>
                            <Input prefix={<PhoneOutlined style={{color:'rgba(0,0,0,.25)'}}/>} />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item label="Teléfono 2 (Opcional)" name="telefono_2">
                            <Input prefix={<PhoneOutlined style={{color:'rgba(0,0,0,.25)'}}/>} />
                        </Form.Item>
                    </Col>
                </Row>
                <Row>
                    <Col span={24}>
                        <Form.Item label="Dirección" name="direccion">
                            <Input prefix={<HomeOutlined style={{color:'rgba(0,0,0,.25)'}}/>} />
                        </Form.Item>
                    </Col>
                </Row>

                <Divider orientation="left" style={{ borderColor: '#722ed1', color: '#722ed1' }}>💸 Valor por Hora</Divider>
                <Row gutter={24}>
                    <Col span={12}>
                        <Form.Item
                            label="Valor por Hora Dictada"
                            name="valor_hora"
                            tooltip="Este valor se usa para calcular la nómina (horas dictadas x valor hora)."
                        >
                            <InputNumber
                                min={0}
                                style={{ width: '100%' }}
                                formatter={(value: any) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                parser={((value: string | undefined): number => {
                                    const parsed = value?.replace(/\$\s?|(,*)/g, '');
                                    return parsed ? parseInt(parsed, 10) : 0;
                                }) as any}
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <Divider orientation="left" style={{ borderColor: '#722ed1', color: '#722ed1' }}>📄 Datos de Contrato</Divider>
                <Row gutter={24}>
                    <Col span={12}>
                        <Form.Item label="Tipo de Contrato" name="tipo_contrato">
                            <Input placeholder="Ej: Por horas, Prestación de servicios" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="Especialidad" name="especialidad">
                            <Input placeholder="Ej: Uñas, Barbería, Maquillaje" />
                        </Form.Item>
                    </Col>
                </Row>

                <Divider orientation="left" style={{ borderColor: '#722ed1', color: '#722ed1' }}><FileTextOutlined /> Notas</Divider>
                <Row gutter={24}>
                    <Col span={24}>
                        <Form.Item label="Observaciones" name="observaciones">
                            <Input.TextArea rows={3} />
                        </Form.Item>
                    </Col>
                </Row>
            </Form>
            )}
        </Edit>
    );
}