import { supabaseBrowserClient } from "@utils/supabase/client";

const TICKETS_BUCKET = "pagos-tickets";

const sanitizeSegment = (segment: string) => segment.replace(/[^a-zA-Z0-9_-]/g, "_");

export interface TicketUploadParams {
  blob: Blob;
  pagoId: string;
  estudianteId?: string | null;
}

export interface TicketUploadResult {
  path: string;
  publicUrl: string;
}

export const subirTicketPago = async ({ blob, pagoId, estudianteId }: TicketUploadParams): Promise<TicketUploadResult> => {
  const folder = sanitizeSegment(estudianteId ?? "sin_estudiante");
  const filePath = `${folder}/${sanitizeSegment(pagoId)}.pdf`;

  const { error: uploadError } = await supabaseBrowserClient.storage
    .from(TICKETS_BUCKET)
    .upload(filePath, blob, {
      cacheControl: "3600",
      upsert: true,
      contentType: "application/pdf",
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicData } = supabaseBrowserClient.storage
    .from(TICKETS_BUCKET)
    .getPublicUrl(filePath);

  if (!publicData?.publicUrl) {
    throw new Error("No se pudo obtener la URL pública del ticket");
  }

  return {
    path: filePath,
    publicUrl: publicData.publicUrl,
  };
};
