# TELEMETRY_INFRA_AUDIT

Status: read-only evidence audit, 2026-10-23 Europe/Prague. No application/configuration changes, database creation, provider calls or deployment performed. Proposed changes live in the companion documents, not in this capability matrix's current-state claims.

## 0. G0 live DEV read-back — 2026-10-24

### G1-B EU D1 provisioning - 2026-10-24

**Result: PARTIAL.** The authorized G1-B run used source `bf32bd2fd29f6f6ebd717deea2b7df8163cb8a56` in a clean Windows worktree. The canonical build and standalone Worker artifact validation passed; project Wrangler `4.150.0` was used.

Read-only preflight confirmed the authorized DEV account, Worker `apu-ms-site-dev`, deployment `ca7ca974-40c1-4669-8ddb-21db4b8a75bf` with active version `cba179ae-6f82-4c0e-bdac-5727d197cc85`, and an empty D1 inventory immediately before creation. Workers Paid remained supported by the existing operator evidence; no new billing read-back was performed.

The one authorized D1 was created as `apu-ms-site-dev-telemetry` with jurisdiction `eu`. Restricted operator evidence records UUID `7a5c039d-e1b3-4f37-92a4-412e1ec3a934`; `d1 info` confirmed `jurisdiction: eu`, region `EEUR`, `num_tables: 0`, and zero reads/writes. No binding was published.

The run stopped before staging and migration because the reviewed private DEV KV/Access input values were not available in the worktree; the tracked example contains only null placeholders. No production values were substituted. Consequently the approved migration was **not applied**, `d1_migrations` was not initialized, telemetry tables remain absent, and no telemetry rows exist. Worker deployment/version, production resources, secrets, Zero Trust, and telemetry activation were not changed.

The next minimal step is to provide the already-reviewed DEV-only input file through the protected operator path, rerun staging validation, then perform only the single approved migration. Do not recreate the existing D1 and do not run `DROP`, `DELETE`, or an unplanned repair.

### Billing follow-up — 2026-10-24

The account owner reported completing the Workers plan upgrade in an external authenticated Brave browser. The operator-provided screenshot showed **“Purchase complete”**, **“Subscription is active”**, and **Workers Paid Plan: USD 5/month**. This is **VERIFIED BY OPERATOR SCREENSHOT**, not an independent Wrangler/API billing read-back. No further upgrade was attempted from this environment.

The account owner also reported that Zero Trust remains **Free Base**, with **2 of 50 seats occupied**, and that Workers plan changes did not alter Zero Trust. This remains **OPERATOR-REPORTED**; post-upgrade Dashboard/API read-back was not available in the local browser session.

Workers billing usage, quota headroom, shared account limits, effective DEV routes/Access policy, observability retention, and deployment Git-SHA provenance remain **NOT VERIFIED**. The previously verified Worker metadata and empty D1 inventory remain unchanged evidence; no Worker, binding, D1, secret, deployment, or telemetry state was modified by this follow-up.

The approved operating decision remains: maximum **50 pilot participants per day**, target **Workers Paid**, and unchanged approved P0 telemetry scope. The USD 5/month amount is recorded as the operator-reported base fee; payment details and personal account data are intentionally excluded.

**Overall result: PARTIAL.** This section records a new read-only Wrangler inspection. It does not replace the historical audit below and does not authorize G1 provisioning or hosted verification.

Source of evidence:

- Local Windows PowerShell.
- Project-local Wrangler `4.150.0`.
- Authenticated `wrangler whoami`; account identity and token values are not reproduced here.
- Commands used: `wrangler --version`, `wrangler whoami`, `deployments list --name apu-ms-site-dev --json`, `versions list --name apu-ms-site-dev --json`, `versions view cba179ae-6f82-4c0e-bdac-5727d197cc85 --name apu-ms-site-dev --json`, `d1 list --json`.
- No secret values, raw logs, user data or provider calls were read.

| G0 item | Result | Evidence / limit |
|---|---|---|
| Authenticated account | **VERIFIED** | Wrangler authenticated to the authorized Catsystem account; account identifier is intentionally omitted from this shared report. |
| Workers plan | **NOT VERIFIED** | Wrangler read-back used here does not expose Free/Paid plan or account billing state. No upgrade was attempted. |
| Workers/D1 usage and quota headroom | **NOT VERIFIED** | No read-only usage/quota output was available from the executed project-local Wrangler commands. |
| DEV Worker identity | **VERIFIED** | Worker `apu-ms-site-dev` exists and returned deployment/version data. |
| Active deployment | **VERIFIED** | Deployment `ca7ca974-40c1-4669-8ddb-21db4b8a75bf`, 100% to version `cba179ae-6f82-4c0e-bdac-5727d197cc85`, created `2026-10-21T21:36:50.763Z`. |
| Active version | **VERIFIED** | Version `cba179ae-6f82-4c0e-bdac-5727d197cc85`, number 1, source `wrangler`, upload-triggered. |
| Git SHA provenance | **NOT VERIFIED** | Version metadata contains no Git SHA/tag linking the deployment to a repository commit. |
| Compatibility | **VERIFIED** | Compatibility date `2026-08-21`, flag `nodejs_compat`, standard usage model. |
| ASSETS binding | **VERIFIED** | Effective version metadata contains an `ASSETS` assets binding. |
| DEV_LOG_STATE | **VERIFIED** | Effective version metadata contains a KV binding; the namespace identity is recorded in Cloudflare metadata but is intentionally not reproduced here. |
| Access metadata | **PARTIAL** | Effective version metadata shows Access-related variables are present; values/audience are intentionally not reproduced. Effective Access application policy was not available from these commands. |
| Observability/log retention | **NOT VERIFIED** | Version metadata did not establish effective dashboard retention or account log settings. |
| Domains/routes | **NOT VERIFIED** | Deployment/version read-back did not provide a verified route/domain inventory. |
| D1 inventory | **VERIFIED (empty)** | `wrangler d1 list --json` returned `[]`; no telemetry D1 or other account D1 was visible to this authenticated read-back. |
| EU telemetry D1 | **NOT PROVISIONED** | No dedicated telemetry D1 was present in the returned inventory; no database or binding was created. |

The live evidence confirms the named DEV Worker and its active uploaded version, but does not establish plan capacity, account-wide usage/headroom, route protection, Git provenance, effective observability retention or the required EU telemetry D1. G0 therefore does not satisfy the evidence threshold for G1 or G5.

### Dashboard follow-up — 2026-10-24

An authenticated Dashboard session was not available in the local browser. Opening `https://dash.cloudflare.com/` redirected to the Cloudflare sign-in page; no credentials or SSO flow was entered and no authentication bypass was attempted. Consequently the following remain **NOT VERIFIED** from Dashboard: Workers Free/Paid plan, Workers/D1 usage and headroom, shared account limits, effective DEV routes/domains and Access policy, and observability/edge log retention. The Wrangler evidence above remains valid and is not replaced by this access limitation.

## 1. Evidence checkpoint and scope correction

Canonical audited tree: [`dev` commit fc8ac5520b7b49b442bedc47558c73f20ce2bea6](https://github.com/catsystemexe/APU_MS_site/commit/fc8ac5520b7b49b442bedc47558c73f20ce2bea6). All repository paths below refer to this exact SHA. Local detached checkout and authenticated connector reads agreed. Working tree was clean before documentation work.

| Evidence | Result and scope | Reuse / invalidation |
| --- | --- | --- |
| Authenticated GitHub branches collection and `/branches/next` | `dev` exists at audited SHA; `next` absent, endpoint returns Moved Permanently to `/branches/public`; protected `public` exists. Redirect was not followed for application audit. | Recheck relevant refs before source publication/implementation; do not recreate `next`. |
| `AGENTS.md`, `05_WORKFLOW/APU_PROJECT_RULES.md` | Development `dev`, protected release `public`, legacy `main`. Repository is canonical; Drive outside mandatory sync. | Reuse unless governance changes. |
| Drive versions of the three requested workflow files | Successfully read, but older distribution copies still call `next` development. They do not override current GitHub rules. | Do not synchronize them automatically. |
| GitHub check for audited SHA | [Provider-free release checks](https://github.com/catsystemexe/APU_MS_site/actions/runs/39870150952/job/120142258761): SUCCESS, completed 2026-10-22 23:12:12 UTC. | Prior source CI evidence, **not tests run by this audit**, not hosted/provider PASS. |
| GitHub commit status endpoint | No commit statuses; a check-run separately exists and passes. | An empty status collection is not failed CI. |
| Cloudflare browser | `https://dash.cloudflare.com/` redirected to `/login`; no authenticated Dashboard session available. No login, policy or credential changes attempted. | Current live account configuration **NOT VERIFIED — access blocked**. |
| GitHub deployment collection | Connector rejects this endpoint family. | No inference that deployments are absent. |
| Current runtime document, P5 closeout dated 2026-10-21 | Dated operator-reported dedicated DEV provisioning and UI/auth/static smoke. Retained with exact scope, not presented as fresh Cloudflare inspection. | Resource design useful until relevant changes; live source/traffic/binding checks required before hosted mutation/launch. |

The user explicitly requested developers-only APU and autonomous correction of disproven assumptions. Therefore this audit uses **dev**, not the obsolete `next` ref that now points toward production. Documentation PR target must be `dev`. This is a recorded scope correction, not permission to change branch governance. No production application audit or changes are needed.

## 2. APU capability matrix

Status vocabulary: EXISTUJE / ČÁSTEČNĚ / CHYBÍ / NEOVĚŘENO. Repository existence is not hosted effectiveness. Each path can be inspected under [the audited tree](https://github.com/catsystemexe/APU_MS_site/tree/fc8ac5520b7b49b442bedc47558c73f20ce2bea6).

| Capability / status | Concrete repository evidence | Integration / required change | Risk or dependency |
| --- | --- | --- | --- |
| Framework/runtime — EXISTUJE | `package.json`: Next 16.2.6, React 19.2.6, Vinext 0.0.50, Vite 8.0.13, Wrangler 4.150.0. `vite.config.ts`, `worker/index.ts`. | Existing App Router handlers in one standalone Worker. Add local telemetry modules/routes. | Do not assume conventional Node server or Pages Functions; use existing Vinext build. |
| API surface — EXISTUJE | `app/api/{chat,extract,analysis,need-route,f2,f3,session,devlog-state,drive-config}/route.ts`. AI routes use edge runtime. | Context/collector routes parallel to existing APIs. | New telemetry route must use existing Access validation and strict payload bounds. |
| Dedicated DEV source config — EXISTUJE | `wrangler.dev.json`: `apu-ms-site-dev`, assets, `DEV_LOG_STATE` with null provisioning value, Access placeholders, local bypass off, `preview_urls=false`, observability off. | Future isolated telemetry binding/flags in DEV config only. | Template is deliberately incomplete and is not a deployed resource listing. |
| Generated DEV configuration — EXISTUJE | `ops/dev/prepare-worker.mjs`: `validateDevTemplate`, `materialize`, `validateDevConfig`, `futureDevCommand`; `tests/dev-worker-preparation.test.mjs`. | **Must extend strict key/vars/input allowlists** for optional telemetry binding/flags. Preserve absent/disabled case and all existing target guards. | Merely adding D1 to Wrangler fails exact config validation. No production-config fallback. |
| Business SQL persistence — CHYBÍ in audited app | `.openai/hosting.json`: `d1:null`, `r2:null`; `db/schema.ts` empty; `db/index.ts` opt-in D1/Drizzle stub. No app callers of `getDb`. `examples/d1/` is example only. | Separate telemetry D1 repository adapter; no need to activate business schema. | Cannot claim an existing database can be reused; account inventory unverified. |
| Existing KV — EXISTUJE in source, hosted identity dated | `app/dev-log-state.ts`, `app/api/devlog-state/route.ts`, `app/worker-bindings.ts`. | Leave DEV LOG KV as is; do not use shared hot counters for telemetry. | KV consistency/write quotas and unrelated data lifecycle. |
| Authentication — EXISTUJE | `app/access-auth.ts`: verified RS256 Access JWT, issuer/audience/time checks, normalized email, developer/tester role. `app/api/session/route.ts`. | Consume existing validated identity for telemetry-only pseudonym derivation. | No existing opaque internal user ID; never trust an email/header from client payload. Do not change authentication. |
| Stable pilot participant ID — CHYBÍ | AccessIdentity is `{email,role}`; no telemetry participant/cohort identity. | HMAC adapter scoped to cohort/key; raw identity stays in existing auth memory. | G2: new processing purpose; account may be shared, so not proven person. |
| Session/project boundary — ČÁSTEČNĚ | `app/apu-client.tsx`: `sessionRef` at mount and reset; `resetCurrentProject` rotates it. `app/project-session.ts`. | Separate telemetry session versus workflow IDs. | Existing diagnostic session is a project episode, not visit/idle analytics. |
| Persistence/recovery — ČÁSTEČNĚ | `app/notebook-storage.ts`: developer localStorage, tester sessionStorage, identity ownership/epoch invalidation; `app/access-session-boundary.tsx`; React state for Chat/F2/F3. | Observe boundaries; no business Save/Open changes. | Existing browser keys contain direct account identifiers; do not reuse/export these keys or diagnostic JSON. Durable project work remains B-02. |
| AI usage lifecycle — EXISTUJE | `app/model-call-instrumentation.ts`: begin/pending, provider/application finalization, transport errors, call IDs. | Compose a safe optional sink using existing lifecycle records. | Current sink is awaited; telemetry failures must be contained and cannot reject provider work. |
| Central collector — ČÁSTEČNĚ | `app/openai-responses-instrumentation.ts`: request-local `createRequestUsageCollector`, `callOpenAIResponses`; AI routes and `app/quest-controller.ts` use it. | Add a request-scoped persistence adapter; keep in-memory ledger/client envelopes unchanged. | No global mutable request/identity context in Worker. |
| Streaming AI — EXISTUJE | `app/api/chat/route.ts`: `createInstrumentedModelCallLifecycle`, `mainLifecycle.begin/finish_provider/finish_transport`, raw upstream Responses fetch inside streaming handler. | Include this lifecycle; wrapping only `callOpenAIResponses` misses MAIN streaming. | Disconnect/stream termination may leave uncertainty; preserve server pending/final records. |
| AI operation coverage — EXISTUJE | Extract/grounding + rescue in `/extract`; controller + MAIN in `/chat`/`quest-controller`; `/analysis`, `/need-route`, `/f2`, `/f3`. `UsageOperation` enumerates ten operations. | All seven AI API routes plus controller share one adapter contract. | Grounding primary/rescue are distinct calls; some operations are legacy but still instrumented if executed. |
| Retry/fallback links — ČÁSTEČNĚ | `ModelUsageRecord` has attempt_index/retry_of/fallback_for; source callers do not populate meaningful links and lifecycle defaults to zero/null. | Thread operation/retry linkage through wrapper, actual grounding fallback and explicit UI retry/regeneration paths. | Repeated requests are not automatically retries; avoid speculative classifications. |
| Token/cost model — EXISTUJE | `app/usage-ledger.ts`: normalization, priced/missing/unknown/invalid statuses, rate version `openai-standard-2026-08-25`, tier/context-band/cache-write/file-search snapshots; `app/model-config.ts` delegates legacy price estimates. | Persist projection/snapshot; do not add parallel pricing authority. | Consumption reported by provider, price calculated. See §5 on current official price boundaries. |
| Cross-user durable AI ledger — CHYBÍ | Request collector is in-memory; `app/model-usage-collection.ts`, `session-export.ts` and client state collect developer diagnostics only. | Server-side storage before role filtering. | `authorizedModelPayload` strips usage/telemetry for testers; client-based ingestion would systematically miss them. |
| Timings — ČÁSTEČNĚ | AI start/end timestamps, `session-export.ts` stage/latency metadata. | Reuse call durations; add independent ACT intervals. | Existing request timings do not measure active session time. |
| Workflow state/transitions — EXISTUJE | `apu-client.tsx`: `refreshStructuredAnalysis`, explicit request/phase handling, `returnToF2`, `enterF3`, `handleF2OutputNavigation`, `resetCurrentProject`. `desktop-workspace.ts`. | Emit after successful semantic transition; panel/view changes separate. | Opening retained document or notebook is not a phase transition. |
| Accepted documents — EXISTUJE | `commitBuildDocument` → `acceptBuildDocumentUpdate`; `working-document-lifecycle.ts`, `f2-build-model.ts`; `f3-finalization-model.ts`, `renderF3`/`acceptF3Render`. | Emit completion for current F3 default and accepted generated material; preserve stale/obsolete guards. | Default F3 may require no model call; provider success is not client acceptance; stale results must not complete workflows. |
| Pedagogical taxonomy — ČÁSTEČNĚ | `notepad-model.ts`: manifestations/goals/context/course/helps; `F2_PATHS`; needMapping `f3Target:string|null`; `f2-need-routing.ts`. | Route intent safe closed enum candidate; no attention/behavior classifier. | Notebook section names are **not situation categories**; f3Target/needs/goals are free text. |
| Output enums — EXISTUJE | `f3-finalization-model.ts`: structureMode, audience, style/length, baseline/generated state. | Optional G3-approved format/route projection only. | Goal/material titles and source fingerprints can reveal content; exclude. |
| Pilot telemetry ingest/reporting/retention — CHYBÍ | No telemetry route, event store, active-time tracker, SQL reports or retention job in audited tree. Session JSON is developer diagnostic download. | New isolated subsystem and local export tools. | Do not upload whole Session JSON: it includes pedagogical/conversation state. |

### Documentation inconsistencies relevant to handoff

`01_PRODUCT/ARCHITECTURE/APU_ARCHITECTURE.md` retains old `next` development and earlier F3 migration statements. Current runtime document and actual code show later accepted F2/F3 snapshot/default behavior. Use current governance for branch routing and audited code for integration points. This audit does not repair unrelated historical/current-document wording. Do not restart a repository-wide audit to resolve it.

## 3. Cloudflare: declared, dated evidence and unknown live state

| Topic | Repository declaration | Dated operator evidence / current uncertainty |
| --- | --- | --- |
| Runtime type | Standalone Workers with static asset binding; no Pages application in the audited runtime contract. | Dedicated permanent DEV Worker `apu-ms-site-dev`, URL `https://apu-ms-site-dev.catsystem-exe.workers.dev`, P5 closeout 2026-10-21. Not freshly inspected. |
| DEV isolation | Dedicated config and strict preparation reject production/legacy/PR60 identities; no bypass. | P5 reports exclusive DEV KV/Access identities, UI/auth/assets smoke PASS. IDs are referenced in canonical runtime doc, not duplicated here. |
| Actual deployed DEV version | No source declaration can prove it. | P5 reports Deployment `ca7ca974-40c1-4669-8ddb-21db4b8a75bf`, Version `cba179ae-6f82-4c0e-bdac-5727d197cc85`; deployed source SHA, allocation and individual inspection times were not supplied. **dev HEAD→deployed Worker mapping NOT VERIFIED.** |
| DEV/preview distinction | Dedicated DEV has workers_dev true and preview_urls false. Old guarded `apu-pr60-e2e` belongs to a different parent Worker/branch. | Do not reuse that historical preview as DEV or carry its resource IDs into telemetry. KI-03 pertains to the historical guarded path. |
| Routes / bindings | DEV config has ASSETS + DEV_LOG_STATE, no D1/R2/Analytics Engine. No custom route in DEV template. | Effective deployed binding inventory, routes and URL protections not freshly verified. Absence in source does not prove absence in account. |
| Security / logs | Existing Access verification; DEV observability disabled by source. | Current Access policy effect, retained Access/edge/Worker logs, provider secrets and plan permissions **NOT VERIFIED**. Avoid raw log reads; inspect settings/names/types/counts only. |
| Automatic builds | Preview workflows only on exact old feature branch; `pilot-release-verification` on dev pushes and specified PRs is provider-free, with no deploy step. | Dated operator Builds-OFF evidence retained; no automatic DEV deployment claimed. Workers Builds/hook callers/current account integrations inaccessible. |
| Documentation branch PR | No repository workflow deploys from `docs/pilot-telemetry-2026-10-23`. | Old non-production Builds-OFF operator evidence is reused, not refreshed. No merge/push to public/main/next, hook or workflow activation is authorized. |
| PR CI limitation | `ops/release/verify-context.mjs` permits dev→public/next release and two exact migration pairs; arbitrary feature/docs→dev PR fails `unsupported_pr_branches`. | Verified source restriction, not an application defect introduced by telemetry. Report resulting PR CI honestly; do not change governing CI in this documentation task. |
| Add collector/storage | Existing routes and Worker bindings permit this technically; D1 library/types already present. | Future D1 creation/binding and HMAC secrets require separately authorized operator work. No account entitlement or quota headroom verified. |

**Technical conclusion:** a telemetry collector can use the same DEV Worker and Cloudflare storage without an additional hosting provider. It needs code, a dedicated DEV telemetry D1 binding, off-by-default flags, HMAC secrets, and a narrow extension of the strict DEV preparation contract. It does not need Pages migration, a separate backend host, public routing, business persistence or authentication changes. This is source-based feasibility, conditional on live DEV isolation/permissions and approved activation.

## 4. Current official service capabilities and operating budget

Official pages consulted 2026-10-23; amounts are published prices/quotas, **not the user's current plan or free headroom**. Source links below. Account-wide consumption shares included allowances.

| Option | Current official facts | Pilot implication |
| --- | --- | --- |
| D1 | Free: 5M rows read/day, 100k rows written/day, 5GB account storage; Free DB max 500MB, 10 DBs. Paid: 25B reads/mo + $0.001/M, 50M writes/mo + $1/M, first 5GB + $0.75/GB-month, DB max 10GB. [CF1][CF2] | SQL joins/dedup/export/retention fit exact pilot economics. Index maintenance and deletes also consume writes; measure D1 meta, not only event count. |
| Workers | Free: 100k dynamic requests/day, 10ms CPU/invocation. Paid minimum $5/account-month; 10M requests +30M CPU ms/month, then $0.30/M requests and $0.02/M CPU ms. [CF3][CF4] | Existing plan unknown. HMAC+validation+SQL CPU must be measured. Free suitability is not proven by low traffic alone. |
| Existing KV | Free 1,000 writes/day, 100k reads/day, 1GB. Eventually consistent; concurrent hot-key read/modify/write counters unsuitable. [CF3][CF5][CF6] | One KV key/event avoids hot counters but creates enumeration, dedup and export work; no longer simplest for projected >1k events/day. Do not reuse DEV LOG storage. |
| Analytics Engine | Published Free 100k points/day, 10k queries/day; Paid 10M points +1M queries/month, then $0.25/M points / $1/M queries. Pricing page currently says not yet billed. Retention three months; sampling at ingest/query. [CF7][CF8][CF9] | Good aggregate operational analytics, but not primary exact ledger/sequence store; pricing status can change. No need to add a second store in v1. |
| D1 location | `eu` jurisdiction chosen at creation restricts database execution/persistence to EU. Location hint is weaker; jurisdiction cannot be added later. Workers can access EU DB globally. [CF10] | Recommend EU at future creation, but this does **not** promise EU-only Worker/auth/provider/log processing. |
| D1 backups/export | SQL import/export supported. Time Travel always on; 7d Free /30d Paid history. [CF2][CF11][CF12] | Logical retention/deletion does not instantly remove backups. Define restoration/re-deletion and export expiry policy. |

### Load model (estimate, not observed traffic)

Assume 100 participants, 2 sessions/day, 15 active minutes/session, 15-second activity intervals, ~20 non-activity events and 10 AI calls/session. Approximately **16,000 client events/day**, **4,000 AI lifecycle writes/day**, plus roughly **12,000 session/activity budget updates/day** at one request per interval. At an illustrative 3–4× physical row-write amplification, around **96–128k writes/day** before pruning/other account use: the upper pilot can exceed the D1 Free 100k allowance. Indexes on immutable columns do not all change with every update, so this is a budgeting approximation to validate, not a measured amplification factor. 30-day base retention at ~0.5–1KB/event including indexes is roughly **240–480MB** plus AI/session data, close to the Free per-database cap. Measure actual D1 meta and row/index sizes, reduce unnecessary indexes/flush density or use the existing Paid plan if required. Do not promise Free-only operation at the high end.

Batch ≤20 client events per request, flush at most every 15 seconds while active: about 12k activity requests/day at this upper assumption, plus workflow/API traffic. A 20-participant pilot at the same intensity is roughly one fifth of this. Added storage/request charges likely remain small within existing allowances; **$0 incremental** is conditional, and any new Paid plan has a minimum $5/month. No AI cost forecast is valid without pilot token distributions. This audit did not run billable model calls.

## 5. Price evidence and scope

Repository pricing is explicit and versioned. Current official OpenAI pricing [AI1] corroborates the base 5.6 family rates and $2.50/1k file-search calls for the source's standard/default 30m regime. Prompt caching documentation [AI2] distinguishes 30m and 12h writes; the ledger has one cache-write rate and source callers do not request 12h retention. Preserve this boundary, not a claim of pricing every possible provider configuration. Sol promotional pricing is stated as available at least through 2026-11-21; review rate validity before any later activation. Regional processing uplifts, unsupported tiers and shared vector-storage overhead are not established by the source snapshot. No pricing code was changed in this audit.

## 6. External primary references

- [CF1 — D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [CF2 — D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [CF3 — Workers pricing, including KV](https://developers.cloudflare.com/workers/platform/pricing/)
- [CF4 — Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [CF5 — KV limits](https://developers.cloudflare.com/kv/platform/limits/)
- [CF6 — KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/)
- [CF7 — Analytics Engine pricing](https://developers.cloudflare.com/analytics/analytics-engine/pricing/)
- [CF8 — Analytics Engine limits and retention](https://developers.cloudflare.com/analytics/analytics-engine/limits/)
- [CF9 — Analytics Engine sampling](https://developers.cloudflare.com/analytics/analytics-engine/sampling/)
- [CF10 — D1 data location](https://developers.cloudflare.com/d1/configuration/data-location/)
- [CF11 — D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
- [CF12 — D1 import/export](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [AI1 — OpenAI API pricing](https://developers.openai.com/api/docs/pricing)
- [AI2 — OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching)
- [PR1 — ÚOOÚ cookies and similar technologies](https://uoou.gov.cz/verejnost/qa-otazky-a-odpovedi/cookies)
- [PR2 — GDPR, official EUR-Lex text](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng)

No real pedagogical records, saved notebooks, provider prompts/responses or account logs were needed. Source schemas and implementation were sufficient. No new dataset of names/emails/IPs or credentials is included in this documentation.
