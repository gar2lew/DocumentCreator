import { useMemo } from 'react';
import type { Template } from '../../../shared/types';
import { needsMigration, getMigrationsInRange } from '../../documentEngine/migrations/pipeline';
import { CURRENT_SCHEMA_VERSION, MINIMUM_SUPPORTED_VERSION, isSchemaCompatible } from '../../documentEngine/schema/templateDocument';
import { ArrowUp, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface MigrationIndicatorProps {
  template: Template;
}

export function MigrationIndicator({ template }: MigrationIndicatorProps) {
  const info = useMemo(() => {
    const schemaVer = template.schemaVersion ?? 1;
    const compatible = isSchemaCompatible(schemaVer);
    const upgradeNeeded = needsMigration(schemaVer);
    const availableMigrations = upgradeNeeded
      ? getMigrationsInRange(schemaVer, CURRENT_SCHEMA_VERSION)
      : [];

    return {
      currentVersion: schemaVer,
      latestVersion: CURRENT_SCHEMA_VERSION,
      compatible,
      upgradeNeeded,
      availableMigrations,
      atLatest: schemaVer >= CURRENT_SCHEMA_VERSION,
      supported: schemaVer >= MINIMUM_SUPPORTED_VERSION,
    };
  }, [template.schemaVersion]);

  return (
    <div className="bg-bg-tertiary rounded-md p-3 space-y-2">
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
        <ArrowUp className="w-3 h-3" /> Migration Status
      </p>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-tertiary">Current Version</span>
          <span className="text-text font-mono">v{info.currentVersion}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-tertiary">Latest Version</span>
          <span className="text-text font-mono">v{info.latestVersion}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-tertiary">Compatibility</span>
          <span className={`flex items-center gap-1 ${
            info.compatible ? 'text-green-500' : 'text-red-400'
          }`}>
            {info.compatible ? (
              <><CheckCircle className="w-3 h-3" /> Compatible</>
            ) : (
              <><XCircle className="w-3 h-3" /> Incompatible</>
            )}
          </span>
        </div>
        {info.atLatest && (
          <div className="flex items-center gap-1.5 text-xs text-green-500 pt-1">
            <CheckCircle className="w-3 h-3" />
            Up to date
          </div>
        )}
        {info.upgradeNeeded && (
          <div className="space-y-1 pt-1">
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              Migration available
            </div>
            {info.availableMigrations.map((m) => (
              <div key={m.targetVersion} className="text-[11px] text-text-tertiary pl-4 font-mono">
                v{m.targetVersion}: {m.name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
