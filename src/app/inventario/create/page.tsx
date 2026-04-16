"use client";

import React from "react";
import { Create, useForm } from "@refinedev/antd";
import { Form, Input, InputNumber, Select, Row, Col, Divider } from "antd";
import { ShopOutlined, DollarCircleOutlined, NumberOutlined } from "@ant-design/icons";

export default function InventarioCreate() {
    const { formProps, saveButtonProps } = useForm({ redirect: "list" });

    return (
        <Create saveButtonProps={saveButtonProps} title="Registrar Nuevo Insumo">
            <Form {...formProps} form={formProps.form} layout="vertical">
                
                <Row gutter={24}>
                    <Col span={12}>
                        <Form.Item label="Nombre del Producto" name="nombre" rules={[{ required: true }]}>
                            <Input prefix={<ShopOutlined />} placeholder="Ej: Agujas 3RL" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="Categoría" name="categoria">
                            <Select 
                                placeholder="Selecciona..."
                                options={[
                                    { label: 'Tintas', value: 'Tintas' },
                                    { label: 'Agujas / Cartuchos', value: 'Agujas' },
                                    { label: 'Desechables (Guantes, etc)', value: 'Desechables' },
                                    { label: 'Higiene', value: 'Higiene' },
                                    { label: 'Maquinaria', value: 'Maquinaria' },
                                ]} 
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={24}>
                    <Col span={8}>
                        <Form.Item label="Cantidad Inicial" name="cantidad" rules={[{ required: true }]}>
                            <InputNumber style={{ width: '100%' }} min={0} prefix={<NumberOutlined />} />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item label="Stock Mínimo (Alerta)" name="stock_minimo" initialValue={5} tooltip="Te avisaremos cuando baje de esta cantidad">
                            <InputNumber style={{ width: '100%' }} min={1} status="warning" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item label="Costo Unitario" name="costo_unitario" rules={[{ required: true }]}>
                            <InputNumber 
                                style={{ width: '100%' }} 
                                prefix="$" 
                                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as unknown as number}
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item label="Descripción / Notas" name="descripcion">
                    <Input.TextArea rows={2} placeholder="Marca, proveedor, detalles..." />
                </Form.Item>

            </Form>
        </Create>
    );
}