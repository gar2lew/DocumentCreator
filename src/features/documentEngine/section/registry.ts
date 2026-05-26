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
import type { SectionDefinition, SectionType, SectionLifecycleState } from './types';

function mapSection(id: string, data: Record<string, unknown>): SectionDefinition {
  return {
    id,
    organisationId: data.organisationId as string,
    type: data.type as SectionType,
    schemaVersion: (data.schemaVersion as number) ?? 1,
    nodes: (data.nodes as string) ?? '',
    metadata: {
      label: (data.metadata as Record<string, unknown>)?.label as string ?? '',
      description: (data.metadata as Record<string, unknown>)?.description as string ?? '',
      category: (data.metadata as Record<string, unknown>)?.category as string ?? '',
      templateKinds: (data.metadata as Record<string, unknown>)?.templateKinds as ('deed' | 'loan_agreement')[] | undefined,
      lifecycleState: (data.metadata as Record<string, unknown>)?.lifecycleState as SectionLifecycleState ?? 'active',
      deprecationNotice: (data.metadata as Record<string, unknown>)?.deprecationNotice as string | undefined,
      tags: (data.metadata as Record<string, unknown>)?.tags as string[] ?? [],
      compatibleSchemaVersions: (data.metadata as Record<string, unknown>)?.compatibleSchemaVersions as number[] ?? [1],
    },
    createdBy: data.createdBy as string,
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    updatedAt: (data.updatedAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
  };
}

export async function getSections(organisationId: string): Promise<SectionDefinition[]> {
  const q = query(
    collection(db, COLLECTIONS.SECTIONS),
    where('organisationId', '==', organisationId),
    orderBy('updatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapSection(d.id, d.data()));
}

export async function getSection(id: string): Promise<SectionDefinition | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.SECTIONS, id));
  if (!snap.exists()) return null;
  return mapSection(snap.id, snap.data());
}

export async function createSection(
  data: Omit<SectionDefinition, 'id' | 'createdAt' | 'updatedAt'>
): Promise<SectionDefinition> {
  const ref = await addDoc(collection(db, COLLECTIONS.SECTIONS), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return {
    ...data,
    id: ref.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function updateSection(
  id: string,
  data: Partial<Pick<SectionDefinition, 'nodes' | 'metadata'>>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.SECTIONS, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteSection(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.SECTIONS, id));
}

export function getSectionsByType(
  sections: SectionDefinition[],
  type: SectionType
): SectionDefinition[] {
  return sections.filter((s) => s.type === type);
}

export function getActiveSections(sections: SectionDefinition[]): SectionDefinition[] {
  return sections.filter((s) => s.metadata.lifecycleState === 'active');
}

export function getSectionLineage(section: SectionDefinition): {
  type: string;
  label: string;
  version: number;
  state: SectionLifecycleState;
} {
  return {
    type: section.type,
    label: section.metadata.label,
    version: section.schemaVersion,
    state: section.metadata.lifecycleState,
  };
}
