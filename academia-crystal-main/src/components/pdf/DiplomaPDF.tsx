"use client";

import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

// Estilos del PDF (CSS-in-JS para PDFs)
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 40,
    alignItems: 'center',
  },
  border: {
    border: '4px solid #D4AF37', // Color Dorado
    width: '100%',
    height: '100%',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    fontSize: 30,
    marginBottom: 10,
    textTransform: 'uppercase',
    color: '#333',
    fontWeight: 'bold',
  },
  subHeader: {
    fontSize: 14,
    color: '#666',
    marginBottom: 30,
  },
  studentName: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold', // Fuente estándar segura
    color: '#000',
    marginBottom: 10,
    textDecoration: 'underline',
  },
  bodyText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 50,
    lineHeight: 1.5,
  },
  courseName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1d39c4', // Azul institucional
    marginBottom: 20,
  },
  footer: {
    marginTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
  },
  signatureLine: {
    borderTop: '1px solid #000',
    width: 200,
    textAlign: 'center',
    paddingTop: 5,
    fontSize: 12,
  },
  verification: {
    position: 'absolute',
    bottom: 20,
    fontSize: 8,
    color: '#999',
  },
});

interface DiplomaProps {
  estudiante: string;
  curso: string;
  fechaFin: string;
  folio: string; // El ID de la matrícula
}

export const DiplomaPDF = ({ estudiante, curso, fechaFin, folio }: DiplomaProps) => (
  <Document>
    <Page size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.border}>
        
        {/* TÍTULO */}
        <Text style={styles.header}>CERTIFICADO DE EXCELENCIA</Text>
        <Text style={styles.subHeader}>La Academia Crystal otorga el presente reconocimiento a:</Text>

        {/* NOMBRE ESTUDIANTE */}
        <Text style={styles.studentName}>{estudiante}</Text>

        {/* CUERPO */}
        <Text style={styles.bodyText}>
          Por haber completado y aprobado satisfactoriamente los requisitos académicos del curso teórico-práctico de:
        </Text>

        {/* NOMBRE CURSO */}
        <Text style={styles.courseName}>{curso}</Text>

        <Text style={styles.bodyText}>
          Finalizado el día {dayjs(fechaFin).format('DD [de] MMMM [de] YYYY')}.
        </Text>

        {/* FIRMAS */}
        <View style={styles.footer}>
          <View>
            <Text style={styles.signatureLine}>Directora Académica</Text>
          </View>
          <View>
            <Text style={styles.signatureLine}>Instructor Líder</Text>
          </View>
        </View>

        {/* SEGURIDAD */}
        <Text style={styles.verification}>
          Folio de Verificación Único: {folio} | Generado digitalmente por Academia Crystal App
        </Text>

      </View>
    </Page>
  </Document>
);