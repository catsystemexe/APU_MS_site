# TELEMETRY_ARCHITECTURE

Status: DEV-only v1; **B1 foundation and B2 source instrumentation implemented and locally verified; disabled, not provisioned or deployed**. B3/B4 remain planned. Decision basis: [audit](TELEMETRY_INFRA_AUDIT.md), source `fc8ac5520b7b49b442bedc47558c73f20ce2bea6`. Measurement authority: [specification](PILOT_TELEMETRY_SPEC.md).

## 1. Decision and alternatives

Use **the existing standalone DEV Worker + a small telemetry adapter/collector + dedicated DEV D1**, reusing the existing server AI usage ledger. D1 is selected after comparing the audited persistence rather than assumed by default. No external host, analytics vendor, queue, event bus, dashboard application or business database migration is needed.

Ratings: L/M/H = implementation/operating burden; reliability is relative to exact small-pilot joins and costs, not universal service reliability.

| Option | Implementation / APU fit | Cost / minimization | Measurement and export | Decision |
| --- | --- | --- | --- | --- |
| Existing request ledger + diagnostic Session JSON only | L; already exists | Lowest; JSON contains disallowed content if reused whole | Voluntary developer-only export; misses testers, crashes and abandoned sessions; no activity baseline | Useful local comparison fixture, insufficient primary store |
| Existing business persistence | No active app database found; D1 stub only | Reuse advantage unproven | No existing schema/store to extend | Reject assumption; do not activate business DB |
| DEV LOG KV | M; same Worker but unrelated ownership | Low at tiny scale; Free write allowance restrictive | Append keys/listing/export/dedup and exact concurrent totals need custom work; eventual consistency | Keep for DEV LOG, do not repurpose |
| Dedicated D1 | M; native binding/types already available | Low; isolated retention and EU DB jurisdiction possible | SQL uniqueness, exact call rows, cohort/session/workflow joins, SQL/CSV export | **Recommend** |
| Analytics Engine | L ingest / M reporting | Low, but billing status provisional; residency not verified | Sampling, fixed retention and limited primary-ledger semantics complicate exact paths/cost completeness | Possible later aggregate sink, omit v1 |
| R2 objects / manual uploads | M; no active R2 binding | Low bulk storage, extra resource | Must build indexing, dedup and query layer | No simplicity gain |
| External SaaS/DB, new Durable Object/Queue | H new lifecycle/integration | New processor/resource and operational obligations | Could improve specialized delivery but unnecessary for expected pilot | Defer unless measured loss/load proves need |

## 2. Boundaries and module ownership

```mermaid
flowchart TD
  A["APU interaction"] --> C["Client telemetry adapter"]
  B["Server AI usage ledger"] --> D["Request telemetry adapter"]
  C --> E["Same-Worker validated collector"]
  D --> E
  E --> F["Dedicated DEV D1"]
  F --> G["Operator SQL / CSV reports"]
```

Suggested repository-native boundaries (new module names may be adjusted locally without changing contracts):

- `app/telemetry/contract.ts`: strict envelope/event validators, enums, measurement version; no React, provider or storage imports.
- `app/telemetry/client.ts`: in-memory context/queue, activity clock, event emission. No pedagogical state serialization and no persistent browser participant ID.
- `app/telemetry/server.ts`: opt-in/eligibility, existing-identity pseudonym derivation, signed context validation, server-owned envelope fields, fixed health codes.
- `app/telemetry/store.ts` plus `app/telemetry/d1-store.ts`: small explicit insert/upsert/query interface; no generic event bus.
- `app/telemetry/model-usage-adapter.ts`: whitelist projection from existing ledger, pending/final monotonic state, request context and contained failures.
- `app/api/telemetry/context/route.ts` and `app/api/telemetry/events/route.ts`: same origin, existing `getAccessIdentity`, no authentication-policy changes.
- `telemetry/migrations/`, `telemetry/reports/`, `scripts/telemetry/`: telemetry-only SQL, bounded local reporting/export/retention tools. Keep empty business `db/schema.ts` and `getDb()` untouched.

APU emits semantic events at supported actions/commits. Telemetry never owns notebook/analysis/output state, phase transitions, saved projects, price selection or provider retry decisions. Adapter failures cannot modify a pedagogical result. UI component reorganization changes only local emitters; persisted schema and report definitions remain stable. No component-name or CSS-selector event naming.

## 3. Identity, enrollment and session context

### Proposed participant identity (G2)

The existing auth validator exposes no opaque subject ID; it returns a normalized validated email and role. Within a separate telemetry adapter derive:

`participant_id = base64url(HMAC-SHA256(TELEMETRY_PSEUDONYM_KEY, cohort_id + "\\0" + normalized_existing_identity))`.

The email is consumed only from the existing validated in-memory identity; it is **not copied to telemetry storage, events, exports, client context, logs or a mapping table**. Do not add email/JWT/sub claims to authentication. A plain email hash is unacceptable because the space is enumerable. Store `cohort_id` and `key_version`; keep one cohort key stable for the pilot. Rotation starts a documented linkage break/new cohort; no silent historical merge. Different cohorts must not share a pseudonym. Pseudonym key and context-signing key are distinct secrets; no values are supplied by this package.

This is pseudonymization, **not anonymity**. Existing authenticated identity is still processed for a new purpose and the controller can recompute a pseudonym. Gate G2 explicitly approves that narrow use; if disallowed, disable stable participant linkage and mark U02/U03/U05 unavailable rather than inventing a fingerprint. Do not silently substitute persistent cookies/localStorage, browser fingerprint, IP, account email or a client-selected participant UUID.

Eligibility uses an operator-maintained allowlist of participant HMACs for the cohort and existing tester role. It does not grant access, change roles or provision users. An empty/missing allowlist disables real collection. Development/operator and synthetic contexts are labeled separately and excluded by default; synthetic fixtures use generated identities only. Enrollment and opt-in completion must precede writing participant-linked telemetry.

### Context handshake

1. When disabled or ineligible, adapter is a no-op: no telemetry context/write, no browser tracking persistence, no new collection requests.
2. Existing auth remains necessary. After the user receives the approved notice and explicitly opts in for this tab visit, `POST /api/telemetry/context` creates a server session. Opt-in evidence records notice version and server time; do not treat a request flag alone as proof of ethically valid consent without the approved UI/process.
3. Return an opaque signed context token, random session ID, server time anchor, monotonic-anchor protocol parameters, measurement version and policy flags. Participant ID need not be returned to the browser. Token contains/commits to server-side cohort, session, HMAC subject, issue/expiry and key version; keep it in memory only, never URL/storage/logs.
4. Context token is additional telemetry context, **not an authentication credential**: every collector/AI request still validates Access as before; token subject must match that identity. It cannot authorize application operations. Require exact same-origin requests and JSON; reject cross-origin origin/header use; no wildcard CORS. Context responses are private/no-store.
5. Attach bounded telemetry context/operation headers to existing AI API requests. Invalid/missing telemetry context cannot block otherwise valid APU work; skip association and expose fixed telemetry health status where appropriate. Never accept client price/token data to repair missing context.
6. New tab/reload gets a new session. Thirty-minute real inactivity rotates at next interaction/request; AI started before the boundary remains in its original session. Heartbeats cannot keep a session alive. Token maximum lifetime 12 hours; renewal after expiry uses a new session. Logout/identity uncertainty immediately stops client tracking/flush; pending authorized server calls retain their original scope.

Session state stores last genuine interaction/request time, not just heartbeat receive time. Client intervals carry monotonic last-interaction offset so a periodic timer cannot masquerade as renewed user activity. Client activity is necessarily an estimate and can be falsified by a modified browser; use it for pilot analytics, not billing or access decisions.

No persistent analytics cookie/localStorage is introduced. A per-visit consent prompt adds friction but is the smallest default consent mechanism without persistent tracking. A future remembered-consent preference would require its own device-storage analysis and expiry design.

## 4. Storage contract and integrity

Three logical tables suffice; SQL migrations are authored during B1, not executed remotely by the audit:

| Table | Keys / purpose | Constraints and indexes |
| --- | --- | --- |
| `telemetry_sessions` | server session ID, pseudonym, cohort, role/test class, consent/notice/measurement/key versions, opened/last interaction/expiry times | No email/IP/JWT; session ownership immutable. Index cohort/opened_at and participant/opened_at. |
| `telemetry_events` | unique event ID, session/workflow/tab IDs, client sequence, timestamps, event/measurement versions, phase and strict typed payload | UUID key; uniqueness `(session_id,tab_id,client_seq)`; session relationship; event/time and workflow/time indexes only as reports require. No generic JSON bag. |
| `telemetry_ai_calls` | unique server call ID and safe ledger projection, operation/session/workflow association, pending/final state, pricing snapshot | Session/workflow+started time indexes; immutable identity check; terminal update monotonic. No repeated event rows storing the same cost. |

Workflow summaries are derived from WS/DOC/RESET and AI joins, not another mutable business state table. Missing workflow-start event leaves an explicitly partial episode. Server AI can retain a valid UUID workflow association even if its start event was lost; conversion reports exclude/label partial episodes. Keep SQL parameterized and bounds enforced in both adapter and collector. Migration version and report version are explicit.

Deduplication: same ID/sequence and identical immutable identity is idempotent; conflicting ID or reused sequence with a different event is rejected with fixed conflict code. Do not return success for a conflicting body. Validate entire batch before transaction; ≤20 events and ≤32KiB total request; per-event limit 2KiB. Unknown fields/versions/negative times/oversized UUIDs/client server-event claims fail closed. Normal duplicates return acknowledged IDs without double counting. Do not persist raw rejected bodies.

Use one short atomic D1 batch/transaction for validated event insertion and necessary session update. Preaggregate AI calls before joining general events. A late pending insert cannot overwrite a finalized call. A later terminal row with conflicting immutable identity is a quality conflict; it cannot silently rewrite another participant/session.

Bound ingestion abuse without collecting IP: enforce an atomic per-session budget of 120 submitted events/minute, including duplicates, plus at most 30 context creations/hour per eligible pseudonym. Normal activity uses four intervals/minute; excess returns fixed 429/backoff with no payload logging. Store budget counters with the existing session update rather than another global hot counter; context-rate checks use the participant/time index. Enrollment, request-size limits and an operator kill switch bound the small pilot; this is not a general DDoS platform. Include budget-update writes in capacity estimates and test that overload affects collection only. Do not change Access/WAF configuration as part of this feature.

## 5. Reliable enough delivery, without another infrastructure layer

Client queue is memory-only, max 100 events, max age two minutes; batch every 15 seconds during activity and immediately on semantic boundaries when reasonable. Retry only network/5xx/429 transient ingest failures, max two retries with jitter/backoff bounded by age; same IDs on retry. Do not retry invalid schema/401 or prompt reauthentication through telemetry. Drop oldest expired events with fixed health count. `fetch(...,keepalive:true)` at visibility exit is best effort, not durable delivery. Avoid a second offline database, localStorage queue or infinite retries.

Server adapter composes the existing request collector; records remain available for current developer UI independently. Persist pending before provider invocation on a bounded best-effort path; at most 100ms added blocking budget per lifecycle write. Do not let a rejected/timed-out sink throw into `runInstrumentedModelCall` or change AI result. Preserve the underlying write promise only through request-scoped execution lifetime (`ExecutionContext.waitUntil` or the existing runtime-supported equivalent); never store it, identity or context in a Worker-global variable. Terminal completion uses the same request lifetime, including streaming MAIN. B1/B2 must prove the exact Vinext request-lifetime mechanism in the pinned runtime with a small integration test; do not invent a global context bridge.

Promise timeout does not cancel a D1 write. Late writes are safe because IDs and state updates are idempotent/monotonic. No automatic AI retry is added. If request-lifetime integration cannot be made request-scoped, stop that adapter substep and report the specific gap; other contract/report work can continue. A bounded awaited sink with explicit measured latency can be considered in a subsequent decision, not silently substituted.

There is no exactly-once guarantee between provider invocation and database storage. A crash may lose even the pending event. A pending record can signal unknown charge; it cannot recover provider usage. Reports show observed lower bounds, missing finalizations, collection-health counters and synthetic expected/stored reconciliation. A live complete cost total means complete **for observed calls**, not proof the cloud never lost a call. Do not solve this with a queue/DO unless pilot verification demonstrates material loss. Capture fixed server health counters/return metadata, not pedagogical payloads or user identifiers in console logs.

Session/activity clocks: handshake binds a server anchor to tab monotonic elapsed time. Validate bounded receive delay (two minutes) and >5s clock inconsistency; flag/reject unsuitable intervals rather than assigning them to a wrong day. Split at visibility/focus/idle/phase boundaries, cap to real intervals, and reset after suspend. Participant totals merge overlapping intervals across tabs. Device clock edits cannot create arbitrary active time. Dictation/passive reading are only partially covered by interaction proxy; no microphone or content instrumentation is added.

## 6. AI economics and integration map

Use `createRequestUsageCollector` with an optional safe persistence callback. Request adapters are created **after existing auth validation** for `/extract`, `/chat`, `/analysis`, `/need-route`, `/f2`, `/f3`; `quest-controller` inherits the same request collector. One request may contain multiple calls, each with its own `call_id`. MAIN streaming uses its existing `createInstrumentedModelCallLifecycle`, not a separate fetch patch or second ledger.

Pass operation instance IDs (new random UUIDs per explicit action), prior-operation IDs for user retry/regeneration, and server retry/fallback linkage for actual secondary provider attempts. The grounding rescue in `/extract` is a fallback, not a duplicate user action. Keep server-generated request/call identity authoritative; don't change existing business turn IDs or schema merely for telemetry.

Telemetry prices are existing ledger snapshots. Add only coverage/regime/version metadata needed to report incomplete estimates. If supported pricing behavior changes, update the existing authority and its tests, not telemetry rate constants. Before launch validate a provider-backed controlled sample only under separate authorization; no new API key or paid request is authorized by source implementation batches.

Client emitters observe:

- successful explicit runtime transitions, including returns from F3 to F2;
- `resetCurrentProject` as workflow reset, without inheriting its diagnostic session rotation;
- `commitBuildDocument`/accepted source and `enterF3` for usable baseline completion;
- `renderF3` only after successful `acceptF3Render`; stale/boundary/failed results are not accepted outputs;
- explicit F2 local-only reconciliation as an operation with no AI calls;
- operation intent before supported extraction/chat/F2/F3 requests; obsolete continuations can record `stale_discarded` while their incurred server AI cost remains.

No new event is emitted merely because React rerenders, a panel opens, a state effect replays, or a retained output is revisited.

## 7. DEV-only enablement and configuration

Proposed names: `APU_TELEMETRY_ENABLED=0` default, `APU_TELEMETRY_ENV=dev`, `APU_TELEMETRY_COHORT`, `APU_TELEMETRY_METADATA_ENABLED=0`, dedicated `TELEMETRY_DB`, pseudonym/context secret names and eligible participant HMAC set. No values are embedded in repository prompts. Cohort/token/policy configuration is versioned.

Require positive DEV environment marker, explicit expected DEV hostname, opt-in and eligible cohort before collection. Host is a safety condition in a known deployed Worker, not an auth mechanism. Missing/invalid binding/key/config fails to no-op collection and visible fixed readiness error to the operator; application flow stays usable. Local tests explicitly use synthetic mode/emulated storage. No automatic derivation from branch names or `NODE_ENV=production` because hosted DEV also uses production build mode.

Extend `wrangler.dev.json` and `ops/dev/prepare-worker.mjs` during B1 with **optional disabled telemetry inputs**. Absent telemetry must produce the preexisting config; enabled future DEV configuration requires a dedicated DB identity and isolation evidence. Preserve exact key validation for unrelated fields. No change to `wrangler.jsonc`, old PR60 guard, deployment workflow, default `npm run deploy`, Access policy or production resources. Do not invoke deploy commands or remote migration during code batches.

## 8. Reporting, retention and deletion

Use operator-controlled SQL and local CSV generation first. No new HTTP admin/export endpoint or dashboard. Parameterize cohort/date windows; default exclude developer/synthetic. Raw SQL export stays restricted to operator; shared CSV defaults to aggregates and suppresses small cells. Reports include sample/coverage/measurement versions and distinguish baseline output from generated material.

Proposed base retention: **30 rolling days of raw events/AI/session pseudonyms**; optional aggregate retention 180 days only after review and sufficiently coarse aggregation. Retention operates on event/call dates, not indefinitely on last session update. Operator runs the checked retention command daily during collection; require an assigned owner and recorded schedule before launch. Do not create an automation in this audit. At first scale increase, a same-Worker scheduled cleanup may replace manual operation through its own authorized change.

SQL/CSV exports expire after seven days unless the controller documents a different justified period. Participant deletion derives the same HMAC under retained cohort key version and deletes related sessions/events/calls transactionally; no email mapping table. Retain a minimal restricted deletion ledger/tombstone outside shared reports as required for replay after restore, under approved controller procedure. Backup history can persist 7/30 days by plan; restored data must have retention/deletion replayed before reporting. Do not promise instantaneous erasure from provider backups. Include incomplete/left-truncated observation handling after retention.

## 9. Privacy gates — no automatic compliance claim

The telemetry dataset is personal data when linked to a participant pseudonym. Small cohorts, exact times, repeated behavior and route choices can reveal a teacher or infer sensitive classroom circumstances. Broad content category labels can still relate to identifiable children. Hashing content does not make it safe.

Before real collection, the responsible controller must record:

1. Purpose, controller/processor roles, applicable legal basis, recipients, notice, retention, rights/deletion channel and whether a DPIA is needed. Do not characterize pilot consent as automatically valid in an employment/education power relationship.
2. Approval of the transient existing-identity HMAC use and cohort eligibility. No raw identifiers in telemetry; no staff-performance ranking or child tracking.
3. Device-storage/ePrivacy analysis separate from GDPR basis. ÚOOÚ [PR1 in audit] requires prior demonstrable consent for nontechnical cookies/similar technologies; reusing a necessary auth cookie for another purpose is not automatically exempt. Memory-only analytics avoids adding a persistent browser ID but does not remove all legal analysis of client tracking.
4. Approved per-visit voluntary opt-in flow, equally usable app after refusal, stop/revocation behavior and proof/version of the notice. No collection before opt-in or after stop; stopping does not silently imply retrospective deletion, whose process is separately available.
5. Cloudflare/provider agreements, international access/processing and current log retention. D1 EU jurisdiction alone does not constrain global Worker, Access, edge logs or OpenAI processing. Application telemetry must never copy IP/country/user agent/headers; platform processing/logging must be reviewed separately.
6. Export recipients/access and small-cell review. Optional G3 route/format metadata must be justified; situation/need/goal text and extra AI classification remain off.

These are activation conditions, not a declaration of GDPR compliance or a redesign of APU authentication. If gates cannot be met, keep collection disabled; preserve synthetic validation capability and report the affected P0 metrics unavailable.


## 10. Implemented B1 contract and verification — 2026-10-23

Source baseline: `dev` at `fc8ac5520b7b49b442bedc47558c73f20ce2bea6`. The checkout initially contained legacy `7ea7af27273d4a723652e091fffbc22f32e8c8ea`; it was advanced to the verified DEV source and documentation commit `f850f3b6555fd4f5b07cf50f8163d4fbe3db9f16` from PR #66 (still draft/unmerged at inspection). B1 explicitly permits including the reviewed documentation commit. No unrelated application changes exist between the audited DEV source and that documentation commit.

Implemented boundaries:

- `app/telemetry/contract.ts`: strict v1 discriminated client events, closed enums, recursively rejected unknown keys, batch/UUID/size/time limits. Wire events use `elapsed_ms`; trusted `occurred_at`, `received_at`, build (`unknown`) and participant/cohort are server-owned. `POST /api/telemetry/events` accepts exactly `{context, events, sent_elapsed_ms}`. Send-time anchor skew over five seconds and queue delay over two minutes are rejected independently.
- `app/telemetry/server.ts` and the context/events routes: existing Access authentication, cohort HMAC enrollment, distinct pseudonym/signing keys, private/no-store, exact origin/JSON, context expiry/ownership/tab binding and stop. Context start accepts exactly `{action:"start", opt_in:true, notice_version, tab_id}`; stop accepts `{action:"stop", context}`. The signed token commits to the immutable server session through its random lookup ID, expiry and key version; participant pseudonyms are not returned to the browser. `session_opened` is represented once by its validated session row (opening time is the opt-in timestamp), rather than duplicating it in general events.
- `app/telemetry/client.ts`: typed `createTelemetryClient()` with explicit `optIn`, `refuse`, `stop`, `identityUncertain`, eligibility, interaction, emit/flush and operation-header interfaces. Default construction and refusal generate no IDs, timers, requests or browser tracking persistence. The opted-in queue is memory-only, bounded to 100 events/two minutes, 20-event batches/15 seconds and two transient retries with stable event IDs. The initial B1 milestone supplied no emitters. B2 now supplies the optional notice/UI and genuine interaction/semantic emitters described in §11; all activation gates remain closed by default.
- `telemetry/migrations/0001_pilot_v1.sql`, `store.ts`, `d1-store.ts`: three telemetry-only tables, parameterized statements, atomic D1 batch ingestion, session/context budgets, conflicting event-ID/sequence rejection and monotonic AI upserts. Identical duplicate events retain original receive time. Stop-vs-ingest interleaving is checked at SQL commit. Business `db/schema.ts` and `getDb()` are untouched.
- `model-usage-adapter.ts`: explicit safe projection from the existing ledger (no provider IDs, business turn IDs, arbitrary errors or content), integer nano-USD and incomplete-cost flags. AI records carry server-only v1 lifecycle discriminants. `createRequestTelemetrySink(request, validatedIdentity)` is the B2 entrypoint after existing authentication; pass its `.sink` to optional `createRequestUsageCollector(persistence)`. Default collectors preserve synchronous behavior. MAIN may retain the same collector in its existing stream lifecycle.
- `runtime.ts` and `worker/index.ts`: request-local resource scope via `AsyncLocalStorage`, separate from request identity. The **pinned Vinext 0.0.50** `server/app-router-entry` already calls `runWithExecutionContext(ctx, handleFn)`; its exported `vinext/shims/request-context` accessor provides the request's `waitUntil`. The adapter captures that lifetime and immutable association once, retains contained late write promises there, and bounds added waiting to 100ms per lifecycle write. Missing lifetime returns a no-op; no global request identity/context or new host is introduced.

Readiness requires `APU_TELEMETRY_ENABLED=1`, positive `APU_TELEMETRY_ENV=dev`, exact dedicated DEV hostname, dedicated `TELEMETRY_DB`, valid cohort/key/notice versions, distinct sufficiently long `TELEMETRY_PSEUDONYM_KEY`/`TELEMETRY_CONTEXT_KEY` and HMAC enrollment in `APU_TELEMETRY_ELIGIBLE`. Real tester contexts additionally require `APU_TELEMETRY_PRIVACY_APPROVED=1` (the controller's G2 decision, never inferred by code). Local synthetic fixtures explicitly set `APU_TELEMETRY_SYNTHETIC=1`, accept only generated `@synthetic.invalid` identities and permit localhost. Metadata remains separately off by default. Neither a request flag nor technical PASS constitutes privacy approval.

DEV template defaults remain off. Preparation accepts the original five inputs unchanged, optional `telemetry:{enabled:false}`, or an explicit enabled shape with `databaseId`, exact dedicated `databaseName`, `dedicatedDev:true`, exact DEV `hostname`, `cohort`, `keyVersion`, `noticeVersion`. Absent/disabled inputs produce byte-equivalent legacy materialized configuration. Enabled preparation adds only `TELEMETRY_DB` and scoped DEV variables; it supplies no keys, enrollment or privacy approval. `dedicatedDev` is an input declaration, not live resource evidence: G0/G1 must independently verify the supplied database identity before any separately authorized hosted action. No production Wrangler configuration, release-context guard or deployment workflow changed.

**V3 local technical PASS (Codex Cloud, 2026-10-23):**

```sh
npm run typecheck
node --test tests/telemetry.test.mjs tests/access-control.test.mjs tests/server-capabilities.test.mjs tests/dev-worker-preparation.test.mjs tests/deployment-config.test.mjs tests/openai-responses-instrumentation.test.mjs tests/model-call-instrumentation.test.mjs
npx --no-install eslint app/telemetry app/api/telemetry worker/index.ts app/openai-responses-instrumentation.ts ops/dev/prepare-worker.mjs
npm run build
npm run validate:artifact
```

Relevant suite: **271 tests passed, zero failed/skipped**. Telemetry tests use generated identities/keys, actual in-memory SQLite over the authored migration and an atomic D1-shaped adapter. They cover consent/refusal/stop, commit-time withdrawal races, budgets, validation/dedup conflicts, clocks, disabled HTTP/client modes, real JWT verification with synthetic JWKS, sanitized/monotonic AI persistence and contained failures/timeouts. Runtime integration delegates through the actual pinned Vinext Worker entry with a synthetic RSC handler, interleaves two participants and completes late streaming writes via their respective request lifetimes. Existing server-capability tests mock provider transport only; no actual provider request occurred. This is local source/runtime-contract evidence, not hosted Cloudflare or browser acceptance (B4).

CI provenance remains separate: feature/docs → dev is known to fail `release_context_rejected / unsupported_pr_branches` before technical checks. No CI policy change is included. Collection, infrastructure/key provisioning, remote migrations, hosted updates and deployment remain **NOT AUTHORIZED and not performed**. G0–G5 remain open; B2 source completion is recorded below, while B3/B4 remain pending.


## 11. Implemented B2 core metrics and verification — 2026-10-23

B2 is stacked directly on required B1 commit `5ade93fbad714f2c047ae17f59c0073ea98479dc`. At inspection PR #66/#67 were not integrated into `dev` (`fc8ac5520b7b49b442bedc47558c73f20ce2bea6`). No alternative architecture or dependency/infrastructure change is introduced.

### Actual integration map

- `app/api/{extract,chat,analysis,need-route,f2,f3}/route.ts` create the B1 safe persistence adapter after existing authentication, validation and relevant preflight gates. Existing request collectors still own developer records and response filtering; tester responses contain no usage/diagnostic fields. `quest-controller.ts` inherits the chat collector without another provider wrapper.
- The existing MAIN streaming lifecycle writes pending/final records through that same collector. `SafeRequestSink.retain()` preserves the **entire existing MAIN pump** under its captured request `waitUntil`, so downstream cancellation stops delivery but does not discard the provider completion/cost. Closed downstream enqueue/close is contained; no additional provider request or AI retry is introduced. The prior 100ms per-write waiting bound is retained, including late terminal-before-pending writes.
- Existing non-chat server request/call IDs are preserved in projection. **Narrow integration correction to B1:** chat accepts a diagnostic request ID from the client (often `req-…`, not the B1 UUID contract). Its telemetry adapter now assigns one independent server-owned request UUID for controller+MAIN while leaving all original diagnostic IDs/records unchanged. A raw client request ID is never persisted as trusted telemetry. The safe sink option is additive and other routes keep their existing server request UUIDs.
- `openai-responses-instrumentation.ts` forwards optional attempt/retry/fallback fields to the existing ledger. `/extract` labels only an actual grounding rescue as attempt 1 with `fallback_for_call_id` pointing to the primary grounding call, not extraction. User retries are linked by operation UUIDs where known; normal extraction/grounding/controller/MAIN stages are not relabeled retries.
- `activity-clock.ts`, `pilot.ts`, `fetch.ts`, `use-pilot.tsx` provide the opted-in clock/visit/workflow/operation coordinator. Only visible/focused periods within 60 seconds of real interaction count. Keystrokes/scrolls update a time anchor and coalesce into intervals, rather than emitting one event per input. Phase/focus/visibility/idle boundaries split intervals; sleep gaps over 20s and wall/monotonic inconsistency over 5s are discarded conservatively. Request activity extends visit inactivity separately and does not fabricate active-page time.
- The existing server-rendered page passes minimal optional eligibility/notice configuration. All B1 gates plus controller-configured `APU_TELEMETRY_NOTICE_TEXT` must pass before showing the nonmodal per-visit opt-in/refusal/stop controls. No context/write occurs merely from page bootstrap. Browser listeners/timers are registered only after opt-in and do not inspect key values, targets, coordinates, text or microphone data. Existing Access invalidation immediately clears tracking; authentication behavior itself is unchanged.
- `apu-client.tsx` begins episodes at meaningful input/manual notebook change/need selection or an operation against existing work. Actual outbound Need Router/extract/chat/analysis/F2/F3 calls carry captured operation headers. Cached Need Router work does not produce a new intent on a rerender. Explicit retry controls/status and generated-material requests carry retry/regeneration reasons; local F2 reconciliation is an accepted operation with no AI call.
- Successful explicit navigation records F1/F2/F3 transitions and returns; panel-only changes do not. Reset emits an episode reset without rotating the telemetry visit. Server AI scope and client operation tickets retain the original episode across reset, navigation, late results and concurrent requests. Old consent generations cannot complete or change the path of a new telemetry visit.
- `document-observer.ts` confirms staged explicit actions against committed F3 state. Default usable analysis is accepted once on actual F3 exposure, with zero additional F3 calls. `commitBuildDocument`, explicit source adoption and presentation restoration stage exposure as applicable. Generated material must survive `acceptF3Render` source/config/epoch guards and commit before counting. Boundary/stale/error states and effect replay cannot complete. Local deduplication uses opaque tokens/weak references; no source fingerprint, business ID or content is exported.

No current configuration is enabled, no persistent browser participant identifier exists and `wrangler.jsonc`, DEV defaults, business persistence, auth policy, prompts/model routing and CI release-context policy are unchanged. Optional client context renewal adds at most 100ms of waiting before a request; missing/failed metadata falls back to the original fetch exactly once. Default-off and ready-context delegation invokes the original fetch synchronously. Network/provider errors never trigger a telemetry-driven provider retry.

### V3 evidence

Codex Cloud, Node 24.19.0; synthetic identities, test keys, mocked JWKS/provider transport and local in-memory SQLite over the authored B1 migration only. **573 tests PASS, zero failures/skips**, including original access/session, ownership/reset/isolation, F1 grounding/rescue, F2/F3 stale/navigation/acceptance and usage/pricing contracts.

```sh
npm run typecheck
node --test tests/telemetry.test.mjs tests/telemetry-b2.test.mjs tests/server-capabilities.test.mjs tests/project-usage-isolation.test.mjs tests/project-reset.test.mjs tests/model-call-instrumentation.test.mjs tests/openai-responses-instrumentation.test.mjs tests/usage-ledger.test.mjs tests/model-usage-endpoint-contract.test.mjs tests/model-usage-streaming-contract.test.mjs tests/model-usage-client-contract.test.mjs tests/model-usage-collection.test.mjs tests/access-control.test.mjs tests/notebook-ownership.test.mjs tests/f2-build-model.test.mjs tests/f2-need-routing.test.mjs tests/f2-need-route-api.test.mjs tests/f2-api-contract.test.mjs tests/f2-rozbor-render.test.mjs tests/f2-single-path-ui.test.mjs tests/f3-finalization-model.test.mjs tests/f3-generation-eligibility.test.mjs tests/f3-navigation.test.mjs tests/f3-baseline.test.mjs tests/f3-baseline-ui.test.mjs tests/f3-baseline-api.test.mjs tests/f3-api-contract.test.mjs tests/dev-worker-preparation.test.mjs tests/deployment-config.test.mjs tests/extract-route.test.mjs tests/f1-production-grounding-rescue.test.mjs tests/f1-production-rescue-pipeline.test.mjs tests/f1-grounding-observability.test.mjs tests/analysis.test.mjs
npx --no-install eslint app/telemetry app/apu-client.tsx app/page.tsx app/api/{chat,extract,analysis,need-route,f2,f3}/route.ts app/openai-responses-instrumentation.ts
npm run build
npm run validate:artifact
```

Lint exits successfully with zero errors and the same five existing unused-variable warnings (`ChevronLeft`, `ChevronRight`, `analysisRefresh`, `setAnalysisRefresh`, `compactAnalysisNotebookKey`) independently reproduced from B1 source. No unrelated cleanup was performed.

The full synthetic workflow stores eight real-route AI attempts (including grounding rescue), six operation intents/outcomes, four phase transitions and exactly baseline+generated accepted-output events. The baseline exposure occurs after seven upstream calls and adds **zero** F3 calls; only the later explicit generated representation adds the eighth. Controller+MAIN remain distinct calls with one shared operation/request association. Tests compare exact provider payloads/counts and pedagogical results across off/on/broken telemetry for every endpoint; fresh preexisting analysis IDs are compared with their reference graph preserved.

Failure tests hold all four controller+MAIN lifecycle writes while both provider calls finish, then release final writes before pending writes: two final rows survive, with no additional provider calls. Four 100ms waiting budgets took approximately 415ms in the isolated test run (asserted with scheduler margin). A cancelled downstream MAIN retains provider completion and known cost. Separate fixtures prove session/participant interleaving, reset and consent-generation isolation, bounded queue/dedup, 30m renewal, frequent typing coalescing, phase/focus/idle/sleep bounds and no activity inferred from AI waiting.

This is **local source/runtime-contract PASS**, not browser, hosted Cloudflare or provider-functional acceptance. Collection remains best effort: pre-opt-in work is not backfilled; queue/crash/disconnect/identity-pause windows can lose client events; clock suspension gaps are deliberately discarded. B3 must retain partial episodes, union concurrent participant intervals and report cost/observation coverage. Aggregation, reporting, retention/delete/export tools, G3 metadata activation and B4 browser acceptance are not implemented here.

CI provenance remains separate: the current workflow targets PR bases `dev/next/public`; a stacked PR against the B1 feature branch is outside that trigger. The existing B1 [PR #67 run](https://github.com/catsystemexe/APU_MS_site/actions/runs/39924485625) records `release_context_rejected / unsupported_pr_branches` for feature → dev before technical checks. No guard change or merge is included. Provisioning, remote migrations, hosted update, actual provider requests, real-user collection and deployment remain **NOT AUTHORIZED and not performed**. G0–G5 stay open; B3 requires its own instruction.
