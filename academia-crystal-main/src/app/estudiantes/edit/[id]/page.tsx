"use client";

import React from "react";
import { Edit, useForm } from "@refinedev/antd";
import { Form, Input, Row, Col, Divider, Alert } from "antd";

export default function EditEstudiante() {
  const { formProps, saveButtonProps, queryResult } = useForm({
    resource: "perfiles", // Guardamos en la tabla perfiles
    redirect: "list",     // Al terminar, volvemos a la lista
    // Si falla la carga automática, esto ayuda a depurar:
    meta: { select: "*" } 
  });

  const estudiante = queryResult?.data?.data;

  return (
    <Edit saveButtonProps={saveButtonProps} title={`Editar: ${estudiante?.nombre_completo || "Estudiante"}`}>
      <Form {...formProps} layout="vertical">
        
        {/* ROL OCULTO (Seguridad) */}
        <Form.Item name="rol" hidden><Input /></Form.Item>

        <Alert message="Edita los datos personales del alumno aquí." type="info" showIcon style={{marginBottom: 20}} />

        <Row gutter={24}>
            <Col xs={24} md={12}>
                <Form.Item label="Nombre Completo" name="nombre_completo" rules={[{ required: true }]}>
                    <Input />
                </Form.Item>
            </Col>
            <Col xs={24} md={12}>
                <Form.Item label="Identificación / Cédula" name="identificacion" rules={[{ required: true }]}>
                    <Input />
                </Form.Item>
            </Col>
        </Row>

        <Divider orientation="left" style={{color: '#722ed1'}}>Contacto</Divider>

        <Row gutter={24}>
            <Col xs={24} md={12}>
                <Form.Item label="Email" name="email">
                    <Input />
                </Form.Item>
            </Col>
            <Col xs={24} md={12}>
                <Form.Item label="Teléfono / WhatsApp" name="telefono">
                    <Input />
                </Form.Item>
            </Col>
        </Row>
      </Form>
    </Edit>
  );
}