"use client";

import React, { useState } from "react";
import { Create, useForm, useSelect } from "@refinedev/antd";
import { Form, Select, DatePicker, Input, Card, Statistic, message, Alert } from "antd";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { UserOutlined, BookOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

export default function MatriculaCreate() {
    const { formProps, saveButtonProps, onFinish } = useForm({
        redirect: "list"
    });

    const [cuposInfo, setCuposInfo] = useState<{ ocupados: number, total: number } | null>(null);
    const [checking, setChecking] = useState(false);

    // 1. Selector de Estudiantes (Solo mostramos estudiantes, no profesores)
    const { selectProps: studentSelectProps } = useSelect({
        resource: "perfiles",
        optionLabel: "nombre_completo",
        optionValue: "id",
        filters: [
            { field: "rol", operator: "eq", value: "estudiante" }
        ]
    });

    // 2. Selector de Cursos
    const { selectProps: cursoSelectProps } = useSelect({
        resource: "cursos",
        optionLabel: "nombre",
        optionValue: "id",
        filters: [
             { field: "estado", operator: "eq", value: "activo" }
        ]
    });

    // 3. Función para verificar cupos en tiempo real al seleccionar curso
    const handleCursoChange = async (cursoId: string) => {
        if (!cursoId) return;
        setChecking(true);
        setCuposInfo(null);

        const supabase = supabaseBrowserClient;

        try {
            // A. Obtener límite del curso
            const { data: curso, error: errCurso } = await supabase
                .from('cursos')
                .select('cupos, nombre')
                .eq('id', cursoId)
                .single();
            
            if (errCurso) throw errCurso;

            // B. Contar inscritos actuales
            const { count, error: errCount } = await supabase
                .from('matriculas')
                .select('*', { count: 'exact', head: true })
                .eq('curso_id', cursoId);

            if (errCount) throw errCount;

            setCuposInfo({
                ocupados: count || 0,
                total: curso.cupos || 20 // 20 por defecto si es nulo
            });

        } catch (error) {
            console.error("Error verificando cupos:", error);
        } finally {
            setChecking(false);
        }
    };

    // 4. Interceptamos el guardado para evitar matrícula si está lleno
    const handleOnFinish = async (values: any) => {
        if (cuposInfo && cuposInfo.ocupados >= cuposInfo.total) {
            message.error("⛔ ¡El curso está lleno! No se puede matricular.");
            return;
        }
        // Si hay espacio, procedemos con el guardado normal de Refine
        onFinish(values);
    };

    // Calcular estado visual
    const isFull = cuposInfo ? cuposInfo.ocupados >= cuposInfo.total : false;
    const disponibilidad = cuposInfo ? (cuposInfo.total - cuposInfo.ocupados) : 0;

    return (
        <Create saveButtonProps={{...saveButtonProps, onClick: () => formProps.form?.submit()}} title="Nueva Matrícula">
            
            {/* ALERTAS VISUALES DE CUPO */}
            {cuposInfo && (
                <div style={{ marginBottom: 20 }}>
                    {isFull ? (
                        <Alert 
                            message="CURSO LLENO" 
                            description={`Ya hay ${cuposInfo.ocupados} de ${cuposInfo.total} estudiantes inscritos.`} 
                            type="error" 
                            showIcon 
                        />
                    ) : (
                        <Alert 
                            message="Cupos Disponibles" 
                            description={`Quedan ${disponibilidad} lugares disponibles (Inscritos: ${cuposInfo.ocupados}/${cuposInfo.total})`} 
                            type="success" 
                            showIcon 
                        />
                    )}
                </div>
            )}

            <Form {...formProps} layout="vertical" onFinish={handleOnFinish}>
                
                <Form.Item
                    label="Estudiante"
                    name="estudiante_id"
                    rules={[{ required: true, message: "Selecciona un estudiante" }]}
                >
                    <Select 
                        {...studentSelectProps} 
                        placeholder="Buscar estudiante..."
                        showSearch
                        optionFilterProp="label"
                        suffixIcon={<UserOutlined />}
                    />
                </Form.Item>

                <Form.Item
                    label="Curso a inscribir"
                    name="curso_id"
                    rules={[{ required: true, message: "Selecciona un curso" }]}
                >
                    <Select 
                        {...cursoSelectProps} 
                        placeholder="Selecciona el curso..."
                        onChange={handleCursoChange}
                        loading={checking}
                        suffixIcon={<BookOutlined />}
                    />
                </Form.Item>

                <div style={{ display: 'flex', gap: 20 }}>
                    <Form.Item
                        label="Fecha de Inicio"
                        name="fecha_inicio"
                        initialValue={dayjs()}
                        style={{ flex: 1 }}
                    >
                        <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                    </Form.Item>

                    <Form.Item
                        label="Estado de Matrícula"
                        name="estado"
                        initialValue="activa"
                        style={{ flex: 1 }}
                    >
                        <Select options={[
                            { label: 'Activa', value: 'activa' },
                            { label: 'Pendiente Pago', value: 'pendiente' },
                            { label: 'Congelada', value: 'congelada' }
                        ]} />
                    </Form.Item>
                </div>

                <Form.Item label="Observaciones / Notas" name="observaciones">
                    <Input.TextArea rows={2} placeholder="Ej: Trae documentos pendientes..." />
                </Form.Item>

            </Form>
        </Create>
    );
}