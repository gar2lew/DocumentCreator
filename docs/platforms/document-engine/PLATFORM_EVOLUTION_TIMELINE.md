# Platform Evolution Timeline — Document Transaction Platform

## Phase: Structured Template Node System

### Summary

This phase introduces first-class structured document node types to the Document
Transaction Platform. Prior to this phase, document templates were stored as
plain text strings with regex-parsed `<<placeholder>>` tokens. The rendering
pipeline was regex-driven and schema-agnostic.

With this phase, templates gain a deterministic intermediate representation:
the **DocumentNode** tree. This representation is:

- **Schema-native**: nodes carry semantic meaning (field reference, conditional
  block, repeat block) rather than opaque token text.
- **Deterministically serializable**: the same tree always produces the same
  content string (and vice versa).
- **Editor-agnostic**: the node tree is pure data — independent of TipTap,
  ProseMirror, or any editing surface.
- **Compatibility-preserving**: all existing exports continue to work
  identically through the legacy compatibility bridge.

### What Changed

| Area | Before | After |
|---|---|---|
| **Template representation** | Opaque string with `<<key>>` tokens | Parseable `DocumentNode` tree with semantic types |
| **Rendering** | Regex-based `applyPlaceholders` | Node-tree-based `renderNodesToText` with identical output |
| **Extraction** | `extractPlaceholders(content)` regex scan | `extractFieldKeys(root)` tree walk |
| **Field resolution** | Inline `resolvePlaceholderValue` calls | Centralized `resolveField(key, context)` in `renderSemantics.ts` |
| **Editor nodes** | No semantic node types | Registered but unused TipTap node extensions (groundwork) |
| **Compatibility** | Only legacy path | Dual path: node-first with automatic legacy fallback |

### Files Created

```
src/features/documentEngine/
  index.ts                                — Public API surface
  schema/
    nodeTypes.ts                          — DocumentNode type definitions
    serialization.ts                      — parseToNodes, serializeNodes, normalizeContent
    renderSemantics.ts                    — resolveField, evaluateCondition, expandRepeat, renderNodesToText
  compat/
    legacyPlaceholderBridge.ts            — renderLegacySafe, bridgeToNodes, needsLegacyFallback
  editor/
    tiptapNodes.ts                        — FieldNodeExtension, ConditionalNodeExtension, RepeatNodeExtension
docs/platforms/document-engine/
    PLATFORM_EVOLUTION_TIMELINE.md         — This file
    ARCHITECTURE_DECISIONS.md             — Design rationale and philosophy
```

### What Did NOT Change

- No export functions were modified (`docxExporter.ts`, `pdfExporter.ts`)
- No storage schema was changed (`Template` type, Firestore documents)
- No editor UI was rebuilt (`RichTextEditor.tsx`, `TemplateEditor.tsx`)
- No existing tests were modified (no tests existed to modify)
- No data migration was run (content remains in legacy format)

## Future Migration Direction

### Short-term (Next 1-2 Phases)

- **Add node-type-based rendering in exports**: Modify `exportToDocx` and
  `exportTextToPdf` to use `renderNodesToText` as the primary path, retaining
  legacy fallback for edge cases. This will be a transparent migration — output
  will be identical.
- **Enable TipTap node rendering**: Activate the registered node extensions in
  the editor configuration. When a user types `<<field>>`, the extension can
  convert it to a styled inline node. This should be opt-in and gated by a
  feature flag.

### Medium-term (3-5 Phases)

- **Structured node storage**: Add a `nodes` field to the `Template` type.
  When present, the node tree is used directly instead of parsing the content
  string. The content string is kept for backward compatibility.
- **Schema validation**: Add validation rules for node trees (e.g., no
  duplicate field keys, no malformed condition references).

### Long-term (6+ Phases)

- **Deprecate regex rendering**: Once all templates have been migrated to
  structured node storage, the legacy `applyPlaceholders` path can be removed.
- **Full TipTap integration**: Replace `<<key>>` typed tokens with rendered
  inline nodes in the editor. This changes the editing UX but preserves the
  storage schema.

## Subsystem Boundary Clarification

```
┌─────────────────────────────────────────────┐
│              Export Subsystem                │
│  (docxExporter, pdfExporter, useExport)     │
├─────────────────────────────────────────────┤
│              ↓ uses                          │
├─────────────────────────────────────────────┤
│           Document Engine                    │
│  (documentEngine/)                          │
│                                             │
│  schema/       — node types + serialization │
│  compat/       — legacy bridge              │
│  editor/       — TipTap groundwork          │
├─────────────────────────────────────────────┤
│              ↓ parses/renders                │
├─────────────────────────────────────────────┤
│         Content Storage (string)             │
│  (Template.content in Firestore)            │
└─────────────────────────────────────────────┘
```

The Document Engine is a **consumed** subsystem — exporters consume it, not the
other way around. The Engine has no knowledge of export formats, storage
backends, or editor internals. This ensures that the rendering pipeline can
evolve independently from the editing and export layers.

---

## Phase: Resolver-Backed Rendering Integration

### Summary

This phase promotes the semantic rendering layer from groundwork into controlled
production rendering entrypoints. The render path switches from raw
`applyPlaceholders` to the compatibility bridge (`renderLegacySafe`) at every
export rendering entrypoint.

The phase establishes:

- **Semantic-first rendering**: Exports resolve through the DocumentNode tree
  when possible, falling back to legacy rendering when needed.
- **Render diagnostics**: Every render pass emits structured diagnostics
  (`RenderResult`) including render mode, unresolved fields, and warnings.
  Diagnostics never alter output — they are purely observational.
- **Safe fallback governance**: The bridge guarantees that semantic rendering
  failures never hard-fail an export. Legacy rendering is always available as
  a fallback.
- **Node storage preparation**: The `Template` type gains optional
  `nodes` and `schemaVersion` fields for future migration.
- **Feature-gated editor nodes**: TipTap semantic node extensions are
  gated behind `ENABLE_SEMANTIC_NODES` for isolated testing.

### What Changed

| Area | Before | After |
|---|---|---|
| **Rendering entrypoints** | `applyPlaceholders(content, data)` | `renderLegacySafe(content, data)` via bridge |
| **Export PDF (fields)** | `applyPlaceholders(field.placeholder, data)` | `renderLegacySafe(field.placeholder, data)` |
| **Render observability** | None | `RenderResult` diagnostics with mode, unresolved fields, warnings |
| **Template type** | No `nodes` or `schemaVersion` fields | Optional `nodes?: string`, `schemaVersion?: number` |
| **Feature flags** | None | `ENABLE_SEMANTIC_NODES` flag + getSemanticNodeExtensions() |
| **Fallback governance** | Implicit (no bridge) | Explicit bridge with try/catch + legacy fallback |

### Files Modified

```
src/features/export/services/pdfExporter.ts
  — import: applyPlaceholders → renderLegacySafe at rendering entrypoint
  — exportPdfWithFields: uses renderLegacySafe for field placeholder resolution

src/shared/types/index.ts
  — Template: added nodes?: string, schemaVersion?: number

src/features/templates/hooks/useTemplates.ts
  — mapTemplate: passes through styles, nodes, schemaVersion

src/features/documentEngine/compat/legacyPlaceholderBridge.ts
  — added RenderResult type
  — added renderWithDiagnostics(content, data) → RenderResult

src/features/documentEngine/index.ts
  — exports RenderResult type and renderWithDiagnostics

src/features/documentEngine/config.ts  (NEW)
  — ENABLE_SEMANTIC_NODES feature flag
  — getSemanticNodeExtensions() for conditional TipTap registration
```

### Files NOT Modified

- `docxExporter.ts` — already used `resolveToSegments`, no `applyPlaceholders` present
- `validation.ts` — uses `applyPlaceholders` for pre-export validation, not rendering
- `placeholders.ts` — defines `applyPlaceholders` (source, not call site)
- `exportTextToPdf` — already used `resolveToSegments`
- No editor UI files

### Added (Modified)

- `src/features/documentEngine/config.ts` — feature flag configuration

### Render Diagnostics

The `RenderResult` type provides structured observability:

```ts
type RenderResult = {
  output: string                // rendered output (identical to renderLegacySafe)
  mode: 'semantic' | 'legacy-fallback'  // which path was used
  unresolvedFields: string[]    // keys that could not be resolved
  warnings: string[]            // non-fatal render issues
}
```

Diagnostics are non-breaking — they never modify output. The `renderWithDiagnostics`
function produces identical output to `renderLegacySafe` and is safe to use
anywhere the plain function is used.

### Fallback Governance

The fallback path is:

1. Parse content → `DocumentRoot`
2. Detect non-roundtripping content (adds warning)
3. Render node tree → output
4. If step 1-3 fails → `applyPlaceholders(content, data)` (always succeeds)
5. Always produce output — never throw

This guarantees:
- Exports never hard-fail due to semantic parsing
- All content renders, regardless of format
- The rendered output is byte-identical to what the legacy path would produce
  (for well-formed content)

### Feature Gate: ENABLE_SEMANTIC_NODES

The TipTap semantic node extensions from Phase 1 are gated behind
`ENABLE_SEMANTIC_NODES`. When disabled (default), the editor continues to
render `<<key>>` as plain text tokens. When enabled (via
`VITE_ENABLE_SEMANTIC_NODES=true`), the extensions are registered and
render field/conditional/repeat nodes with visual styling.

This gate exists for isolated testing and serialization validation only.
It does not change storage, exports, or resolver behavior.

---

## Phase: Schema-Native Template Persistence

### Summary

This phase formalizes schema-native template persistence while keeping the
legacy content string as canonical. It introduces structured persistence
envelopes, schema version governance, migration infrastructure, and
validation tooling — all without modifying existing storage or exports.

The phase establishes:

- **TemplateDocument envelope**: A structured wrapper around content + optional
  nodes + schema version + metadata. This is the persistence boundary type for
  all template read/write operations through the document engine.
- **Schema version governance**: Version numbering (`CURRENT_SCHEMA_VERSION = 1`,
  `MINIMUM_SUPPORTED_VERSION = 1`) with explicit version tracking on every
  document. Version is the mechanism for future migration coordination.
- **Migration system**: A registrable migration framework with ordered pipeline
  execution. Migrations are deterministic, idempotent, and backward-compatible.
  The registry supports lookup by version and range queries.
- **Structural node validation**: Non-blocking tree validation that detects
  empty field keys, malformed conditionals/repeats, illegal nesting, duplicate
  fields, and unknown references. Validation produces structured diagnostics
  without altering output.
- **Parity and render comparison**: Utilities that compare legacy vs semantic
  output for the same content and data. Used for rollout validation, migration
  safety, and regression detection.
- **Content remains canonical**: Nodes are additive and optional. All rendering
  continues through the content string. Node storage is not authoritative.

### What Changed

| Area | Before | After |
|---|---|---|
| **Persistence model** | Flat `Template` type only | `TemplateDocument` envelope with version + metadata |
| **Schema versioning** | `Template.schemaVersion?` (optional, ungoverned) | `version` on `TemplateDocument` + `CURRENT_SCHEMA_VERSION` constant |
| **Migrations** | None | Registry + pipeline with ordered execution |
| **Validation** | None (content validated by regex only) | `validateNodeTree`, `validateContentParity`, `compareRenderOutput` |
| **Node integrity** | Not checked | Structural checks: empty refs, illegal nesting, duplicates |

### Files Created / Modified

```
NEW:
  src/features/documentEngine/schema/templateDocument.ts
      — TemplateDocument, pack/unpack, fromLegacyContent, version constants

  src/features/documentEngine/migrations/registry.ts
      — Migration interface, register/get/getInRange, clearRegistry

  src/features/documentEngine/migrations/pipeline.ts
      — upgradeDocument, needsMigration, MigrationError

  src/features/documentEngine/validation/nodeValidation.ts
      — validateNodeTree, isTreeValid, getSignificantIssues

  src/features/documentEngine/validation/parityValidation.ts
      — validateContentParity (content ↔ serialized node comparison)

  src/features/documentEngine/validation/renderParity.ts
      — compareRenderOutput (legacy vs semantic render comparison)

MODIFIED:
  src/features/documentEngine/index.ts
      — Exports all new modules (template document, migrations, validation)
```

### What Did NOT Change

- No exporter files modified
- No Firestore schema changed
- No migration of existing templates
- No editor UI changes
- No render path changes
- No storage schema changes

### Migration Infrastructure

The migration system is designed for future schema evolution:

```
Registry          → registerMigration({ targetVersion, name, migrate })
getMigrations     → sorted list of all registered migrations
getMigrationsInRange → migrations between two versions
upgradeDocument   → run all migrations from doc.version → target
```

Initial migrations are minimal (version 1 is current, no upgrade paths
registered yet). The infrastructure exists so future schema changes have
a governed, deterministic upgrade path.

### Validation Layers

```
┌──────────────────────────────────────────────────────┐
│                  Structural Validation                 │
│  validateNodeTree(root, options)                      │
│  • Empty field keys / condition / source              │
│  • Illegal nesting                                    │
│  • Duplicate field keys                               │
│  • Unknown node types                                 │
│  Returns: ValidationResult (non-blocking)             │
├──────────────────────────────────────────────────────┤
│                  Parity Validation                     │
│  validateContentParity(content, root?)                │
│  • Content ↔ serialized node comparison               │
│  • Token-level diff (missing/extra)                   │
│  • Similarity ratio                                   │
│  Returns: ParityResult (non-blocking)                 │
├──────────────────────────────────────────────────────┤
│                  Render Parity                         │
│  compareRenderOutput(content, data, root?)            │
│  • Legacy output ↔ semantic output                    │
│  • Token mismatch detection                           │
│  • First difference position                          │
│  Returns: RenderParityResult (non-blocking)           │
└──────────────────────────────────────────────────────┘
```

All validation is non-blocking — it never throws, never alters output, and
never prevents rendering.

### Future Canonical Migration Direction

The current direction is:

1. **TemplateDocument envelope** → structured persistence boundary (this phase)
2. **Node caching** → store pre-parsed nodes for performance (future)
3. **Node-authoritative mode** → render from nodes, fall back to content (future)
4. **Content deprecation** → remove legacy content string (long-term)

Each step requires demonstrated parity between legacy and semantic rendering
across the entire template corpus. The parity tooling built in this phase
provides the validation infrastructure needed for these future steps.

---

## Phase 4 — Governed Template Lifecycle

**Theme**: Template lifecycle states, semantic validation UX, migration visibility,
schema governance registry, template lineage, and operational integrity indicators.

### What Changed

1. **Template Lifecycle States**: Templates now have a `lifecycleState` field:
   `draft` (default), `review`, `approved`, `deprecated`, `archived`. States are
   manually selectable in the editor toolbar — no workflow enforcement.

2. **Schema Governance Registry**: The field catalog was evolved into a governed
   schema metadata system (`semanticFieldCatalog.ts`). Fields now carry:
   - `lifecycleState` (active/deprecated/sunset) with deprecation notices
   - `aliases` history with active windows
   - `ownership` metadata (team, system)
   - `compatibility` mappings (structured paths, equivalent keys)
   - Resolver functions: `getFieldByKey`, `getDeprecatedFields`, `resolveAlias`

3. **Semantic Validation Panel**: New `TemplateValidationPanel` component in the
   editor sidebar (Governance tab) that surfaces:
   - Structural issues from `validateNodeTree`
   - Unresolved fields (not in schema registry)
   - Deprecated field usage
   - Condition/repeat diagnostics
   - Migration advisories
   All validation is non-blocking.

4. **Template Health Bar**: New `TemplateHealthBar` component displayed below
   the editor toolbar showing operational integrity metrics:
   - Semantic coverage (% of fields recognized in registry)
   - Placeholder count (total + uncatalogued + deprecated)
   - Validation status (node tree structural check)
   - Schema version (v1+) with compatibility indicator
   - Deprecated field count

5. **Template Version Lineage**: New `TemplateLineage` component tracking:
   - `createdFrom` field on Template (set on duplicate)
   - Ancestor chain resolution (walk `createdFrom` recursively)
   - Schema version association
   - Rollback audit trail via existing `TemplateVersion` system

6. **Migration Visibility**: New `MigrationIndicator` component showing:
   - Current schema version
   - Latest available version
   - Compatibility status
   - Available migration path
   - Using `needsMigration`, `getMigrationsInRange`, `isSchemaCompatible`

### Files Created

- `src/features/templates/components/TemplateHealthBar.tsx`
- `src/features/templates/components/TemplateValidationPanel.tsx`
- `src/features/templates/components/MigrationIndicator.tsx`
- `src/features/templates/components/TemplateLineage.tsx`

### Files Modified

- `src/shared/types/index.ts` — Added `TemplateLifecycleState` type,
  `lifecycleState` and `createdFrom` fields to `Template`
- `src/features/templates/components/semanticFieldCatalog.ts` — Evolved to
  schema governance registry with lifecycle, aliases, ownership, compatibility
- `src/features/templates/hooks/useTemplates.ts` — Map `lifecycleState` and
  `createdFrom`; updated `save` signature; `duplicate` sets `createdFrom`
- `src/features/templates/services/templateService.ts` — Map and persist
  `lifecycleState` and `createdFrom`; lifecycle-only updates avoid version bump
- `src/features/templates/components/TemplateEditor.tsx` — Added lifecycle
  selector, health bar, governance sidebar tab with validation/migration/lineage
- `src/features/templates/components/TemplateList.tsx` — Added lifecycle badge
  display, lifecycle filter dropdown, clear lifecycle filter on reset

### Design Decisions

- Lifecycle states are manual, not workflow-driven. Users set them via dropdown.
  This avoids premature workflow engine complexity.
- Validation is non-blocking everywhere. Templates can be edited in any lifecycle
  state. The validation panel is advisory only.
- `lifecycleState` changes do not bump the version counter (only content/field/
  style changes do). This prevents spurious version inflation.
- Lineage tracking is best-effort: `createdFrom` is set on duplicate but not
  enforced. Ancestor resolution walks a maximum depth of 10.
- The governance tab uses a compact shield icon to preserve sidebar space.
- Health indicators use color-coded badges (green/amber/red) for at-a-glance
  status assessment.
- No exporter files were modified. This phase is governance infrastructure only.

### Future Direction

1. Lifecycle enforcement (prevent editing approved/deprecated templates)
2. Approval workflow (review → approved transitions)
3. Automated validation gates (prevent publishing with validation warnings)
4. Schema version auto-advancement with migration prompts
5. Full lineage visualization (graph view)
6. Template deprecation dashboards and bulk operations

---

*Document Transaction Platform — Governed Template Lifecycle Phase*
*Completion Date: 2026-05-22*

---

## Phase 5 — Governed Transaction Assembly Foundations

**Theme**: Reusable semantic sections, deterministic section composition, governed
clause infrastructure, and composition diagnostics.

### What Changed

1. **Reusable Semantic Sections**: Sections are self-contained governed content
   blocks stored as Firestore `sections` documents. Each section carries:
   - `type` — semantic type identifier (guarantor, repayment, settlement, etc.)
   - `nodes` — serialized DocumentRoot (same format as Template.nodes)
   - `metadata` — label, description, category, lifecycleState, tags,
     compatibleSchemaVersions, deprecation notices
   - `schemaVersion` — independent version tracker for section content format

   Five example section types are provided:
   - **guarantor** — Standard personal/corporate guarantee clause
   - **repayment** — Repayment terms with amount, frequency, maturity, default interest
   - **settlement** — Settlement timeline and consideration payment terms
   - **execution** — Deed execution block with signature lines
   - **jurisdiction** — Governing law and jurisdiction clause

2. **Section Registry**: Firestore-backed registry with full CRUD operations,
   lifecycle state filtering (`active`/`deprecated`/`sunset`), type-based queries,
   and lineage metadata. Sections are scoped to organisations.

3. **Deterministic Composition Rules**: Rule-based system that evaluates template
   context against defined conditions to determine which sections to include:
   - **include-guarantor-if-guarantor-field** — Activated when placeholders
     contain `guarantor_` prefixed keys
   - **include-repayment-if-loan-terms** — Activated for loan_agreement templates
     or when repayment placeholders are present
   - **include-settlement-if-deed** — Activated for deed templates or when
     settlement placeholders are present
   - **include-execution-if-deed-or-loan** — Always active for governed documents
   - **include-jurisdiction-if-legal** — Always active for governed documents

   Rules are:
   - **Deterministic**: Same context always produces same outcome
   - **Schema-driven**: Rule definitions have typed schemas
   - **Observable**: All rule evaluations emit structured diagnostics

4. **Composition Diagnostics**: Non-blocking diagnostics that report:
   - Included sections (which rules matched, why)
   - Excluded sections (which rules did not match, why)
   - Unresolved dependencies (sections not in registry)
   - Warnings (deprecated sections, incompatible versions, missing dependencies)
   - Aggregated statistics (total/included/excluded/unresolved counts)

5. **Hybrid Template Composition**: Templates can embed governed sections via
   the `sectionIds` field. The composition engine merges section nodes into
   the template's DocumentRoot in a deterministic, additive-only fashion:
   - **Additive only**: Section nodes are appended after the template's existing
     content. No content is replaced or transformed.
   - **Compatibility-safe**: Section nodes use the same DocumentNode types as
     the template content itself.
   - **Rollback-safe**: Sections are referential (IDs in template metadata);
     removing references restores original template behavior.

### Files Created

```
src/features/documentEngine/section/
  types.ts          — SectionDefinition, SectionType, SectionLifecycleState, SectionMetadata
  examples.ts       — Five example section definitions (guarantor, repayment, etc.)
  registry.ts       — Firestore-backed CRUD, queries, lineage support
  index.ts          — Public API re-exports

src/features/documentEngine/composition/
  types.ts          — CompositionContext, CompositionRule, CompositionResult, CompositionDiagnostics
  rules.ts          — Five deterministic composition rules
  engine.ts         — Composition engine (composeTemplateSections, composeToContent)
  diagnostics.ts    — Diagnostic builder, warning aggregation
  index.ts          — Public API re-exports

src/features/templates/components/
  SectionManager.tsx — Governance tab UI for section management
```

### Files Modified

- `src/shared/types/index.ts`
  — Added `Section`, `SectionType`, `SectionLifecycleState`, `SectionMetadata` types
  — Added `sectionIds?: string[]` to `Template`
- `src/shared/firebase/collections.ts`
  — Added `SECTIONS: 'sections'` to `COLLECTIONS`
- `src/features/documentEngine/index.ts`
  — Exports section and composition modules
- `src/features/templates/services/templateService.ts`
  — Maps and persists `sectionIds` on templates
- `src/features/templates/hooks/useTemplates.ts`
  — `save` signature accepts `sectionIds`
- `src/features/templates/components/TemplateEditor.tsx`
  — Added `SectionManager` to governance tab
  — Manages `sectionIds` state, persists on change

### Design Decisions

- Sections are Firestore-backed (same backend as templates) — no IndexedDB needed
- Section nodes are additive only — composed after template content, never replacing
- Template `sectionIds` is an optional array — templates without sections work identically
- Composition is deterministic — same template + same registry = same output
- Composition diagnostics are non-blocking — they inform but never prevent operations
- Rules are pure functions — no scripting, no runtime evaluation, no hidden transforms
- Sections have independent lifecycle states — active/deprecated/sunset
- The `SectionManager` UI uses inline governance indicators (lifecycle badges, rule diagnostics)

### What Did NOT Change

- No export files modified (PDF, DOCX, AcroForm)
- No rendering pipeline changed
- No workflow engine introduced
- No AI systems added
- No scripting language introduced
- No legacy template compatibility removed
- No Firestore security rules modified
- No auth, queue, or CRM systems touched

### Future Direction

1. Section versioning and migration support
2. Template-specific override of section content
3. Section dependency graphs and ordering control
4. Admin section management dashboard
5. Section composition preview in editor
6. Batch section lifecycle transitions
7. Cross-organisation section sharing (governed)

---

*Document Transaction Platform — Governed Transaction Assembly Foundations Phase*
*Completion Date: 2026-05-26*

---

## Phase 6 — Transaction Definition & Deal Infrastructure Foundations

**Theme**: Formal transaction definitions, deal entities, transaction-driven
composition, deal validation, and transaction assembly preview.

### What Changed

1. **Transaction Definitions**: Schema-driven definitions of transaction types
   that govern required fields, required sections, optional sections, and
   supported variants. Five transaction types are defined:
   - **secured_loan** — Requires repayment, execution, jurisdiction; supports
     fixed/variable rate, principal_interest/interest_only/balloon repayment,
     and mortgage/charge/guarantee security types
   - **unsecured_loan** — Requires repayment, execution, jurisdiction; no
     security provisions
   - **settlement_deed** — Requires settlement, execution, jurisdiction;
     supports optional guarantor clause
   - **guarantor_loan** — Requires guarantor, repayment, execution,
     jurisdiction; guarantee security type
   - **staged_repayment** — Requires repayment, execution, jurisdiction;
     supports balloon repayment variant

   Each definition includes:
   - `requiredFields` — typed field requirements with labels
   - `requiredSections` — sections that must be composed
   - `optionalSections` — sections that may be composed
   - `supportedVariants` — allowed variant values per dimension
   - `schemaVersion` — version tracking for definition evolution

2. **Deal Infrastructure**: Concrete deal entities stored in Firestore that
   represent transaction state used for assembly and rendering:
   - `transactionType` — which TransactionDefinition governs this deal
   - `participants` — parties involved (role, name, entity type)
   - `financials` — monetary values (loan amount, interest rate, etc.)
   - `dates` — key dates (drawdown, maturity, settlement, agreement)
   - `variants` — selected variant options (rate type, repayment type,
     security type)
   - `overrides` — section inclusion/exclusion overrides

3. **Transaction-Aware Composition**: The `CompositionContext` was extended
   with `transactionType` and `dealContext` fields. New transaction-aware
   composition rules evaluate the transaction type alongside existing template
   metadata:
   - `include-guarantor-if-transaction-requires` — Included when transaction
     type is `guarantor_loan`
   - `include-repayment-if-loan-transaction` — Included for all loan-type
     transactions
   - `include-settlement-if-deed-transaction` — Included for settlement deeds
   - `include-execution-if-deed-or-loan` — Extended to include when any
     transaction type is set
   - `include-jurisdiction-if-legal` — Extended to include when any
     transaction type is set

   The composition engine accepts optional `transactionType` and `deal`
   parameters. When provided, rule evaluation considers the transaction
   context alongside template properties.

4. **Deal Validation**: Non-blocking validation that checks deals against
   their governing transaction definition:
   - Missing required fields in deal financials
   - Missing required sections in composition output
   - Incompatible variant selections
   - Transaction type mismatch between deal and definition
   - Summary text: `"Validation: 2 missing fields, 1 missing sections"`

5. **Transaction Assembly Preview**: New `TransactionPreview` component in the
   governance tab that exposes:
   - Transaction type selector (dropdown with all 5 definitions)
   - Transaction definition summary (label, description, required/optional
     sections as badges, required fields in collapsible details)
   - Deal association (dropdown of existing deals + "New Deal" creation)
   - Selected deal overview (name, participants, rate variant)
   - Validation warnings (collapsible, amber-colored, per-warning)
   - Green "All transaction requirements met" indicator when clean

### Files Created

```
src/features/documentEngine/transaction/
  types.ts          — TransactionDefinition, Deal, TransactionVariants, etc.
  examples.ts       — Five transaction definitions (secured_loan, settlement_deed, etc.)
  registry.ts       — Firestore-backed deal CRUD
  validation.ts     — Deal validation against transaction definitions
  index.ts          — Public API re-exports

src/features/templates/components/
  TransactionPreview.tsx — Governance tab UI for transaction assembly preview
```

### Files Modified

- `src/shared/types/index.ts`
  — Added `TransactionType`, `TransactionVariants`, `DealFinancials`,
    `DealDates`, `DealParticipant`, `DealOverride`, `Deal` types
  — Added `dealId?: string` and `transactionType` to `Template`
- `src/shared/firebase/collections.ts`
  — Added `DEALS: 'deals'` to `COLLECTIONS`
- `src/features/documentEngine/composition/types.ts`
  — Extended `CompositionContext` with `transactionType` and `dealContext`
- `src/features/documentEngine/composition/rules.ts`
  — Added 5 transaction-aware composition rules alongside existing rules
- `src/features/documentEngine/composition/engine.ts`
  — Engine accepts `transactionType` and `deal`; builds enriched context
- `src/features/documentEngine/index.ts`
  — Exports all transaction modules
- `src/features/templates/services/templateService.ts`
  — Maps and persists `dealId` and `transactionType` on templates
- `src/features/templates/hooks/useTemplates.ts`
  — `save` signature accepts `dealId` and `transactionType`
- `src/features/templates/components/TemplateEditor.tsx`
  — Added `TransactionPreview` to governance tab above SectionManager
  — Manages `dealId` and `transactionType` local state, persists on change

### Design Decisions

- Transaction definitions are code-defined (schema-driven), not stored in
  Firestore. This keeps them deterministic and versioned alongside the codebase.
- Deals are Firestore-backed for user-created transaction instances. Each deal
  references a transaction type by string literal.
- Transaction awareness is additive to composition — rules evaluate transaction
  context alongside existing template metadata. Templates without transaction
  associations compose exactly as before.
- Deal validation is non-blocking and informational. Warnings inform the user
  but never prevent operations.
- The `TransactionPreview` UI is additive to the governance tab — it appears
  above the existing `SectionManager`.
- Variants are validated against the transaction definition's `supportedVariants`
  map. Unknown or disallowed variants produce warnings.
- Templates can set `transactionType` independently of `dealId`. This allows
  transaction-driven composition without requiring a deal entity.

### What Did NOT Change

- No export files modified (PDF, DOCX, AcroForm)
- No rendering pipeline changed
- No workflow engine introduced
- No scripting system added
- No Firestore security rules modified
- No existing composition behavior changed
- No auth, queue, or CRM systems touched
- No legacy template compatibility removed

### Future Direction

1. Deal creation UI with field-level editing for financials and participants
2. Transaction-driven rendering preparation (resolve fields from deal context)
3. Multi-deal template composition (one template, multiple deals)
4. Transaction definition versioning and migration
5. Deal-level template generation (create template from deal)
6. Transaction variant visualisation and selection UX
7. Automated deal validation gates (prevent invalid state transitions)

---

*Document Transaction Platform — Transaction Definition & Deal Infrastructure Phase*
*Completion Date: 2026-05-26*

---

## Phase 7 — Governed Semantic Resolution Infrastructure

**Theme**: Typed field definitions, computed transaction fields, formatting
governance, resolver provenance, and deterministic computed outputs.

### What Changed

1. **Typed Field Definitions**: Every resolvable field now has a formal
   `FieldDefinition` with typed semantics. 40 defined fields across 8
   categories (Project, Financial, Loan Terms, Dates, Parties, Security,
   Bank, Legal, Derived). Each definition carries:
   - `type` — `currency | date | acn | percentage | text | number | words`
   - `source` — `direct | computed | participant | derived`
   - `computed` — whether the value is derived via computation
   - `formatter` — which formatter to apply (`currency | date_short | date_long | acn | percentage | words | uppercase | lowercase | none`)
   - `dependencies` — explicit dependency keys for computed fields

2. **Centralized Formatter Registry**: All formatting logic consolidated into
   a single `formatters.ts` module with 9 registered formatters:
   - **currency** — `formatCurrency()` via Intl.NumberFormat (en-AU)
   - **date_short** — `d.toLocaleDateString('en-AU', { day, month: 'short', year })`
   - **date_long** — `d.toLocaleDateString('en-AU', { day, month: 'long', year })`
   - **acn** — Formatted as `XXX XXX XXX` (9-digit ACN)
   - **percentage** — `XX.XX%` formatting
   - **words** — Number-to-words via existing `numberToWords()`
   - **uppercase / lowercase** — String case transforms
   - **none** — Identity pass-through

3. **Computed Transaction Fields**: 4 deterministic computed field
   implementations with explicit dependency declarations:
   - **loan_amount_words** — Depends on `loan_amount`; converts to words
   - **consideration_amount_words** — Depends on `consideration_amount`;
     converts to words
   - **repayment_total** — Depends on `repayment_amount` + `loan_term_months`;
     calculates `amount * months`
   - **participant_count** — Depends on `lender_name` + `borrower_name`;
     counts populated values

   All computed fields:
   - Declare explicit dependencies (no hidden data access)
   - Produce deterministic output (same deps → same result)
   - Use typed formatters for output formatting
   - Are observable via provenance (dependency chain, source tracking)

4. **Resolver Provenance**: Every field resolution now tracks:
   - `source` — `direct | computed | unresolved`
   - `dependencyChain` — for computed fields, which keys were used
   - `formatterApplied` — which formatter was run on the value
   - `resolved` — whether a value was found
   - `fallbackUsed` — whether the raw value was replaced by formatted

   Two resolution functions:
   - `resolveGovernedField(key, data)` — returns `{ value, source, formatter, key }`
   - `resolveFieldWithProvenance(key, data)` — returns `{ value, provenance }`
     with full provenance tracking

5. **Resolver Dependency Validation**: Two validators:
   - `validateFieldDependencies()` — checks all field definitions for:
     - Circular dependencies in computed field chains
     - Unresolved dependencies (referencing non-existent fields)
     - Invalid formatter references
     - Invalid computed chains (non-computed field with dependencies)
   - `validateFieldKeys(keys)` — checks a set of keys against the field
     registry, reporting undefined fields

   All validation is non-blocking and returns structured warnings.

### Files Created

```
src/features/documentEngine/resolver/
  types.ts          — FieldDefinition, FieldDataType, FieldSource, FormatterId,
                      ResolverProvenance, ComputedFieldRegistration, etc.
  definitions.ts    — 40 field definitions across 9 categories
  formatters.ts     — 9 formatters in centralized registry
  computed.ts       — 4 computed field implementations with dependency declarations
  provenance.ts     — Provenance tracking for field resolution
  validation.ts     — Dependency validation (circular deps, unresolved deps, etc.)
  resolveField.ts   — resolveGovernedField, isFieldGoverned, getFieldDataType
  index.ts          — Public API re-exports

src/features/templates/components/
  ResolverDiagnostics.tsx — Governance tab UI for semantic resolution diagnostics
```

### Files Modified

- `src/features/documentEngine/index.ts`
  — Exports all resolver modules
- `src/features/templates/components/TemplateEditor.tsx`
  — Added `ResolverDiagnostics` to governance tab

### Design Decisions

- **Field definitions are code-defined** (like transaction definitions) — no
  Firestore storage, no runtime modification, maximum determinism.
- **Computed fields are explicit TypeScript functions** — no formula language,
  no DSL, no runtime `eval`. Dependencies are declared upfront and checked
  by the validation system.
- **Formatter registry is centralized** — no scattered `_currency`/`_words`
  suffix checks in multiple files. All formatting flows through `formatField()`.
- **Provenance is diagnostic-only** — it tracks what happened but never alters
  resolution output. The existing `resolveField()` in `renderSemantics.ts`
  continues to work unchanged.
- **Validation is non-blocking** — warnings inform governance but never
  prevent template editing or rendering.
- **No export path changes** — the new resolver is additive infrastructure.
  The existing `renderNodesToText` → `resolveField` → `resolvePlaceholderValue`
  path is untouched.

### What Did NOT Change

- No export files modified (PDF, DOCX, AcroForm)
- No rendering pipeline changed (`renderSemantics.ts` untouched)
- No placeholder resolution changed (`placeholders.ts` untouched)
- No workflow engine introduced
- No scripting system added
- No formula language introduced
- No Firestore security rules modified
- No legacy compatibility removed

### Future Direction

1. Integrate `resolveGovernedField` into the rendering pipeline as an
   alternative resolution path (gated by feature flag)
2. Connect deal financials to computed field data sources (deal-aware
   resolution)
3. Field requirement enforcement in template validation
4. Formatting preview in the editor (see formatted values before export)
5. Field definition versioning and migration
6. Automated field coverage reports (which fields are used vs defined)

---

*Document Transaction Platform — Governed Semantic Resolution Infrastructure Phase*
*Completion Date: 2026-05-26*

---

## Phase 8 — Governed Document Lifecycle Infrastructure

**Theme**: Document lifecycle states, immutable render snapshots, document lineage,
execution metadata, and lifecycle diagnostics.

### What Changed

1. **Document Lifecycle States**: Generated documents now have a `lifecycleState`
   field with governed states: `draft`, `generated`, `issued`, `executed`,
   `superseded`, `archived`. States are passive metadata on `DocumentGenerated`
   — no workflow enforcement, no state machine transitions.

2. **Immutable Render Snapshots**: When a document is generated, a `RenderSnapshot`
   captures the rendered content, schema version, transaction version, section IDs,
   provenance summary, generator identity, and timestamp. Snapshots are:
   - **Immutable**: Once written, snapshot fields never mutate
   - **Deterministic**: Same inputs produce same snapshot data
   - **Observable**: Snapshots carry full provenance summary of the resolution pass
   - **Archivable**: Old snapshots remain readable for audit and lineage

   Snapshot infrastructure:
   - `createSnapshot()` — Firestore-backed creation with server timestamp
   - `getSnapshot()` — Single snapshot retrieval
   - `getSnapshotsForDocument()` — All snapshots for a document (version-descending)
   - `getLatestSnapshot()` — Most recent snapshot for a document
   - `verifySnapshotIntegrity()` — Non-blocking integrity check (rendered content,
     generator identity, version validity)

3. **Document Lineage**: Lineage tracking via:
   - `supersedes` field on `DocumentGenerated` — which document this replaces
   - `generatedFromId` field — which document/entity this was generated from
   - `resolveLineage()` — Resolves current document + ancestors + superseder from
     a list of documents
   - `getSupersessionChain()` — Chain of documents from current backwards through
     superseded ancestors

4. **Execution Metadata**: Passive metadata on `DocumentGenerated`:
   - `lifecycleState` — current governed state
   - `snapshotId` — reference to the latest render snapshot
   - `supersedes` — lineage reference to superseded document
   - `generatedFromId` — lineage reference to source document

5. **Lifecycle Diagnostics**: `diagnoseLifecycle()` checks:
   - Snapshot presence (missing snapshot for non-draft states)
   - Snapshot integrity (rendered content, generator, version)
   - Missing metadata (generator identity for issued documents, timestamps)
   - Lineage completeness (superseded documents have a last snapshot)
   All diagnostics are non-blocking and observational.

### Files Created

```
src/features/documentEngine/lifecycle/
  types.ts          — DocumentLifecycleState, RenderSnapshot, LifecycleMetadata,
                      DocumentLineage, DocumentLineageEntry
  snapshots.ts      — createSnapshot, getSnapshot, getSnapshotsForDocument,
                      getLatestSnapshot, verifySnapshotIntegrity
  lineage.ts        — resolveLineage, getSupersessionChain
  validation.ts     — diagnoseLifecycle, summariseLifecycleDiagnostics
  index.ts          — Public API re-exports

src/features/templates/components/
  LifecycleDiagnostics.tsx — Governance tab UI for document lifecycle diagnostics
```

### Files Modified

- `src/shared/types/index.ts`
  — Added `DocumentLifecycleState` type
  — Added `RenderSnapshot` interface
  — Added `lifecycleState`, `snapshotId`, `supersedes`, `generatedFromId` to
    `DocumentGenerated`
- `src/shared/firebase/collections.ts`
  — Added `SNAPSHOTS: 'snapshots'` to `COLLECTIONS`
- `src/features/documentEngine/index.ts`
  — Exports all lifecycle modules (types, snapshots, lineage, validation)
- `src/features/templates/components/TemplateEditor.tsx`
  — Added template lifecycle state display to governance tab
  — Added `LifecycleDiagnostics` section

### Design Decisions

- **Lifecycle states are passive metadata**: States label documents but never gate
  operations. A document in `issued` state can still be re-generated, exported,
  and edited.
- **Snapshots are Firestore-backed**: Same backend as templates/sections/deals.
  Snapshots live in the `snapshots` collection, scoped by `documentId`.
- **Snapshots are versioned**: Each snapshot has an incrementing `snapshotVersion`.
  Multiple snapshots per document enable historical audit.
- **Lineage is reference-based**: Supersession is tracked by document ID strings
  on `DocumentGenerated`. No graph database or edge collection needed.
- **Diagnostics are non-blocking**: `diagnoseLifecycle()` returns warnings but
  never throws. Diagnostics inform governance but never prevent operations.
- **No change to generation pipeline**: Existing `DocumentGenerated` creation is
  unchanged. Lifecycle fields are initialized at creation time with defaults.

### What Did NOT Change

- No export files modified (PDF, DOCX, AcroForm)
- No rendering pipeline changed
- No workflow engine introduced
- No state machine or transition system introduced
- No Firestore security rules modified
- No existing `DocumentGenerated` behavior changed
- No auth, queue, or CRM systems touched
- No legacy template compatibility removed

### Future Direction

1. Automated snapshot capture during generation (wire into export pipeline)
2. Lifecycle transition governance (prevent invalid transitions at DB level)
3. Document version comparison (snapshot diffing)
4. Bulk lifecycle transitions (e.g., archive all superseded documents)
5. Lineage visualization (graph view of supersession chains)
6. Lifecycle-based access control (e.g., prevent editing issued documents)
7. Snapshot content search (search across rendered document snapshots)

---

*Document Transaction Platform — Governed Document Lifecycle Infrastructure Phase*
*Completion Date: 2026-05-26*

---

## Phase 9 — Governed Transaction Package Infrastructure

**Theme**: Grouped transaction outputs, deterministic package manifests, execution
sets, immutable package snapshots, package lineage, and audit-safe reconstruction.

### What Changed

1. **Transaction Package Entity**: A `TransactionPackage` is a Firestore-backed
   grouping entity that collects documents under a transaction. Each package carries:
   - `lifecycleState` — `draft`, `assembled`, `finalised`, `superseded`, `archived`
   - `documentIds` — documents included in the package
   - `snapshotIds` — render snapshot references for audit
   - `manifestVersion` — the current manifest version (bumped on finalisation)
   - `executionSetType` — optional classification for execution grouping
   - `label` — optional human-readable label

2. **Deterministic Package Manifests**: Immutable `PackageManifest` documents
   stored in the `manifests` Firestore collection. Each manifest captures:
   - All document IDs and snapshot IDs at finalisation time
   - `schemaVersions` — per-document schema version mapping
   - `compositionSummaries` — per-document composition provenance
   - `transactionMetadata` — transaction type, variant, etc.
   - Version number (monotonic, matches package's `manifestVersion`)

   Manifest infrastructure:
   - `createManifest()` — Creates an immutable manifest from package + metadata
   - `getManifest()` / `getManifestsForPackage()` / `getLatestManifest()` — Retrieval
   - `verifyManifestIntegrity()` — Non-blocking integrity check (document refs,
     snapshot refs, version, creator identity)

3. **Package Integrity Validation**: `validatePackageIntegrity()` checks:
   - Missing snapshot coverage for non-draft packages
   - Per-document snapshot presence
   - Manifest presence for finalised packages
   - Manifest version consistency
   - Missing documents between package and manifest
   - Lineage completeness for superseded packages
   All validation is non-blocking and observational.

4. **Execution Set Definitions**: Four deterministic execution set types defined
   as code (same pattern as transaction definitions):
   - **signing_pack** — Execution documents for all parties (signing blocks,
     execution pages)
   - **settlement_pack** — Financial settlement documents (settlement statements,
     payment directions)
   - **guarantor_execution** — Guarantee documents for separate execution
     (guarantee deeds, execution pages)
   - **disclosure_bundle** — Regulatory and disclosure documents (key facts
     sheets, disclosure statements)

   `getExecutionSetsForTransactionType()` maps execution sets to transaction types:
   - `settlement_deed` / `secured_loan` require settlement_pack
   - `guarantor_loan` requires guarantor_execution
   - All transactions require signing_pack and disclosure_bundle

5. **Package Reconstruction Utilities**: Deterministic reconstruction support:
   - `rebuildPackageFromManifest()` — Reconstruct package shape from manifest
   - `recoverSnapshots()` — Determine which snapshots are recoverable vs missing
   - `restoreLineage()` — Rebuild ancestor chain from superseded/archived packages
   - `verifyReconstruction()` — Compare reconstructed state against original

### Files Created

```
src/features/documentEngine/package/
  types.ts          — TransactionPackage, PackageManifest, ExecutionSet, PackageLineage
  manifest.ts       — createManifest, getManifest, getManifestsForPackage,
                      getLatestManifest, verifyManifestIntegrity
  validation.ts     — validatePackageIntegrity, summarisePackageValidation
  executionSets.ts  — 4 execution set definitions, query by transaction type
  reconstruction.ts — Rebuild, recover, restore, verify reconstruction utilities
  index.ts          — Public API re-exports
```

### Files Modified

- `src/shared/types/index.ts`
  — Added `PackageLifecycleState`, `ExecutionSetType` type aliases
  — Added `TransactionPackage` and `PackageManifest` interfaces
- `src/shared/firebase/collections.ts`
  — Added `PACKAGES: 'packages'` and `MANIFESTS: 'manifests'` to COLLECTIONS
- `src/features/documentEngine/index.ts`
  — Exports all package modules (types, manifest, validation, executionSets,
    reconstruction)

### Design Decisions

- **Package lifecycle states are distinct** from document lifecycle states.
  Packages govern output grouping, not document issuance.
- **Manifests are immutable** — once created, they never change. This guarantees
  audit integrity: a manifest at version N always reflects the package state at
  finalisation.
- **Execution sets are code-defined** (like transaction definitions). Four sets
  cover the known use cases; adding new sets is a TypeScript change only.
- **Reconstruction is deterministic** — same manifest + same snapshot set =
  same reconstructed package. No ambient state, no I/O during reconstruction.
- **Validation is non-blocking** — warnings inform but never prevent operations.
- **No UI components yet** — package infrastructure is backend-side only in this
  phase. UI integration (package creation, manifest browsing, execution set
  selection) is future work.

### What Did NOT Change

- No export files modified (PDF, DOCX, AcroForm)
- No rendering pipeline changed
- No workflow engine introduced
- No state machine introduced
- No Firestore security rules modified
- No existing document generation changed
- No auth, queue, or CRM systems touched
- No legacy template compatibility removed

### Future Direction

1. Package creation UI (associate documents with packages, set labels)
2. Execution set selection UI (choose signing_pack vs settlement_pack)
3. Manifest browsing UI (view manifest contents, version history)
4. Automated manifest creation during document generation
5. Package-level lifecycle transitions (automated state advancement)
6. Package snapshot diffing (compare package state across versions)
7. Package lineage visualisation

---

*Document Transaction Platform — Governed Transaction Package Infrastructure Phase*
*Completion Date: 2026-05-26*

---

## Phase 10 — Governed Operational Readiness Infrastructure

**Theme**: Transaction readiness, execution readiness, package completeness,
governance health visibility, unresolved dependency surfacing, and deterministic
operational diagnostics.

### What Changed

1. **Readiness Assessment Models**: A `ReadinessAssessment` type that captures
   the combined readiness state across three dimensions:
   - `transactionReady` — whether the transaction definition requirements are met
   - `packageReady` — whether the package has valid references and snapshots
   - `executionReady` — whether the execution dependencies and lineage are intact
   - `score` — weighted integrity score (0-100, deterministic)
   - `unresolvedIssues` — error-severity diagnostics
   - `warnings` — warning-severity diagnostics

2. **Deterministic Transaction Integrity Scoring**: `calculateScore()` uses
   fixed weights for each category:
   - Missing required section: −30 points
   - Unresolved field: −10 points
   - Invalid package reference: −25 points
   - Missing snapshot: −20 points
   - Lineage inconsistency: −15 points

   Scoring is:
   - **Deterministic**: Same inputs always produce same score
   - **Transparent**: Weights are hard-coded constants, not hidden calculations
   - **Explainable**: Each deduction is traceable to a specific check
   - **NOT AI**: No probabilistic models, no machine learning, no hidden scoring

   Threshold-based readiness classification:
   - **ready**: ≥80 score, no missing sections, ≤3 unresolved fields
   - **conditional**: ≥60 but <80, or minor issues present
   - **not_ready**: Missing sections, >3 unresolved fields, or invalid refs

3. **Package Readiness Diagnostics**: `assessPackageReadiness()` checks:
   - Required vs present execution sets
   - Missing outputs (documents without snapshots)
   - Unresolved dependencies
   - Superseded documents in package
   - Manifest presence
   - Snapshot coverage ratio

   All diagnostics are non-blocking and structured into `DiagnosticDetail`
   objects with category, message, severity, and source origin.

4. **Operational Governance Dashboard**: New `GovernanceDashboard` component
   in the TemplateEditor governance tab that surfaces:
   - Integrity score bar (color-coded green/amber/red)
   - Readiness state badges (transaction, package, execution)
   - Expandable diagnostics with error/warning/info severity
   - Readiness details (fields, sections, schema version, lineage)

5. **Deterministic Readiness Reports**: 6 report generators that produce
   structured `ReadinessReport` objects with sections and summary:
   - `generateTransactionSummary()` — Transaction-level readiness
   - `generateGovernanceSummary()` — Combined governance assessment
   - `generateExecutionReadiness()` — Execution-type readiness
   - `generatePackageCompleteness()` — Package-level completeness
   - `generateAuditReconstructionStatus()` — Audit reconstruction status
   - `formatReport()` — Plain-text report serialisation

   Reports are:
   - **Reproducible**: Same inputs always produce same report text
   - **Deterministic**: No randomness, no timestamps in content
   - **Explainable**: Each report section is human-readable prose

### Files Created

```
src/features/documentEngine/readiness/
  types.ts            — ReadinessState, ReadinessAssessment, ReadinessScore, DiagnosticDetail
  scoring.ts          — calculateScore, assessTransactionReadiness, assessPackageReadiness,
                        assessExecutionReadiness, generateScoringDiagnostics
  packageReadiness.ts — assessPackageReadiness with package-level diagnostics
  reports.ts          — 6 deterministic report generators + formatReport
  index.ts            — Public API re-exports

src/features/templates/components/
  GovernanceDashboard.tsx — Governance tab UI with score bar, state badges, diagnostics
```

### Files Modified

- `src/features/documentEngine/index.ts`
  — Exports all readiness modules (types, scoring, packageReadiness, reports)
- `src/features/templates/components/TemplateEditor.tsx`
  — Added `GovernanceDashboard` to governance tab above `ResolverDiagnostics`

### Design Decisions

- **Scoring weights are hard-coded constants**: Each issue type has a fixed
  weight that is transparent and auditable. No hidden calculations, no
  probabilistic models, no AI.
- **Readiness is three-dimensional**: Transaction, package, and execution
  readiness are assessed independently. A transaction can be ready while its
  package is not.
- **Diagnostics are structured**: `DiagnosticDetail` carries category, message,
  severity, and source origin. This enables the UI to filter and group
  diagnostics without string parsing.
- **Reports are deterministic**: All report generators are pure functions. No
  time-based content, no random values, no external data — same inputs always
  produce identical reports.
- **Dashboards are passive**: The GovernanceDashboard displays information
  but never triggers actions, sends notifications, or blocks operations.
- **No workflow integration**: Readiness informs but does not control. No
  operation is gated on readiness state.

### What Did NOT Change

- No export files modified (PDF, DOCX, AcroForm)
- No rendering pipeline changed
- No workflow engine introduced
- No notification system introduced
- No event-driven system introduced
- No Firestore security rules modified
- No existing template behavior changed
- No auth, queue, or CRM systems touched
- No legacy compatibility removed

### Future Direction

1. Deal-aware readiness (score from actual deal financials and participants)
2. Snapshot-backed scoring (verify snapshot content matches current state)
3. Trend tracking (score history across package versions)
4. Readiness gates (opt-in enforcement for specific lifecycle transitions)
5. Cross-transaction dependency resolution
6. Automated readiness report distribution

---

*Document Transaction Platform — Governed Operational Readiness Infrastructure Phase*
*Completion Date: 2026-05-26*

---

## Phase 11 — Governed Externalization & Issuance Infrastructure

**Theme**: Issuance manifests, recipient governance, delivery lineage, immutable
issuance records, deterministic externalization state, and audit-safe issuance
reconstruction.

### What Changed

1. **Issuance Models**: Firestore-backed `IssuanceRecord` entities that formalize
   the act of issuing a package to recipients. Each record carries:
   - `issuanceState` — `pending`, `issued`, `delivered`, `failed`, `revoked`
   - `packageId` — the package being issued
   - `recipientIds` — intended recipients
   - `manifestId` — reference to the immutable issuance manifest
   - `issuedSnapshots` — snapshot IDs issued at this point

2. **Immutable Issuance Manifests**: `IssuanceManifest` documents stored in the
   `issuance_manifests` Firestore collection. Each manifest captures:
   - `documentIds` and `snapshotIds` — what was delivered
   - `recipientMappings` — recipient ID → role mapping at issuance time
   - `packageSnapshotVersions` — snapshot version per document at issuance
   - `issuanceMetadata` — extensible metadata key-value pairs

   Manifest infrastructure:
   - `createIssuanceManifest()` — Creates immutable manifest from issuance record
   - `getIssuanceManifest()` / `getManifestsForIssuance()` / `getLatestIssuanceManifest()` — Retrieval
   - `verifyIssuanceManifestIntegrity()` — Non-blocking check (snapshots, creator, recipient mappings)

3. **Recipient Governance**: `Recipient` entities with:
   - `role` — signatory, guarantor, counterparty, regulator, legal_representative
   - `packageIds` — associated packages
   - `issuanceIds` — issuance history
   - Resolution strategies: `by_role`, `by_id`, `by_package`
   - `resolveRecipientByRole()`, `resolveRecipientById()`, `resolveRecipientsByPackage()`
   - `buildRecipientMappings()` — Build role mappings for manifest creation
   - `getIssuanceLineageForRecipient()` — Get all issuances for a recipient

4. **Externalization Integrity Validation**: `validateExternalization()` checks:
   - Missing snapshot coverage in issuance
   - Manifest presence for issued-state records
   - Snapshot consistency between record and manifest
   - Valid recipients for non-pending issuances
   - Manifest existence for revoked issuances
   All validation is non-blocking and returns structured `IssuanceValidationWarning` objects.

5. **Issuance Reconstruction Utilities**: Deterministic reconstruction support:
   - `rebuildIssuanceFromManifest()` — Reconstruct issuance shape from manifest
   - `recoverIssuanceSnapshots()` — Determine recoverable vs missing snapshots
   - `recoverRecipientLineage()` — Rebuild recipient manifest associations
   - `verifyIssuanceReconstruction()` — Verify reconstructed state integrity

### Files Created

```
src/features/documentEngine/issuance/
  types.ts          — IssuanceState, IssuanceRecord, IssuanceManifest, Recipient,
                      RecipientRole, IssuanceLineageEntry, RecipientResolutionStrategy
  manifest.ts       — createIssuanceManifest, getIssuanceManifest, getManifestsForIssuance,
                      getLatestIssuanceManifest, verifyIssuanceManifestIntegrity
  recipients.ts     — resolveRecipientByRole, resolveRecipientById, resolveRecipientsByPackage,
                      buildRecipientMappings, getIssuanceLineageForRecipient
  validation.ts     — validateExternalization, summariseIssuanceValidation
  reconstruction.ts — rebuildIssuanceFromManifest, recoverIssuanceSnapshots,
                      recoverRecipientLineage, verifyIssuanceReconstruction
  index.ts          — Public API re-exports
```

### Files Modified

- `src/shared/types/index.ts`
  — Added `IssuanceState`, `RecipientRole` type aliases
  — Added `Recipient`, `IssuanceRecord`, `IssuanceManifest` interfaces
- `src/shared/firebase/collections.ts`
  — Added `ISSUANCES`, `ISSUANCE_MANIFESTS`, `RECIPIENTS` to COLLECTIONS
- `src/features/documentEngine/index.ts`
  — Exports all issuance modules (types, manifest, recipients, validation,
    reconstruction)

### Design Decisions

- **Issuance state is separate** from package lifecycle and document lifecycle.
  Issuance governs externalization, not document status or package assembly.
- **Manifests are immutable** — once created, they never change. This guarantees
  audit integrity for what was issued, to whom, and with what snapshots.
- **Recipients are Firestore-backed entities** with role-based resolution. Roles
  are typed (5 defined roles) but extensible via string union.
- **Validation is non-blocking** — warnings inform governance but never prevent
  operations.
- **Reconstruction is deterministic** — same manifest + same snapshot set =
  same reconstructed issuance. No I/O during reconstruction.
- **No delivery infrastructure** — issuance records track the intent and metadata
  of externalization but do not handle actual delivery (no email, no file transfer,
  no messaging).

### What Did NOT Change

- No export files modified (PDF, DOCX, AcroForm)
- No rendering pipeline changed
- No messaging system introduced
- No notification system introduced
- No workflow engine introduced
- No async orchestration introduced
- No Firestore security rules modified
- No existing issuance or generation behavior changed
- No auth, queue, or CRM systems touched
- No legacy template compatibility removed

### Future Direction

1. Issuance creation UI (select package, recipients, trigger issuance)
2. Recipient management UI (CRUD, role assignment)
3. Issuance manifest browsing UI
4. Automated manifest creation during externalization
5. Delivery status tracking (integration with external delivery channels)
6. Bulk issuance (issue multiple packages in one operation)
7. Issuance revocation workflows

---

*Document Transaction Platform — Governed Externalization & Issuance Infrastructure Phase*
*Completion Date: 2026-05-26*
