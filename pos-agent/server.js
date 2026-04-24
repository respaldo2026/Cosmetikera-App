const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const app = express();
const PORT = Number(process.env.POS_AGENT_PORT || 17891);
const HOST = process.env.POS_AGENT_HOST || "127.0.0.1";
const AUTH_TOKEN = process.env.POS_AGENT_TOKEN || "";

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
    const payloadPath = path.join(os.tmpdir(), `pos-agent-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
    fs.writeFileSync(payloadPath, JSON.stringify(payload), "utf8");

    const scriptPath = path.join(__dirname, "printer-raw.ps1");
    const ps = spawn(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-PayloadPath", payloadPath],
      { windowsHide: true }
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
      cleanup();
      reject(err);
    });

    ps.on("close", (code) => {
      cleanup();
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

    function cleanup() {
      try {
        fs.unlinkSync(payloadPath);
      } catch (_) {}
    }
  });
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "la-cosmetikera-pos-agent", version: "1.0.0" });
});

app.post("/print-raw", async (req, res) => {
  try {
    const { printerName = null, raw = "", encoding = "cp1252" } = req.body || {};
    if (typeof raw !== "string" || !raw.length) {
      return res.status(400).json({ ok: false, error: "raw es requerido" });
    }

    const result = await runPrinterAction({
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
    const result = await runPrinterAction({
      action: "openDrawer",
      printerName,
      encoding: "cp1252",
    });

    return res.json(result && typeof result === "object" ? result : { ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || "No se pudo abrir cajon" });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`[POS-AGENT] Escuchando en http://${HOST}:${PORT}`);
});
