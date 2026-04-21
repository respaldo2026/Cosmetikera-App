"use client";

import React from "react";
import * as ReactPDF from "@react-pdf/renderer";
import type { HistorialStatsReport } from "@/app/historial/stats";

const { Document, Page, StyleSheet, Text, View } = ReactPDF;

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 10,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 16,
    borderBottom: "1px solid #d9d9d9",
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#666666",
  },
  section: {
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
  },
  grid: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statCard: {
    width: "48%",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 9,
    color: "#666666",
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 700,
  },
  row: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottom: "1px solid #f0f0f0",
    paddingTop: 4,
    paddingBottom: 4,
  },
  rowLabel: {
    width: "58%",
    paddingRight: 8,
  },
  rowValue: {
    width: "22%",
    textAlign: "right",
  },
  rowCount: {
    width: "20%",
    textAlign: "right",
    color: "#666666",
  },
});

type Props = {
  stats: HistorialStatsReport;
  generatedAt: string;
  filtersSummary: string;
};

const formatMoney = (value: number) => `$${Math.round(value).toLocaleString("es-CO")}`;

const RankingSection = ({
  title,
  rows,
  showCount = true,
}: {
  title: string;
  rows: Array<{ label: string; value: number; count?: number }>;
  showCount?: boolean;
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {rows.length === 0 ? (
      <Text style={styles.subtitle}>Sin datos para este filtro.</Text>
    ) : rows.map((row, index) => (
      <View key={`${title}-${row.label}-${index}`} style={styles.row}>
        <Text style={styles.rowLabel}>{index + 1}. {row.label}</Text>
        <Text style={styles.rowValue}>{formatMoney(row.value)}</Text>
        <Text style={styles.rowCount}>{showCount ? `${row.count || 0}` : ""}</Text>
      </View>
    ))}
  </View>
);

export const HistorialEstadisticoPDF = ({ stats, generatedAt, filtersSummary }: Props) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Informe estadistico del historial</Text>
        <Text style={styles.subtitle}>Generado: {generatedAt}</Text>
        <Text style={styles.subtitle}>Filtros aplicados: {filtersSummary}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resumen ejecutivo</Text>
        <View style={styles.grid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Numero de ventas</Text>
            <Text style={styles.statValue}>{stats.totalVentas}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Facturacion</Text>
            <Text style={styles.statValue}>{formatMoney(stats.totalFacturado)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Beneficio</Text>
            <Text style={styles.statValue}>{formatMoney(stats.beneficioTotal)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Ticket promedio</Text>
            <Text style={styles.statValue}>{formatMoney(stats.ticketPromedio)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Unidades vendidas</Text>
            <Text style={styles.statValue}>{stats.unidadesVendidas}</Text>
          </View>
        </View>
      </View>

      <RankingSection title="Productos mas vendidos" rows={stats.topProductos} />
      <RankingSection title="Categorias mas vendidas" rows={stats.topCategorias} />
      <RankingSection title="Clientes con mayor compra" rows={stats.topClientes} />
      <RankingSection title="Beneficio por categoria" rows={stats.beneficioPorCategoria.map((item) => ({ ...item, count: 0 }))} showCount={false} />
      <RankingSection title="Ventas por forma de pago" rows={stats.ventasPorFormaPago.map((item) => ({ ...item, count: 0 }))} showCount={false} />
      <RankingSection title="Ventas por dia de la semana" rows={stats.ventasPorDiaSemana.map((item) => ({ ...item, count: 0 }))} showCount={false} />
      <RankingSection title="Ventas por mes" rows={stats.ventasPorMes.map((item) => ({ ...item, count: 0 }))} showCount={false} />
    </Page>
  </Document>
);