import { supabaseBrowserClient } from "@utils/supabase/client";
import type { MovimientoCategoria, MovimientoTipo } from "@constants/movimientos";

export interface MovimientoFinanciero {
    id: string;
    fecha: string;
    tipo: MovimientoTipo;
    monto: number;
    concepto: string;
    categoria?: MovimientoCategoria | string | null;
    metodo_pago?: string | null;
    referencia?: string | null;
    descripcion?: string | null;
    estudiante_id?: string | null;
    proveedor_id?: string | null;
    ticket_url?: string | null;
    pago_id?: string | null;
    conciliado: boolean;
    conciliado_el?: string | null;
    conciliado_por?: string | null;
    created_at: string;
    created_by?: string | null;
    perfiles?: { nombre_completo?: string | null; telefono?: string | null } | null;
    proveedores?: { nombre_completo?: string | null } | null;
}

export type MovimientoFiltro = {
    fechaDesde?: string;
    fechaHasta?: string;
    tipo?: MovimientoTipo;
    categoria?: string;
    metodo?: string;
    conciliado?: boolean;
    texto?: string;
};

export async function listarMovimientos(filtros: MovimientoFiltro = {}, options?: { userId?: string | null; esAdmin?: boolean }) {
    const { userId, esAdmin } = options || {};

    const query = supabaseBrowserClient
        .from("movimientos_financieros")
        .select(`*, perfiles:perfiles!movimientos_financieros_estudiante_id_fkey(nombre_completo, telefono), proveedores:perfiles!movimientos_financieros_proveedor_id_fkey(nombre_completo)`)
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false });

    // Si no es admin, limitamos a los movimientos creados por el usuario para evitar bloqueos por RLS
    if (!esAdmin && userId) {
        query.eq("created_by", userId);
    }

    if (filtros.fechaDesde) {
        query.gte("fecha", filtros.fechaDesde);
    }
    if (filtros.fechaHasta) {
        query.lte("fecha", filtros.fechaHasta);
    }
    if (filtros.tipo) {
        query.eq("tipo", filtros.tipo);
    }
    if (filtros.categoria) {
        query.eq("categoria", filtros.categoria);
    }
    if (filtros.metodo) {
        query.eq("metodo_pago", filtros.metodo);
    }
    if (typeof filtros.conciliado === "boolean") {
        query.eq("conciliado", filtros.conciliado);
    }
    if (filtros.texto) {
        query.or(
            [
                `concepto.ilike.%${filtros.texto}%`,
                `categoria.ilike.%${filtros.texto}%`,
                `metodo_pago.ilike.%${filtros.texto}%`,
                `referencia.ilike.%${filtros.texto}%`,
            ].join(",")
        );
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as MovimientoFinanciero[];
}

export async function crearMovimiento(payload: {
    fecha: string;
    tipo: MovimientoTipo;
    monto: number;
    concepto: string;
    categoria?: string;
    metodo_pago?: string | null;
    referencia?: string | null;
    descripcion?: string | null;
    estudiante_id?: string | null;
    proveedor_id?: string | null;
    ticket_url?: string | null;
    pago_id?: string | null;
    created_by?: string | null;
}) {
    const { data, error } = await supabaseBrowserClient
        .from("movimientos_financieros")
        .insert(payload)
        .select()
        .maybeSingle();

    if (error) throw error;
    return data as MovimientoFinanciero;
}

export async function actualizarMovimiento(id: string, payload: Partial<Omit<MovimientoFinanciero, "id" | "created_at">>) {
    const { data, error } = await supabaseBrowserClient
        .from("movimientos_financieros")
        .update(payload)
        .eq("id", id)
        .select()
        .maybeSingle();

    if (error) throw error;
    return data as MovimientoFinanciero;
}

export async function eliminarMovimiento(id: string) {
    const response = await fetch("/api/tesoreria/delete-movimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movimientoId: id }),
    });

    const result = await response.json();

    if (!response.ok || !result?.success) {
        throw new Error(result?.error || "No se pudo eliminar el movimiento. Verifica permisos o que el registro exista.");
    }

    return true;
}

export async function registrarIngresoDesdePago(payload: {
    fecha: string;
    monto: number;
    concepto: string;
    categoria?: string;
    metodo_pago?: string | null;
    referencia?: string | null;
    descripcion?: string | null;
    estudiante_id?: string | null;
    ticket_url?: string | null;
    pago_id?: string | null;
    created_by?: string | null;
}) {
    const record = {
        ...payload,
        tipo: "ingreso" as MovimientoTipo,
    };

    if (payload.pago_id) {
        const { data, error } = await supabaseBrowserClient
            .from("movimientos_financieros")
            .upsert(record, { onConflict: "pago_id" })
            .select()
            .maybeSingle();

        if (error) throw error;
        return data as MovimientoFinanciero;
    }

    return crearMovimiento(record);
}

export async function sincronizarIngresosDesdePagos(createdBy?: string | null) {
    const { data: pagosPagados, error: pagosError } = await supabaseBrowserClient
        .from("pagos")
        .select("id, fecha_pago, monto, metodo_pago, referencia, observaciones, estudiante_id, ticket_url, periodo_pagado, numero_cuota, matriculas!pagos_matricula_id_fkey(cursos(nombre))")
        .eq("estado", "pagado")
        .not("fecha_pago", "is", null);

    if (pagosError) throw pagosError;

    if (!pagosPagados || pagosPagados.length === 0) {
        return { totalPagos: 0, sincronizados: 0 };
    }

    const registros = (pagosPagados as any[])
        .filter((p) => Number(p?.monto || 0) > 0)
        .map((p) => {
            const fecha = String(p.fecha_pago).slice(0, 10);
            const periodo = p.periodo_pagado || `Cuota ${p.numero_cuota ?? ""}`.trim();
            const curso = p?.matriculas?.cursos?.nombre || "Curso";
            const textoPeriodo = String(periodo || "").toLowerCase();
            const esInscripcion = textoPeriodo.includes("inscrip") || textoPeriodo.includes("matric") || Number(p.numero_cuota) === 0;

            return {
                fecha,
                tipo: "ingreso" as MovimientoTipo,
                monto: Number(p.monto || 0),
                concepto: `${periodo || "Pago"} - ${curso}`,
                categoria: esInscripcion ? "inscripciones" : "matriculas",
                metodo_pago: p.metodo_pago || null,
                referencia: p.referencia || p.id,
                descripcion: p.observaciones || null,
                estudiante_id: p.estudiante_id || null,
                ticket_url: p.ticket_url || null,
                pago_id: p.id,
                created_by: createdBy || null,
            };
        });

    if (registros.length === 0) {
        return { totalPagos: pagosPagados.length, sincronizados: 0 };
    }

    const { error: upsertError } = await supabaseBrowserClient
        .from("movimientos_financieros")
        .upsert(registros, { onConflict: "pago_id" });

    if (upsertError) throw upsertError;

    return { totalPagos: pagosPagados.length, sincronizados: registros.length };
}
