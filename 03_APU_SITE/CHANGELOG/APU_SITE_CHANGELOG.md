# APU Site — Changelog

Status: CURRENT

Records significant verified product/runtime/project changes. It is not a complete Git log. Historical Sites-era entries are retained where they remain useful; current deployment state must not be inferred from a changelog entry alone.

## 2026-10-21 — ENV-D4-B2-V3 runtime evidence reconciled

- Recorded operator-verified hosted mutation from source `b266d4058bb7ca937d72ac2dcb834e631fbcabbc`: active DEV Preview Version `764e8603-d50b-41c5-94b6-030edd77755d`, rollout `4b89c5c6-444c-440b-a7d3-1e737e5fdc16`, 100% Preview allocation; named/unique Access redirects PASS and production deployment/Version/100% traffic preserved. Cloudflare evidence is operator-reported, not independently re-read by Codex; the new unique URL and inspection timestamp were not supplied.
- Independently verified GitHub run [`39567377884`](https://github.com/catsystemexe/APU_MS_site/actions/runs/39567377884) as COMPLETED / CANCELLED, credential-bearing guard FAILURE at `upload_response_normalization / upload_json_invalid / returned`. Actual mutation is not CI PASS. Earlier Codex-reported local V2 **332/332 provider-free tests PASS** remains historical; no V2 tests were rerun for this documentation V1 reconciliation.
- **KI-03 stays OPEN:** names/types verification does not prove the actual DEV KV namespace ID; only `APU_LOCAL_DEV_AUTH`, `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` were exactly compared, while `APU_DEVELOPER_EMAILS` equality remains undemonstrated. Parser/output normalization, upload/read-back agreement and complete binding equality still need verification. Preserved ENV-D3 unchanged and added a separate current hosted-state record; `automaticDevUpdatesConfigured=false` and future deployment authorization false. No guard/workflow/application/gate/infrastructure changes or new deployment/rerun.

## 2026-10-20 — ENV-D4-B2-DOC-PUBLICATION-CLOSE

- Reconciled **PUBLISHED SOURCE / HOSTED UPDATE NOT VERIFIED** across runtime, activation and KI-03. Exact six-file repair `88e997911d0e1cb1460476216036988a1965224b` was published by fast-forward from `6d3ebf5cec1b5f58bd4468cb9a2b3b1c4f277359`; PR #60 remains OPEN/unmerged into `next`.
- Independently verified push run [`39500813016`](https://github.com/catsystemexe/APU_MS_site/actions/runs/39500813016): COMPLETED / SKIPPED, `preview` skipped, zero executed steps and no Preview deployment execution. Preserved Codex-reported local V2 **332/332 provider-free tests PASS**; these were not independently run by skipped CI or rerun for this documentation-only V1 correction.
- Accepted operator evidence records both DEV/capture gates exactly `disabled`, Preview-branch Workers Builds OFF and production Builds/branch `next` unchanged; no configuration API reinspection is claimed. **KI-03 remains OPEN** for real binding/URL values, future upload/source semantics and authorized hosted update/production preservation. `automaticDevUpdatesConfigured=false` and historical runtime evidence remain unchanged; no deployment, retry, activation or merge is authorized.

## 2026-10-20 — ENV-D4-B2-LIVE-CONTRACT-REPAIR observed Version schema

- Authenticated diagnostic `39494160174` confirms the fixed Preview latest GET returns a Version-shaped object, ID `ee7c9e97-f7cf-420f-ba55-e23d50688cbd`, without Preview ID/name; its annotation keys expose only `workers/triggered_by`. Rollout ID `7ed83603-ffb0-43ae-be75-ac66f65fac85` is separate. Added a narrow exact-key/type Version adapter and scoped Preview-before-Version association checks; contradictory optional identifiers/unknown schema still fail closed.
- Preserved exact binding isolation without inferring live `env` values from its object type. Historical missing source SHA is allowed; future read-back must prove the approved SHA. Pinned upload formats normalize opaque upload IDs separately from Version IDs; correlate authoritative target/source/exact URL and require a changed Version instead of equating unrelated UUIDs. Double preflight, six failure stages, Access checks and production comparison after invoked/uncertain upload remain; no retry/rollback.
- Codex-reported local V2 verification PASS: **332/332 provider-free tests**, zero failures/skips, syntax/typecheck/canonical build/artifact/offline config and scope review. Strict location test now accepts only the unchanged approved diagnostic file in addition to the reviewed DEV workflow. Updated activation/runtime and KI-03; **KI-03 stays OPEN** for real binding/URL/future POST/source/hosted update and production-preservation evidence. Fixtures are synthetic beyond the captured key/type/identity evidence.
- **Historical initial local-only state:** the operator requested holding the repair without push while fresh gate/Workers Builds publication checks were unavailable. This hold was superseded by the verified publication recorded above. No workflow/capture-script/capture-test/application/config/variable/infrastructure change, upload/deployment/retry, merge or release. `automaticDevUpdatesConfigured=false`; historical evidence and unrelated Windows edits are preserved.

## 2026-10-20 — ENV-D4-B2-REPAIR metadata validation and diagnostic stages

- Investigated run `39475401133` on `c5966b9eb8661444407a15206225a658f9a124d1`: the token-bearing guard failed with `wrong_deployment_preview`; old diagnostics cannot identify the missing/wrong identity field, stage or upload-attempt state. Actual Preview-specific GET metadata remains unverified; inventory data does not establish that contract.
- Inspected pinned Wrangler 4.150.0: `--json` stdout is nested `{ preview, deployment }`; flat fields belong to the separate `writeOutput` record. Added an explicit adapter for both verified source shapes, rejecting mixed/invalid output and using authoritative read-back for source/bindings/identity/URL agreement. Removed unsupported URL derivation from deployment ID; Version identity is separate. Missing GET Preview ID/name still fail closed, with distinct causes; no hardcoded identity fallback.
- Added six sanitized failure stages and upload state; production comparison is attempted after invoked/uncertain upload, normalization and postflight failure. Retained fixed authorization/source/target, exact KV/Access/no-secret bindings, two pre-upload validations, Access checks and no guard retry/rollback.
- Code verification PASS: **284/284 focused provider-free tests**, zero failures/skips, JS syntax, typecheck, canonical build/artifact and offline config/pinned Wrangler. Updated activation handoff/runtime and added **KI-03**, left open until successful separately authorized V3 hosted update evidence. No Cloudflare mutation, deployment/rerun, workflow/variable/application/config-manifest change, merge or release; `automaticDevUpdatesConfigured=false`. Code PASS does not establish live compatibility or hosted preservation; earlier history is retained.

## 2026-10-20 — ENV-D4-B1 publication and P2 preservation reconciled

- Independently verified publication of `c1ab08d54cf375130df4f8ea3590025a60f3b25a`, its exact four-file B1 scope and published workflow/template byte equality; PR #60 remains open/unmerged into `next`. Registered DEV workflow is **INSTALLED / INACTIVE**, not automatically updating DEV. Run [`39462704145`](https://github.com/catsystemexe/APU_MS_site/actions/runs/39462704145) completed/skipped; `preview` skipped with zero executed steps and no credential-bearing deployment execution. `APU_DEV_PREVIEW_CI_ENABLED` remains unset according to read-only GitHub operator verification.
- **B1-P2 operator-reported read-only preservation:** no new Worker Version after B1; latest remains `e7254579-ff43-4f58-9592-1f3fc3518623`. Production Deployment `08a0cd96-fb57-4f2f-9a6b-14950420b89e`, Version `2a28cdf6-5a61-4f6c-be55-382e5bfa28cd` at 100%, and DEV Preview deployment `7ed83603-ffb0-43ae-be75-ac66f65fac85` / Version `ee7c9e97-f7cf-420f-ba55-e23d50688cbd` are unchanged. These Cloudflare findings were not independently re-read by this documentation batch; a separate P2 inspection timestamp was not supplied.
- Dedicated KV `1729ce8a6acd4cdcbed8248ac543677b` retains prior verification, without fresh P2 binding inspection. Non-production Builds-disabled / production-branch `next` evidence is from the earlier operator-confirmed Dashboard, not a fresh P2 API inspection. B2 still requires security/token/environment review, fresh target/binding/Access/production evidence and separate exact-source first-run authorization; no unconditional runtime/IAM verification or completed B2 deployment is claimed.
- Two-document reconciliation only; historical B1 preparation records are preserved and superseded. `automaticDevUpdatesConfigured=false` remains unchanged. No application/workflow/guard/test/configuration change, CI activation, infrastructure mutation, Preview/production deployment, merge or release; unrelated unpublished Windows edits remain untouched.

## 2026-10-20 — ENV-D4-B1 local DEV workflow installation; publication blocked

- Installed `.github/workflows/dev-preview.yml` locally as an exact byte copy of the reviewed template on verified `1014b42e1f68c7e6723af8e4bb5949ad48197563`. Preserved push-only `codex/f1-f3-mvp-stabilization`, all authorization/isolation/production guards, pins and deployment commands. Adapted the strict CI configuration test to accept PREP or the identical installed file in local/intended Actions contexts; unexpected workflows and altered copies still fail. Template, guard and preparation manifest are unchanged.
- Verification PASS: YAML/JS syntax, byte equality, locked clean install, typecheck, canonical build/artifact, offline configuration/pinned Wrangler, **214/214 focused provider-free tests**, zero failures/skips, plus six installation-state acceptance/rejection checks. Used Bash to invoke the existing non-executable install helper without changing its mode or source. No provider-backed tests or real deployment executed.
- **LOCAL IMPLEMENTATION PASS / PUBLICATION BLOCKED:** repository/environment authorization values and environment protections could not be independently read (CLI API `Forbidden`; connected fetch endpoints unsupported). Effective live gate is **UNKNOWN**, not asserted disabled; no variables were changed. Operator-supplied environment baseline is `apu-dev-preview`, reviewer `catsystemexe`, self-review prevention OFF, administrator bypass OFF, exact source-branch restriction, environment secret `CLOUDFLARE_API_TOKEN` and variable `CLOUDFLARE_ACCOUNT_ID`. Personal-user ownership excludes organization overrides. Non-production Builds-disabled evidence remains operator-supplied/historical, not a fresh Cloudflare read.
- No push or hosted installation-run verification; PR #60 remains open/unmerged into `next` at the baseline. No credential-bearing deployment step, DEV Preview update, production deployment, Version upload, infrastructure/Access/KV/secrets change, activation or B2 action. First authorized CI execution remains pending; `automaticDevUpdatesConfigured=false`. Runtime preservation is **NOT VERIFIED**. Resolve publication preflight access first; after an authorized safe push, verify GitHub source/Actions and separately inspect Cloudflare production/Preview/Versions read-only before B2. Earlier records are preserved.

## 2026-10-17 — ENV-D4-REPAIR publication and post-push preservation

- GitHub API independently verified successful publication of `53a686142fa7cc123ac6657cecd9c0bea30248b7` (`53a6861`), parent `594ce99a`, with the approved six-file repair diff. PR #60 remains open/unmerged; the new GitHub Actions pipeline remains **PREPARED / INACTIVE**, with no active `.github/workflows/dev-preview.yml`. This supersedes the historical publication blocker below without changing earlier records.
- Cloudflare Dashboard evidence is **operator-confirmed**: operator-authorized disabling of non-production/Preview branch Workers Builds persisted after reload; Production Builds remain enabled on `next` for `catsystemexe/APU_MS_site`. Existing commands were preserved; no Worker Previews migration.
- Read-only P2 preservation is **Wrangler V3 operator-reported**: no newer Worker Version after `e7254579-ff43-4f58-9592-1f3fc3518623`; production Deployment `08a0cd96-fb57-4f2f-9a6b-14950420b89e` and Version `2a28cdf6-5a61-4f6c-be55-382e5bfa28cd` at 100% unchanged; DEV Preview deployment `7ed83603-ffb0-43ae-be75-ac66f65fac85` and Version `ee7c9e97-f7cf-420f-ba55-e23d50688cbd` unchanged. Prevention is verified for the observed publication, not all future pushes.
- Runtime/security readiness remains **PARTIAL**: dedicated KV `1729ce8a6acd4cdcbed8248ac543677b` is prior baseline evidence, with current binding not independently reverified in P2 or this batch. No complete CI activation or full Cloudflare IAM isolation is claimed. Next: **ENV-D4-A security preflight**, including environment protections, token permissions, fresh binding/Access checks, live CI compatibility and explicit first-run authorization. This two-document reconciliation changes no application, workflow or infrastructure; no deployment, activation, merge or STABLE release. Unpublished Windows edits remain untouched.

## 2026-10-15 — ENV-D4 SHA-bound first-run authorization (prepared/inactive)

- Added `once`/`auto` job and independent runtime authorization while preserving the global gate. `once` requires an exact lowercase 40-hex approved source SHA and rejects the same source already identified by verified latest deployment metadata at either preflight read. `auto` retains existing fixed branch/source/isolation/production controls without requiring an approved SHA. Authorization remains confined to the final deployment step; no automatic mode transition or variable update.
- Updated activation handoff/runtime contract: configure exact-SHA `once` with the gate disabled, separately authorize the first update, independently verify Preview/production, disable the gate after evaluation and require a later explicit decision for `auto`. Documented native case-insensitive GitHub conditions versus strict runtime authorization, and SHA-bound duplicate protection rather than an exactly-once guarantee. Existing credential scope/race/runner-loss limitations remain.
- Verification PASS: **214/214 provider-free tests** in six focused CI/Preview/configuration/Access/capability/F1-contract files, JavaScript syntax, YAML parsing/condition behavior, generated configuration and pinned Wrangler validation, diff and secret/scope review. Upload/API operations are mocked. No live CI, Cloudflare/provider request, fresh application build or hosted acceptance claimed.
- Publication BLOCKED by this batch's safety rule: baseline GitHub check `116675613067` confirms Workers Builds created Version `e7254579-ff43-4f58-9592-1f3fc3518623` on the previous branch publication; it does not establish a production rollout. Changes are retained locally without push. No CI activation, infrastructure/secrets/variables/Access/KV/runtime changes, DEV Preview update, production deployment or PR merge performed.

## 2026-10-15 — ENV-D4-PREP inactive DEV Preview automation

- Added **inactive** `ops/ci/dev-preview.workflow.yml.template`, pipeline Node pin, `dev-preview-guard.mjs`, activation/security handoff and provider-free guard tests. Nothing was installed under `.github/workflows`; DEV automation remains inactive. Intended source is only `catsystemexe/APU_MS_site` push on `codex/f1-f3-mvp-stabilization`; `next`/Workers Builds/production control remain unchanged.
- Prepared canonical clean install/typecheck/build/artifact/test gates, fixed existing `apu-ms-site` → `apu-pr60-e2e` / `79968345270d4008954af42b360775d2` target, exact generated/remote KV/Access/no-secret checks, supported GET evidence, source currency checks, serialized concurrency, fixed Wrangler Preview command with `--ignore-base-config`, read-back source/bindings/URLs, anonymous Access checks and dynamic before/after production allocation comparison. No production deploy/version-upload fallback or rollback path.
- Deployment credentials remain future environment-secret references only. Activation requires separate operator approval, minimum-permission/account-scope review, GitHub environment protections, existing Builds review and one controlled first CI update. Account-scoped Worker editing is not proven Preview-only; cross-system checks do not eliminate concurrent source/target races or Wrangler's same-name creation behavior. Limits and operator gates are explicit; no claim of authenticated correctness from an Access redirect.
- Verification PASS: two YAML parsers, **196/196 focused provider-free tests**, existing artifact/offline config checks, installed Wrangler help/flags, JS syntax, diff and secret/scope review. Negative scenarios verify fail-closed preflight and postflight/production failures without real API calls or uploads. Read-only help required a sandbox subprocess-permission retry; final standard runner passes without exclusions. No fresh application build/full regression required or run.
- No CI activation, credentials configuration, runtime/dependency/deployment-script edits, Cloudflare/provider calls, Preview update, production rollout, Access/KV change, release branch/tag or PR merge. ENV-D3 deployed evidence and preparation manifest are unchanged. Windows unpublished edits and existing patch export remain untouched.

## 2026-10-15 — ENV-D3 isolated DEV Preview deployed; ENV-D3-DOC evidence publication

- **Operator-confirmed deployment / provider-free verification PASS:** one creation of `apu-pr60-e2e`, Preview ID `79968345270d4008954af42b360775d2`, parent `apu-ms-site`, from source **`83d9cb4ee673f65a12d7d2a49fda31fed3bafa2c`**. Preview created `2026-10-15T20:24:49.668028Z`; deployment **`ee7c9e97-f7cf-420f-ba55-e23d50688cbd`** created `2026-10-15T20:24:56.167650Z`. URLs: https://apu-pr60-e2e-apu-ms-site.catsystem-exe.workers.dev and https://ee7c9e97-apu-ms-site.catsystem-exe.workers.dev. These are supplied operator results, not a Cloudflare inspection or deployment performed by Codex.
- Actual DEV `DEV_LOG_STATE` binding is the dedicated **`1729ce8a6acd4cdcbed8248ac543677b`** namespace; production KV/legacy `preview_id` are excluded. Clean source, typecheck, canonical build and artifact validation passed in the operator's ENV-D3 run. Both URLs reject anonymous access; Google/Cloudflare login, authenticated APU/developer header and `/api/session` developer role passed for the approved DEV identity, as reported. Local bypass is `"0"`; provider credentials are not provisioned.
- The operator's post-creation Wrangler report confirmed production Version **`2a28cdf6-5a61-4f6c-be55-382e5bfa28cd`** still serves **100%**, with no production rollout. Production branch remains **`next`**, not a safe automatic DEV integration target. **Automatic DEV updates are not configured.** Live provider execution, complete hosted model F1/F2/F3 E2E and separate pilot-teacher Access role remain NOT VERIFIED.
- ENV-D3-DOC updates only canonical runtime/changelog, completed-deployment metadata in the existing preparation manifest and its directly affected test. Historical preparation/authorization evidence and the unavailable Windows-edit reconciliation warning are retained; `deployable=false` remains review metadata, not a technical deployment lock or renewed authorization.
- Documentation verification PASS: exact identifiers/JSON/content consistency, **13/13 focused provider-free Preview tests**, complete diff review and `git diff --check`. No new full regression/build or hosted inspection was performed by this documentation batch. Zero application/infrastructure/Access/KV changes, Cloudflare/provider calls, Preview creation/update, production deployment, release branch/tag or PR merge.

## 2026-10-15 — ENV-S2 user-owned Notebook and safe logout

- Ordinary Notebook persistence now uses owner-validated tab sessionStorage; DEV local persistence is partitioned by verified identity. Existing NotepadState parsing remains authoritative. Shared unowned v1/v2 data is neither imported nor deleted; recovery/cleanup needs separate approval. Keys do not protect browser data from a person controlling that browser profile.
- Activated accessible **Odhlásit se** with a working-data warning/cancel path, immediate sensitive-workspace lock, central project reset, current-owner storage cleanup/revocation and same-origin Access logout navigation. Preferences and other owners' DEV copies are preserved. No Google logout, custom token issuance/revocation, downloaded-file or clipboard deletion.
- Added BroadcastChannel/storage-event invalidation and authenticated no-store, event-driven session revalidation. Identity/role mismatch and confirmed logout end the old workspace; transient/verification infrastructure failures hide recoverable work and offer retry. Existing epoch guards now cover queued routing and late F2/preview/analysis continuations; DEV diagnostics/export and ordinary F1–F3 remain functional.
- Verification PASS: typecheck, canonical build, artifact validation, **778/778 provider-free Node tests**, full actual-client Chromium workspace plus session/header-role/DEV usage modes, diff check and screenshot review. Browser checks cover two tabs, account changes, legacy exclusion, delayed results, transient/dictation recovery, owner-bound DEV retention, logout/cancel/New Project and desktop/narrow keyboard/accessibility layouts. Updated directly affected storage/icon/SSR test contracts and kept strict content/source/export checks.
- Hosted Access/Google-cookie logout, actual DEV/STABLE isolation and native Windows remain NOT VERIFIED; fixtures use synthetic identities/transport/logout. No live provider calls, infrastructure/Access/KV changes, production/Preview deployment, release branch/tag or PR merge. This completes the source-level Notebook/logout gate; controlled release and hosted acceptance remain separate.

## 2026-10-15 — ENV-S1 server-side developer capability boundary

- Ordinary authenticated chat/F2/F3 requests cannot select a supported manual model: the server returns 403 without invoking a provider. Missing/auto selection and existing automatic/default policy remain; DEV manual selections, validation and source/materialization guards are preserved. Identity comes only from existing server-verified Access authentication.
- Added shared, default-closed diagnostic envelope filtering across extraction, analysis, need-routing, F2/F3 JSON and every chat stream event. Ordinary success/error/interrupt paths omit usage/diagnostic/telemetry fields; provider-specific stream errors use public messages. DEV diagnostics and internal collectors/call IDs/lifecycle/status/pricing remain. Pedagogical content, functional metadata, optional-field consumers, prompts and provider-call policy are unchanged.
- Verification PASS: typecheck, canonical build/artifact, **767/767 tests in both standard and combined Node runners**, zero failures/skips; **112 new security tests** with real JWT validation/routes/instrumentation and mocked transport; full provider-free Chromium workspace and DEV usage-isolation smoke; diff check/review. Updated only directly affected old ordinary-usage assertions while retaining content and call-count checks. No paid/live provider calls.
- Hosted/native Windows and actual STABLE deployment/configuration remain NOT VERIFIED. Notebook ownership/logout and release/Access/resource separation remain separate gates. No active Cloudflare, KV, Access, release branch/tag, Preview/production deployment or PR merge changes; verified publication to the existing development branch is authorized separately from deployment.

## 2026-10-15 — ENV-S0 STABLE header preparation

- Confirmed that the existing server-derived role boundary already omits all developer header surfaces for ordinary users. No application/CSS change was needed. Current DEV has one scenario popup, one telemetry/model popup and one Session JSON action; no active DEV LOG header menu or responsive duplicate was found. The reported two DEV LOG instances remain unidentified in the operator's hosted context; DEV functionality and the DEV LOG subsystem are preserved.
- Added built-Worker checks for STABLE's intended empty developer allowlist and bypass `"0"`, including an email privileged in DEV, and unique DEV header actions. Added provider-free Chromium `--header-roles-only` coverage for DOM/accessibility absence, keyboard operation, Settings/New project, DEV scenarios/telemetry/export and control bounds at 1600/800/390/320 px. Header interactions make zero API calls.
- Verification PASS: typecheck, canonical Linux build, artifact validation, **130 focused regressions**, focused and existing full workspace Chromium smoke, six representative screenshot reviews and diff check. Hosted/Cloudflare/native Windows verification remains **NOT VERIFIED**. API hardening and Notebook ownership/logout remain separate release gates. No runtime/configuration/dependency changes, provider calls, commit/push, Access/branch changes, merge or deployment; patch remains local for review.

## 2026-10-15 — B1.9-V3-C2-C1-C final Preview integration review

- **PASS — READY FOR PUBLICATION REVIEW**, with preparation **NOT READY FOR DEPLOYMENT / deployable=false**. Local/remote branch and PR #60 head remain `2ced3eaee65fccbaf27f706c5baee6e08786186e`. C1 was originally local, subsequently published as this commit; the reviewed C2-C1/A/B/C diff remains uncommitted and unstaged. The flag is review metadata, not a Wrangler deployment lock; authorization still prohibits publication/deployment.
- Reconciled verified C2-B1 operator facts: account `4638092f63fa7fe58bcb9d2d041b7855`, provisioned namespace `apu-pr60-e2e-devlog-state` / `1729ce8a6acd4cdcbed8248ac543677b`, initially empty with no binding/deployment at creation, still not bound to a deployed Preview. Preserved verified issuer/exact operator-copied AUD, sole developer `catsystem.exe@gmail.com`, bypass `"0"`, and existing application/policy identity, including policy ID `0370da35-f13c-4f72-8ced-9468bf1ca025`. No tester approval or hosted runtime isolation is claimed; no provider credentials were added.
- Verification PASS: typecheck, canonical build/artifact, Wrangler **4.150.0** schema/generated redirect/config inspection, production preservation, dependency/lock comparison, diff check/review; **34/34 focused tests**, **71/71 standard-runner test files**, and **652/652 combined provider-free tests**, **0 failures/0 skips**. Exact Preview vars/KV survive generation. Synthetic authentication/role and missing-provider safeguards remain strict; no real JWT, live issuer or provider request was used.
- The initial full gate found one obsolete test prohibiting Access vars across the entire configuration. Necessary scope exception: **eighth file `tests/deployment-config.test.mjs`** now verifies production separately, retains the whole-file provider-credential ban and also checks generated production fields. No test exclusions, production changes or unrelated fixes. Direct Ajv **6.15.0** is the only dependency declaration change; a full isolated offline clean install (521 packages, lifecycle scripts enabled) and clean dependency-tree check passed after resolving a sandbox subprocess-permission failure, with unchanged manifests and no transitive upgrades.
- Canonical provisioning facts are preserved despite **two unavailable, unpublished Windows C2-B1 documentation edits**. Codex did not inspect, apply, delete or merge those edits; actual file-level comparison remains required before merge/integration. Runtime history and earlier warning are retained. KI-01/B-05, Backlog and Known Issues are unchanged. No staging, commit, push, remote mutation, KV write, Access change, Preview creation/deployment, production deployment, live provider call or PR merge.

## 2026-10-15 — B1.9-V3-C2-C1-B Preview Access configuration finalization

- Added the operator-copied, exact-confirmed AUD for Access application `67a86152-2917-40c8-8e5f-6dce0beeaca8` to Preview-only vars. Preserved verified issuer, sole developer `catsystem.exe@gmail.com`, bypass `"0"` and dedicated KV `1729ce8a6acd4cdcbed8248ac543677b`. All top-level production settings, scripts and the existing seven-file uncommitted scope are preserved.
- Updated the preparation manifest with operator-verification evidence and removed the missing-AUD requirement. Classification is **STATIC CONFIGURATION COMPLETE — DEPLOYMENT PENDING AUTHORIZATION**, while **NOT READY / deployable=false** remains. Hosted Access effectiveness, deployed isolation/role/artifact proof, separate tester approval and deployment authorization are still outstanding; no tester identity or provider secret was added.
- Verification PASS: typecheck, canonical build, standalone artifact validation, **33 focused provider-free Preview/Access/rendered-HTML tests**, Wrangler **4.150.0** schema/generated-config checks, production baseline comparison and diff review/check. Exact AUD/issuer/allowlist/KV survive generation. Actual built-Worker tests use only synthetic JWT/JWKS: missing config/authentication, wrong audience and invalid signature return **401**; valid synthetic authentication reaches missing-provider **503** without external requests.
- Updated Runtime Technical Current, preserving historical preparation records and the warning to reconcile the **two unpublished Windows C2-B1 documentation edits**, which Codex has not inspected. KI-01/B-05 and other tracking are unchanged. No staging, commit/push, remote mutation, Access policy change, KV creation/write, Preview creation/deployment, production deployment, live provider call or PR merge.

## 2026-10-15 — B1.9-V3-C2-C1-A Preview developer Access input completion

- Continued the existing seven-file uncommitted C2-C1 preparation at `2ced3eaee65fccbaf27f706c5baee6e08786186e`. Added exactly `catsystem.exe@gmail.com` as the sole Preview-specific developer allowlist value; issuer, bypass `"0"`, dedicated KV `1729ce8a6acd4cdcbed8248ac543677b`, production configuration and deployment commands are preserved.
- Kept `CF_ACCESS_AUD` unresolved and absent from runtime vars: the visual candidate requires exact comparison with the copied AUD tag of `apu-ms-site - Cloudflare Workers` (`67a86152-2917-40c8-8e5f-6dce0beeaca8`). Manifest records candidate-only evidence, developer approval and a separate tester neither approved nor verified. Classification remains **PARTIAL — ACCESS INPUTS REQUIRED / NOT READY / deployable=false**; hosted developer-role verification is also pending.
- Static verification PASS: typecheck, canonical build, standalone artifact validation, **27 provider-free Preview/Access/rendered-HTML tests**, Wrangler **4.150.0** schema/generated-config checks, production baseline comparison and diff check/review. The generated Preview block exactly preserves the approved email and isolated KV. With AUD absent, the actual built API returns **401** before any external request; no provider credentials were introduced.
- Updated Runtime Technical Current and preserved the warning to reconcile **two unpublished Windows C2-B1 documentation edits**, which Codex has not inspected. No commit/push, API/provider call, remote resource or Access change, KV write, Preview creation/deployment, production deployment or PR merge. Backlog/Known Issues unchanged; KI-01 and B-05 remain open.

## 2026-10-15 — B1.9-V3-C2-C1 isolated Worker Preview configuration integration

- Prepared an uncommitted/unpushed diff on exact PR #60 baseline `2ced3eaee65fccbaf27f706c5baee6e08786186e`, fetched and verified against the branch and PR head before editing. Added a real schema-valid `previews` block for parent `apu-ms-site` / planned `apu-pr60-e2e`, binding `DEV_LOG_STATE` to operator-verified dedicated KV `apu-pr60-e2e-devlog-state` / **`1729ce8a6acd4cdcbed8248ac543677b`**, in account `4638092f63fa7fe58bcb9d2d041b7855`. Production top-level config/KV, legacy `preview_id`, Vinext graph/assets/compatibility and build/deploy commands are unchanged.
- Set only verified Preview variables: bypass `"0"` and issuer `https://catsystem-ai.cloudflareaccess.com`. Recorded the C2-B1 report of Worker Access **All traffic**, login on every production/Preview URL and **APU Developers — Allow**, without inferring identities or claiming Codex inspected Cloudflare. Exact AUD and approved developer/tester identities remain unresolved; the manifest retains **deployable=false / NOT READY** and classification **PARTIAL — ACCESS INPUTS REQUIRED**. Removed obsolete unknown-KV and mandatory provider-secret bootstrap requirements; no provider secrets were provisioned or copied, and later bootstrap must ignore shared Previews Base settings.
- Static verification PASS: direct pinned Ajv **6.15.0** and lockfile install, typecheck, canonical build, standalone artifact validation, **27 focused provider-free Preview/Access/rendered-HTML tests**, installed Wrangler **4.150.0** schema checks, effective generated-config inspection and diff check/review. Generated Preview binding/vars exactly match source; actual built API with missing AUD rejects before external requests. Existing module-discovery, production KV and assets/compatibility contracts survive generation; no generated file or production script was patched. Hosted edge/resource/runtime proof remains NOT VERIFIED.
- Updated Runtime Technical Current while preserving prior preparation history. **Reconcile the two unpublished Windows C2-B1 documentation edits before merge/integration**; Codex did not inspect or synchronize those local edits. Backlog/Known Issues are unchanged; KI-01 and B-05 remain open.
- No commit/push, Workers Builds trigger, remote infrastructure mutation, KV creation/write, Access change, Preview creation/upload/deployment, production deployment, provider request or PR merge. This records configuration preparation and static checks, not an existing or ready deployed Preview.

## 2026-10-14 — B1.9-V3-C1 isolated Worker Preview preparation

- Publication follow-up: the originally local C1 preparation below was subsequently committed/published to PR #60 as **`2ced3eaee65fccbaf27f706c5baee6e08786186e`**. Its original no-commit statements describe the preparation stage; the new C2-C1 changes remain uncommitted on this published baseline.
- Prepared a deliberately non-deployable plan for `apu-pr60-e2e` under `apu-ms-site`, with dedicated KV/Access/secret inputs left unknown and no production or existing `preview_id` fallback. No active Wrangler Preview block, fake namespace ID or secret values were added. Production config, standalone Vinext graph/assets, compatibility settings and deployment/build commands remain unchanged.
- Documented current Worker Previews syntax from official Cloudflare docs and installed Wrangler **4.150.0**, name/secret/Base-isolation options, Preview KV `id` semantics, operator-only provisioning/Access/secret/deployment steps, generated-config checks, deployment evidence and an isolation matrix. Version URLs are not isolated Worker Previews. Future bootstrap omits provider secrets until edge Access is verified; no pipeline migration or deployment is authorized here.
- Verification PASS: typecheck, **26 provider-free schema/configuration/Access/rendered-HTML tests**, canonical Linux build, standalone Worker artifact and diff review/check. Active config and supported proposed field placement validate against the installed schema; the plan is rejected as Wrangler config. Actual resource bindings, generated Preview settings and hosted/edge/runtime isolation are **NOT VERIFIED**. Classification: **PARTIAL — MISSING REQUIRED RESOURCE DATA**; dedicated namespace, Access values/policy and Preview credentials still require the operator.
- Local patch only: no commit/push, CI trigger, resource/secret/Access provisioning, Preview/version upload, production deployment, provider call or PR merge. Backlog/Known Issues unchanged; KI-01 and B-05 remain open. No Preview existence, security or native Windows PASS is claimed.

## 2026-10-14 — B1.9-R4 full regression gate repair

- Corrected obsolete initial HTML expectations: authenticated identity/current workspace/developer controls replace closed-popover model/IN/OUT expectations, and shared Settings is required for testers as well as developers. Negative tester assertions still exclude telemetry, diagnostic, scenario and Session JSON developer surfaces.
- Proved the combined `jwks_unavailable` cause: the module-scope rendered-HTML fetch mock was displaced before the Worker imported, so Vinext captured another test's fetch mock and retained it through its request wrapper. Render fixtures now own and restore fetch, Vinext's original-fetch/patch descriptors and temporary environment per test, with fresh Worker/JWKS module state. Synthetic JWKS and cryptographic JWT checks remain strict; inherited provider credentials are temporarily removed and external requests forbidden. Added explicit invalid signature/issuer/audience/expiration, missing/unavailable JWKS and preloaded-fetch/cleanup regressions; production authentication is unchanged.
- Baseline reproduced: isolated HTML **2/4 pass**, combined suite **632/635 pass** with three failures; default runner **69/70 files pass**. Final verification PASS on Linux/Node **24.19.0**/npm **11.9.0**: typecheck, canonical build, standalone Worker artifact, rendered-HTML **9/9**, Access-control **12/12**, full default runner **70/70 files twice**, full combined process **640/640 tests twice**, **0 failures/0 skips**, diff review/check and existing synthetic Chromium full workspace smoke. No corrected-run intermittency was observed. No test files were excluded or security tests skipped.
- Updated Runtime Technical Current; Backlog/Known Issues unchanged, with KI-01 and B-05 still open for authenticated hosted verification. Native Windows/live-provider/production behavior remains **NOT VERIFIED**. Changed only the rendered-HTML test and these completion documents; no production application/access-policy, scripts/configuration, provider calls, PR merge or intentional deployment.

## 2026-10-14 — B1.9-R3 project-scoped usage isolation

- Bound all asynchronous client usage producers to the existing project epoch. The shared collector checks ownership before ingestion and inside the queued React updater, preventing delayed old-project responses from contaminating a reset project's ledger or cost/token summary. Need Router ownership is captured when its instance is created, before delayed callbacks; extraction, Controller/Main events, analysis, legacy Build/Preview, Rozbor components and F3 all pass their captured ownership.
- Retained current-project canonical usage for failed provider/error responses, invalid output and obsolete working-source responses. Extraction error responses now ingest any canonical records before existing error handling; terminal stream error collection still precedes raising the error. Canonical record parsing, immutable identities, call-ID upsert, pricing snapshots, summaries, role-independent accounting and Session JSON schema 1.0 remain unchanged.
- Verification PASS: typecheck, **127 focused provider-free/mocked regressions** (20 new actual-client-function ownership tests), diff check/review, deferred actual-client Chromium usage smoke, existing preview smoke and full workspace smoke. Verified old F3 success/failure exclusion, A/B request overlap, failed/obsolete current-project accounting, router/extraction resets, queued updater rejection, new-project collection, deduplication and stream errors. Inspected one-call/110-token developer summary evidence; existing normal/developer responsive navigation, document/export and request lifecycle checks passed. Hosted/live-provider, native Windows and production behavior remain **NOT VERIFIED**. Full Node suite not rerun; its three documented baseline failures remain outside this batch.
- Updated Runtime Technical Current; Backlog and Known Issues unchanged. Legacy application-state callbacks were not refactored. No API request-count, pricing/ledger schema, NAV/F1/F2/F3 contract, model/cache or extraction/grounding changes. No paid API calls, PR merge or deployment.

## 2026-10-14 — B1.9-R2 stale F1 NAV readiness guard

- Fixed the client shortcut that trusted an explicit `continue_to_solution` event after required Notebook information was removed. It now reuses `resolveDialogEvent()` on the current compact Notebook before entering F2. Missing manifestation/goal returns the canonical intake MAIN/SIDE set in the pending assistant message, without a model/API request, phase change, router work, analysis or accepted source. Older NAV controls become inactive; action-only final messages no longer show a typing indicator. Ready navigation retains optimized direct F2 entry and unchanged provider operations; text-intent handling and KI-02's manual-record repair remain intact.
- Verification PASS: typecheck, **120 focused provider-free/mocked regressions**, diff check/review, isolated actual-client Chromium NAV smoke and existing preview smoke. Tested sourced/manual records, deletion/empty records and both-missing priority, restored readiness, actual client shortcut and text navigation, zero stale-click calls, exactly router + analysis for ready clicks, accepted document creation, normal/developer desktop/mobile entry and existing preview failure/retry/reset/late-event/request isolation. Inspected desktop missing-manifestation and missing-goal fallback screenshots. Hosted authentication, native Windows/live-provider and production verification remain **NOT VERIFIED**; full suite not rerun and its three documented baseline failures are not repaired or claimed PASS.
- Updated Runtime Technical Current only; Backlog and Known Issues unchanged. No shared validator/readiness-policy, extraction/grounding, prompt/model/cache, snapshot/fingerprint/F3 ownership or project-usage changes. No paid API calls, merge or deployment.

## 2026-10-14 — B1.9-R1 manual Notebook serialization repair

- Resolved KI-02: the previous default filter compared two undefined source IDs and silently omitted source-less manual records. `compactNotepad()` now applies source exclusion only when an explicit exclusion ID exists. All nonempty manual/sourced records retain existing order, IDs, text trimming and need mapping; manual edits remain available. Main's current-turn source exclusion is preserved without extra provider calls.
- Verification PASS: typecheck, **249 focused provider-free/mocked regressions**, diff check/review. Eight new tests cover empty/default compaction, all five manual categories, exact source exclusion, source-less edits, unchanged mapping, actual extraction/Controller/Main context, all three F2 analysis canonical-need paths, strict invalid-need rejection and immutable snapshot/F3 currency behavior. Only `app/notepad-model.ts` changed in production; prompts, grounding, NAV/readiness, cache, model parameters, snapshot schemas/fingerprint algorithm, F3 ownership and project-scoped usage remain unchanged.
- Updated Runtime Technical Current and resolved only KI-02 in Known Issues; Backlog and KI-01 unchanged. The full suite was not rerun; the three documented pre-existing baseline failures remain outside scope. Native Windows, authenticated hosted/live-provider and production verification remain **NOT VERIFIED**. No paid API calls, PR merge or deployment.

## 2026-10-14 — B1.8-A early validated F1 action preview

- Chat emits a lightweight `dialog_actions_preview` event after existing Controller resolution, only for structured intake turns. The client displays canonical actions provisionally through unchanged `DialogActionCard` components with all choices inactive; `done` alone accepts final message actions and replaces the preview with one final card set. Existing processing status and buffered, safety-filtered Main prose remain intact.
- Preview state is request/message-scoped and excluded from canonical history, Session JSON, Notebook, F2/F3 and routing. Failure/incomplete/interrupted/exception paths, reset, relevant navigation and teardown clear it; request/project guards reject late events and prevent old cleanup from unlocking a newer turn. Prompts, validation, provider payloads/calls/settings/cache, usage/latency telemetry and existing F2/F3 behavior are unchanged.
- Verification PASS: typecheck, **125 focused provider-free/mocked regressions**, diff check/review, isolated actual-client Chromium preview checks and the existing full workspace smoke. Visually inspected disabled/final states at desktop and mobile widths; verified normal/developer behavior, pending JSON exclusion, failures/retry, reset/new-request races and teardown. Authenticated hosted and native Windows/browser verification remain **NOT VERIFIED**; no backend-latency or measured native-Windows UX improvement is claimed. No paid API calls, merge or deployment; Backlog and Known Issues unchanged.

## 2026-10-14 — B1.7-A cache-aware F1 request envelopes

- Added GPT-5.6 explicit-only cache boundaries after the complete unchanged developer instructions for extraction, primary grounding, rescue grounding and Quest Controller. Dynamic user/Notebook/candidate/Controller context follows outside the boundary; models, reasoning, service tiers, schemas, token limits, store settings, validation, routing, provider-call counts and canonical usage/latency telemetry remain unchanged. No cache key, prewarming or retention override was added.
- F1 Main remains unchanged for semantic safety: top-level per-response instructions mixed with dynamic context and `previous_response_id` cannot be moved into persistent input messages without changing conversation semantics.
- Verification PASS: typecheck, **169 provider-free/mocked regressions**, complete baseline effective-request signatures for all five operations (Main first/follow-up included), changed-context cache isolation, existing extraction/grounding/Controller/F1/usage/Session JSON contracts, and diff check/review. Live cache hits, prefix token counts, latency/net-cost benefit, Windows and hosted/production runtime are **NOT VERIFIED**. No paid API calls, PR merge or deployment; Backlog and Known Issues unchanged.

## 2026-10-14 — B1.6-B1 explicit Quest Controller F1 NAV instructions

- Clarified the existing F1 NAV instruction with the complete canonical object: `type: NAV`, `target: phase`, `required: false`, canonical question, and exactly one `continue_to_solution` option with the canonical label. Both text fields reuse the imported `CONTINUE_TO_SOLUTION_LABEL`; no hardcoded label copy was added. The reported live `invalid_nav_contract` field remains unknown.
- Added focused assertions for actual provider instructions, canonical-label reuse, valid existing NAV acceptance and invalid target/required/cardinality/option rejection, including unchanged fallback/rejection telemetry and usage accounting. Validator, fallback, MAIN/SIDE ordering, intake readiness, pending SIDE exception, explicit transitions, Core boundaries, grounding and Controller execution are unchanged; no normalization, retries, extra model calls or model/reasoning/service-tier changes.
- Verification PASS: typecheck, **129 focused NAV/Controller and existing F1/dialog/grounding/usage/Session JSON regressions**, diff check/review and byte comparisons confirming only Controller instructions changed in production code. Provider responses were mocked; no paid API calls. Live-provider effectiveness, latency changes and Windows/production runtime after this clarification are **NOT VERIFIED**. No merge or deployment; Backlog and Known Issues are unchanged.

## 2026-10-14 — B1.6-A grounding/Controller observability documentation completion

- Documented the implementation already committed at `5e08e670bfb65fab58606e805d47cfed44fb3a87`: separate primary/rescue grounding handling status, call identity, duration, canonical provider/application status and per-attempt usage; safe failure/skip reasons; candidate counts and monotonic rescue outcome. The existing aggregate grounding stage and its legacy status/timing/usage semantics remain intact.
- Documented developer-only `controller.rejection_reason` diagnostics alongside the retained coarse `fallback_reason`, plus optional additive grounding/rejection fields in backward-compatible Session JSON schema **1.0**. Diagnostic codes/counts do not expose prompts, question/generated text or raw exception/provider messages. Canonical usage/pricing records, F1 decisions/validation, provider-call counts, models, reasoning and service tiers are unchanged.
- Verification distinction: prior implementation verification passed **178 tests**, **19 extraction baseline scenarios** and **1,056 Controller validation comparisons**. This documentation-only completion passed typecheck and the requested six-file test command; enumerated execution of those files confirmed **93 tests PASS**, with final diff review/check PASS. Tests used mocked provider/authentication boundaries and made no paid API calls. Native Windows runtime, live-provider integration and hosted/production runtime remain **NOT VERIFIED**; no Windows or production PASS is claimed.
- Changed only Runtime Technical Current and Changelog. No source/test/dependency changes, new features, PR merge or deployment; Backlog and Known Issues are unchanged.

## 2026-10-14 — Cloudflare development toolchain compatibility repair

- Removed the duplicate local `nodejs_compat` override from `vite.config.ts`; preserved `wrangler.jsonc` byte-for-byte, including compatibility date **2026-08-21**. Updated only the three requested direct development dependencies: Wrangler **4.150.0**, Cloudflare Vite plugin **1.63.2**, Workers types **5.20261006.1**; regenerated the npm lockfile and matching Cloudflare/native-tooling transitives without force or legacy peer overrides.
- Verification PASS in Codex Cloud/Linux: lockfile installation through the existing environment wrapper, clean full installed dependency tree/no peer conflicts, typecheck, **107 relevant tests**, bounded build, standalone Worker artifact validation and diff check. Generated configuration has the unchanged compatibility date and exactly one compatibility flag. Existing install-only unused platform helpers were cleaned without changing cross-platform lock metadata; application code and scripts are unchanged.
- Updated Runtime Technical Current. Local Windows install/startup/browser smoke and production runtime are **NOT VERIFIED**; build/artifact PASS does not imply either. No unrelated direct dependency upgrades, model/API/prompt/Core changes, PR merge or deployment. Backlog and Known Issues are unchanged.

## 2026-10-14 — Quest Controller contract consistency and fallback observability

- Reimplemented directly on F1–F3 baseline `a912aa82983f62522819c830afd142308365ec35`, without fetching/merging PR #61 or using a B1.4 worktree. Controller NAV instructions, deterministic NAV and strict option validation now share the canonical label from `dialog-action.ts`.
- Aligned pending SIDE instructions and validation: an exact retained target/question may survive asked-target history while relevant/unanswered; answered canonical context/course/helps categories and unrelated duplicate questions remain rejected. Semantic relevance/answer interpretation stays with the Controller/Core; deterministic validation checks identity and canonical Notebook evidence. Navigation minimums, explicit transitions and deterministic bypass boundaries remain unchanged.
- Added six allowlisted fallback reasons: `provider_failure`, `incomplete_provider_response`, `transport_failure`, `json_parse_failure`, `controller_contract_validation_failure`, `unknown_failure`. Developer telemetry/Session JSON retain the reason without prompts, generated content or exception text; canonical provider/application status, token usage and pricing records remain intact. No model/reasoning changes, retry calls or streaming changes.
- Fixed direct file-URL resolution in the two specified instrumentation/usage-collection test loaders, preserving their existing assertions.
- Verification: the initial four-file baseline had **48 existing tests PASS** (the requested estimate was 49); the expanded controller/dialog, F1 response-contract, instrumentation, usage/ledger and export regression suite has **94 tests PASS**, including new contract/fallback assertions. `npm run typecheck` and `git diff --check` passed. All provider scenarios used local mocks; no paid API tests. Native Windows execution and hosted/provider integration remain **NOT VERIFIED**. At verification, commit/push awaited subsequent authorization. No PR merge or deployment was performed.

## 2026-10-13 — Chat composer, message and scrolling presentation

- Replaced focus-triggered composer activation with an immediately editable compact textarea; focus keeps geometry stable and content grows up to 150 px. Existing Enter/Shift+Enter, send/retry/loading, dictation and attachment placeholder behavior remains.
- Made ordinary assistant replies transparent; constrained Chat text and welcome help to their available width. All Chat phases now hide the visual scrollbar and share the existing opaque, keyboard-accessible bottom arrow, 48 px threshold, reduced-motion scrolling and reader-position safeguards.
- Disabled inline FÁZE and Profil/Blok/Zóna diagnostics through a client presentation flag, including DEV ON; retained actual message metadata, functional mapping, parsing, developer diagnostics, Session JSON and telemetry. Meaningful notices and interactive cards remain.
- Verification: typecheck and **239 focused tests** passed. Isolated actual-client Chromium Chat A–R and existing navigation/document/F3/Reset/export suites passed; desktop/mobile screenshots were inspected, including bounded 320 px help, long wrapping and visible bottom controls. Existing six-page A4 A/B PDFs and generated table/card exports passed regression checks. Hosted rendering is **NOT VERIFIED** (branch URL inaccessible); real speech/audio, physical mobile/IME input, Firefox/WebKit runtime, hosted fonts and human print dialog remain unverified. Synthetic responses/recognition and fallback fonts were used without Access bypass or provider-backed F1 benchmarks.
- Updated Technical Current only. Controlled Notebook Editing, KI-02, roadmap/backlog/Known Issues and analytical/provider contracts are untouched. No merge, deployment or release tag.

## 2026-10-13 — Permanent workspace navigation, Batch 1

### Added / Changed
- Added permanent desktop **Chat / Obsah / Výstup** and **Zápisník / Dokument** rows. Fresh F1 selects Chat/notepad with future tools visible/disabled; phase/readiness and guarded native/internal handlers control availability. Retained Document viewing remains accessible through stale source situations without permitting invalid generation.
- Added independent right viewing state while retaining analysis/output ownership. Left tool/Chat selection preserves deliberate notebook viewing; returning Document restores one mounted default/generated view and its existing controls without calls, source adoption, reset or revision. Right tabs replace the duplicate header title; document actions remain exclusive to Document.
- Added retrospective read-only notebook presentation after accepted F2, preserving source wording/order/links and guarding callbacks. Editable F1, supported Chat/extraction updates and all F2/F3 contracts remain unchanged. Scoped user-facing Build labels/guidance become Obsah; internal names remain.
- Changed disabled Output update cursor from `wait` to `default`; existing enabled pointer/loading feedback and F3 eligibility are preserved. Updated roadmap/runtime documentation. Controlled notebook edits/drafts/reanalysis remain paused; KI-02, backlog and Known Issues are unchanged.

### Verification
- Typecheck and **187 focused tests** passed: navigation availability/state isolation, read-only UI/callback enforcement, contextual labels/links, F1 edit controls and existing source/phase/F3/export regressions.
- Existing isolated actual-client Chromium smoke passed A–P plus prior suites: fresh rows, disabled mouse/keyboard/internal activation, F2 readiness, read-only source review/navigation, retained documents/Output controls, computed cursor states, no navigation API/revision/adoption, header actions and normal/developer responsive 30/70/resized/800×600/portrait/390 px/320 px. Screenshots were inspected; A/B PDFs remain 6 complete A4 pages and generated formats/export retain their data.
- Hosted authenticated rendering is **NOT VERIFIED** (branch URL inaccessible), separately from synthetic PASS. Exact hosted fonts, human native print dialog, physical printing and physical Windows cursor appearance remain unverified; computed cursor states pass. No Access bypass, provider-backed F1 benchmark, controlled editing/KI-02 fix, release tag, merge or deployment occurred.

## 2026-10-13 — Change-aware F3 update and document presentation Reset

### Added / Changed
- Added one deterministic F3 generation decision for the primary button and handler: untouched/default or matching retained source/config needs no model call; meaningful effective settings or a new adopted source with retained material permit explicit generation, subject to existing source/readiness/loading protections. No-op and same-event duplicate invocations cannot start requests or overlays.
- Retained generated source fingerprint and copied effective settings as local render provenance. Configuration Q → R → Q restores matching render freshness only for the same current adopted source; source-stale material stays stale. Monotonic configuration/request guards remain separate from equality; provider/snapshot contracts and persistence are unchanged.
- Added accessible Reset before Copy/Print/Share in the shared header. It instantly restores analysis, VAR A and default F3 settings, retaining accepted source, Build/notebook/hypotheses, timestamp and old generated content/provenance. Reset is disabled when already default or generation is pending, never adopts upstream content or calls a model, and recomputes normal generation eligibility. Instant A/B and accepted Build auto-adoption remain unchanged.
- Updated runtime technical-current documentation only. Roadmap, backlog, Known Issues, workflow/Core and overall project-reset behavior remain unchanged.

### Verification
- `npm run typecheck` and **164 focused tests** passed: eligibility/default and generated configuration reversion, source identity/provenance, Reset preservation/no-op, specialized prerequisites, monotonic in-flight rejection and existing source/navigation/header/export regressions.
- Existing isolated actual-client Chromium fixture passed A–O and prior suites: meaningful/no-op/duplicate handler behavior, retry, accepted new-source regeneration, retained stale output, protected upstream Reset, instant A/B, pending guards, keyboard Reset, normal/developer and narrow desktop/portrait/mobile header bounds. Screenshots were visually inspected. A/B PDFs remain 6 complete A4 pages; Copy/source identity, creation date/margins/pagination, stale exports and generated text/table/card data passed.
- Hosted authenticated visual inspection is **NOT VERIFIED** (branch URL inaccessible), separately from the synthetic fixture PASS. Exact hosted fonts, human native print dialog and physical printing remain unverified. No auth bypass, live provider benchmark, new infrastructure/persistence, DOCX, sharing, release tag, PR merge or deployment occurred.

## 2026-10-13 — Document header and update flow refinement

### Added / Changed
- Added genuine session-only working-document creation metadata at first validated F2 baseline acceptance, preserved across revisions/navigation/styles/generation and cleared by a new project. Czech date appears once in default Build/Output headers and PDF; unknown dates and generated representations receive no invented creation label. No source/provider/persistence/session-export schema change.
- Combined the unchanged title/methodological introduction into a compact responsive header. Dividers now appear only after that header and between major groups; categories/hypotheses/final note use spacing. A/B content, hierarchy, ranks, lists, icons and A4 reading dimensions remain.
- Added one accessible document-area **AKTUALIZUJI DOKUMENT** overlay for real pending Build/F3 generation, retaining valid content and reading position. Reduced-motion is respected; header exports are disabled while pending. Success/failure/obsolete/reset clears progress; local acceptance/navigation/selections/adoption create no artificial spinner.
- Unified explicit Build acceptance through a validated pure orchestration and client commit path: changed async generated components or local removal advance F2 and adopt into F3, activating current default without confirmation/model calls. Identical fingerprints remain unchanged. Retained old generated outputs/config stay available as stale; warnings appear when old output is displayed. Upstream changes outside Build retain explicit adoption protections; regeneration still reads the newly adopted immutable snapshot directly.
- Removed routine **Vrátit se do Rozboru** from Output; Build tab remains, with **Přejít do Buildu** for contextual recovery. Updated roadmap/runtime docs; historical decisions retained, backlog/Known Issues unchanged.

### Verification
- `npm run typecheck` and **155 focused tests** passed, including metadata/unknown dates, Build acceptance/local removal/revision identity, immutable source/stale/config ownership, protected upstream adoption, default/generated rendering, navigation and export regressions.
- Existing isolated actual-client Chromium fixture passed header/update A–L and prior suites: stable actual timestamp/reset, compact header/major-only dividers, Build/F3 progress and cleanup, no navigation/style/config/adoption model requests, preserved reading position, successful auto-adoption, old S0 cards/stale exports, direct S1 regeneration, failure/obsolete handling, local removal and upstream explicit adoption. Reset during pending F3 rejects the old-project response. Normal/developer, desktop/narrow/portrait/mobile, keyboard/actions and reduced-motion passed.
- A/B each produced **6-page A4 PDFs**, with actual creation metadata once, full source/Copy text/order, 18 mm bounds and heading/list pagination. Generated table/card data and stale export warnings remain intact. Desktop A/B, mobile headers, Build/F3 overlays and representative print pages were visually inspected.
- **NOT VERIFIED:** authenticated hosted rendering (branch URL inaccessible), exact hosted fonts, human native print dialog and physical printing. Fixture uses synthetic responses/Arial fallbacks and intercepted print invocation. No auth bypass, provider-backed benchmark, new infrastructure/storage, DOCX, release tag, PR merge or deployment occurred.

## 2026-10-13 — Default document information hierarchy

### Added / Changed
- Grouped the shared deterministic default document into **Informace ze Zápisníku**, **Pracovní hypotézy** and conditional **Rozšíření analýzy**. Notebook categories use original structured list items; active need repeats are excluded only by trim/whitespace comparison, retaining distinct goals and every stored record.
- Moved meaningful analytical focus into hypotheses, retained original hypothesis ranks/content and accepted component mappings, and placed general uncertainty after hypotheses. Exact already-displayed local limitations are not repeated; distinct and otherwise unrendered aggregate values remain.
- Explicitly excluded `analysisContext.summary` and `needAnalysis.intendedOutput` from default DOM/Copy/PDF while retaining them untouched in the accepted snapshot. No classifier, source/schema mutation or model generation was introduced.
- Replaced global numbers with major/minor semantic headings and shared paragraph/list blocks. VAR A stays default; VAR B icons now orient only major groups/general uncertainty. Copy includes the same full projected hierarchy and usage heading as the visible/printed document. Generated F3 text/table/card contracts, client style state, source adoption/revisions/stale rules and existing header actions remain unchanged.
- Updated the roadmap current-design addendum and runtime technical-current document; historical roadmap/changelog retained. DOCX remains future; backlog, Known Issues and workflow files are unchanged.

### Verification
- Typecheck and **148 focused tests** passed: source variations, missing/empty categories and questions, one/two/multiple hypotheses with nonconsecutive ranks, conservative dedup/exclusions, all accepted component kinds across three strategies, F2/F3 default identity, A/B content/Copy parity and state/export regressions.
- Existing isolated actual-client Chromium fixture passed hierarchy A–L plus prior header/workspace/style checks, with no A/B/navigation API calls or source/config changes. Desktop 30/70, narrow desktop, portrait/mobile, normal/developer mode, copy/print/stale controls and generated outputs passed.
- A/B each produced **6-page A4 PDFs**, with complete projected text/order equal to Copy, 18 mm margin bounds, headings/list labels followed by content and short items retained. Generated table/card PDF data and document-only isolation passed. Desktop A/B, long hypotheses/mobile and representative print pages were visually inspected.
- **NOT VERIFIED:** authenticated hosted rendering (branch URL inaccessible), exact hosted fonts, human native print dialog and physical printing. Fixture uses synthetic accepted content, Arial fallbacks and intercepted print-dialog invocation. No auth bypass, provider benchmark, new infrastructure, DOCX, PR merge or production deployment occurred.

## 2026-10-13 — Default document styles A / B

### Added / Changed
- Added default **VAR A — Čistý dokument** and optional **VAR B — Strukturovaný dokument** for the deterministic accepted working analysis: one centered white reading page, identical complete content/order, sequential section markers or quiet monochrome orientation icons, thin dividers and no section cards/colored fills.
- Added isolated client-only style selection in the existing Výstup tool; Build/default Výstup/Chat preserves the choice without API calls, adoption, staleness or source/config revisions. Generated text/table/card representations remain separate and unchanged.
- Added bounded semantic paragraph/list presentation while preserving original wording and uncertain text literally. Clipboard remains the original full material text. Default print uses the existing article reference with named A4 pages, 18 mm margins, readable typography and continuous pagination; mobile/portrait text clears the existing floating rail.
- Updated the current-design roadmap addendum and runtime technical-current document. DOCX remains future/out of scope; backlog, Known Issues and workflow files are unchanged.

### Verification
- Typecheck and 138 focused renderer/content/Build/F3/export/source/state/access/header regressions passed, covering all three internal strategies and accepted expansions.
- Existing actual-client Chromium fixture passed A–L with realistic long accepted content, A/B semantic/copy identity, unchanged next F3 request/source/config revision, normal/developer roles, navigation, font-size preferences and desktop/800×600/portrait/390 px/320 px layouts. Prior header copy/print/stale and Settings/Session JSON regressions passed.
- Both variants produced 7-page A4 PDFs. Complete original text/order, all hypotheses/expansions/questions/uncertainty, 18 mm margin bounds, heading/list-label grouping and intact short list items passed text/bounding-box checks. Generated table/card PDF data and document-only export passed. Screen and PDF screenshots were inspected.
- Hosted authenticated visual verification: **NOT VERIFIED — access blocked**. The isolated fixture uses Arial fallbacks rather than hosted `next/font` assets and intercepts native print-dialog invocation. No authentication bypass, provider-backed benchmark, PR merge or deployment was performed.

## 2026-10-13 — Document UI consolidation

### Added / Changed
- Unified Build and Výstup primary labels as **AKTUALIZOVAT DOKUMENT** / **AKTUALIZUJI DOKUMENT**, preserving their separate F2 acceptance and F3 rendering handlers/guards.
- Moved existing selected-document Copy and browser Print / Save as PDF into the shared **Dokument** header, with accessible icons, export feedback and a disabled **Připravujeme** Share placeholder. Removed footer export duplicates; accepted-only targets and stale warnings remain intact, with unavailable/loading export guards.
- Moved unchanged diagnostic APU Session JSON download beside beaker/dollar in the left header, developer-only. Moved Settings into the right header for both roles, retaining communication/appearance preferences and keeping model/usage/diagnostics under the developer dollar icon. Removed floating Settings/Session JSON controls; retained responsive navigation and document styling.
- Updated the technical-current action ownership and role-visibility rules. Backlog, Known Issues, roadmap and workflow documents are unchanged.

### Verification
- Typecheck and 175 focused workspace/Build/F3/snapshot/export/navigation, Settings/access, Session JSON and usage tests passed.
- Actual-client Chromium fixture with synthetic responses passed scenarios A–J, including copy/print in Build/Output, representation switching, stale copied/printed warnings, empty/loading/boundary guards, failure feedback, role visibility, native Settings keyboard/focus/outside closing and desktop/800×600/portrait/390 px/320 px bounds. Screenshots were inspected. Default Build/Output PDF text is identical; generated/stale PDF preserves content/warnings and excludes application controls. Native print-dialog invocation is intercepted headlessly.
- Authenticated live visual verification: **NOT VERIFIED — access blocked**; hosted URL unavailable to this environment. No authentication bypass or provider-backed calls were used.

### Preserved scope
- Document substance, structure and typography, frozen F1, F2 analytical/routing operations, accepted snapshots and F3 materialization/source contracts are unchanged. No sharing, new document format/persistence, PR merge or production deployment.

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
