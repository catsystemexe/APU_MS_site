# APU Site — Changelog

Status: CURRENT

Records significant verified product/runtime/project changes. It is not a complete Git log. Historical Sites-era entries are retained where they remain useful; current deployment state must not be inferred from a changelog entry alone.

## 2026-08-26 — Canonical model cost accounting

### Changed
- Unified canonical model cost accounting on the call-level usage ledger; legacy diagnostics now delegate to that pricing implementation instead of owning independent rates.

### Preserved scope
- Model routing and the number of model calls are unchanged, and no production deployment was performed.

## 2026-08-25 — Component-based F2 POCHOPIT Rozbor

### Added / Changed
- Replaced the visible POCHOPIT F2 editor with a desktop `Build | Rozbor` working shell while preserving chat access, composer ownership and resizable split behavior.
- Added the three verified POCHOPIT Build operations: hypothesis expansion with three analytical depths, cross-hypothesis comparison/connection, and expert/theoretical framing.
- Added deterministic generated Rozbor components with direct-input fingerprints: local `hypothesis:<id>:expansion` plus global `comparison:all` and `expert-frame:all`.
- Added strict component-specific `/api/f2` generation and explicit `VYTVOŘIT ROZBOR` / incremental `AKTUALIZOVAT ROZBOR` orchestration.
- Selective updates preserve unchanged components, perform pure removals without model calls, apply mixed updates atomically, preserve the previous complete Rozbor on failure, and reject stale in-flight responses.
- Generated Markdown is rendered safely as presentation-only React content; original generated source strings remain unchanged and raw HTML is not executed.
- Obsolete legacy F2 source-shape tests were replaced with regression checks for the approved component-based architecture.

### Verification
- Focused F2/Markdown suites passed.
- Full `npm test`: 240 passed, 0 failed.
- Typecheck and build passed; changed F2 files introduced no lint regression. Repository-wide lint remains blocked only by the unrelated pre-existing `app/dev-log-panel.tsx` hook error and unrelated warnings.
- Authenticated local live/visual smoke passed, including Markdown rendering, resize, Build↔chat state retention, composer operation, selective depth updates, removals and duplicate-block checks.

### Preserved scope
- POZOROVAT and VYTVOŘIT redesign were not included.
- The immediate F2→F3 source-contract migration from legacy Preview snapshot to current Rozbor was not included.
- Persistence/session export was not expanded.
- No production deployment, Cloudflare change or production tag was performed.

## 2026-08-24 — F2 entry-hypothesis synchronization repair

### Fixed
- Analysis hypotheses that complete after F2 build initialization now populate or refresh the shared entry hypothesis layer while the build remains unprocessed.
- Once F2 accepts model-processed hypotheses, later legacy analysis refreshes no longer overwrite that newer analytical state.

### Preserved scope
- Canonical F1 invalidation, processed-result and snapshot identities, explicit model-call boundaries, the existing accordion UI and production deployment remain unchanged.

## 2026-08-24 — F2/F3 execution contract and response integrity repair

### Fixed
- All three F2 paths now execute their complete base semantic task with zero selected optional skills; selected skills and their parameters remain additive and path-isolated.
- Parsed F2 build, PREVIEW and F3 model responses now cross local runtime validation boundaries in addition to the strict provider schemas.
- Malformed regeneration results are rejected atomically, preserving the last successful processed build, PREVIEW or F3 render and their lifecycle identities.

### Preserved scope
- Canonical F1 invalidation, immutable PREVIEW/F3 binding and the single PREVIEW-bound transition remain unchanged; session telemetry expansion was deferred and no production deployment was performed.

## 2026-08-24 — Single PREVIEW-bound F2 to F3 transition

### Fixed
- F2 chat/navigation output intent is now resolved locally: without an accepted PREVIEW it focuses the explicit PREVIEW workflow, while with one it opens F3 bound to that immutable snapshot without making a model call.
- The legacy controller can no longer advance directly from F2 to output, and the general chat API defensively rejects output-phase or unresolved F2-to-output generation requests.
- Explicit PREVIEW generation and explicit F3 final rendering remain the only model-backed boundaries for their respective operations.

### Preserved scope
- F1/F2 conversational compatibility fields and Repair A processed/snapshot identities remain unchanged, and no production deployment was performed.

## 2026-08-24 — Canonical F1 lifecycle and snapshot identity repair

### Fixed
- Same-ID changes to canonical pedagogical-need text, mapped initial path or F3 target now invalidate the copied F2 build and processed state without triggering automatic model work; an existing PREVIEW remains visible but stale.
- Accepted F2 processing results and PREVIEW snapshots now carry independent identities, allowing F3 to detect and explicitly adopt a newer substantive snapshot even when the local build configuration revision is unchanged.
- Explicit F3 adoption preserves local finalization settings and the prior final render as stale without regenerating it.

### Preserved scope
- F2 skills, prompts and legacy phase-navigation behavior are unchanged, and no production deployment was performed.

## 2026-08-24 — Minimum viable F3 finalization layer

### Added
- Výstup now enters F3 explicitly from an immutable accepted F2 PREVIEW snapshot and remains bound to it until explicit adoption of a newer preview.
- Local audience, language/detail and text/table/card controls feed one explicit path-aware final render request; current output is preserved and marked stale after configuration or source changes.
- The F3 model/schema boundary prohibits substantive F2 changes, returns a distinct boundary issue when materialization would require invented reasoning, and provides an explicit return to Rozbor.

### Preserved scope
- Rich document editing, arbitrary templates, multiple output versions, PDF/export generation and production deployment remain outside this batch.

## 2026-08-24 — Model-driven F2 POZOROVAT and VYTVOŘIT paths

### Added
- One path-aware F2 execution and preview contract now serves `POCHOPIT`, `POZOROVAT` and `VYTVOŘIT`, with explicit active-path routing, typed path results, shared dynamic hypotheses and normalized path-relative uncertainty.
- `POZOROVAT` produces an evidence-gathering specification that separates observable indicators from interpretation, relates contrasts and recording choices to hypotheses, and stops before final observation-sheet materialization.
- `VYTVOŘIT` separates the pedagogical objective from the F3 artifact target, supports conditional approaches, comparisons, conditions and validation criteria, and localizes weak-context limitations without false precision or final artifact generation.
- Immutable revision-bound preview snapshots and explicit model rendering now work for all paths; path switching and local edits remain call-free and preserve stale previews and path-specific configuration.

### Preserved scope
- Full F3 artifact construction remains unimplemented, and no production deployment was performed.

## 2026-08-24 — Model-driven F2 POCHOPIT vertical slice

### Added
- `POCHOPIT` now consumes the authoritative F2 build through an explicit, single structured model execution for the active composable skills, parameters and added context.
- Dynamic shared hypotheses, structured analytical content and non-blocking missing-information limitations are reconciled into a processed build revision without rewriting canonical Zápisník data.
- PREVIEW now freezes an accepted build revision and model-renders only that snapshot; stale and failed-refresh behavior preserves the previous successful preview.

### Preserved scope
- `POZOROVAT` and `VYTVOŘIT` remain local interaction-shell prototypes, and F3 remains unimplemented.

## 2026-08-24 — Stateful F2 build-editor prototype

### Added
- Rozbor now initializes a local build from the canonical F1 need mapping and exposes switchable `POCHOPIT`, `POZOROVAT` and `VYTVOŘIT` paths with five optional parameterizable layers each.
- F2 working context, shared hypotheses and informational uncertainty feed an explicit deterministic PREVIEW snapshot on the Výstup surface.
- Build revisions keep an existing preview visible while marking it stale until explicitly refreshed; local build interactions make no model requests.

### Not implemented
- Model-driven skill execution and real pedagogical preview rendering remain outside this prototype.

## 2026-08-24 — Canonical pedagogical-need routing contract

### Added
- F1 Zápisník pedagogical needs now persist an initial `POCHOPIT`, `POZOROVAT` or `VYTVOŘIT` path independently from an optional concrete F3 target.
- The F1 → F2 boundary carries the canonical need reference, text and mapping; legacy Zápisník state migrates safely without fabricating an F3 target.

## 2026-08-23 — GitHub/Cloudflare development baseline

### Changed
- APU development is centered on `catsystemexe/APU_MS_site`; `main` is stable and `next` is active development.
- Standalone Cloudflare Worker build/deploy contract is repository-defined using the current Next.js/Vinext/Vite/Wrangler toolchain.
- Cloudflare Access is the hosted access architecture, with developer/tester role separation in the application.
- DEV LOG uses repository-backed Markdown entries with Cloudflare KV for mutable per-item state.
- Canonical project documentation `01–05` is migrated into the GitHub repository; Google Drive leaves the mandatory development synchronization chain.

## 2026-08-17 — v76

### Fixed
- F1 Main prose no longer duplicates structured MAIN, SIDE or NAV questions; the structured-question UI remains authoritative for Quest Controller questions.

## 2026-08-17 — v75

### Fixed
- F2 chat renders the priority question once from `chatUpdate.nextPrompt`; branch questions remain in the Rozbor card.

## 2026-08-17 — v74

### Changed
- Initial Rozbor uses a light F2 Entry contract; detail develops selectively in Working mode and `transitionReady` is not a hard gate to F3.

## 2026-08-16 — v72–v73

### Changed
- Unambiguous F1 intake turns may use the deterministic controller path when applicable.
