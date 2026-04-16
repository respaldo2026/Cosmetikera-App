"use client";

import React from "react";
import { List, useTable, CreateButton, EditButton, DeleteButton } from "@refinedev/antd";
import { Table, Space, Tag, Typography, Progress, Card, Row, Col, Statistic } from "antd";
import { 
    ShopOutlined, 
    WarningOutlined, 
    TagOutlined,
    AppstoreAddOutlined
} from "@ant-design/icons";

const { Text } = Typography;

export default function InventarioList() {
    const { tableProps, tableQueryResult } = useTable({
        resource: "inventario",
        sorters: { initial: [{ field: "cantidad", order: "asc" }] }, // Muestra primero lo que se está acabando
        // Si tu tabla usa 'unidad' en vez de 'cantidad' y no pudiste cambiarlo, 
        // cambia aquí 'cantidad' por 'unidad' en el sorter y en las columnas de abajo.
    });

    // Cálculos para las tarjetas de arriba (Dashboard del inventario)
    const productos = tableQueryResult?.data?.data || [];
    
    // Contamos cuántos productos tienen stock crítico
    const productosBajos = productos.filter((p: any) => {
        const stock = p.cantidad || 0;
        const minimo = p.stock_minimo || 5;
        return stock <= minimo;
    }).length;

    // Calculamos cuánto dinero tienes invertido en bodega
    const valorTotalInventario = productos.reduce((acc: number, p: any) => {
        const cantidad = p.cantidad || 0;
        const costo = p.costo_unitario || 0;
        return acc + (cantidad * costo);
    }, 0);

    return (
        <List
            title="Control de Inventario e Insumos"
            headerButtons={<CreateButton type="primary" size="large" icon={<AppstoreAddOutlined />}>Nuevo Producto</CreateButton>}
        >
            {/* --- TARJETAS DE RESUMEN --- */}
            <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                {/* Tarjeta de Alerta de Stock */}
                <Col xs={24} sm={12}>
                    <Card style={{ background: '#fff1f0', borderColor: '#ffa39e', border: '1px solid #ffa39e' }}>
                        <Statistic
                            title="Productos con Stock Bajo"
                            value={productosBajos}
                            valueStyle={{ color: '#cf1322', fontWeight: 'bold' }}
                            prefix={<WarningOutlined />}
                        />
                        <div style={{fontSize:12, color:'#cf1322', marginTop: 5}}>
                            Requieren reposición urgente
                        </div>
                    </Card>
                </Col>

                {/* Tarjeta de Valor del Inventario */}
                <Col xs={24} sm={12}>
                    <Card style={{ background: '#f0f5ff', borderColor: '#adc6ff', border: '1px solid #adc6ff' }}>
                        <Statistic
                            title="Capital en Insumos"
                            value={valorTotalInventario}
                            precision={0}
                            valueStyle={{ color: '#2f54eb', fontWeight: 'bold' }}
                            prefix="$"
                            suffix="COP"
                        />
                         <div style={{fontSize:12, color:'#2f54eb', marginTop: 5}}>
                            Valor total de mercancía en bodega
                         </div>
                    </Card>
                </Col>
            </Row>

            {/* --- TABLA DE PRODUCTOS --- */}
            <Table {...tableProps} rowKey="id">
                
                {/* 1. PRODUCTO */}
                <Table.Column 
                    title="Producto / Insumo"
                    dataIndex="nombre"
                    render={(value, record: any) => (
                        <div style={{display:'flex', flexDirection:'column'}}>
                            <Text strong style={{fontSize:15}}>{value}</Text>
                            {record.descripcion && (
                                <Text type="secondary" style={{fontSize:11}}>
                                    {record.descripcion}
                                </Text>
                            )}
                        </div>
                    )}
                />

                {/* 2. CATEGORÍA */}
                <Table.Column 
                    dataIndex="categoria" 
                    title="Categoría"
                    render={(value) => (
                        <Tag icon={<TagOutlined />} color="blue">
                            {value || "General"}
                        </Tag>
                    )}
                />

                {/* 3. STOCK (SEMÁFORO) */}
                <Table.Column 
                    title="Existencias"
                    dataIndex="cantidad" // Asegúrate de que esto coincida con tu BD
                    render={(value, record: any) => {
                        const stock = value || 0;
                        const minimo = record.stock_minimo || 5;
                        const esCritico = stock <= minimo;
                        const porcentaje = Math.min((stock / (minimo * 3)) * 100, 100);

                        return (
                            <div style={{ minWidth: 120 }}>
                                <div style={{ display:'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                    <Text strong style={{ color: esCritico ? '#cf1322' : '#3f8600' }}>
                                        {stock} Unid.
                                    </Text>
                                    {esCritico && <Tag color="error" style={{marginRight:0}}>BAJO</Tag>}
                                </div>
                                <Progress 
                                    percent={porcentaje} 
                                    steps={5} 
                                    size="small" 
                                    strokeColor={esCritico ? '#ff4d4f' : '#52c41a'} 
                                    showInfo={false}
                                />
                            </div>
                        );
                    }}
                />

                {/* 4. COSTO UNITARIO */}
                <Table.Column 
                    dataIndex="costo_unitario" 
                    title="Costo Unit."
                    render={(value) => (
                        <Text type="secondary">
                            $ {Number(value).toLocaleString()}
                        </Text>
                    )}
                />

                {/* 5. ACCIONES */}
                <Table.Column 
                    title="Acciones"
                    render={(_, record: any) => (
                        <Space>
                            <EditButton hideText size="small" recordItemId={record.id} />
                            <DeleteButton hideText size="small" recordItemId={record.id} />
                        </Space>
                    )}
                />
            </Table>
        </List>
    );
}