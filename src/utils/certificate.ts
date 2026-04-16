// @ts-nocheck
import React from "react";
import { pdf } from "@react-pdf/renderer";
import { DiplomaPDF } from "@components/pdf/DiplomaPDF";

export interface CertificateData {
  estudianteName: string;
  courseName: string;
  fechaFinalizacion: string;
  folio: string;
}

/**
 * Genera y descarga un certificado en PDF
 * @param data Datos del certificado (estudiante, curso, fecha)
 */
export const descargarCertificado = async (data: CertificateData) => {
  try {
    const doc = React.createElement(DiplomaPDF, {
      estudiante: data.estudianteName,
      curso: data.courseName,
      fechaFin: data.fechaFinalizacion,
      folio: data.folio,
    }) as React.ReactElement;

    const blob = await pdf(doc).toBlob();
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `Certificado_${data.estudianteName}_${data.courseName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error descargando certificado:", error);
    throw new Error("No se pudo descargar el certificado");
  }
};

/**
 * Abre el certificado en una nueva ventana (preview)
 * @param data Datos del certificado
 */
export const previewCertificado = async (data: CertificateData) => {
  try {
    const doc = React.createElement(DiplomaPDF, {
      estudiante: data.estudianteName,
      curso: data.courseName,
      fechaFin: data.fechaFinalizacion,
      folio: data.folio,
    }) as React.ReactElement;

    const blob = await pdf(doc).toBlob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  } catch (error) {
    console.error("Error abriendo certificado:", error);
    throw new Error("No se pudo abrir el certificado");
  }
};
