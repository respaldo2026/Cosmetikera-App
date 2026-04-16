import { useState, useCallback } from "react";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { message } from "antd";

export const useTemasCurso = () => {
    const [temasCurso, setTemasCurso] = useState<any[]>([]);
    const [loadingTemas, setLoadingTemas] = useState(false);
    const [guardandoTema, setGuardandoTema] = useState(false);

    const cargarTemas = useCallback(async (cursoId: string) => {
        setLoadingTemas(true);
        const { data, error } = await supabaseBrowserClient
            .from("temas_curso")
            .select("*")
            .eq("curso_id", cursoId)
            .order("orden", { ascending: true });
        
        if (!error) {
            setTemasCurso(data || []);
        }
        setLoadingTemas(false);
        return data || [];
    }, []);

    const guardarTema = async (cursoId: string, values: any, onSuccess?: () => void) => {
        setGuardandoTema(true);
        try {
            const { error } = await supabaseBrowserClient.from("temas_curso").insert({
                ...values,
                curso_id: cursoId
            });

            if (error) throw error;

            message.success("Tema agregado");
            await cargarTemas(cursoId);
            if (onSuccess) onSuccess();

        } catch (error: any) {
            message.error("Error: " + error.message);
        } finally {
            setGuardandoTema(false);
        }
    };

    return {
        temasCurso,
        setTemasCurso,
        loadingTemas,
        guardandoTema,
        cargarTemas,
        guardarTema
    };
};