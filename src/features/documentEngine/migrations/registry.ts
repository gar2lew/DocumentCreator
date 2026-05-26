/**
 * MIGRATION REGISTRY
 *
 * Central registry for schema version migrations.
 *
 * Each migration transforms content from one schema version
 * to the next. Migrations are:
 *  - deterministic (same input always produces same output)
 *  - idempotent (running the same migration twice is safe)
 *  - backward-compatible (never break legacy reading)
 *
 * The registry maintains an ordered list of all registered
 * migrations, keyed by version number.
 */

import type { TemplateDocument } from '../schema/templateDocument';

/**
 * A migration function that upgrades content from one schema
 * version to the next.
 *
 * Migrations receive the document in the current schema and
 * must return a document in the target schema version.
 *
 * Errors during migration are caught by the pipeline — the
 * migration should throw if it cannot safely transform the content.
 */
export interface Migration {
  /** Target version after this migration runs */
  targetVersion: number;
  /** Human-readable name for logging and diagnostics */
  name: string;
  /** Migration function — transforms the document */
  migrate: (doc: TemplateDocument) => TemplateDocument;
}

/**
 * Migration registry — maps version numbers to Migration objects.
 * Entries are ordered by version ascending.
 */
const registry = new Map<number, Migration>();

/**
 * Registers a migration in the global registry.
 * Throws if a migration for the same version is already registered.
 */
export function registerMigration(migration: Migration): void {
  if (registry.has(migration.targetVersion)) {
    throw new Error(
      `Migration for version ${migration.targetVersion} is already registered: "${registry.get(migration.targetVersion)!.name}"`
    );
  }
  registry.set(migration.targetVersion, migration);
}

/**
 * Returns a sorted array of all registered migrations.
 */
export function getMigrations(): Migration[] {
  return Array.from(registry.values())
    .sort((a, b) => a.targetVersion - b.targetVersion);
}

/**
 * Returns the migration for a specific target version, or undefined
 * if no migration is registered for that version.
 */
export function getMigration(targetVersion: number): Migration | undefined {
  return registry.get(targetVersion);
}

/**
 * Checks if a migration exists for the given version.
 */
export function hasMigration(targetVersion: number): boolean {
  return registry.has(targetVersion);
}

/**
 * Returns all migrations needed to upgrade from `fromVersion` to `toVersion`.
 * Returns an empty array if no upgrade is needed.
 */
export function getMigrationsInRange(
  fromVersion: number,
  toVersion: number
): Migration[] {
  if (fromVersion >= toVersion) return [];

  return getMigrations().filter(
    (m) => m.targetVersion > fromVersion && m.targetVersion <= toVersion
  );
}

/**
 * Clears all registered migrations. Used for testing.
 */
export function clearRegistry(): void {
  registry.clear();
}
