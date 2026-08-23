# APU Site — Changelog

Status: CURRENT

Records significant verified product/runtime/project changes. It is not a complete Git log. Historical Sites-era entries are retained where they remain useful; current deployment state must not be inferred from a changelog entry alone.

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
