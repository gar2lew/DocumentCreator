import type { Deal } from '../../deals/types';
import { mapDealToPlaceholders } from '../../deals/utils/mapDealToPlaceholders';
import { exportToDocx, generateDocxFromTemplate } from '../../export/services/docxExporter';
import { exportPdfWithFields } from '../../export/services/pdfExporter';
import type { Project, Template } from '../../../shared/types';

export type DocumentPackKind = 'deed' | 'loan_agreement';

export interface DocumentPackFile {
  kind: DocumentPackKind;
  templateId: string;
  templateName: string;
  filename: string;
  blob: Blob;
}

function buildPackFilename(template: Template, kind: DocumentPackKind): string {
  const safeName = template.name.trim().replace(/[^\w.-]+/g, '_');
  const extension = template.type === 'pdf' ? 'pdf' : 'docx';
  return `${kind}_${safeName || template.id}.${extension}`;
}

async function renderTemplate(template: Template, dataSnapshot: Record<string, string>): Promise<Blob> {
  if (template.type === 'pdf') {
    const bytes = await exportPdfWithFields(template, dataSnapshot);
    return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  }

  if (template.type === 'docx' && template.fileUrl) {
    return generateDocxFromTemplate(template.fileUrl, dataSnapshot);
  }

  return exportToDocx(template.content, dataSnapshot);
}

function selectPackTemplates(templates: Template[]): Array<{ kind: DocumentPackKind; template: Template }> {
  return templates
    .map((template) => {
      const kind = template.templateKind;
      return kind ? { kind, template } : null;
    })
    .filter((item): item is { kind: DocumentPackKind; template: Template } => Boolean(item));
}

export async function generateDocumentPack(
  deal: Deal,
  templates: Template[],
  project?: Project | null
): Promise<DocumentPackFile[]> {
  const dataSnapshot = mapDealToPlaceholders(deal, project);
  const packTemplates = selectPackTemplates(templates);

  return Promise.all(
    packTemplates.map(async ({ kind, template }) => ({
      kind,
      templateId: template.id,
      templateName: template.name,
      filename: buildPackFilename(template, kind),
      blob: await renderTemplate(template, dataSnapshot),
    }))
  );
}
