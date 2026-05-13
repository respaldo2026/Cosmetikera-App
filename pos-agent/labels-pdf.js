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

function normalizeAlign(input, fallback = "left") {
  const value = String(input || "").toLowerCase();
  if (value === "center" || value === "right" || value === "justify") return value;
  return fallback;
}

/**
 * Calcula la posición X real de inicio del texto según alineación.
 * PDFKit ignora `align` cuando se usa `lineBreak: false`, por lo que
 * se computa manualmente aquí.
 */
function alignedTextX(baseX, containerW, textW, align) {
  const tw = Math.min(Math.max(0, textW), Math.max(1, containerW));
  if (align === "center") return baseX + (containerW - tw) / 2;
  if (align === "right")  return baseX + containerW - tw;
  return baseX; // left o justify → desde la izquierda
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
        shortCode: item?.shortCode ? String(item.shortCode).trim() : null,
      });
    }
  }
  return expanded;
}

async function buildCodePng(content, codeType = "datamatrix") {
  if (!content) return null;

  const bcid = codeType === "aztec"
    ? "azteccode"
    : codeType === "qrcode"
    ? "qrcode"
    : codeType === "code128"
    ? "code128"
    : "datamatrix";

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
    // Usar ?? (nullish coalescing) en vez de || para que valores 0 sean válidos
    pageWidthMm: Number(payload?.template?.pageWidthMm ?? 104),
    pageHeightMm: Number(payload?.template?.pageHeightMm ?? 15),
    labelWidthMm: Number(payload?.template?.labelWidthMm ?? 32),
    labelHeightMm: Number(payload?.template?.labelHeightMm ?? 15),
    columns: Number(payload?.template?.columns ?? 3),
    marginLeftMm: Number(payload?.template?.marginLeftMm ?? 2),
    gapHorizontalMm: Number(payload?.template?.gapHorizontalMm ?? 2),
    cornerRadiusMm: Number(payload?.template?.cornerRadiusMm ?? 3.2),
    contentPaddingLeftMm: Number(payload?.template?.contentPaddingLeftMm ?? 1.2),
    contentTopMm: Number(payload?.template?.contentTopMm ?? 0.6),
    showStoreName: payload?.template?.showStoreName !== false,
    storeNameAlign: normalizeAlign(payload?.template?.storeNameAlign, "left"),
    storeNameMaxLen: Number(payload?.template?.storeNameMaxLen ?? 13),
    storeNameFontSize: Number(payload?.template?.storeNameFontSize ?? 6.6),
    nameMaxLen: Number(payload?.template?.nameMaxLen ?? 16),
    nameAlign: normalizeAlign(payload?.template?.nameAlign, "left"),
    nameFontSize: Number(payload?.template?.nameFontSize ?? 7.1),
    priceFontSize: Number(payload?.template?.priceFontSize ?? 15.4),
    priceAlign: normalizeAlign(payload?.template?.priceAlign, "left"),
    priceTopMm: Number(payload?.template?.priceTopMm ?? 7.1),
    dataMatrixSizeMm: Number(payload?.template?.dataMatrixSizeMm ?? 7.4),
    dataMatrixXPaddingMm: Number(payload?.template?.dataMatrixXPaddingMm ?? 1.1),
    dataMatrixYPaddingMm: Number(payload?.template?.dataMatrixYPaddingMm ?? 3.1),
    logoEnabled: Boolean(payload?.template?.logoEnabled),
    logoDataUrl: String(payload?.template?.logoDataUrl ?? ""),
    logoWidthMm: Number(payload?.template?.logoWidthMm ?? 6.5),
    logoHeightMm: Number(payload?.template?.logoHeightMm ?? 2.6),
    logoXOffsetMm: Number(payload?.template?.logoXOffsetMm ?? 1.2),
    logoYOffsetMm: Number(payload?.template?.logoYOffsetMm ?? 0.7),
    codeType: String(payload?.template?.codeType ?? "datamatrix").toLowerCase(),
    contentRotationDeg: Number(payload?.template?.contentRotationDeg ?? 0),
    storeNameXMm: Number(payload?.template?.storeNameXMm ?? 1.2),
    storeNameYMm: Number(payload?.template?.storeNameYMm ?? 0.6),
    storeNameWidthMm: Number(payload?.template?.storeNameWidthMm ?? 20),
    storeNameHeightMm: Number(payload?.template?.storeNameHeightMm ?? 2.8),
    nameXMm: Number(payload?.template?.nameXMm ?? 1.2),
    nameYMm: Number(payload?.template?.nameYMm ?? 3.2),
    nameWidthMm: Number(payload?.template?.nameWidthMm ?? 20),
    nameHeightMm: Number(payload?.template?.nameHeightMm ?? 3.5),
    priceXMm: Number(payload?.template?.priceXMm ?? 1.1),
    priceYMm: Number(payload?.template?.priceYMm ?? 7.1),
    priceWidthMm: Number(payload?.template?.priceWidthMm ?? 20),
    priceHeightMm: Number(payload?.template?.priceHeightMm ?? 7.2),
    codeXMm: Number(payload?.template?.codeXMm ?? 23.5),
    codeYMm: Number(payload?.template?.codeYMm ?? 3.1),
    codeWidthMm: Number(payload?.template?.codeWidthMm ?? 7.4),
    codeHeightMm: Number(payload?.template?.codeHeightMm ?? 7.4),
    showProductName: payload?.template?.showProductName !== false,
    showPrice: payload?.template?.showPrice !== false,
    showCode: payload?.template?.showCode !== false,
    showShortCodeAboveQr: payload?.template?.showShortCodeAboveQr !== false,
    showFreeText: Boolean(payload?.template?.showFreeText),
    freeText: String(payload?.template?.freeText ?? "").trim(),
    freeTextAlign: normalizeAlign(payload?.template?.freeTextAlign, "left"),
    freeTextFontSize: Number(payload?.template?.freeTextFontSize ?? 5.8),
    freeTextMaxLen: Number(payload?.template?.freeTextMaxLen ?? 28),
    freeTextXMm: Number(payload?.template?.freeTextXMm ?? 1.2),
    freeTextYMm: Number(payload?.template?.freeTextYMm ?? 12.1),
    freeTextWidthMm: Number(payload?.template?.freeTextWidthMm ?? 20),
    freeTextHeightMm: Number(payload?.template?.freeTextHeightMm ?? 2.3),
    storeName: String(payload?.template?.storeName ?? "La Cosmetikera").trim(),
    debugMarks: Boolean(payload?.template?.debugMarks),
  };

  const labels = expandLabels(payload?.items || []);
  if (!labels.length) {
    throw new Error("No hay etiquetas para imprimir");
  }

  // El driver ya está configurado con 3 columnas sobre una tira de 104x15 mm.
  // Generamos una pagina PDF por fila completa, con las 3 etiquetas dibujadas
  // en su posicion real dentro de la pagina.
  const fileName = `labels-${Date.now()}.pdf`;
  const outputPath = path.join(os.tmpdir(), fileName);

  const labelWidthPt = mmToPt(settings.labelWidthMm);
  const labelHeightPt = mmToPt(settings.labelHeightMm);
  const marginLeftPt = mmToPt(settings.marginLeftMm);
  const gapHorizontalPt = mmToPt(settings.gapHorizontalMm);
  const cornerRadiusPt = mmToPt(settings.cornerRadiusMm);
  const logoBuffer = settings.logoEnabled ? parseDataUrlImageBuffer(settings.logoDataUrl) : null;
  const logoWidthPt = mmToPt(settings.logoWidthMm);
  const logoHeightPt = mmToPt(settings.logoHeightMm);
  const logoXOffsetPt = mmToPt(settings.logoXOffsetMm);
  const logoYOffsetPt = mmToPt(settings.logoYOffsetMm);
  const contentOffsetXPt = mmToPt(settings.contentPaddingLeftMm || 0);
  const contentOffsetYPt = mmToPt(settings.contentTopMm || 0);

  const rows = Math.ceil(labels.length / settings.columns);

  const doc = new PDFDocument({
    autoFirstPage: false,
    size: [mmToPt(settings.pageWidthMm), mmToPt(settings.pageHeightMm)],
    margin: 0,
    compress: true,
  });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  for (let row = 0; row < rows; row += 1) {
    doc.addPage();
    if (settings.debugMarks) {
      const pageWidthPt = mmToPt(settings.pageWidthMm);
      const pageHeightPt = mmToPt(settings.pageHeightMm);
      doc.save();
      doc.lineWidth(0.5);
      doc.rect(1, 1, pageWidthPt - 2, pageHeightPt - 2).stroke();
      doc.font("Helvetica").fontSize(6).fillColor("#000000");
      doc.text(`W:${settings.pageWidthMm} H:${settings.pageHeightMm}`, 2, 1, { lineBreak: false });
      doc.text("L", 2, pageHeightPt - 8, { lineBreak: false });
      doc.text("C", pageWidthPt / 2 - 2, pageHeightPt - 8, { lineBreak: false });
      doc.text("R", pageWidthPt - 6, pageHeightPt - 8, { lineBreak: false });
      doc.restore();
    }

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
          doc.image(logoBuffer, x + contentOffsetXPt + logoXOffsetPt, y + contentOffsetYPt + logoYOffsetPt, {
            width: logoWidthPt,
            height: logoHeightPt,
          });
        } catch {
          // Si la imagen falla, continuamos con el texto.
        }
      }

      if (settings.showStoreName) {
        const _sText = normalizeText(settings.storeName, settings.storeNameMaxLen);
        doc.font("Helvetica-Bold").fontSize(settings.storeNameFontSize);
        const _sRenderX = alignedTextX(
          x + contentOffsetXPt + mmToPt(settings.storeNameXMm),
          mmToPt(settings.storeNameWidthMm),
          doc.widthOfString(_sText),
          settings.storeNameAlign
        );
        doc.fillColor("#000000")
          .text(_sText, _sRenderX, y + contentOffsetYPt + mmToPt(settings.storeNameYMm), { lineBreak: false });
      }

      // Nombre del artículo
      if (settings.showProductName) {
        const _nText = normalizeText(label.name, settings.nameMaxLen);
        doc.font("Helvetica-Bold").fontSize(settings.nameFontSize);
        const _nRenderX = alignedTextX(
          x + contentOffsetXPt + mmToPt(settings.nameXMm),
          mmToPt(settings.nameWidthMm),
          doc.widthOfString(_nText),
          settings.nameAlign
        );
        doc.fillColor("#000000")
          .text(_nText, _nRenderX, y + contentOffsetYPt + mmToPt(settings.nameYMm), { lineBreak: false });
      }

      // Precio destacado
      if (settings.showPrice) {
        const _pText = formatCop(label.price);
        doc.font("Helvetica-Bold").fontSize(settings.priceFontSize);
        const _pRenderX = alignedTextX(
          x + contentOffsetXPt + mmToPt(settings.priceXMm),
          mmToPt(settings.priceWidthMm),
          doc.widthOfString(_pText),
          settings.priceAlign
        );
        doc.fillColor("#000000")
          .text(_pText, _pRenderX, y + contentOffsetYPt + mmToPt(settings.priceYMm), { lineBreak: false });
      }

      // Texto libre
      if (settings.showFreeText && settings.freeText) {
        const _fText = normalizeText(settings.freeText, settings.freeTextMaxLen);
        doc.font("Helvetica").fontSize(settings.freeTextFontSize);
        const _fRenderX = alignedTextX(
          x + contentOffsetXPt + mmToPt(settings.freeTextXMm),
          mmToPt(settings.freeTextWidthMm),
          doc.widthOfString(_fText),
          settings.freeTextAlign
        );
        doc.fillColor("#000000")
          .text(_fText, _fRenderX, y + contentOffsetYPt + mmToPt(settings.freeTextYMm), { lineBreak: false });
      }

      // Codigo seleccionable (Data Matrix, QR o Code128)
      if (settings.showCode) {
        try {
          const dmBuffer = await buildCodePng(label.dataMatrix, settings.codeType);
          if (dmBuffer) {
            const codeX = x + contentOffsetXPt + mmToPt(settings.codeXMm);
            const codeY = y + contentOffsetYPt + mmToPt(settings.codeYMm);

            // Renderizar código corto encima del QR
            if (settings.showShortCodeAboveQr && label.shortCode) {
              const shortText = String(label.shortCode).trim();
              if (shortText) {
                doc.font("Helvetica-Bold").fontSize(5.0);
                const codeWidthPt = mmToPt(settings.codeWidthMm || settings.dataMatrixSizeMm);
                const textW = doc.widthOfString(shortText);
                const textX = alignedTextX(codeX, codeWidthPt, textW, "center");
                const textY = codeY - mmToPt(2.2);
                doc.fillColor("#000000").text(shortText, textX, textY, { lineBreak: false });
              }
            }

            doc.image(dmBuffer, codeX, codeY, {
              width: mmToPt(settings.codeWidthMm || settings.dataMatrixSizeMm),
              height: mmToPt(settings.codeHeightMm || settings.dataMatrixSizeMm),
            });
          }
        } catch (error) {
          // No bloquear la etiqueta por error de Data Matrix
        }
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
