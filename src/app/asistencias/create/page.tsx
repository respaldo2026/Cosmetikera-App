"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Form, DatePicker, Card, Table, Switch, Button, Row, Col, Alert, Tag, Space, Statistic, Typography, Spin, App, Input, Grid, Select } from "antd";
import { CheckOutlined, CloseOutlined, ArrowLeftOutlined, SaveOutlined, ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { useRouter } from "next/navigation";
import { buildWhatsappFallbackMessage } from "@/constants/whatsappTemplates";
import { useSearchParams } from "next/navigation";
import { formatDate } from "@utils/date";

const { Title, Text } = Typography;

export default function TomarAsistencia() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cursoSeleccionado, setCursoSeleccionado] = useState<number | null>(null);
  const [fecha, setFecha] = useState(dayjs());
  const [alumnos, setAlumnos] = useState<any[]>([]);
  const [loadingAlumnos, setLoadingAlumnos] = useState(false);
  const [cursoNombre, setCursoNombre] = useState<string>("");
  const [cursos, setCursos] = useState<any[]>([]);
  const [temaVisto, setTemaVisto] = useState("");
  const [numeroClase, setNumeroClase] = useState<number | null>(null);
  const [clasesDisponibles, setClasesDisponibles] = useState<Array<{ numero: number; nombre: string }>>([]);
  
  // Estado local para guardar la asistencia antes de enviarla
  // Formato: { "id_matricula": "presente", ... }
  const [asistenciasMap, setAsistenciasMap] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const cursoIdParam = searchParams.get("curso_id") || searchParams.get("cursoId");
  const returnTo = useMemo(
    () => searchParams.get("return") || (cursoIdParam ? `/cursos/show/${cursoIdParam}` : "/cursos"),
    [cursoIdParam, searchParams]
  );

  const extractTotalClases = useCallback((value: unknown): number | null => {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return Math.floor(asNumber);
    }

    const text = String(value || "").trim();
    if (!text) return null;

    const match = text.match(/(\d{1,3})\s*clases?/i) || text.match(/^(\d{1,3})$/);
    if (!match?.[1]) return null;

    const parsed = Number(match[1]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, []);

  // Cargar cursos al inicio
  useEffect(() => {
    const cargarCursos = async () => {
      const { data } = await supabaseBrowserClient
        .from("cursos")
        .select("id, nombre, profesor_id, total_clases, programa_id, programas(id, nombre, total_clases, duracion)")
        .eq("estado", "activo");
      setCursos(data || []);
    };
    cargarCursos();
  }, []);

  // Preseleccionar curso desde la URL (dentro del grupo)
  useEffect(() => {
    if (cursoIdParam) {
      const id = Number(cursoIdParam);
      setCursoSeleccionado(id);

      const nombreParam = searchParams.get("curso_nombre") || searchParams.get("cursoNombre");
      if (nombreParam) {
        setCursoNombre(nombreParam);
      } else {
        const cursoInfo = cursos.find((c) => c.id === id);
        if (cursoInfo?.nombre) {
          setCursoNombre(cursoInfo.nombre);
        }
      }
    } else if (cursos.length > 0) {
      message.warning("Debes abrir asistencia desde un curso específico.");
      router.push("/cursos");
    }
  }, [searchParams, cursos, cursoIdParam, message, router]);

  // Cargar Alumnos cuando cambia el curso
  useEffect(() => {
    if (!cursoSeleccionado) {
      setAlumnos([]);
      return;
    }

    const cargarClase = async () => {
      setLoadingAlumnos(true);
      try {
        // Buscamos matriculas ACTIVAS de este curso
        const { data, error } = await supabaseBrowserClient
          .from("matriculas")
          .select(`id, estudiante_id, estado, perfiles(nombre_completo, email, telefono, notif_whatsapp)`) 
          .eq("curso_id", cursoSeleccionado)
          .order("perfiles(nombre_completo)");

        if (error) {
          message.error("Error cargando lista de clase");
        } else {
          setAlumnos(data || []);
          // Pre-llenar solo los habilitados con "presente"; deshabilitados quedan sin valor
          const inicial: any = {};
          data?.forEach((m: any) => {
            const habilitado = m.estado === "activo" || m.estado === "en curso";
            inicial[m.id] = habilitado ? "presente" : undefined;
          });
          setAsistenciasMap(inicial);
        }
      } catch (error) {
        console.error(error);
        message.error("Error cargando estudiantes");
      } finally {
        setLoadingAlumnos(false);
      }
    };

    cargarClase();
  }, [cursoSeleccionado, message]);

  useEffect(() => {
    if (!cursoSeleccionado) {
      setClasesDisponibles([]);
      setNumeroClase(null);
      setTemaVisto("");
      return;
    }

    setNumeroClase(null);
    setTemaVisto("");

    const cargarClasesTemario = async () => {
      try {
        const { data: cursoData, error: errorCurso } = await supabaseBrowserClient
          .from("cursos")
          .select("id, programa_id, total_clases, programas(id, total_clases, duracion)")
          .eq("id", cursoSeleccionado)
          .maybeSingle();

        if (errorCurso) {
          console.error(errorCurso);
          setClasesDisponibles([]);
          return;
        }

        let base: Array<{ numero: number; nombre: string }> = [];

        if (cursoData?.programa_id) {
          const { data: ciclosData, error: errorCiclos } = await supabaseBrowserClient
            .from("pensum")
            .select("id, numero_ciclo, orden")
            .eq("programa_id", Number(cursoData.programa_id))
            .eq("activo", true)
            .order("orden", { ascending: true });

          if (errorCiclos) {
            console.error(errorCiclos);
          }

          const ciclos = (ciclosData || []) as any[];
          const pensumIds = ciclos.map((c) => c.id).filter(Boolean);

          if (pensumIds.length > 0) {
            const { data: temasPrograma, error: errorTemasPrograma } = await supabaseBrowserClient
              .from("pensum_cursos")
              .select("id, nombre_curso, orden, pensum_id")
              .in("pensum_id", pensumIds);

            if (errorTemasPrograma) {
              console.error(errorTemasPrograma);
            } else {
              const ordenCicloByPensum = new Map<string, number>();
              ciclos.forEach((c) => {
                ordenCicloByPensum.set(
                  String(c.id),
                  Number(c?.orden || c?.numero_ciclo || 9999)
                );
              });

              const temasOrdenados = ((temasPrograma || []) as any[])
                .slice()
                .sort((a, b) => {
                  const cicloA = ordenCicloByPensum.get(String(a?.pensum_id || "")) ?? 9999;
                  const cicloB = ordenCicloByPensum.get(String(b?.pensum_id || "")) ?? 9999;
                  if (cicloA !== cicloB) return cicloA - cicloB;
                  const ordenA = Number(a?.orden || 9999);
                  const ordenB = Number(b?.orden || 9999);
                  if (ordenA !== ordenB) return ordenA - ordenB;
                  return String(a?.nombre_curso || "").localeCompare(String(b?.nombre_curso || ""), "es", { sensitivity: "base" });
                });

              base = temasOrdenados.map((item: any, index: number) => ({
                numero: index + 1,
                nombre: item?.nombre_curso || `Clase ${index + 1}`,
              }));
            }
          }
        }

        const uniqueByNumero = Array.from(
          new Map(base.map((item) => [item.numero, item])).values()
        ).sort((a, b) => a.numero - b.numero);

        setClasesDisponibles(uniqueByNumero);
      } catch (error) {
        console.error(error);
        setClasesDisponibles([]);
      }
    };

    cargarClasesTemario();
  }, [cursoSeleccionado]);

  const opcionesClase = useMemo(() => {
    if (clasesDisponibles.length > 0) {
      return clasesDisponibles.map((clase) => ({
        value: clase.numero,
        label: `Clase ${clase.numero} · ${clase.nombre}`,
      }));
    }

    const cursoActual = cursos.find((c) => Number(c.id) === Number(cursoSeleccionado));
    const totalDesdeCurso = extractTotalClases(cursoActual?.total_clases);
    const totalDesdePrograma = extractTotalClases(cursoActual?.programas?.total_clases);
    const totalDesdeDuracionPrograma = extractTotalClases(cursoActual?.programas?.duracion);
    const totalClasesPrograma = totalDesdeCurso || totalDesdePrograma || totalDesdeDuracionPrograma || 20;

    return Array.from({ length: totalClasesPrograma }, (_, i) => {
      const numero = i + 1;
      return { value: numero, label: `Clase ${numero}` };
    });
  }, [clasesDisponibles, cursos, cursoSeleccionado, extractTotalClases]);

  // Función para cambiar estado individual
  const toggleEstado = useCallback((matriculaId: number) => {
    setAsistenciasMap((prev) => ({
      ...prev,
      [matriculaId]: prev[matriculaId] === "presente" ? "ausente" : "presente",
    }));
  }, []);
  const columnasAlumnos = useMemo(
    () => [
      {
        title: "Estudiante",
        dataIndex: ["perfiles", "nombre_completo"],
        width: isMobile ? 210 : 320,
        ellipsis: true,
        render: (txt: string) => (
          <Text
            strong
            style={{
              display: "inline-block",
              maxWidth: "100%",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={txt || "Sin nombre"}
          >
            {txt || "Sin nombre"}
          </Text>
        ),
      },
      {
        title: "Email",
        dataIndex: ["perfiles", "email"],
        ellipsis: true,
        width: 250,
        responsive: ["md" as const],
      },
      {
        title: "Asistencia",
        align: "center" as const,
        width: isMobile ? 150 : 190,
        render: (_: any, record: any) => {
          const habilitado = record.estado === "activo" || record.estado === "en curso";
          const esPresente = asistenciasMap[record.id] === "presente";
          const estadoLabel = habilitado
            ? (esPresente ? "PRESENTE" : "AUSENTE")
            : (isMobile ? "PENDIENTE" : "PENDIENTE PAGO");

          return (
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "center",
                alignItems: "center",
                flexDirection: isMobile ? "column" : "row",
              }}
            >
              <Switch
                disabled={!habilitado}
                checked={esPresente}
                onChange={() => toggleEstado(record.id)}
                checkedChildren={<CheckOutlined />}
                unCheckedChildren={<CloseOutlined />}
              />
              <Tag color={habilitado ? (esPresente ? "success" : "error") : "default"} style={{ margin: 0 }}>
                {estadoLabel}
              </Tag>
            </div>
          );
        },
      },
    ],
    [asistenciasMap, isMobile, toggleEstado]
  );

  // Marcar todos como presentes
  const marcarTodoPresente = () => {
    const inicial: any = {};
    alumnos.forEach((m: any) => (inicial[m.id] = "presente"));
    setAsistenciasMap(inicial);
    message.success("Todos marcados como presentes");
  };

  // Marcar todos como ausentes
  const marcarTodoAusente = () => {
    const inicial: any = {};
    alumnos.forEach((m: any) => (inicial[m.id] = "ausente"));
    setAsistenciasMap(inicial);
    message.success("Todos marcados como ausentes");
  };

  // GUARDAR TODO EN LA BD
  const guardarAsistencia = async () => {
    if (!cursoSeleccionado || alumnos.length === 0) {
      message.warning("Selecciona un curso primero");
      return;
    }

    if (!numeroClase || Number(numeroClase) <= 0) {
      message.warning("Selecciona el número de la clase antes de guardar");
      return;
    }

    setGuardando(true);
    try {
      const cursoSeleccionadoData = cursos.find((c) => Number(c.id) === Number(cursoSeleccionado));
      const temaLimpio = temaVisto.trim();
      const fechaSesion = fecha.format("YYYY-MM-DD");
      const claseSeleccionada = clasesDisponibles.find((c) => Number(c.numero) === Number(numeroClase));
      const nombreClase = temaLimpio || claseSeleccionada?.nombre || `Clase ${numeroClase}`;
      const referenciaClase = `Clase #${numeroClase}`;
      const detalleClase = `${referenciaClase} · ${nombreClase}`;

      const guardarTemaSesion = async () => {
        if (!nombreClase) return;

        const { data: sesionExistente, error: errSesionExistente } = await supabaseBrowserClient
          .from("sesiones_clase")
          .select("id")
          .eq("curso_id", cursoSeleccionado)
          .eq("fecha", fechaSesion)
          .maybeSingle();

        if (errSesionExistente) {
          throw errSesionExistente;
        }

        if (sesionExistente?.id) {
          const { error: errUpdateSesion } = await supabaseBrowserClient
            .from("sesiones_clase")
            .update({ tema_visto: nombreClase, observaciones: detalleClase })
            .eq("id", sesionExistente.id);

          if (errUpdateSesion) throw errUpdateSesion;
          return;
        }

        const { error: errInsertSesion } = await supabaseBrowserClient
          .from("sesiones_clase")
          .insert({
            curso_id: cursoSeleccionado,
            profesor_id: cursoSeleccionadoData?.profesor_id || null,
            fecha: fechaSesion,
            horas_dictadas: 0,
            tema_visto: nombreClase,
            observaciones: `${detalleClase}. Sesión registrada desde llamado de lista`,
          });

        if (errInsertSesion) throw errInsertSesion;
      };

      const registros = alumnos.map((alumno) => ({
        matricula_id: alumno.id,
        fecha: fechaSesion,
        estado: asistenciasMap[alumno.id],
        observaciones: detalleClase,
      }));

      const { error } = await supabaseBrowserClient
        .from("asistencias")
        .insert(registros);

      if (error) {
        if (error.code === "23505" || error.message.includes("duplicate") || error.message.includes("unique")) {
          try {
            await guardarTemaSesion();
          } catch (sesionError: any) {
            console.error(sesionError);
            message.warning("⚠️ La asistencia ya existía, pero no se pudo guardar el tema del día.");
            return;
          }
          message.warning(nombreClase
            ? "⚠️ La asistencia ya existía para esta fecha. Se actualizó el tema del día."
            : "⚠️ Ya se tomó asistencia para este curso en esta fecha.");
          return;
        }
        message.error("Error guardando: " + error.message);
        return;
      }

      try {
        await guardarTemaSesion();
      } catch (sesionError: any) {
        console.error(sesionError);
        message.warning("Asistencia guardada, pero no se pudo guardar el tema del día.");
      }

      // Notificar automáticamente a ausentes
      const ausentesInfo = alumnos.filter((alumno) => asistenciasMap[alumno.id] === "ausente");
      if (ausentesInfo.length > 0) {
        const fechaTexto = formatDate(fecha);
        await Promise.all(
          ausentesInfo.map(async (alumno) => {
            const nombre = alumno.perfiles?.nombre_completo || "Estudiante";
            const telefono = alumno.perfiles?.telefono;
            const variables = {
              nombre_estudiante: nombre,
              nombre_curso: cursoNombre || "curso",
              fecha_clase: fechaTexto,
            };
            const mensaje =
              buildWhatsappFallbackMessage("asistencia_inasistencia_registrada", variables) ??
              `Hola ${nombre}, se registró una inasistencia en ${cursoNombre} el ${fechaTexto}. Si es un error o necesitas apoyo, responde este mensaje.`;

            // Se omite el envío de WhatsApp para ausencias

            await supabaseBrowserClient.from("notificaciones").insert({
              user_id: alumno.estudiante_id,
              titulo: "Inasistencia registrada",
              mensaje,
              tipo: "asistencia",
              leido: false,
            });
          })
        );
      }

      message.success("✅ ¡Asistencia guardada correctamente!");
      setTimeout(() => router.push(returnTo), 800);
    } catch (error) {
      console.error(error);
      message.error("Error al guardar asistencia");
    } finally {
      setGuardando(false);
    }
  };

  // Contar presentes y ausentes
  const presentes = Object.values(asistenciasMap).filter(
    (v) => v === "presente"
  ).length;
  const ausentes = Object.values(asistenciasMap).filter(
    (v) => v === "ausente"
  ).length;
  const totalHabilitados = alumnos.filter((a) => a.estado === "activo" || a.estado === "en curso").length;
  const claseSeleccionadaValida = Boolean(numeroClase && Number(numeroClase) > 0);

  return (
    <div style={{ padding: "24px" }}>
      {/* ENCABEZADO */}
      <div
        style={{
          marginBottom: 24,
          background:
            "linear-gradient(135deg, #1890ff 0%, #1890ff 100%)",
          color: "white",
          padding: 20,
          borderRadius: 8,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0, color: "white" }}>
            📋 Tomar Asistencia / Llamado de Lista
          </Title>
          <Text style={{ color: "rgba(255,255,255,0.9)" }}>
            Registra la asistencia de tus estudiantes de forma rápida y sencilla
          </Text>
        </div>
        <Button
          type="primary"
          icon={<ArrowLeftOutlined />}
          size="large"
          onClick={() => router.push(returnTo)}
          style={{ background: "rgba(255,255,255,0.2)" }}
        >
          Volver
        </Button>
      </div>

      {/* SELECCIÓN DE CURSO Y FECHA */}
      <Card
        style={{ marginBottom: 20 }}
        title="📅 Paso 1: Curso y Fecha"
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Text strong>Curso:</Text>
              {cursoSeleccionado ? (
                <Tag color="blue" style={{ width: "fit-content", padding: "6px 12px", fontSize: 14 }}>
                  {cursoNombre || `Curso ${cursoSeleccionado}`}
                </Tag>
              ) : (
                <Alert type="warning" message="Falta el curso. Esta pantalla se debe abrir desde un grupo." showIcon />
              )}
              <Text type="secondary">El curso está fijado por el grupo actual.</Text>
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div>
              <Text strong>Fecha de la Clase:</Text>
              <DatePicker
                style={{ width: "100%", marginTop: 8 }}
                value={fecha}
                onChange={(val) => setFecha(val || dayjs())}
                format="DD-MMM-YYYY"
              />
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div>
              <Text strong>Número de clase:</Text>
              <Select
                style={{ width: "100%", marginTop: 8 }}
                value={numeroClase ?? undefined}
                options={opcionesClase}
                onChange={(value) => {
                  setNumeroClase(Number(value));
                  const clase = clasesDisponibles.find((item) => Number(item.numero) === Number(value));
                  if (clase?.nombre && !temaVisto.trim()) {
                    setTemaVisto(clase.nombre);
                  }
                }}
                placeholder="Selecciona el número de la clase"
                showSearch
                optionFilterProp="label"
              />
              {!claseSeleccionadaValida && (
                <Text type="danger">Selecciona el número de clase para continuar con el llamado de lista.</Text>
              )}
            </div>
          </Col>
          <Col xs={24}>
            <div>
              <Text strong>Nombre de la clase (editable):</Text>
              <Input
                style={{ marginTop: 8 }}
                value={temaVisto}
                onChange={(e) => setTemaVisto(e.target.value)}
                placeholder="Ej: Técnica de limado, preparación de uña y aplicación de gel"
                maxLength={180}
              />
              <Text type="secondary">El número de clase es el dato fijo; el nombre puede ajustarse cuando sea necesario.</Text>
            </div>
          </Col>
        </Row>
      </Card>

      {/* LISTA DE ESTUDIANTES */}
      {cursoSeleccionado && (
        <>
          {!claseSeleccionadaValida && (
            <Alert
              style={{ marginBottom: 16 }}
              type="warning"
              showIcon
              message="Antes de llamar lista, selecciona el número de la clase en el Paso 1."
            />
          )}

          <Card
            title={`👥 Paso 2: Marca Asistencia - ${cursoNombre}`}
            style={{ marginBottom: 20 }}
            extra={
              <Space>
                <Button
                  onClick={marcarTodoPresente}
                  type="dashed"
                  icon={<CheckOutlined />}
                  disabled={!claseSeleccionadaValida}
                >
                  Todos Presentes
                </Button>
                <Button
                  onClick={marcarTodoAusente}
                  type="dashed"
                  danger
                  icon={<CloseOutlined />}
                  disabled={!claseSeleccionadaValida}
                >
                  Todos Ausentes
                </Button>
              </Space>
            }
          >
            {loadingAlumnos ? (
              <div style={{ textAlign: "center", padding: 50 }}>
                <Spin size="large" />
              </div>
            ) : alumnos.length === 0 ? (
              <Alert
                message="No hay estudiantes activos en este curso"
                type="info"
                showIcon
              />
            ) : (
              <>
                {/* RESUMEN RÁPIDO */}
                <Row gutter={16} style={{ marginBottom: 20 }}>
                  <Col xs={12} md={8}>
                    <Card>
                      <Statistic
                        title="Presentes"
                        value={presentes}
                        valueStyle={{ color: "#52c41a" }}
                        suffix={`/ ${totalHabilitados || alumnos.length}`}
                      />
                    </Card>
                  </Col>
                  <Col xs={12} md={8}>
                    <Card>
                      <Statistic
                        title="Ausentes"
                        value={ausentes}
                        valueStyle={{ color: "#ff4d4f" }}
                        suffix={`/ ${totalHabilitados || alumnos.length}`}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} md={8}>
                    <Card>
                      <Statistic
                        title="% Asistencia"
                        value={
                          totalHabilitados > 0
                            ? Math.round((presentes / totalHabilitados) * 100)
                            : 0
                        }
                        suffix="%"
                        valueStyle={{
                          color:
                            totalHabilitados > 0 && presentes / totalHabilitados >= 0.8
                              ? "#52c41a"
                              : "#ff4d4f",
                        }}
                      />
                    </Card>
                  </Col>
                </Row>

                {/* TABLA DE ESTUDIANTES */}
                <Table
                  dataSource={alumnos}
                  rowKey="id"
                  pagination={{ pageSize: 15 }}
                  loading={loadingAlumnos}
                  columns={columnasAlumnos}
                  size={isMobile ? "small" : "middle"}
                  scroll={isMobile ? { x: 420 } : undefined}
                />
              </>
            )}
          </Card>

          {/* BOTONES DE ACCIÓN */}
          {alumnos.length > 0 && (
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Button
                  block
                  size="large"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => router.push(returnTo)}
                >
                  Cancelar
                </Button>
              </Col>
              <Col xs={24} md={12}>
                <Button
                  block
                  type="primary"
                  size="large"
                  icon={<SaveOutlined />}
                  loading={guardando}
                  disabled={!claseSeleccionadaValida}
                  onClick={guardarAsistencia}
                >
                  💾 Guardar Asistencia
                </Button>
              </Col>
            </Row>
          )}
        </>
      )}
    </div>
  );
}