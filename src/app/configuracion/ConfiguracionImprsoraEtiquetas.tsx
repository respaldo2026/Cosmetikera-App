"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Row,
  Col,
  Space,
  Button,
  Select,
  Input,
  Card,
  Divider,
  message,
  Alert,
  InputNumber,
  Switch,
  Upload,
  Radio,
} from "antd";
import { ReloadOutlined, TagsOutlined, UploadOutlined } from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { listLabelPrinters, printPriceLabels, DEFAULT_LABEL_TEMPLATE, getLabelTemplateConfig, saveLabelTemplateConfig, type LabelTemplateConfig } from "@/utils/label-agent";
import { Rnd } from "react-rnd";

type CampoEtiqueta = "store" | "name" | "price" | "code" | "logo" | "freeText";

const CAMPOS_ETIQUETA_OPTIONS: Array<{ label: string; value: CampoEtiqueta }> = [
  { label: "Nombre tienda", value: "store" },
  { label: "Precio", value: "price" },
  { label: "Código", value: "code" },
  { label: "Logo", value: "logo" },
  { label: "Campo libre", value: "freeText" },
];

interface ConfiguracionImprsoraEtiquetasProps {
  formAcademia: any;
  onSaveRequest?: (data: { pos_label_printer_name: string; labelTemplateConfig: LabelTemplateConfig }) => Promise<void>;
}

const LABEL_PRINTER_STORAGE_KEY = "pos_label_printer_name_v1";
const LOGO_STORAGE_BUCKET = "branding";

const posPrintMode = (process.env.NEXT_PUBLIC_POS_PRINT_MODE ?? "auto").toLowerCase();
const usaAgenteLocal = posPrintMode === "agent" || posPrintMode === "auto";

export default function ConfiguracionImprsoraEtiquetas({
  formAcademia,
  onSaveRequest,
}: ConfiguracionImprsoraEtiquetasProps) {
  const [messageApi, contextHolder] = message.useMessage();

  // Estados específicos para etiquetas
  const [impresorasDisponibles, setImpresorasDisponibles] = useState<string[]>([]);
  const [buscandoImpresoras, setBuscandoImpresoras] = useState(false);
  const [posLabelPrinterName, setPosLabelPrinterName] = useState<string>("");
  const [labelTemplateConfig, setLabelTemplateConfig] = useState<LabelTemplateConfig>(DEFAULT_LABEL_TEMPLATE);
  const labelTemplateReadyRef = useRef(false);
  const [testEtiquetas, setTestEtiquetas] = useState(false);
  const [savingEtiquetas, setSavingEtiquetas] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Cargar configuración al montar
  useEffect(() => {
    cargarConfigEtiquetas();
  }, []);

  // Guardar template config cuando cambia
  useEffect(() => {
    if (!labelTemplateReadyRef.current) return;
    saveLabelTemplateConfig(labelTemplateConfig);
  }, [labelTemplateConfig]);

  const cargarConfigEtiquetas = useCallback(async () => {
    try {
      if (typeof window !== "undefined") {
        const storedLabelPrinter = window.localStorage.getItem(LABEL_PRINTER_STORAGE_KEY) ?? "";
        setPosLabelPrinterName(storedLabelPrinter);
        setLabelTemplateConfig({ ...getLabelTemplateConfig(), showProductName: false });
        labelTemplateReadyRef.current = true;
      }

      // También intentar desde Supabase como fallback
      const { data } = await supabaseBrowserClient
        .from("configuracion")
        .select("pos_printer_name")
        .limit(1)
        .maybeSingle();
      if (data && !posLabelPrinterName) {
        setPosLabelPrinterName(data.pos_printer_name ?? "");
      }
    } catch (error) {
      console.error("Error cargando config etiquetas:", error);
    }
  }, [posLabelPrinterName]);

  const obtenerImpresorasDisponibles = useCallback(async (): Promise<string[]> => {
    try {
      const printers = await listLabelPrinters();
      return printers.map((p) => p.name).filter(Boolean);
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

  const guardarConfigEtiquetas = async () => {
    setSavingEtiquetas(true);
    try {
      if (typeof window !== "undefined") {
        const normalizedPrinter = String(posLabelPrinterName || "").trim();
        if (normalizedPrinter) {
          window.localStorage.setItem(LABEL_PRINTER_STORAGE_KEY, normalizedPrinter);
        } else {
          window.localStorage.removeItem(LABEL_PRINTER_STORAGE_KEY);
        }
        saveLabelTemplateConfig(labelTemplateConfig);
      }

      if (onSaveRequest) {
        await onSaveRequest({
          pos_label_printer_name: posLabelPrinterName,
          labelTemplateConfig: labelTemplateConfig,
        });
      }

      messageApi.success("Configuración de etiquetas guardada");
    } catch (e: any) {
      messageApi.error("Error al guardar: " + e.message);
    } finally {
      setSavingEtiquetas(false);
    }
  };

  const testImprimirEtiqueta = async (cantidad: 1 | 3 | 6 = 3) => {
    if (!usaAgenteLocal) {
      messageApi.info("Las pruebas requieren modo agente local.");
      return;
    }

    const targetPrinter = String(posLabelPrinterName || "").trim();
    if (!targetPrinter) {
      messageApi.warning("Selecciona primero la impresora de etiquetas.");
      return;
    }

    setTestEtiquetas(true);
    try {
      if (typeof window !== "undefined") {
        saveLabelTemplateConfig(labelTemplateConfig);
      }

      const nombreTienda = String(formAcademia.getFieldValue("nombre_academia") || "La Cosmetikera").trim() || "La Cosmetikera";
      const items = [
        {
          name: "TEST",
          price: 13400,
          quantity: cantidad,
          dataMatrix: "TEST|13400",
          sku: "TEST",
        },
      ];

      const result = await printPriceLabels(items, targetPrinter, nombreTienda);
      messageApi.success(`Prueba enviada: ${result.totalLabels} etiqueta(s) en ${result.pages} página(s).`);
    } catch (error: any) {
      messageApi.error("Error en prueba de etiqueta: " + (error?.message || "desconocido"));
    } finally {
      setTestEtiquetas(false);
    }
  };

  const handleLabelLogoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      messageApi.error("Solo imágenes (PNG, JPG, SVG)");
      return Upload.LIST_IGNORE;
    }

    const toDataUrl = (input: File) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
      reader.readAsDataURL(input);
    });

    setUploadingLogo(true);
    try {
      const fileExt = (file.name.split(".").pop() || "png").toLowerCase();
      const uniqueId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
      const filePath = `logo/label-${uniqueId}.${fileExt}`;

      const { error: uploadError } = await supabaseBrowserClient.storage
        .from(LOGO_STORAGE_BUCKET)
        .upload(filePath, file, { cacheControl: "3600", upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabaseBrowserClient.storage
        .from(LOGO_STORAGE_BUCKET)
        .getPublicUrl(filePath);

      const publicUrl = publicData?.publicUrl;
      if (!publicUrl) {
        throw new Error("No se pudo obtener URL pública del logo");
      }

      setLabelTemplateConfig((prev) => ({
        ...prev,
        logoDataUrl: publicUrl,
        logoEnabled: true,
      }));

      messageApi.success("Logo actualizado");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "desconocido";
      const lower = String(errorMessage).toLowerCase();
      const storageIssue = lower.includes("bucket") || lower.includes("policy") || lower.includes("row-level") || lower.includes("storage");

      if (storageIssue) {
        try {
          const dataUrl = await toDataUrl(file);
          setLabelTemplateConfig((prev) => ({
            ...prev,
            logoDataUrl: dataUrl,
            logoEnabled: true,
          }));
          messageApi.warning("Storage no disponible. Logo de etiqueta guardado localmente.");
        } catch {
          messageApi.error("Error subiendo logo: " + errorMessage);
        }
      } else {
        messageApi.error("Error subiendo logo: " + errorMessage);
      }
    } finally {
      setUploadingLogo(false);
    }

    return Upload.LIST_IGNORE;
  };

  const clearLabelLogo = () => {
    setLabelTemplateConfig((prev) => ({
      ...prev,
      logoDataUrl: "",
      logoEnabled: false,
    }));
    messageApi.info("Logo removido");
  };

  const getCamposSeleccionados = (cfg: LabelTemplateConfig): CampoEtiqueta[] => {
    const selected: CampoEtiqueta[] = [];
    if (cfg.showStoreName) selected.push("store");
    if (cfg.showPrice) selected.push("price");
    if (cfg.showCode) selected.push("code");
    if (cfg.logoEnabled) selected.push("logo");
    if (cfg.showFreeText) selected.push("freeText");
    return selected;
  };

  const setCamposSeleccionados = (campos: CampoEtiqueta[]) => {
    const selected = new Set<CampoEtiqueta>(campos);
    setLabelTemplateConfig((prev) => ({
      ...prev,
      showStoreName: selected.has("store"),
      showProductName: false,
      showPrice: selected.has("price"),
      showCode: selected.has("code"),
      logoEnabled: selected.has("logo") && Boolean(prev.logoDataUrl),
      showFreeText: selected.has("freeText"),
    }));
  };

  const updateBox = (
    key: "store" | "name" | "price" | "code" | "logo" | "freeText",
    next: { x: number; y: number; w: number; h: number }
  ) => {
    const x = Math.max(0, next.x);
    const y = Math.max(0, next.y);
    const w = Math.max(1, next.w);
    const h = Math.max(1, next.h);

    setLabelTemplateConfig((prev) => {
      if (key === "store") {
        return { ...prev, storeNameXMm: x, storeNameYMm: y, storeNameWidthMm: w, storeNameHeightMm: h };
      }
      if (key === "name") {
        return { ...prev, nameXMm: x, nameYMm: y, nameWidthMm: w, nameHeightMm: h };
      }
      if (key === "price") {
        return { ...prev, priceXMm: x, priceYMm: y, priceWidthMm: w, priceHeightMm: h };
      }
      if (key === "code") {
        return { ...prev, codeXMm: x, codeYMm: y, codeWidthMm: w, codeHeightMm: h };
      }
      if (key === "freeText") {
        return { ...prev, freeTextXMm: x, freeTextYMm: y, freeTextWidthMm: w, freeTextHeightMm: h };
      }
      return { ...prev, logoXOffsetMm: x, logoYOffsetMm: y, logoWidthMm: w, logoHeightMm: h };
    });
  };

  const renderVisualEditor = () => {
    const cfg = labelTemplateConfig;
    const pageWidthMm = Math.max(30, Number(cfg.pageWidthMm || 104));
    const pageHeightMm = Math.max(8, Number(cfg.pageHeightMm || 15));
    const labelWidthMm = Math.max(8, Number(cfg.labelWidthMm || 32));
    const labelHeightMm = Math.max(8, Number(cfg.labelHeightMm || 15));
    const columns = Math.max(1, Math.round(Number(cfg.columns || 3)));
    const marginLeftMm = Math.max(0, Number(cfg.marginLeftMm || 0));
    const gapMm = Math.max(0, Number(cfg.gapHorizontalMm || 0));
    const requiredWidthMm = marginLeftMm + (columns * labelWidthMm) + (Math.max(0, columns - 1) * gapMm);
    const overflow = requiredWidthMm > pageWidthMm + 0.001;

    const rowScale = Math.max(2.4, Math.min(4.6, 520 / pageWidthMm));
    const designerScale = 12;
    const mmToPx = (mm: number) => mm * designerScale;
    const pxToMm = (px: number) => Math.round((px / designerScale) * 100) / 100;

    return (
      <>
        <div style={{ width: pageWidthMm * rowScale, maxWidth: "100%", minHeight: pageHeightMm * rowScale + 18, border: "1px dashed #d9d9d9", borderRadius: 8, background: "repeating-linear-gradient(45deg,#fff,#fff 10px,#fcfcfc 10px,#fcfcfc 20px)", overflow: "hidden", position: "relative", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: gapMm * rowScale, paddingLeft: marginLeftMm * rowScale, paddingTop: 6 }}>
            {Array.from({ length: columns }).map((_, idx) => (
              <div key={`live-row-${idx}`} style={{ width: labelWidthMm * rowScale, height: labelHeightMm * rowScale, borderRadius: cfg.cornerRadiusMm * rowScale, border: "1px solid #e5e7eb", background: "#fff" }} />
            ))}
          </div>
          <div style={{ position: "absolute", right: 8, bottom: 6, fontSize: 11, color: "#666" }}>{pageWidthMm.toFixed(1)} x {pageHeightMm.toFixed(1)} mm</div>
        </div>

        <Row gutter={[12, 12]}>
          <Col xs={24} md={14}>
            <div style={{ width: labelWidthMm * designerScale, height: labelHeightMm * designerScale, maxWidth: "100%", border: "1px solid #d9d9d9", borderRadius: cfg.cornerRadiusMm * designerScale, background: "#fff", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, transform: `rotate(${cfg.contentRotationDeg || 0}deg)`, transformOrigin: "center center" }}>
                {cfg.showStoreName && (
                  <Rnd
                    bounds="parent"
                    size={{ width: mmToPx(cfg.storeNameWidthMm), height: mmToPx(cfg.storeNameHeightMm) }}
                    position={{ x: mmToPx(cfg.storeNameXMm), y: mmToPx(cfg.storeNameYMm) }}
                    minWidth={mmToPx(4)}
                    minHeight={mmToPx(1)}
                    onDragStop={(_e, d) => updateBox("store", { x: pxToMm(d.x), y: pxToMm(d.y), w: cfg.storeNameWidthMm, h: cfg.storeNameHeightMm })}
                    onResizeStop={(_e, _dir, ref, _delta, position) => updateBox("store", { x: pxToMm(position.x), y: pxToMm(position.y), w: pxToMm(ref.offsetWidth), h: pxToMm(ref.offsetHeight) })}
                  >
                    <div style={{ width: "100%", height: "100%", border: "1px dashed #7c3aed", color: "#7c3aed", fontSize: Math.max(8, cfg.storeNameFontSize * 1.9), fontWeight: 700, padding: 2, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", background: "rgba(124,58,237,0.05)" }}>TIENDA</div>
                  </Rnd>
                )}

                {cfg.showProductName && (
                  <Rnd
                    bounds="parent"
                    size={{ width: mmToPx(cfg.nameWidthMm), height: mmToPx(cfg.nameHeightMm) }}
                    position={{ x: mmToPx(cfg.nameXMm), y: mmToPx(cfg.nameYMm) }}
                    minWidth={mmToPx(4)}
                    minHeight={mmToPx(1)}
                    onDragStop={(_e, d) => updateBox("name", { x: pxToMm(d.x), y: pxToMm(d.y), w: cfg.nameWidthMm, h: cfg.nameHeightMm })}
                    onResizeStop={(_e, _dir, ref, _delta, position) => updateBox("name", { x: pxToMm(position.x), y: pxToMm(position.y), w: pxToMm(ref.offsetWidth), h: pxToMm(ref.offsetHeight) })}
                  >
                    <div style={{ width: "100%", height: "100%", border: "1px dashed #2563eb", color: "#2563eb", fontSize: Math.max(9, cfg.nameFontSize * 1.8), fontWeight: 700, padding: 2, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", background: "rgba(37,99,235,0.06)" }}>ACE Almendra</div>
                  </Rnd>
                )}

                {cfg.showPrice && (
                  <Rnd
                    bounds="parent"
                    size={{ width: mmToPx(cfg.priceWidthMm), height: mmToPx(cfg.priceHeightMm) }}
                    position={{ x: mmToPx(cfg.priceXMm), y: mmToPx(cfg.priceYMm) }}
                    minWidth={mmToPx(6)}
                    minHeight={mmToPx(2)}
                    onDragStop={(_e, d) => updateBox("price", { x: pxToMm(d.x), y: pxToMm(d.y), w: cfg.priceWidthMm, h: cfg.priceHeightMm })}
                    onResizeStop={(_e, _dir, ref, _delta, position) => updateBox("price", { x: pxToMm(position.x), y: pxToMm(position.y), w: pxToMm(ref.offsetWidth), h: pxToMm(ref.offsetHeight) })}
                  >
                    <div style={{ width: "100%", height: "100%", border: "1px dashed #16a34a", color: "#166534", fontSize: Math.max(12, cfg.priceFontSize * 1.55), fontWeight: 800, padding: 2, lineHeight: 1, background: "rgba(22,163,74,0.06)" }}>$13.400</div>
                  </Rnd>
                )}

                {cfg.showCode && (
                  <Rnd
                    bounds="parent"
                    size={{ width: mmToPx(cfg.codeWidthMm), height: mmToPx(cfg.codeHeightMm) }}
                    position={{ x: mmToPx(cfg.codeXMm), y: mmToPx(cfg.codeYMm) }}
                    minWidth={mmToPx(3)}
                    minHeight={mmToPx(3)}
                    onDragStop={(_e, d) => updateBox("code", { x: pxToMm(d.x), y: pxToMm(d.y), w: cfg.codeWidthMm, h: cfg.codeHeightMm })}
                    onResizeStop={(_e, _dir, ref, _delta, position) => updateBox("code", { x: pxToMm(position.x), y: pxToMm(position.y), w: pxToMm(ref.offsetWidth), h: pxToMm(ref.offsetHeight) })}
                  >
                    <div style={{ width: "100%", height: "100%", border: "1px dashed #111827", background: "repeating-conic-gradient(#111 0% 25%, #fff 0% 50%) 50% / 6px 6px", display: "flex", alignItems: "flex-end", justifyContent: "center", color: "#111", fontSize: 10, fontWeight: 700 }}>
                      {cfg.codeType === "aztec" ? "AZ" : cfg.codeType === "qrcode" ? "QR" : cfg.codeType === "code128" ? "128" : "DM"}
                    </div>
                  </Rnd>
                )}

                {cfg.showFreeText && cfg.freeText.trim() && (
                  <Rnd
                    bounds="parent"
                    size={{ width: mmToPx(cfg.freeTextWidthMm), height: mmToPx(cfg.freeTextHeightMm) }}
                    position={{ x: mmToPx(cfg.freeTextXMm), y: mmToPx(cfg.freeTextYMm) }}
                    minWidth={mmToPx(4)}
                    minHeight={mmToPx(1)}
                    onDragStop={(_e, d) => updateBox("freeText", { x: pxToMm(d.x), y: pxToMm(d.y), w: cfg.freeTextWidthMm, h: cfg.freeTextHeightMm })}
                    onResizeStop={(_e, _dir, ref, _delta, position) => updateBox("freeText", { x: pxToMm(position.x), y: pxToMm(position.y), w: pxToMm(ref.offsetWidth), h: pxToMm(ref.offsetHeight) })}
                  >
                    <div style={{ width: "100%", height: "100%", border: "1px dashed #b45309", color: "#92400e", fontSize: Math.max(8, cfg.freeTextFontSize * 1.7), fontWeight: 600, padding: 2, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", background: "rgba(251,191,36,0.15)" }}>
                      {cfg.freeText}
                    </div>
                  </Rnd>
                )}

                {cfg.logoEnabled && cfg.logoDataUrl && (
                  <Rnd
                    bounds="parent"
                    size={{ width: mmToPx(cfg.logoWidthMm), height: mmToPx(cfg.logoHeightMm) }}
                    position={{ x: mmToPx(cfg.logoXOffsetMm), y: mmToPx(cfg.logoYOffsetMm) }}
                    minWidth={mmToPx(2)}
                    minHeight={mmToPx(1)}
                    onDragStop={(_e, d) => updateBox("logo", { x: pxToMm(d.x), y: pxToMm(d.y), w: cfg.logoWidthMm, h: cfg.logoHeightMm })}
                    onResizeStop={(_e, _dir, ref, _delta, position) => updateBox("logo", { x: pxToMm(position.x), y: pxToMm(position.y), w: pxToMm(ref.offsetWidth), h: pxToMm(ref.offsetHeight) })}
                  >
                    <div style={{ width: "100%", height: "100%", border: "1px dashed #d81b87", background: "rgba(216,27,135,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <img src={cfg.logoDataUrl} alt="Logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                    </div>
                  </Rnd>
                )}
              </div>
            </div>
          </Col>
          <Col xs={24} md={10}>
            <Alert type="info" showIcon message="Editor visual tipo Bartender" description="Arrastra y redimensiona bloques." />
            <div style={{ marginTop: 10, fontSize: 12, color: "#555" }}>
              Fila: {columns} columnas. Requerido: {requiredWidthMm.toFixed(1)} mm / Página: {pageWidthMm.toFixed(1)} mm.
            </div>
          </Col>
        </Row>

        {overflow && (
          <Alert style={{ marginTop: 10 }} type="warning" showIcon message="La fila no cabe en el ancho de página" description={`Ancho requerido: ${requiredWidthMm.toFixed(1)} mm. Reduce columnas/ancho o aumenta ancho de página.`} />
        )}
      </>
    );
  };

  return (
    <>
      {contextHolder}
      <Divider orientation="left">Impresora de Etiquetas</Divider>

      <Row gutter={[16, 16]}>
        {usaAgenteLocal && (
          <Col xs={24}>
            <Space style={{ marginBottom: 16 }} wrap>
              <Button
                icon={<ReloadOutlined />}
                loading={buscandoImpresoras}
                onClick={buscarImpresoras}
              >
                Detectar impresoras de etiquetas
              </Button>
              <Button
                type="primary"
                icon={<TagsOutlined />}
                loading={testEtiquetas}
                onClick={() => testImprimirEtiqueta(3)}
                style={{ background: "#d81b87", borderColor: "#d81b87" }}
              >
                Probar etiquetas x3
              </Button>
            </Space>

            <div style={{ marginBottom: 8, fontWeight: 500 }}>Impresora de etiquetas</div>
            {impresorasDisponibles.length > 0 ? (
              <Select
                showSearch
                allowClear
                value={posLabelPrinterName || undefined}
                placeholder="Selecciona la impresora de etiquetas"
                style={{ width: "100%" }}
                onChange={(v) => setPosLabelPrinterName(v || "")}
                options={impresorasDisponibles.map((p) => ({ label: p, value: p }))}
              />
            ) : (
              <Input
                value={posLabelPrinterName}
                onChange={(e) => setPosLabelPrinterName(e.target.value)}
                placeholder="Ej: 4BARCODE 4B-2054TG"
                prefix={<TagsOutlined />}
              />
            )}
            <div style={{ color: "#888", fontSize: 12, marginTop: 4 }}>
              Se usa en Artículos y Compras en este equipo/navegador.
            </div>
          </Col>
        )}

        <Col xs={24}>
          <Divider orientation="left" style={{ margin: "6px 0" }}>
            Formato base
          </Divider>
          <Row gutter={[12, 12]}>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Orientación impresión</div>
              <Select value={labelTemplateConfig.printOrientation} style={{ width: "100%" }} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, printOrientation: v }))} options={[{ label: "Horizontal (landscape)", value: "landscape" }, { label: "Vertical (portrait)", value: "portrait" }]} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Corrección rotación</div>
              <Select value={labelTemplateConfig.contentRotationDeg} style={{ width: "100%" }} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, contentRotationDeg: v }))} options={[{ label: "0° (sin corrección)", value: 0 }, { label: "90°", value: 90 }, { label: "180°", value: 180 }, { label: "270°", value: 270 }]} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Ancho página (mm)</div>
              <InputNumber min={30} max={120} step={0.1} style={{ width: "100%" }} value={labelTemplateConfig.pageWidthMm} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, pageWidthMm: Number(v || prev.pageWidthMm) }))} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Alto página (mm)</div>
              <InputNumber min={8} max={80} step={0.1} style={{ width: "100%" }} value={labelTemplateConfig.pageHeightMm} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, pageHeightMm: Number(v || prev.pageHeightMm) }))} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Ancho etiqueta (mm)</div>
              <InputNumber min={8} max={90} step={0.1} style={{ width: "100%" }} value={labelTemplateConfig.labelWidthMm} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, labelWidthMm: Number(v || prev.labelWidthMm) }))} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Alto etiqueta (mm)</div>
              <InputNumber min={8} max={60} step={0.1} style={{ width: "100%" }} value={labelTemplateConfig.labelHeightMm} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, labelHeightMm: Number(v || prev.labelHeightMm) }))} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Columnas</div>
              <InputNumber min={1} max={6} step={1} precision={0} style={{ width: "100%" }} value={labelTemplateConfig.columns} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, columns: Math.max(1, Number(v || prev.columns)) }))} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Margen izquierdo (mm)</div>
              <InputNumber min={0} max={40} step={0.1} style={{ width: "100%" }} value={labelTemplateConfig.marginLeftMm} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, marginLeftMm: Number(v || 0) }))} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Espacio horizontal (mm)</div>
              <InputNumber min={0} max={20} step={0.1} style={{ width: "100%" }} value={labelTemplateConfig.gapHorizontalMm} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, gapHorizontalMm: Number(v || 0) }))} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Radio esquina (mm)</div>
              <InputNumber min={0} max={12} step={0.1} style={{ width: "100%" }} value={labelTemplateConfig.cornerRadiusMm} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, cornerRadiusMm: Number(v || 0) }))} />
            </Col>
          </Row>
        </Col>

        <Col xs={24}>
          <Divider orientation="left" style={{ margin: "6px 0" }}>
            Contenido y tipografía
          </Divider>
          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Campos visibles en la etiqueta</div>
              <Select
                mode="multiple"
                style={{ width: "100%" }}
                value={getCamposSeleccionados(labelTemplateConfig)}
                onChange={(values) => setCamposSeleccionados(values as CampoEtiqueta[])}
                options={CAMPOS_ETIQUETA_OPTIONS}
                placeholder="Selecciona los campos a imprimir"
              />
            </Col>
            <Col xs={24} md={12}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Campo libre (texto adicional)</div>
              <Input
                value={labelTemplateConfig.freeText}
                onChange={(e) => setLabelTemplateConfig((prev) => ({ ...prev, freeText: e.target.value.slice(0, 120) }))}
                placeholder="Ej: Promo válida hasta agotar existencias"
              />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Padding izq. contenido (mm)</div>
              <InputNumber min={0} max={10} step={0.1} style={{ width: "100%" }} value={labelTemplateConfig.contentPaddingLeftMm} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, contentPaddingLeftMm: Number(v || 0) }))} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Offset superior contenido (mm)</div>
              <InputNumber min={0} max={10} step={0.1} style={{ width: "100%" }} value={labelTemplateConfig.contentTopMm} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, contentTopMm: Number(v || 0) }))} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Precio: offset Y (mm)</div>
              <InputNumber min={0} max={30} step={0.1} style={{ width: "100%" }} value={labelTemplateConfig.priceTopMm} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, priceTopMm: Number(v || 0) }))} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Precio: tamaño fuente</div>
              <InputNumber min={6} max={36} step={0.1} style={{ width: "100%" }} value={labelTemplateConfig.priceFontSize} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, priceFontSize: Number(v || prev.priceFontSize) }))} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Nombre: tamaño fuente</div>
              <InputNumber min={5} max={24} step={0.1} style={{ width: "100%" }} value={labelTemplateConfig.nameFontSize} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, nameFontSize: Number(v || prev.nameFontSize) }))} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Nombre: max caracteres</div>
              <InputNumber min={6} max={60} step={1} precision={0} style={{ width: "100%" }} value={labelTemplateConfig.nameMaxLen} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, nameMaxLen: Math.max(6, Number(v || prev.nameMaxLen)) }))} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Mostrar nombre tienda</div>
              <Switch checked={labelTemplateConfig.showStoreName} onChange={(checked) => setLabelTemplateConfig((prev) => ({ ...prev, showStoreName: checked }))} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Tienda: tamaño fuente</div>
              <InputNumber min={4} max={20} step={0.1} style={{ width: "100%" }} value={labelTemplateConfig.storeNameFontSize} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, storeNameFontSize: Number(v || prev.storeNameFontSize) }))} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Tienda: max caracteres</div>
              <InputNumber min={6} max={40} step={1} precision={0} style={{ width: "100%" }} value={labelTemplateConfig.storeNameMaxLen} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, storeNameMaxLen: Math.max(6, Number(v || prev.storeNameMaxLen)) }))} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Tipo de código</div>
              <Select value={labelTemplateConfig.codeType} style={{ width: "100%" }} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, codeType: v }))} options={[{ label: "Data Matrix", value: "datamatrix" }, { label: "Aztec", value: "aztec" }, { label: "QR", value: "qrcode" }, { label: "Code 128", value: "code128" }]} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Código: ancho (mm)</div>
              <InputNumber min={3} max={30} step={0.1} style={{ width: "100%" }} value={labelTemplateConfig.codeWidthMm} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, codeWidthMm: Number(v || prev.codeWidthMm) }))} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Código: alto (mm)</div>
              <InputNumber min={3} max={30} step={0.1} style={{ width: "100%" }} value={labelTemplateConfig.codeHeightMm} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, codeHeightMm: Number(v || prev.codeHeightMm) }))} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Campo libre: fuente</div>
              <InputNumber min={4} max={18} step={0.1} style={{ width: "100%" }} value={labelTemplateConfig.freeTextFontSize} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, freeTextFontSize: Number(v || prev.freeTextFontSize) }))} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Campo libre: max caracteres</div>
              <InputNumber min={4} max={60} step={1} precision={0} style={{ width: "100%" }} value={labelTemplateConfig.freeTextMaxLen} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, freeTextMaxLen: Math.max(4, Number(v || prev.freeTextMaxLen)) }))} />
            </Col>
          </Row>
        </Col>

        <Col xs={24}>
          <Divider orientation="left" style={{ margin: "6px 0" }}>
            Imagen en etiqueta
          </Divider>
          <Space wrap>
            <Switch checked={labelTemplateConfig.logoEnabled} onChange={(checked) => setLabelTemplateConfig((prev) => ({ ...prev, logoEnabled: checked }))} />
            <Upload beforeUpload={handleLabelLogoUpload} showUploadList={false} accept="image/png,image/jpeg,image/webp,image/svg+xml">
              <Button icon={<UploadOutlined />} loading={uploadingLogo}>
                Subir imagen
              </Button>
            </Upload>
            <Button danger onClick={clearLabelLogo}>
              Quitar imagen
            </Button>
          </Space>
          <Row gutter={[12, 12]} style={{ marginTop: 10 }}>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Logo ancho (mm)</div>
              <InputNumber min={2} max={30} step={0.1} style={{ width: "100%" }} value={labelTemplateConfig.logoWidthMm} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, logoWidthMm: Number(v || prev.logoWidthMm) }))} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Logo alto (mm)</div>
              <InputNumber min={1} max={20} step={0.1} style={{ width: "100%" }} value={labelTemplateConfig.logoHeightMm} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, logoHeightMm: Number(v || prev.logoHeightMm) }))} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Logo offset X (mm)</div>
              <InputNumber min={0} max={20} step={0.1} style={{ width: "100%" }} value={labelTemplateConfig.logoXOffsetMm} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, logoXOffsetMm: Number(v || 0) }))} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Logo offset Y (mm)</div>
              <InputNumber min={0} max={20} step={0.1} style={{ width: "100%" }} value={labelTemplateConfig.logoYOffsetMm} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, logoYOffsetMm: Number(v || 0) }))} />
            </Col>
          </Row>
        </Col>

        <Col xs={24}>
          <Space style={{ marginBottom: 10 }} wrap>
            <Button onClick={() => setLabelTemplateConfig(DEFAULT_LABEL_TEMPLATE)} icon={<ReloadOutlined />}>
              Restaurar medidas por defecto
            </Button>
            <Button onClick={() => setLabelTemplateConfig((prev) => ({ ...prev, columns: 3 }))}>
              Usar 3 etiquetas por fila
            </Button>
          </Space>
          <Card size="small" style={{ background: "#fafafa", borderColor: "#f0f0f0" }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Editor visual en vivo</div>
            <div style={{ color: "#777", fontSize: 12, marginBottom: 10 }}>
              Arrastra y redimensiona con el mouse cada bloque. Se guarda automáticamente.
            </div>
            {renderVisualEditor()}
            <div style={{ color: "#888", fontSize: 12, marginTop: 8 }}>
              Los ajustes se aplican al imprimir desde Artículos y Compras en este equipo.
            </div>
          </Card>
        </Col>

        <Col xs={24}>
          <Button
            type="primary"
            size="large"
            loading={savingEtiquetas}
            onClick={guardarConfigEtiquetas}
            style={{ background: "#d81b87", borderColor: "#d81b87" }}
          >
            Guardar configuración de etiquetas
          </Button>
        </Col>
      </Row>
    </>
  );
}
