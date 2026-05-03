import { useState } from 'react';
import type { Template } from '../../../shared/types';
import { useAppStore } from '../../../store';
import { buildProjectPlaceholders } from '../../../shared/utils/placeholders';
import { exportToDocx, generateDocxFromTemplate } from '../services/docxExporter';
import { exportTextToPdf, exportPdfWithFields } from '../services/pdfExporter';
import { saveGeneratedDocument } from '../services/documentService';
import { uploadFirebaseBlob } from '../../../shared/firebase/storage';

export function useExport() {
  const { currentUser, selectedProject } = useAppStore();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportDocument(
    template: Template,
    format: 'pdf' | 'docx',
    manualData: Record<string, string>
  ): Promise<string | null> {
    if (!currentUser) { setError('Not authenticated'); return null; }

    setExporting(true);
    setError(null);
    try {
      const projectData = selectedProject ? buildProjectPlaceholders(selectedProject) : {};
      const allData = { ...projectData, ...manualData };

      let blob: Blob;
      let filename: string;

      if (format === 'docx') {
        blob = template.type === 'docx' && template.fileUrl
          ? await generateDocxFromTemplate(template.fileUrl, allData)
          : await exportToDocx(template.content, allData);
        filename = `${template.name.replace(/\s+/g, '_')}_${Date.now()}.docx`;
      } else if (template.type === 'pdf' && template.pdfStoragePath) {
        const bytes = await exportPdfWithFields(template, allData);
        blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
        filename = `${template.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      } else {
        const bytes = await exportTextToPdf(template.content, allData);
        blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
        filename = `${template.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      }

      const path = `generated/${currentUser.organisationId}/${filename}`;
      const { downloadUrl: url } = await uploadFirebaseBlob(path, blob, blob.type);

      await saveGeneratedDocument({
        organisationId: currentUser.organisationId,
        templateId: template.id,
        templateName: template.name,
        projectId: selectedProject?.id ?? '',
        projectName: selectedProject?.name ?? '',
        format,
        storagePath: path,
        downloadUrl: url,
        generatedBy: currentUser.uid,
        placeholderData: allData,
        templateContent: template.content,
      });

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();

      return url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
      return null;
    } finally {
      setExporting(false);
    }
  }

  return { exportDocument, exporting, error };
}
