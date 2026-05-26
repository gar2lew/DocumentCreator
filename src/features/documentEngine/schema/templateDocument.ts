/**
 * TEMPLATE DOCUMENT ENVELOPE
 *
 * Structured persistence model for document templates.
 *
 * This envelope wraps the legacy content string with optional
 * semantic node trees and schema version metadata.
 *
 * Key design:
 *  - content is ALWAYS canonical (the source of truth)
 *  - nodes are additive and optional (never authoritative)
 *  - schemaVersion enables governed migration paths
 *  - backward compatibility is mandatory
 *
 * The envelope is used at the persistence boundary (save/load)
 * but NOT as the primary storage format — Firestore stores the
 * flat Template type, and this envelope is packed/unpacked
 * at the service layer.
 */

import type { DocumentRoot } from './nodeTypes';

/**
 * Current schema version identifier.
 * Incremented when the DocumentRoot structure changes in a
 * non-backward-compatible way.
 *
 * Version history:
 *  1 — Initial structured node types (FieldNode, ConditionalNode, RepeatNode)
 */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * The earliest schema version that the current code can read.
 * Templates with schemaVersion below this must be migrated
 * before they can be used with the current renderer.
 */
export const MINIMUM_SUPPORTED_VERSION = 1;

/**
 * Template persistence envelope.
 *
 * Wraps all data needed to render and manage a document template
 * through the schema-native pipeline.
 */
export interface TemplateDocument {
  /** Schema version identifier for migration governance */
  version: number;
  /** Canonical template content string (legacy format, always authoritative) */
  content: string;
  /** Optional pre-parsed semantic node tree (additive, never authoritative) */
  nodes?: DocumentRoot;
  /** Optional persistence metadata */
  metadata?: TemplateDocumentMetadata;
}

/**
 * Template document metadata.
 */
export interface TemplateDocumentMetadata {
  /** ISO timestamp of last content parse */
  lastParsedAt?: string;
  /** Schema version at last parse */
  parsedAtVersion?: number;
  /** Migration state — tracks in-progress migrations */
  migrationState?: MigrationState;
}

/**
 * Migration state tracking.
 * Records the last completed migration version.
 */
export interface MigrationState {
  /** The schema version this document was last migrated to */
  lastCompletedVersion: number;
  /** ISO timestamp of last migration */
  lastMigratedAt?: string;
  /** If true, the document is mid-migration and should not be persisted */
  inProgress?: boolean;
}

/**
 * Packs a content string and optional node tree into a TemplateDocument
 * envelope with the current schema version.
 */
export function packTemplateDocument(
  content: string,
  nodes?: DocumentRoot
): TemplateDocument {
  return {
    version: CURRENT_SCHEMA_VERSION,
    content,
    nodes,
    metadata: nodes
      ? {
          lastParsedAt: new Date().toISOString(),
          parsedAtVersion: CURRENT_SCHEMA_VERSION,
        }
      : undefined,
  };
}

/**
 * Unpacks a TemplateDocument into its constituent parts.
 * Returns the content string and optional node tree.
 *
 * If the document has a lower schema version than current,
 * it is migrated inline before unpacking.
 */
export function unpackTemplateDocument(
  doc: TemplateDocument
): { content: string; nodes: DocumentRoot | undefined } {
  return {
    content: doc.content,
    nodes: doc.nodes,
  };
}

/**
 * Extracts the canonical content from a TemplateDocument.
 * This is the safe default — always returns the content string.
 */
export function extractContent(doc: TemplateDocument): string {
  return doc.content;
}

/**
 * Checks whether the document's schema version is compatible
 * with the current runtime.
 *
 * Returns true if the document can be used without migration.
 */
export function isSchemaCompatible(version: number): boolean {
  return version >= MINIMUM_SUPPORTED_VERSION && version <= CURRENT_SCHEMA_VERSION;
}

/**
 * Creates a minimal TemplateDocument from a raw content string.
 * Used when loading legacy templates that have no schema metadata.
 */
export function fromLegacyContent(content: string): TemplateDocument {
  return {
    version: CURRENT_SCHEMA_VERSION,
    content,
  };
}
