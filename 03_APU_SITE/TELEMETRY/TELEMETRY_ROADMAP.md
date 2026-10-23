# TELEMETRY_ROADMAP

Status: **B1 FOUNDATION + B2 CORE METRICS — local technical PASS; disabled, not deployed. B3–B4 remain planned.** Hosted activation / collection from real participants: **BLOCKED on explicit gates**, not authorized. B1 foundation and B2 instrumentation are implemented; reporting and browser/runtime acceptance remain future work. Prepared 2026-10-23; audited `dev` source `fc8ac5520b7b49b442bedc47558c73f20ce2bea6`.

## 1. Technical sequence and estimates

Estimates are human engineering hours, including targeted tests/review/docs, for someone familiar with this TypeScript/Vinext project. They are not model wall-clock predictions or commercial commitments. Assume 20–100 pilot participants, no authentication redesign, no classifier, one D1, existing AI ledger and local fixture infrastructure. Access delays, security/legal decisions, real-world pilot elapsed time and provider charges are excluded. Unknown Vinext lifetime integration or materially changed source can increase estimates.

| Step / batch | Goal and scope | Dependencies / priority | Effort | Profile / environment | Risks | Acceptance and exit condition |
| --- | --- | --- | --- | --- | --- | --- |
| G0 — live DEV evidence | Operator read-only read-back of dedicated Worker, deployed source/version, resource types/isolation, build/hook targets, plan/log settings. No raw secrets or business data. | Existing P5 evidence; P0 before hosted work, not before local source coding | LOW, 1–2h operator | Local / Local Windows PowerShell or Dashboard; N/A model; R0/V1 | Account access; no deployed SHA available | Record exact environment/source evidence or explicitly unknown; no code/DB/hosted mutation. Needed evidence must pass before an authorized hosted change. |
| M1 / [B1](batches/B1_FOUNDATION.md) — SOURCE PASS 2026-10-23 | Strict event/storage contract, same-Worker context/collector, pseudonym/session adapter, disabled gates, migrations authored only, DEV preparation extension. | Audited source + spec/architecture; P0 | MEDIUM, 14–20h | Work / Codex Cloud; Sol medium; R4/V3 | Cross-layer isolation, request-lifetime support, strict DEV config | Disabled mode makes no collection; validation/dedup/ownership and emulated SQL pass; no cross-request leakage or production/config changes. B2 can use contract and request-scoped hook. |
| M2 / [B2](batches/B2_CORE_METRICS.md) — SOURCE PASS 2026-10-23 | Activity/session/workflow emitters, all server AI lifecycle sinks including MAIN streaming, linkage, accepted baseline/generated completions. | B1 PASS; P0 | HIGH, 18–26h | Work / Codex Cloud; Sol high; R3/V3 | Stale continuations, default zero-AI output, idle/multi-tab, telemetry affecting AI | Synthetic exact events/AI costs, role parity, known/unknown cost handling, no business-state changes; B3 reporting fixtures consume actual emitted contract. |
| M3 + automated M4 / [B3](batches/B3_REPORTING.md) | Exact SQL/CSV reports, retention/deletion tools, optional coarse route/format enums off by default, deterministic end-to-end fixtures | B2 PASS; core reports P0, metadata P1 until G3 | MEDIUM, 10–16h (reports 6–10, verification 4–6) | Work / Codex Cloud; Sol medium; R2/V2 | Aggregate multiplication, censored samples, storage cap, accidentally exported IDs | Expected-vs-actual fixture report equality; safe export, pruning/deletion/restore procedure and quota calculation; B4 ready. |
| Runtime M4 / [B4](batches/B4_LOCAL_VERIFICATION.md) | Actual local UI/API/Worker-emulated DB acceptance with synthetic scenarios, runtime/focus/idle/disconnect behavior, existing diagnostic comparison | B3 PASS, healthy Windows runtime; P0 | MEDIUM, 6–10h | Local / Local Windows PowerShell; N/A; R2/V3 | Browser timing, local platform capabilities, emulation≠hosted | Recorded scenario pass/fail and source/test identities; no provider request/remote DB/deploy. Material failures return to owning batch. |
| M5 — activation preparation | Controller privacy/retention review, enroll/notice approval, operator provisioning/deployment plan and launch checklist | G0, B1–B4, G1–G5; P0 | MEDIUM, 3–6h operator (privacy 2–4, final review 1–2) | Chat/Local / ChatGPT Chat + operator Dashboard; N/A; R1/V2 for readiness review | Material decisions cannot be inferred | Readiness report distinguishes approved vs missing. **Provisioning, hosted deployment, live provider smoke and real collection require separate authorization; no such actions belong to this roadmap's current execution.** |

Total: **48–72 engineering hours**, plus **4–8 operator/review hours**. This is roughly 6–9 engineering days, not a promised calendar deadline. Reuse source evidence and existing tests; do not repeat a general infrastructure audit in every batch.

## 2. Gates and what they block

| Gate | Concrete unresolved item / owner | Blocks | Smallest next evidence/action |
| --- | --- | --- | --- |
| G0 live DEV identity | Operator: dedicated `apu-ms-site-dev` source SHA/version/allocation, effective binding types/isolation, relevant builds/hooks and plan headroom | Hosted configuration/deploy/test; not local implementation | Read-only Dashboard or authorized CLI summary. If deployment metadata lacks source SHA, record that fact and use reviewed artifact provenance in a later authorized deployment. |
| G1 resource authorization | Operator: dedicated telemetry D1 with EU jurisdiction, binding identity, key provisioning, separate synthetic-vs-real data separation | Any remote migration/provisioning and hosted collector use | Separate explicit instruction naming DEV resources/actions; this audit creates none. Code migration files/emulated tests can proceed. |
| G2 participant/privacy basis | Controller: lawful basis, notice/voluntary opt-in, use of existing validated identity solely for HMAC, enrollment and rights process | Stable participant metrics and all real-user collection | Approve documented policy/config values, without sending identity lists/secrets in prompts. If rejected, participant metrics are unavailable and pilot scope must be revised openly. |
| G3 content metadata | Controller/product owner: whether route/format collection is justified; no source text | `workflow_metadata` and optional format enums only | Keep default off. Enable only approved allowlisted enums; no classifier. Core economics/activity/workflow can launch without it. |
| G4 runtime/privacy operations | Operator/controller: logs including edge/Access, agreements, retention owner/daily cleanup, backup/export deletion, quota headroom, provider secret readiness | Real-user launch; hosted synthetic smoke separately needs G0/G1/authorization | Checklist with settings evidence, not raw logs. Existing B-05/KI-01 provider functional gaps are not closed by telemetry fixtures. |
| G5 hosted verification and launch | Operator: separate deploy + paid provider-test permission, exact synthetic hosted reconciliation, final collection approval | Real users and enabled telemetry | After authorization only: isolated synthetic smoke on exact DEV artifact, data inspection for forbidden fields, then explicit launch approval. No production change. |

Privacy choices are not silently decided by an engineer or a passing test. G2/G4/G5 block activation, but their existence does not block implementing an off-by-default collector and synthetic fixtures. If future instructions authorize implementation, executors follow these boundaries rather than reopening resolved storage/metric design.

## 3. Required verification matrix

Expected counts must come from deterministic synthetic fixture inputs, not snapshots that mirror arbitrary implementation output. B2 owns emitters; B3 owns aggregate assertions; B4 proves actual runtime interactions. Local time tests use controlled clocks and Europe/Prague DST fixtures, not long sleeps.

| Scenario | Observable required result |
| --- | --- |
| Disabled/missing config/binding/key | No collection requests/writes or persistent tracking; existing F1→F2→F3 behavior retained. Operator sees fixed readiness status. |
| Consent refusal / withdrawal / logout / uncertain identity | No events before opt-in or after stop; app remains usable; queued data handled per opt-in policy; no cross-account delivery. |
| Tester vs developer | Opted-in eligible tester is measured server-side despite response field filtering; developer/synthetic traffic excluded by default reports. No new tester access to diagnostics. |
| Duplicate/reordered delivery | Same event ID repeated three times counted once; conflicting ID/sequence rejected; late pending cannot overwrite finalized AI call. |
| Two concurrent participants | Distinct HMACs/session IDs; every server record matches request identity even with interleaved async writes. No Worker-global request context. |
| Two tabs, focus changes and overlapping intervals | Session counts remain tab visits; participant time equals interval union, not sum; hidden/blurred/idle windows contribute zero. |
| Idle, sleep, reload, midnight and DST | 30m inactivity rotates only on new meaningful activity/request; heartbeat doesn't prolong session; reload starts another visit; ≤15s chunks; correct civil-day/week split and no sleep-gap inflation. |
| Full workflow / default output | First usable F3 baseline completes once even without a new F3 AI call; reopening tab/panel/rerender does not duplicate output. |
| F2 local-only update / backward navigation | No fabricated AI usage; return F3→F2 is recorded as navigation, not error. |
| Generated output / stale response / reset mid-flight | Only accepted current material counts as new output; stale/discarded/failed work never completes; incurred server cost retained under original workflow/session. |
| Grounding rescue and explicit retry | Primary/rescue counted separately with fallback link; failed attempt plus user retry are two calls; normal controller+MAIN are not mislabeled retry. |
| Streaming MAIN success/error/disconnect | Same lifecycle persisted on terminal paths; unresolved transport/pending status explicit; client connection loss doesn't make known server cost disappear. |
| DB outage / timeout / late promise | APU result unaffected, bounded added latency; no unhandled rejection; duplicates/late writes safe. Health/coverage status honest. |
| Pricing fixtures | Cached/write/reasoning subsets not double-counted; unknown model/tier/missing/invalid usage/transport uncertainty remain incomplete; genuine zero-call workflow costs zero. |
| Aggregation precision | Calls priced 0.01, 0.03, 0.10 USD across three complete AI sessions yield mean 0.046666… and median 0.03. Adding 20 general events must not multiply these prices. An incomplete fourth session excluded from complete-price mean but counted in coverage. |
| Time union fixture | Participant tab A [0,30)s and B [15,45)s →45s participant active time; session times 30s each. |
| Conversion/censoring fixture | One completed, one explicitly reset, one older than24h unfinished and one <24h pending: completed=1, reset=1, unfinished-observed=1, right-censored=1; no automatic error inference. |
| Safe input/export | Reject arbitrary text/headers/server events/client cost. No names/emails/IP/geo/prompts/responses/source hashes in persisted rows or exported files. CSV escapes formula-leading cells; raw SQL restricted. |
| Retention/delete/restore | Expired data removed from all three logical tables; no retention extension by late duplicate; participant deletion affects only correct cohort; backup restoration instructions require deletion replay. |

## 4. Explicitly outside the first version

- AI-derived situation/need/goal taxonomy, semantic material types, diagnosis or child profiles.
- Prompt/response/notebook/Session JSON collection; raw errors, source fingerprints, provider request/response IDs, IP, geography, browser fingerprint, device attribution.
- Durable business project Save/Open, cross-device workflow recovery, business-history migration or authentication/role changes.
- Continuous session replay, pointer/key capture, passive attention inference, user-performance scoring, automated recommendations/A-B platform.
- External SaaS, new event bus, Queue/DO, real-time dashboard or new admin export endpoint.
- Automatic repricing of history, invoice-grade accounting, shared infrastructure-cost allocation, guaranteed lossless collection.
- Production/public deployment or reuse of the historical PR60 preview.

## 5. Documentation and tracking

This audit creates the telemetry package under `03_APU_SITE/TELEMETRY/`, adds the navigation entry to `03_APU_SITE/README.md`, and adds exactly one unfinished backlog item B-07. Existing telemetry/diagnostic functionality is not reopened as unfinished; the new item is specifically the **central pilot collection system**.

Documentation Impact: Type DESIGN / AUDIT / IMPLEMENTATION PLAN. Documents: this package, site documentation index and backlog. Changelog **NO** (no functionality implemented). Known Issues **NONE** (existing KI-01/KI-03 retained). Governing workflow **NONE**. No mandatory Drive sync; no new Project Sources refresh is caused by this package. Existing stale Project Sources naming `next` should be refreshed from current governance independently.

Future B1–B3 documentation sections identify exact updates after verification. Mark B-07 partially complete by milestone, resolve only after B1–B4 acceptance; real launch remains separately gated. Never record planned infrastructure as provisioned or tests as hosted PASS.

## 6. Audit completion and next action

The data specification, source audit, conditional hosted feasibility, architecture, cost model, privacy gates, roadmap and executor prompts are prepared. Cloudflare live state remains explicitly NOT VERIFIED; source implementation can begin after separate authorization. No database, application code or deployment has been changed by the audit.

**Current next action after B1/B2:** review the stacked source changes, then separately authorize B3 if desired; do not activate collection or skip B4/G0–G5. Live G0 can be supplied in parallel before any hosted step; it does not require re-auditing the repository.


## 7. B1 completion checkpoint — 2026-10-23

B1 foundation implemented on audited DEV source plus PR #66 documentation commit `f850f3b6555fd4f5b07cf50f8163d4fbe3db9f16`. See [architecture §10](TELEMETRY_ARCHITECTURE.md#10-implemented-b1-contract-and-verification--2026-10-23) for exact interfaces, source/runtime provenance and commands. V3 technical verification: typecheck, 271 relevant tests (including SQLite, actual Access and pinned Vinext request-lifetime integration), focused lint, canonical build and Worker artifact validation PASS. Existing feature/docs → dev CI provenance restriction is tracked separately; its guard was not changed.

At the B1 handoff, `createTelemetryClient()` and `createRequestTelemetrySink()`/optional request collector persistence were ready for B2. That wiring and source instrumentation have now passed B2 as recorded below. B3 reports/retention/deletion and B4 browser/local acceptance are not claimed complete. B-07 remains open with its foundation milestone complete. No new Known Issue or governing workflow change.

Defaults and collection remain off, with no persistent browser participant identifier. No database/key provisioning, remote migration, hosted update, paid provider call, real-user collection or deployment occurred. G0–G5 remain unresolved activation gates. A prepared future enabled configuration alone cannot authorize or activate collection.


## 8. B2 completion checkpoint — 2026-10-23

**B2 IMPLEMENTED / LOCAL V3 PASS / OFF / NOT DEPLOYED.** Stacked on required B1 `5ade93fbad714f2c047ae17f59c0073ea98479dc`, with PR #66/#67 still unmerged at inspection. All six AI routes/controller/MAIN use the safe sink; the MAIN pump survives downstream cancellation under its request lifetime. Client consent/clock/visit/workflow/operation and committed-document instrumentation are connected to existing app actions. See [architecture §11](TELEMETRY_ARCHITECTURE.md#11-implemented-b2-core-metrics-and-verification--2026-10-23) for exact emitter map, compatibility adjustments and commands; [spec §7](PILOT_TELEMETRY_SPEC.md#7-implemented-source-coverage--b2-2026-10-23) distinguishes source coverage from future aggregates.

Typecheck, 573 relevant provider-free tests, focused lint (zero errors; five reproduced baseline warnings), canonical build and Worker artifact validation PASS. Synthetic full-workflow/SQLite reconciliation, real authenticated route fixtures, unchanged off/on/broken provider payloads/call counts/results, concurrent participants, pricing/unknown usage, streaming disconnect, slow/rejected stores, default/generated output, reset/stale/consent-generation and activity-clock cases are covered. No actual provider request or real-user data is used.

B3 is ready to consume the versioned B1/B2 rows/events for reporting, interval union/civil dates, censoring, retention/deletion and export. No B3 implementation, statistics dashboard or B4 browser acceptance is claimed. B-07 stays open. Known Issues and governing workflow remain unchanged. Source telemetry is disabled; G0–G5, resource/notice/privacy/hosted gates remain separate. No provisioning, remote migration, hosted update, production change, real collection or deployment occurred. **Stop after B2; B3 requires separate authorization.**
