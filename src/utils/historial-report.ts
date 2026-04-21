import type { HistorialStatsReport } from "@/app/historial/stats";

export async function descargarInformeHistorialPDF(stats: HistorialStatsReport, generatedAt: string, filtersSummary: string) {
  const React = (await import("react")).default;
  const [{ pdf }, { HistorialEstadisticoPDF }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/pdf/HistorialEstadisticoPDF"),
  ]);

  const doc = React.createElement(HistorialEstadisticoPDF, {
    stats,
    generatedAt,
    filtersSummary,
  });
  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `Informe_historial_${Date.now()}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}