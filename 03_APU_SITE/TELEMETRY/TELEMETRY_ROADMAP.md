# TELEMETRY_ROADMAP

Status: **B1 FOUNDATION + B2 CORE METRICS + B3 REPORTING — local technical PASS; B4-H1-R1 native Windows Chromium harness PASS; G0 live DEV audit PARTIAL; collection disabled, not deployed.** Standard SSR/Vinext/Worker and hosted verification remain separate boundaries. Hosted activation / collection from real participants: **BLOCKED on explicit gates**, not authorized. Prepared 2026-10-24; verified R1 source `b8fdde42e75398198cd10fe305048aa722a42c43`. Workers Paid is **VERIFIED BY OPERATOR SCREENSHOT** at USD 5/month; independent billing read-back remains unavailable. Zero Trust Free Base is operator-reported (2/50 seats), not independently re-read. Usage/headroom, effective routes/Access policy and observability retention remain NOT VERIFIED.

## 0. Approved pilot capacity and tariff decision — 2026-10-24

- **Operating envelope:** at most **50 pilot participants per day**; this is a participant count, **not** a one-session-per-person/day limit. Repeat visits and sessions are expected and remain measurable.
- **Target plan:** **Cloudflare Workers Paid**, with an indicative base charge of **USD 5 per account per month** plus any usage beyond included allowances. This is a target selection, **not** confirmation of the account's current plan or a guaranteed total bill.
- **Architecture and value:** retain the approved same-DEV-Worker collector, dedicated telemetry D1 and all P0 economics/activity/workflow/quality metrics. Do not degrade their coverage, event cadence or fidelity solely to fit Workers Free.
- **Retention and metadata:** retain **30 days of raw telemetry as the proposed baseline**, subject to controller/privacy approval; optional content/route/format metadata remains **OFF** pending G3. No free-text collection is authorized.
- **Load evidence:** the earlier **200 sessions/day** and 6,000-session/30-day resource models remain upper-load/stress scenarios, **not** the expected 50-participant daily footprint. Actual sessions per participant and D1-billed row usage/headroom require live G0/G4 verification.
- **Authority boundary:** this decision does not authorize upgrading the Cloudflare plan, provisioning/migrating D1, changing bindings/secrets, deploying, activating telemetry, or collecting from real users. G0–G5 and separate authorizations remain required.
- **Billing follow-up:** the account owner separately reported completing the Workers Free → Paid upgrade. The operator screenshot showed an active Workers Paid subscription at USD 5/month. This does not authorize deployment, D1 provisioning, binding/secret changes, telemetry activation, or hosted verification. Zero Trust Free Base (2/50 seats) is operator-reported and remains distinct from the Workers plan.

## 1. Technical sequence and estimates

Estimates are human engineering hours, including targeted tests/review/docs, for someone familiar with this TypeScript/Vinext project. They are not model wall-clock predictions or commercial commitments. The original engineering estimates assumed 20–100 pilot participants (historical sizing baseline), no authentication redesign, no classifier, one D1, existing AI ledger and local fixture infrastructure. The approved operating envelope is now up to 50 participants per day, with repeat sessions permitted. Access delays, security/legal decisions, real-world pilot elapsed time and provider charges are excluded. Unknown Vinext lifetime integration or materially changed source can increase estimates.

| Step / batch | Goal and scope | Dependencies / priority | Effort | Profile / environment | Risks | Acceptance and exit condition |
| --- | --- | --- | --- | --- | --- | --- |
| G0 — live DEV evidence | Operator read-only read-back of dedicated Worker, deployed source/version, resource types/isolation, build/hook targets, plan/log settings. No raw secrets or business data. | Existing P5 evidence; P0 before hosted work, not before local source coding | LOW, 1–2h operator | Local / Local Windows PowerShell or Dashboard; N/A model; R0/V1 | Account access; no deployed SHA available | Record exact environment/source evidence or explicitly unknown; no code/DB/hosted mutation. Needed evidence must pass before an authorized hosted change. |
| M1 / [B1](batches/B1_FOUNDATION.md) — SOURCE PASS 2026-10-23 | Strict event/storage contract, same-Worker context/collector, pseudonym/session adapter, disabled gates, migrations authored only, DEV preparation extension. | Audited source + spec/architecture; P0 | MEDIUM, 14–20h | Work / Codex Cloud; Sol medium; R4/V3 | Cross-layer isolation, request-lifetime support, strict DEV config | Disabled mode makes no collection; validation/dedup/ownership and emulated SQL pass; no cross-request leakage or production/config changes. B2 can use contract and request-scoped hook. |
| M2 / [B2](batches/B2_CORE_METRICS.md) — SOURCE PASS 2026-10-23 | Activity/session/workflow emitters, all server AI lifecycle sinks including MAIN streaming, linkage, accepted baseline/generated completions. | B1 PASS; P0 | HIGH, 18–26h | Work / Codex Cloud; Sol high; R3/V3 | Stale continuations, default zero-AI output, idle/multi-tab, telemetry affecting AI | Synthetic exact events/AI costs, role parity, known/unknown cost handling, no business-state changes; B3 reporting fixtures consume actual emitted contract. |
| M3 + automated M4 / [B3](batches/B3_REPORTING.md) — SOURCE PASS 2026-10-23 | Exact SQL/CSV reports, local retention/deletion, deterministic end-to-end fixtures and measured resource model; optional metadata deferred/off | B2 PASS; core reports P0, metadata P1 until G3 | MEDIUM, 10–16h (reports 6–10, verification 4–6) | Work / Codex Cloud; Sol medium; R2/V2 | Aggregate multiplication, censored samples, storage cap, accidentally exported IDs | V2 PASS: 225 tests, independently inspected CSV and 6000-session model. B4 ready for separate authorization. |
| [B4-H1-R1 native Windows verification](LOCAL_VERIFICATION.md#b4-h1-r1-native-windows-verification--2026-10-24) | Actual browser → JWT/consent/routes → synthetic SQLite → SQL/CSV, isolated from production launcher | R1 source `b8fdde4`; explicitly authorized verification | Test-only prerequisite | Local Windows; N/A; R1/V3 | Standard SSR/Vinext/Worker and hosted boundaries remain separate | Controlled activity 3/3 PASS; full Chromium harness 10/10 PASS; exact `13968ms` intermediate and `15000ms` persisted/union totals confirmed |
| Runtime M4 / [B4](batches/B4_LOCAL_VERIFICATION.md) | Actual local UI/API/Worker-emulated DB acceptance with synthetic scenarios, runtime/focus/idle/disconnect behavior, existing diagnostic comparison | B3 PASS, H1 source/handoff, healthy Windows runtime; P0 | MEDIUM, 6–10h | Local / Local Windows PowerShell; N/A; R2/V3 | Browser timing, local platform capabilities, emulation≠hosted | Recorded scenario pass/fail and source/test identities; no provider request/remote DB/deploy. Material failures return to owning batch. |
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

**Current next action after the G1-B procedure correction:** use [runbook phase B](G1_DEV_D1_RUNBOOK.md#b-d1-migration-only--pending) for local operator migration of the already-created EU D1, after fresh required identity/schema/deployment checks. Do not repeat creation or require Worker KV/Access inputs for this migration. The 2026-10-24 read-only audit verified `apu-ms-site-dev`, its active deployment/version and ASSETS/KV/Access-variable metadata, and found an empty D1 inventory; this is historical inventory, not a current absence guarantee. Workers Paid is operator-screenshot confirmed, while usage/headroom, routes/effective Access policy, observability retention and deployed Git SHA provenance remain unverified. G0 remains **PARTIAL**. G1-A does not create D1 or authorize remote work, hosted binding/secrets or activation.


## 7. B1 completion checkpoint — 2026-10-23

B1 foundation implemented on audited DEV source plus PR #66 documentation commit `f850f3b6555fd4f5b07cf50f8163d4fbe3db9f16`. See [architecture §10](TELEMETRY_ARCHITECTURE.md#10-implemented-b1-contract-and-verification--2026-10-23) for exact interfaces, source/runtime provenance and commands. V3 technical verification: typecheck, 271 relevant tests (including SQLite, actual Access and pinned Vinext request-lifetime integration), focused lint, canonical build and Worker artifact validation PASS. Existing feature/docs → dev CI provenance restriction is tracked separately; its guard was not changed.

At the B1 handoff, `createTelemetryClient()` and `createRequestTelemetrySink()`/optional request collector persistence were ready for B2. That wiring and source instrumentation have now passed B2 as recorded below. B3 reports/retention/deletion and B4 browser/local acceptance are not claimed complete. B-07 remains open with its foundation milestone complete. No new Known Issue or governing workflow change.

Defaults and collection remain off, with no persistent browser participant identifier. No database/key provisioning, remote migration, hosted update, paid provider call, real-user collection or deployment occurred. G0–G5 remain unresolved activation gates. A prepared future enabled configuration alone cannot authorize or activate collection.


## 8. B2 completion checkpoint — 2026-10-23

**B2 IMPLEMENTED / LOCAL V3 PASS / OFF / NOT DEPLOYED.** Stacked on required B1 `5ade93fbad714f2c047ae17f59c0073ea98479dc`, with PR #66/#67 still unmerged at inspection. All six AI routes/controller/MAIN use the safe sink; the MAIN pump survives downstream cancellation under its request lifetime. Client consent/clock/visit/workflow/operation and committed-document instrumentation are connected to existing app actions. See [architecture §11](TELEMETRY_ARCHITECTURE.md#11-implemented-b2-core-metrics-and-verification--2026-10-23) for exact emitter map, compatibility adjustments and commands; [spec §7](PILOT_TELEMETRY_SPEC.md#7-implemented-source-coverage--b2-2026-10-23) distinguishes source coverage from future aggregates.

Typecheck, 573 relevant provider-free tests, focused lint (zero errors; five reproduced baseline warnings), canonical build and Worker artifact validation PASS. Synthetic full-workflow/SQLite reconciliation, real authenticated route fixtures, unchanged off/on/broken provider payloads/call counts/results, concurrent participants, pricing/unknown usage, streaming disconnect, slow/rejected stores, default/generated output, reset/stale/consent-generation and activity-clock cases are covered. No actual provider request or real-user data is used.

B3 is ready to consume the versioned B1/B2 rows/events for reporting, interval union/civil dates, censoring, retention/deletion and export. No B3 implementation, statistics dashboard or B4 browser acceptance is claimed. B-07 stays open. Known Issues and governing workflow remain unchanged. Source telemetry is disabled; G0–G5, resource/notice/privacy/hosted gates remain separate. No provisioning, remote migration, hosted update, production change, real collection or deployment occurred. **Stop after B2; B3 requires separate authorization.**

### B2-R01 verification correction — 2026-10-23

On PR #68, starting from required HEAD `3cdf978968a4d1d9116f017d35e87faa1c8d8902`, a regression proved that an old ticket could silently overwrite the current phase and suppress the next legitimate F2 → F3 event. Phase ownership is now checked across reset, stop/re-opt-in, idle renewal and pending context creation, including tickets created without collection. Actual accepted MAIN phase changes remain synchronized through the unchanged application ownership guard even with an expired telemetry ticket or collection off. See [architecture correction](TELEMETRY_ARCHITECTURE.md#b2-r01-verification-correction--2026-10-23) for the exact reproduction, fix and commands.

V2 local technical **PASS**: 72 targeted lifecycle/reset/client tests; the existing B2 regression command passes 585 tests (573 original plus 12 new), zero failures/skips. Typecheck, focused lint (zero errors, five existing warnings), canonical build and its Worker artifact validation pass. This supplements the original B2 evidence; it does not claim B3/B4 or hosted acceptance. CI provenance remains separate and unchanged. Telemetry remains off; no real AI calls, real-user collection, remote provisioning/migrations or deployment. Changelog, backlog and Known Issues unchanged.

## 9. B3 completion checkpoint — 2026-10-23

**B3 IMPLEMENTED / LOCAL V2 PASS / COLLECTION OFF / NOT DEPLOYED.** Original workspace/branch retained over B2 `5be74cf12df9a3f13e64462345f3be2d3b38f416`; WIP `ce90318a35700c00daa7d7f3890b96d0b5b5bad4` was only an incomplete source checkpoint. The final reporting tools are stacked on the still-unmerged B2 branch. [Architecture §12](TELEMETRY_ARCHITECTURE.md#12-implemented-b3-reporting-and-verification--2026-10-23) records exact commands, operator/local-target/restore procedure, scope and limitations; [spec §8](PILOT_TELEMETRY_SPEC.md#8-implemented-reporting-coverage--b3-2026-10-23) maps every P0 metric and denominator to executable views.

| Independent expected fixture | Verified result |
| --- | --- |
| Three mature complete AI sessions 0.01/0.03/0.10, fourth unpriced | Mean 0.046666… / median 0.03, complete AI N=3, incomplete mature N=1; known subtotal 140,000,000 nano-USD |
| Additional genuine zero-call baseline session | Complete all-active N=4, mean 0.035 / median 0.02; four completed outputs, no extra F3 AI call |
| Duplicate/reordered batches +20 semantic events | Idempotent event rows; no cost multiplication |
| Overlap [0,30), [15,45) | Session times 30s/30s; participant/day/week time 45s |
| Midnight/DST/ISO dates | Actual B2 midnight split/cross-day return; Prague days 23/25h; ISO year boundary correct |
| Complete/reset/≥24h unfinished/<24h pending/missing WS | Completed=1, reset=1, unfinished=1, right-censored=1, left-truncated=1; mature conversion 1/3 |
| Retry, fallback, pending/unknown and first-output cutoffs | Distinct linked attempts; unknown totals null/incomplete; later work cannot erase known first-output price |
| Retention/deletion/restore/export expiry | Only correct cohort/expired children removed; surviving newer children retain session; drift rejects apply; replay works; managed exports expire after 7d |
| Export/privacy boundary | Actual generated CSV independently checked; unsupported filters reject; linkage-off account fields removed; formula escaping and small/complementary-cell suppression PASS |

**225 tests PASS**, zero failures/skips, plus typecheck and focused lint (zero errors/warnings). This includes 15 B3 tests and targeted B1/B2 actual collector/route/reset/ledger regressions. Canonical build/artifact evidence is reused from B2-R01 because no application/bundle/Worker/config/dependency module changed; no redundant rebuild or hosted acceptance claim. Source CSV examples and reproducible resource JSON are under `telemetry/reports/examples/`.

Upper-load measurement: 6,000 sessions/30d, 570,000 persisted rows, 730,255,360 bytes (696.4 MiB) including indexes. Actual logical seed writes 186/session; estimated indexed write amplification 2.98×. At 200 sessions/day, estimates are 111,000 ingest +92,800 steady pruning writes/day. This exceeds published Free per-DB/write limits, as anticipated by the audit; G0/G4 must establish actual account headroom/plan before launch. No live account or billed D1 meta was verified. A 20-participant/40-visits-day scenario projects ~146MB and ~40,760 writes/day before other account use. Exact query plans/timings and final source hashes are retained in the artifact.

No dashboard, admin endpoint, content classification, pricing authority, new schema/index, business/consent/auth flow, collection flag or CI policy change. Optional route/format metadata remains G3/P1/off. The WIP was completed with narrow proven corrections and a fixture scheduler fix, not a replacement implementation. B-07 reporting milestone is complete but remains open for B4; Known Issues unchanged. **Next: separately authorized B4 Local Verification.** No B4, real AI call, real collection, remote operation, hosted update or deployment was performed; G0–G5 remain open.

## B4-H1 implementation / isolated Linux V2 evidence — 2026-10-23

The separately authorized harness is implemented above repair `9018512621c8a2d828932ff78e18f18d702b321d`, stacked against that branch. Actual browser and authenticated routes/storage/reports passed: 8 browser tests, 21 new HTTP harness tests included in 249 relevant regression tests; typecheck, focused lint, canonical build/Worker validation and source/artifact isolation PASS. [Evidence / exact commands / earlier parallel resource-sensitive regression failure / Windows handoff](LOCAL_VERIFICATION.md#b4-h1-synthetic-browser-harness--2026-10-23). Production modules/configuration/root dependencies are unchanged; scoped test dependency only. No auth bypass, collector/report/schema/business change or hosted action.

H1 proves seeded F1–F3/default/regeneration/reset, cost/unknown/output associations, consent and failure boundaries, actual CSV, clock-controlled idle and two overlapping browser intervals. It excludes production SSR/RSC/Vinext/Worker bootstrap, native Windows/OS/hidden-tab behavior and the standard launcher. The prior UI overlay finding remains unconfirmed. B-07 remains OPEN, B4 full acceptance/G0–G5 remain pending, collection/metadata OFF. No B4 completion or hosted verification is authorized by this result; stop after H1.


## G1-B-R1 provisioning outcome - 2026-10-24

**PARTIAL.** Evidence commit `630a7bf97e0cb4628e244464b2238825a67b7910` / PR #78 records the execution; the executed source SHA below is a separate fact. Canonical Windows build and Worker artifact validation passed on source `bf32bd2fd29f6f6ebd717deea2b7df8163cb8a56`. The authorized `apu-ms-site-dev-telemetry` D1 was created with verified `eu` jurisdiction and remains empty (`num_tables: 0`, zero reads/writes). The original run stopped because protected DEV KV/Access Worker inputs were unavailable. The corrected [phase B migration-only procedure](G1_DEV_D1_RUNBOOK.md#b-d1-migration-only--pending) now uses only the restricted D1 identity plus fresh target/schema/deployment read-back; Worker staging remains a later phase C with unchanged guards. Source V2 PASS: 28 migration-only tests and 139 DEV preparation tests, installed Wrangler local D1 schema/bookkeeping/zero-row verification, typecheck and focused lint. This is procedure readiness, not a remote migration: no Cloudflare operation was executed by this correction. Migration remains unapplied per the historical evidence, no Worker binding was published, and B-07 stays OPEN. Full UUID is retained only in restricted operator evidence; no history rewrite.

## G1-B-R2 migration acceptance - 2026-10-24

**PASS for migration-only scope.** Native Windows tests on source `2b3390e24f21aaa2f26dd5644d0dd2336ece210d` completed with 28 PASS, 0 FAIL and 2 explicit symlink-capability SKIP (`EPERM`; Windows symlink rejection remains NOT VERIFIED). Fresh Cloudflare read-back confirmed the existing EU D1 and unchanged DEV Worker deployment/traffic. The sole approved migration was applied exactly once: 3 telemetry tables, 6 indexes, 4 triggers, one `d1_migrations` row, no pending migrations, clean foreign-key check and zero telemetry rows. No Worker deployment, binding/secrets publication, Zero Trust change or activation occurred. B-07 remains OPEN; G1-C, G2, G4, G5 and hosted verification remain separate gates.

**G1-B V2 final verification PASS:** remote `sqlite_schema` definitions matched an in-memory execution of the approved SQL for all 13 telemetry objects after whitespace-collapse-only normalization (3 tables, 6 indexes, 4 triggers). Fresh read-only checks confirmed one bookkeeping row, zero telemetry rows, zero FK violations and unchanged Worker deployment/traffic. Windows symlink capability remains NOT VERIFIED; no mutation occurred during this final verification.

## G1-A staging verification — 2026-10-24

**DEV PROVISIONING STAGING CONTRACT / SOURCE V2 PASS.** Implemented directly above G0 `50cb49d41b0b299a0f0a0f2d34c9bd7430830cbd`, PR #74 ancestry verified. An explicit `enabled:false, staged:true` telemetry input now permits a dedicated DEV-only binding while both collection and optional metadata remain **0**. Absent/disabled output is unchanged; future enabled-mode fail-closed security validation remains intact. Fixed resource identity/known reuse guards, config-relative `../../telemetry/migrations` and a pure staged-only named migration argument planner are verified. [Implemented contract and exact commands](TELEMETRY_ARCHITECTURE.md#13-g1-a-dev-provisioning-staging-contract--2026-10-24).

158 preparation/B1 tests PASS, including the actual pinned Wrangler 4.150.0 applying unchanged telemetry SQL to disposable **local** Miniflare D1 from an unrelated cwd, exact schema reconciliation and once-only bookkeeping/zero rows. Typecheck, focused lint, canonical build/Worker validation and artifact isolation PASS. Production/template configs, SQL, package/lock and application modules are unchanged. B-07 stays OPEN, Known Issues unchanged.

**G1-B handoff (updated after PR #78):** creation is complete; G1-B is **PARTIAL**, not PASS. The [operator runbook](G1_DEV_D1_RUNBOOK.md) separates completed creation, pending migration-only and deferred Worker integration. Reverify the existing exact name/UUID/account/EU jurisdiction, unchanged deployment, current schema and approved LF/CRLF SQL; do not recreate the D1. Migration listing may initialize bookkeeping and remains inside the authorized migration phase. The existing single-migration authorization does not permit secret publication, Worker binding/deployment, enrollment or activation. G0/G2/G4/G5 and B4/runtime/hosted gates remain independent. This source correction executes no remote operation.
