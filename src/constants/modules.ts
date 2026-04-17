// Centralized modules definitions

export interface ModuleDefinition {
  key: string;
  label: string;
}

export const MODULES: ModuleDefinition[] = [
  { key: "dashboard", label: "Vista rápida" },
  { key: "ventas", label: "Ventas" },
  { key: "historial", label: "Historial" },
  { key: "caja", label: "Caja / POS" },
  { key: "articulos", label: "Artículos" },
  { key: "compras", label: "Compras" },
  { key: "proveedores", label: "Proveedores" },
  { key: "fidelizacion", label: "Fidelización" },
  { key: "nomina", label: "Nómina" },
  { key: "marketing-center", label: "Marketing" },
  { key: "configuracion", label: "Configuración" },
];
