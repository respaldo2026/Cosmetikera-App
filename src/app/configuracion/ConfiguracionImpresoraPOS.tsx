"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Row, Col, Space, Button, Select, Input, Radio, Card, Divider, message } from "antd";
import { ReloadOutlined, PrinterOutlined } from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { qzConectar, qzActivo, listarImpresoras, invalidarConfigPOS, imprimirTicketTermico, abrirCajon } from "@utils/pos-hardware";
import { crearTemplateTicketPOS, crearTicketPruebaPOS, invalidarConfigTicketPOS } from "@utils/pos-ticket-template";
import type { TicketPromoConfig } from "@utils/pos-ticket-template";

interface ConfiguracionImpresoraPOSProps {
  formAcademia: any;
  ticketFields: Record<string, boolean>;
  ticketPromoConfig?: TicketPromoConfig;
  onSaveRequest?: (data: { pos_printer_name: string; pos_printer_width: number }) => Promise<void>;
}

const posPrintMode = (process.env.NEXT_PUBLIC_POS_PRINT_MODE ?? "auto").toLowerCase();
const usaQZ = posPrintMode === "qz";
const usaAgenteLocal = posPrintMode === "agent" || posPrintMode === "auto";
const permiteCajon = usaQZ || usaAgenteLocal;

export default function ConfiguracionImpresoraPOS({
  formAcademia,
  ticketFields,
  ticketPromoConfig,
  onSaveRequest,
}: ConfiguracionImpresoraPOSProps) {
  const [messageApi, contextHolder] = message.useMessage();

  // Estados específicos para POS
  const [impresorasDisponibles, setImpresorasDisponibles] = useState<string[]>([]);
  const [buscandoImpresoras, setBuscandoImpresoras] = useState(false);
  const [posPrinterName, setPosPrinterName] = useState<string>("");
  const [posPrinterWidth, setPosPrinterWidth] = useState<number>(48);
  const [qzEstado, setQzEstado] = useState<"desconocido" | "conectado" | "desconectado">("desconocido");
  const [conectandoQZ, setConectandoQZ] = useState(false);
  const [testImprimiendo, setTestImprimiendo] = useState(false);
  const [testCajon, setTestCajon] = useState(false);
  const [savingPos, setSavingPos] = useState(false);

  // Cargar configuración al montar
  useEffect(() => {
    cargarConfigPOS();
    setQzEstado(qzActivo() ? "conectado" : "desconectado");
  }, []);

  const cargarConfigPOS = useCallback(async () => {
    try {
      const { data } = await supabaseBrowserClient
        .from("configuracion")
        .select("pos_printer_name, pos_printer_width")
        .limit(1)
        .maybeSingle();
      if (data) {
        setPosPrinterName(data.pos_printer_name ?? "");
        setPosPrinterWidth(data.pos_printer_width ?? 48);
      }
    } catch (error) {
      console.error("Error cargando config POS:", error);
    }
  }, []);

  const obtenerImpresorasDisponibles = useCallback(async (): Promise<string[]> => {
    try {
      if (usaQZ) {
        return await listarImpresoras();
      }

      if (usaAgenteLocal) {
        const { listLabelPrinters } = await import("@/utils/label-agent");
        const printers = await listLabelPrinters();
        return printers.map((p) => p.name).filter(Boolean);
      }

      return [];
    } catch {
      return [];
    }
  }, []);

  const buscarImpresoras = async () => {
    setBuscandoImpresoras(true);
    try {
      const lista = await obtenerImpresorasDisponibles();
      setImpresorasDisponibles(lista);
    } finally {
      setBuscandoImpresoras(false);
    }
  };

  const conectarQZ = async () => {
    if (!usaQZ) {
      messageApi.info("El modo actual no usa QZ Tray.");
      return;
    }
    setConectandoQZ(true);
    try {
      const ok = await qzConectar();
      setQzEstado(ok ? "conectado" : "desconectado");
      if (ok) {
        await buscarImpresoras();
      } else {
        messageApi.error("No se pudo conectar a QZ Tray. Verifica que esté instalado.");
      }
    } finally {
      setConectandoQZ(false);
    }
  };

  const guardarConfigPOS = async () => {
    setSavingPos(true);
    try {
      const { data: configs } = await supabaseBrowserClient
        .from("configuracion")
        .select("id")
        .limit(1);
      const id = configs?.[0]?.id;
      if (!id) {
        messageApi.error("No hay registro de configuración. Guarda primero la pestaña Negocio.");
        return;
      }

      const { error } = await supabaseBrowserClient
        .from("configuracion")
        .update({ pos_printer_name: posPrinterName || null, pos_printer_width: posPrinterWidth })
        .eq("id", id);

      if (error) throw error;

      invalidarConfigPOS();
      invalidarConfigTicketPOS();

      if (onSaveRequest) {
        await onSaveRequest({ pos_printer_name: posPrinterName, pos_printer_width: posPrinterWidth });
      }

      messageApi.success("Configuración POS guardada");
    } catch (e: any) {
      messageApi.error("Error al guardar: " + e.message);
    } finally {
      setSavingPos(false);
    }
  };

  const testImprimir = async () => {
    setTestImprimiendo(true);
    try {
      const ticket = crearTicketPruebaPOS(
        crearTemplateTicketPOS(formAcademia.getFieldsValue(), ticketFields, ticketPromoConfig)
      );
      const result = await imprimirTicketTermico(
        ticket,
        posPrinterName || null,
        posPrinterWidth,
        { allowBrowserFallback: false }
      );
      if (!result.ok) {
        if (usaAgenteLocal) {
          messageApi.error(`El agente no pudo imprimir: ${result.error ?? "sin detalle"}`);
        } else {
          messageApi.warning(`No se pudo imprimir: ${result.error ?? "sin detalle"}`);
          const { imprimirTicketNavegador } = await import("@utils/pos-hardware");
          imprimirTicketNavegador(ticket);
        }
      } else {
        messageApi.success("Ticket de prueba enviado");
      }
    } catch (e: any) {
      messageApi.error("Fallo en la prueba: " + (e?.message ?? "desconocido"));
    } finally {
      setTestImprimiendo(false);
    }
  };

  const testAbrirCajon = async () => {
    if (!permiteCajon) {
      messageApi.info("Este modo no soporta control de cajón.");
      return;
    }
    setTestCajon(true);
    try {
      const result = await abrirCajon(posPrinterName || null);
      if (!result.ok) {
        messageApi.error("No se pudo abrir el cajón: " + (result.error ?? "desconocido"));
      } else {
        messageApi.success("¡Señal enviada al cajón!");
      }
    } finally {
      setTestCajon(false);
    }
  };

  return (
    <>
      {contextHolder}
      <Divider orientation="left">Impresora POS (Tickets/Cajón)</Divider>

      <Row gutter={[16, 16]}>
        {(usaQZ || usaAgenteLocal) && (
          <Col xs={24}>
            <Space style={{ marginBottom: 16 }} wrap>
              <Button
                icon={<ReloadOutlined />}
                loading={buscandoImpresoras}
                onClick={buscarImpresoras}
              >
                Detectar impresoras POS
              </Button>
              {usaQZ && (
                <Button
                  loading={conectandoQZ}
                  onClick={conectarQZ}
                  type={qzEstado === "conectado" ? "primary" : "default"}
                >
                  QZ Tray: {qzEstado === "conectado" ? "✓ Conectado" : "✗ Desconectado"}
                </Button>
              )}
            </Space>

            <div style={{ marginBottom: 8, fontWeight: 500 }}>Impresora de tickets</div>
            {impresorasDisponibles.length > 0 ? (
              <Select
                showSearch
                value={posPrinterName || undefined}
                placeholder="Selecciona la impresora"
                style={{ width: "100%" }}
                onChange={setPosPrinterName}
                options={impresorasDisponibles.map((p) => ({ label: p, value: p }))}
              />
            ) : (
              <Input
                value={posPrinterName}
                onChange={(e) => setPosPrinterName(e.target.value)}
                placeholder="Ej: EPSON TM-T20II"
                prefix={<PrinterOutlined />}
              />
            )}
            <div style={{ color: "#888", fontSize: 12, marginTop: 4 }}>
              Deja vacío para usar la impresora predeterminada del sistema.
            </div>
          </Col>
        )}

        <Col xs={24}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>Ancho de papel</div>
          <Radio.Group value={posPrinterWidth} onChange={(e) => setPosPrinterWidth(e.target.value)}>
            <Radio value={48}>
              <strong>80 mm</strong> <span style={{ color: "#888", fontSize: 12 }}>(48 chars — Epson TM-T20II)</span>
            </Radio>
            <Radio value={32}>
              <strong>58 mm</strong> <span style={{ color: "#888", fontSize: 12 }}>(32 chars)</span>
            </Radio>
          </Radio.Group>
        </Col>

        <Col xs={24}>
          <Divider orientation="left" style={{ margin: "12px 0" }}>Pruebas</Divider>
          <Space wrap>
            <Button
              icon={<PrinterOutlined />}
              loading={testImprimiendo}
              onClick={testImprimir}
              type="primary"
            >
              Imprimir ticket de prueba
            </Button>
            {permiteCajon && (
              <Button
                icon={<span style={{ marginRight: 4 }}>💰</span>}
                loading={testCajon}
                onClick={testAbrirCajon}
              >
                Abrir cajón monedero
              </Button>
            )}
          </Space>
        </Col>

        <Col xs={24}>
          <Button
            type="primary"
            size="large"
            loading={savingPos}
            onClick={guardarConfigPOS}
            style={{ background: "#1890ff", borderColor: "#1890ff" }}
          >
            Guardar configuración POS
          </Button>
        </Col>
      </Row>
    </>
  );
}
