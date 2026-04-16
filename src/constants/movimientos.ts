export const MOVIMIENTO_TIPO = {
    INGRESO: "ingreso",
    EGRESO: "egreso",
} as const;

export const MOVIMIENTO_CATEGORIAS = [
    "matriculas",
    "inscripciones",
    "materiales",
    "nomina",
    "servicios",
    "infraestructura",
    "marketing",
    "otros",
] as const;

export type MovimientoTipo = typeof MOVIMIENTO_TIPO[keyof typeof MOVIMIENTO_TIPO];
export type MovimientoCategoria = typeof MOVIMIENTO_CATEGORIAS[number];

export const MOVIMIENTO_TIPO_LABEL: Record<MovimientoTipo, string> = {
    [MOVIMIENTO_TIPO.INGRESO]: "Ingreso",
    [MOVIMIENTO_TIPO.EGRESO]: "Egreso",
};

export const MOVIMIENTO_TIPO_COLOR: Record<MovimientoTipo, string> = {
    [MOVIMIENTO_TIPO.INGRESO]: "green",
    [MOVIMIENTO_TIPO.EGRESO]: "volcano",
};
