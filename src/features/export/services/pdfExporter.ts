import type { Template } from '../../../shared/types';
import { applyPlaceholders } from '../../../shared/utils/placeholders';
import { wrapText } from '../../../shared/utils/wrapText';
import { getBytes, ref as storageRef } from 'firebase/storage';
import { storage } from '../../../shared/firebase/config';

export async function exportTextToPdf(
  content: string,
  placeholderData: Record<string, string>
): Promise<Uint8Array> {
  // Lazy-load pdf-lib
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');

  const resolved = applyPlaceholders(content, placeholderData);
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const marginX = 72;
  const marginY = 72;
  const fontSize = 11;
  const pageW = 595;
  const pageH = 842;
  const usableW = pageW - marginX * 2;

  let page = pdfDoc.addPage([pageW, pageH]);
  let y = pageH - marginY;

  for (const raw of resolved.split('\n')) {
    const isH1 = raw.startsWith('# ');
    const isH2 = raw.startsWith('## ');
    const isBold = raw.startsWith('### ');
    const text = raw.replace(/^#{1,3}\s+/, '').trim();
    const curFont = (isH1 || isH2 || isBold) ? boldFont : font;
    const curSize = isH1 ? 18 : isH2 ? 14 : fontSize;
    const gap = isH1 ? 8 : 2;

    if (text === '') { y -= fontSize * 1.4; continue; }

    for (const { text: wt } of wrapText(text, usableW, curSize, 1.4, 0)) {
      if (y < marginY) {
        page = pdfDoc.addPage([pageW, pageH]);
        y = pageH - marginY;
      }
      page.drawText(wt, { x: marginX, y, size: curSize, font: curFont, color: rgb(0.1, 0.1, 0.1) });
      y -= curSize * 1.4;
    }
    y -= gap;
  }

  return pdfDoc.save();
}

export async function exportPdfWithFields(
  template: Template,
  placeholderData: Record<string, string>
): Promise<Uint8Array> {
  if (!template.pdfStoragePath) throw new Error('No PDF uploaded for this template');

  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');

  const sRef = storageRef(storage, template.pdfStoragePath);
  const existingBytes = await getBytes(sRef);

  const pdfDoc = await PDFDocument.load(existingBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  for (const field of template.fields) {
    const page = pages[field.page - 1];
    if (!page) continue;
    const { height: pageH, width: pageW } = page.getSize();

    const rawValue = field.placeholder
      ? applyPlaceholders(field.placeholder, placeholderData)
      : (placeholderData[field.name] ?? '');

    if (!rawValue) continue;

    const fs = field.fontSize ?? 11;
    const textWidth = font.widthOfTextAtSize(rawValue, fs);
    let x = field.x;
    if (field.alignment === 'center') x = field.x + (field.width - textWidth) / 2;
    if (field.alignment === 'right') x = field.x + field.width - textWidth;
    x = Math.max(0, Math.min(x, pageW - textWidth));

    page.drawText(rawValue, {
      x,
      y: Math.max(0, pageH - field.y - field.height),
      size: fs,
      font,
      color: rgb(0, 0, 0),
      maxWidth: field.width,
    });
  }

  return pdfDoc.save();
}
