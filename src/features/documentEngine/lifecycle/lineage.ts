import type { DocumentLineage, DocumentLineageEntry } from './types';
import type { DocumentLifecycleState } from './types';

function buildEntry(
  documentId: string,
  state: DocumentLifecycleState,
  snapshotVersion?: number,
  createdAt?: Date
): DocumentLineageEntry {
  return {
    documentId,
    lifecycleState: state,
    snapshotVersion,
    createdAt: createdAt ?? new Date(),
  };
}

export function resolveLineage(
  currentId: string,
  currentState: DocumentLifecycleState,
  currentSnapshotVersion: number | undefined,
  createdAt: Date,
  supersededById?: string,
  generatedFromId?: string,
  allDocuments?: { id: string; lifecycleState: DocumentLifecycleState; snapshotVersion?: number; createdAt: Date }[]
): DocumentLineage {
  const current = buildEntry(currentId, currentState, currentSnapshotVersion, createdAt);
  const ancestors: DocumentLineageEntry[] = [];
  let supersededBy: DocumentLineageEntry | undefined;
  let generatedFrom: DocumentLineageEntry | undefined;

  if (supersededById && allDocuments) {
    const found = allDocuments.find((d) => d.id === supersededById);
    if (found) {
      supersededBy = buildEntry(found.id, found.lifecycleState, found.snapshotVersion, found.createdAt);
    }
  }

  if (generatedFromId && allDocuments) {
    const found = allDocuments.find((d) => d.id === generatedFromId);
    if (found) {
      generatedFrom = buildEntry(found.id, found.lifecycleState, found.snapshotVersion, found.createdAt);
    }
  }

  if (allDocuments) {
    for (const doc of allDocuments) {
      if (doc.id === currentId) continue;
      if (doc.lifecycleState === 'superseded' || doc.lifecycleState === 'archived') {
        ancestors.push(buildEntry(doc.id, doc.lifecycleState, doc.snapshotVersion, doc.createdAt));
      }
    }
  }

  return {
    current,
    ancestors,
    supersededBy,
    generatedFrom,
  };
}

export function getSupersessionChain(
  lineage: DocumentLineage
): DocumentLineageEntry[] {
  const chain: DocumentLineageEntry[] = [lineage.current];
  let current = lineage.supersededBy;
  const visited = new Set<string>();
  visited.add(lineage.current.documentId);

  while (current && !visited.has(current.documentId)) {
    visited.add(current.documentId);
    chain.push(current);
    current = undefined;
  }

  return chain;
}
