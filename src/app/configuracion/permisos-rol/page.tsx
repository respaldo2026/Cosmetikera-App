"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Table, Switch, message, Spin, Button } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";

interface PermisosPorRol {
  [rol: string]: {
    [modulo: string]: boolean;
  };
}

export default function PermisosRolPage() {
  const [permisos, setPermisos] = useState<PermisosPorRol>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Memoizar la lista de módulos
  const modulos = useMemo(() => [
    { key: "estudiantes", label: "Estudiantes" },
    { key: "profesores", label: "Profesores" },
    { key: "cursos", label: "Cursos/Grupos" },
    { key: "catalogo", label: "Catálogo cursos" },
    { key: "leads", label: "Leads" },
    { key: "planificador", label: "Planificador" },
    { key: "matriculas", label: "Matrículas" },
    { key: "nomina", label: "Nómina" },
    { key: "tesoreria", label: "Tesorería" },
    { key: "caja", label: "Caja / POS" },
    { key: "configuracion", label: "Configuración" },
  ], []);

  // Memoizar la lista de roles
  const roles = useMemo(() => [
    "administrativo",
    "profesor",
    "estudiante",
  ], []);

  const cargarPermisos = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabaseBrowserClient
        .from("role_permissions")
        .select("*");

      if (error) throw error;

      const permisosMap: PermisosPorRol = {};
      
      if (data && data.length > 0) {
        data.forEach((row: any) => {
          permisosMap[row.rol] = row.permisos || {};
        });
      }

      // Inicializar roles sin permisos
      roles.forEach(rol => {
        if (!permisosMap[rol]) {
          permisosMap[rol] = {};
        }
      });

      setPermisos(permisosMap);
    } catch (error: any) {
      message.error("Error al cargar permisos: " + error.message);
    } finally {
      setLoading(false);
    }
  }, [roles]);

  useEffect(() => {
    cargarPermisos();
  }, [cargarPermisos]);

  const handleTogglePermiso = useCallback((rol: string, modulo: string, valor: boolean) => {
    setPermisos(prev => ({
      ...prev,
      [rol]: {
        ...prev[rol],
        [modulo]: valor,
      },
    }));
    setHasChanges(true);
  }, []);

  const guardarPermisos = useCallback(async () => {
    try {
      setSaving(true);

      // Guardar cada rol
      for (const rol of roles) {
        const { error } = await supabaseBrowserClient
          .from("role_permissions")
          .upsert({
            rol,
            permisos: permisos[rol] || {},
          });

        if (error) throw error;
      }

      message.success("Permisos guardados correctamente");
      setHasChanges(false);
    } catch (error: any) {
      message.error("Error al guardar: " + error.message);
    } finally {
      setSaving(false);
    }
  }, [roles, permisos]);

  // Memoizar las columnas de la tabla
  const columns = useMemo(() => [
    {
      title: "Módulo",
      dataIndex: "modulo",
      key: "modulo",
      fixed: "left" as const,
      width: 150,
    },
    ...roles.map(rol => ({
      title: rol.charAt(0).toUpperCase() + rol.slice(1),
      dataIndex: rol,
      key: rol,
      width: 120,
      render: (_: any, record: any) => (
        <Switch
          checked={permisos[rol]?.[record.key] || false}
          onChange={(checked) => handleTogglePermiso(rol, record.key, checked)}
          disabled={saving}
        />
      ),
    })),
  ], [roles, permisos, saving, handleTogglePermiso]);

  // Memoizar los datos de la tabla
  const dataSource = useMemo(() => 
    modulos.map(modulo => ({
      key: modulo.key,
      modulo: modulo.label,
    })),
    [modulos]
  );

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3>Gestión de Permisos por Rol</h3>
          <p style={{ color: "#666", marginBottom: 0 }}>
            Configura qué módulos puede acceder cada rol
          </p>
        </div>
        {hasChanges && (
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={guardarPermisos}
            loading={saving}
          >
            Guardar Cambios
          </Button>
        )}
      </div>

      <Table
        dataSource={dataSource}
        columns={columns}
        pagination={false}
        scroll={{ x: 800 }}
        bordered
      />
    </div>
  );
}
