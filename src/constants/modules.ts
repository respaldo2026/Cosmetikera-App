// Centralized modules definitions

export interface ModuleDefinition {
  key: string;
  label: string;
}

export const MODULES: ModuleDefinition[] = [
  { key: "cursos", label: "Cursos" },
  { key: "estudiantes", label: "Estudiantes" },
  { key: "matriculas", label: "Matrículas" },
  { key: "asistencias", label: "Asistencias" },
  { key: "profesores", label: "Profesores" },
  { key: "tesoreria", label: "Tesorería/Pagos" },
  { key: "caja", label: "Caja / POS" },
  { key: "nomina", label: "Nómina" },
  { key: "perfiles", label: "Perfiles" },
  { key: "leads", label: "Leads" },
  { key: "catalogo", label: "Catálogo cursos" },
  { key: "inventario", label: "Inventario" },
  { key: "planificador", label: "Planificador" },
  { key: "portal-estudiante", label: "Portal Estudiante" },
  { key: "configuracion", label: "Configuración" },
];
