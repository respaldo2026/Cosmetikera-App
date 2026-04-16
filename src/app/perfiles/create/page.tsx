"use client";

import React, { useState } from "react";
import { Create } from "@refinedev/antd";
import { useNavigation } from "@refinedev/core";
import { Form, Input, Select, Divider, App } from "antd";

export default function CreatePerfil() {
  const { list } = useNavigation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleGuardarManual = async (values: any) => {
    setLoading(true);
    try {
      if (!values.email || !values.email.includes('@')) {
        throw new Error("El correo electrónico es obligatorio");
      }

      const passwordTemporal = values.identificacion.replace(/\./g, '') || 'usuario123';

      const response = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: values.email,
          password: passwordTemporal,
          rol: values.rol,
          user_metadata: {
            nombre_completo: values.nombre_completo,
            identificacion: values.identificacion,
            telefono: values.telefono,
            rol: values.rol,
          }
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al crear el usuario");
      }

      message.success(`✅ Usuario creado. Login: ${values.email} / ${passwordTemporal}`);
      list("perfiles");

    } catch (error: any) {
      console.error("Error:", error);
      message.error(error.message || "Error al crear");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Create title="Registrar Persona" isLoading={loading} saveButtonProps={{ onClick: () => form.submit(), disabled: loading }}>
      <div style={{ padding: '12px', background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: '4px', marginBottom: '16px' }}>
        <strong>🔑 Sistema de Login:</strong> El <strong>usuario es el correo</strong> y la <strong>contraseña es la cédula</strong>.
        <br />
        <small>Ejemplo: Usuario: <code>usuario@correo.com</code> / Contraseña: <code>1234567890</code></small>
      </div>
      
      <Form form={form} layout="vertical" onFinish={handleGuardarManual}>
        
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