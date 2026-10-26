# APU Site — Backlog

Status: CURRENT

Contains only unfinished or explicitly undecided work. Completed work belongs in the Changelog; confirmed defects belong in Known Issues. Ordering is not product priority.

## ACTIVE

### B-01 — Structured F3 Output — Session JSON completion
- Include the real F3 Output state in APU Session JSON instead of exporting `output: null`.
- Add focused export validation/regression coverage for the resulting Output payload.

### B-02 — Durable project Save/Open
- Add durable project persistence beyond browser-local state.
- Define Save/Open, project lifecycle, multi-project history and cross-device recovery without violating canonical data ownership.

### B-03 — Working-layer history/versioning
- Decide and implement user-facing snapshots/revisions for Zápisník, Rozbor and Výstup if required.
- Keep diagnostic Session JSON distinct from a versioning system.

### B-04 — Attachments and external integrations
- Decide supported attachment types, limits and security model before activating attachment UI.
- Decide whether Google Drive, Gmail or other product integrations are required and in what order.

### B-05 — Authenticated hosted E2E regression path
- Establish a repeatable authenticated smoke/E2E path for critical F1 → F2 → F3 behavior against the hosted environment.
- Do not weaken Cloudflare Access or introduce a production auth bypass solely for tests.

### B-06 — Contextual Document Chat — NOT IMPLEMENTED
- Add explicit passage selection/context references for the displayed Rozbor or Výstup while keeping the document visible beside Chat.
- Support context-aware concept explanations and examples within the document's accepted source and uncertainty boundaries.
- Keep discussion separate from document modification: no automatic changes to canonical Zápisník facts, working hypotheses or accepted snapshots; modifications require a separate explicit action.

### B-07 — Central DEV pilot telemetry — IN PROGRESS (T2 DEV deployment PASS; receipt/telemetry acceptance BLOCKED; disabled)
- **PILOT-TECH-T2 hosted result (2026-10-26):** exact candidate `d706a55c7ff80b1439079badfda88c9baa5807c4` deployed to DEV version `732bf950-30cf-444a-90fc-8927d9c8b16c` at 100%; bindings, D1 and OFF/OFF/TTL 86400 read back. Access callback ended `invalid state`, so first receipt POST and all telemetry/D1/report/cleanup checks were not attempted. PUBLIC unchanged; B-07 remains OPEN pending a valid operator-controlled tester session.
- **Follow-up Access attempt (2026-10-26 20:55 UTC):** new DEV browser session did not reuse the prior callback URL, but SSO ended at Cloudflare Dashboard login; no `/api/session` response was obtained. Test stopped; no receipt or telemetry activity. B-07 remains OPEN.
- **Tester identity gate (2026-10-26):** a subsequent DEV return succeeded, but read-only `/api/session` reported `isDeveloper:true` and the UI showed Developer mode. Not eligible for T2 tester telemetry; no role/policy change or bypass. B-07 remains OPEN.
- **PILOT-TECH-R1 DEV implementation — SOURCE/LOCAL V3 PASS (2026-10-26):** explicit guarded future PUBLIC host/env contract and disjoint HMAC domains; reproduced receipt lag/retry and lost-response defects repaired with GET-only recovery, fail-closed API retained. Future 90-day receipt constant (no default or DEV TTL change), material-change DRAFT versions and known contact/input rules prepared. 1510 root + 21 actual-route Chromium checks, actual-client rules, typecheck/build/artifact/lint/isolation PASS. [Scope and next hosted handoff](../TELEMETRY/TELEMETRY_ROADMAP.md#pilot-tech-r1--dev-source-and-next-verification-2026-10-26). Historical first POST cause and new hosted collection remain NOT VERIFIED. Collection/metadata OFF/OFF; B-07 remains **OPEN**, no activation/provider/hosted change or merge.
- **G1-C5 unified DEV source — V3 PASS (2026-10-25):** exact telemetry/evidence + pilot PR #81 integrated on a separate stacked branch; stateless/rules/stream/transport contracts preserved, strict receipt KV/finite TTL preparation added. 1,505 root tests + 11 Chromium harness tests and joint actual-client regressions/typecheck/lint/build/artifact/isolation PASS. Telemetry OFF/OFF; hosted readiness BLOCKED on verified operator identities/approved TTL and remaining Access/privacy/deployment gates. [Integration evidence](../TELEMETRY/TELEMETRY_ROADMAP.md#g1-c5--unified-dev-source-integration--2026-10-25). B-07 remains OPEN; no hosted mutation, provider call or real collection.
- Implement the disabled-by-default collector, dedicated telemetry persistence, session/activity/workflow events and server-side AI usage integration described in [the telemetry package](../TELEMETRY/README.md).
- Reuse the existing call-level usage/pricing ledger; keep diagnostic Session JSON separate from minimal pilot collection.
- **B1 foundation source milestone PASS (2026-10-23):** strict contracts/context/collector, telemetry-only migration/store, memory-only client interface, request-scoped safe AI sink and optional DEV preparation. V3: 271 relevant tests, typecheck, focused lint, canonical build/artifact PASS; not provisioned/deployed/collecting. [Evidence and B2 interface](../TELEMETRY/TELEMETRY_ARCHITECTURE.md#10-implemented-b1-contract-and-verification--2026-10-23).
- **B2 core-metrics source milestone PASS (2026-10-23):** AI sink wiring/controller/MAIN request lifetime, opted-in activity/session/workflow/operation/document events and stale/reset/consent isolation. V3: 573 provider-free tests, typecheck, focused lint (five baseline warnings), canonical build/artifact PASS; no deployment/collection. [B2 evidence / B3 handoff](../TELEMETRY/TELEMETRY_ARCHITECTURE.md#11-implemented-b2-core-metrics-and-verification--2026-10-23).
- **B3 reporting/automated verification milestone PASS (2026-10-23):** P0 SQL/local reports, explicit denominators/incomplete costs, Prague interval union/DST, restricted CSV, local retention/deletion/restore replay and measured resource model. V2: 225 provider-free tests, independently inspected actual CSV, typecheck, focused lint PASS; B2 build evidence reused because app/bundle is unchanged. Upper-load Free limits exceeded in the model, not live account verification. [Evidence and B4 handoff](../TELEMETRY/TELEMETRY_ARCHITECTURE.md#12-implemented-b3-reporting-and-verification--2026-10-23).
- **B4 prerequisite harness repair — Linux V2 PASS (2026-10-23):** snapshot/restore SQLite cleanup order corrected; symlink-capability and POSIX/Windows-ACL checks explicitly separated. 228 B1/B2/B3 regression tests and 8 cleanup-diagnostic cases PASS, typecheck/focused lint PASS. Native Windows/ACL and browser/runtime acceptance remain NOT VERIFIED; stock launcher synthetic-identity gap assessed read-only, isolated test-only harness proposed, not implemented. [Supplementary evidence / Windows handoff](../TELEMETRY/LOCAL_VERIFICATION.md). B-07 remains OPEN.
- **B4-H1 isolated synthetic browser infrastructure — Linux V2 PASS (2026-10-23):** actual client/JWT/consent/HTTP handlers/file SQLite/B3 SQL/CSV; 8 actual browser and 249 regression tests PASS, typecheck/focused lint/canonical build/Worker artifact isolation PASS. Full seeded workflow, unknown costs, reset/stop/reload/identity/stream/outage boundaries and overlapping activity verified. [Actual scope / source map / Windows handoff](../TELEMETRY/LOCAL_VERIFICATION.md#b4-h1-synthetic-browser-harness--2026-10-23). Standard launcher/SSR/Vinext/Worker, native Windows B4 V3 and activation remain pending; B-07 stays OPEN.
- **B4-H1 controlled-activity repair — Linux V2 PASS (2026-10-24):** deterministic pre-consent clock alignment, actual blur/delivery synchronization and bounded diagnostics; controlled 1,032ms offset reproduces persisted 13,968ms before the real tail arrives, then exactly 15,000ms. 10 Chromium tests / 249 B1–B3 regressions, typecheck/focused lint/isolation PASS. [Evidence and native Windows handoff](../TELEMETRY/LOCAL_VERIFICATION.md#b4-h1-controlled-activity-clock-repair--2026-10-24). Original native Windows causal sequence/PASS remain NOT VERIFIED; no activity-engine change or full B4 acceptance. B-07 remains OPEN.
- **B4-H1-R1 native Windows verification (2026-10-24):** required HEAD `b8fdde42e75398198cd10fe305048aa722a42c43`; controlled activity 3/3 PASS and complete Chromium harness 10/10 PASS. Intermediate `13968ms` was reconciled to final persisted/session/participant `15000ms`; idle renewal and overlap union passed. Isolated harness blocker resolved; standard SSR/Vinext/Worker and hosted boundaries remain separate. B-07 remains OPEN.
- **G1-A DEV staging SOURCE V2 PASS (2026-10-24):** strict staged-only binding with collection/metadata OFF; absent/disabled compatibility, resource guards and config-relative migration verified with actual local Wrangler/Miniflare D1. 158 preparation/B1 tests, typecheck/lint/build/artifact/isolation PASS. [Contract/evidence](../TELEMETRY/TELEMETRY_ARCHITECTURE.md#13-g1-a-dev-provisioning-staging-contract--2026-10-24), [Windows G1-B runbook](../TELEMETRY/G1_DEV_D1_RUNBOOK.md). G1-B requires fresh account/EU/resource checks and separate remote authorization; no provisioning/deployment/collection occurred. B-07 remains OPEN.
- Remaining: standard runtime/hosted boundaries and G0–G5 before any activation. Item stays open pending complete B4 technical decision. Original proposed effort: 48–72 engineering hours.
- No database provisioning, hosted update, real-user collection or production deployment is authorized by this documentation item. Resolve privacy, enrollment, live DEV identity, retention and activation gates in the roadmap before launch. Content classification is deferred.

## NEEDS DECISION

### D-01 — Legacy export/audit internals
Historical HTML audit/export and Drive-upload helpers remain separate from the current Session JSON flow. Before removal or reactivation, verify whether any legitimate internal/test workflow still depends on them.

## OUTSIDE ACTIVE BACKLOG
The following are not backlog items unless a new requirement or reproducible regression reopens them:
- structured F2 Analysis / Entry / Working flow;
- MAIN/SIDE/NAV question ownership and explicit phase transitions;
- APU Session JSON and request telemetry;
- Cloudflare Worker hosting baseline and Cloudflare Access architecture;
- developer/tester role split;
- repository-backed DEV LOG with Cloudflare KV mutable state.
