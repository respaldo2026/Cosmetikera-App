"use client";

import React from "react";
import { Card, Table, Button, Space, Tag, Avatar, Spin, Typography } from "antd";
import { PlusOutlined, UserOutlined, MailOutlined, PhoneOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabaseBrowserClient } from "@utils/supabase/client";

const { Title, Text } = Typography;

// EJEMPLO DE USO DE REACT QUERY PARA CACHÉ AUTOMÁTICO
export default function ProfesoresListExample() {
  const router = useRouter();

  // ✨ REACT QUERY: Consulta con caché automático de 5 minutos
  const { 
    data: profesores = [], 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ["profesores", "activos"], // Identificador único del caché
    queryFn: async () => {
      const { data, error } = await supabaseBrowserClient
        .from("perfiles")
        .select(`
          id,
          nombre_completo,
          email,
          telefono,
          identificacion,
          estado,
          created_at
        `)
        .eq("rol", "profesor")
        .order("nombre_completo", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    // Opciones adicionales (opcional):
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false,
  });

  const columns = [
    {
      title: "Profesor",
      dataIndex: "nombre_completo",
      key: "nombre_completo",
      render: (text: string, record: any) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: "#5B21B6" }} />
          <div>
            <div style={{ fontWeight: 500 }}>{text}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.identificacion}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: "Contacto",
      key: "contacto",
      render: (_: any, record: any) => (
        <Space direction="vertical" size={0}>
          <Space size={4}>
            <MailOutlined style={{ color: "#666" }} />
            <Text>{record.email || "Sin email"}</Text>
          </Space>
          {record.telefono && (
            <Space size={4}>
              <PhoneOutlined style={{ color: "#666" }} />
              <Text>{record.telefono}</Text>
            </Space>
          )}
        </Space>
      ),
    },
    {
      title: "Estado",
      dataIndex: "estado",
      key: "estado",
      render: (estado: string) => (
        <Tag color={estado === "activo" ? "success" : "default"}>
          {estado === "activo" ? "Activo" : "Inactivo"}
        </Tag>
      ),
    },
    {
      title: "Acciones",
      key: "acciones",
      render: (_: any, record: any) => (
        <Space>
          <Button 
            size="small" 
            onClick={() => router.push(`/profesores/edit/${record.id}`)}
          >
            Ver/Editar
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Title level={3} style={{ margin: 0 }}>
            Profesores (Ejemplo React Query)
          </Title>
          <Space>
            <Button onClick={() => refetch()}>Recargar</Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => router.push("/profesores/create")}
            >
              Nuevo Profesor
            </Button>
          </Space>
        </div>

        {error && (
          <div style={{ color: "red" }}>
            Error al cargar profesores: {error.message}
          </div>
        )}

        <Table
          dataSource={profesores}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{
            pageSize: 20,
            showTotal: (total) => `Total: ${total} profesores`,
          }}
        />

        <div style={{ background: "#f0f7ff", padding: 16, borderRadius: 8, border: "1px solid #91caff" }}>
          <Text strong style={{ display: "block", marginBottom: 8 }}>
            💡 Características de React Query en esta página:
          </Text>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>✅ Caché automático por 5 minutos</li>
            <li>✅ Si sales y vuelves a esta página, los datos cargan instantáneamente desde caché</li>
            <li>✅ Si otro componente pide los mismos datos, no se hace consulta duplicada</li>
            <li>✅ Estado de loading y error manejado automáticamente</li>
            <li>✅ Botón &quot;Recargar&quot; para forzar actualización si es necesario</li>
          </ul>
        </div>
      </Space>
    </Card>
  );
}
