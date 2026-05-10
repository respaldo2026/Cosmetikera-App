const fs = require("fs");
const os = require("os");
const path = require("path");
const PDFDocument = require("pdfkit");
const bwipjs = require("bwip-js");

const mmToPt = (mm) => (mm * 72) / 25.4;

function formatCop(value) {
  const amount = Number(value || 0);
  return `$${amount.toLocaleString("es-CO")}`;
}

function normalizeText(input, maxLen) {
  const text = String(input || "").trim();
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(1, maxLen - 1))}…`;
}

function parseDataUrlImageBuffer(dataUrl) {
  const raw = String(dataUrl || "").trim();
  if (!raw.startsWith("data:image/")) return null;
  const idx = raw.indexOf(",");
  if (idx < 0) return null;
  const header = raw.slice(0, idx).toLowerCase();
  const payload = raw.slice(idx + 1);
  if (!header.includes(";base64")) return null;
  try {
    return Buffer.from(payload, "base64");
  } catch {
    return null;
  }
}

function expandLabels(items) {
  const expanded = [];
  for (const item of items || []) {
    const quantity = Math.max(0, Number(item?.quantity || 0));
    for (let i = 0; i < quantity; i += 1) {
      expanded.push({
        name: String(item?.name || "").trim(),
        price: Number(item?.price || 0),
        dataMatrix: String(item?.dataMatrix || item?.sku || item?.name || "").trim(),
      });
    }
  }
  return expanded;
}

async function buildCodePng(content, codeType = "datamatrix") {
  if (!content) return null;

  const bcid = codeType === "qrcode" ? "qrcode" : codeType === "code128" ? "code128" : "datamatrix";

  return bwipjs.toBuffer({
    bcid,
    text: content,
    scale: 2,
    includetext: false,
    paddingwidth: 0,
    paddingheight: 0,
  });
}

async function generarPdfEtiquetas(payload) {
  const settings = {
    pageWidthMm: Number(payload?.template?.pageWidthMm || 104),
    pageHeightMm: Number(payload?.template?.pageHeightMm || 15),
    labelWidthMm: Number(payload?.template?.labelWidthMm || 32),
    labelHeightMm: Number(payload?.template?.labelHeightMm || 15),
    columns: Number(payload?.template?.columns || 3),
    marginLeftMm: Number(payload?.template?.marginLeftMm || 2),
    gapHorizontalMm: Number(payload?.template?.gapHorizontalMm || 2),
    cornerRadiusMm: Number(payload?.template?.cornerRadiusMm || 3.2),
    contentPaddingLeftMm: Number(payload?.template?.contentPaddingLeftMm || 1.2),
    contentTopMm: Number(payload?.template?.contentTopMm || 0.6),
    showStoreName: payload?.template?.showStoreName !== false,
    storeNameMaxLen: Number(payload?.template?.storeNameMaxLen || 13),
    storeNameFontSize: Number(payload?.template?.storeNameFontSize || 6.6),
    nameMaxLen: Number(payload?.template?.nameMaxLen || 16),
    nameFontSize: Number(payload?.template?.nameFontSize || 7.1),
    priceFontSize: Number(payload?.template?.priceFontSize || 15.4),
    priceTopMm: Number(payload?.template?.priceTopMm || 7.1),
    dataMatrixSizeMm: Number(payload?.template?.dataMatrixSizeMm || 7.4),
    dataMatrixXPaddingMm: Number(payload?.template?.dataMatrixXPaddingMm || 1.1),
    dataMatrixYPaddingMm: Number(payload?.template?.dataMatrixYPaddingMm || 3.1),
    logoEnabled: Boolean(payload?.template?.logoEnabled),
    logoDataUrl: String(payload?.template?.logoDataUrl || ""),
    logoWidthMm: Number(payload?.template?.logoWidthMm || 6.5),
    logoHeightMm: Number(payload?.template?.logoHeightMm || 2.6),
    logoXOffsetMm: Number(payload?.template?.logoXOffsetMm || 1.2),
    logoYOffsetMm: Number(payload?.template?.logoYOffsetMm || 0.7),
    codeType: String(payload?.template?.codeType || "datamatrix").toLowerCase(),
    storeNameXMm: Number(payload?.template?.storeNameXMm || 1.2),
    storeNameYMm: Number(payload?.template?.storeNameYMm || 0.6),
    storeNameWidthMm: Number(payload?.template?.storeNameWidthMm || 20),
    storeNameHeightMm: Number(payload?.template?.storeNameHeightMm || 2.8),
    nameXMm: Number(payload?.template?.nameXMm || 1.2),
    nameYMm: Number(payload?.template?.nameYMm || 3.2),
    nameWidthMm: Number(payload?.template?.nameWidthMm || 20),
    nameHeightMm: Number(payload?.template?.nameHeightMm || 3.5),
    priceXMm: Number(payload?.template?.priceXMm || 1.1),
    priceYMm: Number(payload?.template?.priceYMm || 7.1),
    priceWidthMm: Number(payload?.template?.priceWidthMm || 20),
    priceHeightMm: Number(payload?.template?.priceHeightMm || 7.2),
    codeXMm: Number(payload?.template?.codeXMm || 23.5),
    codeYMm: Number(payload?.template?.codeYMm || 3.1),
    codeWidthMm: Number(payload?.template?.codeWidthMm || 7.4),
    codeHeightMm: Number(payload?.template?.codeHeightMm || 7.4),
    storeName: String(payload?.template?.storeName || "La Cosmetikera").trim(),
  };

  const labels = expandLabels(payload?.items || []);
  if (!labels.length) {
    throw new Error("No hay etiquetas para imprimir");
  }

  const rows = Math.ceil(labels.length / settings.columns);
  const fileName = `labels-${Date.now()}.pdf`;
  const outputPath = path.join(os.tmpdir(), fileName);

  const doc = new PDFDocument({
    autoFirstPage: false,
    size: [mmToPt(settings.pageWidthMm), mmToPt(settings.pageHeightMm)],
    margin: 0,
    compress: true,
  });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  const labelWidthPt = mmToPt(settings.labelWidthMm);
  const labelHeightPt = mmToPt(settings.labelHeightMm);
  const marginLeftPt = mmToPt(settings.marginLeftMm);
  const gapHorizontalPt = mmToPt(settings.gapHorizontalMm);
  const cornerRadiusPt = mmToPt(settings.cornerRadiusMm);

  const dmSizePt = mmToPt(settings.dataMatrixSizeMm);
  const contentPaddingLeftPt = mmToPt(settings.contentPaddingLeftMm);
  const contentTopPt = mmToPt(settings.contentTopMm);
  const logoBuffer = settings.logoEnabled ? parseDataUrlImageBuffer(settings.logoDataUrl) : null;
  const logoWidthPt = mmToPt(settings.logoWidthMm);
  const logoHeightPt = mmToPt(settings.logoHeightMm);
  const logoXOffsetPt = mmToPt(settings.logoXOffsetMm);
  const logoYOffsetPt = mmToPt(settings.logoYOffsetMm);

  for (let row = 0; row < rows; row += 1) {
    doc.addPage();

    for (let col = 0; col < settings.columns; col += 1) {
      const idx = row * settings.columns + col;
      const label = labels[idx];
      if (!label) continue;

      const x = marginLeftPt + col * (labelWidthPt + gapHorizontalPt);
      const y = 0;

      doc.save();
      doc.roundedRect(x, y, labelWidthPt, labelHeightPt, cornerRadiusPt).clip();

      if (logoBuffer) {
        try {
          doc.image(logoBuffer, x + logoXOffsetPt, y + logoYOffsetPt, {
            width: logoWidthPt,
            height: logoHeightPt,
          });
        } catch {
          // Si la imagen falla, continuamos con el texto.
        }
      }

      if (settings.showStoreName) {
        doc
          .fillColor("#000000")
          .font("Helvetica-Bold")
          .fontSize(settings.storeNameFontSize)
          .text(normalizeText(settings.storeName, settings.storeNameMaxLen), x + mmToPt(settings.storeNameXMm || 0), y + mmToPt(settings.storeNameYMm || 0), {
            width: mmToPt(settings.storeNameWidthMm || 20),
            height: mmToPt(settings.storeNameHeightMm || 2.8),
            lineBreak: false,
          });
      }

      // Nombre del artículo
      doc
        .fillColor("#000000")
        .font("Helvetica-Bold")
        .fontSize(settings.nameFontSize)
        .text(normalizeText(label.name, settings.nameMaxLen), x + mmToPt(settings.nameXMm || 0), y + mmToPt(settings.nameYMm || 0), {
          width: mmToPt(settings.nameWidthMm || 20),
          height: mmToPt(settings.nameHeightMm || 3.5),
          lineBreak: false,
        });

      // Precio destacado
      doc
        .fillColor("#000000")
        .font("Helvetica-Bold")
        .fontSize(settings.priceFontSize)
        .text(formatCop(label.price), x + mmToPt(settings.priceXMm || 1.1), y + mmToPt(settings.priceYMm || settings.priceTopMm), {
          width: mmToPt(settings.priceWidthMm || 20),
          height: mmToPt(settings.priceHeightMm || 7.2),
          lineBreak: false,
        });

      // Codigo seleccionable (Data Matrix, QR o Code128)
      try {
        const dmBuffer = await buildCodePng(label.dataMatrix, settings.codeType);
        if (dmBuffer) {
          doc.image(dmBuffer, x + mmToPt(settings.codeXMm || 0), y + mmToPt(settings.codeYMm || 0), {
            width: mmToPt(settings.codeWidthMm || settings.dataMatrixSizeMm),
            height: mmToPt(settings.codeHeightMm || settings.dataMatrixSizeMm),
          });
        }
      } catch (error) {
        // No bloquear la etiqueta por error de Data Matrix
      }

      doc.restore();
    }
  }

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return {
    outputPath,
    totalLabels: labels.length,
    pages: rows,
  };
}

module.exports = {
  generarPdfEtiquetas,
};
