import { applyPlaceholders, normalizePlaceholderData, resolvePlaceholderValue } from '../../../shared/utils/placeholders';
import type { IParagraphOptions } from 'docx';

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

export async function exportToDocx(
  content: string,
  placeholderData: Record<string, string>
): Promise<Blob> {
  // Lazy-load docx to avoid bundling on initial page load
  const {
    Document, Paragraph, TextRun, HeadingLevel, Packer,
  } = await import('docx');

  const resolved = applyPlaceholders(content, placeholderData);
  const lines = resolved.split('\n');

  function parseParagraph(line: string) {
    const heading = inferHeadingLevel(line);
    if (heading) {
      const levels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3] as const;
      return new Paragraph({ text: heading.text, heading: levels[heading.level - 1] });
    }
    if (line.trim() === '') return new Paragraph({ text: '' });

    const alignment = inferAlignment(line) as IParagraphOptions['alignment'];
    const text = line.replace(/^[>#]\s+/, '').trim();

    const runs: InstanceType<typeof TextRun>[] = [];
    const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|([^*]+))/g;
    let m;
    while ((m = pattern.exec(text)) !== null) {
      if (m[2]) runs.push(new TextRun({ bold: true, text: m[2] }));
      else if (m[3]) runs.push(new TextRun({ italics: true, text: m[3] }));
      else if (m[4]) runs.push(new TextRun({ text: m[4] }));
    }

    const paraOpts: IParagraphOptions = {
      alignment,
      children: runs.length ? runs : [new TextRun(text)],
    };
    return new Paragraph(paraOpts);
  }

  const paragraphs = lines.map(parseParagraph);

  const doc = new Document({
    sections: [{ properties: {}, children: paragraphs }],
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22 } },
      },
    },
  });

  return Packer.toBlob(doc);
}

export async function generateDocxFromTemplate(
  fileUrl: string,
  placeholderData: Record<string, string>
): Promise<Blob> {
  const normalizedData = normalizePlaceholderData(placeholderData);
  const [{ default: PizZip }, { default: Docxtemplater }] = await Promise.all([
    import('pizzip'),
    import('docxtemplater'),
  ]);

  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error('Could not load DOCX template file');

  const zip = new PizZip(await response.arrayBuffer());
  const doc = new Docxtemplater(zip, {
    delimiters: { start: '<<', end: '>>' },
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
