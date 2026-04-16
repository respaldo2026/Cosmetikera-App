/**
 * Utilidades para cálculos de rentabilidad de cursos
 */

export interface DatosCurso {
  nombreCurso: string;
  duracionMeses: number;
  totalClasesCurso: number;
  horasPorClase: number;
  pagoPorHoraProfesor: number;
  precioMensualEstudiante: number;
  costoMaterialesPorEstudiante: number;
  numeroEstudiantes: number;
}

export interface ResultadosRentabilidad {
  costoMensualProfesor: number;
  costoTotalMensualMateriales: number;
  costoTotalMensual: number;
  ingresoMensualTotal: number;
  gananciaPerdidaMensual: number;
  puntoEquilibrio: number;
  gananciaTotalCurso: number;
  esRentable: boolean;
  margenGanancia: number; // Porcentaje
}

/**
 * Representa un escenario guardado de análisis de rentabilidad
 */
export interface EscenarioRentabilidad {
  id: string;
  nombre: string;
  fechaCreacion: string;
  // Datos de entrada
  datos: DatosCurso;
  // Resultados calculados
  resultados: ResultadosRentabilidad;
}

/**
 * Niveles de rentabilidad para indicadores visuales
 */
export type NivelRentabilidad = "alta" | "media" | "baja" | "perdida";

/**
 * Determina el nivel de rentabilidad basado en el margen de ganancia
 */
export const determinarNivelRentabilidad = (
  margenGanancia: number,
  esRentable: boolean
): NivelRentabilidad => {
  if (!esRentable) return "perdida";
  if (margenGanancia >= 30) return "alta";
  if (margenGanancia >= 15) return "media";
  return "baja";
};

/**
 * Obtiene el color asociado a un nivel de rentabilidad
 */
export const obtenerColorRentabilidad = (nivel: NivelRentabilidad): string => {
  switch (nivel) {
    case "alta":
      return "#52c41a"; // Verde
    case "media":
      return "#faad14"; // Amarillo
    case "baja":
      return "#ff7a45"; // Naranja
    case "perdida":
      return "#ff4d4f"; // Rojo
  }
};

/**
 * Obtiene la etiqueta de texto para un nivel de rentabilidad
 */
export const obtenerEtiquetaRentabilidad = (nivel: NivelRentabilidad): string => {
  switch (nivel) {
    case "alta":
      return "Alta";
    case "media":
      return "Media";
    case "baja":
      return "Baja";
    case "perdida":
      return "Pérdida";
  }
};

/**
 * Calcula el costo mensual del profesor
 */
export const calcularCostoMensualProfesor = (
  totalClasesCurso: number,
  duracionMeses: number,
  horasPorClase: number,
  pagoPorHora: number
): number => {
  const clasesPorMes = totalClasesCurso / duracionMeses;
  const horasMensuales = clasesPorMes * horasPorClase;
  return horasMensuales * pagoPorHora;
};

/**
 * Calcula el costo total mensual de materiales
 */
export const calcularCostoTotalMateriales = (
  costoMaterialesPorEstudiante: number,
  numeroEstudiantes: number
): number => {
  return costoMaterialesPorEstudiante * numeroEstudiantes;
};

/**
 * Calcula el ingreso mensual total
 */
export const calcularIngresoMensual = (
  precioMensual: number,
  numeroEstudiantes: number
): number => {
  return precioMensual * numeroEstudiantes;
};

/**
 * Calcula el punto de equilibrio (número mínimo de estudiantes)
 */
export const calcularPuntoEquilibrio = (
  costoMensualProfesor: number,
  precioMensualEstudiante: number,
  costoMaterialesPorEstudiante: number
): number => {
  const margenPorEstudiante = precioMensualEstudiante - costoMaterialesPorEstudiante;
  
  if (margenPorEstudiante <= 0) {
    return Infinity; // No hay punto de equilibrio posible
  }
  
  return Math.ceil(costoMensualProfesor / margenPorEstudiante);
};

/**
 * Calcula todos los resultados de rentabilidad
 */
export const calcularRentabilidad = (datos: DatosCurso): ResultadosRentabilidad => {
  // Costos
  const costoMensualProfesor = calcularCostoMensualProfesor(
    datos.totalClasesCurso,
    datos.duracionMeses,
    datos.horasPorClase,
    datos.pagoPorHoraProfesor
  );
  
  const costoTotalMensualMateriales = calcularCostoTotalMateriales(
    datos.costoMaterialesPorEstudiante,
    datos.numeroEstudiantes
  );
  
  const costoTotalMensual = costoMensualProfesor + costoTotalMensualMateriales;
  
  // Ingresos
  const ingresoMensualTotal = calcularIngresoMensual(
    datos.precioMensualEstudiante,
    datos.numeroEstudiantes
  );
  
  // Ganancia/Pérdida
  const gananciaPerdidaMensual = ingresoMensualTotal - costoTotalMensual;
  const gananciaTotalCurso = gananciaPerdidaMensual * datos.duracionMeses;
  
  // Punto de equilibrio
  const puntoEquilibrio = calcularPuntoEquilibrio(
    costoMensualProfesor,
    datos.precioMensualEstudiante,
    datos.costoMaterialesPorEstudiante
  );
  
  // Rentabilidad
  const esRentable = gananciaPerdidaMensual > 0;
  const margenGanancia = ingresoMensualTotal > 0 
    ? (gananciaPerdidaMensual / ingresoMensualTotal) * 100 
    : 0;
  
  return {
    costoMensualProfesor,
    costoTotalMensualMateriales,
    costoTotalMensual,
    ingresoMensualTotal,
    gananciaPerdidaMensual,
    puntoEquilibrio,
    gananciaTotalCurso,
    esRentable,
    margenGanancia,
  };
};

/**
 * Formatea números como moneda colombiana
 */
export const formatearMoneda = (valor: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
};

/**
 * Formatea porcentaje
 */
export const formatearPorcentaje = (valor: number): string => {
  return `${valor.toFixed(1)}%`;
};
