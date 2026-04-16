"use client";

import React from "react";
import { Edit, useForm } from "@refinedev/antd";
import { Form, Input, Select, InputNumber, Row, Col, DatePicker } from "antd";
import dayjs from "dayjs";

export default function CursoEdit() {
    const { formProps, saveButtonProps, queryResult } = useForm({
        redirect: "list"
    });

    return (
        <Edit saveButtonProps={saveButtonProps} title="Editar Curso">
            <Form {...formProps} layout="vertical">
                
                <Row gutter={24}>
                    <Col span={16}>
                        <Form.Item
                            label="Nombre del Curso"
                            name="nombre"
                            rules={[{ required: true, message: "El nombre es obligatorio" }]}
                        >
                            <Input />
                        </Form.Item>
                    </Col>
                    
                    <Col span={8}>
                        <Form.Item
                            label="Estado"
                            name="estado"
                        >
                            <Select
                                options={[
                                    { label: "Activo", value: "activo" },
                                    { label: "Cerrado", value: "cerrado" },
                                    { label: "Finalizado", value: "finalizado" },
                                ]}
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item
                    label="Descripción"
                    name="descripcion"
                >
                    <Input.TextArea rows={3} />
                </Form.Item>

                <Row gutter={24}>
                    <Col span={8}>
                        <Form.Item
                            label="Precio Inscripción"
                            name="precio_inscripcion"
                        >
                            <InputNumber 
                                style={{ width: "100%" }} 
                                formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as unknown as number}
                            />
                        </Form.Item>
                    </Col>
                    
                    <Col span={8}>
                        <Form.Item
                            label="Valor Total / Mensualidad"
                            name="precio_curso"
                            rules={[{ required: true }]}
                        >
                            <InputNumber 
                                style={{ width: "100%" }}
                                formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as unknown as number}
                            />
                        </Form.Item>
                    </Col>

                    {/* --- AQUÍ SE MODIFICA EL CUPO --- */}
                    <Col span={8}>
                        <Form.Item
                            label="Cupos Totales"
                            name="cupos"
                            rules={[{ required: true, message: "El cupo es obligatorio" }]}
                            help="Si reduces el cupo, asegúrate que no haya más inscritos que este número"
                        >
                            <InputNumber min={1} style={{ width: "100%" }} />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={24}>
                    <Col span={8}>
                         <Form.Item 
                            label="Fecha Inicio" 
                            name="fecha_inicio"
                            getValueProps={(value) => ({
                                value: value ? dayjs(value) : "",
                            })}
                         >
                            <DatePicker style={{width: '100%'}} format="YYYY-MM-DD" />
                         </Form.Item>
                    </Col>
                    <Col span={8}>
                         <Form.Item label="Duración" name="duracion">
                            <Input />
                         </Form.Item>
                    </Col>
                </Row>

            </Form>
        </Edit>
    );
}