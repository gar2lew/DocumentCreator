# Architecture Decisions — Document Transaction Platform

## Structured Node Doctrine

**Decision**: Document templates are represented as a tree of semantic node
types (`TextNode`, `FieldNode`, `ConditionalNode`, `RepeatNode`), not as opaque
strings with embedded tokens.

**Rationale**:

1. **Schema-aware rendering**: A node tree carries semantic information that a
   regex parse cannot. A `ConditionalNode` knows its condition; a `RepeatNode`
   knows its iteration source. This enables intelligent rendering, validation,
   and transformation without re-parsing.

2. **Deterministic transforms**: With a typed tree, operations like "extract all
   field keys" or "transform all field references" are simple tree walks. With
   regex, the same operations require fragile pattern matching that can miss
   edge cases (e.g., nested blocks, escaped tokens).

3. **Editor independence**: The node tree is plain data — no ProseMirror schema,
   no DOM operations, no React state. This means rendering is testable in
   isolation and does not depend on any particular editor implementation.

**Anti-patterns avoided**:

- ❌ Raw placeholder mutation (modifying string content directly)
- ❌ Regex-only rendering as the primary path
- ❌ Editor-owned schema truth (TipTap as the canonical representation)

## Deterministic Serialization Philosophy

**Decision**: The `parseToNodes` / `serializeNodes` pair forms a deterministic
roundtrip: `normalizeContent` produces the same output for the same input every
time.

**Principles**:

1. **Same input → same tree → same output**. The parser is deterministic by
   construction — no randomness, no ambient state, no external dependencies.

2. **Graceful degradation**. Malformed content (unbalanced `<<if>>`/`<<endif>>`,
   stray `<<` tokens) is handled without throwing. The parser produces the best
   possible tree and falls back character-by-character when it cannot match a
   known pattern.

3. **Lossless roundtrip for well-formed content**. Content that consists only of
   recognized syntax (`<<key>>`, `<<if>>...<<endif>>`, `<<for>>...<<endfor>>`)
   roundtrips exactly. Content with unusual whitespace or unrecognized tokens
   may differ after normalization — the bridge layer detects this and falls
   back to the legacy path.

4. **Stable ordering**. Within a `DocumentRoot`, children maintain their source
   order. Block-structured nodes (conditionals, repeats) recursively maintain
   order within their children.

**Why not store the node tree directly?**

The node tree is a *derived* representation. The canonical storage format
remains the content string (the `Template.content` field in Firestore). This
decision is deliberate:

- Content strings are human-readable and debuggable
- Content strings are indexable and searchable
- Content strings are the format that the editor natively produces
- Storing both would create a read-modify-write consistency problem

The node tree is materialized on demand during rendering and can be cached
for performance, but it is never the source of truth.

## Compatibility Strategy

**Decision**: The legacy placeholder system continues to function unchanged.
All rendering paths have a `legacySafe` fallback that guarantees identical
output regardless of whether the node system or the legacy system is used.

**Strategy layers**:

1. **Node-first rendering**: When content is well-formed, the node tree is
   used for rendering. This produces identical output to the legacy path
   because the node resolver delegates to the same `resolvePlaceholderValue`
   function that `applyPlaceholders` uses.

2. **Automatic fallback**: When `bridgeToNodes` fails or produces a tree that
   doesn't roundtrip cleanly, `renderLegacySafe` falls back to the original
   `applyPlaceholders` function. This transition is transparent to callers.

3. **No export changes**: The export layer (docxExporter, pdfExporter) has no
   knowledge of the node system. It continues to call `applyPlaceholders` and
   `resolveToSegments` as before. The node system is an *upstream* improvement
   that exports benefit from without modification.

4. **Migration path**: `tryBridgeHighConfidence` identifies content that can be
   safely migrated to structured node storage. This enables gradual migration
   without risk — content that can be parsed with high confidence is migrated;
   content that cannot continues using the legacy path.

**No breaking changes**:

- All existing `applyPlaceholders` calls continue to work
- All existing export functions continue to work
- All existing template content continues to render identically
- No database migrations are required
- No deployment coordination is required

## Editor-Agnostic Node Semantics

**Decision**: The document node types (`DocumentNode`, `DocumentRoot`) have
zero dependency on TipTap, ProseMirror, or any editor framework.

**Why**:

1. **Testing**: Pure data types can be unit-tested without DOM. The
   serialization layer and render semantics are pure functions.

2. **Portability**: If the editor changes (e.g., from TipTap to a custom editor,
   or to a server-side rendering pipeline), the node types and rendering
   semantics do not change. They are tied to the *domain* (document templates),
   not the *tool* (TipTap).

3. **Separation of concerns**: The editor is an editing surface. The schema is
   the canonical representation. They serve different purposes and should
   not be coupled.

**TipTap role**: TipTap extensions (`FieldNodeExtension`, etc.) are adapters
that translate between the editor DOM and the node types. They consume the
node types but do not define them. This is a one-way dependency:

```
Node Types → TipTap Extensions
(not the reverse)
```

If TipTap is replaced, the extensions are replaced but the node types remain.

## Rendering Philosophy Updates

**Decision**: Rendering is a two-phase process: (1) resolve the node tree, (2)
apply formatting. These phases are separate concerns.

**Phase 1 — Resolution** (`renderNodesToText`):

- Walk the node tree
- Replace `FieldNode` with resolved values from context
- Evaluate `ConditionalNode` conditions and include/exclude branches
- Expand `RepeatNode` children for each data item
- Produce a flat string

**Phase 2 — Formatting** (existing export layer):

- Apply `TemplateStyles` per placeholder key
- Convert to DOCX runs or PDF text segments
- Apply watermark, alignment, headings
- Render to final format

**Why this separation**:

1. **Single responsibility**: Resolution is about *what* to render (field
   values). Formatting is about *how* to render (font, size, alignment).

2. **Reuse**: The resolution phase is format-agnostic. The same resolved string
   can be formatted as DOCX, PDF, HTML preview, or plain text.

3. **Testability**: Resolution can be tested without loading docx or pdf-lib.
   Formatting can be tested with known resolved strings.

4. **Compatibility**: The existing export layer already implements Phase 2
   perfectly. The node system only replaces Phase 1.

**Current state**: Phase 1 (node types + semantic renderer) is complete. Phase 2
(renderer integration) replaces `applyPlaceholders` with `renderLegacySafe` at
rendering entrypoints, adds diagnostics, and prepares node storage. The export
pipeline now resolves through the bridge layer.

## Semantic Rendering Integration Strategy

**Decision**: Rendering entrypoints use `renderLegacySafe(content, data)` as a
drop-in replacement for `applyPlaceholders`. The bridge layer handles route
selection (semantic vs legacy) transparently.

**Guarantees**:

1. **Output identity**: For well-formed content, `renderLegacySafe` produces
   byte-identical output to `applyPlaceholders`. Both functions delegate to
   the same underlying resolver (`resolvePlaceholderValue`).

2. **Transparent fallback**: When semantic parsing fails or content doesn't
   roundtrip, the bridge falls back to `applyPlaceholders` automatically.
   The caller never needs to know which path was used.

3. **Single call site**: Only the initial rendering call is replaced.
   Downstream formatting (DOCX runs, PDF text segments, styles) is untouched.

**What is NOT replaced**:

- `validation.ts` uses `applyPlaceholders` for pre-export validation, not
  rendering. These calls remain.
- `placeholders.ts` defines `applyPlaceholders`. Its definition remains.
- Downstream export formatting logic remains unchanged.

## Render Diagnostics Philosophy

**Decision**: Every render operation can emit structured diagnostics via
`renderWithDiagnostics`. Diagnostics are observational only — they never
alter rendered output.

**Diagnostic types** (`RenderResult`):

| Field | Description |
|---|---|
| `output` | The fully rendered string (identical to `renderLegacySafe`) |
| `mode` | `"semantic"` or `"legacy-fallback"` — which renderer was used |
| `unresolvedFields` | Placeholder keys that could not be resolved from context |
| `warnings` | Non-fatal issues (e.g., content didn't roundtrip, semantic parse fell back) |

**Why diagnostics are separate**:

The primary render path (`renderLegacySafe`) returns a plain string for maximum
compatibility. It is a drop-in replacement for `applyPlaceholders` — same
signature, same behavior.

The diagnostic path (`renderWithDiagnostics`) wraps the same logic and adds
observability. It is available for:
- Migration validation (comparing output modes)
- Debugging unresolved fields
- Monitoring fallback rates

**Rule**: Diagnostics must never alter output. The `output` field of
`RenderResult` must always equal what `renderLegacySafe` would return for the
same inputs.

## Compatibility Fallback Doctrine

**Decision**: Semantic rendering failures never hard-fail. The bridge layer
guarantees that all content renders through some path.

**Fallback hierarchy**:

```
┌──────────────────────────────────────┐
│  renderLegacySafe(content, data)     │
│                                      │
│  1. parseToNodes(content)            │
│  2. renderNodesToText(tree, data)    │
│     ↓ on failure                     │
│  3. applyPlaceholders(content, data) │
│     (always succeeds)                │
└──────────────────────────────────────┘
```

**Governance rules**:

1. **`parseToNodes` never throws**: Malformed content produces the best
   possible tree and falls back character-by-character.
2. **`renderNodesToText` never throws**: Unresolved fields retain their
   `<<key>>` token in the output (same as legacy behavior).
3. **Bridge `catch` covers all edge cases**: If anything in the semantic path
   fails, `applyPlaceholders` is invoked as a safe default.
4. **Exports always produce output**: No export can hard-fail due to the
   rendering path.

**Validation**: After rendering, the diagnostics layer checks the output for
remaining `<<...>>` tokens and reports them as unresolved fields. This
mirrors the legacy behavior where unfilled placeholders remain visible in
the output.

## Node Storage Preparation

**Decision**: The `Template` type gains optional `nodes` and `schemaVersion`
fields for future migration. These fields are:

- **Optional**: Not required for rendering. Content renders from the
  `content` field regardless of `nodes` presence.
- **Non-authoritative**: When present, `nodes` is a cached serialization of the
  `DocumentRoot`. It is never the source of truth — `content` is.
- **Future-oriented**: A future phase can use the `nodes` field to skip
  parsing on read, improving performance for large templates.

```ts
interface Template {
  // ... existing fields ...
  nodes?: string;         // serialized DocumentRoot (cached, not authoritative)
  schemaVersion?: number; // document engine schema version
}
```

The `mapTemplate` function in `useTemplates.ts` passes these through so they
are available when written to Firestore. No templates are migrated in this
phase — the fields are prepared for future use.

**Why not store the node tree as canonical?**

Consistency. The content string is the editor's native format. If the editor
saves content but the node tree was stale, rendering would use stale data.
By keeping content as canonical, the system is always consistent. The node
tree is materialized on demand from the always-fresh content string.

## Feature Gate Governance

**Decision**: TipTap semantic node extensions are gated behind
`ENABLE_SEMANTIC_NODES`. The default is disabled.

**Configuration**:

- Environment variable `VITE_ENABLE_SEMANTIC_NODES=true` enables the gate.
- The `getSemanticNodeExtensions()` function returns the extensions when
  enabled, or an empty array when disabled.

**What the gate controls**:

- Registration of `FieldNodeExtension`, `ConditionalNodeExtension`,
  `RepeatNodeExtension` in the editor.
- These extensions render `<<key>>` tokens as styled inline nodes in the
  editor UI.

**What the gate does NOT control**:

- The rendering pipeline (always uses `renderLegacySafe`)
- The storage schema (always `content` as canonical)
- The resolver logic (always delegates to `resolvePlaceholderValue`)

**Purpose**: The gate exists for isolated testing and serialization validation.
It allows developers to validate rendering parity between raw tokens and
semantic nodes without changing the production rendering path.

## Renderer Responsibility Boundaries

```
┌──────────────────────────────────────────────────────────┐
│                   EXPORT SUBSYSTEM                        │
│  (docxExporter, pdfExporter, useExport)                  │
│                                                          │
│  Responsibility: Formatting + file generation            │
│  Calls: renderLegacySafe(content, data) for resolution   │
│  Does NOT: parse, transform, or validate content         │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│                   DOCUMENT ENGINE                         │
│  (documentEngine/)                                       │
│                                                          │
│  Responsibility: Parsing + resolution                    │
│  Provides: renderLegacySafe, renderWithDiagnostics       │
│  Does NOT: format output for any export format           │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│                RESOLVER LAYER                             │
│  (placeholders.ts)                                       │
│                                                          │
│  Responsibility: Value lookup + transforms               │
│  Provides: resolvePlaceholderValue(key, data)            │
│  Does NOT: parse, render, or format                      │
└──────────────────────────────────────────────────────────┘
```

The boundaries ensure:
- Exports handle formatting only
- Document Engine handles parse/resolve only
- Resolver handles value lookup only
- No layer duplicates another's responsibility

## Semantic Rendering Future Direction

### Immediate (Deployed in This Phase)

- All rendering entrypoints use the bridge layer
- Diagnostics available for observability
- Template type prepared for node storage
- Feature gate available for testing

### Next Phase

- Use `renderNodesToText` as primary path (skip `applyPlaceholders` entirely)
- Add node tree caching via `nodes` field
- Start validating `schemaVersion` for feature detection

### Future Phases

- Remove `applyPlaceholders` fallback when all content is migrated
- Use node tree for editor rendering (full TipTap integration)
- Schema-driven template validation and transformation

---

*Document Transaction Platform — Resolver-Backed Rendering Integration Phase*
*Architecture decisions recorded 2026-05-22*

---

## Persistence Doctrine

**Decision**: Template persistence uses a structured envelope (`TemplateDocument`)
that wraps content with optional nodes and schema version metadata. The raw
content string remains canonical.

**Envelope structure**:

```
TemplateDocument {
  version: number          // schema version for migration governance
  content: string          // ALWAYS canonical (source of truth)
  nodes?: DocumentRoot     // ALWAYS additive (never authoritative)
  metadata?: {
    lastParsedAt?: string
    parsedAtVersion?: number
    migrationState?: MigrationState
  }
}
```

**Rationale**:

1. **Content is the source of truth**. The editor produces content. Content
   is human-readable, debuggable, and indexable. Making content canonical
   avoids read-modify-write consistency problems between the editor and the
   node tree.

2. **Nodes are cached views**. The node tree is a materialized parse of the
   content string. It can be regenerated at any time. Storing it alongside
   content is a performance optimization, not a persistence change.

3. **Version is governance**. Every document carries a schema version. This
   enables deterministic migration — the system knows exactly which version
   of the node semantics was used to produce the stored nodes.

4. **Metadata enables observability**. Tracking when and at what version the
   node tree was last parsed provides debugging context and migration insight.

**What this is NOT**:

- Not a storage migration (Firestore still stores flat `Template` objects)
- Not a format change (content format is unchanged)
- Not a rendering change (exports still use `content`)
- Not an editor change (editor still produces content)

## Schema Versioning Philosophy

**Decision**: Schema versions are sequential integers starting at 1. Each
version represents a milestone in the node type system's evolution.

**Version rules**:

1. **Monotonic increasing**: Versions are positive integers that only increase.
   There is no downgrade path — once a document is migrated to version N, it
   stays at version N.

2. **Minimum supported version**: `MINIMUM_SUPPORTED_VERSION` defines the
   oldest version the current code can read. Documents below this version
   must be migrated before they can be rendered.

3. **Version is on the document, not the code**: Each `TemplateDocument` carries
   its own version. Different documents can be at different versions within
   the same system. This enables gradual migration.

4. **Backward compatibility**: New versions must be able to read old versions.
   The migration pipeline handles upgrades transparently.

**Why sequential integers instead of semver**:

- Template documents are internal data, not external API.
- The node type system is bounded and evolves slowly.
- Sequential integers make range queries trivial (`version > 5`).
- Semver would add complexity without commensurate benefit.

## Migration Governance Strategy

**Decision**: Migrations are registered, deterministic, idempotent functions
that are executed in version order by a centralized pipeline.

**Governance rules**:

1. **Registration**: Every migration must be registered in the global registry
   via `registerMigration()` before the pipeline can use it. Duplicate version
   registrations throw at registration time.

2. **Ordering**: Migrations are sorted by `targetVersion` ascending. The
   pipeline always runs migrations in this order — never skipping a version.

3. **Determinism**: The same input document must produce the same output
   document for the same set of registered migrations. No randomness, no
   ambient state, no external dependencies.

4. **Idempotency**: Running the same migration twice on the same document
   must be safe. Migrations should check the document's current version and
   no-op if already at the target.

5. **Atomicity**: If any migration in the chain fails, the pipeline throws
   with a `MigrationError` that includes the failed version and execution log.
   The document is left at the last successfully applied version.

6. **No persistence**: The pipeline transforms in-memory documents only.
   Storage updates are the caller's responsibility.

**Fallback behavior**: If a migration fails, the caller receives a
`MigrationError` with diagnostic information. The caller can choose to:
- Retry the migration after fixing the issue
- Use the legacy content path (which is always available)
- Log the error and continue with the original document

## Semantic Persistence Rationale

**Why persist nodes at all if content is canonical?**

1. **Performance**: For large templates with many nested blocks, parsing
   the content string on every render is wasteful. Storing pre-parsed nodes
   eliminates this cost.

2. **Validation**: A persisted node tree can be validated independently of
   the editor. Structural issues can be caught at save time rather than
   render time.

3. **Migration**: As the node type system evolves, having a materialized
   node tree makes it easier to transform old structures to new ones. The
   migration operates on the tree, not the string.

4. **Editor integration**: Future editor versions will render nodes directly.
   Having persisted nodes means the editor can display semantic structure
   without re-parsing.

**Why NOT make nodes authoritative?**

- The editor produces content, not nodes. If content and nodes diverge,
  content wins because it's what the user wrote.
- Content is the simplest format for Firestore queries, text search, and
  debugging.
- Keeping content authoritative eliminates an entire class of consistency
  bugs.

## Parity Validation Doctrine

**Decision**: Parity validation compares legacy and semantic paths to detect
divergence. It is always non-blocking and never alters output.

**Doctrine**:

1. **Parity is a measure of correctness**. If the semantic renderer produces
   different output than the legacy renderer for the same input, there is a
   bug in the semantic path. Parity validation catches these bugs.

2. **Three levels of comparison**:
   - **Content parity**: Does the serialized node tree match the original
     content string? (via `validateContentParity`)
   - **Render parity**: Does the semantic render output match the legacy
     render output? (via `compareRenderOutput`)
   - **Structural parity**: Is the node tree well-formed? (via
     `validateNodeTree`)

3. **Non-blocking assumption**: Validation results inform decisions but never
   prevent operations. You can always render, even with validation warnings.

4. **Similarity, not identity**: For some edge cases (whitespace
   normalization), legacy and semantic output may differ in harmless ways.
   Parity validation reports these as informational differences, not errors.

**Why parity validation matters for rollback safety**:

If semantic rendering is ever promoted to canonical and a bug is discovered,
rollback safety depends on knowing that the legacy path produces the same
output. Parity validation provides this confidence by continuously comparing
both paths.

## Rollback Safety Philosophy

**Decision**: The dual-path architecture (legacy + semantic) provides inherent
rollback safety. If the semantic path fails or produces wrong output, the
legacy path is always available.

**Safety guarantees**:

1. **No single point of failure**: There are two independent rendering paths.
   If one fails, the other is used.

2. **Output-level verification**: Parity validation compares outputs at the
   character level. Any divergence is detected and reported before it affects
   production rendering.

3. **Storage independence**: Content and nodes are stored separately. If nodes
   become corrupted, the content string produces correct output through the
   legacy path.

4. **Gradual rollout**: New features (semantic nodes, new migrations) can be
   tested against a subset of templates before full rollout. The validation
   tooling provides before/after comparison.

**Rollback procedure**:
1. Disable semantic path (revert to `applyPlaceholders` only)
2. Rebuild from content string (if nodes were corrupted)
3. Revert template documents to previous schema version
4. Verify parity before re-enabling semantic path

## Future Canonical Migration Direction

### Phase N+1: Node Caching

- Store `nodes` field in Firestore alongside `content`
- On write: parse content → store nodes in background
- On read: use cached nodes if available, fall back to parse
- Validate content parity on each write

### Phase N+2: Node-Authoritative Rendering

- Render from nodes by default, fall back to content
- Require parity validation before activation
- Add schema version gating to render pipeline

### Phase N+3: Content Deprecation

- Remove legacy content string from storage
- Content becomes a derived format (serialized from nodes)
- Legacy path disabled after full corpus migration

Each phase requires demonstrated parity across the entire template corpus.
The validation tooling built in this phase supports all future phases.

## Governed Template Lifecycle Philosophy

**Decision**: Template lifecycle states are additive metadata, not workflow
enforcement. States exist to inform governance visibility; they do not gate
operations.

### Lifecycle Doctrine

1. **States are advisory**: `draft`, `review`, `approved`, `deprecated`, and
   `archived` are informational labels. No operation is blocked based on state.
   A template in `approved` state can still be edited, exported, and duplicated.

2. **Manual transitions**: State transitions are manual dropdown selections,
   not automated workflow steps. This avoids premature workflow engine
   complexity while establishing the state model for future enforcement.

3. **State visibility across surfaces**: Lifecycle state appears in the
   template list (badge + filter) and editor (toolbar dropdown + governance
   tab). This provides governance awareness without blocking users.

4. **Version independence**: State changes do not increment the version counter.
   Only content/field/style changes generate new versions. This decouples
   governance metadata from content versioning.

### Semantic Integrity Visibility Rationale

1. **Validation is always non-blocking**: The validation panel reports issues
   but never prevents editing or rendering. This preserves the fast-iteration
   nature of template authoring while enabling governance awareness.

2. **Health indicators inform, not enforce**: The template health bar provides
   at-a-glance operational metrics. Red indicators do not block operations —
   they inform decision-making.

3. **Registry awareness**: The schema governance registry centralizes field
   metadata. Templates can reference fields not in the registry (custom fields),
   but registry recognition provides confidence in rendering behavior.

4. **Deprecation awareness, not enforcement**: Deprecated fields are flagged
   in validation but remain fully functional. Teams can migrate at their own
   pace.

### Lineage Governance Direction

1. **Best-effort ancestry**: `createdFrom` is set on duplicate but not
   guaranteed. Templates created from scratch have no lineage. This keeps the
   data model simple while providing useful traceability.

2. **Schema version association**: Each template tracks its schema version
   independently. Schema version indicates the template's compatibility with
   the current renderer, not its operational state.

3. **Rollback audit trail**: Version history (via `TemplateVersion`) provides
   point-in-time snapshots. Combined with `createdFrom`, this enables lineage
   reconstruction.

4. **Future direction**: Full lineage visualization, template derivation
   graphs, and automated migration tracking.

### Schema Governance Registry Philosophy

1. **Centralized field metadata**: The registry (`semanticFieldCatalog.ts`) is
   the single source of truth for field schema metadata. Rendering does not
   depend on the registry — it works with any `<<key>>` token.

2. **Additive metadata model**: All registry fields (deprecation, aliases,
   ownership, compatibility) are additive. No registry field is required for
   rendering. This ensures the registry can evolve without breaking existing
   templates.

3. **Resolver semantics preserved**: The centralized resolver (`resolveField`)
   does not use the registry. Registry metadata is advisory for editors and
   governance tooling.

4. **Compatibility mappings**: Equivalent keys and structured paths enable
   cross-reference between different field naming conventions. This supports
   gradual migration from legacy naming to standardized naming.

### Migration Observability Doctrine

1. **Awareness before enforcement**: Templates expose schema version,
   migration availability, and compatibility status. No auto-migration occurs.
   Users and administrators are informed but not forced to migrate.

2. **Visible readiness indicators**: The migration indicator shows current
   version, latest version, compatibility status, and available migration path.
   This enables informed decision-making about when to migrate.

3. **Non-blocking compatibility**: An incompatible schema version does not
   prevent rendering (legacy fallback always works). The indicator only informs
   — it never blocks.

4. **Future enforcement**: Once schema version v2+ introduces breaking changes,
   migration may become mandatory. The observability infrastructure built in
   this phase prepares for that future enforcement.

---

*Document Transaction Platform — Governed Template Lifecycle Phase*
*Architecture decisions recorded 2026-05-22*

---

## Assembly Doctrine

**Decision**: Document templates are composed from reusable semantic sections using
deterministic, schema-driven rules. Composition is always additive — sections are
appended to existing template content, never replacing or transforming it.

### Composition Principles

1. **Additive-only merging**: Section nodes are appended to the template's existing
   DocumentRoot children. No content is removed, replaced, or transformed. This
   guarantees that disabling section composition restores the exact original template.

2. **Referential association**: Templates reference sections by ID (`sectionIds`).
   The section content lives independently in the `sections` Firestore collection.
   Removing a section reference from the template restores original behavior with
   zero data loss.

3. **Deterministic outcomes**: The same template + same registry + same composition
   rules always produces the same composed output. No randomness, no ambient state,
   no external dependencies.

4. **Observable composition**: Every composition pass emits structured diagnostics
   showing which rules were evaluated, which matched, and why. Diagnostics never
   alter output.

### Why Not Store Section Content Inline?

- **Governance**: Sections are governed entities with independent lifecycle states,
   version tracking, and metadata. Inlining would duplicate this governance
   structure on every template.
- **Reuse**: A section definition (e.g., "Guarantor Clause") can be referenced by
   hundreds of templates. Updates propagate automatically.
- **Maintenance**: Registry-based sections support deprecation, sunsetting, and
   compatibility tracking in one place.

### Anti-patterns Avoided

- ❌ Scripting-based composition (runtime `eval`, custom DSL, embedded expressions)
- ❌ Hidden transforms (composition that modifies template content without visibility)
- ❌ Workflow-driven assembly (composition tied to approval/review state)
- ❌ Inline section duplication (copying section content into each template)

## Section Governance Philosophy

**Decision**: Section definitions are governed entities with independent lifecycle
states and compatibility metadata. They exist as first-class Firestore documents
in the `sections` collection.

### Section Lifecycle Governance

1. **Independent lifecycle**: Sections have their own lifecycle state
   (`active`/`deprecated`/`sunset`), separate from the templates that reference
   them. A section can be deprecated while templates using it remain active.

2. **Version-aware compatibility**: Each section tracks its `schemaVersion` and
   `compatibleSchemaVersions`. This enables schema evolution without breaking
   existing templates — a section at v2 can declare compatibility with v1 templates.

3. **Deprecation visibility**: Deprecated sections are flagged in composition
   diagnostics. Templates using deprecated sections continue to function, but
   administrators are informed.

4. **Deterministic seeding**: Example sections are deterministic built-in
   definitions, not AI-generated or user-inferred content. They provide starting
   points for section authoring without introducing non-determinism.

### Registry Design

- **Firestore-backed**: Sections are stored as Firestore documents in the
  `sections` collection, scoped to organisations. This reuses the existing
  Firestore infrastructure (auth, security rules, real-time updates).
- **Full CRUD**: The registry supports create, read, update, and delete operations.
  No approval workflow gates these operations (future consideration).
- **Type-based queries**: Sections are filterable by type, lifecycle state, and
  organisation. This supports governance dashboards and selective composition.

## Deterministic Composition Rationale

**Decision**: Composition rules are pure functions — no scripting, no runtime
evaluation, no hidden transforms.

### Rule Architecture

```ts
interface CompositionRule {
  id: string;                    // unique rule identifier
  sectionType: SectionType;      // which section this rule controls
  label: string;                 // human-readable name
  description: string;           // detailed behavior description
  condition: (ctx: CompositionContext) => boolean;  // pure function
  dependencies: string[];        // section types this rule depends on
}
```

### Why Pure Functions Instead of Scripts?

1. **Type safety**: Rules are TypeScript functions with typed inputs and outputs.
   No runtime type coercion, no serialization boundaries, no eval.
2. **Determinism guarantee**: Pure functions with no side effects and no ambient
   state always produce the same output for the same input.
3. **Testability**: Rules can be unit-tested with known contexts.
4. **Governance**: Rule definitions are versioned alongside the codebase. There is
   no separate script repository, migration path, or deployment concern.

### Condition Context

```ts
interface CompositionContext {
  templateKind: string;       // 'deed' | 'loan_agreement'
  placeholders: string[];     // extracted <<key>> tokens from template content
  fields: { placeholder: string }[];  // PDF field definitions
  existingSections: string[]; // section IDs already associated with template
}
```

The context is deterministic — built from the template's persisted metadata.
No ambient state (current user, time, external data) is included.

## Reusable Semantic Infrastructure Direction

**Decision**: The section system is designed for extensibility without
over-abstraction. It provides a repeatable pattern for adding new section
types, rules, and governance metadata.

### Extension Pattern

To add a new section type:

1. Add the type to `SectionType` union in `section/types.ts`
2. Create the section content as a serialized DocumentRoot (example in
   `examples.ts`)
3. Add a composition rule in `composition/rules.ts`
4. The registry, engine, and diagnostics handle the new type automatically

### What Sections Are NOT

- **Not templates**: Sections are content fragments, not full document templates.
  They lack `type`, `fileUrl`, `styles`, `fields`, and versioned storage.
- **Not standalone renderable**: Sections are composed into templates before
  rendering. They have no independent render path.
- **Not workflow-managed**: Section lifecycle is manual — no approval flows,
  no automated transitions, no enforcement gates.
- **Not AI-generated**: All example sections are hand-written, deterministic,
  and auditable. AI section generation is an explicitly excluded future concern.

## Hybrid Composition Strategy

**Decision**: Templates can embed governed sections alongside their inline content.
This is a hybrid model — templates are not converted to sections, and sections
do not replace template content.

### How It Works

1. **Template content stays canonical**: The template's `content` field remains
   the primary content. Sections are appended during composition, never merged
   destructively.
2. **Section references are metadata**: `template.sectionIds` is an optional
   array of Firestore document IDs. It is governance metadata, not content.
3. **Composition = concatentation**: The composition engine parses template
   content into a DocumentRoot, evaluates section rules, appends matched section
   nodes, and serializes the combined tree.
4. **Serialized roundtrip**: `composeToContent()` produces a single serialized
   string that includes both template content and section content. This string
   can be rendered by any existing export pipeline.

### Rollback Safety

Since sections are:
- **Referential**: Removing `sectionIds` from the template eliminates all
  composed content without data loss
- **Additive**: Section nodes appear after template content — removing them
  restores the exact original template
- **Non-destructive**: No template content is modified during composition

Rollback is:
1. Remove section IDs from template metadata
2. Save template (existing save flow, no migration needed)
3. Template renders identically to pre-composition state

### Compatibility Guarantees

- Section nodes use the same `DocumentNode` types as template nodes — no new
  rendering logic needed
- The composition engine outputs a standard `DocumentRoot` accepted by
  `serializeNodes()`, `renderNodesToText()`, and the bridge layer
- Templates without `sectionIds` are unaffected by the composition system
- The `composeToContent()` function is available but not used in the default
  render path — adoption is opt-in

---

*Document Transaction Platform — Governed Transaction Assembly Foundations Phase*
*Architecture decisions recorded 2026-05-26*

---

## Transaction Infrastructure Doctrine

**Decision**: Transaction definitions are code-defined, schema-driven entities
that govern what fields and sections are required for a given transaction type.
Deals are Firestore-backed instances that carry the transaction state.

### Transaction/Deal Separation

1. **Transaction definitions are code**: `TransactionDefinition` objects are
   defined in TypeScript alongside the composition rules. They are not stored
   in Firestore, not user-editable, and not overridable at runtime. This
   guarantees determinism — the same code version always defines the same
   set of transaction types.

2. **Deals are Firestore instances**: `Deal` objects are user-created instances
   stored in the `deals` Firestore collection. They reference a transaction
   type by string literal (`transactionType: 'secured_loan'`) and carry the
   actual deal data (financials, parties, dates, variants).

3. **Schema alignment**: Transaction types use string literal unions that
   are shared between the definition layer and the deal layer. The TypeScript
   compiler enforces consistency — a deal cannot reference a non-existent
   transaction type at compile time.

### Why Code-Defined Transactions Instead of Database?

1. **Determinism**: Code-defined transactions cannot drift from the codebase.
   If a transaction type is removed, the code won't compile, catching issues
   at build time rather than runtime.
2. **Versioning**: Transaction definitions are versioned alongside the
   composition rules, validation logic, and UI components. A database-backed
   approach would require coordinating changes across migrations.
3. **Testability**: Code-defined transactions can be unit-tested in isolation.
   No database setup, no fixture data, no async loading.
4. **Simplicity**: The current set of 5 transaction types with ~20 fields each
   is well within the maintainability threshold for TypeScript source code.

## Deal Orchestration Philosophy

**Decision**: Deals are passive data entities that composition rules consume.
There is no orchestration layer, workflow engine, or state machine.

### Deal Role

A Deal carries:
- **What** the transaction is (type, variants)
- **Who** is involved (participants with roles)
- **How much** (financial terms)
- **When** (key dates)
- **Overrides** (manual section inclusion/exclusion)

Deals do NOT control:
- When composition happens
- Which template is used
- What rendering path is taken
- Whether validation blocks operations

### Orchestration Anti-patterns Avoided

- ❌ **Workflow engine**: Deals do not have states, transitions, or automated
  actions. A deal is created, updated, and referenced — no state machine.
- ❌ **Orchestration framework**: There is no central dispatcher, saga runner,
  or event bus for deals. Components read deals directly from Firestore.
- ❌ **Process automation**: Deals do not trigger template creation, approval
  requests, or document generation automatically.

## Deterministic Transaction Assembly Rationale

**Decision**: Transaction-driven composition is deterministic — the same
template, deal, and section registry always produce the same composed output.

### How Determinism Is Maintained

1. **Transaction definitions are pure data**: No runtime evaluation, no
   conditional branching based on external state, no random selection.
2. **Deal context is pure state**: The deal's financials, dates, and variants
   are fixed values at composition time. Composition does not modify them.
3. **Rules are pure functions**: `(ctx: CompositionContext) => boolean` has
   no side effects, no I/O, no ambient dependencies.
4. **Composition is referentially transparent**: Calling
   `composeTemplateSections(template, sections, deal)` twice with the same
   arguments produces the same `CompositionResult`.

### What Transaction Context Enables

Transaction context enriches the rule conditions that already exist:
- Before: "Include repayment if templateKind is loan_agreement"
- After: "Include repayment if templateKind is loan_agreement OR transactionType is secured_loan"

This is strictly additive — rules that don't use transaction context continue
to work exactly as before. Templates without transaction associations compose
identically.

## Transaction-Driven Rendering Direction

**Decision**: Transaction definitions and deals prepare the infrastructure
for transaction-driven rendering, where field resolution can consult deal
data directly.

### Current State

- Composition uses transaction context to determine which sections to include
- Deal validation checks required fields against transaction definitions
- The `CompositionContext.calcContext` carries deal financials, dates,
  variants, and participants for rule evaluation

### Future Direction (Reserved, Not Implemented)

1. **Deal-to-resolver bridge**: The rendering pipeline (`renderNodesToText`)
   could accept deal financials as additional resolver data, enabling field
   resolution from deal context without manual mapping.
2. **Field requirement enforcement**: The validation system could flag
   template content that references fields required by the transaction but
   not present in the template.
3. **Variant-aware rendering**: Render-time decisions based on deal variants
   (e.g., "show default interest clause only if secured loan and variable
   rate").

Each future step must maintain:
- Deterministic output (same deal + template = same rendered document)
- Legacy fallback (existing templates continue to render)
- Non-blocking validation (warnings inform, never prevent)

## Constrained Orchestration Strategy

**Decision**: "Orchestration" in this context means the deterministic
coordination of composition rules with deal context. It is explicitly
constrained — no workflow engine, no state machine, no event-driven
architecture.

### What Constrained Orchestration Means

1. **Composition consumes deal context**: The engine reads deal data and
   evaluates rules. That is the full extent of orchestration.
2. **Validation observes and reports**: Deal validation reads deal + definition
   and produces warnings. No actions are taken based on validation results.
3. **UI surfaces diagnostics**: The TransactionPreview component displays
   validation results. No automated remediation occurs.

### What Constrained Orchestration Is NOT

- Not a workflow engine (no states, transitions, or automated actions)
- Not a decision engine (no branching on external data or user roles)
- Not a process manager (no multi-step sequences or sagas)
- Not a rules engine (rules are TypeScript functions, not a DSL or database)

### Why Constraint Matters

The constraint prevents the infrastructure from evolving into:
- A BPM system (approval flows, task routing, deadlines)
- A scripting platform (dynamic rule creation, runtime evaluation)
- An automation framework (auto-generation, event-driven pipelines)

These are explicitly excluded to keep the platform focused on deterministic
document composition rather than business process management.

---

*Document Transaction Platform — Transaction Definition & Deal Infrastructure Phase*
*Architecture decisions recorded 2026-05-26*

---

## Semantic Resolution Doctrine

**Decision**: Field resolution is governed by typed field definitions with
explicit sources, computed dependencies, and centralized formatting. All
resolution is deterministic and observable.

### Resolution Architecture

```
Input key ──→ FieldDefinition lookup ──→ Formatter ──→ Output value
                 │                            ↑
                 ↓                            │
           Computed field? ──yes──→ ComputedFieldFn
                 │                          │
                 no                         ↓
                 ↓                    Dependency values
           Direct lookup ───────────── from data context
                 │
                 ↓
           Unresolved ────→ key as fallback (<<key>>)
```

### Typed Field Principles

1. **Every field has a type**: `currency`, `date`, `acn`, `percentage`,
   `text`, `number`, `words`. The type determines default formatting and
   validation behavior.

2. **Every field has a source**: `direct` (from user data), `computed`
   (derived via function), `participant` (from party data), `derived`
   (from template context). Source enables provenance tracking and
   governance visibility.

3. **Definitions are code-defined**: Field definitions live in TypeScript
   source, not in a database. This guarantees:
   - Compile-time type checking across all definitions
   - Version consistency with the codebase
   - No runtime configuration drift
   - Deterministic behavior across environments

### Why Code-Defined Fields Instead of Database Schema?

Same rationale as transaction definitions: determinism, versioning,
testability, and simplicity. The current set of ~40 fields is well
within the maintainability threshold for TypeScript source.

## Computed Field Governance

**Decision**: Computed fields are explicit TypeScript functions with
declared dependencies and typed outputs. No formula language, no runtime
evaluation, no hidden data access.

### Computed Field Contract

```ts
interface ComputedFieldRegistration {
  key: string;              // output field key
  label: string;            // human-readable description
  dependencies: string[];   // explicit input field keys
  fn: (deps: Record<string, string>) => string;  // deterministic function
}
```

### Why TypeScript Functions Instead of a Formula DSL?

1. **Type safety**: Inputs and outputs are typed. The compiler catches
   mismatches at build time.
2. **Determinism guarantee**: Pure functions with declared dependencies
   cannot access ambient state, random values, or external data.
3. **No parsing overhead**: No formula parser, no runtime compilation,
   no sandboxing concerns.
4. **Testability**: Computed fields are unit-testable with known inputs.
5. **Tooling**: IDE autocomplete, refactoring, and static analysis work
   natively.

### Anti-patterns Avoided

- ❌ **Formula languages** (handwritten parsers, `eval`-based execution)
- ❌ **Spreadsheet-style expressions** (relative references, implicit ranges)
- ❌ **Runtime script loading** (dynamic code from Firestore or API)
- ❌ **Hidden data access** (computed fields reading data outside their
  declared dependencies)

## Formatting Governance Philosophy

**Decision**: Formatting is centralized in a single formatter registry.
All field output flows through `formatField(key, value)` which looks up
the field's formatter and applies it.

### Formatter Registry

```ts
const FORMATTER_REGISTRY: Record<FormatterId, Formatter>
// Formatter = (value: string) => string
```

9 registered formatters:
- `currency` — Intl.NumberFormat en-AU currency
- `date_short` / `date_long` — locale-aware date formatting
- `acn` — 9-digit ACN formatting (XXX XXX XXX)
- `percentage` — XX.XX% representation
- `words` — number-to-words conversion
- `uppercase` / `lowercase` — string case
- `none` — identity pass-through

### Why Centralized Formatting?

1. **Single source of truth**: All formatting logic is in one file. The
   `_currency` / `_words` suffix checks scattered across `placeholders.ts`
   are consolidated.
2. **Reusable**: Formatters can be used directly without going through
   placeholder resolution.
3. **Governance-aware**: The formatter registry is inspectable. Tooling
   can report which formatters exist, which are used, and what fields
   use each formatter.
4. **Deterministic**: Same input + same formatter = same output. No
   locale ambiguity, no ambient formatting state.

### Relationship to Existing Formatting

The existing `_currency` and `_words` suffix handling in
`resolvePlaceholderValueFromData` continues to work. The governed
formatter registry is additive — it does not replace, modify, or
interfere with the existing resolution path. Future phases may
migrate existing formatting to the governed registry.

## Resolver Provenance Rationale

**Decision**: Every field resolution tracks its provenance — source,
dependency chain, formatter applied, and resolution status. Provenance
is diagnostic-only and never alters output.

### Provenance Structure

```ts
interface ResolverProvenance {
  key: string;
  source: 'direct' | 'computed' | 'unresolved';
  value: string;
  resolved: boolean;
  dependencyChain: string[];
  formatterApplied: FormatterId;
  fallbackUsed: boolean;
}
```

### Why Provenance Matters

1. **Observability**: Editors and administrators can see exactly where
   each field value came from. This is critical for debugging rendering
   issues.
2. **Governance visibility**: The `ResolverDiagnostics` UI shows which
   fields are governed (have definitions) and which are ad-hoc (no
   definition).
3. **Migration safety**: When computed fields change, provenance shows
   which dependencies were used, enabling before/after comparison.
4. **Audit trail**: For compliance scenarios, provenance provides a
   record of how each value was derived.

### Provenance Is Not Performance-Critical

Provenance tracking adds a small overhead per field resolution. The
provenance path (`resolveFieldWithProvenance`) is separate from the
production render path (`resolveField` in `renderSemantics.ts`). The
existing render path is unchanged — zero overhead for production
rendering.

## Deterministic Semantic Resolution Strategy

**Decision**: The semantic resolution infrastructure is built in layers,
each layer being deterministic, observable, and rollback-safe.

### Layer Architecture

```
Layer 4: ResolverDiagnostics UI  (governance visibility)
Layer 3: Dependency validation   (non-blocking warnings)
Layer 2: Provenance tracking     (observable diagnostics)
Layer 1: Field definitions       (typed, sourced, governed)
Layer 0: Computed fields         (explicit functions, declared deps)
Base:   Existing resolvers       (unchanged: placeholders.ts, renderSemantics.ts)
```

### Determinism Guarantees

- **Layer 1-4**: Fully deterministic — same input always produces same output
- **Base layer**: Already deterministic via `resolvePlaceholderValue`
- **Cross-layer**: Adding governed resolution does not change base layer
  behavior

### Rollback Strategy

Since the new resolver is:
- **Additive**: No existing code is modified (except exports and UI imports)
- **Non-invasive**: The render pipeline is untouched
- **Diagnostic-only in UI**: The `ResolverDiagnostics` component is
  informational

Rollback is:
1. Remove `ResolverDiagnostics` from governance tab
2. Remove resolver exports from `documentEngine/index.ts`
3. Remove resolver directory

No data migration, no Firestore changes, no export changes.

---

*Document Transaction Platform — Governed Semantic Resolution Infrastructure Phase*
*Architecture decisions recorded 2026-05-26*

---

## Document Lifecycle Doctrine

**Decision**: Document lifecycle states are passive metadata labels on generated
documents. They are not workflow states, not state machine transitions, and not
operation gates.

### Lifecycle State Principles

1. **Passive labeling**: `draft`, `generated`, `issued`, `executed`, `superseded`,
   `archived` are informational labels on `DocumentGenerated`. No operation is
   blocked or changed based on lifecycle state.

2. **No state machine**: There is no transition engine, no valid transition map,
   and no enforcement of state ordering. A document can move from `draft` to
   `executed` without passing through `issued`. This is a deliberate simplification
   — state enforcement is a future concern.

3. **Document-level, not template-level**: Template lifecycle (`TemplateLifecycleState`)
   and document lifecycle (`DocumentLifecycleState`) are separate concepts with
   different state spaces. Templates govern authoring readiness; documents govern
   issuance status.

### Immutable Snapshot Philosophy

**Decision**: Render snapshots are immutable once created. They capture the
complete rendering state at a point in time and never mutate.

**Why immutability**:

1. **Audit integrity**: A snapshot is an immutable record of what was rendered,
   when, by whom, and with what data. This is critical for compliance scenarios
   where the rendered document must be reproducible after the fact.

2. **Deterministic verification**: The same snapshot always has the same content,
   same version, same provenance. This enables verifiable comparison between
   snapshots for regression detection.

3. **No write-after-freeze**: Snapshots are written once during generation. There
   is no update path, no migration path, no backfill mechanism. This prevents
   accidental mutation and keeps the data model simple.

**Snapshot versioning**: Each snapshot carries an incrementing `snapshotVersion`.
Multiple snapshots per document enable historical comparison — snapshot v1 vs v2
shows what changed between generations.

### Lineage Governance

**Decision**: Document lineage is tracked via reference fields on
`DocumentGenerated` (`supersedes`, `generatedFromId`). No graph database, no
edge collection, no specialized lineage infrastructure.

**Why references instead of a graph**:

1. **Simplicity**: Simple string fields on the document itself. No extra
   Firestore documents, no collections, no join tables.
2. **Observability**: The lineage is visible directly on the document record.
   No query needed to see what a document supersedes.
3. **Sufficient for current needs**: The current use cases (which document
   replaced this one, what was this generated from) are single-hop queries.
   Multi-hop chain resolution walks references programmatically.

**Supersession chain**: `getSupersessionChain()` walks references backwards
from the current document through `supersedes` references. This is sufficient
for audit trail and document version navigation.

### Lifecycle Diagnostics Rationale

**Decision**: Lifecycle diagnostics follow the same non-blocking, observational
pattern as all other diagnostics in the platform.

**Diagnostic categories**:
- `missing_snapshot` — Non-draft document without a render snapshot
- `stale_snapshot` — Snapshot integrity check failures
- `missing_metadata` — Missing generator identity or issuance timestamp
- `invalid_state_transition` — Informational state sequence warnings
- `lineage_gap` — Superseded documents without lineage references

All diagnostics return structured `LifecycleDiagnosticWarning` objects with type
and message. The UI displays them as collapsible warning groups.

### What Lifecycle Infrastructure Is NOT

- ❌ **Not a workflow engine**: No states, transitions, or automated actions
- ❌ **Not an approval system**: No review gates, sign-offs, or authorization
- ❌ **Not a state machine**: No transition map, no valid/invalid state graph
- ❌ **Not an event system**: No event emission, no pub/sub, no triggers
- ❌ **Not a history system**: Version history is separate (TemplateVersion)

---

*Document Transaction Platform — Governed Document Lifecycle Infrastructure Phase*
*Architecture decisions recorded 2026-05-26*

---

## Transaction Package Doctrine

**Decision**: Transaction packages are Firestore-backed grouping entities that
collect documents under a transaction. Packages are not workflow containers,
not state machines, and not orchestration engines.

### Package Principles

1. **Grouping, not orchestration**: A `TransactionPackage` groups document
   references and snapshot references under a `transactionId`. It does not
   control when documents are generated, rendered, or distributed. It is a
   passive aggregation entity.

2. **Distinct lifecycle**: Package lifecycle states (`draft`, `assembled`,
   `finalised`, `superseded`, `archived`) are separate from document lifecycle
   states (`draft`, `generated`, `issued`, `executed`). A package can be
   `finalised` while its constituent documents are in any state.

3. **Deterministic document grouping**: The same set of document IDs always
   produces the same package. Grouping is by reference — the package does not
   store document content, only document IDs and snapshot IDs.

4. **Observable state**: Package state, manifest version, and document membership
   are always readable from the package entity. No queries across collections
   are needed for basic visibility.

### Immutable Manifest Philosophy

**Decision**: Package manifests are immutable once created. They capture the
complete package state at finalisation time and never mutate.

**Why immutability**:

1. **Audit integrity**: A manifest at version N is an immutable record of what
   documents, snapshots, schema versions, and composition metadata were in the
   package when it was recorded. This is critical for compliance and dispute
   resolution.

2. **Deterministic verification**: The same manifest always has the same content.
   `verifyManifestIntegrity()` produces identical results for identical manifests.
   This enables verifiable comparisons between manifest versions.

3. **Reproducibility**: Given a manifest and the same snapshot set, the package
   can be reconstructed deterministically. This supports audit-safe reconstruction
   without requiring the original package entity to still be in its finalised
   state (e.g., after accidental mutation).

**Manifest versioning**: Each manifest carries a `version` that matches the
package's `manifestVersion`. Manifests are versioned independently per package —
version 1, 2, etc. Multiple manifests per package enable historical comparison.

### Execution Set Governance

**Decision**: Execution sets are code-defined groupings that classify what
documents belong together for a given execution purpose. They are not workflow
definitions, not approval gates, and not runtime selection scripts.

**Execution set types**:

| Type | Purpose | Required Examples |
|---|---|---|
| `signing_pack` | Execution by all parties | execution_page, signature_block |
| `settlement_pack` | Financial settlement | settlement_statement, payment_direction |
| `guarantor_execution` | Guarantor-specific | guarantee_deed, guarantor_execution_page |
| `disclosure_bundle` | Regulatory disclosure | key_facts_sheet, disclosure_statement |

**Why code-defined**:

Same rationale as transaction definitions — determinism, versioning, testability,
and simplicity. Adding a new execution set is a TypeScript change to
`executionSets.ts`.

**Transaction-to-execution-set mapping**:

`getExecutionSetsForTransactionType()` maps transaction types to required/optional
execution sets:

- All transactions require `signing_pack` and `disclosure_bundle`
- `settlement_deed` and `secured_loan` require `settlement_pack`
- `guarantor_loan` requires `guarantor_execution`

This mapping is deterministic — same transaction type always produces the same
set classification.

### Package Reconstruction Rationale

**Decision**: Package reconstruction is a deterministic read-only operation that
rebuilds package state from manifests and available snapshots. It is not a
restore operation — it does not write to Firestore.

**Reconstruction operations**:

1. **Rebuild from manifest**: `rebuildPackageFromManifest()` constructs a
   package-like object from a manifest. The result has the same document IDs,
   snapshot IDs, and version, but no Firestore identity.
2. **Snapshot recovery**: `recoverSnapshots()` compares manifest snapshot IDs
   against available snapshots and reports which are recoverable vs missing.
3. **Lineage restoration**: `restoreLineage()` scans available packages for
   superseded/archived entries and rebuilds the ancestor chain.
4. **Verification**: `verifyReconstruction()` compares reconstructed state
   against the original package and reports discrepancies.

**Why reconstruction is important for audit safety**:

Even if a package entity is accidentally deleted or corrupted, the manifest
provides a deterministic record of what the package contained. Reconstruction
uses this record to recover package metadata without requiring Firestore write
access.

### Package Integrity Validation Approach

**Decision**: Package validation follows the same non-blocking, observational
pattern as all other validation in the platform.

**Validation checks**:

| Type | Condition |
|---|---|
| `missing_snapshot` | Non-draft package without snapshot references, or document without snapshot |
| `invalid_lineage` | Superseded package without snapshot references for restoration |
| `unresolved_dependency` | Document IDs in package but not in manifest |
| `superseded_output` | (Reserved for future supersession detection) |
| `inconsistent_transaction_ref` | Finalised package without manifest, or version mismatch |

All checks produce structured `PackageValidationWarning` objects. The
`summarisePackageValidation()` function provides a one-line status summary.

### What Package Infrastructure Is NOT

- ❌ **Not a workflow engine**: No states, transitions, or automated actions
- ❌ **Not an orchestration system**: No document generation triggers, no
  distribution pipelines, no event-driven assembly
- ❌ **Not a bundling tool**: No file packaging, no ZIP creation, no attachment
  generation
- ❌ **Not a BPM system**: No approvals, no routing, no SLA tracking
- ❌ **Not a distribution system**: No email, no share links, no delivery
  tracking
- ❌ **Not a version control system**: Template versions and snapshot versions
  exist elsewhere; packages reference but do not replace them

---

*Document Transaction Platform — Governed Transaction Package Infrastructure Phase*
*Architecture decisions recorded 2026-05-26*

---

## Operational Governance Doctrine

**Decision**: Operational readiness is a deterministic, observable calculation
that informs governance visibility but never gates operations. Readiness is
not a workflow trigger, not a notification system, and not a decision engine.

### Readiness Philosophy

1. **Deterministic by construction**: Every readiness calculation is a pure
   function of its inputs. The same transaction state always produces the same
   readiness assessment. No randomness, no ambient state, no external data.

2. **Explainable by design**: Every deduction in the integrity score is
   traceable to a specific check with a fixed weight. The scoring formula is
   transparent (hard-coded constants) and auditable (source-controlled).

3. **Observable, not actionable**: Readiness assessments inform governance
   visibility. They do not trigger workflows, send notifications, or block
   operations. The GovernanceDashboard is a passive informational component.

4. **Three-dimensional assessment**: Transaction readiness, package readiness,
   and execution readiness are independent dimensions. A transaction can be
   transaction-ready but not package-ready. This enables granular governance
   visibility without conflating concerns.

### Deterministic Integrity Scoring Rationale

**Decision**: Integrity scoring uses fixed weights applied to discrete issue
counts. The formula is `score = max(0, 100 − Σ(issue_count × weight))`.

**Weight table**:

| Issue | Weight | Rationale |
|---|---|---|
| Missing required section | 30 | Highest impact — document may be legally incomplete |
| Invalid package reference | 25 | Package integrity compromised — references may be unrecoverable |
| Missing snapshot | 20 | Audit trail incomplete — document state not verifiable |
| Lineage inconsistency | 15 | Governance history incomplete — supersession chain broken |
| Unresolved field | 10 | Low impact — fallback to `<<key>>` token in output |

**Why this scoring model**:

1. **Transparency**: The weights and formula are hard-coded constants. Anyone
   can verify the calculation by reading the source code.
2. **Determinism**: Same inputs → same score. No probabilistic models, no
   hidden normalization, no dynamic weighting.
3. **Explainability**: Each point deduction is traceable to a specific issue.
   A score of 55/100 can be explained as "−30 for missing section, −10 for
   unresolved field, −5 for missing snapshot."
4. **Rollback safety**: Scoring is a pure function. Changing weights in the
   future does not retroactively change past scores (scores are computed at
   assessment time from persisted state, not stored).

**What scoring is NOT**:

- ❌ NOT AI/ML — no trained models, no probabilistic inference
- ❌ NOT predictive — does not forecast future readiness
- ❌ NOT comparative — does not rank transactions against each other
- ❌ NOT adaptive — weights do not change based on usage patterns
- ❌ NOT hidden — the full formula is in source code, not a configuration file

### Passive Governance Visibility Strategy

**Decision**: Governance visibility is always passive — it displays information
but never triggers actions, sends notifications, or blocks operations.

**Why passive**:

1. **Preserves determinism**: Passive visibility cannot alter system state.
   Readiness calculations remain pure functions.
2. **Avoids workflow creep**: Action-oriented governance (notifications,
   blocking gates, automated remediation) inevitably requires workflow engine
   infrastructure. Passive visibility does not.
3. **User autonomy**: Operators decide what to do with readiness information.
   The system informs but does not direct.
4. **Rollback simplicity**: Passive components can be added or removed without
   changing system behavior. Active components require state migration.

**Governance information flow**:

```
Transaction state → Readiness calculation → Dashboard display
                        ↓
                  Diagnostics (structured)
                        ↓
                  Reports (deterministic text)
```

No arrows lead back from the dashboard to transaction state. Readiness
visibility is a read-only projection of existing state.

### Explainable Readiness Assessment Direction

**Decision**: Readiness reports are structured text with human-readable
explanations. Each report section explains what was checked and what was
found.

**Report structure**:

```
=== Title ===
Summary: One-line status

--- Section Heading ---
Human-readable body with line-item details
```

**Why structured text**:

1. **Copy-paste ready**: Reports can be included in emails, tickets, or
   audit logs without formatting.
2. **Deterministic serialisation**: `formatReport()` produces identical text
   for identical inputs. No Markdown, no HTML, no variable-width formatting.
3. **Extensible**: New report sections can be added without changing existing
   section format. Report consumers ignore unknown sections.

**Future direction**: Readiness reports may be extended with:
- Machine-readable headers (JSON frontmatter for automated processing)
- Differential reports (what changed since last assessment)
- Historical comparison (score trend across versions)

Each extension maintains the deterministic, explainable, passive nature of
the current reports.

### What Operational Readiness Infrastructure Is NOT

- ❌ **Not a workflow engine**: No automated actions based on readiness state
- ❌ **Not a notification system**: No emails, alerts, or in-app notifications
- ❌ **Not a decision engine**: No branching on readiness thresholds
- ❌ **Not an AI system**: No probabilistic scoring, no predictions
- ❌ **Not a task system**: No work items, assignments, or tracking
- ❌ **Not a monitoring system**: No real-time observation, no alerting rules

---

*Document Transaction Platform — Governed Operational Readiness Infrastructure Phase*
*Architecture decisions recorded 2026-05-26*

---

## Externalization Doctrine

**Decision**: Externalization — the act of formally issuing a package to
recipients — is recorded as an immutable issuance record with an associated
immutable manifest. Externalization is not delivery, not messaging, and not
workflow orchestration.

### Issuance Principles

1. **Record, not action**: An `IssuanceRecord` records the intent and metadata
   of externalization. It does not perform delivery, send notifications, or
   trigger workflows. The record is the source of truth for what was issued,
   to whom, and when.

2. **Immutable issuance state**: The `issuanceState` field tracks the
   lifecycle of the issuance record itself (`pending` → `issued` → `delivered`
   → `failed` → `revoked`). This is metadata about the record, not a workflow
   transition engine. State transitions are direct field updates, not
   automated progressions.

3. **Package boundary**: Issuance is always scoped to a package. A single
   issuance issues one package to one or more recipients. Cross-package
   issuance is handled by multiple issuance records.

4. **Snapshot boundary**: Issuance snapshots (`issuedSnapshots`) are the
   specific snapshot IDs that were current at issuance time. This ensures
   the issuance always points to the rendered state that was issued, even if
   the document is later regenerated.

### Immutable Issuance Philosophy

**Decision**: Issuance manifests are immutable once created. They capture the
complete issuance state — which package, which documents, which recipients,
with which snapshot versions — at the moment of issuance.

**Why immutability**:

1. **Audit integrity**: An issuance manifest is an immutable record of what
   was externalized. For compliance scenarios, the manifest proves exactly
   what was issued, to whom, and with what content versions.

2. **Dispute resolution**: If a recipient claims they received different
   content, the manifest provides an immutable reference. The manifest + the
   referenced snapshots together provide full reproducibility.

3. **Regulatory compliance**: Many jurisdictions require proof of what was
   delivered and when. Immutable manifests satisfy this requirement without
   external escrow or third-party verification.

4. **Deterministic verification**: `verifyIssuanceManifestIntegrity()` produces
   identical results for identical manifests. No ambient state or external
   data affects verification.

### Deterministic Delivery Rationale

**Decision**: "Delivery" in this context means the issuance record's state
transition to `delivered`. The system records that delivery occurred but does
not perform the delivery itself.

**Why issuance records do NOT handle delivery**:

1. **Separation of concerns**: Delivery mechanisms (email, file sharing,
   document portal, physical mail) are external to the platform. The platform
   records issuance intent; delivery is handled by external systems.
2. **Determinism**: Delivery mechanisms are inherently non-deterministic
   (network failures, recipient unavailability, rate limits). Keeping issuance
   recording separate from delivery preserves determinism in the core platform.
3. **Auditability**: The issuance record provides an auditable trail of what
   was intended to be delivered. External delivery systems provide their own
   delivery receipts.

**Required integration pattern**: External delivery systems:
1. Read the issuance record to determine what to deliver
2. Perform delivery through their own channels
3. Update the issuance record's state to `delivered` or `failed`
4. Attach delivery metadata to the issuance record's metadata field

### Recipient Governance Strategy

**Decision**: Recipients are first-class Firestore entities with typed roles,
package associations, and issuance lineage tracking.

**Recipient entity design**:

```ts
interface Recipient {
  id: string;
  organisationId: string;
  name: string;
  email: string;
  role: RecipientRole;       // signatory | guarantor | counterparty | regulator | legal_representative
  packageIds: string[];       // associated packages
  issuanceIds: string[];      // issuance history references
  createdAt: Date;
  updatedAt: Date;
}
```

**Recipient resolution strategies**:

| Strategy | Description | Use Case |
|---|---|---|
| `by_role` | Find all recipients with a given role | Issue to all signatories |
| `by_id` | Find a specific recipient by ID | Issue to a known recipient |
| `by_package` | Find all recipients associated with a package | Issue to all parties on a deal |

**Why typed roles instead of free-text**:

1. **Governance**: Typed roles enable deterministic recipient grouping and
   validation. A regulator recipient is always resolved differently than a
   signatory recipient.
2. **Mapping determinism**: `buildRecipientMappings()` produces deterministic
   role-based mappings for manifest creation. Same recipient set → same
   mappings.
3. **Extensibility**: New roles can be added to the `RecipientRole` union
   without changing recipient resolution logic.

**Recipient lineage**: Each recipient tracks its issuance history via
`issuanceIds`. `getIssuanceLineageForRecipient()` resolves the full issuance
timeline for audit and compliance purposes.

### Audit-Safe Issuance Reconstruction

**Decision**: Issuance reconstruction follows the same pattern as package and
lifecycle reconstruction — deterministic, read-only, manifest-based.

**Reconstruction operations**:

1. **Rebuild from manifest**: `rebuildIssuanceFromManifest()` constructs an
   issuance-shaped object from a manifest. No Firestore write occurs.
2. **Snapshot recovery**: `recoverIssuanceSnapshots()` compares manifest
   snapshot IDs against available snapshots. Reports which are recoverable.
3. **Recipient lineage**: `recoverRecipientLineage()` scans manifests for
   recipient mappings associated with issuance IDs.
4. **Verification**: `verifyIssuanceReconstruction()` checks manifest integrity
   and reports reconstruction success.

**Why reconstruction is important for audit safety**:

Even if the issuance record is deleted or corrupted, the immutable manifest
provides a deterministic record of what was issued. Reconstruction uses this
manifest to recover issuance metadata without requiring Firestore write access.
This is the same pattern used by package reconstruction (Phase 9).

### What Externalization Infrastructure Is NOT

- ❌ **Not a messaging system**: No email, SMS, push notifications, or in-app
  messages
- ❌ **Not a delivery system**: No file transfer, document portal upload, or
  physical mail integration
- ❌ **Not a notification engine**: No alerts, reminders, or status notifications
- ❌ **Not a workflow system**: No automated state transitions, no approval
  gates, no escalation paths
- ❌ **Not a distribution system**: No bulk distribution, no mailing lists,
  no scheduled distribution
- ❌ **Not a signing system**: No digital signature workflows, no eSignature
  integration, no execution tracking (beyond state labels)

---

*Document Transaction Platform — Governed Externalization & Issuance Infrastructure Phase*
*Architecture decisions recorded 2026-05-26*
