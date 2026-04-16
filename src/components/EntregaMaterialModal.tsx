import React, { useState, useEffect, useCallback } from "react";
import { Modal, Form, Input, Select, DatePicker, message, Radio, Table, Tag } from "antd";
import { GiftOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { supabaseBrowserClient } from "@utils/supabase/client";



interface EntregaMaterialModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  estudianteId: string;
  estudianteNombre: string;
  profesorId: string;
}

interface EntregaMaterial {
  id: string;
  fecha_entrega: string;
  tipo_material: string;
  descripcion: string;
  perfiles?: { nombre_completo?: string };
}


export const EntregaMaterialModal: React.FC<EntregaMaterialModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  estudianteId,
  estudianteNombre,
  profesorId
}) => {

// Definir la interface fuera del componente
interface EntregaMaterial {
  id: string;
  fecha_entrega: string;
  tipo_material: string;
  descripcion: string;
  perfiles?: { nombre_completo?: string };
}
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [tipoMaterial, setTipoMaterial] = useState("camiseta");

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const { error } = await supabaseBrowserClient
        .from("entregas_materiales")
        .insert({
          estudiante_id: estudianteId,
          tipo_material: values.tipo_material,
          talla: values.tipo_material === "camiseta" ? values.talla : null,
          mes_ciclo: values.tipo_material === "kit" ? values.mes_ciclo : null,
          descripcion: values.descripcion,
          fecha_entrega: values.fecha_entrega.format("YYYY-MM-DD"),
          entregado_por: profesorId,
          observaciones: values.observaciones,
        });

      if (error) {
        message.error("Error al registrar entrega: " + (error.message || "Error desconocido"));
        throw error;
      }

      message.success("Entrega registrada correctamente");
      form.resetFields();
      onSuccess();
      onCancel();
    } catch (error: any) {
      message.error("Error al registrar entrega: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={<span><GiftOutlined /> Entregar Material a {estudianteNombre}</span>}
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      okText="Registrar Entrega"
    >
      <Form form={form} layout="vertical" initialValues={{ tipo_material: "camiseta", fecha_entrega: dayjs() }}>
        <Form.Item name="tipo_material" label="Tipo de Material">
          <Radio.Group onChange={(e) => setTipoMaterial(e.target.value)}>
            <Radio.Button value="camiseta">Camiseta</Radio.Button>
            <Radio.Button value="kit">Kit de Materiales</Radio.Button>
          </Radio.Group>
        </Form.Item>

        {tipoMaterial === "camiseta" && (
          <Form.Item name="talla" label="Talla" rules={[{ required: true, message: "Selecciona la talla" }]}>
            <Select options={["XS", "S", "M", "L", "XL", "XXL"].map(t => ({ label: t, value: t }))} />
          </Form.Item>
        )}

        {tipoMaterial === "kit" && (
          <Form.Item name="mes_ciclo" label="Mes o Ciclo" rules={[{ required: true, message: "Indica el mes o ciclo" }]}>
            <Input placeholder="Ej: Enero, Ciclo 1, Básico" />
          </Form.Item>
        )}

        <Form.Item name="descripcion" label="Descripción" rules={[{ required: true }]}>
          <Input placeholder="Ej: Camiseta blanca logo nuevo" />
        </Form.Item>

        <Form.Item name="fecha_entrega" label="Fecha de Entrega" rules={[{ required: true }]}>
          <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
        </Form.Item>

        <Form.Item name="observaciones" label="Observaciones (Opcional)">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export const HistorialEntregas: React.FC<{ estudianteId: string }> = ({ estudianteId }) => {
  const [entregas, setEntregas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const cargarEntregas = useCallback(async () => {
    setLoading(true);
    const { data } = await supabaseBrowserClient
      .from("entregas_materiales")
      .select("*, perfiles:entregado_por(nombre_completo)")
      .eq("estudiante_id", estudianteId)
      .order("fecha_entrega", { ascending: false });
    setEntregas(data || []);
    setLoading(false);
  }, [estudianteId]);

  useEffect(() => {
    if (estudianteId) {
      cargarEntregas();
    }
  }, [estudianteId, cargarEntregas]);

  return (
    <Table
      dataSource={entregas}
      rowKey="id"
      loading={loading}
      pagination={false}
      columns={[
        { title: "Fecha", dataIndex: "fecha_entrega", render: (val: string) => dayjs(val).format("DD/MM/YYYY") },
        { title: "Tipo", dataIndex: "tipo_material", render: (val: string) => <Tag>{val?.toUpperCase()}</Tag> },
        { title: "Descripción", dataIndex: "descripcion" },
        { title: "Entregado Por", dataIndex: ["perfiles", "nombre_completo"] },
      ]}
    />
  );
};