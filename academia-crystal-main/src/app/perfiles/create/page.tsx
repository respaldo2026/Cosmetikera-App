"use client";

import React from "react";
import { Create, useForm } from "@refinedev/antd";
import { Form, Input, Select, Divider } from "antd";

export default function CreatePerfil() {
  const { formProps, saveButtonProps } = useForm();

  return (
    <Create saveButtonProps={saveButtonProps} title="Registrar Persona">
      <Form {...formProps} layout="vertical">
        
        <h3 style={{ marginTop: 0, color: '#722ed1' }}>Datos Personales</h3>
        
        <div style={{ display: 'flex', gap: '20px' }}>
            {/* CAMPO NUEVO: IDENTIFICACIÓN */}
            <Form.Item
              label="Número de Identificación / Cédula"
              name="identificacion"
              style={{ flex: 1 }}
              rules={[{ required: true, message: "Escribe la cédula o ID" }]}
            >
              <Input placeholder="Ej: 1.112.333.444" />
            </Form.Item>

            <Form.Item
              label="Nombre Completo"
              name="nombre_completo"
              style={{ flex: 2 }}
              rules={[{ required: true, message: "Escribe el nombre" }]}
            >
              <Input placeholder="Ej: Ana María Pérez" />
            </Form.Item>
        </div>

        <Form.Item
          label="Rol en la Academia"
          name="rol"
          initialValue="estudiante"
          rules={[{ required: true }]}
          help="Selecciona 'Profesor' para que pueda dictar cursos."
        >
          <Select
            options={[
              { value: "estudiante", label: "🎓 Estudiante (Cliente)" },
              { value: "profesor", label: "👩‍🏫 Profesor (Docente)" },
              { value: "admin", label: "👑 Administrador (Dueño)" },
            ]}
          />
        </Form.Item>

        <Divider />
        <h3 style={{ color: '#722ed1' }}>Contacto</h3>

        <Form.Item
          label="Correo Electrónico"
          name="email"
          rules={[
            { required: true, message: "Escribe el correo" },
            { type: "email", message: "Correo no válido" }
          ]}
        >
          <Input placeholder="cliente@correo.com" />
        </Form.Item>

        <Form.Item
          label="Teléfono / WhatsApp"
          name="telefono"
        >
          <Input placeholder="Ej: 300 123 4567" />
        </Form.Item>

      </Form>
    </Create>
  );
}