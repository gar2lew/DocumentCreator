import { extractPlaceholders } from './placeholders';

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function textFromDocxXml(xml: string): string {
  return decodeXmlText(xml.replace(/<[^>]+>/g, ''));
}

export async function extractDocxPlaceholders(file: Blob): Promise<string[]> {
  const { default: PizZip } = await import('pizzip');
  const zip = new PizZip(await file.arrayBuffer());
  const combinedText = Object.keys(zip.files)
    .filter((path) => path.startsWith('word/') && path.endsWith('.xml'))
    .map((path) => textFromDocxXml(zip.file(path)?.asText() ?? ''))
    .join('\n');

  return extractPlaceholders(combinedText);
}
