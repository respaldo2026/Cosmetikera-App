"use client";

import React, { useState } from "react";
import { useShow, useList, useCreate } from "@refinedev/core";
import { 
  Show,
  // NOTA: No importamos useForm de aquí para evitar conflictos
} from "@refinedev/antd";
import { 
  Typography, Tag, Tabs, Row, Col, Card, Statistic, Table, 
  Button, Modal, Form, Input, InputNumber, Select, DatePicker, Alert 
} from "antd";
import { 
  UserOutlined, 
  BookOutlined, 
  DollarCircleOutlined, 
  WalletOutlined 
} from "@ant-design/icons";
import dayjs from "dayjs";
import { formatDate } from "@utils/date";

export default function ShowPerfil() {
  // 1. Obtener datos del Profesor Actual
  const showResult: any = useShow({ 
      resource: "perfiles",
  });

  const profesor = showResult?.data?.data ?? null;
  const isLoading = showResult?.isLoading;
  const isError = showResult?.isError;
  const error = showResult?.error;

  // 2. Obtener Cursos
  const cursosResult: any = useList({
    resource: "cursos",
    filters: [
        { field: "profesor_id", operator: "eq", value: profesor?.id }
    ],
    queryOptions: { enabled: !!profesor?.id }
  });
  const cursosData = cursosResult?.result;

  // 3. Obtener Pagos
  const pagosResult: any = useList({
    resource: "pagos_profesores",
    filters: [
        { field: "profesor_id", operator: "eq", value: profesor?.id }
    ],
    sorters: [
        { field: "fecha_pago", order: "desc" }
    ],
    queryOptions: { enabled: !!profesor?.id }
  });
  const pagosData = pagosResult?.result;
  const refetchPagos = pagosResult?.query?.refetch;

  // --- LÓGICA DEL MODAL ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Usamos el hook de Ant Design (Form.useForm)
  const [form] = Form.useForm(); 
  
  const { mutate: crearPago } = useCreate();

  const handleGuardarPago = () => {
    form.validateFields().then(values => {
        crearPago({
            resource: "pagos_profesores",
            values: {
                ...values,
                profesor_id: profesor.id, 
            },
            successNotification: { message: "Movimiento registrado", type: "success" }
        }, {
            onSuccess: () => {
                setIsModalOpen(false);
                form.resetFields();
                refetchPagos(); 
            }
        });
    });
  };

  // --- MANEJO DE ESTADOS DE CARGA Y ERROR ---

  if (isLoading) {
      return <div style={{ padding: 20 }}>🔄 Cargando ficha del profesor...</div>;
  }

  // Si hay error o si terminó de cargar pero no hay datos
  if (isError || !profesor) {
      return (
          <div style={{ padding: 20 }}>
            <Alert 
                message="Error al cargar" 
                description={error?.message || "No se encontró el profesor."} 
                type="error" 
                showIcon 
            />
            <Button style={{ marginTop: 10 }} href="/profesores">Volver a la lista</Button>
          </div>
      );
  }

  // --- RENDERIZADO PRINCIPAL ---
  return (
    <Show 
        title={`Ficha de: ${profesor.nombre_completo}`}
        headerButtons={({ defaultButtons }) => (
            <>
              {defaultButtons}
              <Button type="primary" icon={<WalletOutlined />} onClick={() => setIsModalOpen(true)}>
                 Registrar Pago
              </Button>
            </>
        )}
    >
      <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
             {/* Usamos variant="borderless" para evitar warnings */}
             <Card variant="borderless">
                <Statistic 
                    title="Rol" 
                    value={profesor.rol?.toUpperCase()} 
                    prefix={<UserOutlined />}
                    valueStyle={{ color: '#722ed1', fontSize: 18 }}
                />
             </Card>
          </Col>
          <Col span={8}>
             <Card variant="borderless">
                <Statistic 
                    title="Modalidad de Pago" 
                    value={profesor.tipo_pago?.toUpperCase() || "POR DEFINIR"} 
                    prefix={<DollarCircleOutlined />}
                    valueStyle={{ fontSize: 18 }}
                />
                <div style={{ marginTop: 5, color: '#888' }}>
                    Tarifa: <b>{profesor.valor_pago}</b> {profesor.tipo_pago === 'porcentaje' ? '%' : '$'}
                </div>
             </Card>
          </Col>
          <Col span={8}>
             <Card variant="borderless">
                <Statistic 
                    title="Teléfono" 
                    value={profesor.telefono || "---"} 
                    valueStyle={{ fontSize: 18 }}
                />
             </Card>
          </Col>
      </Row>

      <Tabs
        defaultActiveKey="1"
        items={[
          {
            key: '1',
            label: <span><UserOutlined />Datos Personales</span>,
            children: (
                <Card variant="borderless">
                    <p><b>Cédula:</b> {profesor.identificacion}</p>
                    <p><b>Email:</b> {profesor.email}</p>
                    <p><b>Registro:</b> {formatDate(profesor.created_at)}</p>
                </Card>
            ),
          },
          {
            key: '2',
            label: <span><BookOutlined />Cursos ({cursosData?.data?.length})</span>,
            children: (
                <Table 
                    dataSource={cursosData?.data || []} 
                    rowKey="id"
                    pagination={false}
                >
                    <Table.Column title="Curso" dataIndex="nombre" />
                    <Table.Column title="Precio" dataIndex="precio" render={(v)=>`$ ${Number(v).toLocaleString()}`} />
                    <Table.Column title="Comisión" dataIndex="porcentaje_comision" render={(v) => <Tag color="blue">{v}%</Tag>} />
                </Table>
            ),
          },
          {
            key: '3',
            label: <span><DollarCircleOutlined />Pagos</span>,
            children: (
                <Table dataSource={pagosData?.data || []} rowKey="id">
                  <Table.Column title="Fecha" dataIndex="fecha_pago" render={(v)=> formatDate(v)}/>
                    <Table.Column title="Tipo" dataIndex="tipo" render={(v) => <Tag>{v}</Tag>} />
                    <Table.Column title="Nota" dataIndex="nota" />
                    <Table.Column title="Monto" dataIndex="monto" render={(v)=> <b>$ {Number(v).toLocaleString()}</b>} />
                </Table>
            ),
          },
        ]}
      />

      {/* --- MODAL --- */}
      <Modal
        title="💰 Registrar Pago"
        open={isModalOpen}
        onOk={handleGuardarPago}
        onCancel={() => setIsModalOpen(false)}
        okText="Guardar"
      >
        <Form form={form} layout="vertical">
            <Row gutter={16}>
                <Col span={12}>
                    <Form.Item name="fecha_pago" label="Fecha" initialValue={dayjs()}>
                      <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY"/>
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item name="tipo" label="Tipo" initialValue="pago_nomina">
                        <Select options={[
                            {value: 'pago_nomina', label: 'Pago de Nómina'},
                            {value: 'adelanto', label: 'Adelanto'},
                            {value: 'bono', label: 'Bono'},
                        ]} />
                    </Form.Item>
                </Col>
            </Row>

            <Form.Item name="monto" label="Monto ($)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="nota" label="Nota">
                <Input.TextArea rows={2} />
            </Form.Item>
        </Form>
      </Modal>
    </Show>
  );
}