"use client";

import React from "react";
import { Create, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, Select, InputNumber, Row, Col, DatePicker, message } from "antd";
import { UserOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

export default function CursoCreate() {
    const { formProps, saveButtonProps, onFinish } = useForm({
        redirect: "list",
    });

    const { selectProps: professorSelectProps } = useSelect({
        resource: "perfiles",
        optionLabel: "nombre_completo",
        optionValue: "id",
        filters: [
            { field: "rol", operator: "eq", value: "profesor" }
        ]
    });

    const handleOnFinish = (values: any) => {
        // Convertir fecha a string simple 'YYYY-MM-DD' para evitar error en Supabase
        const datosLimpios = {
            ...values,
            fecha_inicio: values.fecha_inicio ? dayjs(values.fecha_inicio).format('YYYY-MM-DD') : null,
        };
        onFinish(datosLimpios);
    };

    return (
        <Create 
            saveButtonProps={{
                ...saveButtonProps,
                // CLAVE PARA QUE FUNCIONE: Forzamos el envío al hacer clic en el botón del encabezado
                onClick: () => formProps.form?.submit() 
            }} 
            title="Crear Nuevo Curso"
        >
            <Form 
                {...formProps}
                // SOLUCIÓN DEFINITIVA AL ERROR "NOT CONNECTED":
                form={formProps.form} 
                layout="vertical" 
                onFinish={handleOnFinish}
            >
                
                <Row gutter={24}>
                    <Col span={16}>
                        {/* Verificamos que 'nombre' coincida con tu base de datos */}
                        <Form.Item
                            label="Nombre del Curso"
                            name="nombre" 
                            rules={[{ required: true, message: "El nombre es obligatorio" }]}
                        >
                            <Input placeholder="Ej: Micropigmentación" />
                        </Form.Item>
                    </Col>
                    
                    <Col span={8}>
                        <Form.Item
                            label="Estado"
                            name="estado"
                            initialValue="activo"
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
                    label="Profesor Asignado"
                    name="profesor_id"
                    rules={[{ required: true, message: "Asigna un profesor" }]}
                >
                    <Select 
                        {...professorSelectProps}
                        placeholder="Buscar profesor..."
                        suffixIcon={<UserOutlined />}
                        showSearch
                        optionFilterProp="label"
                    />
                </Form.Item>

                <Form.Item
                    label="Descripción"
                    name="descripcion"
                >
                    <Input.TextArea rows={3} placeholder="Detalles del curso..." />
                </Form.Item>

                <Row gutter={24}>
                    <Col span={8}>
                        <Form.Item
                            label="Precio Inscripción"
                            name="precio_inscripcion"
                            initialValue={0}
                        >
                            <InputNumber 
                                style={{ width: "100%" }} 
                                formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as unknown as number}
                            />
                        </Form.Item>
                    </Col>
                    
                    <Col span={8}>
                        {/* Nombre exacto de tu columna en BD según tu imagen: precio_mensualidad */}
                        <Form.Item
                            label="Valor Mensualidad / Total"
                            name="precio_mensualidad" 
                            rules={[{ required: true, message: "El precio es requerido" }]}
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
                            label="Cupos Disponibles"
                            name="cupos"
                            initialValue={20}
                            rules={[{ required: true }]}
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
                            <Input placeholder="Ej: 2 meses" />
                         </Form.Item>
                    </Col>
                </Row>

            </Form>
        </Create>
    );
}