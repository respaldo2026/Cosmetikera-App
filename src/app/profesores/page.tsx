"use client";

import React, { useEffect, useState } from "react";
import { logger } from "@utils/logger";
import { useNavigation } from "@refinedev/core";
import { Card, Avatar, Typography, Button, Spin, Alert, List, Tag } from "antd";
import { 
    UserOutlined, PhoneOutlined, MailOutlined, 
    PlusOutlined, ReloadOutlined,
    WhatsAppOutlined, BookOutlined
} from "@ant-design/icons";

// CORRECCIÓN: Usamos la misma ruta que funcionó en 'Inventario'
import { obtenerUsuariosPorRol } from "../../modules/usuarios/usuarios.service";
import { obtenerCursos } from "../../modules/academico/cursos.service";
import { enviarWhatsapp } from "../../modules/comunicacion/whatsapp.service";

const { Text, Title } = Typography;

export default function ProfesoresCards() {
    const { create, show } = useNavigation();
    
    // ESTADOS
    const [profesores, setProfesores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState("");
    const [totalEncontrados, setTotalEncontrados] = useState(0);

    // FUNCIÓN DE CARGA
    const cargarProfesores = async () => {
        setLoading(true);
        setErrorMsg("");
        try {
            const data = await obtenerUsuariosPorRol("profesor");
            setTotalEncontrados(data?.length || 0);
            const soloProfes = (data || []).filter((p: any) => p.activo !== false);
            const profesoresConCursos = await Promise.all(
                soloProfes.map(async (prof: any) => {
                    const cursos = await obtenerCursos();
                    const cursosActivos = (cursos || []).filter((c: any) => c.profesor_id === prof.id && c.estado === "activo");
                    return { ...prof, cursos_activos: cursosActivos };
                })
            );
            setProfesores(profesoresConCursos);
        } catch (err: any) {
            logger.error("Error cargando:", err);
            setErrorMsg(err.message || "Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarProfesores();
    }, []);

    return (
        <div style={{ padding: 24, background: "#f5f7fb", minHeight: "100%" }}>
            <Card
                style={{
                    borderRadius: 16,
                    marginBottom: 20,
                    border: "1px solid #eef1f5",
                    background: "linear-gradient(120deg, #ffffff 0%, #f7f5ff 100%)",
                    boxShadow: "0 20px 40px -28px rgba(88, 80, 236, 0.35)",
                }}
                bodyStyle={{ padding: 20 }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div>
                        <Title level={3} style={{ margin: 0 }}>👨‍🏫 Equipo Docente</Title>
                        <Text type="secondary">Gestiona docentes, cursos asignados y contactos en un solo lugar.</Text>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                        <Button icon={<ReloadOutlined />} onClick={cargarProfesores}>Recargar</Button>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => create("profesores")}>
                            Nuevo
                        </Button>
                    </div>
                </div>
            </Card>

            {/* MENSAJES DE ESTADO */}
            {errorMsg && (
                <Alert type="error" message="Error" description={errorMsg} showIcon style={{marginBottom: 20}} />
            )}
            
            {!loading && totalEncontrados === 0 && (
                <Alert type="warning" message="Base de datos vacía" description="Conexión exitosa, pero la tabla 'perfiles' no tiene datos." showIcon style={{marginBottom: 20}} />
            )}

            {/* LISTA DE TARJETAS */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 50 }}>
                    <Spin size="large" />
                    <div style={{ marginTop: 10, color: '#888' }}>Cargando profesores...</div>
                </div>
            ) : (
                <List
                    grid={{ gutter: 20, xs: 1, sm: 1, md: 2, lg: 3, xl: 4 }}
                    dataSource={profesores}
                    locale={{ emptyText: "No se encontraron profesores registrados" }}
                    renderItem={(profesor) => (
                        <List.Item>
                            <Card
                                hoverable
                                style={{
                                    borderRadius: 16,
                                    border: "1px solid #eef1f5",
                                    cursor: "pointer",
                                    background: "#fff",
                                    boxShadow: "0 14px 30px -22px rgba(15, 23, 42, 0.35)",
                                }}
                                bodyStyle={{ padding: 16 }}
                                onClick={() => show("profesores", profesor.id)}
                            >
                                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                                    <Avatar size={56} style={{ backgroundColor: "#e0e7ff", color: "#4338ca" }}>
                                        {profesor.nombre_completo ? profesor.nombre_completo[0].toUpperCase() : <UserOutlined />}
                                    </Avatar>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <Text strong style={{ fontSize: 16, display: "block" }}>
                                            {profesor.nombre_completo || "Sin Nombre"}
                                        </Text>
                                        {profesor.email ? (
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                <MailOutlined /> {profesor.email}
                                            </Text>
                                        ) : null}
                                    </div>
                                    <Tag color="green" style={{ margin: 0 }}>Activo</Tag>
                                </div>

                                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                                    {profesor.telefono ? (
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            <PhoneOutlined /> {profesor.telefono}
                                        </Text>
                                    ) : null}
                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                        <Tag color="purple" icon={<BookOutlined />}
                                            style={{ margin: 0 }}>
                                            {profesor.cursos_activos?.length || 0} curso{(profesor.cursos_activos?.length || 0) !== 1 ? "s" : ""} activo{(profesor.cursos_activos?.length || 0) !== 1 ? "s" : ""}
                                        </Tag>
                                    </div>
                                </div>

                                {profesor.telefono && (
                                    <div style={{ marginTop: 14 }}>
                                        <Button
                                            icon={<WhatsAppOutlined />}
                                            size="small"
                                            style={{ backgroundColor: "#25D366", color: "#fff", border: "none" }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                enviarWhatsapp(profesor.telefono, `Hola ${profesor.nombre_completo}, te contacto desde Academia Crystal.`);
                                            }}
                                        >
                                            WhatsApp
                                        </Button>
                                    </div>
                                )}
                            </Card>
                        </List.Item>
                    )}
                />
            )}
        </div>
    );
}
