export type LabelPrinter = {
  name: string;
  isDefault: boolean;
  status?: string;
};

export type LabelPrintItem = {
  name: string;
  price: number;
  quantity: number;
  dataMatrix: string;
  sku?: string;
};

export type LabelTemplateConfig = {
  printOrientation: "portrait" | "landscape";
  contentRotationDeg: 0 | 90 | 180 | 270;
  pageWidthMm: number;
  pageHeightMm: number;
  labelWidthMm: number;
  labelHeightMm: number;
  columns: number;
  marginLeftMm: number;
  gapHorizontalMm: number;
  cornerRadiusMm: number;
  contentPaddingLeftMm: number;
  contentTopMm: number;
  showStoreName: boolean;
  storeNameMaxLen: number;
  storeNameFontSize: number;
  nameMaxLen: number;
  nameFontSize: number;
  priceFontSize: number;
  priceTopMm: number;
  dataMatrixSizeMm: number;
  dataMatrixXPaddingMm: number;
  dataMatrixYPaddingMm: number;
  logoEnabled: boolean;
  logoDataUrl: string;
  logoWidthMm: number;
  logoHeightMm: number;
  logoXOffsetMm: number;
  logoYOffsetMm: number;
  codeType: "datamatrix" | "qrcode" | "code128";
  storeNameXMm: number;
  storeNameYMm: number;
  storeNameWidthMm: number;
  storeNameHeightMm: number;
  nameXMm: number;
  nameYMm: number;
  nameWidthMm: number;
  nameHeightMm: number;
  priceXMm: number;
  priceYMm: number;
  priceWidthMm: number;
  priceHeightMm: number;
  codeXMm: number;
  codeYMm: number;
  codeWidthMm: number;
  codeHeightMm: number;
  enableVisualDesigner: boolean;
};

export const LABEL_TEMPLATE_STORAGE_KEY = "pos_label_template_v1";

export const DEFAULT_LABEL_TEMPLATE: LabelTemplateConfig = {
  printOrientation: "landscape",
  contentRotationDeg: 0,
  pageWidthMm: 104,
  pageHeightMm: 15,
  labelWidthMm: 32,
  labelHeightMm: 15,
  columns: 3,
  marginLeftMm: 2,
  gapHorizontalMm: 2,
  cornerRadiusMm: 3.2,
  contentPaddingLeftMm: 1.2,
  contentTopMm: 0.6,
  showStoreName: false,
  storeNameMaxLen: 13,
  storeNameFontSize: 6.6,
  nameMaxLen: 8,
  nameFontSize: 6.0,
  priceFontSize: 14.8,
  priceTopMm: 7.1,
  dataMatrixSizeMm: 7.4,
  dataMatrixXPaddingMm: 1.1,
  dataMatrixYPaddingMm: 3.1,
  logoEnabled: true,
  logoDataUrl: "",
  logoWidthMm: 11.0,
  logoHeightMm: 4.0,
  logoXOffsetMm: 1.3,
  logoYOffsetMm: 0.9,
  codeType: "datamatrix",
  storeNameXMm: 1.2,
  storeNameYMm: 0.6,
  storeNameWidthMm: 20,
  storeNameHeightMm: 2.8,
  nameXMm: 21.7,
  nameYMm: 1.0,
  nameWidthMm: 9.3,
  nameHeightMm: 2.4,
  priceXMm: 1.4,
  priceYMm: 7.1,
  priceWidthMm: 17.0,
  priceHeightMm: 6.8,
  codeXMm: 23.2,
  codeYMm: 3.7,
  codeWidthMm: 7.4,
  codeHeightMm: 7.4,
  enableVisualDesigner: true,
};

const POS_AGENT_URL = (process.env.NEXT_PUBLIC_POS_AGENT_URL ?? "http://127.0.0.1:17891").replace(/\/$/, "");
const POS_AGENT_TIMEOUT_MS = 12000;
const POS_AGENT_TOKEN = process.env.NEXT_PUBLIC_POS_AGENT_TOKEN ?? "";

function normalizeTemplate(raw: Partial<LabelTemplateConfig> | null | undefined): LabelTemplateConfig {
  const src = raw ?? {};
  const asNumber = (value: unknown, fallback: number, min: number, max: number) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };
  const asBool = (value: unknown, fallback: boolean) => {
    if (typeof value === "boolean") return value;
    return fallback;
  };
  const asString = (value: unknown, fallback: string, maxLen = 400000) => {
    const text = typeof value === "string" ? value : fallback;
    return text.slice(0, maxLen);
  };
  const asCodeType = (value: unknown): "datamatrix" | "qrcode" | "code128" => {
    const v = String(value || "").toLowerCase();
    if (v === "qrcode" || v === "code128") return v;
    return "datamatrix";
  };
  const asOrientation = (value: unknown): "portrait" | "landscape" => {
    const v = String(value || "").toLowerCase();
    return v === "portrait" ? "portrait" : "landscape";
  };
  const asRotation = (value: unknown): 0 | 90 | 180 | 270 => {
    const n = Number(value);
    if (n === 90 || n === 180 || n === 270) return n;
    return 0;
  };

  return {
    printOrientation: asOrientation(src.printOrientation),
    contentRotationDeg: asRotation(src.contentRotationDeg),
    pageWidthMm: asNumber(src.pageWidthMm, DEFAULT_LABEL_TEMPLATE.pageWidthMm, 30, 120),
    pageHeightMm: asNumber(src.pageHeightMm, DEFAULT_LABEL_TEMPLATE.pageHeightMm, 8, 80),
    labelWidthMm: asNumber(src.labelWidthMm, DEFAULT_LABEL_TEMPLATE.labelWidthMm, 8, 90),
    labelHeightMm: asNumber(src.labelHeightMm, DEFAULT_LABEL_TEMPLATE.labelHeightMm, 8, 60),
    columns: Math.round(asNumber(src.columns, DEFAULT_LABEL_TEMPLATE.columns, 1, 6)),
    marginLeftMm: asNumber(src.marginLeftMm, DEFAULT_LABEL_TEMPLATE.marginLeftMm, 0, 40),
    gapHorizontalMm: asNumber(src.gapHorizontalMm, DEFAULT_LABEL_TEMPLATE.gapHorizontalMm, 0, 20),
    cornerRadiusMm: asNumber(src.cornerRadiusMm, DEFAULT_LABEL_TEMPLATE.cornerRadiusMm, 0, 12),
    contentPaddingLeftMm: asNumber(src.contentPaddingLeftMm, DEFAULT_LABEL_TEMPLATE.contentPaddingLeftMm, 0, 10),
    contentTopMm: asNumber(src.contentTopMm, DEFAULT_LABEL_TEMPLATE.contentTopMm, 0, 10),
    showStoreName: asBool(src.showStoreName, DEFAULT_LABEL_TEMPLATE.showStoreName),
    storeNameMaxLen: Math.round(asNumber(src.storeNameMaxLen, DEFAULT_LABEL_TEMPLATE.storeNameMaxLen, 6, 40)),
    storeNameFontSize: asNumber(src.storeNameFontSize, DEFAULT_LABEL_TEMPLATE.storeNameFontSize, 4, 20),
    nameMaxLen: Math.round(asNumber(src.nameMaxLen, DEFAULT_LABEL_TEMPLATE.nameMaxLen, 6, 60)),
    nameFontSize: asNumber(src.nameFontSize, DEFAULT_LABEL_TEMPLATE.nameFontSize, 5, 24),
    priceFontSize: asNumber(src.priceFontSize, DEFAULT_LABEL_TEMPLATE.priceFontSize, 6, 36),
    priceTopMm: asNumber(src.priceTopMm, DEFAULT_LABEL_TEMPLATE.priceTopMm, 0, 30),
    dataMatrixSizeMm: asNumber(src.dataMatrixSizeMm, DEFAULT_LABEL_TEMPLATE.dataMatrixSizeMm, 3, 20),
    dataMatrixXPaddingMm: asNumber(src.dataMatrixXPaddingMm, DEFAULT_LABEL_TEMPLATE.dataMatrixXPaddingMm, 0, 20),
    dataMatrixYPaddingMm: asNumber(src.dataMatrixYPaddingMm, DEFAULT_LABEL_TEMPLATE.dataMatrixYPaddingMm, 0, 20),
    logoEnabled: asBool(src.logoEnabled, DEFAULT_LABEL_TEMPLATE.logoEnabled),
    logoDataUrl: asString(src.logoDataUrl, DEFAULT_LABEL_TEMPLATE.logoDataUrl),
    logoWidthMm: asNumber(src.logoWidthMm, DEFAULT_LABEL_TEMPLATE.logoWidthMm, 2, 30),
    logoHeightMm: asNumber(src.logoHeightMm, DEFAULT_LABEL_TEMPLATE.logoHeightMm, 1, 20),
    logoXOffsetMm: asNumber(src.logoXOffsetMm, DEFAULT_LABEL_TEMPLATE.logoXOffsetMm, 0, 20),
    logoYOffsetMm: asNumber(src.logoYOffsetMm, DEFAULT_LABEL_TEMPLATE.logoYOffsetMm, 0, 20),
    codeType: asCodeType(src.codeType),
    storeNameXMm: asNumber(src.storeNameXMm, DEFAULT_LABEL_TEMPLATE.storeNameXMm, 0, 100),
    storeNameYMm: asNumber(src.storeNameYMm, DEFAULT_LABEL_TEMPLATE.storeNameYMm, 0, 100),
    storeNameWidthMm: asNumber(src.storeNameWidthMm, DEFAULT_LABEL_TEMPLATE.storeNameWidthMm, 2, 100),
    storeNameHeightMm: asNumber(src.storeNameHeightMm, DEFAULT_LABEL_TEMPLATE.storeNameHeightMm, 1, 100),
    nameXMm: asNumber(src.nameXMm, DEFAULT_LABEL_TEMPLATE.nameXMm, 0, 100),
    nameYMm: asNumber(src.nameYMm, DEFAULT_LABEL_TEMPLATE.nameYMm, 0, 100),
    nameWidthMm: asNumber(src.nameWidthMm, DEFAULT_LABEL_TEMPLATE.nameWidthMm, 2, 100),
    nameHeightMm: asNumber(src.nameHeightMm, DEFAULT_LABEL_TEMPLATE.nameHeightMm, 1, 100),
    priceXMm: asNumber(src.priceXMm, DEFAULT_LABEL_TEMPLATE.priceXMm, 0, 100),
    priceYMm: asNumber(src.priceYMm, DEFAULT_LABEL_TEMPLATE.priceYMm, 0, 100),
    priceWidthMm: asNumber(src.priceWidthMm, DEFAULT_LABEL_TEMPLATE.priceWidthMm, 2, 100),
    priceHeightMm: asNumber(src.priceHeightMm, DEFAULT_LABEL_TEMPLATE.priceHeightMm, 1, 100),
    codeXMm: asNumber(src.codeXMm, DEFAULT_LABEL_TEMPLATE.codeXMm, 0, 100),
    codeYMm: asNumber(src.codeYMm, DEFAULT_LABEL_TEMPLATE.codeYMm, 0, 100),
    codeWidthMm: asNumber(src.codeWidthMm, DEFAULT_LABEL_TEMPLATE.codeWidthMm, 1, 100),
    codeHeightMm: asNumber(src.codeHeightMm, DEFAULT_LABEL_TEMPLATE.codeHeightMm, 1, 100),
    enableVisualDesigner: asBool(src.enableVisualDesigner, DEFAULT_LABEL_TEMPLATE.enableVisualDesigner),
  };
}

export function getLabelTemplateConfig(): LabelTemplateConfig {
  if (typeof window === "undefined") return DEFAULT_LABEL_TEMPLATE;

  try {
    const raw = window.localStorage.getItem(LABEL_TEMPLATE_STORAGE_KEY);
    if (!raw) return DEFAULT_LABEL_TEMPLATE;
    return normalizeTemplate(JSON.parse(raw) as Partial<LabelTemplateConfig>);
  } catch {
    return DEFAULT_LABEL_TEMPLATE;
  }
}

export function saveLabelTemplateConfig(config: Partial<LabelTemplateConfig>): LabelTemplateConfig {
  const normalized = normalizeTemplate(config);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LABEL_TEMPLATE_STORAGE_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

async function callLabelAgent<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), POS_AGENT_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };

    if (POS_AGENT_TOKEN) {
      headers["x-pos-agent-token"] = POS_AGENT_TOKEN;
    }

    const response = await fetch(`${POS_AGENT_URL}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok === false) {
      throw new Error(body?.error || "No fue posible comunicar con el agente de etiquetas");
    }

    return body as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function listLabelPrinters(): Promise<LabelPrinter[]> {
  const res = await callLabelAgent<{ ok: boolean; printers: LabelPrinter[] }>("/printers", {
    method: "GET",
  });
  return res.printers || [];
}

export async function printPriceLabels(items: LabelPrintItem[], printerName: string, storeName = "La Cosmetikera") {
  const template = getLabelTemplateConfig();
  return callLabelAgent<{ ok: boolean; totalLabels: number; pages: number }>("/print-labels", {
    method: "POST",
    body: JSON.stringify({
      printerName,
      items,
      template: {
        ...template,
        storeName,
      },
    }),
  });
}
