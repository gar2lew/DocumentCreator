import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  db,
} from '../../../shared/firebase/collections';
import { COLLECTIONS } from '../../../shared/firebase/collections';
import type { Template, TemplateVersion, PdfFieldDefinition } from '../../../shared/types';

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
    fields: (data.fields as PdfFieldDefinition[]) ?? [],
    locked: (data.locked as boolean) ?? false,
    currentVersion: (data.currentVersion as number) ?? 1,
    createdBy: data.createdBy as string,
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    updatedAt: (data.updatedAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
  };
}

function mapVersion(id: string, data: Record<string, unknown>): TemplateVersion {
  return {
    id,
    organisationId: data.organisationId as string,
    templateId: data.templateId as string,
    version: data.version as number,
    content: (data.content as string) ?? '',
    fileUrl: data.fileUrl as string | undefined,
    placeholders: (data.placeholders as string[]) ?? [],
    fields: (data.fields as PdfFieldDefinition[]) ?? [],
    savedBy: data.savedBy as string,
    savedAt: (data.savedAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    comment: data.comment as string | undefined,
  };
}

export async function getTemplates(organisationId: string): Promise<Template[]> {
  const q = query(
    collection(db, COLLECTIONS.TEMPLATES),
    where('organisationId', '==', organisationId),
    orderBy('updatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapTemplate(d.id, d.data()));
}

export async function getTemplate(id: string): Promise<Template | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.TEMPLATES, id));
  if (!snap.exists()) return null;
  return mapTemplate(snap.id, snap.data());
}

export async function createTemplate(
  data: Omit<Template, 'id' | 'createdAt' | 'updatedAt' | 'currentVersion' | 'locked'>
): Promise<Template> {
  const ref = await addDoc(collection(db, COLLECTIONS.TEMPLATES), {
    ...data,
    locked: false,
    currentVersion: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Save initial version
  await addDoc(collection(db, COLLECTIONS.TEMPLATE_VERSIONS), {
    organisationId: data.organisationId,
    templateId: ref.id,
    version: 1,
    content: data.content,
    fileUrl: data.fileUrl,
    placeholders: data.placeholders ?? [],
    fields: data.fields,
    savedBy: data.createdBy,
    savedAt: serverTimestamp(),
    comment: 'Initial version',
  });

  return {
    ...data,
    id: ref.id,
    locked: false,
    currentVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function saveTemplate(
  id: string,
  data: Pick<Template, 'content' | 'fields' | 'name' | 'description' | 'templateKind'>,
  savedBy: string,
  comment?: string
): Promise<number> {
  const existing = await getTemplate(id);
  if (!existing) throw new Error('Template not found');
  if (existing.locked) throw new Error('Template is locked');

  const fileChanged = data.content !== existing.content || JSON.stringify(data.fields) !== JSON.stringify(existing.fields);
  const newVersion = fileChanged ? existing.currentVersion + 1 : existing.currentVersion;

  await updateDoc(doc(db, COLLECTIONS.TEMPLATES, id), {
    ...data,
    currentVersion: newVersion,
    updatedAt: serverTimestamp(),
  });

  if (fileChanged) {
    await addDoc(collection(db, COLLECTIONS.TEMPLATE_VERSIONS), {
      organisationId: existing.organisationId,
      templateId: id,
      version: newVersion,
      content: data.content,
      fileUrl: existing.fileUrl,
      placeholders: existing.placeholders ?? [],
      fields: data.fields,
      savedBy,
      savedAt: serverTimestamp(),
      comment: comment ?? `Version ${newVersion}`,
    });
  }

  return newVersion;
}

export async function lockTemplate(id: string, locked: boolean): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.TEMPLATES, id), { locked, updatedAt: serverTimestamp() });
}

export async function deleteTemplate(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.TEMPLATES, id));
}

export async function getTemplateVersions(templateId: string): Promise<TemplateVersion[]> {
  const template = await getTemplate(templateId);
  if (!template) throw new Error('Template not found');

  const q = query(
    collection(db, COLLECTIONS.TEMPLATE_VERSIONS),
    where('organisationId', '==', template.organisationId),
    where('templateId', '==', templateId),
    orderBy('version', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapVersion(d.id, d.data()));
}

export async function restoreVersion(
  templateId: string,
  version: TemplateVersion,
  restoredBy: string
): Promise<void> {
  const existing = await getTemplate(templateId);
  if (!existing) throw new Error('Template not found');

  const newVersion = existing.currentVersion + 1;

  await updateDoc(doc(db, COLLECTIONS.TEMPLATES, templateId), {
    content: version.content,
    fileUrl: version.fileUrl,
    placeholders: version.placeholders ?? [],
    fields: version.fields,
    currentVersion: newVersion,
    updatedAt: serverTimestamp(),
  });

  await addDoc(collection(db, COLLECTIONS.TEMPLATE_VERSIONS), {
    organisationId: existing.organisationId,
    templateId,
    version: newVersion,
    content: version.content,
    fileUrl: version.fileUrl,
    placeholders: version.placeholders ?? [],
    fields: version.fields,
    savedBy: restoredBy,
    savedAt: serverTimestamp(),
    comment: `Restored from v${version.version}`,
  });
}

export async function updateTemplatePdfPath(id: string, pdfStoragePath: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.TEMPLATES, id), {
    pdfStoragePath,
    updatedAt: serverTimestamp(),
  });
}

export async function updateTemplateFileUrl(
  id: string,
  fileUrl: string,
  placeholders: string[] = [],
  incrementVersion = true
): Promise<void> {
  const existing = await getTemplate(id);
  if (!existing) throw new Error('Template not found');
  if (existing.locked) throw new Error('Template is locked');

  const fileChanged = existing.fileUrl !== fileUrl;
  const nextVersion = incrementVersion && fileChanged ? existing.currentVersion + 1 : existing.currentVersion;

  await updateDoc(doc(db, COLLECTIONS.TEMPLATES, id), {
    fileUrl,
    placeholders,
    currentVersion: nextVersion,
    updatedAt: serverTimestamp(),
  });

  if (incrementVersion && fileChanged) {
    await addDoc(collection(db, COLLECTIONS.TEMPLATE_VERSIONS), {
      organisationId: existing.organisationId,
      templateId: id,
      version: nextVersion,
      content: existing.content,
      fileUrl,
      placeholders,
      fields: existing.fields,
      savedBy: existing.createdBy,
      savedAt: serverTimestamp(),
      comment: `Version ${nextVersion}`,
    });
  }
}
