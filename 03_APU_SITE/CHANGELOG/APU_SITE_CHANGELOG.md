# APU Site — Changelog

Status: CURRENT

Records significant verified product/runtime/project changes. It is not a complete Git log. Historical Sites-era entries are retained where they remain useful; current deployment state must not be inferred from a changelog entry alone.

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
- Extraction preserves semantically distinct explicit observations while still deduplicating true duplicates.

## 2026-08-16 — v67–v69

### Added
- APU Session JSON with structured session state and per-request telemetry replaced the main UI HTML export path.

### Fixed
- Telemetry separated end-to-end latency, model TTFT, preflight and perceived F2 latency more consistently.

## 2026-08-15 — v63–v66

### Added / Changed
- F2 gained a shared structured `AnalysisState`, stable IDs, targeted updates, skipped-question state and separate unread metadata.
- Rozbor UI moved toward a flatter full-width accordion presentation.

## 2026-08-15 — v60–v62

### Changed / Fixed
- APU adopted the versioned Core/runtime-wrapper split and the MAIN/SIDE/NAV intake policy with explicit phase transitions.

## Earlier history
Older implementation detail remains in historical checkpoints and archived project documentation under `04_HISTORY/`; this live changelog does not attempt to reconstruct every pre-v60 change.
