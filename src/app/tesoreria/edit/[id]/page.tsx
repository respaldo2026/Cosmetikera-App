"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Edit, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, Select, InputNumber, DatePicker, Row, Col, Divider, message, Card, Alert } from "antd";
import dayjs from "dayjs";
import { obtenerCursosDeEstudiante } from "@modules/academico/matriculas.service";
import { UserOutlined, DollarCircleOutlined, SolutionOutlined } from "@ant-design/icons";
import { useParams } from "next/navigation";

export default function PagoEdit() {
    const params = useParams();
    const pagoId = params?.id as string;

    const { formProps, saveButtonProps, onFinish } = useForm({
        resource: "pagos",
        id: pagoId,
        redirect: "list",
        meta: {
            select: "*, perfiles(nombre_completo), matriculas(cursos(nombre))"
        }
    });
    
    // Estado para guardar los cursos del estudiante seleccionado
    const [cursosDelEstudiante, setCursosDelEstudiante] = useState<any[]>([]);
    const [buscandoCursos, setBuscandoCursos] = useState(false);
    const [estudianteActual, setEstudianteActual] = useState<string | null>(null);

    // 1. Selector de Estudiantes (Buscamos en Perfiles donde rol = estudiante)
    const { selectProps: allEstudianteSelectProps } = useSelect({
        resource: "perfiles",
        optionLabel: "nombre_completo",
        optionValue: "id",
        filters: [{ field: "rol", operator: "eq", value: "estudiante" }],
        sorters: [{ field: "nombre_completo", order: "asc" }]
    });

    const estudianteSelectProps = {
        options: allEstudianteSelectProps.options,
        loading: allEstudianteSelectProps.loading
    };

    // 2. Cuando eliges un estudiante, buscamos sus matrículas
    const handleEstudianteChange = useCallback(async (estudianteId: string) => {
        if (!estudianteId) return;
        setEstudianteActual(estudianteId);
        setBuscandoCursos(true);
        setCursosDelEstudiante([]); // Limpiar anterior
        try {
            const data = await obtenerCursosDeEstudiante(estudianteId);
            setCursosDelEstudiante(data);
        } catch (error: any) {
            message.error("Error buscando cursos del estudiante");
        }
        setBuscandoCursos(false);
    }, []);

    // Al seleccionar el curso, autocompletar el monto sugerido
    const handleCursoChange = (matriculaId: string) => {
        const matricula = cursosDelEstudiante.find(m => m.id === matriculaId);
        if (matricula) {
            const cursoInfo = Array.isArray(matricula.cursos) ? matricula.cursos[0] : matricula.cursos;
            if ((cursoInfo as any)?.precio_mensualidad) {
                formProps.form?.setFieldValue("monto", (cursoInfo as any).precio_mensualidad);
            }
        }
    };

    const handleOnFinish = (values: any) => {
        // Preparamos datos finales
        const datos = {
            ...values,
            fecha_pago: values.fecha_pago ? values.fecha_pago.format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
        };
        onFinish(datos);
    };

    const initialEstudianteId = formProps.initialValues?.estudiante_id as string | undefined;
    const initialFechaPago = formProps.initialValues?.fecha_pago as string | undefined;

    useEffect(() => {
        if (initialEstudianteId && !estudianteActual) {
            handleEstudianteChange(initialEstudianteId);
        }
    }, [initialEstudianteId, estudianteActual, handleEstudianteChange]);

    useEffect(() => {
        if (initialFechaPago && typeof initialFechaPago === 'string') {
            formProps.form?.setFieldValue("fecha_pago", dayjs(initialFechaPago));
        }
    }, [initialFechaPago, formProps.form]);

    return (
        <Edit 
            saveButtonProps={{ ...saveButtonProps, onClick: () => formProps.form?.submit() }} 
            title="Editar Pago"
        >
            <Form 
                {...formProps} 
                form={formProps.form}
                layout="vertical" 
                onFinish={handleOnFinish} 
            >
                
                <Row gutter={24}>
                    <Col span={12}>
                        <Form.Item label="Estudiante" name="estudiante_id" rules={[{ required: true, message: "Selecciona un estudiante" }]}>
                            <Select 
                                {...estudianteSelectProps} 
                                placeholder="Escribe para buscar..." 
                                showSearch
                                optionFilterProp="label"
                                onChange={handleEstudianteChange}
                                suffixIcon={<UserOutlined />}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item 
                            label="Curso a Pagar (Matrícula)" 
                            name="matricula_id" 
                            rules={[{ required: true, message: "Selecciona el curso" }]}
                            help={cursosDelEstudiante.length === 0 && !buscandoCursos ? "Selecciona un estudiante primero" : ""}
                        >
                            <Select 
                                placeholder="Selecciona el curso"
                                loading={buscandoCursos}
                                onChange={handleCursoChange}
                                disabled={cursosDelEstudiante.length === 0}
                            >
                                {cursosDelEstudiante.map((m: any) => (
                                    <Select.Option key={m.id} value={m.id}>
                                        {m.cursos?.nombre || "Curso sin nombre"}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                </Row>

                {cursosDelEstudiante.length === 0 && !buscandoCursos && (
                     <Alert style={{marginBottom: 20}} type="info" message="Nota: Selecciona un estudiante para ver sus cursos inscritos." />
                )}

                <Divider orientation="left">Detalles del Pago</Divider>

                <Row gutter={24}>
                    <Col span={8}>
                        <Form.Item label="Monto Recibido" name="monto" rules={[{ required: true, message: "Ingresa el valor" }]}>
                            <InputNumber 
                                style={{ width: '100%', fontSize: '16px', fontWeight: 'bold' }} 
                                prefix="$"
                                min={0}
                                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                parser={((value: string | undefined): number => {
                                    const parsed = value?.replace(/\$\s?|(,*)/g, '');
                                    return parsed ? parseInt(parsed, 10) : 0;
                                }) as any}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item label="Método de Pago" name="metodo_pago">
                            <Select options={[
                                { label: 'Efectivo', value: 'Efectivo' },
                                { label: 'Nequi', value: 'Nequi' },
                                { label: 'Bancolombia', value: 'Bancolombia' },
                                { label: 'Sistecredito', value: 'Sistecredito' }
                            ]} />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item label="Fecha" name="fecha_pago">
                            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" allowClear={false} />
                        </Form.Item>
                    </Col>
                </Row>

                <Row>
                    <Col span={24}>
                        <Form.Item label="Referencia / Observación" name="referencia">
                            <Input placeholder="Ej: Pago mes Noviembre - Comprobante #1234" prefix={<SolutionOutlined />} />
                        </Form.Item>
                    </Col>
                </Row>

            </Form>
        </Edit>
    );
}
