"use client";

import React from "react";
import { List, useTable, EditButton, DeleteButton, useSelect } from "@refinedev/antd";
import { Table, Space, Tag, DatePicker, Row, Col } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, InfoCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

export default function ListAsistencias() {
  const { tableProps, searchFormProps } = useTable({
    resource: "asistencias",
    sorters: { initial: [{ field: "fecha", order: "desc" }] },
    // Filtros iniciales (opcional)
  });

  // Truco para mostrar nombres (traemos matrículas para saber quién es)
  const { selectProps: matriculaSelect } = useSelect({
    resource: "matriculas",
    // Necesitamos traer datos anidados si fuera posible, pero por ahora usaremos el ID
    // En una versión avanzada haremos un "join" virtual
  });

  return (
    <List title="Registro de Asistencias">
      
      {/* FILTROS RÁPIDOS (Próximamente) */}
      
      <Table {...tableProps} rowKey="id">
        
        {/* FECHA */}
        <Table.Column 
            title="Fecha" 
            dataIndex="fecha" 
            render={(val) => dayjs(val).format("DD/MM/YYYY")}
            sorter
        />

        {/* ESTADO (Visualmente claro) */}
        <Table.Column 
            title="Estado" 
            dataIndex="estado" 
            render={(val) => {
                if(val === 'presente') return <Tag color="green" icon={<CheckCircleOutlined/>}>Presente</Tag>
                if(val === 'ausente') return <Tag color="red" icon={<CloseCircleOutlined/>}>Ausente</Tag>
                if(val === 'tarde') return <Tag color="orange" icon={<ClockCircleOutlined/>}>Tarde</Tag>
                return <Tag color="blue" icon={<InfoCircleOutlined/>}>Excusa</Tag>
            }}
        />

        {/* OBSERVACIONES */}
        <Table.Column title="Notas" dataIndex="observaciones" />

        {/* ACCIONES */}
        <Table.Column
          title="Acciones"
          dataIndex="actions"
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