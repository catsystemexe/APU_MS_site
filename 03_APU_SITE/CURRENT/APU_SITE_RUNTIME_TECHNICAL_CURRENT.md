# APU Site — Runtime & Technical Current

Status: CURRENT SOURCE/RUNTIME CONTRACT

Purpose: describe the current repository/runtime contract. Deployment state is recorded only when independently verified; this document must not infer production state from repository contents alone.

## Repository baseline
- Canonical repository: `catsystemexe/APU_MS_site`.
- Stable branch: `main`.
- Active F1→F3 development branch: `codex/f1-f3-mvp-stabilization` (PR #60).
- Application identity: APU Site 0.1 / package name `apu-site-01`.
- Node requirement: `>=22.13.0`.
- Current stack: Next.js App Router + Vinext + Vite targeting a standalone Cloudflare Worker.

## Canonical commands
- `npm run install:ci` — bounded lockfile installation for CI-style environments.
- `npm run dev` — Vite/Vinext development server.
- `npm run dev:local` — explicit local development entrypoint.
- `npm run build` — build and validate the deployable standalone Worker artifact.
- `npm run validate:artifact` — validate an existing Worker artifact.
- `npm run typecheck` — TypeScript check without emit.
- `npm run lint` — repository lint command.
- `npm test` — build plus automated test suite.
- `npm run deploy` — deploy an already-built verified Worker artifact with Wrangler while preserving dashboard-managed values.

## Build / deploy contract
- Build output is produced under `dist/server` and `dist/client` according to the repository build pipeline.
- Repository verification must not imply deployment.
- Production deployment is a distinct operation and is not authorized merely because build/tests pass.
- Cloudflare is the hosted runtime/deployment platform; repository code owns the deployment contract while Cloudflare owns hosted runtime values.

## Authentication and access
- Cloudflare Access is the intended hosted authentication gate for the Worker.
- OpenAI-backed API requests additionally validate the Cloudflare Access JWT as defense in depth.
- Developer/tester behavior is derived from authenticated identity and configured developer allowlist rules.
- Local development may use an explicit development-only auth bypass; that bypass must never be enabled in hosted environments.

## Runtime configuration
Server/runtime configuration includes names such as:
- `OPENAI_API_KEY` — secret.
- `APU_VECTOR_STORE_ID` — secret.
- `CF_ACCESS_TEAM_DOMAIN` — Access configuration.
- `CF_ACCESS_AUD` — Access audience.
- `APU_DEVELOPER_EMAILS` — developer allowlist configuration.
- `GOOGLE_DRIVE_CLIENT_ID` — optional public Google OAuth client identifier where relevant.

Secret values must never be committed, logged, pasted into implementation prompts, or copied into project documentation. Hosted values remain managed by Cloudflare; local secret files remain local and Git-ignored.

## Product/runtime boundaries
- Pedagogical policy is owned by versioned APU Core.
- Technical context composition/routing belongs to the application runtime.
- F1/F2/F3 boundaries and `Zápisník → Rozbor → Výstup` data ownership remain invariant across hosting changes.
- Model/KB routing is runtime policy and must not silently change canonical data ownership.

## F2 baseline, accepted snapshots and F3 representations

Implemented and verified in the development branch on 2026-10-12; production deployment was not performed by this batch and production parity is not asserted.

- Successful F2 entry establishes the minimum Rozbor using the existing authoritative working hypotheses and analytical context. Default Build remains `expansionDepth = 0` with all optional operations disabled. No optional component is generated automatically; empty/malformed analysis cannot establish a baseline source.
- The immutable `F2ToF3Snapshot` accepts a completed zero-component baseline and preserves existing expanded-component reconciliation and content validation. Snapshots retain canonical need, hypotheses, accepted configuration/components, limitations, identity, fingerprint and revision. The added analytical context retains existing summary, main uncertainty, active need analysis and canonical notebook text; it is a copy of the existing source, not a second analytical pipeline.
- Snapshot readiness for working-analysis export is separate from specialized materialization readiness. POZOROVAT still requires an accepted observation component for specialized rendering; VYTVOŘIT still requires an explicit accepted working approach. These checks apply in the client and independently at `/api/f3` before a model call. Baseline working-analysis export requires neither specialized decision.
- The client retains the last accepted source snapshot separately from draft Build selections. Selection changes, pending component generation and failed optional generation do not accept draft content or invalidate that snapshot. Successful content updates and explicit removals advance its source revision; unchanged substance reuses its snapshot. Authoritative notebook/need/analysis changes invalidate source currency, and in-flight component responses also check the analytical context before acceptance.
- Default F3 selection is the locally rendered **Pracovní pedagogická analýza**, immediately available after baseline acceptance without navigation or an additional model request. Deterministic rendering preserves source hypotheses, evidence-related information, questions, context, generated components where present, and uncertainty. It does not claim to complete a specialized intervention or observation specification.
- Existing optional model-based F3 formats retain their established substance restrictions. Every request includes the accepted immutable F2 snapshot and presentation settings only; previously generated F3 content is never its substantive input. Presentation-setting changes do not mutate F2.
- Source changes preserve previous F3 content as stale. New source adoption remains explicit; adoption selects the new working-analysis view while keeping the previous model-rendered content stale for reference. Regeneration remains explicit and uses the newly accepted source.
- Normal and developer accounts share the same presentation, source adoption, rendering and export UI; ordinary F3 headings do not expose internal strategy IDs.
- **Tisk / Uložit jako PDF** calls the browser print mechanism with a temporary readable-output DOM clone and print CSS that excludes all application siblings. The browser handles PDF saving. **Kopírovat text** writes readable content through the Clipboard API and reports failures; stale exports retain a warning. Neither export invokes a model, changes the accepted source, uploads a document or adds persistence.
- B-01 Session JSON export remains separate and unchanged; Session JSON still does not export this F3 representation.

Verification: TypeScript passed and 163 focused baseline/Build, snapshot, source ownership/finalization, navigation, routing/UI and export tests passed. An isolated F3 component passed Chromium rendering, real clipboard copy, print isolation/cleanup, PDF content and narrow-viewport checks. The headless smoke intercepts native-dialog invocation and uses Chromium's PDF print pipeline; it does not verify a human print dialog or a physical printer. Authenticated full-application visual smoke is **NOT VERIFIED — access blocked**; no auth bypass was enabled. Production deployment state remains independently verified only.

## Two desktop workspaces and navigation

Implemented/verified in PR #60 on 2026-10-12; this batch did not merge or deploy production.

- The existing desktop breakpoint is shared: `(min-width: 1024px), (min-width: 768px) and (orientation: landscape)`. F1 opens with the existing Chat/composer on the left and Zápisník on the right. Source navigation remains bidirectional.
- Processing F2/F3 uses one left tool container ordered **Chat / Build / Výstup** visually and in native Tab traversal, and one right document container. Connected tab cards join the selected tool to the sheet below, retain `aria-pressed` button semantics and show a focus-visible outline. A small UI-only state records tool and document independently. Chat selection preserves the current document; Build selects Rozbor and the supported F2 phase, while Výstup selects the accepted F3 view through existing explicit phase navigation. Tool selection does not generate content or reset conversation, Build settings or F3 state.
- Successful F2 entry selects Build/Rozbor. Explicit F3 entry selects Výstup controls/document; returning restores Build/Rozbor without deleting F3. A previously accepted F3 source remains viewable while newer F2 content is pending; source adoption/staleness/regeneration rules are unchanged.
- F3's existing component renders its single controls group into the left container through a React portal on desktop. The single readable document and its print reference stay on the right. Both controls and document use the same authoritative F3 state. Representation/presentation settings, generation, adoption, errors/status and print/copy remain available; there is no duplicate form or document source.
- Build's explicit create/update action and error/loading states live in an internal bottom footer; its enable/disable guard and Czech labels are unchanged. The divider is solely the shared resize handle. Compact operation spacing and a scrollable operations area keep the action visible; F3 similarly scrolls its settings internally while generation and document-export actions remain in its bottom footer. Mobile/portrait keeps its combined controls/document composition.
- The same Chat history/session is reused. Supported F2 Chat retains its established requests and analysis updates. Desktop Workspace B hides the persistent Chat scrollbar while preserving native scrolling and a keyboard-focusable message region. A floating circular down arrow appears when more than 48 px from the latest messages, scrolls to the end (respecting reduced motion), and disappears near the bottom. Content growth follows the bottom only when already anchored there; reading older messages and switching tools preserves the scroll position. Sending a supported message restores bottom anchoring. F3 shows history only: the composer is replaced by a read-only notice, message form controls are disabled, and new submissions are rejected before extraction/model requests. Contextual passage discussion and conversation-to-document editing are not implemented; see B-06.
- The existing `apu.desktopSplit` preference and splitter are shared by both workspaces. Fresh/invalid preferences use 30%; every valid saved ratio, including legacy 60%, is preserved because earlier versions saved this key only after explicit resize/reset actions. Width is clamped using the card's available content width to maintain the existing 420 px left/300 px right minimums. Drag, arrow-key resizing, Home and double-click reset, persistence and resize observation remain supported.
- Mobile/portrait retains existing overlay navigation and a combined F3 controls/document view; scoped padding reserves space for the existing floating navigation rail beside F3 controls. Desktop proportions are not forced onto narrow screens. Normal and developer roles share the core composition; diagnostics remain separate and provide no strategy selector.
- Developer header controls retain the beaker/scenario picker and use one compact dollar icon for canonical token/cost totals, the existing model chooser/status and read-only last-turn timings/stages from session telemetry. No telemetry backend or pricing logic was added. Both header popups stay above the document. The warning/notes trigger, DEV LOG surface and page feedback payload were removed; existing repository entries/API/KV infrastructure remains separate and unchanged. The model/profile/design settings drawer remains available.
- Print still targets only the readable document; neither the tool panel nor Chat is exported.

Verification: typecheck and 162 focused layout/intake/Build/F3/snapshot/stale-state tests passed. The optional `node tests/desktop-workspace-browser.mjs` smoke mounts the actual client with synthetic API responses and requires Chromium (or `CHROMIUM_PATH`), with loopback listen access. It verified cases A–J, F2 Chat requests, role parity, pending/accepted source transitions, drag/keyboard persistence, responsive views and document-only PDF output. Native print-dialog invocation is intercepted headlessly. Full authenticated visual inspection remains **NOT VERIFIED — access blocked**; no Cloudflare Access bypass or provider-backed F1 evaluation was used. A pre-existing manual-record serialization defect discovered while setting up synthetic input is recorded as KI-02, with no F1 code changes in this batch.

Desktop UX refinement verification (2026-10-12): typecheck, 131 focused desktop/Build/baseline/F3/navigation/access/usage regressions and the focused notes-removal test passed (132 total). The actual-client Chromium fixture verifies connected tab order and native keyboard traversal, unchanged default tools, internal Build action/loading/error/retry, document/source preservation and no tool-switch requests, scroll affordance/reader anchoring/PageUp/wheel, developer popups, pointer/keyboard split persistence, visible actions at 800×600, portrait/mobile compatibility, real Clipboard copy and document-only browser PDF. Screenshots were inspected. Native print-dialog invocation is intercepted headlessly; an authenticated full-application visual check is **NOT VERIFIED — access blocked**. This verification does not assert production deployment.

## State / persistence
- User/session persistence must be documented according to verified implementation, not historical Sites assumptions.
- DEV LOG content is repository-backed; mutable DEV LOG overrides use the configured Cloudflare KV binding where deployed/configured.
- Preview and production runtime persistence/configuration are environment-specific and must be verified separately.

## DEV LOG
- Canonical feedback entries live under `data/dev-log/entries/*.md`.
- Cloudflare KV binding `DEV_LOG_STATE` stores mutable per-item overrides such as status, note, updatedAt and updatedBy.
- Missing or invalid overrides fall back safely to repository-backed values.
- Preview and production may use separate KV namespaces.

## Verification policy
- Use the minimum verification level required by the implementation batch.
- Available checks include typecheck, lint, build/artifact validation and tests.
- UI/layout/interaction work should include rendered visual verification when materially necessary and available.
- Successful repository checks are evidence of implementation verification, not evidence of production deployment.

## Deployment status
Do not encode a fixed “currently deployed” or “not deployed” statement here unless it has been verified against current Cloudflare state. Completion reports and changelog entries must distinguish implemented, verified, locally smoke-tested, tagged and deployed states.

## Documentation source model
- GitHub is canonical for code and project documentation.
- Google Drive is outside the mandatory development synchronization chain; it may remain archival or ad hoc but is not required by Codex for normal implementation.
- ChatGPT Project Sources are runtime copies of selected workflow documents and must be refreshed when those governing documents change.
