// Ejemplo de componente que consume el servicio modular de pagos
import React, { useEffect, useState } from "react";
import { Table, Spin, Alert } from "antd";
import { obtenerPagosPorEstudiante } from "./pagos.service";

interface PagosListExampleProps {
  estudianteId: string;
}

export const PagosListExample: React.FC<PagosListExampleProps> = ({ estudianteId }) => {
  const [pagos, setPagos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    obtenerPagosPorEstudiante(estudianteId)
      .then(setPagos)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [estudianteId]);

  if (loading) return <Spin />;
  if (error) return <Alert type="error" message={error} />;

  return (
    <Table
      dataSource={pagos}
      rowKey="id"
      columns={[
        { title: "Fecha", dataIndex: "fecha_pago" },
        { title: "Monto", dataIndex: "monto" },
        { title: "Método", dataIndex: "metodo_pago" },
        { title: "Concepto", dataIndex: "concepto" },
      ]}
    />
  );
};
