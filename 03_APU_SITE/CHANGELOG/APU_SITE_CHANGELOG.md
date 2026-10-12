# APU Site — Changelog

Status: CURRENT

Records significant verified product/runtime/project changes. It is not a complete Git log. Historical Sites-era entries are retained where they remain useful; current deployment state must not be inferred from a changelog entry alone.

## 2026-10-12 — Unified F2/F3 document workspace

### Added / Changed
- Replaced separate Rozbor/Output presentation panels with one shared document area and header. The existing deterministic accepted-snapshot renderer supplies the same working-analysis sections and document markup in Build and default Výstup, including accepted components and uncertainty.
- Build shows current accepted analysis and preserves F3 configuration/render state. Output restores its adopted default or generated representation; Chat preserves whichever document is shown. Navigation alone does not generate content or accept a new source.
- Added direct baseline print/PDF/copy actions in Build and a pending-selection notice. Existing acceptance, failure/obsolete-response rejection, fingerprints, revision reuse, stale preservation and explicit F3 adoption/regeneration are unchanged.
- Reused one readable document renderer and selected-document export reference for defaults and existing generated text/tables/cards. Older generated content retained after source adoption is labelled as an earlier source instead of the new revision.
- Updated the current-design roadmap addendum and runtime documentation. Backlog, Known Issues, workflow and Core policy are unchanged.

### Verification
- Typecheck and 160 focused renderer/baseline/Build/snapshot/materialization/stale/adoption/navigation/intake/access/responsive tests passed, including all three strategies and accepted expansions.
- Actual-client Chromium fixture passed A–L with synthetic API responses: exact default DOM/style identity, one persistent workspace, no navigation calls, generated-output/configuration preservation, pending/failure/obsolete guards, new source revision, explicit adoption and independent regeneration from the snapshot. Existing tabs, Chat, developer header, resize persistence and narrow/portrait/mobile behavior passed.
- Real Clipboard copy and browser PDF checks passed for baseline and generated content; F2/F3 baseline PDF text is identical, uncertainty is retained, and controls/Chat/diagnostics are excluded. Screenshots were inspected; native print-dialog invocation was intercepted headlessly.
- Authenticated live visual verification: NOT VERIFIED — access blocked. No authentication bypass, secrets or provider-backed F1/routing evaluations were used.

### Preserved scope
- F1 extraction/grounding, need routing, internal strategies/Build operations/prompts, snapshot schemas/semantic validation and F3 materialization/source contracts are unchanged. No history library, new export service/storage, contextual document chat, PR merge or production deployment.

## 2026-10-12 — Desktop Workspace B UX refinement

### Added / Changed
- Ordered the left tools Chat / Build / Výstup as connected tab cards with explicit selected/focus states; F2 still defaults to Build/Rozbor and F3 to Výstup/document.
- Moved the unchanged explicit Build create/update action into an internal footer; the central divider is solely a resize handle. Compact Build controls and scrollable F3 settings retain reachable generation/export actions.
- Added a floating Chat scroll-to-bottom arrow and hid the persistent desktop processing scrollbar. Native scrolling, bottom anchoring, older-message reading, shared history, interactive F2 Chat and read-only F3 Chat are preserved.
- Consolidated developer header usage/cost/model/runtime information behind one dollar icon while preserving the beaker/scenario entry. Removed the warning/notes UI and its page payload; existing telemetry/pricing/backend storage is unchanged.
- Updated the technical-current workspace section. No roadmap, backlog or Known Issues changes.

### Verification
- Typecheck and 132 focused UI/layout/Build/baseline/snapshot/F3-navigation/access/usage/notes-removal tests passed.
- Actual-client Chromium smoke with synthetic responses passed cases A–J, including native tab traversal, Build loading/error/retry, scroll arrow/PageUp/wheel/reader anchoring, default and generated document preservation, accepted-source adoption/regeneration, developer popups and role parity, pointer/keyboard resize persistence, narrow desktop/portrait/mobile checks, real text copying and document-only PDF. Screenshots were inspected; native print-dialog invocation was intercepted headlessly.
- Authenticated live visual verification: NOT VERIFIED — access blocked; no Access bypass, secrets or provider-backed F1 evaluations were used.

### Preserved scope
- F1 extraction/grounding, need routing, Build operations and analytical prompts, snapshot readiness/schema and F3 source/materialization/export logic are unchanged. No contextual document chat, new telemetry backend/pricing, persistent case storage, PR merge or production deployment.

## 2026-10-12 — Two desktop workspaces

### Added / Changed
- F1 now composes existing Chat/composer left and Zápisník right; F2/F3 shares a left Build/Výstup/Chat tool container and a single right Rozbor/Output document.
- Tool and document selection are independent. Opening Chat preserves the displayed document, Build settings, conversation and accepted F3 content without a model call; explicit F2/F3 navigation and source adoption remain supported.
- Moved the existing single F3 controls group to the desktop left panel through a portal, preserving document-only print/PDF/copy and one authoritative F3 state.
- F2 Chat remains interactive; F3 exposes the same history with disabled message actions and a read-only notice instead of an unsupported composer.
- Fresh split defaults to 30/70 using the shared splitter and content-width clamping; explicit stored preferences, drag/keyboard resizing and mobile/portrait overlays are preserved.
- Updated current UX/runtime documentation and added future B-06 Contextual Document Chat, explicitly NOT IMPLEMENTED.

### Verification
- Typecheck and 162 focused layout, intake/navigation, Build, F3 baseline/output, snapshot/stale-state and responsive-contract tests passed.
- Actual-client Chromium fixture with mocked responses passed cases A–J, supported F2 Chat, both roles, tool/document continuity, accepted-source adoption, drag/keyboard persistence, narrow desktop/portrait and document-only PDF checks. Native print invocation was intercepted headlessly; no live provider evaluations were run.
- Full authenticated visual verification: NOT VERIFIED — access blocked. No authentication bypass was enabled.

### Preserved scope / observed issue
- Frozen F1, semantic routing, Build operations/prompts, snapshot validity/schema and F3 materialization/export contracts are unchanged. No new storage, PR merge or production deployment.
- Confirmed pre-existing omission of source-less manual records from compact requests is documented as KI-02; its correction is outside this layout batch.

## 2026-10-12 — F2 baseline as default F3 working analysis

### Added / Changed
- A successful nonempty F2 entry now supplies a valid minimum immutable F2→F3 snapshot with zero optional components, depth zero and all optional operations disabled. Existing analytical context and uncertainty are preserved without a second analysis pipeline.
- F3 initially presents the accepted Rozbor as a deterministic working pedagogical analysis with no additional model request or automatic navigation. Existing supported model-rendered formats each consume the accepted F2 snapshot directly, never another F3 representation.
- Separated generic working-analysis readiness from specialized observation/intervention materialization guards, enforced in both the client and server.
- Pending or failed optional Build work preserves the last accepted source. Successful content changes advance its revision; source staleness, explicit adoption, previous-output preservation and explicit regeneration remain supported.
- Added client-side readable-output printing/browser PDF saving and Clipboard text copy, including stale warnings. Print isolation excludes application controls and diagnostics; no external document service or storage was added.
- Updated the roadmap with a current-design addendum preserving historical sprint content, and documented the implemented runtime contract.

### Verification
- Typecheck and 163 focused automated tests passed, including baseline/export for all strategies, scenarios A–F, expanded Build/snapshots, independent F3 source ownership, navigation, normal/developer parity, routing regressions and export boundaries.
- Isolated F3 Chromium smoke passed rendering, real clipboard copy, print invocation/isolation/cleanup, PDF source-content preservation and narrow viewport. Native print-dialog invocation was intercepted headlessly; PDF was checked through Chromium's print pipeline.
- Authenticated full-application visual verification: NOT VERIFIED — access blocked. No authentication bypass or live F1 evaluations were performed.

### Preserved scope
- F1 C3C5F, need routing, existing strategy prompts/operations and standard F3 pedagogical boundaries are unchanged.
- B-01 Session JSON work, backlog and known-issues files are unchanged. No DOCX, persistent user storage, PR merge or production deployment.

## 2026-10-12 — Need-driven single-path F2 Build

### Added / Changed
- Added a separately bounded semantic F1→F2 routing request for the active canonical need: Terra low returns one validated existing F2 strategy by primary pedagogical outcome, or one brief clarification question before any active Build is created. Legacy keyword mapping and developer scenario path metadata do not assign the runtime strategy.
- Reuse in-flight and accepted routing decisions for unchanged needs in client-session memory; routing uses the existing authenticated, `store: false` model boundary and canonical usage/cost ledger. No server-side storage was added.
- Normal and developer modes share one Build operation set for the assigned strategy. Removed path selectors, obsolete switching callbacks/helper and the internal path heading; preserved operation descriptions, depth controls, selected states and explicit generation/update actions. Developer scenarios remain test input, grouped by difficulty.
- Bound component generation, Build requests and F2→F3 snapshots to the assigned need strategy. Active-need changes hide incompatible Build state, reset current Rozbor and mark previous Output stale while preserving explicit adoption/regeneration.

### Verification
- Typecheck passed; 177 focused routing, API/contract, rendered Build/control, current-Rozbor, F1 boundary, F2→F3/F3 navigation/finalization, authentication and usage tests passed.
- All nine development need texts and five mixed-goal counterexamples pass mocked provider/contract fixtures; these checks do not establish live-model semantic accuracy. No live model calls or F1 stability experiments were performed.
- Rendered component and source-boundary tests confirm normal/developer parity and absence of route-switching controls.
- Authenticated application visual smoke: NOT VERIFIED — access blocked in Codex Cloud; no authentication bypass was enabled.

### Preserved scope
- Frozen C3C5F extraction/grounding prompts, schemas, models, rescue and Gold are unchanged. Existing strategy prompts, component content contracts and F3 materialization semantics are preserved.
- No new operations, hybrid Build, sequential runs, durable storage, merge or production deployment.

## 2026-10-08 — Milestone 2 direct current-Rozbor → F3 Output

### Added / Changed
- Connected POCHOPIT, POZOROVAT and VYTVOŘIT directly from the current Rozbor to a minimal structured F3 Output through an immutable validated snapshot; legacy PREVIEW is no longer required by the primary pipeline.
- F3 now materializes the accepted F2 substance without re-deciding it, including the requirement that VYTVOŘIT provide an explicit working approach before materialization.
- Source changes mark Output stale while preserving the previous valid Output; adopting the current Rozbor and regenerating remain explicit, and stale in-flight responses cannot replace current state.

### Verification
- Human Gate #2 passed on the Cloudflare branch preview for all three F2 paths, stale-source detection, previous-Output preservation, explicit adoption and explicit regeneration.

### Preserved scope
- APU Session JSON still exports `output: null`; B-01 remains open only for that export integration.
- No production deployment was performed.

## 2026-10-08 — Shared current-Rozbor F2 core for all three paths

### Added / Changed
- Generalized the component-based current-Rozbor mechanism from POCHOPIT into one path-aware F2 core for POCHOPIT, POZOROVAT and VYTVOŘIT.
- Preserved explicit generation/update, stable component identities and fingerprints, selective regeneration, atomic updates, stale-response rejection, retryability and separation from canonical Zápisník facts.
- Added POZOROVAT components for discriminative condition contrasts, observable indicators, hypothesis-linked support/weakening signals and observation priorities.
- Added VYTVOŘIT components for candidate approaches, one explicit working/recommended approach, practical objective, success conditions and follow-up verification.
- Updated the F2 workspace so all three paths are selectable in the current Build/Rozbor interaction model while legacy Preview/F3 contracts remain isolated for the next milestone.
- Expanded the developer test picker to nine Human Gate scenarios arranged as POCHOPIT / POZOROVAT / VYTVOŘIT × difficulty 1–3 with VLNA / BOUŘE / TSUNAMI coverage.

### Verification
- Focused F2 tests: 57/57 passed before Human Gate.
- Typecheck passed.
- Production build and standalone Worker artifact validation passed.
- Human Gate #1 passed for the three-path F2 core and developer test harness.
- One unrelated pre-existing full-suite mismatch remains in `tests/shared-feedback.test.mjs`; it is outside this milestone and was not introduced by these changes.

### Preserved scope
- The F2→F3 contract migration remains pending; F3 still uses the legacy Preview-bound handoff.
- No durable persistence, new context data model, attachment/integration work or production deployment was added.

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
