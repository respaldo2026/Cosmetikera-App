"use client";

import React from "react";
import { List, useTable, EditButton, DeleteButton, CreateButton } from "@refinedev/antd";
import { Table, Space, Tag, Typography, Button } from "antd";
import { 
  FileTextOutlined, 
  CheckCircleOutlined, 
  SyncOutlined, 
  CloseCircleOutlined, 
  DownloadOutlined 
} from "@ant-design/icons";
import dayjs from "dayjs";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { DiplomaPDF } from "@components/pdf/DiplomaPDF"; // Asegúrate que esta ruta coincida con donde creaste el archivo anterior

const { Text } = Typography;

export default function MatriculasList() {
    // Traemos las matrículas junto con los datos del Estudiante (perfiles) y el Curso (cursos)
    const { tableProps } = useTable({
        resource: "matriculas",
        meta: {
            select: "*, perfiles(nombre_completo, email), cursos(nombre)"
        },
        sorters: {
            initial: [
                {
                    field: "created_at",
                    order: "desc",
                },
            ],
        },
    });

    return (
        <List
            title="Gestión de Matrículas"
            headerButtons={<CreateButton type="primary" icon={<FileTextOutlined />}>Nueva Matrícula</CreateButton>}
        >
            <Table {...tableProps} rowKey="id">
                
                {/* COLUMNA 1: ESTUDIANTE */}
                <Table.Column
                    title="Estudiante"
                    dataIndex={["perfiles", "nombre_completo"]}
                    render={(val, record: any) => (
                        <div style={{display:'flex', flexDirection:'column'}}>
                            <Text strong>{val || "Sin nombre"}</Text>
                            <Text type="secondary" style={{fontSize:12}}>{record.perfiles?.email}</Text>
                        </div>
                    )}
                />

                {/* COLUMNA 2: CURSO */}
                <Table.Column
                    title="Curso Inscrito"
                    dataIndex={["cursos", "nombre"]}
                    render={(val) => <Tag color="blue">{val || "Curso General"}</Tag>}
                />

                {/* COLUMNA 3: ESTADO ACADÉMICO */}
                <Table.Column
                    title="Estado"
                    dataIndex="estado"
                    render={(val) => {
                        let color = "default";
                        let icon = <SyncOutlined spin />;
                        
                        // Normalizamos a minúsculas para comparar
                        const estado = (val || "").toLowerCase();

                        if (estado === "aprobado" || estado === "certificado") {
                            color = "success";
                            icon = <CheckCircleOutlined />;
                        } else if (estado === "cancelado" || estado === "retirado") {
                            color = "error";
                            icon = <CloseCircleOutlined />;
                        } else if (estado === "activo" || estado === "en curso") {
                            color = "processing";
                        }

                        return <Tag color={color} icon={icon}>{val?.toUpperCase()}</Tag>;
                    }}
                />

                {/* COLUMNA 4: FECHA INSCRIPCIÓN */}
                <Table.Column
                    title="Fecha Inicio"
                    dataIndex="created_at"
                    render={(val) => dayjs(val).format("DD/MM/YYYY")}
                />

                {/* COLUMNA 5: DIPLOMA (LA MAGIA ✨) */}
                <Table.Column
                    title="Diploma"
                    align="center"
                    render={(_, record: any) => {
                        // Verificamos si está aprobado
                        const estado = (record.estado || "").toLowerCase();
                        const esAprobado = estado === "aprobado" || estado === "certificado" || estado === "finalizado";

                        if (!esAprobado) {
                            return <Text type="secondary" style={{fontSize:11}}>En progreso...</Text>;
                        }

                        // Si está aprobado, mostramos el botón de descarga
                        return (
                            <PDFDownloadLink
                                document={
                                    <DiplomaPDF 
                                        estudiante={record.perfiles?.nombre_completo || "Estudiante"}
                                        curso={record.cursos?.nombre || "Curso"}
                                        fechaFin={record.updated_at || new Date().toISOString()} 
                                        folio={record.id}
                                    />
                                }
                                fileName={`Diploma_${record.perfiles?.nombre_completo || 'Alumno'}.pdf`}
                            >
                                {({ loading }) => 
                                    loading ? (
                                        <Button size="small" loading>...</Button>
                                    ) : (
                                        <Button 
                                            type="primary" 
                                            size="small" 
                                            icon={<DownloadOutlined />} 
                                            style={{ backgroundColor: '#D4AF37', borderColor: '#D4AF37', color: '#fff' }}
                                            title="Descargar Diploma Oficial"
                                        >
                                            Diploma
                                        </Button>
                                    )
                                }
                            </PDFDownloadLink>
                        );
                    }}
                />

                {/* COLUMNA 6: ACCIONES */}
                <Table.Column
                    title="Acciones"
                    render={(_, record: any) => (
                        <Space>
                            <EditButton hideText size="small" recordItemId={record.id} />
                            <DeleteButton hideText size="small" recordItemId={record.id} />
                        </Space>
                    )}
                />
            </Table>
        </List>
    );
}