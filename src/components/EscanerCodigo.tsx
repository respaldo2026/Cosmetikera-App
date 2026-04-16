"use client";

/**
 * EscanerCodigo — Componente lector de códigos de barras y QR
 *
 * Soporta dos modos:
 *  1. USB/Bluetooth HID: El lector actúa como teclado. Se captura en un
 *     campo de texto oculto y se detecta cuando llega el carácter Enter (terminator).
 *  2. Cámara: Usa html5-qrcode para escanear con la cámara del dispositivo.
 *     Soporta: QR, EAN-13, EAN-8, UPC-A, UPC-E, Code128, Code39, ITF, etc.
 *
 * Uso:
 *  <EscanerCodigo onCodigo={(codigo) => buscarArticulo(codigo)} />
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Button, Input, Modal, Space, Tag, Tooltip, Typography } from "antd";
import { BarcodeOutlined, CameraOutlined, CloseOutlined } from "@ant-design/icons";

const { Text } = Typography;

export type EscanerCodigoProps = {
  /** Callback cuando se detecta un código */
  onCodigo: (codigo: string) => void;
  /** Placeholder del campo de input manual */
  placeholder?: string;
  /** Si mostrar botón de cámara */
  conCamara?: boolean;
  /** Disabled */
  disabled?: boolean;
};

// ID único para el div de la cámara
const CAMERA_DIV_ID = "qr-reader-cosmetikera";

export default function EscanerCodigo({
  onCodigo,
  placeholder = "Escanear o escribir código...",
  conCamara = true,
  disabled = false,
}: EscanerCodigoProps) {
  const [valor, setValor] = useState("");
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const [escanerActivo, setEscanerActivo] = useState(false);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const inputRef = useRef<any>(null);
  const html5QrRef = useRef<any>(null);

  // ── Foco automático para lectores USB HID ──────────────────────────────────
  useEffect(() => {
    // Mantener el input enfocado para capturar el lector USB (actúa como teclado)
    const intervalo = setInterval(() => {
      if (!camaraAbierta && document.activeElement !== inputRef.current?.input) {
        inputRef.current?.focus();
      }
    }, 2000);
    return () => clearInterval(intervalo);
  }, [camaraAbierta]);

  // ── Detección de código por teclado (lector USB/BT) ──────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && valor.trim()) {
        e.preventDefault();
        onCodigo(valor.trim());
        setValor("");
      }
    },
    [valor, onCodigo]
  );

  // ── Cámara: abrir / cerrar ────────────────────────────────────────────────
  const abrirCamara = async () => {
    setErrorCamara(null);
    setCamaraAbierta(true);
  };

  const cerrarCamara = async () => {
    try {
      if (html5QrRef.current && escanerActivo) {
        await html5QrRef.current.stop();
        html5QrRef.current.clear();
      }
    } catch (_) {}
    setEscanerActivo(false);
    setCamaraAbierta(false);
  };

  // Iniciar escáner cuando el modal esté abierto
  useEffect(() => {
    if (!camaraAbierta) return;

    let mounted = true;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode(CAMERA_DIV_ID);
        html5QrRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" }, // cámara trasera preferida
          {
            fps: 15,
            qrbox: { width: 250, height: 180 },
            aspectRatio: 1.5,
            disableFlip: false,
          },
          (decodedText: string) => {
            if (mounted) {
              onCodigo(decodedText.trim());
              cerrarCamara();
            }
          },
          () => {} // error silencioso por frame
        );

        if (mounted) setEscanerActivo(true);
      } catch (e: any) {
        if (mounted) {
          setErrorCamara(
            e?.message?.includes("Permission")
              ? "Permiso de cámara denegado. Habilítalo en el navegador."
              : "No se pudo iniciar la cámara."
          );
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [camaraAbierta]); // eslint-disable-line

  return (
    <>
      <Space.Compact style={{ width: "100%" }}>
        <Input
          ref={inputRef}
          prefix={<BarcodeOutlined style={{ color: "#d81b87" }} />}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          style={{ borderRadius: "8px 0 0 8px" }}
        />
        {conCamara && (
          <Tooltip title="Escanear con cámara">
            <Button
              icon={<CameraOutlined />}
              onClick={abrirCamara}
              disabled={disabled}
              style={{
                borderRadius: "0 8px 8px 0",
                background: "#d81b87",
                color: "#fff",
                border: "none",
              }}
            />
          </Tooltip>
        )}
      </Space.Compact>

      <Modal
        title={
          <Space>
            <CameraOutlined style={{ color: "#d81b87" }} />
            <span>Escanear código</span>
            <Tag color="pink" style={{ marginLeft: 8 }}>
              QR · EAN · Code128 · UPC
            </Tag>
          </Space>
        }
        open={camaraAbierta}
        onCancel={cerrarCamara}
        footer={
          <Button icon={<CloseOutlined />} onClick={cerrarCamara}>
            Cancelar
          </Button>
        }
        width={400}
        centered
        destroyOnClose
      >
        {errorCamara ? (
          <div style={{ textAlign: "center", padding: 24, color: "#ff4d4f" }}>
            <Text type="danger">{errorCamara}</Text>
          </div>
        ) : (
          <>
            <div
              id={CAMERA_DIV_ID}
              style={{ width: "100%", minHeight: 280, borderRadius: 8, overflow: "hidden" }}
            />
            <Text type="secondary" style={{ fontSize: 12, display: "block", textAlign: "center", marginTop: 8 }}>
              Apunta la cámara al código. Se detectará automáticamente.
            </Text>
          </>
        )}
      </Modal>
    </>
  );
}
