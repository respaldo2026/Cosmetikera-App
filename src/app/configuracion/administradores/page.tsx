"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, Button, Form, Input, Select, Table, message, Modal, Spin, Tag } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined } from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";

const { Option } = Select;

interface Admin {
  id: string;
  nombre_completo: string;
  email: string;
  rol: string;
  identificacion: string;
  telefono?: string;
  created_at: string;
}

export default function AdministradoresPage() {
  const [form] = Form.useForm();
  const [adminsList, setAdminsList] = useState<Admin[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Usar useCallback para funciones que se pasan como props
  const loadAdmins = useCallback(async () => {
    setListLoading(true);
    try {
      const { data, error } = await supabaseBrowserClient
        .from("perfiles")
        .select("*")
        .in("rol", ["admin", "director"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAdminsList(data || []);
    } catch (error: any) {
      message.error("Error al cargar administradores: " + error.message);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const handleOpenModal = (admin?: Admin) => {
    if (admin) {
      setEditingAdmin(admin);
      form.setFieldsValue(admin);
    } else {
      setEditingAdmin(null);
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setEditingAdmin(null);
    form.resetFields();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (editingAdmin) {
        const { error } = await supabaseBrowserClient
          .from("perfiles")
          .update(values)
          .eq("id", editingAdmin.id);
        if (error) throw error;
        message.success("Administrador actualizado");
      } else {
        // Crear usuario en auth primero
        const { error } = await supabaseBrowserClient.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            data: {
              nombre_completo: values.nombre_completo,
              rol: values.rol,
              identificacion: values.identificacion,
              telefono: values.telefono,
            }
          }
        });
        if (error) throw error;
        message.success("Administrador creado");
      }

      handleCloseModal();
      loadAdmins();
    } catch (error: any) {
      message.error("Error: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (admin: Admin) => {
    Modal.confirm({
      title: "¿Eliminar administrador?",
      content: `¿Eliminar a ${admin.nombre_completo}?`,
      okText: "Eliminar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          const { error } = await supabaseBrowserClient
            .from("perfiles")
            .delete()
            .eq("id", admin.id);
          if (error) throw error;
          message.success("Administrador eliminado");
          loadAdmins();
        } catch (error: any) {
          message.error("Error: " + error.message);
        }
      },
    });
  };

  const columns = [
    {
      title: "Nombre",
      dataIndex: "nombre_completo",
      key: "nombre_completo",
      render: (text: string) => (
        <span><UserOutlined style={{ marginRight: 8 }} />{text}</span>
      ),
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
    },
    {
      title: "Identificación",
      dataIndex: "identificacion",
      key: "identificacion",
    },
    {
      title: "Teléfono",
      dataIndex: "telefono",
      key: "telefono",
      render: (text: string) => text || "-",
    },
    {
      title: "Rol",
      dataIndex: "rol",
      key: "rol",
      render: (rol: string) => (
        <Tag color={rol === "admin" ? "gold" : "purple"}>
          {rol === "admin" ? "Administrador" : "Director"}
        </Tag>
      ),
    },
    {
      title: "Acciones",
      key: "acciones",
      width: 120,
      render: (_: any, record: Admin) => (
        <div style={{ display: "flex", gap: 8 }}>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleOpenModal(record)} />
          <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(record)} />
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={{ marginBottom: 8 }}>Administradores del Sistema</h2>
          <p style={{ color: "#666", marginBottom: 0 }}>
            Gestiona los usuarios con acceso administrativo completo
          </p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
          Nuevo Administrador
        </Button>
      </div>

      <Card>
        <Spin spinning={listLoading}>
          <h3 style={{ marginTop: "24px", marginBottom: "16px" }}>
            Administradores Registrados ({adminsList.length})
          </h3>

          {adminsList.length === 0 && !listLoading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#999" }}>
              No hay administradores registrados
            </div>
          ) : (
            <Table dataSource={adminsList} columns={columns} rowKey="id" pagination={{ pageSize: 10 }} />
          )}
        </Spin>
      </Card>

      <Modal
        title={editingAdmin ? "Editar Administrador" : "Nuevo Administrador"}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={handleCloseModal}
        confirmLoading={submitting}
        okText="Guardar"
        cancelText="Cancelar"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="nombre_completo" label="Nombre Completo" rules={[{ required: true }]}> 
            <Input placeholder="Juan Pérez" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}> 
            <Input placeholder="ejemplo@correo.com" disabled={!!editingAdmin} />
          </Form.Item>
          {!editingAdmin && (
            <Form.Item name="password" label="Contraseña" rules={[{ required: true, min: 6 }]}> 
              <Input.Password placeholder="Mínimo 6 caracteres" />
            </Form.Item>
          )}
          <Form.Item name="identificacion" label="Cédula" rules={[{ required: true }]}> 
            <Input placeholder="123456789" />
          </Form.Item>
          <Form.Item name="telefono" label="Teléfono">
            <Input placeholder="0987654321" />
          </Form.Item>
          <Form.Item name="rol" label="Rol" rules={[{ required: true }]}> 
            <Select placeholder="Selecciona un rol">
              <Option value="admin">Administrador</Option>
              <Option value="director">Director</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
