"use client";

import React from "react";
import { List, useTable, CreateButton, EditButton, DeleteButton } from "@refinedev/antd";
import { Table, Space, Tag, Typography, Card, Statistic, Row, Col } from "antd";
import { 
    DollarCircleOutlined, 
    UserOutlined, 
    BankOutlined, 
    CalendarOutlined,
    ShopOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Text } = Typography;

export default function TesoreriaList() {
    // Traemos los pagos junto con el nombre del estudiante y el curso
    const { tableProps, tableQueryResult } = useTable({
        resource: "pagos",
        meta: {
            select: "*, perfiles(nombre_completo), matriculas(cursos(nombre))"
        },
        sorters: { initial: [{ field: "created_at", order: "desc" }] },
    });

    // Calcular el total de lo que se ve en pantalla
    const pagos = tableQueryResult?.data?.data || [];
    const totalRecaudado = pagos.reduce((acc, curr: any) => acc + Number(curr.monto || 0), 0);

    return (
        <List
            title="💰 Tesorería y Recaudo"
            headerButtons={<CreateButton type="primary" size="large">Registrar Pago</CreateButton>}
        >
            {/* Tarjeta de Resumen de Dinero */}
            <Row gutter={16} style={{ marginBottom: 20 }}>
                <Col xs={24} sm={8}>
                    <Card bordered={false} style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}>
                        <Statistic
                            title="Total en esta página"
                            value={totalRecaudado}
                            precision={0}
                            valueStyle={{ color: '#3f8600' }}
                            prefix={<DollarCircleOutlined />}
                            suffix="COP"
                        />
                    </Card>
                </Col>
            </Row>

            <Table {...tableProps} rowKey="id">
                
                {/* FECHA */}
                <Table.Column 
                    dataIndex="fecha_pago" 
                    title="Fecha"
                    render={(value) => (
                        <Space>
                            <CalendarOutlined style={{ color: '#999' }} />
                            <span>{value ? dayjs(value).format("DD MMM YYYY") : "-"}</span>
                        </Space>
                    )}
                />

                {/* ESTUDIANTE */}
                <Table.Column 
                    title="Estudiante"
                    render={(_, record: any) => (
                        <Space>
                            <UserOutlined style={{ color: '#1890ff' }} />
                            <Text strong>{record.perfiles?.nombre_completo || "Desconocido"}</Text>
                        </Space>
                    )}
                />

                {/* CURSO QUE PAGA */}
                <Table.Column 
                    title="Concepto"
                    render={(_, record: any) => {
                        const curso = record.matriculas?.cursos?.nombre;
                        return curso ? <Tag color="purple">{curso}</Tag> : <Tag>Otro</Tag>;
                    }}
                />

                {/* MÉTODO */}
                <Table.Column 
                    dataIndex="metodo_pago" 
                    title="Método"
                    render={(value) => {
                        const esBanco = ['nequi', 'daviplata', 'bancolombia'].some(x => String(value).toLowerCase().includes(x));
                        return <Tag icon={esBanco ? <BankOutlined /> : <DollarCircleOutlined />}>{value || "Efectivo"}</Tag>;
                    }}
                />

                {/* MONTO */}
                <Table.Column 
                    dataIndex="monto" 
                    title="Valor Pagado"
                    render={(value) => (
                        <Text strong style={{ color: '#3f8600', fontSize: '15px' }}>
                            $ {Number(value).toLocaleString()}
                        </Text>
                    )}
                />

                <Table.Column 
                    title="Acciones"
                    render={(_, record: any) => (
                        <Space>
                            <DeleteButton hideText size="small" recordItemId={record.id} />
                        </Space>
                    )}
                />
            </Table>
        </List>
    );
}