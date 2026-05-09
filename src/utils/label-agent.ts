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
  pageWidthMm: number;
  pageHeightMm: number;
  labelWidthMm: number;
  labelHeightMm: number;
  columns: number;
  marginLeftMm: number;
  gapHorizontalMm: number;
  cornerRadiusMm: number;
};

export const LABEL_TEMPLATE_STORAGE_KEY = "pos_label_template_v1";

export const DEFAULT_LABEL_TEMPLATE: LabelTemplateConfig = {
  pageWidthMm: 104,
  pageHeightMm: 15,
  labelWidthMm: 32,
  labelHeightMm: 15,
  columns: 3,
  marginLeftMm: 2,
  gapHorizontalMm: 2,
  cornerRadiusMm: 3.2,
};

const POS_AGENT_URL = (process.env.NEXT_PUBLIC_POS_AGENT_URL ?? "http://127.0.0.1:17891").replace(/\/$/, "");
const POS_AGENT_TIMEOUT_MS = 6000;
const POS_AGENT_TOKEN = process.env.NEXT_PUBLIC_POS_AGENT_TOKEN ?? "";

function normalizeTemplate(raw: Partial<LabelTemplateConfig> | null | undefined): LabelTemplateConfig {
  const src = raw ?? {};
  const asNumber = (value: unknown, fallback: number) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  return {
    pageWidthMm: asNumber(src.pageWidthMm, DEFAULT_LABEL_TEMPLATE.pageWidthMm),
    pageHeightMm: asNumber(src.pageHeightMm, DEFAULT_LABEL_TEMPLATE.pageHeightMm),
    labelWidthMm: asNumber(src.labelWidthMm, DEFAULT_LABEL_TEMPLATE.labelWidthMm),
    labelHeightMm: asNumber(src.labelHeightMm, DEFAULT_LABEL_TEMPLATE.labelHeightMm),
    columns: Math.max(1, Math.round(asNumber(src.columns, DEFAULT_LABEL_TEMPLATE.columns))),
    marginLeftMm: asNumber(src.marginLeftMm, DEFAULT_LABEL_TEMPLATE.marginLeftMm),
    gapHorizontalMm: asNumber(src.gapHorizontalMm, DEFAULT_LABEL_TEMPLATE.gapHorizontalMm),
    cornerRadiusMm: asNumber(src.cornerRadiusMm, DEFAULT_LABEL_TEMPLATE.cornerRadiusMm),
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
