"use client";

import React, { useState, useEffect } from "react";
import { 
  Table, Card, Button, DatePicker, Row, Col, Typography, 
  Statistic, Tag, message, Modal 
} from "antd";
import { 
  CalculatorOutlined, DollarCircleOutlined, PayCircleOutlined 
} from "@ant-design/icons";
import dayjs from "dayjs";

// CORRECCIÓN: Usamos tu cliente configurado en utils, no creamos uno nuevo
import { supabaseBrowserClient } from "@utils/supabase/client";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function NominaPage() {
  const [loading, setLoading] = useState(false);
  const [profesores, setProfesores] = useState<any[]>([]);
  // Iniciamos con el mes actual por defecto
  const [rangoFechas, setRangoFechas] = useState<any>([dayjs().startOf('month'), dayjs().endOf('month')]);
  const [totalAPagar, setTotalAPagar] = useState(0);

  // Modal Pagar
  const [modalVisible, setModalVisible] = useState(false);
  const [profesorSeleccionado, setProfesorSeleccionado] = useState<any>(null);

  useEffect(() => {
    calcularNomina();
  }, [rangoFechas]);

  const calcularNomina = async () => {
    if (!rangoFechas) return;
    setLoading(true);

    const inicio = rangoFechas[0].format("YYYY-MM-DD");
    const fin = rangoFechas[1].format("YYYY-MM-DD");

    try {
        // 1. Obtener profesores y su valor hora
        const { data: dataProfes } = await supabaseBrowserClient
            .from("perfiles")
            .select("id, nombre_completo, valor_hora")
            .eq("rol", "profesor"); // Filtramos solo profesores

        // 2. Obtener sesiones trabajadas en ese rango
        const { data: sesiones } = await supabaseBrowserClient
            .from("sesiones_clase")
            .select("profesor_id, horas_dictadas, fecha")
            .gte("fecha", inicio)
            .lte("fecha", fin)
            .eq("estado_pago", "pendiente");

        // 3. Cruzar información (Matemática de Nómina)
        const reporte = dataProfes?.map((prof: any) => {
            const susClases = sesiones?.filter((s: any) => s.profesor_id === prof.id) || [];
            // Sumar horas
            const totalHoras = susClases.reduce((sum: number, item: any) => sum + Number(item.horas_dictadas || 0), 0);
            // Calcular pago (Horas * Valor)
            const aPagar = totalHoras * (prof.valor_hora || 0);

            return {
                ...prof,
                total_horas: totalHoras,
                total_pagado: aPagar,
                detalles: susClases
            };
        }).filter((p: any) => p.total_horas > 0 || true); // (Opcional: Quita el || true si quieres ocultar a los que no trabajaron)

        setProfesores(reporte || []);
        
        const totalGeneral = reporte?.reduce((acc: number, curr: any) => acc + curr.total_pagado, 0) || 0;
        setTotalAPagar(totalGeneral);

    } catch (error) {
        console.error(error);
        message.error("Error calculando nómina");
    } finally {
        setLoading(false);
    }
  };

  const procesarPago = async () => {
      if (!profesorSeleccionado) return;
      
      try {
        // 1. Guardar en historial de pagos (pagos_nomina)
        const { error: errPago } = await supabaseBrowserClient.from("pagos_nomina").insert({
            profesor_id: profesorSeleccionado.id,
            fecha_pago: dayjs().format("YYYY-MM-DD"),
            monto: profesorSeleccionado.total_pagado, // Asegúrate que tu tabla use 'monto' o 'total_pagado'
            periodo: `Del ${rangoFechas[0].format("DD/MM")} al ${rangoFechas[1].format("DD/MM")}`,
            observaciones: `Pago por ${profesorSeleccionado.total_horas} horas trabajadas`
        });
        if (errPago) throw errPago;

        // 2. Marcar clases como PAGADAS
        const inicio = rangoFechas[0].format("YYYY-MM-DD");
        const fin = rangoFechas[1].format("YYYY-MM-DD");

        const { error: errUpdate } = await supabaseBrowserClient
            .from("sesiones_clase")
            .update({ estado_pago: 'pagado' })
            .eq("profesor_id", profesorSeleccionado.id)
            .gte("fecha", inicio)
            .lte("fecha", fin)
            .eq("estado_pago", "pendiente");

        if (errUpdate) throw errUpdate;

        message.success(`Pago registrado a ${profesorSeleccionado.nombre_completo}`);
        setModalVisible(false);
        calcularNomina(); // Refrescar pantalla

      } catch (error: any) {
          message.error("Error: " + error.message);
      }
  };

  return (
    <div style={{ padding: 24 }}>
        <Title level={3}><CalculatorOutlined /> Liquidación de Profesores</Title>
        
        <Card style={{ marginBottom: 20 }}>
            <Row gutter={16} align="middle">
                <Col span={12}>
                    <Text strong>Selecciona el Periodo:</Text><br/>
                    <RangePicker 
                        style={{ width: '100%', marginTop: 5 }} 
                        value={rangoFechas}
                        onChange={(dates) => setRangoFechas(dates)}
                        format="DD/MM/YYYY"
                    />
                </Col>
                <Col span={12}>
                    <Statistic 
                        title="Total a Dispersar" 
                        value={totalAPagar} 
                        prefix={<DollarCircleOutlined />} 
                        precision={0}
                        valueStyle={{ color: '#3f8600' }}
                    />
                </Col>
            </Row>
        </Card>

        <Table 
            dataSource={profesores}
            rowKey="id"
            loading={loading}
            locale={{ emptyText: "No hay clases pendientes de pago en este rango de fechas" }}
            columns={[
                { title: 'Profesor', dataIndex: 'nombre_completo' },
                { 
                    title: 'Valor Hora', 
                    dataIndex: 'valor_hora',
                    render: (val) => val ? `$ ${Number(val).toLocaleString()}` : <Tag color="red">Sin definir</Tag>
                },
                { 
                    title: 'Horas Trabajadas', 
                    dataIndex: 'total_horas',
                    render: (val) => <Tag color="blue">{val} hrs</Tag>
                },
                { 
                    title: 'A Pagar', 
                    dataIndex: 'total_pagado',
                    render: (val) => <Text strong type="success">$ {Number(val).toLocaleString()}</Text>
                },
                {
                    title: 'Acción',
                    render: (_, record) => (
                        <Button 
                            type="primary" 
                            icon={<PayCircleOutlined />} 
                            disabled={record.total_pagado <= 0} // Deshabilitar si es 0
                            onClick={() => {
                                setProfesorSeleccionado(record);
                                setModalVisible(true);
                            }}
                        >
                            Pagar
                        </Button>
                    )
                }
            ]}
        />

        <Modal
            title="Confirmar Pago de Nómina"
            open={modalVisible}
            onCancel={() => setModalVisible(false)}
            onOk={procesarPago}
            okText="Confirmar Pago"
        >
            {profesorSeleccionado && (
                <div>
                    <p>Vas a registrar el pago para: <b>{profesorSeleccionado.nombre_completo}</b></p>
                    <ul>
                        <li>Periodo: {rangoFechas[0].format("DD/MM")} al {rangoFechas[1].format("DD/MM")}</li>
                        <li>Horas: {profesorSeleccionado.total_horas}</li>
                        <li>Total: <b>$ {Number(profesorSeleccionado.total_pagado).toLocaleString()}</b></li>
                    </ul>
                    <p style={{fontSize: 12, color: '#888'}}>
                        Al confirmar, las clases se marcarán como "pagadas".
                    </p>
                </div>
            )}
        </Modal>
    </div>
  );
}