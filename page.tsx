"use client";

import React from "react";
import {
  List,
  useTable,
  DateField,
  FilterDropdown,
} from "@refinedev/antd";
import { Table, Tag, Select, Typography, Card } from "antd";
import { useCurrentUser } from "@hooks/useCurrentUser";

const { Text } = Typography;

export default function AuditoriaPage() {
  const { user, loading } = useCurrentUser();

  const { tableProps } = useTable({
    resource: "audit_logs",
    // Hacemos JOIN con perfiles para obtener nombre y email
    meta: {
      select: "*, perfiles(nombre_completo, email)",
    },
    sorters: {
      initial: [
        {
          field: "changed_at",
          order: "desc",
        },
      ],
    },
    filters: {
      initial: [],
    },
    syncWithLocation: true,
  });

  // Protección simple de rol
  if (!loading && user?.rol !== "admin" && user?.rol !== "director") {
    return (
      <Card>
        <Text type="danger">
          No tienes permisos para ver los registros de auditoría.
        </Text>
      </Card>
    );
  }

  // Función para renderizar las diferencias de forma legible
  const renderDiff = (oldData: any, newData: any) => {
    if (!oldData && !newData) return <Text disabled>-</Text>;

    // Caso UPDATE: Mostrar solo lo que cambió
    if (oldData && newData) {
      const changes: Record<string, { from: any; to: any }> = {};
      
      Object.keys(newData).forEach((key) => {
        // Ignorar campos técnicos que no aportan valor visual
        if (["updated_at", "created_at"].includes(key)) return;

        if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
          changes[key] = { from: oldData[key], to: newData[key] };
        }
      });

      if (Object.keys(changes).length === 0) {
        return <Text type="secondary">Actualización interna (sin cambios visibles)</Text>;
      }

      return (
        <div style={{ maxHeight: "150px", overflowY: "auto", fontSize: "12px" }}>
          {Object.entries(changes).map(([key, val]) => (
            <div key={key} style={{ marginBottom: 4 }}>
              <Text strong>{key}:</Text>{" "}
              <Text delete type="secondary" style={{ fontSize: "11px" }}>
                {String(val.from ?? "null")}
              </Text>
              {" → "}
              <Text type="success">{String(val.to ?? "null")}</Text>
            </div>
          ))}
        </div>
      );
    }

    // Caso INSERT
    if (!oldData && newData) {
      return (
        <div style={{ maxHeight: "100px", overflowY: "auto", fontSize: "11px", color: "#389e0d" }}>
          <pre>{JSON.stringify(newData, null, 2)}</pre>
        </div>
      );
    }

    // Caso DELETE
    if (oldData && !newData) {
      return (
        <div style={{ maxHeight: "100px", overflowY: "auto", fontSize: "11px", color: "#cf1322" }}>
          <Text type="danger">Datos eliminados:</Text>
          <pre>{JSON.stringify(oldData, null, 2)}</pre>
        </div>
      );
    }
  };

  return (
    <List
      title="📋 Logs de Auditoría"
      headerButtons={[]} // Sin botón de crear
      breadcrumb={false}
    >
      <Table {...tableProps} rowKey="id" scroll={{ x: 1000 }} size="small">
        <Table.Column
          dataIndex="changed_at"
          title="Fecha"
          width={160}
          render={(value) => (
            <DateField value={value} format="DD/MM/YYYY HH:mm" />
          )}
          sorter
        />

        <Table.Column
          dataIndex="operation"
          title="Acción"
          width={100}
          render={(value) => {
            const colors: Record<string, string> = {
              INSERT: "green",
              UPDATE: "blue",
              DELETE: "red",
            };
            return <Tag color={colors[value]}>{value}</Tag>;
          }}
          filterDropdown={(props) => (
            <FilterDropdown {...props}>
              <Select
                style={{ minWidth: 150 }}
                mode="multiple"
                placeholder="Filtrar acción"
                options={[
                  { label: "Crear (INSERT)", value: "INSERT" },
                  { label: "Editar (UPDATE)", value: "UPDATE" },
                  { label: "Eliminar (DELETE)", value: "DELETE" },
                ]}
              />
            </FilterDropdown>
          )}
        />

        <Table.Column
          dataIndex="table_name"
          title="Módulo"
          width={120}
          render={(value) => <Tag color="geekblue">{value.toUpperCase()}</Tag>}
        />

        <Table.Column
          title="Usuario"
          dataIndex="perfiles"
          width={200}
          render={(perfil) => perfil?.nombre_completo || <Text type="secondary">Sistema</Text>}
        />

        <Table.Column
          title="Detalles del Cambio"
          render={(_, record: any) => renderDiff(record.old_data, record.new_data)}
        />
      </Table>
    </List>
  );
}