"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, Form, Input, Space, Typography } from "antd";
import { MailOutlined } from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";

const { Title, Text } = Typography;

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFinish = async (values: { email: string }) => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const redirectTo = `${window.location.origin}/login`;
      const { error: resetError } = await supabaseBrowserClient.auth.resetPasswordForEmail(values.email, {
        redirectTo,
      });

      if (resetError) {
        setError(resetError.message || "No se pudo enviar el correo de recuperación.");
        return;
      }

      setMessage("Si el correo existe, te enviamos un enlace para restablecer tu contraseña.");
    } catch {
      setError("Ocurrió un error al procesar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(135deg, #ffe2f1 0%, #fff8fc 55%, #f7f9ff 100%)",
        padding: 16,
      }}
    >
      <Card style={{ width: "100%", maxWidth: 440, borderRadius: 12 }}>
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <div>
            <Title level={4} style={{ marginBottom: 4 }}>
              Recuperar contraseña
            </Title>
            <Text type="secondary">
              Ingresa tu correo y te enviaremos un enlace para recuperar el acceso.
            </Text>
          </div>

          {message ? <Alert type="success" showIcon message={message} /> : null}
          {error ? <Alert type="error" showIcon message={error} /> : null}

          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item
              name="email"
              label="Correo"
              rules={[
                { required: true, message: "Ingresa tu correo" },
                { type: "email", message: "Correo no válido" },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="admin@gmail.com" />
            </Form.Item>

            <Button type="primary" htmlType="submit" loading={loading} block>
              Enviar enlace
            </Button>
          </Form>

          <Link href="/login">Volver al inicio de sesión</Link>
        </Space>
      </Card>
    </div>
  );
}
