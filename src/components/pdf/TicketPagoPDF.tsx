"use client";

import React from "react";
import * as ReactPDF from "@react-pdf/renderer";
import { construirNombreGrupo } from "@utils/grupos";

const { Page, Text, View, Document, StyleSheet, Image } = ReactPDF;

const styles = StyleSheet.create({
  page: {
    paddingTop: 10,
    paddingRight: 10,
    paddingBottom: 10,
    paddingLeft: 10,
    backgroundColor: "#ffffff",
    fontSize: 9,
    fontFamily: "Helvetica",
  },
  header: {
    textAlign: "center",
    marginBottom: 6,
  },
  logo: {
    width: 104,
    maxHeight: 42,
    objectFit: "contain",
    alignSelf: "center",
    marginBottom: 4,
  },
  ticketTitle: {
    fontSize: 11,
    fontWeight: 600,
    marginBottom: 2,
  },
  title: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 9,
    color: "#555555",
  },
  details: {
    borderTop: "1px dashed #cccccc",
    paddingTop: 5,
    marginBottom: 5,
  },
  row: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  section: {
    marginBottom: 5,
    borderBottom: "1px dashed #cccccc",
    paddingBottom: 4,
  },
  label: {
    fontWeight: "bold",
  },
  value: {
    marginBottom: 1,
  },
  footer: {
    textAlign: "center",
    marginTop: 6,
    fontSize: 8.5,
    color: "#555555",
  },
});

const truncarTexto = (valor: string | null | undefined, max: number) => {
  const texto = String(valor || "").trim();
  if (!texto) return "";
  if (texto.length <= max) return texto;
  return `${texto.slice(0, Math.max(0, max - 1)).trim()}…`;
};

export interface TicketCamposVisibles {
  logo: boolean;
  nombreAcademia: boolean;
  ruc: boolean;
  direccion: boolean;
  telefono: boolean;
  email: boolean;
  fecha: boolean;
  concepto: boolean;
  monto: boolean;
  nota: boolean;
  pie: boolean;
  titulo: boolean;
}

const TICKET_CAMPOS_DEFAULT: TicketCamposVisibles = {
  logo: true,
  nombreAcademia: true,
  ruc: true,
  direccion: true,
  telefono: true,
  email: true,
  fecha: true,
  concepto: true,
  monto: true,
  nota: true,
  pie: true,
  titulo: true,
};

export interface TicketPagoData {
  academia: {
    nombre: string;
    ruc?: string | null;
    logoUrl?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    email?: string | null;
    ticketTitulo?: string | null;
    ticketNota?: string | null;
    ticketPie?: string | null;
    ticketCampos?: Partial<TicketCamposVisibles> | null;
  };
  estudiante: {
    nombre: string;
    identificacion?: string | null;
    telefono?: string | null;
  };
  pago: {
    referencia?: string | null;
    metodo?: string | null;
    concepto?: string | null;
    monto: number;
    fecha: string;
    periodo?: string | null;
    numeroCuota?: number | null;
    valorEntregado?: number | null;
    cambio?: number | null;
  };
  curso?: {
    nombre?: string | null;
  };
}

const formatearCOP = (valor: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(valor);

const normalizarCampos = (campos?: Partial<TicketCamposVisibles> | null): TicketCamposVisibles => ({
  ...TICKET_CAMPOS_DEFAULT,
  ...(campos ?? {}),
});

export const TicketPagoPDF: React.FC<TicketPagoData> = ({ academia, estudiante, pago, curso }) => {
  const campos = normalizarCampos(academia.ticketCampos);
  const conceptoBase =
    pago.concepto ||
    pago.periodo ||
    (pago.numeroCuota ? `Cuota ${pago.numeroCuota}` : null) ||
    "Pago";
  const concepto = truncarTexto(conceptoBase, 92);
  const nombreEstudiante = truncarTexto(estudiante.nombre, 56);
  const nombreCurso = curso ? truncarTexto(construirNombreGrupo(curso), 70) : "";
  const metodo = truncarTexto(pago.metodo, 28);
  const referencia = truncarTexto(pago.referencia, 32);

  return (
    <Document>
      <Page size={[226.77, 520]} style={styles.page}>
        <View style={styles.header}>
          {campos.logo && academia.logoUrl ? <Image style={styles.logo} src={academia.logoUrl} /> : null}
          {campos.nombreAcademia ? <Text style={styles.title}>{academia.nombre}</Text> : null}
          {campos.ruc && academia.ruc ? <Text style={styles.subtitle}>RUC/NIT: {academia.ruc}</Text> : null}
          {campos.direccion && academia.direccion ? <Text style={styles.subtitle}>{academia.direccion}</Text> : null}
          {campos.telefono && academia.telefono ? <Text style={styles.subtitle}>Tel: {academia.telefono}</Text> : null}
          {campos.email && academia.email ? <Text style={styles.subtitle}>{academia.email}</Text> : null}
        </View>

        <View style={styles.details}>
          {campos.titulo ? (
            <Text style={styles.ticketTitle}>{academia.ticketTitulo || "Recibo de Pago"}</Text>
          ) : null}
          {campos.fecha ? (
            <Text style={[styles.subtitle, { marginBottom: 4 }]}>Fecha: {pago.fecha}</Text>
          ) : null}
          {campos.concepto ? (
            <View style={styles.row}>
              <Text>Concepto</Text>
              <Text>{concepto}</Text>
            </View>
          ) : null}
          {campos.monto ? (
            <View style={styles.row}>
              <Text>Monto</Text>
              <Text>{formatearCOP(pago.monto)}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Estudiante:</Text>
          <Text style={styles.value}>{nombreEstudiante}</Text>
          {estudiante.identificacion ? (
            <>
              <Text style={styles.label}>Documento:</Text>
              <Text style={styles.value}>{estudiante.identificacion}</Text>
            </>
          ) : null}
          {curso ? (
            <>
              <Text style={styles.label}>Curso:</Text>
              <Text style={styles.value}>{nombreCurso}</Text>
            </>
          ) : null}
          {metodo ? (
            <>
              <Text style={styles.label}>Método:</Text>
              <Text style={styles.value}>{metodo}</Text>
            </>
          ) : null}
          {referencia ? (
            <>
              <Text style={styles.label}>Referencia:</Text>
              <Text style={styles.value}>{referencia}</Text>
            </>
          ) : null}
          {pago.valorEntregado ? (
            <>
              <Text style={styles.label}>Valor entregado:</Text>
              <Text style={styles.value}>{formatearCOP(pago.valorEntregado)}</Text>
            </>
          ) : null}
          {pago.cambio !== undefined && pago.cambio !== null ? (
            <>
              <Text style={styles.label}>Cambio:</Text>
              <Text style={styles.value}>{formatearCOP(pago.cambio)}</Text>
            </>
          ) : null}
          {estudiante.telefono ? <Text style={styles.value}>Contacto estudiante: {estudiante.telefono}</Text> : null}
        </View>

        {campos.nota && academia.ticketNota ? (
          <View style={styles.section}>
            <Text>{academia.ticketNota}</Text>
          </View>
        ) : null}

        {campos.pie ? (
          <Text style={styles.footer}>{academia.ticketPie || "Gracias por su pago. Conserva este comprobante."}</Text>
        ) : null}
      </Page>
    </Document>
  );
};
