"use client";

import React from "react";
import { List, useTable, EditButton, DeleteButton } from "@refinedev/antd";
import { Table, Space, Avatar, Tag } from "antd";
import { UserOutlined } from "@ant-design/icons";

export default function ListPerfiles() {
  const { tableProps } = useTable({
    resource: "perfiles",
    // IMPORTANTE: Ordenamos para que salgan primero los últimos creados
    sorters: { initial: [{ field: "created_at", order: "desc" }] }, 
  });

  return (
    <List>
      <Table {...tableProps} rowKey="id">
        
        {/* COLUMNA 1: Cédula (Ya no saldrá el número largo) */}
        <Table.Column 
            dataIndex="identificacion" 
            title="Cédula / ID" 
            render={(value) => <b>{value || "---"}</b>}
            width={150}
        />

        {/* COLUMNA 2: Nombre y Foto */}
        <Table.Column 
            title="Estudiante"
            dataIndex="nombre_completo"
            render={(value) => (
                <Space>
                    <Avatar icon={<UserOutlined />} />
                    {value}
                </Space>
            )}
        />

        <Table.Column 
            dataIndex="email" 
            title="Correo" 
        />

        <Table.Column 
            dataIndex="telefono" 
            title="Teléfono" 
        />

        {/* COLUMNA: ROL CON COLORES */}
        <Table.Column 
            dataIndex="rol" 
            title="Rol" 
            render={(value) => {
                let color = "default";
                let text = "🎓 Estudiante";
                
                if (value === 'admin') { color = "gold"; text = "👑 Admin"; }
                if (value === 'profesor') { color = "purple"; text = "👩‍🏫 Profesor"; }
                
                return <Tag color={color}>{text}</Tag>;
            }}
        />

        <Table.Column
          title="Acciones"
          dataIndex="actions"
          render={(_, record: any) => (
            <Space>
              {/* Botón de editar */}
              <EditButton hideText size="small" recordItemId={record.id} />
              {/* Botón de borrar (Opcional) */}
              <DeleteButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  );
}