"use client";

import React, { useState } from "react";
import { Create } from "@refinedev/antd";
import { useNavigation } from "@refinedev/core";
import { Form, Input, DatePicker, Row, Col, Divider, message, Alert } from "antd";
import { 
    UserOutlined, PhoneOutlined, MailOutlined, HomeOutlined, 
    IdcardOutlined, FileTextOutlined
} from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";

export default function ProfesorCreate() {
    const { list } = useNavigation(); // Para redirigir manualmente
    const [form] = Form.useForm();    // Controlamos el formulario nosotros mismos
    const [loading, setLoading] = useState(false);

    const handleGuardarManual = async (values: any) => {
        setLoading(true);
        try {
            // 1. Preparar datos para la tabla 'perfiles'
            const datosParaEnviar = {
                nombre_completo: values.nombre_completo,
                identificacion: values.identificacion,
                email: values.email,
                telefono: values.telefono,
                
                // Campos nuevos (nos aseguramos que no sean undefined)
                rol: 'profesor',
                direccion: values.direccion || null,
                telefono_2: values.telefono_2 || null,
                observaciones: values.observaciones || null,
                fecha_nacimiento: values.fecha_nacimiento ? values.fecha_nacimiento.format("YYYY-MM-DD") : null,
            };

            // 2. Insertar directamente en Supabase (Tabla PERFILES)
            const { error } = await supabaseBrowserClient
                .from("perfiles")
                .insert(datosParaEnviar);

            if (error) throw error;

            // 3. Éxito: Avisar y Redirigir
            message.success("¡Profesor creado correctamente!");
            list("profesores"); // Nos devuelve a la lista

        } catch (error: any) {
            console.error("Error creando:", error);
            message.error("Error: " + (error.message || "No se pudo guardar"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Create 
            title="Registrar Nuevo Profesor"
            isLoading={loading}
            saveButtonProps={{
                // Desactivamos el guardado automático y ponemos el nuestro
                onClick: () => form.submit(),
                disabled: loading
            }} 
        >
            <Form 
                form={form}
                layout="vertical" 
                onFinish={handleGuardarManual}
            >
                
                {/* --- SECCIÓN 1: DATOS PERSONALES --- */}
                <Divider orientation="left" style={{ borderColor: '#722ed1', color: '#722ed1' }}>
                    <UserOutlined /> Información Personal
                </Divider>
                
                <Row gutter={24}>
                    <Col span={12}>
                        <Form.Item
                            label="Nombre Completo"
                            name="nombre_completo"
                            rules={[{ required: true, message: "Nombre obligatorio" }]}
                        >
                            <Input prefix={<UserOutlined style={{color:'rgba(0,0,0,.25)'}}/>} placeholder="Ej: Maria Perez" />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item
                            label="Identificación / Cédula"
                            name="identificacion"
                            rules={[{ required: true, message: "Requerido" }]}
                        >
                            <Input prefix={<IdcardOutlined style={{color:'rgba(0,0,0,.25)'}}/>} placeholder="Cédula" />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item label="Cumpleaños" name="fecha_nacimiento">
                            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" placeholder="Seleccionar" />
                        </Form.Item>
                    </Col>
                </Row>

                {/* --- SECCIÓN 2: CONTACTO --- */}
                <Divider orientation="left" style={{ borderColor: '#722ed1', color: '#722ed1' }}>
                    <PhoneOutlined /> Contacto
                </Divider>

                <Row gutter={24}>
                    <Col span={8}>
                        <Form.Item
                            label="Correo Electrónico"
                            name="email"
                        >
                            <Input prefix={<MailOutlined style={{color:'rgba(0,0,0,.25)'}}/>} placeholder="correo@ejemplo.com" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item
                            label="Teléfono Principal"
                            name="telefono"
                            rules={[{ required: true, message: "Teléfono requerido" }]}
                        >
                            <Input prefix={<PhoneOutlined style={{color:'rgba(0,0,0,.25)'}}/>} placeholder="Celular / WhatsApp" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item label="Teléfono 2 (Opcional)" name="telefono_2">
                            <Input prefix={<PhoneOutlined style={{color:'rgba(0,0,0,.25)'}}/>} placeholder="Emergencia" />
                        </Form.Item>
                    </Col>
                </Row>

                <Row>
                    <Col span={24}>
                        <Form.Item label="Dirección de Residencia" name="direccion">
                            <Input prefix={<HomeOutlined style={{color:'rgba(0,0,0,.25)'}}/>} placeholder="Dirección completa" />
                        </Form.Item>
                    </Col>
                </Row>

                {/* --- SECCIÓN 3: DETALLES --- */}
                <Divider orientation="left" style={{ borderColor: '#722ed1', color: '#722ed1' }}>
                    <FileTextOutlined /> Notas Internas
                </Divider>

                <Row gutter={24}>
                    <Col span={24}>
                        <Form.Item label="Observaciones" name="observaciones">
                            <Input.TextArea rows={2} placeholder="Especialidades, horarios, notas..." />
                        </Form.Item>
                    </Col>
                </Row>

            </Form>
        </Create>
    );
}