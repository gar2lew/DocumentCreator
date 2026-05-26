/**
 * MIGRATION PIPELINE
 *
 * Orchestrates schema version upgrades for template documents.
 *
 * The pipeline:
 *  1. Determines current document version
 *  2. Finds all applicable migrations between current and target
 *  3. Runs each migration in order
 *  4. Updates the document's version and migration metadata
 *
 * Migrations are deterministic and idempotent — running the same
 * pipeline twice on the same document produces the same result.
 *
 * The pipeline NEVER modifies persistent storage. It transforms
 * in-memory documents only.
 */

import type { TemplateDocument } from '../schema/templateDocument';
import { getMigrationsInRange } from './registry';

/**
 * Result of a migration pipeline run.
 */
export interface MigrationResult {
  /** The migrated document */
  document: TemplateDocument;
  /** Versions that were applied (empty if no migration needed) */
  appliedVersions: number[];
  /** Human-readable logs from the migration run */
  log: string[];
}

/**
 * Upgrades a TemplateDocument from its current version to the
 * specified target version by running all registered migrations
 * in sequence.
 *
 * If the document is already at or above the target version,
 * it is returned unchanged.
 *
 * If a migration fails, the function throws with details about
 * which migration failed and the original error.
 *
 * @param doc — The document to upgrade
 * @param targetVersion — The target schema version
 * @returns MigrationResult with the upgraded document and metadata
 * @throws If any migration in the chain fails
 */
export function upgradeDocument(
  doc: TemplateDocument,
  targetVersion: number
): MigrationResult {
  const log: string[] = [];
  const appliedVersions: number[] = [];

  const currentVersion = doc.version ?? 0;
  if (currentVersion >= targetVersion) {
    log.push(`Document already at version ${currentVersion}, no upgrade needed.`);
    return { document: doc, appliedVersions, log };
  }

  const migrations = getMigrationsInRange(currentVersion, targetVersion);

  if (migrations.length === 0) {
    log.push(`No migrations found between version ${currentVersion} and ${targetVersion}.`);
    return { document: doc, appliedVersions, log };
  }

  let currentDoc = { ...doc };

  for (const migration of migrations) {
    log.push(`Applying migration v${migration.targetVersion}: ${migration.name}`);

    try {
      currentDoc = migration.migrate(currentDoc);
      currentDoc = {
        ...currentDoc,
        version: migration.targetVersion,
        metadata: {
          ...currentDoc.metadata,
          migrationState: {
            lastCompletedVersion: migration.targetVersion,
            lastMigratedAt: new Date().toISOString(),
          },
        },
      };
      appliedVersions.push(migration.targetVersion);
      log.push(`Migration v${migration.targetVersion} completed successfully.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.push(`Migration v${migration.targetVersion} FAILED: ${message}`);
      throw new MigrationError(
        `Migration v${migration.targetVersion} ("${migration.name}") failed: ${message}`,
        migration.targetVersion,
        log
      );
    }
  }

  return { document: currentDoc, appliedVersions, log };
}

/**
 * Error thrown when a migration fails.
 * Carries diagnostic information about which migration failed.
 */
export class MigrationError extends Error {
  public readonly failedVersion: number;
  public readonly log: string[];

  constructor(message: string, failedVersion: number, log: string[]) {
    super(message);
    this.name = 'MigrationError';
    this.failedVersion = failedVersion;
    this.log = log;
  }
}

/**
 * Checks whether a document needs migration to reach the target version.
 */
export function needsMigration(
  doc: TemplateDocument,
  targetVersion: number
): boolean {
  return (doc.version ?? 0) < targetVersion;
}

/**
 * Returns the schema version of a document, defaulting to 0 if unset.
 */
export function getDocumentVersion(doc: TemplateDocument): number {
  return doc.version ?? 0;
}
