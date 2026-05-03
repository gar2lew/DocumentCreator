import JSZip from 'jszip';
import type { Deal } from '../../deals/types';
import { generateDocumentPack, type DocumentPackFile } from './documentPackService';
import type { Project, Template } from '../../../shared/types';

const ZIP_MIME_TYPE = 'application/zip';

function buildPackArchiveName(): string {
  return `document_pack_${Date.now()}.zip`;
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadDocumentPack(packFiles: DocumentPackFile[]): Promise<void> {
  const zipBlob = await createDocumentPackZipBlob(packFiles);
  triggerBrowserDownload(zipBlob, buildPackArchiveName());
}

export async function createDocumentPackZipBlob(packFiles: DocumentPackFile[]): Promise<Blob> {
  const zip = new JSZip();

  for (const file of packFiles) {
    zip.file(file.filename, file.blob);
  }

  return zip.generateAsync({ type: 'blob', mimeType: ZIP_MIME_TYPE });
}

export async function generateAndDownloadDocumentPack(
  deal: Deal,
  templates: Template[],
  project?: Project | null
): Promise<DocumentPackFile[]> {
  const packFiles = await generateDocumentPack(deal, templates, project);
  await downloadDocumentPack(packFiles);
  return packFiles;
}
