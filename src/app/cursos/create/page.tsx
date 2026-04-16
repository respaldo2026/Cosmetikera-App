"use client";

import React, { useState, useEffect } from "react";
import { Create } from "@refinedev/antd";
import { Form, Input, Select, InputNumber, Row, Col, DatePicker, message, TimePicker, Button } from "antd";
import { UserOutlined, BookOutlined } from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { useRouter } from "next/navigation";
import "dayjs/locale/es";

dayjs.locale("es");

export default function CursoCreate() {
    const [form] = Form.useForm();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    
    const [profesores, setProfesores] = useState<any[]>([]);
    const [programas, setProgramas] = useState<any[]>([]);
    const [clasesPrograma, setClasesPrograma] = useState<number | null>(null);
    const [diasSeleccionados, setDiasSeleccionados] = useState<string[]>([]);
    const [fechaInicio, setFechaInicio] = useState<Dayjs | null>(null);
    const [horaInicio, setHoraInicio] = useState<Dayjs | null>(null);
    
    useEffect(() => {
        const cargarDatos = async () => {
            const [profesoresRes, programasRes] = await Promise.all([
                supabaseBrowserClient
                    .from("perfiles")
                    .select("id, nombre_completo")
                    .eq("rol", "profesor")
                    .order("nombre_completo"),
                supabaseBrowserClient
                    .from("programas")
                    .select("id, nombre, total_clases")
                    .eq("activo", true)
                    .order("nombre")
            ]);
            
            if (profesoresRes.data) setProfesores(profesoresRes.data);
            if (programasRes.data) setProgramas(programasRes.data);
        };
        cargarDatos();
    }, []);

    useEffect(() => {
        const fechaCalculada = calcularFechaFin(fechaInicio, diasSeleccionados, clasesPrograma);
        if (fechaCalculada) {
            form.setFieldValue("fecha_fin", fechaCalculada);
        } else {
            form.setFieldValue("fecha_fin", null);
        }
    }, [fechaInicio, diasSeleccionados, clasesPrograma, form]);

    useEffect(() => {
        const programaId = form.getFieldValue("programa_id");
        const programa = programas.find(p => p.id === programaId);
        const horaInicioValue = form.getFieldValue("hora_inicio");
        
        if (!programa) return;

        let nombreGenerado = programa.nombre;

        if (diasSeleccionados.length > 0) {
            const diasAbreviados = diasSeleccionados.map(d => {
                const abrev: Record<string, string> = {
                    'Lunes': 'Lun', 'Martes': 'Mar', 'Miércoles': 'Mié',
                    'Jueves': 'Jue', 'Viernes': 'Vie', 'Sábado': 'Sáb', 'Domingo': 'Dom'
                };
                return abrev[d] || d;
            });
            nombreGenerado += ` - ${diasAbreviados.join('/')}`;
        }
        
        if (horaInicioValue) {
            const hora = dayjs.isDayjs(horaInicioValue) 
                ? horaInicioValue.format('h:mm A')
                : (typeof horaInicioValue === 'string' ? dayjs(horaInicioValue, 'HH:mm:ss').format('h:mm A') : '');
            if (hora) {
                nombreGenerado += ` ${hora}`;
            }
        }
        
        form.setFieldValue("nombre", nombreGenerado);
    }, [diasSeleccionados, form, programas, horaInicio]);

    useEffect(() => {
        if (horaInicio) {
            const horaFin = horaInicio.add(3, 'hour');
            form.setFieldValue("hora_fin", horaFin);
        }
    }, [horaInicio, form]);

    const seSolapanHoras = (inicioA: string | null, finA: string | null, inicioB: string | null, finB: string | null) => {
        const startA = inicioA ? dayjs(inicioA, "HH:mm:ss") : null;
        const endA = finA ? dayjs(finA, "HH:mm:ss") : startA ? startA.add(1, "hour") : null;
        const startB = inicioB ? dayjs(inicioB, "HH:mm:ss") : null;
        const endB = finB ? dayjs(finB, "HH:mm:ss") : startB ? startB.add(1, "hour") : null;

        if (!startA || !startB || !endA || !endB) return false; // sin horarios definidos no validamos choque
        return startA.isBefore(endB) && startB.isBefore(endA);
    };

    const hayInterseccionDias = (diasA?: string[] | string | null, diasB?: string[] | string | null) => {
        const a = Array.isArray(diasA)
            ? diasA
            : (diasA ? diasA.split(",").map((d) => d.trim()) : []);
        const b = Array.isArray(diasB)
            ? diasB
            : (diasB ? diasB.split(",").map((d) => d.trim()) : []);
        const setA = new Set(a.map((d) => d.toLowerCase()));
        return b.some((d) => setA.has(d.toLowerCase()));
    };

    const calcularFechaFin = (fechaInicioValue: Dayjs | null, dias: string[], totalClases?: number | null) => {
        if (!fechaInicioValue || !dias.length || !totalClases || totalClases <= 0) return null;

        const normalize = (text: string) => {
            // Remover acentos sin usar flag 'u'
            return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        };
        const diasValidos = dias.map((d) => normalize(d));

        let sesionesPendientes = totalClases;
        let cursor = fechaInicioValue;

        while (sesionesPendientes > 0) {
            const nombreDia = normalize(cursor.locale("es").format("dddd"));
            if (diasValidos.includes(nombreDia)) {
                sesionesPendientes -= 1;
                if (sesionesPendientes === 0) break;
            }
            cursor = cursor.add(1, "day");
        }

        return cursor;
    };

    const validarConflictos = async (datos: any) => {
        if (!datos.fecha_inicio || !datos.dias_semana || !datos.hora_inicio) return; // sin info, no validamos

        const fechaInicio = dayjs(datos.fecha_inicio);
        const fechaFin = datos.fecha_fin ? dayjs(datos.fecha_fin) : fechaInicio.add(6, "month");

        const { data, error } = await supabaseBrowserClient
            .from("cursos")
            .select("id, nombre, fecha_inicio, fecha_fin, dias_semana, hora_inicio, hora_fin, estado")
            .in("estado", ["activo", "proximo"]);

        if (error) return;

        const conflicto = (data || []).find((c: any) => {
            // Rango de fechas se solapa
            const cInicio = c.fecha_inicio ? dayjs(c.fecha_inicio) : null;
            const cFin = c.fecha_fin ? dayjs(c.fecha_fin) : cInicio ? cInicio.add(6, "month") : null;
            if (!cInicio || !cFin) return false;
            const solapaFecha = cInicio.isBefore(fechaFin) && fechaInicio.isBefore(cFin);
            if (!solapaFecha) return false;

            // Días comparten
            if (!hayInterseccionDias(datos.dias_semana, c.dias_semana)) return false;

            // Horarios se solapan
            return seSolapanHoras(datos.hora_inicio, datos.hora_fin, c.hora_inicio, c.hora_fin);
        });

        if (conflicto) {
            throw new Error(`Conflicto con el grupo "${conflicto.nombre}" en horario y día. Ajusta la franja horaria o los días.`);
        }
    };

    const handleOnFinish = async (values: any) => {
        // Convertir valores correctamente
        const datosLimpios = {
            ...values,
            fecha_inicio: values.fecha_inicio ? dayjs(values.fecha_inicio).format('YYYY-MM-DD') : null,
            fecha_fin: values.fecha_fin ? dayjs(values.fecha_fin).format('YYYY-MM-DD') : null,
            dias_semana: Array.isArray(values.dias_semana) 
                ? values.dias_semana.join(', ')
                : (values.dias_semana || null),
            hora_inicio: values.hora_inicio 
                ? (dayjs.isDayjs(values.hora_inicio) 
                    ? values.hora_inicio.format('HH:mm:ss')
                    : values.hora_inicio)
                : null,
            hora_fin: values.hora_fin 
                ? (dayjs.isDayjs(values.hora_fin)
                    ? values.hora_fin.format('HH:mm:ss')
                    : values.hora_fin)
                : null,
        };

        try {
            setLoading(true);
            
            // Validar conflictos de horario
            await validarConflictos(datosLimpios);
            
            // Llamar al endpoint API que bypasea RLS
            const response = await fetch('/api/cursos/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datosLimpios),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Error al crear el grupo');
            }

            console.log('✅ Grupo creado exitosamente:', result.data);
            
            // Mostrar mensaje de éxito
            message.success('Grupo creado exitosamente');
            
            // Esperar un momento para que el usuario vea el mensaje
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Redirigir a la lista de cursos
            console.log('🔄 Redirigiendo a /cursos...');
            router.push('/cursos');
            
        } catch (err: any) {
            console.error('❌ Error al crear grupo:', err);
            message.error(err?.message || "Error al crear el grupo");
            throw err; // Re-lanzar para que el formulario sepa que falló
        } finally {
            setLoading(false);
        }
    };

    return (
        <Create 
            title="Crear nuevo grupo"
            footerButtons={({ saveButtonProps: defaultSaveProps }) => (
                <>
                    <Button onClick={() => router.push('/cursos')}>
                        Cancelar
                    </Button>
                    <Button
                        type="primary"
                        {...defaultSaveProps}
                        loading={loading}
                        onClick={() => form.submit()}
                    >
                        Guardar
                    </Button>
                </>
            )}
        >
            <Form 
                form={form}
                layout="vertical" 
                onFinish={handleOnFinish}
            >
                
                <Row gutter={24}>
                    <Col span={24}>
                        <Form.Item
                            label="Programa Académico"
                            name="programa_id"
                            rules={[{ required: true, message: "Selecciona el programa" }]}
                        >
                            <Select 
                                placeholder="Selecciona el programa al que pertenece este grupo"
                                showSearch
                                filterOption={(input, option) =>
                                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                                options={programas.map(p => ({ 
                                    label: p.nombre, 
                                    value: p.id 
                                }))}
                                onChange={(value) => {
                                    const programa = programas.find(p => p.id === value);
                                    if (programa) {
                                        setClasesPrograma(programa.total_clases ?? null);
                                    } else {
                                        setClasesPrograma(null);
                                    }
                                }}
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={24}>
                    <Col span={12}>
                        <Form.Item
                            label="Días de la Semana"
                            name="dias_semana"
                            rules={[{ required: true, message: "Selecciona al menos un día" }]}
                            help="Selecciona los días en que se dicta la clase"
                        >
                            <Select 
                                mode="multiple"
                                placeholder="Selecciona días..."
                                options={[
                                    { label: 'Lunes', value: 'Lunes' },
                                    { label: 'Martes', value: 'Martes' },
                                    { label: 'Miércoles', value: 'Miércoles' },
                                    { label: 'Jueves', value: 'Jueves' },
                                    { label: 'Viernes', value: 'Viernes' },
                                    { label: 'Sábado', value: 'Sábado' },
                                    { label: 'Domingo', value: 'Domingo' },
                                ]}
                                onChange={(values) => {
                                    const lista = Array.isArray(values) ? values : [];
                                    setDiasSeleccionados(lista);
                                }}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item
                            label="Hora Inicio"
                            name="hora_inicio"
                            rules={[{ required: true, message: "Ingresa la hora" }]}
                        >
                            <TimePicker 
                                style={{ width: '100%' }} 
                                format="h:mm A"
                                use12Hours
                                minuteStep={30}
                                showNow={false}
                                onChange={(time) => {
                                    setHoraInicio(time);
                                }}
                                disabledTime={() => ({
                                    disabledHours: () => {
                                        return [0, 1, 2, 3, 4, 5, 6, 7, 8, 20, 21, 22, 23];
                                    },
                                    disabledMinutes: () => {
                                        const disabled = [];
                                        for (let i = 1; i < 60; i++) disabled.push(i);
                                        return disabled;
                                    }
                                })}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item
                            label="Hora Fin"
                            name="hora_fin"
                        >
                            <TimePicker 
                                style={{ width: '100%' }} 
                                format="h:mm A"
                                use12Hours
                                minuteStep={30}
                                showNow={false}
                                disabledTime={() => ({
                                    disabledHours: () => {
                                        return [0, 1, 2, 3, 4, 5, 6, 7, 8, 20, 21, 22, 23];
                                    },
                                    disabledMinutes: () => {
                                        const disabled = [];
                                        for (let i = 1; i < 60; i++) disabled.push(i);
                                        return disabled;
                                    }
                                })}
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item
                    name="nombre"
                    hidden
                    rules={[{ required: true }]}
                >
                    <Input />
                </Form.Item>

                <Row gutter={24}>
                    <Col span={16}>
                        <Form.Item
                            label="Descripción/Notas del Grupo"
                            name="descripcion" 
                        >
                            <Input.TextArea rows={2} placeholder="Información adicional del grupo" />
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
                        placeholder="Buscar profesor..."
                        showSearch
                        filterOption={(input, option) =>
                            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                        options={profesores.map(p => ({ 
                            label: p.nombre_completo, 
                            value: p.id 
                        }))}
                    />
                </Form.Item>

                <Row gutter={24}>
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

                    <Col span={8}>
                         <Form.Item 
                            label="Fecha Inicio" 
                            name="fecha_inicio"
                            rules={[{ required: true, message: "Selecciona la fecha de inicio" }]}
                         >
                            <DatePicker
                                style={{ width: '100%' }}
                                format="YYYY-MM-DD"
                                onChange={(value) => {
                                    setFechaInicio(value);
                                }}
                            />
                         </Form.Item>
                    </Col>
                    <Col span={8}>
                         <Form.Item label="Fecha Fin" name="fecha_fin">
                            <DatePicker style={{width: '100%'}} format="YYYY-MM-DD" />
                         </Form.Item>
                    </Col>
                </Row>



            </Form>
        </Create>
    );
}