"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Edit, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, Select, DatePicker, Card, Alert } from "antd";
import { 
    UserOutlined, 
    BookOutlined, 
    CheckCircleOutlined, 
    SyncOutlined,
    CloseCircleOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import { supabaseBrowserClient } from "@utils/supabase/client";

export default function MatriculaEdit() {
    const { formProps, saveButtonProps } = useForm();
    const [programaId, setProgramaId] = useState<string | undefined>(undefined);

    // Obtenemos datos de las tablas relacionadas para los selectores (aunque sean solo lectura)
    const { selectProps: studentSelectProps } = useSelect({
        resource: "perfiles",
        optionLabel: "nombre_completo",
        optionValue: "id",
    });

    const { selectProps: courseSelectProps } = useSelect({
        resource: "cursos",
        optionLabel: "nombre",
        optionValue: "id",
    });

    const { selectProps: programaSelectProps } = useSelect({
        resource: "programas",
        optionLabel: "nombre",
        optionValue: "id",
    });

    const supabaseFetchPrograma = useCallback(async (cursoId: string) => {
        try {
            const { data } = await supabaseBrowserClient
                .from('cursos')
                .select('programa_id')
                .eq('id', cursoId)
                .maybeSingle();
            if (data?.programa_id) {
                setProgramaId(String(data.programa_id));
                formProps.form?.setFieldValue('programa_id', data.programa_id);
            }
        } catch (e) {
            console.warn('No se pudo cargar el programa del curso', e);
        }
    }, [formProps.form]);

    useEffect(() => {
        const cursoId = formProps.form?.getFieldValue('curso_id');
        if (cursoId) {
            supabaseFetchPrograma(cursoId);
        }
    }, [formProps.form, supabaseFetchPrograma]);

    return (
        <Edit saveButtonProps={saveButtonProps} title="Actualizar Matrícula">
            
            {/* Aviso importante */}
            <Alert 
                message="Gestión de Diplomas" 
                description="Para que el estudiante pueda descargar su Diploma, debes cambiar el estado a 'Aprobado'."
                type="info" 
                showIcon 
                style={{ marginBottom: 20 }}
            />

            <Form {...formProps} form={formProps.form} layout="vertical">
                
                <Card title="Datos de la Matrícula" variant="borderless">
                    
                    {/* ESTUDIANTE (Deshabilitado para no cambiarlo por error) */}
                    <Form.Item label="Estudiante" name="estudiante_id">
                        <Select {...studentSelectProps} disabled suffixIcon={<UserOutlined />} />
                    </Form.Item>

                    {/* PROGRAMA (solo lectura) */}
                    <Form.Item label="Programa" name="programa_id">
                        <Select {...programaSelectProps} disabled placeholder="Programa del curso" />
                    </Form.Item>

                    {/* CURSO (Deshabilitado) */}
                    <Form.Item label="Curso" name="curso_id">
                        <Select {...courseSelectProps} disabled suffixIcon={<BookOutlined />} />
                    </Form.Item>

                    {/* ESTADO - ¡AQUÍ ESTÁ LA MAGIA! ✨ */}
                    <Form.Item 
                        label="Estado Académico" 
                        name="estado"
                        rules={[{ required: true, message: "Por favor define el estado" }]}
                        help="Selecciona 'Aprobado' cuando termine el curso."
                    >
                        <Select 
                            placeholder="Selecciona el estado..."
                            options={[
                                { label: 'En Curso / Activo', value: 'activo', icon: <SyncOutlined spin /> },
                                { label: 'Aprobado (Genera Diploma)', value: 'aprobado', icon: <CheckCircleOutlined style={{color:'green'}}/> },
                                { label: 'Cancelado / Retirado', value: 'cancelado', icon: <CloseCircleOutlined style={{color:'red'}}/> },
                            ]}
                        />
                    </Form.Item>

                    {/* NOTAS O COMENTARIOS */}
                    <Form.Item label="Observaciones / Nota Final" name="observaciones">
                        <Input.TextArea rows={3} placeholder="Ej: Nota final 4.8 - Excelente desempeño" />
                    </Form.Item>

                </Card>
            </Form>
        </Edit>
    );
}