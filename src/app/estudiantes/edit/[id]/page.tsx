"use client";

import React from "react";
import { Edit, useForm } from "@refinedev/antd";
import { Form, Input, Row, Col, Divider, Alert, DatePicker, Select } from "antd";
import dayjs from "dayjs";
import { useParams } from "next/navigation";

export default function EditEstudiante() {
  const params = useParams();
  const id = params?.id as string;

  console.log("🟣 [COMPONENTE] EditEstudiante montado");
  console.log("🟣 [COMPONENTE] ID desde params:", id);

  const { formProps, saveButtonProps, formLoading, onFinish } = useForm({
    resource: "perfiles", // Guardamos en la tabla perfiles
    action: "edit",
    id,
    redirect: "list",     // Al terminar, volvemos a la lista
    // Pedirle a Supabase que retorne los datos actualizados
    meta: { 
      select: "*",
      returning: true 
    } 
  });

  console.log("🟣 [COMPONENTE] useForm retornó:");
  console.log("  - formProps:", formProps ? "OK" : "NULL");
  console.log("  - saveButtonProps:", saveButtonProps);
  console.log("  - formLoading:", formLoading);
  console.log("  - onFinish:", typeof onFinish);

  const handleOnFinish = async (values: any) => {
    console.log("═══════════════════════════════════════════════");
    console.log("🔵 [FORM] onFinish EJECUTADO");
    console.log("═══════════════════════════════════════════════");
    console.log("📌 ID del estudiante:", id);
    console.log("📌 Valores del formulario (completos):", values);
    console.log("📌 Tipo de valores:", typeof values);
    console.log("📌 Keys de valores:", Object.keys(values));
    
    // Verificar que hay datos
    if (!values || Object.keys(values).length === 0) {
      console.error("❌ [FORM] ERROR: Formulario vacío!");
      return;
    }
    
    const datosListos = {
      ...values,
      fecha_nacimiento: values.fecha_nacimiento ? dayjs(values.fecha_nacimiento).format("YYYY-MM-DD") : null,
    };
    delete datosListos.created_at;
    delete datosListos.updated_at;
    delete datosListos.id;
    
    console.log("🟢 [FORM] Datos limpios para enviar:", datosListos);
    console.log("🟢 [FORM] Cantidad de campos:", Object.keys(datosListos).length);
    
    try {
      console.log("🟡 [FORM] Llamando a onFinish()...");
      const result = await onFinish(datosListos);
      console.log("✅ [FORM] onFinish retornó:", result);
      console.log("✅ [FORM] result?.data:", result?.data);
      
      // Aunque Supabase no devuelva datos, el UPDATE probablemente se guardó
      // Refine redirigirá a la lista de todas formas porque onFinish se completó
      console.log("✅ [FORM] UPDATE completado - Redirigiendo a lista...");
      console.log("═══════════════════════════════════════════════");
      return result;
    } catch (error) {
      console.error("❌ [FORM] ERROR en onFinish:", error);
      console.error("❌ [FORM] Error message:", (error as any)?.message);
      console.error("═══════════════════════════════════════════════");
      throw error;
    }
  };

  return (
    <Edit saveButtonProps={saveButtonProps} isLoading={formLoading} title="Editar Estudiante">
    <Form {...formProps} form={formProps.form} layout="vertical" onFinish={handleOnFinish}>
        
        {/* ROL OCULTO (Seguridad) */}
        <Form.Item name="rol" hidden><Input /></Form.Item>

        <Alert message="Edita los datos personales y académicos del alumno aquí." type="info" showIcon style={{marginBottom: 20}} />

        <h3 style={{ color: '#722ed1' }}>Datos Personales</h3>

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

        <Row gutter={24}>
            <Col xs={24} md={12}>
                <Form.Item 
                    label="Fecha de Nacimiento" 
                    name="fecha_nacimiento"
                    getValueProps={(value) => ({
                        value: value ? dayjs(value) : undefined,
                    })}
                >
                    <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                </Form.Item>
            </Col>
            <Col xs={24} md={12}>
                <Form.Item label="Género" name="genero">
                    <Select placeholder="Selecciona género">
                        <Select.Option value="Masculino">Masculino</Select.Option>
                        <Select.Option value="Femenino">Femenino</Select.Option>
                        <Select.Option value="Otro">Otro</Select.Option>
                    </Select>
                </Form.Item>
            </Col>
        </Row>

        <Row gutter={24}>
            <Col xs={24} md={12}>
                <Form.Item label="Talla de camiseta" name="talla_camiseta" help="Para uniformes o dotación">
                    <Select placeholder="Selecciona talla">
                        <Select.Option value="XS">XS</Select.Option>
                        <Select.Option value="S">S</Select.Option>
                        <Select.Option value="M">M</Select.Option>
                        <Select.Option value="L">L</Select.Option>
                        <Select.Option value="XL">XL</Select.Option>
                        <Select.Option value="XXL">XXL</Select.Option>
                    </Select>
                </Form.Item>
            </Col>
        </Row>

        <Divider orientation="left" style={{color: '#722ed1'}}>Información de Contacto</Divider>

        <Row gutter={24}>
            <Col xs={24} md={12}>
                <Form.Item label="Email" name="email" rules={[{ type: 'email' }]}>
                    <Input />
                </Form.Item>
            </Col>
            <Col xs={24} md={12}>
                <Form.Item label="Teléfono / WhatsApp" name="telefono" rules={[{ required: true }]}>
                    <Input />
                </Form.Item>
            </Col>
        </Row>

        <Form.Item label="Dirección de Residencia" name="direccion">
            <Input.TextArea rows={2} />
        </Form.Item>

        <Divider orientation="left" style={{color: '#722ed1'}}>Datos del Acudiente</Divider>

        <Row gutter={24}>
            <Col xs={24} md={12}>
                <Form.Item label="Nombre del Acudiente" name="acudiente_nombre">
                    <Input placeholder="Contacto de emergencia" />
                </Form.Item>
            </Col>
            <Col xs={24} md={12}>
                <Form.Item label="Teléfono del Acudiente" name="acudiente_telefono">
                    <Input />
                </Form.Item>
            </Col>
        </Row>

        <Form.Item label="Observaciones / Notas Especiales" name="observaciones">
            <Input.TextArea rows={3} placeholder="Alergias, condiciones, preferencias..." />
        </Form.Item>

      </Form>
    </Edit>
  );
}