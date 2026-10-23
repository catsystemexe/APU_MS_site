# B4 prerequisite repair and testability assessment — 2026-10-23

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
