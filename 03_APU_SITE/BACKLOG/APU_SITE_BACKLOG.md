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

### B-07 — Central DEV pilot telemetry — IN PROGRESS (B1/B2/B3 source verified; disabled)
- Implement the disabled-by-default collector, dedicated telemetry persistence, session/activity/workflow events and server-side AI usage integration described in [the telemetry package](../TELEMETRY/README.md).
- Reuse the existing call-level usage/pricing ledger; keep diagnostic Session JSON separate from minimal pilot collection.
- **B1 foundation source milestone PASS (2026-10-23):** strict contracts/context/collector, telemetry-only migration/store, memory-only client interface, request-scoped safe AI sink and optional DEV preparation. V3: 271 relevant tests, typecheck, focused lint, canonical build/artifact PASS; not provisioned/deployed/collecting. [Evidence and B2 interface](../TELEMETRY/TELEMETRY_ARCHITECTURE.md#10-implemented-b1-contract-and-verification--2026-10-23).
- **B2 core-metrics source milestone PASS (2026-10-23):** AI sink wiring/controller/MAIN request lifetime, opted-in activity/session/workflow/operation/document events and stale/reset/consent isolation. V3: 573 provider-free tests, typecheck, focused lint (five baseline warnings), canonical build/artifact PASS; no deployment/collection. [B2 evidence / B3 handoff](../TELEMETRY/TELEMETRY_ARCHITECTURE.md#11-implemented-b2-core-metrics-and-verification--2026-10-23).
- **B3 reporting/automated verification milestone PASS (2026-10-23):** P0 SQL/local reports, explicit denominators/incomplete costs, Prague interval union/DST, restricted CSV, local retention/deletion/restore replay and measured resource model. V2: 225 provider-free tests, independently inspected actual CSV, typecheck, focused lint PASS; B2 build evidence reused because app/bundle is unchanged. Upper-load Free limits exceeded in the model, not live account verification. [Evidence and B4 handoff](../TELEMETRY/TELEMETRY_ARCHITECTURE.md#12-implemented-b3-reporting-and-verification--2026-10-23).
- **B4 prerequisite harness repair — Linux V2 PASS (2026-10-23):** snapshot/restore SQLite cleanup order corrected; symlink-capability and POSIX/Windows-ACL checks explicitly separated. 228 B1/B2/B3 regression tests and 8 cleanup-diagnostic cases PASS, typecheck/focused lint PASS. Native Windows/ACL and browser/runtime acceptance remain NOT VERIFIED; stock launcher synthetic-identity gap assessed read-only, isolated test-only harness proposed, not implemented. [Supplementary evidence / Windows handoff](../TELEMETRY/LOCAL_VERIFICATION.md). B-07 remains OPEN.
- Remaining: B4 local runtime acceptance after separate authorization; G0–G5 and actual quota/privacy/operator readiness before any activation. Item stays open. Original proposed effort: 48–72 engineering hours.
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
