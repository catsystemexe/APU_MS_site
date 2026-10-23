# B4 prerequisite repair and testability assessment — 2026-10-23

> **Later B4-H1 supplement:** the isolated Chromium harness is now implemented and Linux V2 verified; see [B4-H1 evidence below](#b4-h1-synthetic-browser-harness--2026-10-23). The repair/audit sections immediately below describe checkpoint `9018512`, before H1 existed. They remain historical evidence; Windows B4 V3 and standard-launcher acceptance are still pending. No external operator record has been overwritten or adopted.

**Linux harness V2 PASS. Native Windows portability / ACL NOT VERIFIED. B4 browser/runtime acceptance NOT PERFORMED. Hosted verification NOT PERFORMED. Collection remains OFF.**

This supplementary Codex Cloud record covers only the separately authorized portability repair and read-only browser-feasibility audit. It is not completion of [B4 Local Verification](batches/B4_LOCAL_VERIFICATION.md). Reviewed base: B3 `af21bb5213286b62637cff808649f0f09a514712`; repair branch: `codex/telemetry-b4-portability-repair`, stacked against `codex/telemetry-b3-reporting`. PR #69 remained open/unmerged at inspection with that exact head; it was not modified.

The preserved workspace had no `LOCAL_VERIFICATION.md`, uncommitted operator record or local B4 evidence branch at inspection. No external Windows/browser record was recovered or adopted. If an operator has such an uncommitted record elsewhere, reconcile this supplement additively before integrating it; do not overwrite that evidence. This report supplies neither Windows results nor missing screenshots/logs.

## Implemented test repair

- Previously, directory-removal `t.after` hooks preceded SQLite-close hooks. Linux can unlink open databases; Windows file locking makes that cleanup order unsafe. One per-test owner now closes **all** opened snapshot/restore databases before removing **any** owned directories, including on assertion failure. Close failures fail cleanup before deletion; bounded `rmSync` retries handle transient locks without hiding persistent failures. The separately scoped business-table rejection connection closes in `finally`.
- The real-symlink rejection assertion is a separate subtest. On Windows only, inability to create the symlink (`EPERM`, `EACCES`, `ENOSYS`) explicitly skips that subtest as **NOT VERIFIED**, requiring a privileged rerun. Other errors fail. Supported platforms still create the link and run the original rejection assertion.
- The unchanged strict `0600` assertions for deletion intent and CSV are separate POSIX subtests. Windows explicitly skips them as **ACL NOT VERIFIED**. Windows `fs.stat().mode` is not an ACL test. A successful Windows process with these skips must not be labeled complete security verification.
- Export exclusive creation, target/cohort/test-class constraints, deletion confirmation/drift/atomicity, cutoff/child retention, restore replay, seven-day expiry, digest integrity and unmanaged-file protection remain asserted. No collector, reporting engine, storage rule, schema or export protection changed.

The opt-in Linux diagnostic preload `tests/helpers/telemetry-cleanup-lock-check.mjs` checks `/proc/self/fd` immediately before removal of these test directories and fails if a SQLite database/WAL/SHM file is still open. It is a modeled cleanup precondition, **not native Windows verification**, and deliberately refuses other platforms. It is not imported by application code or normal Windows tests.

## Executed V2 evidence

Environment: Linux, Node **v24.19.0**, existing installed dependencies; generated synthetic identities/keys, provider-free fixtures and local SQLite only.

| Check | Actual result |
| --- | --- |
| Diagnostic against original local-tools test before repair | **2 PASS / 3 FAIL**, 0 skipped; all three failures report an open SQLite connection before directory deletion |
| Same diagnostic after repair | **8 PASS / 0 FAIL / 0 SKIP** (five parent tests and three security subtests) |
| B1/B2/B3 regression command below | **228 PASS / 0 FAIL / 0 SKIP**; includes the same eight local-tools cases |
| `npm run typecheck` | PASS, exit 0 |
| Changed-test ESLint command below | PASS, exit 0, zero warnings/errors |
| Diff/whitespace review | Test files and this evidence/open B-07 tracking only; no application, Worker, configuration, dependency, report/storage or CI policy changes |
| Native Windows, Windows ACL, browser hit testing, full Windows `npm.cmd test` | NOT VERIFIED; this Cloud environment is Linux and has no native Windows executor |

Exact executed commands, from repository root:

```sh
node --import ./tests/helpers/telemetry-cleanup-lock-check.mjs --test tests/telemetry-local-tools.test.mjs
node --test tests/telemetry-reporting.test.mjs tests/telemetry-local-tools.test.mjs tests/telemetry.test.mjs tests/telemetry-b2.test.mjs tests/server-capabilities.test.mjs tests/project-reset.test.mjs tests/project-usage-isolation.test.mjs tests/usage-ledger.test.mjs
npm run typecheck
npx --no-install eslint tests/telemetry-local-tools.test.mjs tests/helpers/telemetry-cleanup-lock-check.mjs
git diff --check
```

The first command was run both before and after the cleanup repair. The regression command exercises actual authenticated routes, consent/stop/disabled boundaries, request isolation, reset/stale tickets, real ledger/synthetic transport, SQL aggregation and local retention/deletion/restore/CSV/expiry. These remain automated source/integration checks, not browser or deployed acceptance. No new application build was necessary for this test-only diff: retain the recorded B2-R01 canonical build/Worker-artifact evidence at `5be74cf12df9a3f13e64462345f3be2d3b38f416` ([architecture evidence](TELEMETRY_ARCHITECTURE.md#b2-r01-verification-correction--2026-10-23)). No fresh build PASS is claimed. CI release-context restrictions, including the previously recorded `unsupported_pr_branches`, remain separate and unchanged.

## Reproducible Windows handoff — not executed here

Use native **PowerShell**, an existing checkout with this repair, native Windows dependencies, and Node 24 matching the verified major (Cloud used 24.19.0). Do not use Git Bash/MSYS for these commands. No provider credentials, `.env.local`, telemetry activation or dev server is required. From repository root:

```powershell
node.exe --version
node.exe --test tests/telemetry-local-tools.test.mjs
if ($LASTEXITCODE -ne 0) { throw 'local-tools failed' }
$testFiles = @(
  'tests/telemetry-reporting.test.mjs', 'tests/telemetry-local-tools.test.mjs',
  'tests/telemetry.test.mjs', 'tests/telemetry-b2.test.mjs',
  'tests/server-capabilities.test.mjs', 'tests/project-reset.test.mjs',
  'tests/project-usage-isolation.test.mjs', 'tests/usage-ledger.test.mjs'
)
node.exe --test @testFiles
if ($LASTEXITCODE -ne 0) { throw 'regression failed' }
npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) { throw 'typecheck failed' }
node.exe node_modules/eslint/bin/eslint.js tests/telemetry-local-tools.test.mjs tests/helpers/telemetry-cleanup-lock-check.mjs
if ($LASTEXITCODE -ne 0) { throw 'lint failed' }
```

Record exact source SHA, Windows/Node versions, counts and each skip reason. A symlink-capable Windows run must exercise the real rejection assertion; lacking permission is an unverified capability, not a pass. POSIX subtests will skip on Windows regardless. Windows ACL review is a separate operator step on a dedicated synthetic export directory/files using `Get-Acl`/`icacls`: verify effective/inherited access for the intended operator and document the result without exporting private files or identities. Neither this patch nor `0600` proves Windows confidentiality. Until native ACL review, keep participant-linked operator exports out of that environment; no ACL/runtime policy is introduced here.

`npm.cmd test` includes `npm run build`, whose canonical scripts use Bash and `scripts/sites-env.sh` POSIX paths. The previously reported Git Bash path-conversion failure was **not reproduced here on Windows**. The direct Node invocation above avoids that shell boundary for the relevant tests, but its Windows execution remains pending and does not validate the full Windows build/test chain. No `package.json`, global build system or path-conversion workaround was added.

## Read-only browser-to-storage feasibility audit

| Source boundary inspected | Verified source fact / consequence |
| --- | --- |
| [`app/page.tsx`](../../app/page.tsx), [`app/access-auth.ts`](../../app/access-auth.ts) | Home obtains the current verified Access identity and computes `pilotAvailability` before passing it to `ApuClient`. Existing bypass is restricted to development plus `APU_LOCAL_DEV_AUTH=1`, returning fixed `local-development@apu.invalid`, role developer. Otherwise the real RS256 issuer/audience/time/JWKS/signature checks apply. |
| [`scripts/dev-local.mjs`](../../scripts/dev-local.mjs) | Established launcher explicitly sets the existing development bypass. Its fixed identity cannot pass the synthetic-domain gate. It does not assemble an enrolled synthetic telemetry fixture or emulated DB. |
| [`app/telemetry/runtime.ts`](../../app/telemetry/runtime.ts), [`worker/index.ts`](../../worker/index.ts), [`vite.config.ts`](../../vite.config.ts) | Resources/store are request-scoped via `runWithTelemetryResources`; the Worker supplies bindings. Plain `process.env` flags do not create a store/request scope. The development `previewVars` allowlist does not include telemetry configuration. Thus telemetry `.env` flags alone do not establish a ready synthetic browser fixture. |
| [`app/telemetry/server.ts`](../../app/telemetry/server.ts), actual context/events routes | Readiness requires dev/synthetic loopback, store, separate test keys, valid versions/cohort/enrollment. Synthetic identity must match `^[a-z0-9-]+@synthetic.invalid$` and its cohort HMAC must be enrolled. Context/events still run actual authentication, same-origin checks, consent/version, signed context ownership, quotas and validation. Disabling synthetic mode is not a substitute: real mode requires privacy approval/tester identity. |
| [`app/telemetry/use-pilot.tsx`](../../app/telemetry/use-pilot.tsx), [`app/apu-client.tsx`](../../app/apu-client.tsx) | Actual opt-in starts `createPilot`; active-only listeners/ticks and same-origin transport drive collection. Rendering a notice or a mock successful context response is insufficient evidence of storage. |
| [`tests/telemetry.test.mjs`](../../tests/telemetry.test.mjs), [`tests/server-capabilities.test.mjs`](../../tests/server-capabilities.test.mjs) | Existing fixtures generate RS256 JWTs/JWKS, keep local auth off, invoke real authenticated routes and wrap their actual resource/execution-context boundaries. Only JWKS/provider transport is substituted; unexpected outbound calls fail. The `next/headers` shim throws, so this is not an existing browser/Home-rendering harness. |
| [`tests/helpers/telemetry-report-fixture.mjs`](../../tests/helpers/telemetry-report-fixture.mjs), [`telemetry-sql.mjs`](../../tests/helpers/telemetry-sql.mjs) | Existing actual emitters/collector/ledger + D1-shaped SQLite adapter reconcile B3 output. The reporting fixture directly supplies a synthetic identity to collector functions; by itself it does not exercise auth, network/browser UI or Worker/Vinext bootstrap. |

**Conclusion:** the unmodified established `dev:local` launcher cannot currently demonstrate the eligible synthetic browser-to-database path. This is a testability gap, not a demonstrated auth/collector defect. Source evidence supports an isolated **test-only** browser harness using existing signed-JWT, resource-scope and SQLite seams, without changing application auth policy or adding a bypass. No such harness was implemented or run in this repair. Its success would establish the isolated fixture path, not automatically prove standard launcher/Vinext/Worker wiring or satisfy all Windows B4 scenarios.

### Separate proposed batch B4-H1 — not implemented / not PASS

- **Scope/files:** a loopback-only HTTP fixture in `tests/helpers/telemetry-browser-server.mjs`, request-scoped `next/headers` adapter plus synthetic JWKS/provider transport in `tests/helpers/telemetry-browser-fixture.mjs`, actual UI entry and isolated bundler configuration under `tests/browser/telemetry/`, and browser assertions there. Reuse actual `ApuClient`/`usePilot`, actual context/events and AI routes, `runWithTelemetryResources`/execution lifetime, SQLite migration/store and B3 tools. Keep dependencies/configuration local to that test harness; no edits to app auth/runtime, global launcher/configuration or collection defaults. Browser runner/dependency selection remains a separate reviewed implementation choice.
- **Auth/security:** local-auth flag off, generated short-lived RS256 credentials for synthetic `.invalid` identities, actual JWT verification against fixture JWKS, actual HMAC enrollment/privacy gates. A test-only request-headers adapter may expose the current HTTP request to real Home/auth, but must not return an authenticated identity directly. Bind to loopback only; preserve actual request URL/origin. Keys/DB/profile are ephemeral and contain no real data. Deny all unexpected outbound transport; synthetic provider responses replace only the provider boundary, never telemetry route responses. No production module may import the fixture; verify its absence from runtime artifacts.
- **Missing integration:** connect real browser HTTP requests to real route exports with the same module's request resource/execution context, render/hydrate the actual component and bootstrap availability via actual policy. If verifying `Home` itself, add the isolated request-scoped headers/render adapter; a component-only entry must explicitly exclude Home/Worker bootstrap from its claim. Persist to a dedicated synthetic SQLite file and generate B3 reports/CSV from those actual rows, not prepared response fixtures. Reuse provider-free AI transport for any workflow steps that need AI.
- **Acceptance:** zero rows before opt-in/off/decline; actual context/events responses and rows after explicit consent; invalid JWT/non-synthetic/unenrolled/wrong-origin/notice requests rejected; session/tab/reset/stop isolation; no raw identity/content/secrets in rows/CSV; unchanged AI payload/count/result behavior; deterministic activity/workflow/ledger/report counts and export checks. Verify failure containment and teardown, zero actual provider/cloud requests, production imports/artifacts clean. A component/harness pass must leave standard-launcher and Windows-specific cases explicitly pending.
- **Verification:** separately authorized **R2/V3 local synthetic browser integration**, followed by native Windows B4 scenarios and explicit launcher/Worker scope reconciliation. No hosted verification. No application runtime change is currently justified for the isolated fixture path. If the required acceptance must run through the stock launcher, return for a separate scoped decision rather than altering its identity or weakening telemetry gates.

## UI observation and next action

The task reports that earlier browser automation could not click **Nastavení** because the **Session JSON** button intercepted the click. This is an **unconfirmed hit-test/layout finding**, not independently observed here, not a confirmed product Known Issue and not repaired. Preserve the original operator evidence and confirm with an actual click/appropriate viewport before a separate UI repair decision.

Next: run the native Windows commands and ACL/symlink checks, reconcile the operator's B4 record, and separately authorize the minimal B4-H1 harness if browser-to-storage evidence is required. B-07 stays open; roadmap B4 runtime status is unchanged. No B4 runtime acceptance, real AI call, remote DB operation/migration, provisioning, deployment, merge or real-participant collection occurred. Optional metadata remains off. Stop after this repair/audit.

## B4-H1 Synthetic Browser Harness — 2026-10-23

**IMPLEMENTED / ISOLATED LINUX V2 VERIFIED. Not Windows B4 V3, standard-launcher, Vinext/Worker, hosted or real-provider acceptance.** Explicit H1 authorization supersedes the earlier proposal-only state for this test infrastructure. Required base/parent: `codex/telemetry-b4-portability-repair` at `9018512621c8a2d828932ff78e18f18d702b321d` / PR #70. New branch: `codex/telemetry-b4-h1-browser-harness`. Parent and earlier branches are unchanged. This is an additive Cloud supplement, not recovery of unavailable external Windows evidence.

### Implemented path and files

| Test-only source | Responsibility |
| --- | --- |
| [`telemetry-browser-server.mjs`](../../tests/helpers/telemetry-browser-server.mjs) | Explicit synthetic-only factory, immutable `127.0.0.1` bind/ephemeral port, strict Host, bounded bodies, real HTTP forwarding and request/execution scopes. No credential/control HTTP endpoint. Drains requests and request-lifetime work before closing SQLite/removing temp data. |
| [`telemetry-browser-fixture.mjs`](../../tests/helpers/telemetry-browser-fixture.mjs) | One bundle of actual Home/auth/context/events/session/AI routes. Request-scoped `next/headers` adapter supplies the actual HTTP headers. Actual RS256 verification, generated short-lived JWT/JWKS, independently generated HMAC/context keys, actual enrollment implementation and gates. Route-bundle-only clock and provider/JWKS transport; no replacement of Node/Playwright globals or telemetry success responses. Unrecognized application outbound fetch fails. |
| [`telemetry-sql.mjs`](../../tests/helpers/telemetry-sql.mjs) | Existing D1-shaped adapter accepts an optional database file; its default remains in-memory. Applies the existing B1 migration to a dedicated fresh synthetic file; actual production D1 store writes through this adapter. No schema/production-storage change. |
| [`entry.jsx`](../../tests/browser/telemetry/entry.jsx) | Actual `ApuClient` → `usePilot` → `pilot`/`client` mount. Home itself computes authenticated props in the server bundle. Optional `?seed=1` initializes two declared synthetic **business** notebook entries through existing notebook storage; it never seeds telemetry rows or mocks telemetry responses. |
| [`harness.test.mjs`](../../tests/browser/telemetry/harness.test.mjs), [`telemetry-browser-harness.test.mjs`](../../tests/telemetry-browser-harness.test.mjs) | Actual Chromium UI/HTTP/SQL/CSV and auth/concurrent-request tests. Every browser run has a disposable profile and database, explicit opt-in, blocked service workers, same-origin CSP/network routing and restricted DNS. Teardown closes browser before SQLite and deletes the generated directory, also on assertion failure. |
| [`package.json`](../../tests/browser/telemetry/package.json), adjacent lockfile / `.gitignore` | Pinned development-only `playwright-core` 1.64.1, isolated under this test directory. No browser download or root dependency/build/configuration change. The existing desktop CDP script is a top-level mocked-API fixture, not a reusable runner; scoped Playwright supplies deterministic clocks, browser contexts and network/cleanup controls without refactoring it. |
| [`check-isolation.mjs`](../../tests/browser/telemetry/check-isolation.mjs), [`verified-linux.json`](../../tests/browser/telemetry/verified-linux.json) | Production-reference/artifact checks and archived machine-readable observations from the actual passing run. Fresh runs write ignored `evidence.json` with PASS/FAIL per executed scenario; archive is evidence, never test input or an expected-value oracle. |

Local bypass is explicitly **off** (`NODE_ENV=production`, `APU_LOCAL_DEV_AUTH=0`) inside the fixture. Only synthetic transport placeholders are assigned to provider environment names; no env file or actual credential is loaded. Test enrollment covers two generated `.synthetic.invalid` actors; another actor remains unenrolled for negative cases. No production module imports the harness. Application auth, collector, runtime, pricing, business workflow, schema, root dependencies/configuration, CI and standard launcher are byte-unchanged from the base.

**Home boundary:** its actual function, `getCurrentAccessIdentity`, readiness and pilot-availability logic execute against real HTTP request headers/resources. Its server-side client import is a test marker so the fixture can obtain those actual props; the browser then mounts the actual full client component. The fixture serves existing application CSS with its Tailwind import removed rather than running the production CSS pipeline; no visual/layout acceptance is claimed. This is **not** production SSR/hydration/RSC, Vinext routing, Worker bootstrap or Miniflare/D1-hosted verification. Actual telemetry route responses are always produced by actual handlers after real SQLite work.

### Actual results

Linux, Node **24.19.0**, Chromium **151.0.7922.173**. **8 browser tests PASS**, 0 fail/skip (six parent tests plus two OFF/refusal children; seven recorded scenarios). Relevant API/B1/B2/B3 command: **249 PASS**, 0 fail/skip, including **21 new HTTP harness tests** (18 boundary subtests plus three parents). Typecheck, focused lint (zero warnings/errors), canonical build and built-in standalone Worker validation PASS. Isolation scan: **92 production source files / 19 production artifacts / zero harness references**. Production-path diff and whitespace checks PASS.

| Independently specified browser actions | Persisted / reported result |
| --- | --- |
| Default OFF, then separate explicit-refusal scenario; each completes extraction/controller/MAIN | Three synthetic provider calls per scenario; **zero sessions/events/AI rows**, normal response visible |
| Opt-in; seeded F1 input; actual navigation to F2 and F3 | One session; first five calls = extraction + controller + MAIN + need routing + analysis; baseline F3 adds **zero AI calls**. First accepted output costs **736,000 nano-USD** (three Luna ×32,000 + two Terra ×320,000, using independent 100-input/10-output fixture expectations) |
| Two explicit output regenerations, one without usage; F3→F2→F3; reset during a third held render; then fresh input | **8 AI rows**, known subtotal **1,376,000 nano-USD**, one unknown cost and null complete cost; three accepted outputs (one baseline/two generated); late render adds no output after reset. Original path `F1>F2>F3>F2>F3`, new workflow `F1`; all old costs keep their original session/workflow/operation association |
| Those explicit actions' semantic events | Exactly **2 workflow starts, 7 operation intents, 7 outcomes, 4 phase transitions, 3 accepted documents, 1 reset**; activity is checked separately with controlled clocks. Re-delivering an actual browser batch adds **zero** rows |
| Actual DB → B3 SQL → `reportCsv` → `writeExport` → read file | Real CSV created/read, headers and parsed values independently checked: AI=8, subtotal=1,376,000, unknown=1, outputs=3, total=null/empty cell, metric/test/timezone metadata and seven-day expiry. Forbidden identity/content/secrets absent from stored rows and CSV |
| Store ingest outage while normal UI performs AI action | Actual handler returns 503 from induced store failure; normal response and three provider calls remain unchanged. Browser retries original event IDs through real HTTP and persists them after recovery |
| Stop/re-opt-in, reload, second tab, expired-identity revalidation | Three distinct session/tab contexts; zero post-stop or post-invalidation rows, no automatic consent restoration, no persistent telemetry pseudonym in browser storage; event ownership remains scoped |
| MAIN held before terminal provider event, actual browser reload/disconnect, then release | Real pre-completion preview/status reaches browser (structured F1 prose is intentionally buffered by the application). Three final AI rows, subtotal **96,000 nano-USD**, no output, no stale UI result and no silently restored consent |
| Controlled input/focus/blur then 30m virtual inactivity | Exactly **15,000ms** active time in session/participant/day report; idle interaction creates a distinct context without a real 30-minute wait |
| Two actual opted-in tabs, shared controlled wall/monotonic clock and CDP foreground emulation; 15s input, actual F1→F2 requests, explicit stop | Each session **15,000ms**; participant/day union **15,000ms**, not 30,000ms. Six intentional extraction/need-route/analysis calls, subtotal **1,344,000 nano-USD**. Clock freezes before both contexts to eliminate network-anchor offset from this deterministic overlap case |

HTTP negative subtests exercise missing/malformed/expired JWT, invalid signature/issuer/audience/missing identity, non-synthetic/unenrolled actor, wrong cohort/origin/notice, refusal, missing/invalid context, invalid/conflicting events, stopped context and actual store outage/retry. Unauthorized cases persist no unauthorized rows. Eligibility denial retains the existing fixed `ineligible` response contract. Separate concurrent actual Home/context/event requests for two signed actors keep distinct identities/resources and reject crossed contexts.

No new product defect was independently established. During development, one **parallel 248-test run alongside canonical build** failed the existing B3 complete-cost assertion (247 pass/1 fail). Subsequent no-build serialized runs passed 248 and then final 249 tests without changing B3 code; a final **parallel 249-test rerun without a concurrent build also passed**. CPU/resource sensitivity of the existing bounded best-effort sink is a possible explanation, not a proven new diagnosis. The documented bounded regression command serializes test files. Do not erase the earlier concurrent-build failure or present that run as PASS. CI `unsupported_pr_branches` provenance remains separate; no guard was changed.

### Exact commands and Windows handoff

From repository root, with existing root dependencies and Node 24. The scoped dependency was installed in Cloud using `npm install --prefix tests/browser/telemetry --cache /tmp/apu-h1-npm --ignore-scripts --no-audit --no-fund`; on a fresh installation use its committed lockfile:

```sh
npm ci --prefix tests/browser/telemetry --ignore-scripts --no-audit --no-fund
node --test tests/browser/telemetry/harness.test.mjs
node --test --test-concurrency=1 tests/telemetry-browser-harness.test.mjs tests/telemetry-reporting.test.mjs tests/telemetry-local-tools.test.mjs tests/telemetry.test.mjs tests/telemetry-b2.test.mjs tests/server-capabilities.test.mjs tests/project-reset.test.mjs tests/project-usage-isolation.test.mjs tests/usage-ledger.test.mjs
npm run typecheck
npx --no-install eslint tests/helpers/telemetry-browser-fixture.mjs tests/helpers/telemetry-browser-server.mjs tests/helpers/telemetry-sql.mjs tests/telemetry-browser-harness.test.mjs tests/browser/telemetry/entry.jsx tests/browser/telemetry/harness.test.mjs tests/browser/telemetry/check-isolation.mjs
npm run build
node tests/browser/telemetry/check-isolation.mjs
git diff --check
```

The listed nine-file regression command was also executed without `--test-concurrency=1`: 249 PASS, zero failures/skips, with no concurrent build. Do not run the resource-sensitive regression concurrently with a build. In Cloud, the default npm cache was unwritable; the explicit `/tmp` cache fixed installation without a toolchain/configuration change. A clean locked `npm ci --prefix tests/browser/telemetry --cache /tmp/apu-h1-npm --ignore-scripts --no-audit --no-fund` also passed. Canonical build includes `scripts/validate-artifact.sh` and passed; no deployment command ran.

Native Windows **NOT VERIFIED**. In PowerShell, set `$env:CHROMIUM_PATH` to an already installed compatible Chrome/Chromium executable (for example `C:\Program Files\Google\Chrome\Application\chrome.exe`), run `npm.cmd ci --prefix tests/browser/telemetry --ignore-scripts --no-audit --no-fund`, then the two direct `node.exe --test ...` commands above, checking `$LASTEXITCODE` after each. No browser download, provider key, `.env.local` or standard dev launcher is required. Record actual source/browser/Node/Windows versions, counts and any failure; an H1 Windows run alone does not complete B4 V3. Retain the earlier native ACL/symlink/full-Bash-build limits and operator evidence.

**Still unverified:** native OS focus/minimization and actual hidden-tab visibility timing (headless tab change here reported `visible` with `focused=false`); Windows launcher/toolchain/ACL; full SSR/hydration/RSC/Vinext/Worker/Miniflare bootstrap; real provider, deployed bindings/account quotas and hosted behavior. Controlled CDP focus and virtual clocks prove the harness cases, not these platform boundaries. The prior Nastavení/Session JSON hit-test finding remains unconfirmed and unrepaired. Seeded notebook data means these workflow tests do not validate provider-backed extraction quality from an empty notebook.

**Next:** review the stacked H1 source and use it in separately authorized native Windows B4 V3 acceptance, reconciling the standard-launcher/bootstrap gap without altering auth policy. B-07 stays OPEN; G0–G5 remain open. No activation, real participant data, real provider request, remote DB operation/migration, provisioning, deployment, merge or B4-completion/hosted trial was performed. Stop after H1.
