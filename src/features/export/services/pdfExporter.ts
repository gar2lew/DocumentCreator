import type { Template } from '../../../shared/types';
import { resolveToSegments, type TemplateStyles, type PlaceholderStyle } from '../../../shared/utils/placeholders';
import { renderLegacySafe } from '../../../features/documentEngine';
import { wrapText, type WrappedLine } from '../../../shared/utils/wrapText';
import { getBytes, ref as storageRef } from 'firebase/storage';
import { storage } from '../../../shared/firebase/config';

function isHtmlContent(content: string): boolean {
  return content.includes('<') && (content.includes('</p>') || content.includes('</h') || content.includes('<ul') || content.includes('<ol') || content.includes('<table'));
}

interface HtmlBlock {
  type: 'paragraph' | 'h1' | 'h2' | 'h3' | 'list' | 'blockquote' | 'code' | 'br';
  text: string;
  bold?: boolean;
  italic?: boolean;
  indent?: number;
}

function parseHtmlToBlocks(html: string): HtmlBlock[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks: HtmlBlock[] = [];

  function extractText(el: Element): string {
    let text = '';
    el.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const child = node as Element;
        const tag = child.tagName.toLowerCase();
        if (tag === 'strong' || tag === 'b') text += `**${child.textContent}**`;
        else if (tag === 'em' || tag === 'i') text += `*${child.textContent}*`;
        else if (tag === 'br') text += '\n';
        else text += extractText(child);
      }
    });
    return text;
  }

  doc.body.childNodes.forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (tag === 'p' || tag === 'div') {
      blocks.push({ type: 'paragraph', text: extractText(el) });
    } else if (tag === 'h1') {
      blocks.push({ type: 'h1', text: el.textContent || '' });
    } else if (tag === 'h2') {
      blocks.push({ type: 'h2', text: el.textContent || '' });
    } else if (tag === 'h3') {
      blocks.push({ type: 'h3', text: el.textContent || '' });
    } else if (tag === 'ul') {
      el.querySelectorAll('li').forEach((li) => {
        blocks.push({ type: 'list', text: `• ${li.textContent || ''}`, indent: 20 });
      });
    } else if (tag === 'ol') {
      el.querySelectorAll('li').forEach((li, i) => {
        blocks.push({ type: 'list', text: `${i + 1}. ${li.textContent || ''}`, indent: 20 });
      });
    } else if (tag === 'blockquote') {
      blocks.push({ type: 'blockquote', text: el.textContent || '', italic: true, indent: 30 });
    } else if (tag === 'pre' || tag === 'code') {
      blocks.push({ type: 'code', text: el.textContent || '' });
    } else if (tag === 'br') {
      blocks.push({ type: 'br', text: '' });
    } else {
      el.childNodes.forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const childEl = child as Element;
          const childTag = childEl.tagName.toLowerCase();
          if (['p', 'h1', 'h2', 'h3', 'ul', 'ol', 'blockquote', 'pre', 'br'].includes(childTag)) {
            // Already handled above
          } else {
            blocks.push({ type: 'paragraph', text: extractText(childEl) });
          }
        }
      });
    }
  });

  return blocks;
}

export async function exportTextToPdf(
  content: string,
  placeholderData: Record<string, string>,
  watermark?: 'draft' | 'confidential',
  styles?: TemplateStyles
): Promise<Uint8Array> {
  const { PDFDocument, rgb, StandardFonts, degrees } = await import('pdf-lib');

  const segments = resolveToSegments(content, placeholderData);
  const resolved = segments.map(s => s.text).join('');
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const boldItalicFont = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

  const marginX = 72;
  const marginY = 72;
  const fontSize = 11;
  const pageW = 595;
  const pageH = 842;
  const usableW = pageW - marginX * 2;

  let page = pdfDoc.addPage([pageW, pageH]);
  let y = pageH - marginY;

  function getFontForStyle(style?: PlaceholderStyle, isBold?: boolean, isItalic?: boolean) {
    const b = style?.bold || isBold || false;
    const i = style?.italic || isItalic || false;
    if (b && i) return boldItalicFont;
    if (b) return boldFont;
    if (i) return italicFont;
    return font;
  }

  function getSizeForStyle(style?: PlaceholderStyle, defaultSize?: number): number {
    return style?.fontSize || defaultSize || fontSize;
  }

  function checkPageBreak(lines: WrappedLine[], curSize: number, lineHeight: number, curFont: any) {
    for (const line of lines) {
      if (y < marginY) {
        page = pdfDoc.addPage([pageW, pageH]);
        y = pageH - marginY;
      }
      page.drawText(line.text, { x: marginX, y, size: curSize, font: curFont, color: rgb(0.1, 0.1, 0.1) });
      y -= lineHeight;
    }
  }

  let curFont = font;

  if (isHtmlContent(resolved)) {
    const blocks = parseHtmlToBlocks(resolved);
    for (const block of blocks) {
      const indent = block.indent || 0;
      const blockMarginX = marginX + indent;
      const blockUsableW = usableW - indent;

      if (block.type === 'h1') {
        curFont = boldFont;
        const lines = wrapText(block.text, blockUsableW, 18, 1.4, 0);
        checkPageBreak(lines, 18, 18 * 1.4, curFont);
        y -= 8;
      } else if (block.type === 'h2') {
        curFont = boldFont;
        const lines = wrapText(block.text, blockUsableW, 14, 1.4, 0);
        checkPageBreak(lines, 14, 14 * 1.4, curFont);
        y -= 6;
      } else if (block.type === 'h3') {
        curFont = boldFont;
        const lines = wrapText(block.text, blockUsableW, 12, 1.4, 0);
        checkPageBreak(lines, 12, 12 * 1.4, curFont);
        y -= 4;
      } else if (block.type === 'blockquote') {
        curFont = block.italic ? italicFont : font;
        const lines = wrapText(block.text, blockUsableW - 10, fontSize, 1.4, 0);
        for (const line of lines) {
          if (y < marginY) {
            page = pdfDoc.addPage([pageW, pageH]);
            y = pageH - marginY;
          }
          page.drawText(line.text, { x: blockMarginX + 10, y, size: fontSize, font, color: rgb(0.4, 0.4, 0.4) });
          y -= fontSize * 1.4;
        }
        y -= 4;
      } else if (block.type === 'code') {
        const codeFont = await pdfDoc.embedFont(StandardFonts.Courier);
        const lines = wrapText(block.text, blockUsableW, 9, 1.3, 0);
        for (const line of lines) {
          if (y < marginY) {
            page = pdfDoc.addPage([pageW, pageH]);
            y = pageH - marginY;
          }
          page.drawText(line.text, { x: blockMarginX, y, size: 9, font: codeFont, color: rgb(0.2, 0.2, 0.2) });
          y -= 9 * 1.3;
        }
        y -= 6;
      } else if (block.type === 'br') {
        y -= fontSize * 1.4;
      } else {
        curFont = font;
        const lines = wrapText(block.text, blockUsableW, fontSize, 1.4, 0);
        checkPageBreak(lines, fontSize, fontSize * 1.4, curFont);
        y -= 2;
      }
    }
  } else {
    const lines = resolved.split('\n');
    let segCharIndex = 0;
    const segLineBoundaries: number[] = [];
    for (const line of lines) {
      segLineBoundaries.push(segCharIndex);
      segCharIndex += line.length + 1;
    }

    for (let idx = 0; idx < lines.length; idx++) {
      const raw = lines[idx];
      const isH1 = raw.startsWith('# ');
      const isH2 = raw.startsWith('## ');
      const isBold = raw.startsWith('### ');
      const text = raw.replace(/^#{1,3}\s+/, '').trim();
      const curSize = isH1 ? 18 : isH2 ? 14 : fontSize;
      const gap = isH1 ? 8 : 2;

      if (text === '') { y -= fontSize * 1.4; continue; }

      let alignment: 'left' | 'center' | 'right' | undefined;
      if (raw.trim().startsWith('# ') && !isH2 && !isBold) alignment = 'center';
      else if (raw.trim().startsWith('> ')) alignment = 'right';
      else alignment = 'left';

      curFont = (isH1 || isH2 || isBold) ? boldFont : font;

      const lineSegStart = segLineBoundaries[idx];
      let segOffset = 0;

      for (const seg of segments) {
        const segGlobalStart = segOffset;
        const segGlobalEnd = segGlobalStart + seg.text.length;

        if (segGlobalEnd <= lineSegStart) {
          segOffset = segGlobalEnd;
          continue;
        }
        if (segGlobalStart >= lineSegStart + text.length) break;

        const overlapStart = Math.max(0, segGlobalStart - lineSegStart);
        const overlapEnd = Math.min(text.length, segGlobalEnd - lineSegStart);

        if (overlapStart < overlapEnd) {
          const segText = seg.text.slice(overlapStart - (segGlobalStart - lineSegStart), overlapEnd - (segGlobalStart - lineSegStart));
          const style = seg.type === 'placeholder' && styles ? styles[seg.key || ''] : undefined;
          const segFont = getFontForStyle(style, isH1 || isH2 || isBold, false);
          const segSize = getSizeForStyle(style, curSize);

          const wrapped = wrapText(segText, usableW, segSize, 1.4, 0);
          for (const w of wrapped) {
            if (y < marginY) {
              page = pdfDoc.addPage([pageW, pageH]);
              y = pageH - marginY;
            }

            let drawX = marginX;
            if (alignment === 'center') {
              const textW = segFont.widthOfTextAtSize(w.text, segSize);
              drawX = marginX + (usableW - textW) / 2;
            } else if (alignment === 'right') {
              const textW = segFont.widthOfTextAtSize(w.text, segSize);
              drawX = marginX + usableW - textW;
            }

            page.drawText(w.text, { x: drawX, y, size: segSize, font: segFont, color: rgb(0.1, 0.1, 0.1) });
            y -= segSize * 1.4;
          }
        }

        segOffset = segGlobalEnd;
      }

      y -= gap;
    }
  }

  if (watermark) {
    const watermarkText = watermark === 'draft' ? 'DRAFT' : 'CONFIDENTIAL';
    const watermarkColor = watermark === 'draft' ? rgb(1, 0, 0) : rgb(0.55, 0, 0);
    const watermarkSize = 60;
    const watermarkFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    for (const p of pdfDoc.getPages()) {
      const { width, height } = p.getSize();
      const textWidth = watermarkFont.widthOfTextAtSize(watermarkText, watermarkSize);
      p.drawText(watermarkText, {
        x: (width - textWidth) / 2,
        y: height / 2 - watermarkSize / 2,
        size: watermarkSize,
        font: watermarkFont,
        color: watermarkColor,
        opacity: 0.15,
        rotate: degrees(-45),
      });
    }
  }

  return pdfDoc.save();
}

export async function exportPdfWithFields(
  template: Template,
  placeholderData: Record<string, string>,
  watermark?: 'draft' | 'confidential'
): Promise<Uint8Array> {
  if (!template.pdfStoragePath) throw new Error('No PDF uploaded for this template');

  const { PDFDocument, rgb, StandardFonts, degrees } = await import('pdf-lib');

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
      ? renderLegacySafe(field.placeholder, placeholderData)
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

  if (watermark) {
    const watermarkText = watermark === 'draft' ? 'DRAFT' : 'CONFIDENTIAL';
    const watermarkColor = watermark === 'draft' ? rgb(1, 0, 0) : rgb(0.55, 0, 0);
    const watermarkSize = 60;
    const watermarkFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    for (const p of pdfDoc.getPages()) {
      const { width, height } = p.getSize();
      const textWidth = watermarkFont.widthOfTextAtSize(watermarkText, watermarkSize);
      p.drawText(watermarkText, {
        x: (width - textWidth) / 2,
        y: height / 2 - watermarkSize / 2,
        size: watermarkSize,
        font: watermarkFont,
        color: watermarkColor,
        opacity: 0.15,
        rotate: degrees(-45),
      });
    }
  }

  return pdfDoc.save();
}
