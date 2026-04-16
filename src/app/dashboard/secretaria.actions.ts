import { supabaseBrowserClient } from "@utils/supabase/client";

export async function crearMatricula({ cursoId, estudianteId }: { cursoId: string, estudianteId: string }) {
  const { data, error } = await supabaseBrowserClient
    .from("matriculas")
    .insert([
      {
        curso_id: cursoId,
        estudiante_id: estudianteId,
        estado: "activo",
        created_at: new Date().toISOString(),
      },
    ]);
  return { data, error };
}

export async function registrarPago({ pagoId }: { pagoId: string }) {
  const { data, error } = await supabaseBrowserClient
    .from("pagos")
    .update({ estado: "pagado", fecha_pago: new Date().toISOString() })
    .eq("id", pagoId);
  return { data, error };
}
