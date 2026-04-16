"use client";

import React, { useEffect, useState } from "react";
import { Show } from "@refinedev/antd";
import { 
  Typography, Row, Col, Card, Button, 
  Modal, Form, Input, DatePicker, Avatar, List, Divider, Drawer, Switch, message, Spin, Select, InputNumber, Timeline, Alert,
  Tabs, Tag
} from "antd";
import { 
  UserOutlined, BookOutlined, TeamOutlined, PlusOutlined, ExclamationCircleOutlined, StarOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useParams } from "next/navigation"; 
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const { Title, Text } = Typography;

export default function ShowProfesorDashboard() {
  const params = useParams();
  const idProfesor = params?.id as string;

  // HOOKS DE ANT DESIGN
  const [messageApi, contextHolder] = message.useMessage();
  const [modal, modalContextHolder] = Modal.useModal();
  const [formPensum] = Form.useForm();
  const [formNotas] = Form.useForm();

  // ESTADOS GENERALES
  const [profesor, setProfesor] = useState<any>(null);
  const [misCursos, setMisCursos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // GESTIÓN CLASE (DRAWER)
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [cursoActivo, setCursoActivo] = useState<any>(null);
  const [alumnosClase, setAlumnosClase] = useState<any[]>([]);
  const [temasCurso, setTemasCurso] = useState<any[]>([]);
  const [temaSeleccionado, setTemaSeleccionado] = useState<string | null>(null);
  
  // Asistencia y Horas (NÓMINA)
  const [asistenciaMap, setAsistenciaMap] = useState<Record<string, boolean>>({});
  const [fechaAsistencia, setFechaAsistencia] = useState(dayjs());
  const [horasClase, setHorasClase] = useState<number>(2); // <--- NUEVO: Por defecto 2 horas
  const [guardandoAsistencia, setGuardandoAsistencia] = useState(false);

  // Pensum
  const [modalPensumVisible, setModalPensumVisible] = useState(false);
  const [guardandoTema, setGuardandoTema] = useState(false);

  // Calificaciones
  const [modalNotasVisible, setModalNotasVisible] = useState(false);
  const [estudianteACalificar, setEstudianteACalificar] = useState<any>(null);
  const [guardandoNota, setGuardandoNota] = useState(false);

  // 1. CARGAR DATOS INICIALES
  useEffect(() => {
    if (idProfesor) cargarDashboard();
  }, [idProfesor]);

  const cargarDashboard = async () => {
    try {
        setLoading(true);
        // Perfil
        const { data: dataProf, error: errProf } = await supabase.from("perfiles").select("*").eq("id", idProfesor).single();
        if (errProf) throw errProf;
        setProfesor(dataProf);

        // Cursos
        const { data: dataCursos, error: errCursos } = await supabase
            .from("cursos")
            .select(`*, matriculas ( count )`)
            .eq("profesor_id", idProfesor)
            .eq("estado", "activo");
        
        if (errCursos) throw errCursos;

        const cursosFmt = dataCursos?.map((c: any) => ({
            ...c,
            total_estudiantes: c.matriculas?.[0]?.count || 0
        })) || [];

        setMisCursos(cursosFmt);
    } catch (error: any) {
        console.error("Error cargando dashboard:", error);
    } finally {
        setLoading(false);
    }
  };

  // 2. ABRIR GESTIÓN DE CLASE
  const abrirGestionClase = async (curso: any) => {
      try {
          messageApi.loading({ content: "Cargando aula...", key: "loadingAula" });
          setCursoActivo(curso);
          setAlumnosClase([]);
          setTemaSeleccionado(null);
          setHorasClase(2); // Reiniciar horas a 2
          
          // A) Estudiantes
          const { data: dataAlumnos, error: errAlumnos } = await supabase
            .from("matriculas")
            .select(`id, estudiante_id, perfiles ( nombre_completo )`)
            .eq("curso_id", curso.id)
            .eq("estado", "activo");

          if (errAlumnos) throw errAlumnos;
          
          setAlumnosClase(dataAlumnos || []);
          
          // B) Temas
          const { data: dataTemas, error: errTemas } = await supabase
            .from("temas_curso")
            .select("*")
            .eq("curso_id", curso.id)
            .order("orden", { ascending: true });
            
          if (errTemas) throw errTemas;

          setTemasCurso(dataTemas || []);

          // C) BUSCAR ASISTENCIA PREVIA
          const fechaHoyStr = dayjs().format("YYYY-MM-DD");
          const { data: asistenciasHoy } = await supabase
              .from("asistencias")
              .select("matricula_id, estado, tema_id")
              .eq("fecha", fechaHoyStr)
              .in("matricula_id", dataAlumnos?.map((a: any) => a.id) || []);

          const mapa: any = {};
          
          if (asistenciasHoy && asistenciasHoy.length > 0) {
              asistenciasHoy.forEach((asist: any) => {
                  mapa[asist.matricula_id] = asist.estado === 'presente';
              });
              if(asistenciasHoy[0].tema_id) setTemaSeleccionado(asistenciasHoy[0].tema_id);
              messageApi.success({ content: "Datos cargados", key: "loadingAula" });
          } else {
              dataAlumnos?.forEach((a: any) => mapa[a.id] = true);
              messageApi.success({ content: "Aula lista", key: "loadingAula" });
          }
          
          setAsistenciaMap(mapa);
          setDrawerVisible(true);
      } catch (error: any) {
          messageApi.error({ content: "Error: " + error.message, key: "loadingAula" });
      }
  };

  // 3. CONFIRMAR Y GUARDAR (ASISTENCIA + HORAS TRABAJADAS)
  const confirmarGuardado = () => {
      if(!temaSeleccionado) {
          messageApi.warning("⚠️ Selecciona el tema enseñado hoy.");
          return;
      }

      modal.confirm({
          title: '¿Registrar Clase?',
          icon: <ExclamationCircleOutlined />,
          content: (
              <div>
                  <p>Se guardará la asistencia de los alumnos.</p>
                  <p>Además, se registrarán <b>{horasClase} horas</b> trabajadas para tu pago de nómina.</p>
              </div>
          ),
          okText: 'Confirmar y Guardar',
          cancelText: 'Cancelar',
          onOk: ejecutarGuardadoReal
      });
  };

  const ejecutarGuardadoReal = async () => {
      setGuardandoAsistencia(true);
      try {
          // 1. Guardar Asistencia ALUMNOS
          const registros = alumnosClase.map(alumno => ({
              matricula_id: alumno.id,
              fecha: fechaAsistencia.format("YYYY-MM-DD"),
              estado: asistenciaMap[alumno.id] ? 'presente' : 'ausente',
              tema_id: temaSeleccionado,
              observaciones: asistenciaMap[alumno.id] ? 'Tema completado' : 'Tema pendiente'
          }));

          const { error: errAsis } = await supabase
            .from("asistencias")
            .upsert(registros, { onConflict: 'matricula_id, fecha' });

          if (errAsis) throw errAsis;

          // 2. Guardar Sesión PROFESOR (Para Nómina)
          const temaTxt = temasCurso.find(t => t.id === temaSeleccionado)?.titulo || 'Tema del día';
          
          const { error: errSesion } = await supabase
            .from("sesiones_clase")
            .upsert({
                curso_id: cursoActivo.id,
                profesor_id: idProfesor,
                fecha: fechaAsistencia.format("YYYY-MM-DD"),
                horas_dictadas: horasClase,
                tema_visto: temaTxt,
                estado_pago: 'pendiente'
            }, { onConflict: 'curso_id, profesor_id, fecha' }); // Evita duplicados el mismo día

          if (errSesion) throw errSesion;

          messageApi.success("✅ Clase y Horas registradas correctamente");
          setDrawerVisible(false);
      } catch (error: any) {
          messageApi.error("Error guardando: " + error.message);
      } finally {
          setGuardandoAsistencia(false);
      }
  };

  // 4. GUARDAR TEMA PENSUM
  const guardarTemaPensum = async () => {
      setGuardandoTema(true);
      try {
          const values = await formPensum.validateFields();
          const { error } = await supabase.from("temas_curso").insert({
              ...values,
              curso_id: cursoActivo.id
          });

          if (error) throw error;

          messageApi.success("Tema agregado");
          formPensum.resetFields();
          setModalPensumVisible(false);
          
          const { data } = await supabase.from("temas_curso").select("*").eq("curso_id", cursoActivo.id).order("orden");
          setTemasCurso(data || []);

      } catch (error: any) {
          messageApi.error("Error: " + error.message);
      } finally {
          setGuardandoTema(false);
      }
  };

  // 5. CALIFICAR
  const abrirCalificar = (alumno: any) => {
      setEstudianteACalificar(alumno);
      formNotas.resetFields();
      setModalNotasVisible(true);
  };

  const guardarNota = async () => {
      setGuardandoNota(true);
      try {
          const values = await formNotas.validateFields();
          
          const { error } = await supabase.from("calificaciones").insert({
             matricula_id: estudianteACalificar.id,
             concepto: values.concepto,
             nota: values.nota,
             observaciones: values.observaciones
          });

          if (error) throw error;

          messageApi.success(`Nota guardada para ${estudianteACalificar.perfiles.nombre_completo}`);
          setModalNotasVisible(false);
          formNotas.resetFields();

      } catch (error: any) {
          messageApi.error("Error al guardar nota: " + error.message);
      } finally {
          setGuardandoNota(false);
      }
  };

  if (loading) return (
      <div style={{ padding: 50, textAlign: 'center' }}>
          <Spin size="large" />
          <div style={{ marginTop: 15, color: '#888' }}>Cargando Oficina Virtual...</div>
      </div>
  );

  return (
    <Show title="Oficina Virtual" headerButtons={() => <Button href="/profesores">Volver</Button>}>
      {contextHolder}
      {modalContextHolder}
      
      {profesor && (
        <Card style={{marginBottom: 20, borderLeft: '5px solid #722ed1'}}>
            <Row align="middle" gutter={16}>
                <Col><Avatar size={64} style={{backgroundColor: '#87d068'}} icon={<UserOutlined />} /></Col>
                <Col>
                    <Title level={4} style={{margin:0}}>{profesor.nombre_completo}</Title>
                    <Text type="secondary">Panel Docente</Text>
                </Col>
            </Row>
        </Card>
      )}

      <Title level={4}><BookOutlined /> Mis Cursos</Title>
      
      <Row gutter={[16, 16]}>
        {misCursos.map((curso) => (
            <Col xs={24} md={12} lg={8} key={curso.id}>
                <Card 
                    hoverable
                    actions={[<Button type="primary" block onClick={() => abrirGestionClase(curso)}>Gestionar Clase</Button>]}
                >
                    <Card.Meta 
                        avatar={<Avatar style={{backgroundColor: '#722ed1'}} icon={<BookOutlined />} />}
                        title={curso.nombre}
                        description={<span><TeamOutlined /> {curso.total_estudiantes} Alumnos</span>}
                    />
                </Card>
            </Col>
        ))}
        {misCursos.length === 0 && <Alert message="No tienes cursos activos." type="info" />}
      </Row>

      <Drawer
        title={`Clase: ${cursoActivo?.nombre}`}
        width={600}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        maskClosable={false}
        extra={
            <Button type="primary" onClick={confirmarGuardado} loading={guardandoAsistencia}>
                Guardar Asistencia
            </Button>
        }
      >
        <Tabs defaultActiveKey="1" items={[
            {
                key: '1', label: '📝 Tomar Lista',
                children: (
                    <>
                        <Card variant="borderless" style={{background: '#f0f2f5', marginBottom: 20}}>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <label>Fecha Clase:</label>
                                    <DatePicker style={{width:'100%'}} value={fechaAsistencia} onChange={val => setFechaAsistencia(val || dayjs())} allowClear={false}/>
                                </Col>
                                <Col span={12}>
                                    <label>Horas Dictadas:</label>
                                    <InputNumber 
                                        min={1} 
                                        max={8} 
                                        value={horasClase} 
                                        onChange={(val) => setHorasClase(val || 2)} 
                                        style={{ width: '100%' }} 
                                        addonAfter="Hrs"
                                    />
                                </Col>
                            </Row>
                            <Row style={{marginTop: 10}}>
                                <Col span={24}>
                                    <label>Tema de hoy:</label>
                                    <Select 
                                        style={{width:'100%'}} 
                                        placeholder="Selecciona tema..."
                                        value={temaSeleccionado}
                                        onChange={setTemaSeleccionado}
                                        options={temasCurso.map(t => ({label: `${t.orden}. ${t.titulo}`, value: t.id}))}
                                        dropdownRender={(menu) => (
                                            <>
                                                {menu}
                                                <Divider style={{ margin: '8px 0' }} />
                                                <Button type="text" icon={<PlusOutlined />} block onClick={() => setModalPensumVisible(true)}>
                                                    + Nuevo Tema
                                                </Button>
                                            </>
                                        )}
                                    />
                                </Col>
                            </Row>
                        </Card>

                        <List
                            itemLayout="horizontal"
                            dataSource={alumnosClase}
                            renderItem={(alumno: any) => (
                                <List.Item actions={[
                                    <Switch 
                                        checkedChildren="Vino" 
                                        unCheckedChildren="Faltó"
                                        checked={asistenciaMap[alumno.id]}
                                        onChange={(val) => setAsistenciaMap({...asistenciaMap, [alumno.id]: val})}
                                        style={{ backgroundColor: asistenciaMap[alumno.id] ? '#52c41a' : '#ff4d4f' }}
                                    />
                                ]}>
                                    <List.Item.Meta
                                        avatar={<Avatar>{alumno.perfiles.nombre_completo[0]}</Avatar>}
                                        title={alumno.perfiles.nombre_completo}
                                        description={asistenciaMap[alumno.id] ? <Tag color="green">Presente</Tag> : <Tag color="red">Ausente</Tag>}
                                    />
                                </List.Item>
                            )}
                        />
                    </>
                )
            },
            {
                key: '2', label: '⭐ Calificar',
                children: (
                    <div>
                        <Alert message="Selecciona un estudiante para asignar una nota." type="info" style={{marginBottom: 15}} />
                        <List
                            itemLayout="horizontal"
                            dataSource={alumnosClase}
                            renderItem={(alumno: any) => (
                                <List.Item actions={[
                                    <Button 
                                        type="dashed" 
                                        shape="round" 
                                        icon={<StarOutlined />} 
                                        onClick={() => abrirCalificar(alumno)}
                                    >
                                        Calificar
                                    </Button>
                                ]}>
                                    <List.Item.Meta
                                        avatar={<Avatar style={{backgroundColor: '#faad14'}}>{alumno.perfiles.nombre_completo[0]}</Avatar>}
                                        title={alumno.perfiles.nombre_completo}
                                        description="Gestionar notas"
                                    />
                                </List.Item>
                            )}
                        />
                    </div>
                )
            },
            {
                key: '3', label: '📚 Ver Pensum',
                children: (
                    <>
                        <Button type="dashed" icon={<PlusOutlined />} block onClick={() => setModalPensumVisible(true)} style={{marginBottom: 20}}>
                            Agregar Tema al Pensum
                        </Button>
                        <Timeline items={temasCurso.map(t => ({ children: <b>{t.titulo}</b>, color: 'blue' }))} />
                    </>
                )
            }
        ]} />
      </Drawer>

      {/* MODAL NUEVO TEMA PENSUM */}
      <Modal
        title="Nuevo Tema en el Pensum"
        open={modalPensumVisible}
        onOk={guardarTemaPensum}
        confirmLoading={guardandoTema}
        onCancel={() => setModalPensumVisible(false)}
      >
          <Form form={formPensum} layout="vertical">
              <Row gutter={16}>
                  <Col span={6}>
                      <Form.Item name="orden" label="Nº" initialValue={(temasCurso.length || 0) + 1}>
                          <InputNumber style={{width:'100%'}} />
                      </Form.Item>
                  </Col>
                  <Col span={18}>
                      <Form.Item name="titulo" label="Título" rules={[{required:true}]}>
                          <Input placeholder="Ej: Manicure Ruso" />
                      </Form.Item>
                  </Col>
              </Row>
              <Form.Item name="descripcion" label="Descripción">
                  <Input.TextArea rows={2} />
              </Form.Item>
          </Form>
      </Modal>

      {/* MODAL CALIFICAR */}
      <Modal
        title={<span><StarOutlined /> Calificar a {estudianteACalificar?.perfiles.nombre_completo}</span>}
        open={modalNotasVisible}
        onOk={guardarNota}
        confirmLoading={guardandoNota}
        onCancel={() => setModalNotasVisible(false)}
        okText="Guardar Nota"
      >
          <Form form={formNotas} layout="vertical">
              <Row gutter={16}>
                  <Col span={16}>
                      <Form.Item 
                        name="concepto" 
                        label="Actividad o Evaluación" 
                        rules={[{required:true, message: 'Indica qué estás calificando'}]}
                      >
                          <Input placeholder="Ej: Examen Teórico, Práctica Gel..." />
                      </Form.Item>
                  </Col>
                  <Col span={8}>
                      <Form.Item 
                        name="nota" 
                        label="Nota (0-5)" 
                        rules={[{required:true, message: 'Falta la nota'}]}
                      >
                          <InputNumber min={0} max={5} step={0.1} style={{width: '100%'}} />
                      </Form.Item>
                  </Col>
              </Row>
              <Form.Item name="observaciones" label="Observaciones (Opcional)">
                  <Input.TextArea rows={2} placeholder="Comentarios sobre el desempeño..." />
              </Form.Item>
          </Form>
      </Modal>

    </Show>
  );
}