"use client";

import React from "react";
import { Create, useForm } from "@refinedev/antd";
import { useNavigation } from "@refinedev/core";
import { Form, Input, Row, Col, Divider } from "antd";

export default function CreateEstudiante() {
  const { list } = useNavigation();

  const { formProps, saveButtonProps } = useForm({
    resource: "perfiles", // Guardamos en la tabla real de la base de datos
    redirect: false, // Desactivamos la redirección automática para controlarla nosotros
    onMutationSuccess: () => {
      // Al guardar con éxito, volvemos a la lista de Estudiantes
      list("estudiantes");
    },
  });

  return (
    <Create saveButtonProps={saveButtonProps} title="Matricular Nuevo Estudiante">
      <Form {...formProps} layout="vertical">
        
        {/* --- CAMPO OCULTO: ROL AUTOMÁTICO --- */}
        {/* Esto asegura que se cree como estudiante y no como otra cosa */}
        <Form.Item name="rol" initialValue="estudiante" hidden>
            <Input />
        </Form.Item>

        <h3 style={{ color: '#722ed1', marginTop: 0 }}>Datos del Alumno</h3>
        <p style={{ color: '#888', marginBottom: 20 }}>
            Ingresa los datos básicos para crear el expediente.
        </p>

        <Row gutter={24}>
            <Col xs={24} md={12}>
                <Form.Item 
                    label="Nombre Completo" 
                    name="nombre_completo" 
                    rules={[{ required: true, message: "El nombre es obligatorio" }]}
                >
                    <Input placeholder="Ej: Laura Valentina Martínez" />
                </Form.Item>
            </Col>
            
            <Col xs={24} md={12}>
                <Form.Item 
                    label="Número de Identificación / Cédula" 
                    name="identificacion" 
                    rules={[{ required: true, message: "La cédula es obligatoria" }]}
                >
                    <Input placeholder="Ej: 1.122.333.444" />
                </Form.Item>
            </Col>
        </Row>

        <Divider />

        <h3 style={{ color: '#722ed1' }}>Información de Contacto</h3>
        
        <Row gutter={24}>
            <Col xs={24} md={12}>
                <Form.Item 
                    label="Correo Electrónico" 
                    name="email"
                    rules={[
                        { type: 'email', message: 'Ingresa un correo válido' }
                    ]}
                >
                    <Input placeholder="correo@ejemplo.com" />
                </Form.Item>
            </Col>

            <Col xs={24} md={12}>
                <Form.Item 
                    label="Teléfono / WhatsApp" 
                    name="telefono"
                    help="Útil para notificaciones de cursos y cobros"
                >
                    <Input placeholder="Ej: 300 123 4567" />
                </Form.Item>
            </Col>
        </Row>

      </Form>
    </Create>
  );
}