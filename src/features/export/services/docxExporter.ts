import { normalizePlaceholderData, resolvePlaceholderValue, resolveToSegments, type TemplateStyles } from '../../../shared/utils/placeholders';
import type { IParagraphOptions, IRunOptions } from 'docx';

type DocxAlignment = string;

function inferAlignment(line: string): DocxAlignment {
  if (line.trim().startsWith('# ')) return 'center';
  if (line.trim().startsWith('> ')) return 'right';
  return 'left';
}

function inferHeadingLevel(line: string): { level: number; text: string } | null {
  const match = line.match(/^(#{1,3})\s+(.+)$/);
  if (!match) return null;
  return { level: match[1].length, text: match[2] };
}

function describeDocxRenderError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return 'Unknown DOCX render error';
}

function renderDocxSafely(doc: { render: (data: Record<string, string>) => void }, data: Record<string, string>): void {
  try {
    doc.render(data);
  } catch (error) {
    throw new Error(`DOCX template render failed: ${describeDocxRenderError(error)}`, { cause: error });
  }
}

function htmlToDocxParagraphs(html: string) {
  // Lazy-load docx
  const { Paragraph, TextRun, HeadingLevel } = require('docx');

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const paragraphs: InstanceType<typeof Paragraph>[] = [];

  function processNode(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text.trim()) {
        paragraphs.push(new Paragraph({ children: [new TextRun(text)] }));
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (tag === 'p' || tag === 'div') {
      const children: InstanceType<typeof TextRun>[] = [];
      el.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent || '';
          if (text) children.push(new TextRun({ text }));
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          children.push(...processInlineElement(child as Element));
        }
      });
      if (children.length === 0) {
        paragraphs.push(new Paragraph({ text: '' }));
      } else {
        paragraphs.push(new Paragraph({ children }));
      }
    } else if (tag === 'h1') {
      const text = el.textContent || '';
      paragraphs.push(new Paragraph({ text, heading: HeadingLevel.HEADING_1 }));
    } else if (tag === 'h2') {
      const text = el.textContent || '';
      paragraphs.push(new Paragraph({ text, heading: HeadingLevel.HEADING_2 }));
    } else if (tag === 'h3') {
      const text = el.textContent || '';
      paragraphs.push(new Paragraph({ text, heading: HeadingLevel.HEADING_3 }));
    } else if (tag === 'ul' || tag === 'ol') {
      el.querySelectorAll('li').forEach((li, i) => {
        const prefix = tag === 'ol' ? `${i + 1}. ` : '• ';
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: prefix + (li.textContent || '') })],
          indent: { left: 720 },
        }));
      });
    } else if (tag === 'blockquote') {
      const children: InstanceType<typeof TextRun>[] = [];
      el.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent || '';
          if (text) children.push(new TextRun({ text, italics: true }));
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          children.push(...processInlineElement(child as Element, { italics: true }));
        }
      });
      paragraphs.push(new Paragraph({
        children,
        indent: { left: 720 },
        border: { left: { size: 12, color: '4F46E5', space: 24 } },
      }));
    } else if (tag === 'pre' || tag === 'code') {
      const text = el.textContent || '';
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text, font: 'Courier New', size: 20 })],
        shading: { type: 'clear', color: 'F3F4F6', fill: 'F3F4F6' },
        spacing: { before: 120, after: 120 },
      }));
    } else if (tag === 'table') {
      const { Table, TableRow, TableCell } = require('docx');
      const rows: InstanceType<typeof TableRow>[] = [];
      el.querySelectorAll('tr').forEach((tr, rowIdx) => {
        const cells: InstanceType<typeof TableCell>[] = [];
        tr.querySelectorAll('td, th').forEach((cell) => {
          const isHeader = cell.tagName.toLowerCase() === 'th' || rowIdx === 0;
          const children: InstanceType<typeof TextRun>[] = [];
          cell.childNodes.forEach((child) => {
            if (child.nodeType === Node.TEXT_NODE) {
              const text = child.textContent || '';
              if (text) children.push(new TextRun({ text, bold: isHeader }));
            } else if (child.nodeType === Node.ELEMENT_NODE) {
              children.push(...processInlineElement(child as Element, { bold: isHeader }));
            }
          });
          cells.push(new TableCell({
            children: [new Paragraph({ children })],
            shading: isHeader ? { type: 'clear', color: 'F3F4F6', fill: 'F3F4F6' } : undefined,
          }));
        });
        rows.push(new TableRow({ children: cells }));
      });
      if (rows.length > 0) {
        paragraphs.push(new Paragraph({
          children: [new Table({ rows })],
        }));
      }
    } else if (tag === 'br') {
      paragraphs.push(new Paragraph({ text: '' }));
    } else {
      el.childNodes.forEach(processNode);
    }
  }

  function processInlineElement(el: Element, baseOpts: IRunOptions = {}): InstanceType<typeof TextRun>[] {
    const tag = el.tagName.toLowerCase();
    const runs: InstanceType<typeof TextRun>[] = [];

    if (tag === 'strong' || tag === 'b') {
      el.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          runs.push(new TextRun({ ...baseOpts, bold: true, text: child.textContent || '' }));
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          runs.push(...processInlineElement(child as Element, { ...baseOpts, bold: true }));
        }
      });
    } else if (tag === 'em' || tag === 'i') {
      el.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          runs.push(new TextRun({ ...baseOpts, italics: true, text: child.textContent || '' }));
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          runs.push(...processInlineElement(child as Element, { ...baseOpts, italics: true }));
        }
      });
    } else if (tag === 'u') {
      el.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          runs.push(new TextRun({ ...baseOpts, underline: {}, text: child.textContent || '' }));
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          runs.push(...processInlineElement(child as Element, { ...baseOpts, underline: {} }));
        }
      });
    } else if (tag === 's' || tag === 'strike' || tag === 'del') {
      el.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          runs.push(new TextRun({ ...baseOpts, strike: true, text: child.textContent || '' }));
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          runs.push(...processInlineElement(child as Element, { ...baseOpts, strike: true }));
        }
      });
    } else if (tag === 'a') {
      el.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          runs.push(new TextRun({ ...baseOpts, text: child.textContent || '', style: 'Hyperlink', color: '4F46E5' }));
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          runs.push(...processInlineElement(child as Element, baseOpts));
        }
      });
    } else if (tag === 'code') {
      el.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          runs.push(new TextRun({ ...baseOpts, text: child.textContent || '', font: 'Courier New', size: 20, shading: { type: 'clear', color: 'F3F4F6', fill: 'F3F4F6' } }));
        }
      });
    } else {
      el.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent || '';
          if (text) runs.push(new TextRun({ ...baseOpts, text }));
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          runs.push(...processInlineElement(child as Element, baseOpts));
        }
      });
    }

    return runs;
  }

  doc.body.childNodes.forEach(processNode);
  return paragraphs;
}

export async function exportToDocx(
  content: string,
  placeholderData: Record<string, string>,
  watermark?: 'draft' | 'confidential',
  styles?: TemplateStyles
): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } = await import('docx');

  const segments = resolveToSegments(content, placeholderData);
  const resolved = segments.map(s => s.text).join('');

  const isHtml = resolved.includes('<') && (resolved.includes('</p>') || resolved.includes('</h') || resolved.includes('<ul') || resolved.includes('<ol') || resolved.includes('<table'));

  function applyStyleToRunOpts(style?: any): any {
    if (!style) return {};
    const opts: any = {};
    if (style.fontFamily) opts.font = style.fontFamily;
    if (style.fontSize) opts.size = style.fontSize * 2;
    if (style.bold) opts.bold = true;
    if (style.italic) opts.italics = true;
    if (style.underline) opts.underline = {};
    return opts;
  }

  function buildStyledRunsForLine(line: string, segStartIdx: number): { runs: InstanceType<typeof TextRun>[]; alignment: string } {
    const alignment = inferAlignment(line);
    const text = line.replace(/^[>#]\s+/, '').trim();
    if (!text) return { runs: [new TextRun('')], alignment };

    const runs: InstanceType<typeof TextRun>[] = [];
    let charOffset = 0;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const segText = seg.text;
      const segLen = segText.length;

      if (segStartIdx + charOffset >= text.length) break;

      const segInLineStart = segStartIdx + charOffset;
      const segInLineEnd = segInLineStart + segLen;

      if (segInLineEnd <= 0) {
        charOffset += segLen;
        continue;
      }

      const overlapStart = Math.max(0, segInLineStart);
      const overlapEnd = Math.min(text.length, segInLineEnd);

      if (overlapStart < overlapEnd) {
        const overlapText = segText.slice(overlapStart - segInLineStart, overlapEnd - segInLineStart);
        const style = seg.type === 'placeholder' && styles ? styles[seg.key || ''] : undefined;
        const styleOpts = applyStyleToRunOpts(style);

        const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|([^*]+))/g;
        let m;
        let remaining = overlapText;
        let foundFormatting = false;

        while ((m = pattern.exec(remaining)) !== null) {
          foundFormatting = true;
          if (m[2]) runs.push(new TextRun({ ...styleOpts, bold: true, text: m[2] }));
          else if (m[3]) runs.push(new TextRun({ ...styleOpts, italics: true, text: m[3] }));
          else if (m[4]) runs.push(new TextRun({ ...styleOpts, text: m[4] }));
        }

        if (!foundFormatting) {
          runs.push(new TextRun({ ...styleOpts, text: overlapText }));
        }
      }

      charOffset += segLen;
    }

    return { runs: runs.length ? runs : [new TextRun(text)], alignment };
  }

  let paragraphs: any[];
  if (isHtml) {
    paragraphs = htmlToDocxParagraphs(resolved);
  } else {
    const lines = resolved.split('\n');
    let segCharIndex = 0;
    const segLineBoundaries: number[] = [];
    for (const line of lines) {
      segLineBoundaries.push(segCharIndex);
      segCharIndex += line.length + 1;
    }

    paragraphs = lines.map((line, idx) => {
      const heading = inferHeadingLevel(line);
      if (heading) {
        const levels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3] as const;
        return new Paragraph({ text: heading.text, heading: levels[heading.level - 1] });
      }
      if (line.trim() === '') return new Paragraph({ text: '' });

      const { runs, alignment } = buildStyledRunsForLine(line, segLineBoundaries[idx]);
      const paraOpts: IParagraphOptions = {
        alignment: alignment as IParagraphOptions['alignment'],
        children: runs,
      };
      return new Paragraph(paraOpts);
    });
  }

  if (watermark) {
    paragraphs.push(new Paragraph({ text: '' }));
    paragraphs.push(new Paragraph({ text: '' }));
    paragraphs.push(new Paragraph({
      children: [new TextRun({
        text: watermark === 'draft' ? '— DRAFT —' : '— CONFIDENTIAL —',
        bold: true,
        size: 28,
        color: watermark === 'draft' ? 'FF0000' : '8B0000',
      })],
      alignment: AlignmentType.CENTER,
    }));
  }

  const doc = new Document({
    sections: [{ properties: {}, children: paragraphs }],
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22 } },
      },
    },
  });

  const blob = await Packer.toBlob(doc);
  return blob;
}

function convertConditionalsToDocxtemplater(text: string): string {
  let result = text;
  const ifRegex = /<<if\s+([^>]+)>>/gi;
  let match;
  const replacements: { start: number; end: number; replacement: string }[] = [];

  while ((match = ifRegex.exec(text)) !== null) {
    const key = match[1].trim();
    const startIdx = match.index;
    const endIdx = match.index + match[0].length;

    const endifRegex = /<<endif>>/gi;
    endifRegex.lastIndex = endIdx;
    const endifMatch = endifRegex.exec(text);

    if (!endifMatch) continue;

    const blockContent = text.slice(endIdx, endifMatch.index);
    const elseMatch = /<<else>>/i.exec(blockContent);

    if (elseMatch) {
      const ifPart = blockContent.slice(0, elseMatch.index);
      const elsePart = blockContent.slice(elseMatch.index + elseMatch[0].length);
      replacements.push({
        start: startIdx,
        end: endifMatch.index + endifMatch[0].length,
        replacement: `{#${key}}${ifPart}{/${key}}{^${key}}${elsePart}{/${key}}`,
      });
    } else {
      replacements.push({
        start: startIdx,
        end: endifMatch.index + endifMatch[0].length,
        replacement: `{#${key}}${blockContent}{/${key}}`,
      });
    }
  }

  for (let i = replacements.length - 1; i >= 0; i--) {
    const { start, end, replacement } = replacements[i];
    result = result.slice(0, start) + replacement + result.slice(end);
  }

  return result;
}

export async function generateDocxFromTemplate(
  fileUrl: string,
  placeholderData: Record<string, string>,
  watermark?: 'draft' | 'confidential'
): Promise<Blob> {
  const normalizedData = normalizePlaceholderData(placeholderData);
  const [{ default: PizZip }, { default: Docxtemplater }] = await Promise.all([
    import('pizzip'),
    import('docxtemplater'),
  ]);

  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error('Could not load DOCX template file');

  const zip = new PizZip(await response.arrayBuffer());

  const wordDoc = zip.file('word/document.xml');
  if (wordDoc) {
    const xmlContent = wordDoc.asText();
    const processed = convertConditionalsToDocxtemplater(xmlContent);
    zip.file('word/document.xml', processed);
  }

  const doc = new Docxtemplater(zip, {
    delimiters: { start: '<<', end: '>>' },
    paragraphLoop: true,
    linebreaks: true,
    parser: (tag: string) => ({
      get: (scope: Record<string, string>) => resolvePlaceholderValue(tag, scope),
    }),
  });

  renderDocxSafely(doc, normalizedData);

  if (watermark) {
    const wordDoc = doc.getZip().file('word/document.xml');
    if (wordDoc) {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(wordDoc.asText(), 'text/xml');
      const body = xmlDoc.getElementsByTagName('w:body')[0];
      if (body) {
        const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
        const p = xmlDoc.createElementNS(ns, 'w:p');
        const pPr = xmlDoc.createElementNS(ns, 'w:pPr');
        const jc = xmlDoc.createElementNS(ns, 'w:jc');
        jc.setAttribute('w:val', 'center');
        pPr.appendChild(jc);
        p.appendChild(pPr);
        const r = xmlDoc.createElementNS(ns, 'w:r');
        const rPr = xmlDoc.createElementNS(ns, 'w:rPr');
        const b = xmlDoc.createElementNS(ns, 'w:b');
        rPr.appendChild(b);
        const sz = xmlDoc.createElementNS(ns, 'w:sz');
        sz.setAttribute('w:val', '56');
        rPr.appendChild(sz);
        const color = xmlDoc.createElementNS(ns, 'w:color');
        color.setAttribute('w:val', watermark === 'draft' ? 'FF0000' : '8B0000');
        rPr.appendChild(color);
        r.appendChild(rPr);
        const t = xmlDoc.createElementNS(ns, 'w:t');
        t.textContent = watermark === 'draft' ? '— DRAFT —' : '— CONFIDENTIAL —';
        r.appendChild(t);
        p.appendChild(r);
        body.appendChild(p);
        doc.getZip().file('word/document.xml', new XMLSerializer().serializeToString(xmlDoc));
      }
    }
  }

  return doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

export async function generateDocxFromBuffer(
  arrayBuffer: ArrayBuffer,
  placeholderData: Record<string, string>,
  delimiters: { start: string; end: string } = { start: '<<', end: '>>' }
): Promise<Blob> {
  const normalizedData = normalizePlaceholderData(placeholderData);
  const [{ default: PizZip }, { default: Docxtemplater }] = await Promise.all([
    import('pizzip'),
    import('docxtemplater'),
  ]);

  const zip = new PizZip(arrayBuffer);

  const wordDoc = zip.file('word/document.xml');
  if (wordDoc) {
    const xmlContent = wordDoc.asText();
    const processed = convertConditionalsToDocxtemplater(xmlContent);
    zip.file('word/document.xml', processed);
  }

  const doc = new Docxtemplater(zip, {
    delimiters,
    paragraphLoop: true,
    linebreaks: true,
    parser: (tag: string) => ({
      get: (scope: Record<string, string>) => resolvePlaceholderValue(tag, scope),
    }),
  });

  renderDocxSafely(doc, normalizedData);
  return doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
