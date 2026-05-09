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

async function buildDataMatrixPng(content) {
  if (!content) return null;
  return bwipjs.toBuffer({
    bcid: "datamatrix",
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

  const dmSizePt = mmToPt(7.4);
  const dmXPadding = mmToPt(1.1);
  const dmYPadding = mmToPt(3.1);

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

      // Logo en negro (texto), alineado arriba a la izquierda
      doc
        .fillColor("#000000")
        .font("Helvetica-Bold")
        .fontSize(6.6)
        .text(normalizeText(settings.storeName, 13), x + mmToPt(1.3), y + mmToPt(0.6), {
          width: labelWidthPt - dmSizePt - mmToPt(3.6),
          height: mmToPt(2.8),
          lineBreak: false,
        });

      // Nombre del artículo
      doc
        .fillColor("#000000")
        .font("Helvetica-Bold")
        .fontSize(7.1)
        .text(normalizeText(label.name, 16), x + mmToPt(1.3), y + mmToPt(3.2), {
          width: labelWidthPt - dmSizePt - mmToPt(3.8),
          height: mmToPt(3.5),
          lineBreak: false,
        });

      // Precio destacado
      doc
        .fillColor("#000000")
        .font("Helvetica-Bold")
        .fontSize(15.4)
        .text(formatCop(label.price), x + mmToPt(1.1), y + mmToPt(7.1), {
          width: labelWidthPt - dmSizePt - mmToPt(3.6),
          height: mmToPt(7.2),
          lineBreak: false,
        });

      // Data Matrix pequeño y legible
      try {
        const dmBuffer = await buildDataMatrixPng(label.dataMatrix);
        if (dmBuffer) {
          doc.image(dmBuffer, x + labelWidthPt - dmSizePt - dmXPadding, y + dmYPadding, {
            width: dmSizePt,
            height: dmSizePt,
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
