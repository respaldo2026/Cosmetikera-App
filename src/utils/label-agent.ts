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

const POS_AGENT_URL = (process.env.NEXT_PUBLIC_POS_AGENT_URL ?? "http://127.0.0.1:17891").replace(/\/$/, "");
const POS_AGENT_TIMEOUT_MS = 6000;
const POS_AGENT_TOKEN = process.env.NEXT_PUBLIC_POS_AGENT_TOKEN ?? "";

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
  return callLabelAgent<{ ok: boolean; totalLabels: number; pages: number }>("/print-labels", {
    method: "POST",
    body: JSON.stringify({
      printerName,
      items,
      template: {
        pageWidthMm: 104,
        pageHeightMm: 15,
        labelWidthMm: 32,
        labelHeightMm: 15,
        columns: 3,
        marginLeftMm: 2,
        gapHorizontalMm: 2,
        cornerRadiusMm: 3.2,
        storeName,
      },
    }),
  });
}
