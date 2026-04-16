"use client";

import React from "react";
import { Edit, useForm } from "@refinedev/antd";
import { Form, Input, Select, DatePicker, Row, Col, Divider, message, Alert } from "antd";
import dayjs from "dayjs";
import { 
    UserOutlined, PhoneOutlined, MailOutlined, HomeOutlined, 
    IdcardOutlined, FileTextOutlined
} from "@ant-design/icons";

export default function ProfesorEdit() {
    const { formProps, saveButtonProps, onFinish, mutationResult } = useForm({
        redirect: "list",
        // ESTO EVITA LA PANTALLA BLANCA: Capturamos el error y lo mostramos como alerta
        onMutationError: (error: any) => {
            console.error("Error al guardar:", error);
            message.error(error?.message || "No se pudo guardar los cambios");
        }
    });

    const handleOnFinish = (values: any) => {
        try {
            // Limpiamos los datos antes de enviar
            const datosListos = {
                ...values,
                // Si la fecha existe, la convertimos a texto. Si no, enviamos null.
                fecha_nacimiento: values.fecha_nacimiento ? dayjs(values.fecha_nacimiento).format("YYYY-MM-DD") : null,
            };
            onFinish(datosListos);
        } catch (err) {
            message.error("Error procesando el formulario");
        }
    };

    // Si hay un error visible, lo mostramos arriba
    const isError = mutationResult?.isError;
    const errorMessage = mutationResult?.error?.message;

    return (
        <Edit saveButtonProps={saveButtonProps} title="Editar Profesor">
            
            {/* Mensaje de error amigable si falla el guardado */}
            {isError && (
                <Alert 
                    type="error" 
                    message="Error al Guardar" 
                    description={errorMessage || "Verifica que las columnas (direccion, telefono_2...) existan en Supabase."} 
                    showIcon 
                    style={{ marginBottom: 20 }} 
                />
            )}

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

                <Divider orientation="left" style={{ borderColor: '#722ed1', color: '#722ed1' }}><FileTextOutlined /> Notas</Divider>
                <Row gutter={24}>
                    <Col span={24}>
                        <Form.Item label="Observaciones" name="observaciones">
                            <Input.TextArea rows={3} />
                        </Form.Item>
                    </Col>
                </Row>
            </Form>
        </Edit>
    );
}