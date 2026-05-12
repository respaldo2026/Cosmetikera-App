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
import { listLabelPrinters, printPriceLabels, DEFAULT_LABEL_TEMPLATE, getLabelTemplateConfig, saveLabelTemplateConfig, type LabelTemplateConfig, type LabelTextAlign } from "@/utils/label-agent";
import { Rnd } from "react-rnd";

interface ConfiguracionImprsoraEtiquetasProps {
  formAcademia: any;
  onSaveRequest?: (data: { pos_label_printer_name: string; labelTemplateConfig: LabelTemplateConfig }) => Promise<void>;
}

const LABEL_PRINTER_STORAGE_KEY = "pos_label_printer_name_v1";
const LOGO_STORAGE_BUCKET = "branding";

const posPrintMode = (process.env.NEXT_PUBLIC_POS_PRINT_MODE ?? "auto").toLowerCase();
const usaAgenteLocal = posPrintMode === "agent" || posPrintMode === "auto";

const TEXT_ALIGN_OPTIONS: Array<{ label: string; value: LabelTextAlign }> = [
  { label: "Izquierda", value: "left" },
  { label: "Centro", value: "center" },
  { label: "Derecha", value: "right" },
  { label: "Justificado", value: "justify" },
];

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
        setLabelTemplateConfig(getLabelTemplateConfig());
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
    const pageWidthMm  = Math.max(30, Number(cfg.pageWidthMm  || 104));
    const pageHeightMm = Math.max(8,  Number(cfg.pageHeightMm || 15));
    const labelWidthMm  = Math.max(8,  Number(cfg.labelWidthMm  || 32));
    const labelHeightMm = Math.max(8,  Number(cfg.labelHeightMm || 15));
    const columns      = Math.max(1, Math.round(Number(cfg.columns || 3)));
    const marginLeftMm = Math.max(0, Number(cfg.marginLeftMm || 0));
    const gapMm        = Math.max(0, Number(cfg.gapHorizontalMm || 0));
    const requiredWidthMm = marginLeftMm + columns * labelWidthMm + Math.max(0, columns - 1) * gapMm;
    const overflow = requiredWidthMm > pageWidthMm + 0.001;

    // Escala para la tira de vista previa (ajustada al ancho disponible)
    const rowScale = Math.max(2.4, Math.min(4.6, 520 / pageWidthMm));
    // Escala del editor draggable (mayor → más cómodo para arrastrar)
    const designerScale = 12; // px por mm
    // Factor de conversión pt PDF → px diseñador: 1pt = 25.4/72 mm → × designerScale px/mm
    const ptToPx = designerScale * (25.4 / 72); // ≈ 4.233

    const mmToPx  = (mm: number) => mm * designerScale;
    const pxToMm  = (px: number) => Math.round((px / designerScale) * 100) / 100;
    const contentOffsetXPx      = mmToPx(Math.max(0, cfg.contentPaddingLeftMm || 0));
    const contentOffsetYPx      = mmToPx(Math.max(0, cfg.contentTopMm || 0));
    const contentCanvasWidthPx  = Math.max(1, labelWidthMm  * designerScale - contentOffsetXPx);
    const contentCanvasHeightPx = Math.max(1, labelHeightMm * designerScale - contentOffsetYPx);

    const storeName = String(formAcademia?.getFieldValue?.("nombre_academia") || "La Cosmetikera").trim() || "La Cosmetikera";

    // ── Generador de SVG de código de barras (simulación determinista, sin deps) ──
    const buildBarcodeSvg = (wPx: number, hPx: number, type: string): string => {
      const w = Math.max(4, wPx);
      const h = Math.max(4, hPx);
      if (type === "code128") {
        const pat = [2,1,3,1,2,2,1,3,2,1,2,1,3,1,2,3,1,2,1,1,3,2,1,2];
        const total = pat.reduce((a, b) => a + b, 0);
        const unit = (w - 4) / total;
        const bars: string[] = [];
        let xp = 2;
        pat.forEach((bw, i) => {
          if (i % 2 === 0) bars.push(`<rect x="${xp.toFixed(2)}" y="1" width="${(bw * unit).toFixed(2)}" height="${(h - 2).toFixed(2)}" fill="#000"/>`);
          xp += bw * unit;
        });
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${bars.join("")}</svg>`;
      }
      const cells = type === "qrcode" ? 21 : 16;
      const cs = Math.max(1, Math.floor(Math.min(w, h) / cells));
      const rects: string[] = [];
      for (let r = 0; r < cells; r++) {
        for (let c = 0; c < cells; c++) {
          const v = ((r * 31 + c * 17 + r * c * 3 + r + c + 5) >>> 0) % 256;
          if (v < 130 || r === 0 || c === 0 || r === cells - 1 || c === cells - 1) {
            rects.push(`<rect x="${c * cs}" y="${r * cs}" width="${cs}" height="${cs}" fill="#000"/>`);
          }
        }
      }
      if (type === "qrcode") {
        const f = cs;
        const tr = (cells - 7) * f;
        const bl = (cells - 7) * f;
        rects.push(
          `<rect x="0" y="0" width="${7*f}" height="${7*f}" fill="#000"/>` +
          `<rect x="${f}" y="${f}" width="${5*f}" height="${5*f}" fill="#fff"/>` +
          `<rect x="${2*f}" y="${2*f}" width="${3*f}" height="${3*f}" fill="#000"/>`,
          `<rect x="${tr}" y="0" width="${7*f}" height="${7*f}" fill="#000"/>` +
          `<rect x="${tr+f}" y="${f}" width="${5*f}" height="${5*f}" fill="#fff"/>` +
          `<rect x="${tr+2*f}" y="${2*f}" width="${3*f}" height="${3*f}" fill="#000"/>`,
          `<rect x="0" y="${bl}" width="${7*f}" height="${7*f}" fill="#000"/>` +
          `<rect x="${f}" y="${bl+f}" width="${5*f}" height="${5*f}" fill="#fff"/>` +
          `<rect x="${2*f}" y="${bl+2*f}" width="${3*f}" height="${3*f}" fill="#000"/>`,
        );
      }
      const sz = cells * cs;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${sz} ${sz}">${rects.join("")}</svg>`;
    };
    const barcodeSrc = (wPx: number, hPx: number) => {
      if (typeof btoa === "undefined") return "";
      return `data:image/svg+xml;base64,${btoa(buildBarcodeSvg(Math.ceil(wPx), Math.ceil(hPx), cfg.codeType))}`;
    };

    // ── Render de una etiqueta estática sin handles (vista de impresión fiel) ──
    const renderStaticLabel = (scale: number) => {
      const pt2px = scale * (25.4 / 72);
      const mm    = (v: number) => v * scale;
      const offX  = mm(cfg.contentPaddingLeftMm || 0);
      const offY  = mm(cfg.contentTopMm || 0);
      const lw    = labelWidthMm  * scale;
      const lh    = labelHeightMm * scale;
      return (
        <div style={{ width: lw, height: lh, borderRadius: mm(cfg.cornerRadiusMm), background: "#fff", position: "relative", overflow: "hidden", border: "1px solid #aaa", flexShrink: 0 }}>
          <div style={{ position: "absolute", inset: 0, transform: cfg.contentRotationDeg ? `rotate(${cfg.contentRotationDeg}deg)` : undefined, transformOrigin: "center center" }}>
            {cfg.logoEnabled && cfg.logoDataUrl && (
              <img src={cfg.logoDataUrl} alt="" style={{ position: "absolute", left: offX + mm(cfg.logoXOffsetMm), top: offY + mm(cfg.logoYOffsetMm), width: mm(cfg.logoWidthMm), height: mm(cfg.logoHeightMm), objectFit: "contain" }} />
            )}
            {cfg.showStoreName && (
              <div style={{ position: "absolute", left: offX + mm(cfg.storeNameXMm), top: offY + mm(cfg.storeNameYMm), width: mm(cfg.storeNameWidthMm), height: mm(cfg.storeNameHeightMm), fontSize: cfg.storeNameFontSize * pt2px, fontWeight: 700, fontFamily: "Helvetica, Arial, sans-serif", textAlign: cfg.storeNameAlign, lineHeight: 1, overflow: "hidden", whiteSpace: "nowrap", color: "#000" }}>
                {storeName.slice(0, cfg.storeNameMaxLen)}
              </div>
            )}
            {cfg.showProductName && (
              <div style={{ position: "absolute", left: offX + mm(cfg.nameXMm), top: offY + mm(cfg.nameYMm), width: mm(cfg.nameWidthMm), height: mm(cfg.nameHeightMm), fontSize: cfg.nameFontSize * pt2px, fontWeight: 700, fontFamily: "Helvetica, Arial, sans-serif", textAlign: cfg.nameAlign, lineHeight: 1, overflow: "hidden", whiteSpace: "nowrap", color: "#000" }}>
                {"ACE Almendra".slice(0, cfg.nameMaxLen)}
              </div>
            )}
            {cfg.showPrice && (
              <div style={{ position: "absolute", left: offX + mm(cfg.priceXMm), top: offY + mm(cfg.priceYMm), width: mm(cfg.priceWidthMm), height: mm(cfg.priceHeightMm), fontSize: cfg.priceFontSize * pt2px, fontWeight: 800, fontFamily: "Helvetica, Arial, sans-serif", textAlign: cfg.priceAlign, lineHeight: 1, overflow: "hidden", whiteSpace: "nowrap", color: "#000" }}>
                $13.400
              </div>
            )}
            {cfg.showFreeText && cfg.freeText.trim() && (
              <div style={{ position: "absolute", left: offX + mm(cfg.freeTextXMm), top: offY + mm(cfg.freeTextYMm), width: mm(cfg.freeTextWidthMm), height: mm(cfg.freeTextHeightMm), fontSize: cfg.freeTextFontSize * pt2px, fontFamily: "Helvetica, Arial, sans-serif", textAlign: cfg.freeTextAlign, lineHeight: 1, overflow: "hidden", whiteSpace: "nowrap", color: "#000" }}>
                {cfg.freeText.slice(0, cfg.freeTextMaxLen)}
              </div>
            )}
            {cfg.showCode && (
              <img src={barcodeSrc(mm(cfg.codeWidthMm), mm(cfg.codeHeightMm))} alt={cfg.codeType} style={{ position: "absolute", left: offX + mm(cfg.codeXMm), top: offY + mm(cfg.codeYMm), width: mm(cfg.codeWidthMm), height: mm(cfg.codeHeightMm), imageRendering: "pixelated" }} />
            )}
          </div>
        </div>
      );
    };

    return (
      <>
        {/* ── Vista de impresión proporcional (fiel al resultado real) ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-block", width: 9, height: 9, background: "#52c41a", borderRadius: 2 }} />
            Vista de impresión — representación proporcional real
          </div>
          <div style={{ background: "repeating-linear-gradient(45deg,#f9f9f9,#f9f9f9 10px,#f5f5f5 10px,#f5f5f5 20px)", border: "1px dashed #ccc", borderRadius: 8, padding: `10px 16px 10px ${marginLeftMm * rowScale + 16}px`, display: "flex", gap: gapMm * rowScale, alignItems: "flex-start", maxWidth: "100%", overflowX: "auto" }}>
            {Array.from({ length: columns }).map((_, idx) => (
              <React.Fragment key={`sp-${idx}`}>{renderStaticLabel(rowScale)}</React.Fragment>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 5 }}>
            Página {pageWidthMm.toFixed(1)} × {pageHeightMm.toFixed(1)} mm · {columns} col. · Etiqueta {labelWidthMm.toFixed(1)} × {labelHeightMm.toFixed(1)} mm
          </div>
        </div>

        {/* ── Editor draggable ── */}
        <Row gutter={[12, 12]}>
          <Col xs={24} md={14}>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>Editor — arrastra y redimensiona cada bloque</div>
            <div style={{ width: labelWidthMm * designerScale, height: labelHeightMm * designerScale, maxWidth: "100%", border: "1px solid #d9d9d9", borderRadius: cfg.cornerRadiusMm * designerScale, background: "#fff", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, transform: `rotate(${cfg.contentRotationDeg || 0}deg)`, transformOrigin: "center center" }}>
                <div style={{ position: "absolute", left: contentOffsetXPx, top: contentOffsetYPx, width: contentCanvasWidthPx, height: contentCanvasHeightPx }}>

                  {cfg.showStoreName && (
                    <Rnd bounds="parent" size={{ width: mmToPx(cfg.storeNameWidthMm), height: mmToPx(cfg.storeNameHeightMm) }} position={{ x: mmToPx(cfg.storeNameXMm), y: mmToPx(cfg.storeNameYMm) }} minWidth={mmToPx(4)} minHeight={mmToPx(1)} onDragStop={(_e, d) => updateBox("store", { x: pxToMm(d.x), y: pxToMm(d.y), w: cfg.storeNameWidthMm, h: cfg.storeNameHeightMm })} onResizeStop={(_e, _dir, ref, _delta, position) => updateBox("store", { x: pxToMm(position.x), y: pxToMm(position.y), w: pxToMm(ref.offsetWidth), h: pxToMm(ref.offsetHeight) })}>
                      <div style={{ width: "100%", height: "100%", outline: "1px dashed rgba(124,58,237,0.6)", fontSize: cfg.storeNameFontSize * ptToPx, fontWeight: 700, fontFamily: "Helvetica,Arial,sans-serif", textAlign: cfg.storeNameAlign, lineHeight: 1, overflow: "hidden", whiteSpace: "nowrap", color: "#000", cursor: "move", userSelect: "none" }}>
                        {storeName.slice(0, cfg.storeNameMaxLen)}
                      </div>
                    </Rnd>
                  )}

                  {cfg.showProductName && (
                    <Rnd bounds="parent" size={{ width: mmToPx(cfg.nameWidthMm), height: mmToPx(cfg.nameHeightMm) }} position={{ x: mmToPx(cfg.nameXMm), y: mmToPx(cfg.nameYMm) }} minWidth={mmToPx(4)} minHeight={mmToPx(1)} onDragStop={(_e, d) => updateBox("name", { x: pxToMm(d.x), y: pxToMm(d.y), w: cfg.nameWidthMm, h: cfg.nameHeightMm })} onResizeStop={(_e, _dir, ref, _delta, position) => updateBox("name", { x: pxToMm(position.x), y: pxToMm(position.y), w: pxToMm(ref.offsetWidth), h: pxToMm(ref.offsetHeight) })}>
                      <div style={{ width: "100%", height: "100%", outline: "1px dashed rgba(37,99,235,0.6)", fontSize: cfg.nameFontSize * ptToPx, fontWeight: 700, fontFamily: "Helvetica,Arial,sans-serif", textAlign: cfg.nameAlign, lineHeight: 1, overflow: "hidden", whiteSpace: "nowrap", color: "#000", cursor: "move", userSelect: "none" }}>
                        {"ACE Almendra".slice(0, cfg.nameMaxLen)}
                      </div>
                    </Rnd>
                  )}

                  {cfg.showPrice && (
                    <Rnd bounds="parent" size={{ width: mmToPx(cfg.priceWidthMm), height: mmToPx(cfg.priceHeightMm) }} position={{ x: mmToPx(cfg.priceXMm), y: mmToPx(cfg.priceYMm) }} minWidth={mmToPx(6)} minHeight={mmToPx(2)} onDragStop={(_e, d) => updateBox("price", { x: pxToMm(d.x), y: pxToMm(d.y), w: cfg.priceWidthMm, h: cfg.priceHeightMm })} onResizeStop={(_e, _dir, ref, _delta, position) => updateBox("price", { x: pxToMm(position.x), y: pxToMm(position.y), w: pxToMm(ref.offsetWidth), h: pxToMm(ref.offsetHeight) })}>
                      <div style={{ width: "100%", height: "100%", outline: "1px dashed rgba(22,163,74,0.6)", fontSize: cfg.priceFontSize * ptToPx, fontWeight: 800, fontFamily: "Helvetica,Arial,sans-serif", textAlign: cfg.priceAlign, lineHeight: 1, overflow: "hidden", whiteSpace: "nowrap", color: "#000", cursor: "move", userSelect: "none" }}>
                        $13.400
                      </div>
                    </Rnd>
                  )}

                  {cfg.showCode && (
                    <Rnd bounds="parent" size={{ width: mmToPx(cfg.codeWidthMm), height: mmToPx(cfg.codeHeightMm) }} position={{ x: mmToPx(cfg.codeXMm), y: mmToPx(cfg.codeYMm) }} minWidth={mmToPx(3)} minHeight={mmToPx(3)} onDragStop={(_e, d) => updateBox("code", { x: pxToMm(d.x), y: pxToMm(d.y), w: cfg.codeWidthMm, h: cfg.codeHeightMm })} onResizeStop={(_e, _dir, ref, _delta, position) => updateBox("code", { x: pxToMm(position.x), y: pxToMm(position.y), w: pxToMm(ref.offsetWidth), h: pxToMm(ref.offsetHeight) })}>
                      <div style={{ width: "100%", height: "100%", outline: "1px dashed rgba(17,24,39,0.6)", cursor: "move", overflow: "hidden" }}>
                        <img src={barcodeSrc(mmToPx(cfg.codeWidthMm), mmToPx(cfg.codeHeightMm))} alt={cfg.codeType} style={{ width: "100%", height: "100%", imageRendering: "pixelated", display: "block" }} />
                      </div>
                    </Rnd>
                  )}

                  {cfg.showFreeText && cfg.freeText.trim() && (
                    <Rnd bounds="parent" size={{ width: mmToPx(cfg.freeTextWidthMm), height: mmToPx(cfg.freeTextHeightMm) }} position={{ x: mmToPx(cfg.freeTextXMm), y: mmToPx(cfg.freeTextYMm) }} minWidth={mmToPx(4)} minHeight={mmToPx(1)} onDragStop={(_e, d) => updateBox("freeText", { x: pxToMm(d.x), y: pxToMm(d.y), w: cfg.freeTextWidthMm, h: cfg.freeTextHeightMm })} onResizeStop={(_e, _dir, ref, _delta, position) => updateBox("freeText", { x: pxToMm(position.x), y: pxToMm(position.y), w: pxToMm(ref.offsetWidth), h: pxToMm(ref.offsetHeight) })}>
                      <div style={{ width: "100%", height: "100%", outline: "1px dashed rgba(180,83,9,0.6)", fontSize: cfg.freeTextFontSize * ptToPx, fontFamily: "Helvetica,Arial,sans-serif", textAlign: cfg.freeTextAlign, lineHeight: 1, overflow: "hidden", whiteSpace: "nowrap", color: "#000", cursor: "move", userSelect: "none" }}>
                        {cfg.freeText.slice(0, cfg.freeTextMaxLen)}
                      </div>
                    </Rnd>
                  )}

                  {cfg.logoEnabled && cfg.logoDataUrl && (
                    <Rnd bounds="parent" size={{ width: mmToPx(cfg.logoWidthMm), height: mmToPx(cfg.logoHeightMm) }} position={{ x: mmToPx(cfg.logoXOffsetMm), y: mmToPx(cfg.logoYOffsetMm) }} minWidth={mmToPx(2)} minHeight={mmToPx(1)} onDragStop={(_e, d) => updateBox("logo", { x: pxToMm(d.x), y: pxToMm(d.y), w: cfg.logoWidthMm, h: cfg.logoHeightMm })} onResizeStop={(_e, _dir, ref, _delta, position) => updateBox("logo", { x: pxToMm(position.x), y: pxToMm(position.y), w: pxToMm(ref.offsetWidth), h: pxToMm(ref.offsetHeight) })}>
                      <div style={{ width: "100%", height: "100%", outline: "1px dashed rgba(216,27,135,0.6)", cursor: "move", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                        <img src={cfg.logoDataUrl} alt="Logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                      </div>
                    </Rnd>
                  )}

                </div>
              </div>
            </div>
          </Col>
          <Col xs={24} md={10}>
            <Alert type="info" showIcon message="Editor visual" description="Arrastra y redimensiona bloques. La vista superior es la representación real de impresión." />
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
              <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>Campos visibles en la etiqueta</div>
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>Nombre de la tienda</span>
                  <Switch checked={labelTemplateConfig.showStoreName} onChange={(checked) => setLabelTemplateConfig((prev) => ({ ...prev, showStoreName: checked }))} />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>Nombre del artículo</span>
                  <Switch checked={labelTemplateConfig.showProductName} onChange={(checked) => setLabelTemplateConfig((prev) => ({ ...prev, showProductName: checked }))} />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>Precio</span>
                  <Switch checked={labelTemplateConfig.showPrice} onChange={(checked) => setLabelTemplateConfig((prev) => ({ ...prev, showPrice: checked }))} />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>Código (QR/DataMatrix/Code128/Aztec)</span>
                  <Switch checked={labelTemplateConfig.showCode} onChange={(checked) => setLabelTemplateConfig((prev) => ({ ...prev, showCode: checked }))} />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>Logo</span>
                  <Switch checked={labelTemplateConfig.logoEnabled} onChange={(checked) => setLabelTemplateConfig((prev) => ({ ...prev, logoEnabled: checked }))} />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>Campo libre</span>
                  <Switch checked={labelTemplateConfig.showFreeText} onChange={(checked) => setLabelTemplateConfig((prev) => ({ ...prev, showFreeText: checked }))} />
                </div>
              </Space>
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
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Artículo: tamaño fuente</div>
              <InputNumber min={5} max={24} step={0.1} style={{ width: "100%" }} value={labelTemplateConfig.nameFontSize} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, nameFontSize: Number(v || prev.nameFontSize) }))} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Artículo: max caracteres</div>
              <InputNumber min={6} max={60} step={1} precision={0} style={{ width: "100%" }} value={labelTemplateConfig.nameMaxLen} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, nameMaxLen: Math.max(6, Number(v || prev.nameMaxLen)) }))} />
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
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Alineación tienda</div>
              <Select value={labelTemplateConfig.storeNameAlign} style={{ width: "100%" }} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, storeNameAlign: v }))} options={TEXT_ALIGN_OPTIONS} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Alineación artículo</div>
              <Select value={labelTemplateConfig.nameAlign} style={{ width: "100%" }} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, nameAlign: v }))} options={TEXT_ALIGN_OPTIONS} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Alineación precio</div>
              <Select value={labelTemplateConfig.priceAlign} style={{ width: "100%" }} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, priceAlign: v }))} options={TEXT_ALIGN_OPTIONS} />
            </Col>
            <Col xs={12} md={6}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Alineación campo libre</div>
              <Select value={labelTemplateConfig.freeTextAlign} style={{ width: "100%" }} onChange={(v) => setLabelTemplateConfig((prev) => ({ ...prev, freeTextAlign: v }))} options={TEXT_ALIGN_OPTIONS} />
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
