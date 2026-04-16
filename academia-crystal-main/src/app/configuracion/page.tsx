"use client";

import React, { useEffect, useState } from "react";
import { Form, Input, Button, Card, Row, Col, message, Divider, Spin } from "antd";
import { 
  SaveOutlined, ShopOutlined, InstagramOutlined, 
  GlobalOutlined, PhoneOutlined, SafetyCertificateOutlined 
} from "@ant-design/icons";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ConfiguracionPage() {
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [form] = Form.useForm();

  // 1. Cargar la configuración actual
  useEffect(() => {
    cargarConfiguracion();
  }, []);

  const cargarConfiguracion = async () => {
    setLoading(true);
    try {
        // Traemos el primer registro que encontremos
        const { data, error } = await supabase
            .from("configuracion")
            .select("*")
            .limit(1)
            .single();

        if (data) {
            setConfigId(data.id);
            form.setFieldsValue(data);
        }
    } catch (error) {
        // Si no hay datos, no es un error grave, simplemente el form estará vacío
        console.log("Aún no hay configuración guardada.");
    } finally {
        setLoading(false);
    }
  };

  // 2. Guardar cambios
  const onFinish = async (values: any) => {
    setGuardando(true);
    try {
        let error;
        
        if (configId) {
            // Actualizar existente
            const response = await supabase
                .from("configuracion")
                .update(values)
                .eq("id", configId);
            error = response.error;
        } else {
            // Crear si no existía (raro porque hicimos el insert inicial, pero por seguridad)
            const response = await supabase
                .from("configuracion")
                .insert(values)
                .select()
                .single();
            if (response.data) setConfigId(response.data.id);
            error = response.error;
        }

        if (error) throw error;
        message.success("¡Datos de la academia actualizados!");

    } catch (error: any) {
        message.error("Error al guardar: " + error.message);
    } finally {
        setGuardando(false);
    }
  };

  if (loading) return <div style={{padding: 50, textAlign: 'center'}}><Spin size="large" /></div>;

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
        <Card 
            title={<span><ShopOutlined /> Configuración de la Academia</span>}
            extra={
                <Button type="primary" icon={<SaveOutlined />} onClick={form.submit} loading={guardando}>
                    Guardar Cambios
                </Button>
            }
        >
            <Form form={form} layout="vertical" onFinish={onFinish}>
                
                {/* SECCIÓN 1: DATOS LEGALES */}
                <Divider orientation="left" style={{borderColor: '#722ed1'}}>
                    <SafetyCertificateOutlined /> Información Legal
                </Divider>
                <Row gutter={24}>
                    <Col xs={24} md={12}>
                        <Form.Item label="Nombre de la Academia" name="nombre_academia" rules={[{required: true}]}>
                            <Input size="large" placeholder="Ej: Academia Crystal Diamante" />
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                        <Form.Item label="NIT / Documento Tributario" name="nit">
                            <Input placeholder="Ej: 900.123.456-7" />
                        </Form.Item>
                    </Col>
                </Row>
                <Row gutter={24}>
                    <Col xs={24} md={12}>
                        <Form.Item label="Dirección Física" name="direccion">
                            <Input placeholder="Ej: Calle 5 # 40-12, Cali" />
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                        <Form.Item label="Ciudad / País" name="ciudad">
                            <Input placeholder="Ej: Cali, Colombia" />
                        </Form.Item>
                    </Col>
                </Row>

                {/* SECCIÓN 2: CONTACTO Y REDES */}
                <Divider orientation="left" style={{borderColor: '#722ed1'}}>
                    <PhoneOutlined /> Contacto y Redes
                </Divider>
                <Row gutter={24}>
                    <Col xs={24} md={8}>
                        <Form.Item label="Teléfono / WhatsApp" name="telefono">
                            <Input prefix={<PhoneOutlined />} placeholder="+57 300 123 4567" />
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                        <Form.Item label="Email de Contacto" name="email">
                            <Input placeholder="contacto@crystaldiamante.com" />
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                        <Form.Item label="Sitio Web" name="sitio_web">
                            <Input prefix={<GlobalOutlined />} placeholder="www.tuacademia.com" />
                        </Form.Item>
                    </Col>
                </Row>
                <Row gutter={24}>
                    <Col xs={24} md={12}>
                        <Form.Item label="Instagram / Facebook" name="instagram">
                            <Input prefix={<InstagramOutlined />} placeholder="@crystaldiamante_oficial" />
                        </Form.Item>
                    </Col>
                </Row>

                {/* SECCIÓN 3: IMPRESIÓN Y FACTURACIÓN */}
                <Divider orientation="left" style={{borderColor: '#722ed1'}}>
                    <SaveOutlined /> Pie de Página (Recibos)
                </Divider>
                <Form.Item label="Mensaje en Facturas/Recibos" name="mensaje_factura" help="Este texto saldrá al final de los recibos de pago.">
                    <Input.TextArea rows={2} placeholder="Ej: Gracias por confiar en nosotros. Conserve este recibo." />
                </Form.Item>

            </Form>
        </Card>
    </div>
  );
}