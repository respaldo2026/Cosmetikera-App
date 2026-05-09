const express = require("express");
const path = require("path");
const { spawn } = require("child_process");
const { print: printPdf, getPrinters } = require("pdf-to-printer");
const { generarPdfEtiquetas } = require("./labels-pdf");

const app = express();
const PORT = Number(process.env.POS_AGENT_PORT || 17891);
const HOST = process.env.POS_AGENT_HOST || "127.0.0.1";
const AUTH_TOKEN = process.env.POS_AGENT_TOKEN || "";

const actionQueue = [];
let processingQueue = false;
const labelQueue = [];
let processingLabelQueue = false;

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-pos-agent-token");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

app.use((req, res, next) => {
  if (req.path === "/health") return next();
  if (!AUTH_TOKEN) return next();

  const token = String(req.headers["x-pos-agent-token"] || "");
  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ ok: false, error: "Token invalido para POS Agent" });
  }
  next();
});

function runPrinterAction(payload) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, "printer-raw.ps1");
    const ps = spawn(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] }
    );

    let stdout = "";
    let stderr = "";

    ps.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    ps.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    ps.on("error", (err) => {
      reject(err);
    });

    ps.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error((stderr || stdout || "Error ejecutando PowerShell").trim()));
      }

      const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1] || "{}";
      try {
        const parsed = JSON.parse(last);
        resolve(parsed);
      } catch {
        resolve({ ok: true, raw: stdout.trim() });
      }
    });

    try {
      ps.stdin.write(JSON.stringify(payload));
      ps.stdin.end();
    } catch (error) {
      reject(error);
    }
  });
}

function enqueueAction(payload) {
  return new Promise((resolve, reject) => {
    const entry = { payload, resolve, reject };

    // El cajon tiene prioridad para mejorar tiempo percibido en caja.
    if (payload?.action === "openDrawer") {
      actionQueue.unshift(entry);
    } else {
      actionQueue.push(entry);
    }

    processQueue();
  });
}

async function processQueue() {
  if (processingQueue) return;
  processingQueue = true;

  while (actionQueue.length > 0) {
    const current = actionQueue.shift();
    if (!current) continue;

    try {
      const result = await runPrinterAction(current.payload);
      current.resolve(result);
    } catch (error) {
      current.reject(error);
    }
  }

  processingQueue = false;
}

function enqueueLabelJob(payload) {
  return new Promise((resolve, reject) => {
    labelQueue.push({ payload, resolve, reject });
    processLabelQueue();
  });
}

function listPrintersWithPowerShell() {
  return new Promise((resolve, reject) => {
    const command = [
      "$ErrorActionPreference='Stop'",
      "$default = (Get-CimInstance Win32_Printer | Where-Object { $_.Default -eq $true } | Select-Object -ExpandProperty Name -First 1)",
      "$rows = Get-CimInstance Win32_Printer | Select-Object Name, Default, PrinterStatus",
      "$out = @($rows | ForEach-Object {",
      "  [PSCustomObject]@{",
      "    name = [string]$_.Name",
      "    isDefault = [bool]$_.Default",
      "    status = [string]$_.PrinterStatus",
      "  }",
      "})",
      "if (-not $out -or $out.Count -eq 0) {",
      "  if ($default) {",
      "    $out = @([PSCustomObject]@{ name = [string]$default; isDefault = $true; status = 'unknown' })",
      "  }",
      "}",
      "$out | ConvertTo-Json -Compress",
    ].join("; ");

    const ps = spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    ps.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    ps.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    ps.on("error", (error) => reject(error));

    ps.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error((stderr || "Error listando impresoras por PowerShell").trim()));
      }

      try {
        const raw = stdout.trim();
        if (!raw) return resolve([]);
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return resolve(parsed);
        resolve([parsed]);
      } catch (error) {
        reject(new Error(`No se pudo parsear salida de PowerShell: ${error?.message || error}`));
      }
    });
  });
}

async function processLabelQueue() {
  if (processingLabelQueue) return;
  processingLabelQueue = true;

  while (labelQueue.length > 0) {
    const current = labelQueue.shift();
    if (!current) continue;

    try {
      const { outputPath, totalLabels, pages } = await generarPdfEtiquetas(current.payload);
      try {
        await printPdf(outputPath, {
          printer: current.payload?.printerName || undefined,
          scale: "noscale",
        });
      } finally {
        try {
          require("fs").unlinkSync(outputPath);
        } catch (_error) {}
      }

      current.resolve({
        ok: true,
        totalLabels,
        pages,
        printer: current.payload?.printerName || null,
      });
    } catch (error) {
      current.reject(error);
    }
  }

  processingLabelQueue = false;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "la-cosmetikera-pos-agent", version: "1.0.0" });
});

app.get("/printers", async (_req, res) => {
  try {
    let printers = [];

    try {
      printers = await getPrinters();
    } catch (_error) {
      printers = await listPrintersWithPowerShell();
    }

    const normalized = (printers || [])
      .map((p) => ({
        name: String(p?.name || p?.Name || "").trim(),
        isDefault: Boolean(p?.default ?? p?.Default ?? p?.isDefault),
        status: String(p?.status || p?.PrinterStatus || "unknown"),
      }))
      .filter((p) => p.name.length > 0);

    return res.json({ ok: true, printers: normalized });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || "No se pudieron listar impresoras" });
  }
});

app.post("/print-raw", async (req, res) => {
  try {
    const { printerName = null, raw = "", encoding = "cp1252" } = req.body || {};
    if (typeof raw !== "string" || !raw.length) {
      return res.status(400).json({ ok: false, error: "raw es requerido" });
    }

    const result = await enqueueAction({
      action: "printRaw",
      printerName,
      raw,
      encoding,
    });

    return res.json(result && typeof result === "object" ? result : { ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || "No se pudo imprimir" });
  }
});

app.post("/drawer", async (req, res) => {
  try {
    const { printerName = null } = req.body || {};
    enqueueAction({
      action: "openDrawer",
      printerName,
      encoding: "cp1252",
    }).catch((error) => {
      console.error("[POS-AGENT] No se pudo abrir cajon:", error?.message || error);
    });

    return res.json({ ok: true, queued: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || "No se pudo abrir cajon" });
  }
});

app.post("/print-labels", async (req, res) => {
  try {
    const { printerName = null, items = [], template = {} } = req.body || {};
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ ok: false, error: "items es requerido" });
    }

    const safeItems = items
      .map((item) => ({
        name: String(item?.name || "").trim(),
        price: Number(item?.price || 0),
        quantity: Math.max(0, Number(item?.quantity || 0)),
        dataMatrix: String(item?.dataMatrix || "").trim(),
        sku: String(item?.sku || "").trim(),
      }))
      .filter((item) => item.name && item.quantity > 0);

    if (!safeItems.length) {
      return res.status(400).json({ ok: false, error: "No hay items validos para imprimir" });
    }

    const result = await enqueueLabelJob({
      printerName,
      items: safeItems,
      template,
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || "No se pudieron imprimir etiquetas" });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`[POS-AGENT] Escuchando en http://${HOST}:${PORT}`);
});
