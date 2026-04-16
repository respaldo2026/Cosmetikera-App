"use client";

import React, { useState } from "react";
import { logger } from "@utils/logger";
import { Create } from "@refinedev/antd";
import { useNavigation } from "@refinedev/core";
import { Form, Input, DatePicker, Row, Col, Divider, App, Alert } from "antd";
import { 
    UserOutlined, PhoneOutlined, MailOutlined, HomeOutlined, 
    IdcardOutlined, FileTextOutlined
} from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";

const PORTAL_PROFESOR_URL =
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://app.crystaldiamante.com";

export default function ProfesorCreate() {
    const { list } = useNavigation(); // Para redirigir manualmente
    const { message } = App.useApp(); // Usar hook para mensajes
    const [form] = Form.useForm();    // Controlamos el formulario nosotros mismos
    const [loading, setLoading] = useState(false);

    const handleGuardarManual = async (values: any) => {
        setLoading(true);
        try {
            // Validar que tenga email para poder crear el usuario
            if (!values.email || !values.email.includes('@')) {
                throw new Error("El correo electrónico es obligatorio y debe ser válido para crear el acceso");
            }

            // 1. Generar contraseña temporal (identificación o nombre)
            const passwordTemporal = values.identificacion || 'profesor123';

            // 2. Llamar al API route seguro para crear usuario
            const response = await fetch('/api/create-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: values.email,
                    password: passwordTemporal,
                    rol: 'profesor',
                    user_metadata: {
                        nombre_completo: values.nombre_completo,
                        identificacion: values.identificacion,
                        telefono: values.telefono,
                        direccion: values.direccion || null,
                        telefono_2: values.telefono_2 || null,
                        observaciones: values.observaciones || null,
                        fecha_nacimiento: values.fecha_nacimiento ? values.fecha_nacimiento.format("YYYY-MM-DD") : null,
                    }
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Error al crear el usuario");
            }

            let whatsappInfo = "";
            if (values.telefono) {
                try {
                    const { enviarBienvenidaPortalProfesor } = await import("@/services/whatsapp-messages-module");
                    const resultadoWhatsapp = await enviarBienvenidaPortalProfesor(result.user?.id || "", {
                        nombre: values.nombre_completo,
                        telefono: values.telefono,
                        enlacePortal: PORTAL_PROFESOR_URL,
                        usuario: values.email,
                    });

                    whatsappInfo = resultadoWhatsapp.exito
                        ? "WhatsApp de bienvenida enviado."
                        : "Profesor creado, pero falló el envío de WhatsApp.";

                    if (!resultadoWhatsapp.exito) {
                        logger.error("Error enviando WhatsApp de bienvenida a profesor:", resultadoWhatsapp.error);
                    }
                } catch (whatsappError) {
                    logger.error("Error enviando WhatsApp de bienvenida a profesor:", whatsappError);
                    whatsappInfo = "Profesor creado, pero falló el envío de WhatsApp.";
                }
            } else {
                whatsappInfo = "Profesor creado sin envío de WhatsApp (sin teléfono).";
            }

            // 3. Éxito
            message.success({
                content: (
                    <div>
                        <div>¡Profesor creado correctamente!</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                            Email: <strong>{values.email}</strong><br/>
                            Contraseña temporal: <strong>{passwordTemporal}</strong>
                        </div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>{whatsappInfo}</div>
                    </div>
                ),
                duration: 8
            });
            
            list("profesores");

        } catch (error: any) {
            logger.error("Error creando profesor:", error);
            message.error(error.message || "Error al crear el profesor");
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

                <Alert 
                    message="Acceso al Sistema" 
                    description="El correo electrónico es obligatorio para crear las credenciales de acceso. Se usará la identificación como contraseña temporal."
                    type="info" 
                    showIcon 
                    style={{ marginBottom: 16 }}
                />

                <Row gutter={24}>
                    <Col span={8}>
                        <Form.Item
                            label="Correo Electrónico"
                            name="email"
                            rules={[
                                { required: true, message: "Correo obligatorio" },
                                { type: 'email', message: "Ingresa un correo válido" }
                            ]}
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