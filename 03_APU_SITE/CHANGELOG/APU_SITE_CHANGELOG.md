# APU Site — Changelog

Status: CURRENT

Records significant verified product/runtime/project changes. It is not a complete Git log. Historical Sites-era entries are retained where they remain useful; current deployment state must not be inferred from a changelog entry alone.

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
