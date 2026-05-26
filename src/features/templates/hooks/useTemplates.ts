import { useEffect, useCallback, useState } from 'react';
import { onSnapshot, query, where, orderBy, collection } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../../shared/firebase/collections';
import { useAppStore } from '../../../store';
import {
  createTemplate,
  saveTemplate,
  lockTemplate,
  deleteTemplate,
  getTemplateVersions,
  restoreVersion,
} from '../services/templateService';
import type { Template, TemplateVersion } from '../../../shared/types';

function handleFirestoreListenerError(error: { code?: string; message: string }) {
  console.error('Firestore listener error:', error);
  if (error.code === 'failed-precondition') {
    console.warn('Missing Firestore index. Create it from Firebase console.');
  }
}

function mapTemplate(id: string, data: Record<string, unknown>): Template {
  return {
    id,
    organisationId: data.organisationId as string,
    name: data.name as string,
    description: (data.description as string) ?? '',
    type: data.type as Template['type'],
    templateKind: (data.templateKind as Template['templateKind']) ?? null,
    content: (data.content as string) ?? '',
    fileUrl: data.fileUrl as string | undefined,
    placeholders: (data.placeholders as string[]) ?? [],
    pdfStoragePath: data.pdfStoragePath as string | undefined,
    fields: (data.fields as Template['fields']) ?? [],
    styles: data.styles as Template['styles'],
    nodes: data.nodes as string | undefined,
    schemaVersion: data.schemaVersion as number | undefined,
    locked: (data.locked as boolean) ?? false,
    lifecycleState: data.lifecycleState as Template['lifecycleState'],
    canonicalityState: data.canonicalityState as Template['canonicalityState'],
    lastSyncAt: data.lastSyncAt as string | undefined,
    createdFrom: data.createdFrom as string | undefined,
    currentVersion: (data.currentVersion as number) ?? 1,
    createdBy: data.createdBy as string,
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    updatedAt: (data.updatedAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
  };
}

function mergeServerTemplates(current: Template[], serverTemplates: Template[], pendingIds: Set<string>): Template[] {
  const serverIds = new Set(serverTemplates.map((template) => template.id));
  const pendingLocal = current.filter((template) => pendingIds.has(template.id) && !serverIds.has(template.id));
  return [...serverTemplates, ...pendingLocal];
}

export function useTemplates() {
  const { currentUser, templates, setTemplates, selectedTemplate, setSelectedTemplate } = useAppStore();
  const organisationId = currentUser?.organisationId ?? '';
  const [loading, setLoading] = useState(true);

  // Real-time listener
  useEffect(() => {
    if (!organisationId) {
      setTemplates([]);
      setSelectedTemplate(null);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.TEMPLATES),
      where('organisationId', '==', organisationId),
      orderBy('updatedAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const pendingIds = new Set(
          snap.docs.filter((d) => d.metadata.hasPendingWrites).map((d) => d.id)
        );
        const serverTemplates = snap.docs
          .filter((d) => !d.metadata.hasPendingWrites)
          .map((d) => mapTemplate(d.id, d.data()));
        const currentTemplates = useAppStore.getState().templates;
        setTemplates(mergeServerTemplates(currentTemplates, serverTemplates, pendingIds));
        setLoading(false);
      },
      (err) => {
        handleFirestoreListenerError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [organisationId, setTemplates, setSelectedTemplate]);

  // Sync selectedTemplate when templates list updates
  useEffect(() => {
    if (!selectedTemplate) return;
    const fresh = templates.find((t) => t.id === selectedTemplate.id);
    if (fresh && fresh.currentVersion !== selectedTemplate.currentVersion) {
      setSelectedTemplate(fresh);
    }
  }, [templates, selectedTemplate, setSelectedTemplate]);

  const create = useCallback(async (
    data: Omit<Template, 'id' | 'createdAt' | 'updatedAt' | 'currentVersion' | 'locked'>
  ) => {
    return createTemplate(data);
  }, []);

  const save = useCallback(async (
    id: string,
    data: Pick<Template, 'content' | 'fields' | 'name' | 'description' | 'templateKind' | 'styles'> & { lifecycleState?: Template['lifecycleState']; sectionIds?: string[]; dealId?: string; transactionType?: Template['transactionType'] },
    comment?: string
  ) => {
    if (!currentUser) throw new Error('Not authenticated');
    await saveTemplate(id, data, currentUser.uid, comment);
    // onSnapshot updates the store
  }, [currentUser]);

  const toggleLock = useCallback(async (id: string, locked: boolean) => {
    await lockTemplate(id, locked);
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteTemplate(id);
    if (selectedTemplate?.id === id) setSelectedTemplate(null);
  }, [selectedTemplate, setSelectedTemplate]);

  const getVersions = useCallback(async (templateId: string): Promise<TemplateVersion[]> => {
    return getTemplateVersions(templateId);
  }, []);

  const restore = useCallback(async (templateId: string, version: TemplateVersion) => {
    if (!currentUser) throw new Error('Not authenticated');
    await restoreVersion(templateId, version, currentUser.uid);
  }, [currentUser]);

  const duplicate = useCallback(async (template: Template) => {
    if (!currentUser) throw new Error('Not authenticated');
    return createTemplate({
      organisationId: template.organisationId,
      createdBy: currentUser.uid,
      name: `${template.name} (copy)`,
      description: template.description,
      type: template.type,
      templateKind: template.templateKind ?? null,
      content: template.content,
      fields: template.fields,
      fileUrl: template.fileUrl,
      placeholders: template.placeholders,
      pdfStoragePath: template.pdfStoragePath,
      createdFrom: template.id,
    });
  }, [currentUser]);

  return {
    templates, selectedTemplate, setSelectedTemplate, loading,
    create, save, toggleLock, remove, getVersions, restore, duplicate,
  };
}
