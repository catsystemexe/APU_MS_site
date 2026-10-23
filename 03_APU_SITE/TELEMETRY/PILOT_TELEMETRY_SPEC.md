# PILOT_TELEMETRY_SPEC

Status: v1 measurement contract; **B1 foundation and B2 source instrumentation implemented, locally verified and disabled.** Not deployed or collecting. B3 reporting and B4 browser/runtime acceptance remain pending. Source/evidence: [audit](TELEMETRY_INFRA_AUDIT.md). Architecture and privacy: [architecture](TELEMETRY_ARCHITECTURE.md). Prepared 2026-10-23.

## 1. Pilot questions and statistical boundary

Measure whether enrolled participants return, reach useful outputs, where work is repeated or left unfinished, and how much AI consumption this requires. Do not infer pedagogical effectiveness, user satisfaction or the reason for abandonment from these events. A small voluntary pilot is descriptive, not a representative population sample. Report sample sizes, observation windows, enrollment coverage, unknown costs and collection failures alongside results. Compare participants using participant-level summaries; many sessions from one participant are not independent observations.

P0: server AI economics, actual activity and workflow. P0 conditional/P1: only already available coarse enums with explicit privacy approval. P2: additional exploratory measures. No new AI classifier, prompt/response storage, replay or student identifier.

## 2. Measurement constants and units

| Item | v1 definition |
| --- | --- |
| Participant | Cohort-scoped HMAC pseudonym derived server-side from the existing validated Access identity. Represents an Access account, not proven one human. Gate G2 applies. |
| Session | One authenticated, opted-in tab visit. Server issues a random ID at context creation. Reload/new tab creates a new session. After 30 minutes without an accepted user interaction or an authorized AI request, next activity creates a new session. Heartbeats alone do not extend it. |
| Workflow | One in-memory APU project episode, random telemetry-only ID created at first meaningful action. Reset/new-project starts another workflow without rotating the telemetry session. No new durable business project identity. |
| Start | First meaningful project input, supported need-selection or first operation against an existing notebook; viewing an empty page is not a workflow start. |
| Completion | First client-accepted, current, usable document exposed in F3, including the existing zero-extra-AI default document. Not merely clicking a tab or receiving provider success. Further accepted representations are outputs within the same workflow. |
| Output | Random telemetry ID assigned at an accepted usable F3 representation/revision. Revisiting it is not a new output. No content fingerprint, title or business record ID is exported. |
| Activity | Visible, focused page within 60 seconds of a real pointer-down, key-down, touch, scroll or supported app action. Store time intervals only; never keys, coordinates, text, DOM or event target. Initial page load does not imply activity. |
| Interval | Flush every 15 seconds while active, split immediately on phase/focus/visibility/idle boundary. Non-overlapping half-open intervals `[start,end)`; length ≤15 seconds, subject to last-interaction/idle clipping. |
| AI duration | Server call `completed_at - started_at`; independent of active page time. Pending/transport-uncertain calls have explicit status. Parallel durations are not added to infer elapsed session time. |
| Reporting day/week | Europe/Prague civil date; ISO week starts Monday. Persist UTC times, handle DST and split activity intervals at civil-day boundaries. Sessions are counted by start date; duration/cost by interval/call start date. |
| Currency | USD estimated consumption cost, no currency conversion; nonnegative integer nano-USD for stored monetary aggregates, original rate snapshot retained. Round only at display. |

Reading without interaction for more than 60 seconds undercounts engagement by design. This is an **active-time proxy**, not attention measurement. Open-page elapsed time and AI waiting time are separate. The 30-minute session rule is a pilot convention, not an existing APU behavior. Workflow recovery across reload/devices is outside v1; a lost in-memory episode cannot be reconstructed from notebook text.

## 3. Metric catalog

All metrics default to enrolled, opted-in tester traffic; operator/developer, synthetic and unknown cohorts are separately labeled and excluded from pilot summaries. Unknown is never replaced by zero. Effort is incremental LOW/MEDIUM/HIGH, not a separate estimate to add to roadmap hours. Privacy risk remains relative: L=low pseudonymous operational data; M=linkability/behavior; H=possible sensitive inference.

Event abbreviations: CTX=context/session opened; ACT=activity interval; WS=workflow started; PH=explicit phase transition; DOC=document accepted; RESET=workflow reset; OP=client operation intent/outcome; AI=server call lifecycle. Event names below are normative.

| ID / analytical question | Exact definition/calculation | Required sources | Priority | Pilot benefit | Privacy | Effort | Deferrable? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E01 What did each AI attempt cost? | One row per unique server `call_id`; provider usage and immutable pricing snapshot; cost null if not priceable. Include failed/rejected attempts. | AI start/final | P0 | Unit economics | L | L, existing ledger | No |
| E02 What token consumption occurred? | Sum known input/output/cached/cache-write token counts separately; null/missing counters reported. Cached and cache-write are input subsets, reasoning is an output subset. | AI | P0 | Cache/model efficiency | L | L | No |
| E03 Which model/operation incurred cost? | Group E01 by requested/reported model, phase, operation and rate version; unmapped model remains unknown. | AI | P0 | Find expensive operations | L | L | No |
| E04 What is each session's AI total? | Sum unique associated calls' known prices; complete estimate only when all started calls are finalized, usage valid and no uncertain-charge flag; otherwise lower-bound subtotal + unknown count. | CTX, AI | P0 | Session economics | M | M | No |
| E05 Mean session price? | Arithmetic mean of complete session estimates for mature sessions with AI; separately report all-active-session mean including genuine zero-call sessions. Publish denominators and incomplete-session count. | CTX, ACT, AI | P0 | Typical budget | M | L | No |
| E06 Median session price? | Exact median over the same eligible set as E05, including even-N midpoint mean. Never infer complete from missing events. | CTX, ACT, AI | P0 | Robust typical cost | M | L | No |
| E07 Cost to first completed output? | Per completed workflow: sum associated AI call prices with call start ≤ first completion. Include upstream extraction, grounding and failures. Calls still pending at completion keep total incomplete. Report mean/median and coverage. | WS, DOC, AI | P0 | Conversion economics | M | M | No |
| E08 Overall cost per completed workflow/output? | Known cost across all mature observed workflows / unique completed workflows; additionally known cost / unique accepted output IDs. Include unfinished-work cost in numerator. Label lower bound if any cost unknown. Zero denominator → null. | WS, DOC, AI | P0 | Pilot budget efficiency | M | M | No |
| E09 How many attempts failed? | Unique AI rows with provider failed/incomplete/transport_error, and separately completed-but-application-rejected. Pending beyond timeout is unresolved, not proven failure or free. | AI | P0 | Wasted cost/reliability | L | L | No |
| E10 How many retries/regenerations? | Count explicit same-operation retries linked by operation instance/previous call where known; separate grounding fallback, user regeneration and intended multi-stage calls. Never infer retry merely from repeated endpoint/model. | OP, AI links | P0 | Rework | L | M | No |
| U01 Sessions per day/week? | Count sessions with ≥1 ACT interval or authorized AI attempt; group by session start. Report CTX-only open visits separately. | CTX, ACT, AI | P0 | Real usage | M | M | No |
| U02 Active days per participant? | Distinct civil dates with ACT or authorized AI start for a participant; also ACT-only days. Cross-midnight intervals contribute to both dates. | ACT, AI, CTX | P0, G2 | Retention | M | M | Only if G2 unavailable |
| U03 Repeat visits? | Sessions per participant; returning account = ≥2 qualifying sessions; return-day share = ≥2 distinct active dates. Intervisit gaps use ordered session starts. Same-day reloads are shown separately from cross-day returns. | CTX, ACT, AI | P0, G2 | Continued value | M | M | Only if G2 unavailable |
| U04 Active time per session? | Length of union of clipped valid ACT intervals for session. Open duration is not substituted. | ACT | P0 | Engagement proxy | M | M | No |
| U05 Active time per participant/day/week? | Union across all that participant's tabs/sessions, split by day, then sum by week. Do not add concurrent tab time twice. | ACT, CTX | P0, G2 | Usage depth | M | M | Only if G2 unavailable |
| U06 Started/completed processes? | Unique WS workflow IDs and those with ≥1 DOC completion; first completion per workflow. Mature conversion = completed/started eligible workflows with censoring below. | WS, DOC | P0 | Task conversion | M | M | No |
| W01 Which paths were traversed? | Ordered PH transitions F1→F2→F3, plus start phase, retaining intermediate visits. Panel changes do not imply a transition. | WS, PH | P0 | Workflow fit | L | M | No |
| W02 Repeated phase visits? | Count entries into a previously visited runtime phase within the same workflow after leaving it; exclude duplicate deliveries/rerenders. | PH | P0 | Iteration pattern | L | L | No |
| W03 Backward transitions? | PH with ordinal(to)<ordinal(from). Count and sequence only; **not an error label**. | PH | P0 | Legitimate iteration | L | L | No |
| W04 Repeat operations? | Distinct operation intents grouped by workflow/operation and explicit reason (initial/retry/regenerate/fallback). Report provider attempt count separately from UI intents. | OP, AI | P0 | Rework/source cost | L | M | No |
| W05 Unfinished processes? | WS without DOC: reset-before-completion is explicit reset; ≥24h since last workflow event is unfinished-observed; newer episodes right-censored/pending. Client delivery gaps may mimic abandonment. | WS, DOC, RESET, PH, ACT, OP, AI | P0 | Drop-off | M | M | No |
| W06 Time per phase? | ACT union grouped by phase; ACT is split at transition. Unknown phase stays unknown. Show elapsed phase span only as a separate measure. | ACT, PH | P0 | Friction | M | M | No |
| P01 What kind of situation? | No safe existing closed enum for attention/behavior/communication etc.; no computation in v1. | Would require new classification | P1 | Product demand | H | H | **Yes, exclude v1** |
| P02 Type of pedagogical need? | Existing `activePath` enum POCHOPIT/POZOROVAT/VYTVOŘIT as **workflow intent**, not diagnosis or problem category; count workflows by accepted route; unknown retained. | optional `workflow_metadata` | P0 conditional, otherwise P1 | Intent demand | M | L | Yes, G3 |
| P03 Requested goal? | `f3Target`, goal/need text are free text; do not store or hash. No v1 metric. | Would require taxonomy | P1 | Desired outcomes | H | H | **Yes, exclude v1** |
| P04 Type of output? | Existing F3 `structureMode` enum auto/text/table/cards and accepted representation baseline/generated. Audience enum only if separately justified at G3. This is format, not semantic material type. | DOC optional enum | P0 conditional, otherwise P1 | Output preference | M | L | Yes, G3 |
| Q01 Is the measurement usable? | Expected-vs-stored counts in synthetic fixtures; live pending/unpriced/unlinked/late/rejected counters, sequence gaps and timestamp drift. Never claim a complete live loss denominator after a process crash. | all sources + collector aggregate health | P0 | Prevent false conclusions | L | M | No |
| Q02 Latency by operation? | Median/p95 server AI call duration per operation, finalized calls only; sample N and missing duration count. | AI | P1 | Performance context | L | L | Yes |

## 4. Event contract v1

Recommended envelope (design contract, not deployed schema): `schema_version:1`, `event_id:UUID`, `event_name`, `source:client|server`, `session_id:UUID`, `workflow_id:UUID|null`, `tab_id:UUID`, `client_seq:integer|null`, `occurred_at`, `received_at`, `app_version`, `measurement_version`, `payload`.

Server supplies participant pseudonym, cohort/version, environment and build identity; client cannot choose these. `received_at` is always server-generated. Client time is reconstructed from the signed context's server anchor plus monotonic elapsed time, not an arbitrary wall clock; drift/skew is flagged. IDs have strict syntax/length and no business meaning. `app_version` comes from trusted build metadata if available, otherwise literal `unknown` (never infer deployed SHA from a branch name).

Strict discriminated payloads; reject unknown keys recursively. No arbitrary `metadata`, URL, path, free-text reason, exception, content hash or serialized application state. Payload string fields are closed enums, UUIDs or vetted technical model/version identifiers with bounded length. Logs contain fixed reason codes/counts only, not rejected payloads or request headers.

| Stable event | Source and trigger | Allowed payload / rules |
| --- | --- | --- |
| `session_opened` | server, successful opted-in CTX creation | notice_version, opt_in timestamp, key_version, measurement_version; unique session |
| `activity_interval` | client, interval flush | anchor-relative start/end ms, runtime phase F1/F2/F3/unknown; ≤15s; no input details |
| `workflow_started` | client, first meaningful project action | start phase; exactly once per workflow |
| `phase_transition` | client, successful explicit runtime phase change | from, to, reason enum user_navigation/controller_instruction/return; sequence per tab |
| `operation_requested` | client, actual allowed action before request/local work | operation_instance_id, operation enum, reason initial/retry/regenerate, prior operation ID nullable |
| `operation_resolved` | client, accepted/failed/discarded continuation | same operation ID; outcome accepted/failed/stale_discarded/cancelled/local_noop; optional closed error class |
| `document_accepted` | client, current usable F3 document committed/exposed | output_id, representation baseline/generated; G3-gated format; first per workflow marks completion |
| `workflow_reset` | client, supported reset/new project | reason reset/new_project; close episode without changing telemetry visit |
| `session_closed` | client, best-effort logout/tab closure | reason logout/hidden_close/idle; not required for session inference |
| `workflow_metadata` | client, only with G3 enabled | activePath and/or output format only; no goal/source text |
| `ai_call_started`, `ai_call_finalized` | server adapter only | call identity, operation linkage and sanitized ledger projection in §5; persist as monotonic AI row rather than duplicate general-event payloads |

Client event endpoint cannot accept AI events, costs, tokens, model usage records, participant IDs or server status claims. Client completion is evidence of UI acceptance, not proof of provider completion; server status and client acceptance are separate fields joined by operation ID. Unknown new event version is rejected with a fixed response code; no lossy silent reinterpretation. Additive optional fields require an explicit validator revision; semantic changes require new measurement/event major version. Old reports retain their versioned definitions.

## 5. AI record projection and costing

Reuse `ModelUsageRecord` from `app/usage-ledger.ts`. Retain: generated call/request IDs, operation ID, session/workflow association, phase/operation, attempt/retry/fallback links, start/completion times, requested/reported model and service tier, provider/application statuses, normalized token numbers including missing/invalid flags, file-search count, and existing versioned rate/cost snapshot. Drop provider request/response IDs, arbitrary error codes, raw response objects and all content. Map errors to closed classes transport/provider/incomplete/invalid_output/unknown.

Source of consumption is `provider_reported` or `unavailable`; source of price is **calculated estimate**, not invoice. Formula for currently supported 30-minute cache-write regime:

`((input - cached - cache_write)*input_rate + cached*cached_rate + cache_write*write_rate + output*output_rate)/1e6 + file_search_calls*tool_rate/1000`.

Do not add reasoning tokens to output or cached/write tokens to input again. Validate subsets and finite nonnegative integers. Missing details preserve existing explicit assumptions and coverage flags. Persist rate version, rate snapshot, tier provenance and pricing regime; no second rate table in telemetry. Unknown model/tier/usage and unresolved transport charge → null complete cost. Pricing changes apply prospectively; historical repricing must be separately versioned and cannot overwrite original snapshots. 12-hour cache writes, regional uplift, fast tiers or future modalities are unsupported until priced explicitly. Current source sends no 12-hour retention setting.

Excluded overhead: vector-store storage/embeddings, Workers/D1/Access plan costs, taxes/FX, failed network calls with unknown provider usage, hidden provider-side work and manual support time. A known subtotal is a lower bound when any covered AI consumption is missing, not a fully loaded cost. Reconcile a limited operator-only aggregate sample with provider billing before real-user launch if access is separately authorized; do not import account-wide raw usage.

## 6. Data quality and output rules

- Client delivery is at-least-once within a bounded memory queue; unique event key makes acceptance idempotent. There is no durable offline replay in v1. Tab crash/navigation can lose the last ≤15s activity and queued events, or more during an outage; expose this limitation.
- Persist pending and final AI records by `call_id`; terminal rows cannot be downgraded by delayed pending writes. A pending call older than 15 minutes is unresolved, not zero cost. No provider retry is introduced by telemetry.
- Reports use a 24-hour maturation window for unfinished-work/session comparisons, with `as_of`, last-event cutoff, retention-window boundary and missing data counts. Exclude left-truncated workflows from conversion or mark them explicitly.
- Never join raw events and AI rows before aggregation in a way that multiplies call cost by event count. Deduplicate first; aggregate per session/workflow, then join.
- Internal exports are pseudonymous. Shared reports suppress groups smaller than five and complementary cells that would reveal them. Five is a reporting convention, not an anonymity guarantee; very small pilots may require only overall summaries or no shared behavioral report.
- Every CSV includes metric/measurement versions, timezone, cohort/test filter, coverage denominators and cost completeness. Divide-by-zero yields null, not zero. Preserve genuine zero-call completions.

See roadmap M4 for deterministic test vectors and gates G2/G3/G5 before activating any of this on real participants.


## 7. Implemented source coverage — B2, 2026-10-23

Measurement definitions above are unchanged. This milestone produces versioned source events/rows; it does **not** implement the aggregate calculations, retention/export tooling or reports assigned to B3. Required base is B1 `5ade93fbad714f2c047ae17f59c0073ea98479dc`; PR #66/#67 were open/unmerged and `dev` remained `fc8ac5520b7b49b442bedc47558c73f20ce2bea6` at initial verification, so B2 is stacked directly over B1.

| Metrics | Implemented B2 source coverage | Remaining boundary |
| --- | --- | --- |
| E01–E03, E09, Q02 | Pending/final server rows from all six AI routes, controller and MAIN streaming; existing token normalization and immutable calculated-price snapshots. Provider/app-invalid/transport/incomplete outcomes retained. | No invoice/provider-account reconciliation; reporting/statistics in B3. Unknown charge stays incomplete/null. |
| E04–E08 | Session/workflow/operation UUID association, server start/completion time, one monotonic row per call; accepted baseline/generated document events. | Complete-price means/medians, cost-to-completion and coverage aggregates in B3. No raw event×call multiplication is introduced. |
| E10, W04 | Distinct request intents/outcomes, explicit retry/regeneration and prior-operation linkage; grounding rescue has attempt 1 and a fallback link to primary grounding. Controller+MAIN remain normal calls within one client operation. | No inferred retry linkage from endpoint repetition or hidden provider IDs. |
| U01–U05, W06 | Per-visit context plus visible/focused intervals, real-interaction 60s idle clipping, 15s chunks, phase/focus/visibility splits, 30m visit renewal on a genuine interaction/request and 12h expiry. HMAC participant/cohort stays server-side. | Civil date/week/DST splitting and cross-tab/participant interval union in B3; intervals are an active-time proxy. |
| U06, W01–W03, W05 | Exactly one start per in-memory episode, reset without visit rotation, actual explicit phase changes/backward navigation, accepted usable baseline F3 without a new AI call, accepted generated material after state commit. | Maturation/censoring/conversion aggregates in B3. Retained representation revisit and React effect replay are not new output events. |
| Q01 | Strict B1 validation/dedup/budgets, fixed readiness/health codes and queue-drop status, explicit pending/unpriced/incomplete records, immutable sequence/clock/operation associations; synthetic expected/stored reconciliation. | No complete live loss denominator after crash or lost memory queue; B3 reports must expose partial episodes/coverage. |
| P01–P04 | No new content taxonomy or AI classification. Optional route/format fields remain off and no metadata emitter is activated. | G3 and any metadata/report work remain separate. Goal/need/source text is never telemetry input. |

Client operation tickets capture the original visit/workflow/consent generation before dispatch. Reset marks old outcomes stale without associating old AI costs with a new episode. Stop/identity uncertainty drops queued tracking immediately; later server finalizations from already authorized requests retain original scope. A stale or boundary/error F3 result never produces `document_accepted`. The commit observer consumes a staged explicit acceptance once; it does not infer a document from a render alone.

No new browser participant identifier/storage is added. A minimal, optional server page bootstrap returns only eligibility and controller-configured notice text/version, after existing Access validation and B1 privacy/enrollment/DEV gates. Missing approved `APU_TELEMETRY_NOTICE_TEXT` suppresses the opt-in UI. Refusal leaves the app usable; stop and identity uncertainty stop tracking. Notice configuration and technical tests do not themselves approve real collection. All actual runtime configuration remains disabled/unchanged.

**V3 source PASS:** 573 relevant provider-free tests, typecheck, focused lint (zero errors, the same five preexisting APU-client warnings as B1), canonical build and Worker artifact validation. Exact commands, emitter map and limitations are in [architecture §11](TELEMETRY_ARCHITECTURE.md#11-implemented-b2-core-metrics-and-verification--2026-10-23). No actual provider request, remote infrastructure mutation, hosted update, real data collection or deployment occurred.
