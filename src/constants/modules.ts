// Centralized modules definitions

export interface ModuleDefinition {
  key: string;
  label: string;
}

export const MODULES: ModuleDefinition[] = [
  { key: "cursos", label: "Servicios" },
  { key: "estudiantes", label: "Clientes" },
  { key: "matriculas", label: "Ventas y registros" },
  { key: "asistencias", label: "Asistencias" },
  { key: "profesores", label: "Equipo" },
  { key: "tesoreria", label: "Tesorería/Pagos" },
  { key: "caja", label: "Caja / POS" },
  { key: "nomina", label: "Nómina" },
  { key: "perfiles", label: "Perfiles" },
  { key: "leads", label: "Leads" },
  { key: "catalogo", label: "Catálogo comercial" },
  { key: "inventario", label: "Inventario" },
  { key: "planificador", label: "Planificador" },
  { key: "portal-estudiante", label: "Portal clientes" },
  { key: "configuracion", label: "Configuración" },
];
