"use client";

import { useMemo, useState } from "react";
import { Alert, Button, Card, Form, Input, Typography, message } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";

const { Title, Paragraph, Text } = Typography;

type OnboardingForm = {
  storeName: string;
  tenantSlug: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
  ownerPassword: string;
};

export default function OnboardingPage() {
  const [form] = Form.useForm<OnboardingForm>();
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const router = useRouter();

  const slugPreview = useMemo(() => {
    const current = String(form.getFieldValue("tenantSlug") || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "");

    return current || "tu-tienda";
  }, [form]);

  const onFinish = async (values: OnboardingForm) => {
    setSubmitting(true);
    setApiError(null);

    try {
      const response = await fetch("/api/saas/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const json = await response.json();

      if (!response.ok || !json?.success) {
        throw new Error(json?.error || "No se pudo crear la tienda");
      }

      messageApi.success("Tienda creada. Ahora inicia sesión.");
      router.push(json?.data?.loginUrl || "/login");
    } catch (error: any) {
      const msg = error?.message || "Error inesperado durante onboarding";
      setApiError(msg);
      messageApi.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 16,
        background:
          "radial-gradient(circle at 20% 20%, #ffe7f5 0%, #fff4e9 45%, #f8fbff 100%)",
      }}
    >
      {contextHolder}
      <Card style={{ width: "100%", maxWidth: 560, borderRadius: 16 }}>
        <Title level={3} style={{ marginBottom: 6 }}>
          Crea tu tienda en minutos
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 20 }}>
          Este registro crea tu tienda (tenant), tu usuario dueño y deja lista la configuración
          inicial para empezar a vender.
        </Paragraph>

        {apiError ? (
          <Alert
            type="error"
            message="No se pudo completar el registro"
            description={apiError}
            showIcon
            style={{ marginBottom: 16 }}
          />
        ) : null}

        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item
            label="Nombre de la tienda"
            name="storeName"
            rules={[{ required: true, message: "Ingresa el nombre de la tienda" }]}
          >
            <Input placeholder="Ej. Cosmética Bella" />
          </Form.Item>

          <Form.Item
            label="Slug de tienda"
            name="tenantSlug"
            extra={<Text type="secondary">Se usará como identificador interno del tenant.</Text>}
            rules={[
              { required: true, message: "Ingresa un slug" },
              {
                pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                message: "Usa minúsculas, números y guiones",
              },
            ]}
          >
            <Input placeholder="cosmetica-bella" />
          </Form.Item>

          <Paragraph style={{ marginTop: -6 }}>
            <Text type="secondary">Identificador sugerido:</Text> <Text strong>{slugPreview}</Text>
          </Paragraph>

          <Form.Item
            label="Nombre del propietario"
            name="ownerName"
            rules={[{ required: true, message: "Ingresa el nombre del propietario" }]}
          >
            <Input placeholder="Nombre completo" />
          </Form.Item>

          <Form.Item
            label="Email del administrador"
            name="ownerEmail"
            rules={[
              { required: true, message: "Ingresa un email" },
              { type: "email", message: "Email inválido" },
            ]}
          >
            <Input placeholder="admin@mitienda.com" />
          </Form.Item>

          <Form.Item label="Teléfono" name="ownerPhone">
            <Input placeholder="Opcional" />
          </Form.Item>

          <Form.Item
            label="Contraseña"
            name="ownerPassword"
            rules={[
              { required: true, message: "Ingresa una contraseña" },
              { min: 6, message: "Mínimo 6 caracteres" },
            ]}
          >
            <Input.Password placeholder="******" />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={submitting} block>
            Crear tienda
          </Button>
        </Form>

        <Paragraph style={{ marginTop: 16, marginBottom: 0, textAlign: "center" }}>
          ¿Ya tienes cuenta? <Link href="/login">Iniciar sesión</Link>
        </Paragraph>
      </Card>
    </div>
  );
}
