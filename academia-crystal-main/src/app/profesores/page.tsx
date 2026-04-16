"use client";

import React, { useEffect, useState } from "react";
import { useNavigation, useDelete } from "@refinedev/core";
import { Card, Avatar, Typography, Button, Spin, Alert, List, Badge } from "antd";
import { 
    UserOutlined, PhoneOutlined, MailOutlined, EditOutlined, 
    DeleteOutlined, PlusOutlined, IdcardOutlined, ReloadOutlined 
} from "@ant-design/icons";

// CORRECCIÓN: Usamos la misma ruta que funcionó en 'Inventario'
import { supabaseBrowserClient } from "@utils/supabase/client"; 

const { Text, Title } = Typography;

export default function ProfesoresCards() {
    const { edit, create } = useNavigation();
    const { mutate: deleteMutation } = useDelete();
    
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
            // Usamos el cliente importado correctamente
            const { data, error } = await supabaseBrowserClient
                .from('perfiles')
                .select('*');

            if (error) throw error;

            setTotalEncontrados(data?.length || 0);

            // Filtrado seguro
            const soloProfes = (data || []).filter((p: any) => 
                p.rol && String(p.rol).trim().toLowerCase() === 'profesor'
            );
            
            setProfesores(soloProfes);

        } catch (err: any) {
            console.error("Error cargando:", err);
            setErrorMsg(err.message || "Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarProfesores();
    }, []);

    const handleDelete = (id: string) => {
        if(confirm("¿Estás seguro de borrar este profesor?")) {
            deleteMutation({ resource: "perfiles", id });
            setTimeout(cargarProfesores, 1000); 
        }
    };

    return (
        <div style={{ padding: 20 }}>
            {/* ENCABEZADO */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Title level={3} style={{ margin: 0 }}>👨‍🏫 Equipo Docente</Title>
                <div style={{ display: 'flex', gap: 10 }}>
                    <Button icon={<ReloadOutlined />} onClick={cargarProfesores}>Recargar</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => create("profesores")}>
                        Nuevo
                    </Button>
                </div>
            </div>

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
                    grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 3, xl: 4 }}
                    dataSource={profesores}
                    locale={{ emptyText: "No se encontraron profesores registrados" }}
                    renderItem={(profesor) => (
                        <List.Item>
                            <Card
                                hoverable
                                style={{ borderRadius: 10, borderTop: '3px solid #722ed1' }}
                                actions={[
                                    <EditOutlined key="edit" onClick={() => edit("profesores", profesor.id)} />,
                                    <DeleteOutlined key="del" style={{ color: 'red' }} onClick={() => handleDelete(profesor.id)} />
                                ]}
                            >
                                <Card.Meta
                                    avatar={
                                        <Avatar size={48} style={{ backgroundColor: '#fde3cf', color: '#f56a00' }}>
                                            {profesor.nombre_completo ? profesor.nombre_completo[0].toUpperCase() : <UserOutlined />}
                                        </Avatar>
                                    }
                                    title={profesor.nombre_completo || "Sin Nombre"}
                                    description={
                                        <div style={{ marginTop: 8, fontSize: '13px' }}>
                                            {profesor.telefono && <div><PhoneOutlined /> {profesor.telefono}</div>}
                                            {profesor.email && <div><MailOutlined /> {profesor.email}</div>}
                                            <div style={{marginTop:5}}>
                                                <Badge status="success" text="Activo" />
                                            </div>
                                        </div>
                                    }
                                />
                            </Card>
                        </List.Item>
                    )}
                />
            )}
        </div>
    );
}