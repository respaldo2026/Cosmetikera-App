"use client";

import React, { useEffect, useState, useRef } from "react";
import { useForm, useSelect } from "@refinedev/antd";
import { Form, Select, DatePicker, Input, Card, message, Alert, Button, Space, Divider, Modal, Col, Row, Descriptions, Result, Typography } from "antd";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { construirNombreGrupo } from "@utils/grupos";
import { BookOutlined, SearchOutlined, PlusOutlined, PrinterOutlined, DollarCircleOutlined, CheckCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { formatDate } from "@utils/date";
import { useRouter } from "next/navigation";
import { useColorMode } from "@/contexts/color-mode";
import { registrarIngresoDesdePago } from "@modules/finanzas/movimientos.service";
import { abrirTicketPagoDesdeBlob, generarTicketPagoBlob } from "@utils/pago-ticket";
import { subirTicketPago } from "@utils/ticket-storage";

const { Title, Text } = Typography;

const formatoCOP = (valor: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(valor);

const PORTAL_ESTUDIANTE_URL =
    process.env.NEXT_PUBLIC_PORTAL_ESTUDIANTE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://app.academiacrystal.com";

export default function MatriculaCreate() {
    const router = useRouter();
    const { formProps, saveButtonProps, onFinish } = useForm({ redirect: false });
    const printRef = useRef<HTMLDivElement>(null);
    const { mode } = useColorMode();
    const isDark = mode === "dark";

    // Estados para fase 1: crear inscripción
    const [cuposInfo, setCuposInfo] = useState<{ ocupados: number; total: number } | null>(null);
    const [checking, setChecking] = useState(false);
    const [searchingStudent, setSearchingStudent] = useState(false);
    const [studentFound, setStudentFound] = useState<any>(null);
    const [identificacionBuscar, setIdentificacionBuscar] = useState("");
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [creatingStudent, setCreatingStudent] = useState(false);
    const [programaSeleccionado, setProgramaSeleccionado] = useState<string | undefined>(undefined);
    const [createForm] = Form.useForm();
    const [cursoOptions, setCursoOptions] = useState<{ label: string; value: string | number }[]>([]);
    const [cursosLoading, setCursosLoading] = useState(false);

    // Estados para fase 2: inscripción creada, mostrando recibo y pago
    const [inscripcionCreada, setInscripcionCreada] = useState(false);
    const [matriculaData, setMatriculaData] = useState<any>(null);
    const [estudianteData, setEstudianteData] = useState<any>(null);
    const [cursoData, setCursoData] = useState<any>(null);
    const [pagoInscripcionData, setPagoInscripcionData] = useState<any>(null);
    const [procesandoPago, setProcesandoPago] = useState(false);
    const [creatingMatricula, setCreatingMatricula] = useState(false);
    const [pagoForm] = Form.useForm();
    const [mediosPago, setMediosPago] = useState<any[]>([]);

    const asegurarPagosGenerados = async (
        matriculaId: string,
        estudianteId: string,
        cursoId: string | number,
        fechaInicio?: string | null,
    ) => {
        const { data: pagosExistentes, error: errPagosExistentes } = await supabaseBrowserClient
            .from("pagos")
            .select("numero_cuota, periodo_pagado")
            .eq("matricula_id", matriculaId);

        if (errPagosExistentes) {
            throw errPagosExistentes;
        }

        const cuotasExistentes = new Set<number>();
        let inscripcionExiste = false;

        (pagosExistentes || []).forEach((pago: any) => {
            const numeroCuota = Number(pago?.numero_cuota);
            if (Number.isFinite(numeroCuota)) {
                cuotasExistentes.add(numeroCuota);
            }

            const textoPeriodo = String(pago?.periodo_pagado || "").toLowerCase();
            if (numeroCuota === 0 || textoPeriodo.includes("inscrip")) {
                inscripcionExiste = true;
            }
        });

        const { data: cursoInfo, error: errCursoInfo } = await supabaseBrowserClient
            .from("cursos")
            .select("id, fecha_inicio, precio_mensualidad, numero_cuotas, duracion, programas(precio_inscripcion, precio_mensualidad, precio_curso, numero_cuotas)")
            .eq("id", cursoId)
            .single();

        if (errCursoInfo || !cursoInfo) {
            throw new Error("No se pudo cargar la configuración financiera del curso");
        }

        const programa: any = Array.isArray((cursoInfo as any)?.programas)
            ? (cursoInfo as any).programas[0]
            : (cursoInfo as any)?.programas;

        const precioInscripcion = Number(
            programa?.precio_inscripcion ?? 0
        ) || 0;

        const precioMensualidad = Number(
            (cursoInfo as any)?.precio_mensualidad ??
            programa?.precio_mensualidad ??
            programa?.precio_curso ??
            0
        ) || 0;

        let numeroCuotas = Number(
            (cursoInfo as any)?.numero_cuotas ??
            programa?.numero_cuotas ??
            (cursoInfo as any)?.duracion ??
            4
        ) || 4;

        if (numeroCuotas < 1) numeroCuotas = 1;

        const fechaBase = dayjs(fechaInicio || (cursoInfo as any)?.fecha_inicio || dayjs().format("YYYY-MM-DD"));

        const nuevosPagos: any[] = [];

        if (precioInscripcion > 0 && !inscripcionExiste) {
            nuevosPagos.push({
                estudiante_id: estudianteId,
                matricula_id: matriculaId,
                numero_cuota: 0,
                periodo_pagado: "Inscripción",
                monto: precioInscripcion,
                estado: "pendiente",
                metodo_pago: null,
                fecha_vencimiento: fechaBase.format("YYYY-MM-DD"),
                observaciones: "Pago de inscripción",
            });
        }

        if (precioMensualidad > 0) {
            for (let i = 1; i <= numeroCuotas; i += 1) {
                if (cuotasExistentes.has(i)) continue;

                nuevosPagos.push({
                    estudiante_id: estudianteId,
                    matricula_id: matriculaId,
                    numero_cuota: i,
                    periodo_pagado: `Cuota ${i} de ${numeroCuotas}`,
                    monto: precioMensualidad,
                    estado: "pendiente",
                    metodo_pago: null,
                    fecha_vencimiento: fechaBase.add(i, "month").format("YYYY-MM-DD"),
                    observaciones: `Cuota mensual ${i} de ${numeroCuotas}`,
                });
            }
        }

        if (nuevosPagos.length > 0) {
            const { error: errInsertPagos } = await supabaseBrowserClient
                .from("pagos")
                .insert(nuevosPagos);

            if (errInsertPagos) {
                throw errInsertPagos;
            }
        }
    };

    const { selectProps: programaSelectProps } = useSelect({
        resource: "programas",
        optionLabel: "nombre",
        optionValue: "id",
        filters: [{ field: "activo", operator: "eq", value: true }],
    });

    // Cargar medios de pago
    useEffect(() => {
        const cargarMediosPago = async () => {
            const { data } = await supabaseBrowserClient
                .from("medios_pago")
                .select("*")
                .eq("activo", true)
                .order("orden", { ascending: true });
            
            setMediosPago(data || []);
        };
        cargarMediosPago();
    }, []);

    useEffect(() => {
        const loadCursos = async () => {
            if (!programaSeleccionado) {
                setCursoOptions([]);
                return;
            }

            setCursosLoading(true);
            try {
                // Primero obtenemos los cursos
                const { data: cursosData, error } = await supabaseBrowserClient
                    .from("cursos")
                    .select("id, nombre, cupos, fecha_inicio, estado, programa_id, dias_semana, hora_inicio, hora_fin, programas(nombre)")
                    .eq("programa_id", programaSeleccionado)
                    .in("estado", ["activo", "proximo"])
                    .order("fecha_inicio", { ascending: true, nullsFirst: true });

                if (error) throw error;

                // Luego contamos matrículas activas para cada curso
                const cursosConConteo = await Promise.all(
                    (cursosData || []).map(async (curso: any) => {
                        const { count } = await supabaseBrowserClient
                            .from("matriculas")
                            .select("*", { count: "exact", head: true })
                            .eq("curso_id", curso.id)
                            .neq("estado", "cancelado");
                        
                        return {
                            ...curso,
                            inscritos: count || 0
                        };
                    })
                );

                const today = dayjs();
                const mapped = cursosConConteo
                    .map((curso: any) => {
                        const inscritos = curso.inscritos;
                        const cupos = curso?.cupos ?? 0;
                        const disponibles = cupos - inscritos;
                        if (disponibles <= 0) return null;

                        const fechaLabel = curso?.fecha_inicio ? formatDate(curso.fecha_inicio) : "Sin fecha";
                        const esProximo = curso?.fecha_inicio && dayjs(curso.fecha_inicio).diff(today, "day") <= 14;
                        const badge = esProximo ? "[Próximo] " : "";
                        const nombreGrupo = construirNombreGrupo(curso);
                        return {
                            value: curso.id,
                            label: `${badge}${nombreGrupo} · ${fechaLabel} · cupos ${disponibles}`,
                        };
                    })
                    .filter(Boolean) as { label: string; value: string | number }[];

                setCursoOptions(mapped);
            } catch (err) {
                console.error("No se pudieron cargar los cursos disponibles", err);
                setCursoOptions([]);
            } finally {
                setCursosLoading(false);
            }
        };

        loadCursos();
    }, [programaSeleccionado]);

    const handleBuscarEstudiante = async () => {
        if (!identificacionBuscar.trim()) {
            message.warning("Ingresa un número de identificación");
            return;
        }

        setSearchingStudent(true);
        setStudentFound(null);

        try {
            const { data, error } = await supabaseBrowserClient
                .from("perfiles")
                .select("id,nombre_completo,email,telefono,identificacion,rol")
                .eq("identificacion", identificacionBuscar.trim())
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setStudentFound(data);
                formProps.form?.setFieldValue("estudiante_id", data.id);
                if (data.rol !== 'estudiante') {
                    message.warning(`Usuario encontrado con rol: ${data.rol}. Se procederá a matricular.`);
                } else {
                    message.success(`Estudiante encontrado: ${data.nombre_completo}`);
                }
            } else {
                message.info("No se encontró estudiante con esa identificación");
                createForm.setFieldsValue({ identificacion: identificacionBuscar });
                setCreateModalOpen(true);
            }
        } catch (e: any) {
            message.error(e?.message || "Error buscando estudiante");
        } finally {
            setSearchingStudent(false);
        }
    };

    const handleCrearEstudiante = async (values: any) => {
        const identificacion = String(values.identificacion || "").trim();
        const email = (values.email || `${identificacion}@academia.local`).trim();
        const password = identificacion.replace(/\./g, "");

        try {
            setCreatingStudent(true);

            const { count } = await supabaseBrowserClient
                .from("perfiles")
                .select("*", { count: "exact", head: true })
                .eq("identificacion", identificacion);

            if ((count || 0) > 0) {
                message.error("Ya existe un estudiante con esa identificación");
                return;
            }

            // Crear usuario + perfil con service role para asegurar que se guarde identificación
            const response = await fetch("/api/create-user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    password: password || identificacion,
                    rol: "estudiante",
                    user_metadata: {
                        identificacion,
                        nombre_completo: values.nombre_completo,
                        telefono: values.telefono,
                        email,
                        fecha_nacimiento: values.fecha_nacimiento ? dayjs(values.fecha_nacimiento).format("YYYY-MM-DD") : null,
                        genero: values.genero || null,
                        talla_camiseta: values.talla_camiseta || null,
                        direccion: values.direccion || null,
                        acudiente_nombre: values.acudiente_nombre || null,
                        acudiente_telefono: values.acudiente_telefono || null,
                        observaciones: values.observaciones || null,
                        activo: true,
                        notif_whatsapp: true,
                    },
                }),
            });

            const result = await response.json();

            const userId = result?.user?.id || result?.data?.user?.id;
            const perfilFromApi = result?.perfil;

            if (!response.ok || !userId) {
                throw new Error(result?.error || "Error al crear el estudiante");
            }

            // Semilla mínima para continuar el flujo aunque no podamos leer perfil (RLS)
            let perfil: any = perfilFromApi || {
                id: userId,
                nombre_completo: values.nombre_completo,
                identificacion,
                telefono: values.telefono,
                email,
            };

            // Intentar leer el perfil real; si falla, usar la semilla
            const getPerfil = async () => {
                const { data, error } = await supabaseBrowserClient
                    .from("perfiles")
                    .select("*")
                    .eq("id", userId)
                    .maybeSingle();

                if (error) {
                    console.warn("No se pudo leer perfil, se usará la semilla:", error.message);
                    return null;
                }
                return data;
            };

            if (!perfilFromApi) {
                const perfilDb = await getPerfil();
                if (!perfilDb) {
                    await new Promise((resolve) => setTimeout(resolve, 600));
                    perfilDb ?? (await getPerfil());
                }
                if (perfilDb) perfil = perfilDb;
            }

            setStudentFound(perfil);
            formProps.form?.setFieldValue("estudiante_id", perfil.id);
            setCreateModalOpen(false);
            createForm.resetFields();
            message.success("Estudiante creado correctamente");
        } catch (e: any) {
            console.error("Error creando estudiante:", e);
            message.error(e?.message || "Error creando estudiante");
        } finally {
            setCreatingStudent(false);
        }
    };

    const handleCursoChange = async (cursoId: string | number) => {
        if (!cursoId) return;

        const cursoIdNumber = typeof cursoId === "string" ? Number(cursoId) : cursoId;

        setChecking(true);
        setCuposInfo(null);

        try {
            const { data: curso, error: errCurso } = await supabaseBrowserClient
                .from("cursos")
                .select("cupos, nombre, programa_id")
                .eq("id", cursoIdNumber)
                .single();

            if (errCurso) throw errCurso;

            if (curso?.programa_id) {
                setProgramaSeleccionado(String(curso.programa_id));
                formProps.form?.setFieldValue("programa_id", curso.programa_id);
            }

            const { count, error: errCount } = await supabaseBrowserClient
                .from("matriculas")
                .select("*", { count: "exact", head: true })
                .eq("curso_id", cursoIdNumber)
                .neq("estado", "cancelado");

            if (errCount) throw errCount;

            setCuposInfo({
                ocupados: count || 0,
                total: curso?.cupos || 20,
            });
        } catch (error) {
            console.error("Error verificando cupos:", error);
        } finally {
            setChecking(false);
        }
    };

    const handleOnFinish = async (values: any) => {
        console.log("=== INICIANDO handleOnFinish ===", values);
        const { estudiante_id, curso_id, fecha_inicio, observaciones } = values || {};

        console.log("Validando estudiante_id:", estudiante_id);
        if (!estudiante_id) {
            message.error("⚠️ Debes buscar o crear un estudiante primero.");
            return;
        }

        console.log("Validando curso_id:", curso_id);
        if (!curso_id) {
            message.error("⚠️ Debes seleccionar un curso.");
            return;
        }

        console.log("Validando cupos:", cuposInfo);
        if (cuposInfo && cuposInfo.ocupados >= cuposInfo.total) {
            message.error("⛔ ¡El curso está lleno! No se puede matricular.");
            return;
        }

        console.log("Verificando matrícula existente...");
        const { count, error: errCountMatricula } = await supabaseBrowserClient
            .from("matriculas")
            .select("id", { count: "exact", head: true })
            .eq("estudiante_id", estudiante_id)
            .eq("curso_id", curso_id);

        if (errCountMatricula) {
            console.error("Error verificando matrícula existente:", errCountMatricula);
        }

        console.log("Resultado conteo matrícula existente:", count);

        if ((count || 0) > 0) {
            message.warning("⚠️ Ya existe una matrícula para este estudiante. Abriendo el paso de pago.");

            const { data: matriculaExistente, error: errMatExistente } = await supabaseBrowserClient
                .from("matriculas")
                .select(`*, cursos(*, programas(*))`)
                .eq("estudiante_id", estudiante_id)
                .eq("curso_id", curso_id)
                .neq("estado", "cancelado")
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (errMatExistente || !matriculaExistente?.id) {
                console.error("Error cargando matrícula existente:", errMatExistente);
                message.error("❌ No se pudo cargar la matrícula existente.");
                return;
            }

            const { data: estudiante } = await supabaseBrowserClient
                .from("perfiles")
                .select("*")
                .eq("id", estudiante_id)
                .single();

            const { data: pagoInscripcion } = await supabaseBrowserClient
                .from("pagos")
                .select("*")
                .eq("matricula_id", matriculaExistente.id)
                .eq("numero_cuota", 0)
                .maybeSingle();

            setMatriculaData(matriculaExistente);
            setEstudianteData(estudiante);
            setCursoData(matriculaExistente?.cursos);
            setPagoInscripcionData(pagoInscripcion);
            setInscripcionCreada(true);

            const montoInscripcion = pagoInscripcion?.monto || matriculaExistente?.cursos?.programas?.precio_inscripcion || 50000;
            pagoForm.setFieldsValue({
                monto: montoInscripcion,
                fecha_pago: dayjs()
            });

            return;
        }

        const payload = { estudiante_id, curso_id, fecha_inicio, estado: "pendiente", observaciones, tipo_pago: "cuotas" };
        console.log("Payload matrícula:", payload);

        try {
            setCreatingMatricula(true);

            console.log("Insertando matrícula...");
            const { data: matriculaCreada, error: errInsert } = await supabaseBrowserClient
                .from("matriculas")
                .insert([payload])
                .select("id")
                .single();

            if (errInsert) {
                console.error("Error insertando matrícula:", errInsert);
                if ((errInsert as any)?.code === "42703" && String((errInsert as any)?.message || "").includes("numero_cuotas")) {
                    message.error("⚠️ Falta actualizar el trigger de cuotas en Supabase. Ejecuta el script: fix-trigger-matriculas-numero-cuotas.sql");
                    return;
                }
                throw errInsert;
            }

            const matriculaId = matriculaCreada?.id;

            if (!matriculaId) {
                console.error("No se obtuvo ID de matrícula");
                throw new Error("No se pudo obtener el ID de la matrícula creada");
            }

            console.log("Matrícula creada con ID:", matriculaId);
            message.success("✅ Inscripción académica registrada");

            try {
                await asegurarPagosGenerados(matriculaId, estudiante_id, curso_id, fecha_inicio);
            } catch (errPago: any) {
                console.error("Error asegurando pagos pendientes:", errPago);
                message.warning("Se creó la matrícula, pero no se pudieron generar todas las cuotas automáticamente.");
            }

            // Cargar datos completos para mostrar el recibo
            const { data: matricula } = await supabaseBrowserClient
                .from("matriculas")
                .select(`*, cursos(*, programas(*))`)
                .eq("id", matriculaId)
                .single();

            const { data: estudiante } = await supabaseBrowserClient
                .from("perfiles")
                .select("*")
                .eq("id", estudiante_id)
                .single();

            const { data: pagoInscripcion } = await supabaseBrowserClient
                .from("pagos")
                .select("*")
                .eq("matricula_id", matriculaId)
                .eq("numero_cuota", 0)
                .maybeSingle();

            setMatriculaData(matricula);
            setEstudianteData(estudiante);
            setCursoData(matricula?.cursos);
            setPagoInscripcionData(pagoInscripcion);
            setInscripcionCreada(true);

            // Inicializar formulario de pago
            const montoInscripcion = pagoInscripcion?.monto || matricula?.cursos?.programas?.precio_inscripcion || 50000;
            pagoForm.setFieldsValue({
                monto: montoInscripcion,
                fecha_pago: dayjs()
            });

        } catch (error: any) {
            console.error("Error creando matrícula:", error);
            message.error("❌ Error al crear la matrícula. Por favor intenta de nuevo.");
        } finally {
            setCreatingMatricula(false);
        }
    };

    const handleRegistrarPago = async (values: any) => {
        try {
            setProcesandoPago(true);

            const { monto, metodo_pago, referencia, fecha_pago } = values;
            const montoNumero = Number(monto ?? 0) || 0;
            const fechaPagoISO = fecha_pago ? dayjs(fecha_pago).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD");
            const fechaPagoLegible = dayjs(fechaPagoISO).format("DD/MM/YYYY");

            // Actualizar el pago de inscripción
            const { error: errUpdate } = await supabaseBrowserClient
                .from("pagos")
                .update({
                    estado: "pagado",
                    monto: montoNumero,
                    metodo_pago: metodo_pago,
                    referencia: referencia || null,
                    fecha_pago: fechaPagoISO,
                    observaciones: `Pago registrado el ${dayjs().format("DD/MM/YYYY HH:mm")}`
                })
                .eq("id", pagoInscripcionData.id);

            if (errUpdate) throw errUpdate;

            // Activar la matrícula
            const { error: errMat } = await supabaseBrowserClient
                .from("matriculas")
                .update({ estado: "activo" })
                .eq("id", matriculaData.id);

            if (errMat) throw errMat;

            let ticketUrl: string | null = null;

            try {
                const { data: configAcademia } = await supabaseBrowserClient
                    .from("configuracion")
                    .select("*")
                    .order("updated_at", { ascending: false, nullsFirst: false })
                    .order("created_at", { ascending: false, nullsFirst: false })
                    .limit(1)
                    .maybeSingle();

                const ticketData = {
                    academia: {
                        nombre: configAcademia?.nombre_academia || "Academia Crystal Diamante",
                        ruc: configAcademia?.ruc || undefined,
                        logoUrl: configAcademia?.logo_url || undefined,
                        telefono: configAcademia?.telefono || configAcademia?.whatsapp || undefined,
                        direccion: configAcademia?.direccion || undefined,
                        email: configAcademia?.email || undefined,
                        ticketTitulo: configAcademia?.ticket_titulo || undefined,
                        ticketNota: configAcademia?.ticket_nota || undefined,
                        ticketPie: configAcademia?.ticket_pie || undefined,
                        ticketCampos: configAcademia?.ticket_campos || undefined,
                    },
                    estudiante: {
                        nombre: estudianteData?.nombre_completo || "Estudiante",
                        identificacion: estudianteData?.identificacion || undefined,
                        telefono: estudianteData?.telefono || undefined,
                    },
                    pago: {
                        referencia: referencia || pagoInscripcionData.id,
                        metodo: metodo_pago || "efectivo",
                        monto: montoNumero,
                        fecha: fechaPagoLegible,
                        concepto: `Inscripción - ${cursoData?.nombre ?? "Curso"}`,
                        periodo: "Inscripción",
                        numeroCuota: 0,
                    },
                    curso: {
                        nombre: cursoData?.nombre ?? "Curso",
                    },
                } as const;

                const blob = await generarTicketPagoBlob(ticketData);
                const placeholder = window.open("", "_blank");
                if (placeholder) {
                    abrirTicketPagoDesdeBlob(blob, placeholder);
                } else {
                    abrirTicketPagoDesdeBlob(blob);
                }

                const { publicUrl } = await subirTicketPago({
                    blob,
                    pagoId: pagoInscripcionData.id,
                    estudianteId: estudianteData?.id,
                });

                ticketUrl = publicUrl;

                await supabaseBrowserClient
                    .from("pagos")
                    .update({ ticket_url: publicUrl } as any)
                    .eq("id", pagoInscripcionData.id);
            } catch (ticketError) {
                console.error("Error generando/guardando ticket de inscripción:", ticketError);
                message.warning("Pago registrado, pero no se pudo generar el ticket PDF.");
            }

            try {
                await registrarIngresoDesdePago({
                    fecha: fechaPagoISO,
                    monto: montoNumero,
                    concepto: `Pago de inscripción - ${cursoData?.nombre ?? "Curso"}`,
                    categoria: "inscripciones",
                    metodo_pago: metodo_pago || null,
                    referencia: referencia || pagoInscripcionData.id,
                    descripcion: `Pago de inscripción de matrícula ${matriculaData?.id ?? ""}`,
                    estudiante_id: estudianteData?.id ?? null,
                    ticket_url: ticketUrl,
                    pago_id: pagoInscripcionData.id,
                    created_by: null,
                });
            } catch (movError) {
                console.error("Error registrando ingreso en tesorería (inscripción):", movError);
                message.warning("Pago registrado, pero no se pudo reflejar automáticamente en tesorería.");
            }

            message.success("✅ Pago registrado y matrícula activada");
            // Enviar confirmación de pago + bienvenida portal (solo al confirmar pago)
            if (estudianteData?.telefono && (estudianteData?.notif_whatsapp ?? true)) {
                try {
                    const { enviarConfirmacionPago, enviarBienvenidaPortalEstudiante } = await import('@/services/whatsapp-messages-module');
                    
                    const resultadoConfirmacion = await enviarConfirmacionPago(estudianteData.id, {
                        nombre: estudianteData.nombre_completo,
                        telefono: estudianteData.telefono,
                        referenciaPago: referencia || 'Contado',
                        monto: montoNumero,
                        fechaPago: dayjs().format('DD/MM/YYYY'),
                        concepto: 'Inscripción',
                        nombreCurso: cursoData?.nombre ?? 'Curso',
                        fechaVigencia: dayjs().add(1, 'month').format('DD/MM/YYYY'),
                        fechaProximaClase: cursoData?.fecha_inicio ? 
                            new Date(cursoData.fecha_inicio).toLocaleDateString('es-CO') : 'Por confirmar'
                    });

                    if (!resultadoConfirmacion.exito) {
                        message.warning('⚠️ Pago registrado, pero no se pudo enviar la confirmación por WhatsApp.');
                        console.error('Error enviando confirmación de pago:', resultadoConfirmacion.error);
                    }

                    await new Promise((resolve) => setTimeout(resolve, 1500));

                    const resultadoBienvenida = await enviarBienvenidaPortalEstudiante(estudianteData.id, {
                        nombre: estudianteData.nombre_completo,
                        telefono: estudianteData.telefono,
                        nombreCurso: cursoData?.nombre ?? 'Curso',
                        enlacePortal: PORTAL_ESTUDIANTE_URL,
                        usuario: (estudianteData.email || estudianteData.identificacion) || 'tu usuario registrado',
                        genero: estudianteData.genero ?? null,
                    });

                    if (!resultadoBienvenida.exito) {
                        message.warning('⚠️ Pago registrado y confirmación enviada, pero falló la bienvenida al portal.');
                        console.error('Error enviando bienvenida al portal:', resultadoBienvenida.error);
                    }
                } catch (error) {
                    message.warning('⚠️ Pago registrado, pero hubo un problema al enviar mensajes de WhatsApp.');
                    console.error('Error enviando mensajes post-pago:', error);
                }
            }

            setTimeout(() => {
                router.push(`/estudiantes/show/${estudianteData.id}`);
            }, 2000);
        } catch (error: any) {
            console.error("Error registrando pago:", error);
            message.error("Error al registrar el pago");
        } finally {
            setProcesandoPago(false);
        }
    };

    const handlePrint = () => {
        if (printRef.current) {
            const printWindow = window.open("", "_blank");
            if (printWindow) {
                printWindow.document.write(`
                    <html>
                        <head>
                            <title>Recibo de Inscripción</title>
                            <style>
                                body { font-family: Arial, sans-serif; padding: 20px; }
                                .header { text-align: center; margin-bottom: 30px; }
                                h3 { margin: 10px 0; }
                            </style>
                        </head>
                        <body>
                            ${printRef.current.innerHTML}
                        </body>
                    </html>
                `);
                printWindow.document.close();
                printWindow.print();
            }
        }
    };

    const isFull = cuposInfo ? cuposInfo.ocupados >= cuposInfo.total : false;
    const disponibilidad = cuposInfo ? cuposInfo.total - cuposInfo.ocupados : 0;

    // Fase 1: Formulario de inscripción académica
    if (!inscripcionCreada) {
        return (
            <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px" }}>
                <Title level={2}>📝 Nueva Matrícula - Paso 1: Inscripción Académica</Title>

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

                <Form {...formProps} form={formProps.form} layout="vertical" onFinish={handleOnFinish}>
                    <Card title="1. Buscar o Crear Estudiante" style={{ marginBottom: 20 }}>
                        <Space.Compact style={{ width: "100%", marginBottom: 16 }}>
                            <Input
                                placeholder="Número de identificación"
                                value={identificacionBuscar}
                                onChange={(e) => setIdentificacionBuscar(e.target.value)}
                                onPressEnter={handleBuscarEstudiante}
                                prefix={<SearchOutlined />}
                            />
                            <Button type="primary" onClick={handleBuscarEstudiante} loading={searchingStudent}>
                                Buscar
                            </Button>
                        </Space.Compact>

                        {studentFound && (
                            <Alert
                                type="success"
                                message={`Estudiante: ${studentFound.nombre_completo}`}
                                description={`ID: ${studentFound.identificacion} · Tel: ${studentFound.telefono || "N/A"}`}
                                showIcon
                            />
                        )}

                        <Form.Item name="estudiante_id" hidden>
                            <Input />
                        </Form.Item>
                    </Card>

                    <Divider />

                    <Card title="2. Seleccionar Programa y Curso" style={{ marginBottom: 20 }}>
                        <Row gutter={16}>
                            <Col xs={24} md={12}>
                                <Form.Item
                                    label="Programa"
                                    name="programa_id"
                                    rules={[{ required: true, message: "Selecciona un programa" }]}
                                >
                                    <Select
                                        {...programaSelectProps}
                                        placeholder="Selecciona el programa..."
                                        onChange={(value) => {
                                            setProgramaSeleccionado(value as unknown as string);
                                            setCuposInfo(null);
                                            formProps.form?.setFieldValue("curso_id", undefined);
                                        }}
                                    />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item
                                    label="Curso a inscribir"
                                    name="curso_id"
                                    rules={[{ required: true, message: "Selecciona un curso" }]}
                                >
                                    <Select
                                        options={cursoOptions}
                                        loading={cursosLoading || checking}
                                        placeholder={programaSeleccionado ? "Selecciona el curso..." : "Primero elige un programa"}
                                        disabled={!programaSeleccionado}
                                        onChange={(val) => handleCursoChange(val as string)}
                                        suffixIcon={<BookOutlined />}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                    </Card>

                    <Card title="3. Detalles">
                        <Row gutter={16}>
                            <Col xs={24} md={12}>
                                <Form.Item
                                    label="Fecha de Inicio"
                                    name="fecha_inicio"
                                    initialValue={dayjs()}
                                    getValueProps={(value) => ({
                                        value: value ? dayjs(value) : null,
                                    })}
                                    getValueFromEvent={(value) => value ? dayjs(value).format("YYYY-MM-DD") : null}
                                >
                                    <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item label="Observaciones / Notas" name="observaciones">
                                    <Input.TextArea rows={2} placeholder="Ej: Trae documentos pendientes..." />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Button type="primary" htmlType="submit" size="large" block loading={creatingMatricula || saveButtonProps.loading}>
                            Crear Inscripción Académica
                        </Button>
                    </Card>
                </Form>

                <Modal
                    title={<span style={{ color: "#f8fafc", fontWeight: 600 }}>Crear Nuevo Estudiante</span>}
                    open={createModalOpen}
                    styles={{
                        mask: { backdropFilter: "blur(8px)", backgroundColor: "rgba(0,0,0,0.65)" },
                        content: {
                            backgroundColor: "#111a2d",
                            border: "1px solid #233044",
                            boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
                            color: "#e2e8f0",
                        },
                        header: { backgroundColor: "#111a2d", borderBottom: "1px solid #233044", color: "#e2e8f0" },
                        body: { backgroundColor: "#111a2d", color: "#e2e8f0" },
                    }}
                    onCancel={() => {
                        setCreateModalOpen(false);
                        createForm.resetFields();
                    }}
                    footer={null}
                >
                    <Form form={createForm} layout="vertical" onFinish={handleCrearEstudiante}>
                        <Form.Item
                            name="identificacion"
                            label={<span style={{ color: "#e2e8f0" }}>Identificación</span>}
                            rules={[{ required: true }]}
                        >
                            <Input />
                        </Form.Item>
                        <Form.Item
                            name="nombre_completo"
                            label={<span style={{ color: "#e2e8f0" }}>Nombre Completo</span>}
                            rules={[{ required: true }]}
                        >
                            <Input />
                        </Form.Item>
                        <Form.Item
                            name="email"
                            label={<span style={{ color: "#e2e8f0" }}>Email</span>}
                        >
                            <Input type="email" />
                        </Form.Item>
                        <Form.Item
                            name="telefono"
                            label={<span style={{ color: "#e2e8f0" }}>Teléfono</span>}
                            rules={[{ required: true }]}
                        >
                            <Input />
                        </Form.Item>
                        <Form.Item
                            name="fecha_nacimiento"
                            label={<span style={{ color: "#e2e8f0" }}>Fecha de Nacimiento</span>}
                        >
                            <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
                        </Form.Item>
                        <Form.Item
                            name="genero"
                            label={<span style={{ color: "#e2e8f0" }}>Género</span>}
                        >
                            <Select
                                options={[
                                    { label: "Femenino", value: "Femenino" },
                                    { label: "Masculino", value: "Masculino" },
                                    { label: "Otro", value: "Otro" },
                                ]}
                                placeholder="Selecciona género"
                            />
                        </Form.Item>
                        <Form.Item
                            name="talla_camiseta"
                            label={<span style={{ color: "#e2e8f0" }}>Talla de camiseta</span>}
                        >
                            <Select
                                options={["XS","S","M","L","XL","XXL"].map((t) => ({ label: t, value: t }))}
                                placeholder="Selecciona talla"
                            />
                        </Form.Item>
                        <Form.Item
                            name="direccion"
                            label={<span style={{ color: "#e2e8f0" }}>Dirección</span>}
                        >
                            <Input.TextArea rows={2} />
                        </Form.Item>
                        <Form.Item
                            name="acudiente_nombre"
                            label={<span style={{ color: "#e2e8f0" }}>Nombre del acudiente</span>}
                        >
                            <Input />
                        </Form.Item>
                        <Form.Item
                            name="acudiente_telefono"
                            label={<span style={{ color: "#e2e8f0" }}>Teléfono del acudiente</span>}
                        >
                            <Input />
                        </Form.Item>
                        <Form.Item
                            name="observaciones"
                            label={<span style={{ color: "#e2e8f0" }}>Observaciones</span>}
                        >
                            <Input.TextArea rows={2} />
                        </Form.Item>
                        <Form.Item>
                            <Space>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    icon={<PlusOutlined />}
                                    loading={creatingStudent}
                                >
                                    Crear Estudiante
                                </Button>
                                <Button onClick={() => {
                                    setCreateModalOpen(false);
                                    createForm.resetFields();
                                }}>
                                    Cancelar
                                </Button>
                            </Space>
                        </Form.Item>
                    </Form>
                </Modal>
            </div>
        );
    }

    // Fase 2: Recibo y pago
    const yaPagado = pagoInscripcionData?.estado === "pagado";
    const montoInscripcion = pagoInscripcionData?.monto || cursoData?.programas?.precio_inscripcion || 50000;

    return (
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px" }}>
            <Title level={2}>
                {yaPagado ? "✅ Inscripción Completa" : "💰 Paso 2: Pago de Inscripción"}
            </Title>

            {!yaPagado && (
                <Alert
                    message="Inscripción Académica Registrada ✅"
                    description="Ahora completa el pago de inscripción para activar la matrícula."
                    type="success"
                    showIcon
                    style={{ marginBottom: 20 }}
                />
            )}

            <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                    <Card
                        title="📄 Recibo de Inscripción"
                        extra={
                            <Button icon={<PrinterOutlined />} onClick={handlePrint}>
                                Imprimir
                            </Button>
                        }
                    >
                        <div ref={printRef}>
                            <div style={{ textAlign: "center", marginBottom: 30 }}>
                                <Title level={3}>Academia Crystal Diamante</Title>
                                <Text>Recibo de Inscripción</Text>
                                <br />
                                <Text type="secondary">Fecha: {dayjs().format("DD/MM/YYYY")}</Text>
                            </div>

                            <Divider />

                            <Descriptions column={1} bordered size="small">
                                <Descriptions.Item label="Estudiante">
                                    {estudianteData?.nombre_completo}
                                </Descriptions.Item>
                                <Descriptions.Item label="Identificación">
                                    {estudianteData?.identificacion}
                                </Descriptions.Item>
                                <Descriptions.Item label="Programa">
                                    {cursoData?.programas?.nombre}
                                </Descriptions.Item>
                                <Descriptions.Item label="Curso">
                                    {cursoData?.nombre}
                                </Descriptions.Item>
                                <Descriptions.Item label="Fecha Inicio">
                                    {matriculaData?.fecha_inicio ? dayjs(matriculaData.fecha_inicio).format("DD/MM/YYYY") : "Por definir"}
                                </Descriptions.Item>
                            </Descriptions>

                            <Divider />

                            <div style={{ padding: "20px", background: yaPagado ? "#f6ffed" : "#fff7e6", borderRadius: 8 }}>
                                <Space direction="vertical" style={{ width: "100%" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <Text strong>Inscripción:</Text>
                                        <Text strong style={{ fontSize: 18 }}>
                                            ${montoInscripcion.toLocaleString()}
                                        </Text>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <Text strong>Estado:</Text>
                                        <Text strong style={{ color: yaPagado ? "green" : "red" }}>
                                            {yaPagado ? "✅ PAGADO" : "⏳ PENDIENTE"}
                                        </Text>
                                    </div>
                                </Space>
                            </div>
                        </div>
                    </Card>
                </Col>

                <Col xs={24} md={12}>
                    {!yaPagado ? (
                        <Card title={<><DollarCircleOutlined /> Registrar Pago</>}>
                            <Form
                                form={pagoForm}
                                layout="vertical"
                                onFinish={handleRegistrarPago}
                            >
                                <Form.Item
                                    label="Monto Pagado"
                                    name="monto"
                                    rules={[{ required: true, message: "Ingresa el monto" }]}
                                >
                                    <Input prefix="$" type="number" />
                                </Form.Item>

                                <Form.Item
                                    label="Método de Pago"
                                    name="metodo_pago"
                                    rules={[{ required: true, message: "Selecciona el método" }]}
                                >
                                    <Select placeholder="Selecciona el medio de pago">
                                        {mediosPago.map((medio) => (
                                            <Select.Option key={medio.codigo} value={medio.codigo}>
                                                {medio.nombre}
                                            </Select.Option>
                                        ))}
                                    </Select>
                                </Form.Item>

                                <Form.Item label="Referencia" name="referencia">
                                    <Input placeholder="Ej: TRANS123456" />
                                </Form.Item>

                                <Form.Item
                                    label="Fecha de Pago"
                                    name="fecha_pago"
                                    rules={[{ required: true, message: "Selecciona la fecha" }]}
                                >
                                    <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
                                </Form.Item>

                                <Form.Item>
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        block
                                        size="large"
                                        loading={procesandoPago}
                                        icon={<CheckCircleOutlined />}
                                    >
                                        Confirmar Pago y Activar Matrícula
                                    </Button>
                                </Form.Item>
                            </Form>
                        </Card>
                    ) : (
                        <Result
                            status="success"
                            title="¡Matrícula Activada!"
                            subTitle="El pago ha sido registrado correctamente."
                            extra={[
                                <Button key="perfil" type="primary" onClick={() => router.push(`/estudiantes/show/${estudianteData.id}`)}>
                                    Ver Perfil del Estudiante
                                </Button>
                            ]}
                        />
                    )}
                </Col>
            </Row>
        </div>
    );
}
