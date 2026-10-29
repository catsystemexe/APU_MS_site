# G1 — existing EU D1 migration-only handoff

## PILOT-TECH-T2 — verified baseline rollback (2026-10-26)

The authorized restore used `wrangler versions view` followed by an explicit rollback to `732bf950-30cf-444a-90fc-8927d9c8b16c`. The protected version metadata confirmed the expected DEV bindings, original developer list, Access configuration, `APU_LOCAL_DEV_AUTH=0`, telemetry/metadata `0/0` and receipt TTL `86400`. Rollback completed at 100% traffic, replacing `747d661f-72c5-4ce2-9d6c-c22526d5dfed`.

Read-only D1 counts after rollback were `telemetry_sessions=0`, `telemetry_events=0`, `telemetry_ai_calls=0`. The standard DEV browser session then returned HTTP 200 and `isDeveloper:true` from `/api/session`. No telemetry, provider call, role change, Access-policy change or PUBLIC operation was performed. The pre-rollback HTTP 401 remains retained as historical evidence; cause **NOT VERIFIED**.

## PILOT-TECH-T3 — bounded hosted telemetry acceptance (2026-10-26)

T3 completed one isolated DEV collection window using one normal authenticated tester identity, one cohort, `synthetic=0`, `privacy_approved=1` and metadata `0`. The existing receipt was retained and verified through GET/UI rehydration; first acceptance POST was intentionally not repeated. The pre-test three-table snapshot was zero-row and the final snapshot was exported before cleanup, imported offline and integrity-checked at sessions=1, events=5, ai_calls=0. The working copy `telemetry-t3-20261026.sqlite` subsequently passed SQLite integrity, foreign-key and orphan-event checks, with the exact three telemetry tables and expected cohort/test class.

The UI refusal path produced zero rows. Explicit UI opt-in created one tester session and five actual activity intervals while visibility/focus were verified. Withdrawal acknowledgement was reflected by `stopped_at`; subsequent normal interaction produced no new rows. Restricted JSON inspection covered event, projection and identity trees without publishing raw rows and found zero forbidden content/identity key or value matches. No AI/provider request was made.

Collection was disabled before scoped child-before-parent cleanup. The exact cohort/test-class rows were removed and D1 returned to zero. Temporary telemetry secrets were deleted. Final direct rollback to `732bf950-30cf-444a-90fc-8927d9c8b16c` restored 100% traffic, OFF/OFF, TTL 86400, original developer configuration and `/api/session` HTTP 200 with `isDeveloper:true`. The protected local snapshot/sidecar remain restricted operator evidence; no raw rows, pseudonym or key material belongs in Git. First receipt POST, provider E2E and PUBLIC readiness remain separate gates.

After the Europe/Prague civil day closed, the existing report tool generated the restricted operator summary CSV (`operator=yes`, `view=summary`, `linkage=unavailable`). Independent SQL reconciliation matched sessions=1, events=5, activity intervals=5 and ai_calls=0; the seven-day expiry metadata and strict five-field target manifest passed. Offline evidence statuses: integrity **PASS**, snapshot contract **PASS**, CSV **PASS**, reconciliation **PASS**. Raw snapshot and CSV artifacts remain restricted operator evidence and are not committed.

## PILOT-TECH-R1 — subsequent isolated DEV test (T2 deployment and receipt rehydration completed; telemetry acceptance blocked)

**T2 deployment executed; receipt and telemetry acceptance blocked.** Source candidate `d706a55c7ff80b1439079badfda88c9baa5807c4` was built and deployed only to existing `apu-ms-site-dev` / `https://apu-ms-site-dev.catsystem-exe.workers.dev` as version `732bf950-30cf-444a-90fc-8927d9c8b16c`, with 100% traffic. No migration or resource creation occurred. The Access login callback ended in `invalid state`, so no authenticated application test was attempted. PUBLIC was not changed.

The required continuation remains authorized only after a valid operator-controlled tester session is established. Keep telemetry/metadata OFF/OFF until then; do not retry receipt or telemetry blindly.

Follow-up attempt, 2026-10-26 20:55 UTC: a new DEV browser session was started without the prior callback URL. SSO navigated to the Cloudflare Dashboard login page instead of returning to Access/DEV; no `/api/session` response was available. Stop here. This observed navigation does not prove a cause and is separate from the earlier `invalid state`.

The next operator login returned to DEV successfully. Read-only `GET /api/session` reported `isDeveloper:true`, and the UI showed Developer mode rather than tester role. Under the separately authorized temporary DEV-only configuration, `APU_DEVELOPER_EMAILS` was explicitly empty in deployment `e7429915-9f43-42d2-98c6-d41813b5cbca`; the same session then returned HTTP 200 with `isDeveloper:false`. Existing draft-2 receipt GET returned HTTP 200 with matching versions and `acceptedAt`/`expiresAt` exactly 86400 seconds apart; UI reload remained available. First acceptance was not repeated. The original developer configuration was restored in deployment `401e5cd2-e9ea-4e6a-ac8e-6c9d0b7ae4f3`, and `/api/session` again returned `isDeveloper:true`.

No telemetry window was enabled: explicit enrollment and opt-in were not established, so refusal/opt-in/withdrawal, D1 deltas, forbidden-field inspection, SQL/CSV reconciliation and cleanup acceptance remain BLOCKED/PENDING. Final DEV telemetry/metadata stayed OFF/OFF and D1 counts stayed sessions/events/ai_calls `0/0/0`.

Follow-up bounded window result: dedicated DEV HMAC keys and one enrolled tester pseudonym were prepared privately with `synthetic=0`, `privacy_approved=1`, metadata `0`, and a unique cohort. Refusal produced no rows. Explicit UI opt-in produced one `tester` session and one `workflow_started` event; no AI/provider call occurred. Withdrawal set `stopped_at`; the scoped SQL check found zero prohibited-key hits; the single test session/event was deleted after evidence capture. Temporary secrets and private enrollment material were removed. Final D1 counts are `0/0/0`.

Final restore explicitly reinstated the Access issuer/audience variables, original developer email, OFF/OFF and TTL 86400. A new standard operator login was attempted in the continuing browser session, but `/api/session` still returned HTTP 401 (`Přihlášení není platné`). The cause is NOT VERIFIED. Do not bypass Access or infer a cause from this result.

The bounded telemetry result is a smoke only. The scoped SQL cleanup and final zero-count check were performed; the required protected pre-test SQL snapshot and SQL/CSV report procedure were **NOT PERFORMED**.

Authentication diagnosis follow-up: active DEV version `747d661f-72c5-4ce2-9d6c-c22526d5dfed` remained at 100% traffic. A new standard operator-session GET `/api/session` returned HTTP 401 (`Přihlášení není platné`). The filtered short tail emitted no allowlisted `validation_failed reason`; the cause is NOT VERIFIED. Wrangler deployment metadata did not expose per-version runtime-variable values, so no additional correction was attempted.

Reused evidence: PR #85 at `1729fce641fab5015407acdd5be06fe8941ed58c` records DEV deployment of #83, config/Access and receipt GET/rehydration PASS, telemetry/metadata OFF/OFF, receipt test TTL **86400**. First-acceptance POST status/body were unavailable; its root cause remains unknown. The new local lag/retry and lost-response reproductions do not establish that hosted cause. No fresh Cloudflare audit is requested here; recheck only the dynamic target/source/config/identity required for this next operation.

Required inputs, kept in restricted operator evidence (names only in Git):

| Contract | Subsequent test prerequisite |
| --- | --- |
| Source / runtime | Full reviewed source SHA, matching DEV artifact and separately authorized DEV deployment/version/traffic evidence; current PUBLIC baseline for preservation. No default deploy command, hook or PUBLIC config. |
| Bindings | Existing dedicated EU `TELEMETRY_DB`, dedicated `PILOT_RULES_ACCEPTANCE`, `DEV_LOG_STATE` and `ASSETS`; authenticated resource identity/type/read-back, not an invented UUID or a shared PUBLIC resource. Do not recreate/migrate resources. |
| Receipt | Explicit `PILOT_RULES_RECEIPT_TTL_SECONDS=86400` for this DEV test. No default or 90-day publication. New isolated test identity without a current receipt, or separately authorized erasure of only its previous test receipts. |
| Collection | Initial and restored `APU_TELEMETRY_ENABLED=0`, `APU_TELEMETRY_METADATA_ENABLED=0`. Only a separately approved bounded test window may use enabled=1; metadata stays 0 throughout. |
| Environment | `APU_TELEMETRY_ENV=dev`, exact `APU_TELEMETRY_HOSTNAME=apu-ms-site-dev.catsystem-exe.workers.dev`, `APU_LOCAL_DEV_AUTH=0`, unchanged valid Access issuer/audience. No localhost bypass in hosted tests. |
| Identity / consent | Valid normal Access JWT and eligible enrollment, unique test-only `APU_TELEMETRY_COHORT`, `APU_TELEMETRY_KEY_VERSION`, approved test `APU_TELEMETRY_NOTICE_VERSION`/`APU_TELEMETRY_NOTICE_TEXT`, per-visit opt-in. Never export JWT/cookies/opaque contexts. |
| Keys / synthetic scope | Dedicated `TELEMETRY_PSEUDONYM_KEY` and `TELEMETRY_CONTEXT_KEY`, distinct from each other and from PUBLIC; no values in Git/evidence logs. With synthetic=1, existing enforcement requires an actually verified `[a-z0-9-]+@synthetic.invalid` identity. If the existing Access flow cannot supply it, **STOP: hosted synthetic identity BLOCKED**, do not forge JWTs or add an auth bypass. A normal tester with synthetic=0 requires separate scoped privacy approval (`APU_TELEMETRY_PRIVACY_APPROVED=1`) and truthful test classification; do not silently substitute that mode or use an ineligible developer. This handoff grants neither approval. |

Execution/evidence checklist for the **next authorized operator task**:

1. **Preflight:** pin source and target; retain before-state version/traffic, flags/TTL, dedicated resource provenance and counts of all three telemetry tables. Use an exclusive synthetic cohort and an isolated interval with no other participants. Unexpected rows/cohorts, missing approvals/identity or source mismatch mean STOP. Record source, UTC time and action/result, never credentials or pedagogical content. Confirm current receipt GET is 200 with `receipt:null`; do not seed the receipt to bypass the first POST.
2. **First acceptance while OFF/OFF:** in browser Network capture first `POST /api/pilot-rules` status and a sanitized response containing only top-level versions and receipt `{rulesVersion,informationVersion,acceptedAt,expiresAt}`. Capture subsequent GET status/body, UI result and timestamps; verify the receipt lifetime is 86400 seconds. No full HAR, headers/cookies, request tokens or screenshots of real cases. POST 200 plus GET null means saved/pending, not save failed; retry GET. Timeout/lost/malformed POST means unknown outcome, then GET-only recovery. API remains locked at 428/503 while the receipt is missing/unavailable. If failure occurs, preserve this exact HTTP sequence and stop; never infer a hosted root cause from local PASS. No AI request belongs to this step.
3. **Refusal baseline:** with the separately approved test configuration/notice active, choose “Pokračovat bez měření”; use only empty/synthetic working state. Confirm zero new context/events/AI rows and no forced opt-in after accepting mandatory rules. No real-provider call. Optional manual Notebook marker `PILOT_TECH_R1_CONTENT_SENTINEL` can support the later content-leak check; it must never become a telemetry field.
4. **Opt-in → events → D1:** explicitly opt in through the existing UI, confirm context HTTP 200/ready, focus/interact locally with Settings/Notebook and allow the existing 15-second activity interval/flush (no artificial metric emitter or AI action). Save safe HTTP statuses/event names, then D1 scoped counts/time reconciliation. Expect sessions/events to increase for only the selected cohort; `telemetry_ai_calls` remains **0** in this no-provider test. Check local/DEV/PUBLIC environment/host mismatch rejection separately with provider-free fixtures, never by enabling PUBLIC.
5. **Withdraw / disabled:** click “Zastavit měření”, wait for stop acknowledgement and previously pending deliveries to settle, then establish new count baselines. Further UI interaction and replay of an old test event must create zero new rows (old stopped context rejects). Stopping may update the existing session, so distinguish updates from new rows. Verify ordinary UI remains usable. Restore enabled=0 / metadata=0 under the same bounded authorization; disabled endpoints return `code:disabled`, with zero new rows and no new opt-in context. No provider request is authorized to prove ordinary chat here.
6. **SQL / prohibited fields:** reconcile counts scoped by `cohort_id` and `test_class`, joining children to sessions, plus all-table before/after deltas. Inspect `json_tree(event_json)`, `json_tree(projection_json)` and `json_tree(identity_json)` in restricted operator SQL: reject keys containing chat/notebook text, prompts, quotes, raw email, IP, user-agent, JWT, cookies or provider request/response IDs. Confirm the Notebook sentinel is absent. Internal random event/session/call IDs and pseudonyms have their existing restricted roles; they must not appear in shared aggregate CSV. Do not publish raw rows or SQL exports. Preserve exact zero/nonzero results, not an unsupported “no content” assertion.
7. **SQL snapshot → existing CSV:** only if preflight and final inspection confirm this dedicated DB contains solely the authorized test cohort, export **only the three telemetry tables** to a protected local SQL file with pinned Wrangler, explicit verified DEV read config and `d1 export apu-ms-site-dev-telemetry --config <restricted-config> --remote --table telemetry_sessions --table telemetry_events --table telemetry_ai_calls --output <fresh-protected-sql>`. Import the reviewed SQL into a new absolute `telemetry-*.sqlite` offline file; exclude migration bookkeeping/other tables. Create the sidecar below with the exact actual cohort/class; do not weaken `openTarget` to accept an arbitrary DB. Remote export and snapshot creation are subsequent operator actions, not actions performed by this source task.

```json
{"kind":"apu-telemetry","schema_version":1,"mode":"operator-snapshot","test_class":"synthetic","cohorts":["<exact-approved-test-cohort>"]}
```

Save as `<absolute-snapshot>.target.json` with restricted local permissions. Use existing [B3 tools](TELEMETRY_ARCHITECTURE.md#runnable-synthetic-reports-and-lifecycle-procedure), no new analytics platform. Fill the following values from evidence; the report requires a **completed Europe/Prague civil-date window**, `retained-since <= from < to <= as-of`, at most 31 elapsed days. For today's test, preserve the immutable snapshot and produce its daily CSV after the next civil midnight; do not invent a future `as-of` or report an empty earlier day as test coverage. The local snapshot is read-only and no live source must stay enabled overnight.

```powershell
node.exe scripts/telemetry/report.ts export `
  --database $Snapshot --mode operator-snapshot --cohort $TestCohort --test-class synthetic `
  --from $FromDay --to $ToDay --as-of $AsOfUtc --retained-since $RetainedSinceUtc `
  --operator yes --view summary --linkage unavailable --out $FreshRestrictedCsv
if ($LASTEXITCODE -ne 0) { throw 'Snapshot/report scope or evidence invalid; do not weaken guards' }
```

The unsuppressed summary is restricted operator evidence; compare its session/activity/count values to SQL and safe HTTP evidence. A shared export omits `--operator yes` and retains existing small-cell suppression. Check CSV headers/values for forbidden content/identity fields and the sentinel. Existing seven-day export expiry is a software contract, not new production retention approval; remove test files as soon as reconciliation is complete.

8. **Cleanup and close:** after scoped before/after evidence, off/stop enforcement and separate cleanup authorization, remove only this test's telemetry rows (children before sessions, exact cohort/class/session scope, transaction and previewed counts; no wholesale DB delete/recreation). Remove every versioned test receipt as below; clear local test Notebook/browser data and controlled SQL/SQLite/CSV copies after reconciliation. Record counts, erasure verification, restored OFF/OFF and unchanged PUBLIC/version/traffic. **Thirty-day raw telemetry retention is still a proposal**, not authorization to retain production data or replace immediate synthetic cleanup. The B3 deletion CLI mutates only local-test/synthetic files; never imply it erases remote D1 or operator snapshots.

**Separate later actual-provider sample:** a new explicit authorization must name DEV/source, isolated tester/cohort/notice, synthetic input, call/token/cost budget and cleanup. Then reconcile the existing ledger → D1 `telemetry_ai_calls` → SQL/CSV with F1→F2→F3 and zero-AI baseline Output. Do not activate real participants or run this sample in PILOT-TECH-R1. Zdeněk's arrangement acceptance is not a prerequisite for this technical handoff; public participant notice/legal finalization remains separate.

### Receipt retention and versioned-key erasure

- Approved **future** receipt policy: 90 days / **7776000 seconds** from explicit acceptance. `PILOT_RULES_APPROVED_TTL_SECONDS` documents it but supplies no runtime default. Publication of a changed TTL is a separate authorized step; DEV test stays 86400. The accepted record and KV `expirationTtl` carry the same explicit finite lifetime; normal GET/AI checks never PUT or renew it. Logical `expiresAt` validation stops expired receipts even if physical KV expiry/propagation lags.
- The key is exactly `pilot-rules:<rulesVersion>:<sha256(normalized-email)>`, with trim + en-US lowercase + UTF-8. Stored value contains only versions and acceptance/expiry timestamps. This is pseudonymization, not anonymity. Keep identity lookup and full keys restricted; do not add raw email to receipts, telemetry or shared evidence.
- Material rule/information changes bump **both** version constants before deployment and require new explicit acceptance. This candidate's draft-2 therefore does not accept draft-1. An information-only minor correction retains the existing accepted rules receipt; merely changing `informationVersion` does not retroactively require acceptance. Current-version GET cannot prove deletion of older version keys.
- Offboarding/test cleanup: first prevent new acceptance through the separately authorized access/enrollment/test-stop process. Resolve the exact dedicated receipt namespace; compute the normalized-email hash privately. **List all pages** under `pilot-rules:` (follow cursors until `list_complete`), select only keys with that exact hash suffix across **every** rules version, review count/version scope, then delete only the approved keys. Re-list all pages and check current-version GET/API denial after KV propagation; old keys require their own re-list/targeted checks. Never delete a broad prefix, rely on only the current key, print identities/full key lists into Git, or claim instantaneous global physical erasure from one negative GET.
- Obsolete version keys keep their original finite KV TTL and are never refreshed by ordinary use; they are not an unlimited acceptance archive. Inspect any legacy/malformed key with absent expiry separately under approved cleanup; do not silently assign it a new 90-day lifetime. Offboarding also covers controlled local snapshots/exports and is distinct from supplier/log erasure, for which no new deletion promise is made.

### Future PUBLIC release boundary

Do not blanket-merge this DEV history into PUBLIC. Preserve all PUBLIC-only fixes when a separate task constructs the focused release candidate. Required feature surface is telemetry env/host/HMAC policy, receipt boundary/state/recovery, both material-version constants/future TTL contract and information text, with their regressions; existing six-route pilot/telemetry integration from #83 must also be reconciled against the release base. Re-read current PUBLIC HEAD/diff at that time; this task edits no protected branch or release CI.

PUBLIC additionally needs independently verified dedicated D1/KV, unique key material/cohort/key version/enrollment, current exact `apu.catsystem.ai` host, synthetic=0, separately approved privacy/notice/retention and explicit release/rollback authorization. No real PUBLIC values/configuration are generated here. Source/local PASS does not satisfy those hosted/release gates.

## Historical migration-only procedure — 2026-10-24 (superseded evidence retained)

**G1-B remains PARTIAL: database created, schema unapplied.** Evidence commit [630a7bf97e0cb4628e244464b2238825a67b7910 / PR #78](https://github.com/catsystemexe/APU_MS_site/pull/78) records the Windows operator execution on source `bf32bd2fd29f6f6ebd717deea2b7df8163cb8a56` (G1-A PR #76). This procedure correction starts at that evidence HEAD. It does not report a fresh Cloudflare read-back or a remote migration. The actual UUID remains only in the restricted operator creation receipt / `d1 info` evidence referenced by #78; do not copy it into Git or public logs.

## A. D1 creation — done; do not repeat

The authorized **apu-ms-site-dev-telemetry** D1 already exists in the reviewed account with verified **eu** jurisdiction (region EEUR reported separately). At the recorded read-back it had zero application tables/rows and no initialized migration bookkeeping. The DEV Worker **apu-ms-site-dev** deployment/version was unchanged; no binding or secret was published. Historical creation evidence is not a substitute for fresh identity/schema checks before migration. **No create/delete command belongs in the remaining procedure.**

## B. D1 migration-only — pending

Use the existing authorization only for the single original migration on this verified existing DEV EU D1. This Cloud source batch executes **no remote commands**. All Cloudflare commands below are a subsequent native Windows operator handoff. No new resource, Worker deployment, secret or collection is authorized. Account/auth failure, unknown jurisdiction, changed deployment, conflicting identity/schema, unexpected pending migration or changed SQL means **STOP** without destructive recovery.

### 1. Independent local contract

[prepare-telemetry-migration.mjs](../../ops/dev/prepare-telemetry-migration.mjs) creates/checks local JSON and plans arguments only: no subprocess, provider client, ambient defaults or network API. It imports only the reviewed DEV constants; it does not call Worker preparation or read KV/Access inputs, user identities, secrets, runtime flags or build artifacts. No application build is required. Keep [prepare-worker.mjs](../../ops/dev/prepare-worker.mjs) and all its strict guards unchanged for phase C.

The operator supplies a protected UTF-8 JSON receipt outside the repository, derived from the **original restricted creation evidence**, not invented to match a new inventory:

```json
{
  "accountId": "<original verified account ID>",
  "databaseId": "<original UUID from restricted creation receipt>",
  "databaseName": "apu-ms-site-dev-telemetry",
  "jurisdiction": "eu"
}
```

Only these four fields are accepted. Account/name/jurisdiction are fixed by reviewed code; UUID syntax is checked and the UUID must then match both fresh inventory and fresh D1 info. Offline files alone cannot authenticate Cloudflare ownership or freshness. The exact generated Wrangler shape is:

```json
{
  "account_id": "<reviewed DEV account>",
  "send_metrics": false,
  "d1_databases": [{
    "binding": "TELEMETRY_DB",
    "database_name": "apu-ms-site-dev-telemetry",
    "database_id": "<restricted receipt UUID>",
    "migrations_dir": "<absolute reviewed checkout>/telemetry/migrations"
  }]
}
```

No `name`, `main`, assets, vars, KV, Access, environments or secrets. It is not Worker deployment configuration. Config/identity/read-back paths must be absolute `.json` files outside the repository, with regular files and canonical non-symlink parent paths. Preparation is exclusive and never overwrites. Check Windows ACLs on the existing private directory; POSIX file modes do not establish Windows ACL protection.

The absolute migration directory is intentional: config may live outside the checkout and commands may run from another cwd. Installed Wrangler **4.150.0** resolves migrations relative to the config directory; an explicit absolute path still resolves to this exact approved directory. Only one regular SQL file is allowed:

- `0001_pilot_v1.sql`, exact LF SHA-256 `81d3a4f48446b9583fd13b6288518fc06ea1ff283360001c2c84825f474c9d37`;
- exact CRLF SHA-256 `34a97fe1898f6dbc282ad03c67fb3b902f9a4186d65b5cf60266b0560cf31619`.

No generic whitespace normalization, extra SQL, migration regeneration or symlink substitution. Prepare/check/plan recheck these bytes and the entire configuration. `--plan apply` additionally rejects already-applied, telemetry or unrelated schema; only the empty Wrangler bookkeeping table created by the authorized list is accepted.

### 2. Offline Windows preparation

Use the exact reviewed correction SHA from its completion report/PR, a clean source checkout and existing locked dependencies. The project minimum remains **Node >=22.13.0**, with pinned Wrangler **4.150.0**. **Node 24 is not required.** Node **22.23.2** is verified for this procedure on Linux; native Windows is a separate check. Use 22.23.2 for the reproducible G1-B-R2 Windows comparison below. Preserve earlier evidence/worktrees; no reset, clean or overwrite. If dependencies are absent, use locked `npm.cmd ci`; do not use the default deploy command or production config.

```powershell
$SourceSha = '<exact reviewed migration-only correction SHA>'
if ((git rev-parse HEAD).Trim() -cne $SourceSha) { throw 'Wrong source' }
if (git status --porcelain) { throw 'Preserve/review local changes first' }
$Repo = (git rev-parse --show-toplevel).Trim()
Set-Location $Repo
$Evidence = (Resolve-Path '<existing restricted directory outside repository>').ProviderPath
$IdentityFile = Join-Path $Evidence 'identity.json' # Original restricted receipt, four fields above.
$ConfigFile = Join-Path $Evidence 'migration-only-wrangler.json' # Must be a fresh output path.
$DeploymentReceipt = Join-Path $Evidence 'original-dev-deployment.json' # Original restricted deployments-list evidence.
$NodeVersion = (& node.exe --version | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or [version]$NodeVersion.TrimStart('v') -lt [version]'22.13.0') { throw 'Node >=22.13.0 required' }
$Wrangler = Join-Path $Repo 'node_modules\.bin\wrangler.cmd'
$Version = (& $Wrangler --version | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $Version -cne '4.150.0') { throw 'Wrong project-local Wrangler' }
node.exe ops/dev/prepare-telemetry-migration.mjs --prepare --identity $IdentityFile --config $ConfigFile
if ($LASTEXITCODE -ne 0) { throw 'Migration-only preparation stopped' }
node.exe ops/dev/prepare-telemetry-migration.mjs --check --identity $IdentityFile --config $ConfigFile
if ($LASTEXITCODE -ne 0) { throw 'Config/SQL validation stopped' }
Get-FileHash -Algorithm SHA256 (Join-Path $Repo 'telemetry/migrations/0001_pilot_v1.sql')
```

Retain the actual LF/CRLF hash in restricted operator evidence. No remote operation has happened at this point. Use the existing recorded migration authorization only after the following fresh checks; this source PR does not execute that authorization.

### 3. Fresh account, identity, deployment and schema read-back

This and all remaining commands are for the authorized **local operator only**. Use existing Cloudflare authentication. Do not log credentials, initiate an automatic login or fetch any user data. Account, region and jurisdiction are different facts; EEUR/weur alone is insufficient.

```powershell
$Identity = Get-Content -Raw -LiteralPath $IdentityFile | ConvertFrom-Json
$Config = Get-Content -Raw -LiteralPath $ConfigFile | ConvertFrom-Json
if ($env:CLOUDFLARE_ACCOUNT_ID -and $env:CLOUDFLARE_ACCOUNT_ID -cne $Config.account_id) { throw 'Conflicting ambient account' }
if ($env:CLOUDFLARE_ENV) { throw 'Unexpected named environment' }
$env:WRANGLER_SEND_METRICS = 'false'
$env:WRANGLER_SEND_ERROR_REPORTS = 'false'
$env:CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV = 'false'
& $Wrangler whoami --config $ConfigFile > (Join-Path $Evidence 'migration-whoami.txt')
if ($LASTEXITCODE -ne 0) { throw 'Authentication unavailable' }
# Inspect private whoami output: correct authorized account equals Config.account_id.
# Keep the existing Paid evidence and remaining G0 limits explicit; do not upgrade/change accounts.
function Read-D1([string]$Sql) {
    $Raw = (& $Wrangler d1 execute apu-ms-site-dev-telemetry --remote --config $ConfigFile --command $Sql --json | Out-String)
    if ($LASTEXITCODE -ne 0) { throw 'D1 read-back failed' }
    $Result = @($Raw | ConvertFrom-Json)
    if ($Result.Count -ne 1 -or $Result[0].success -ne $true) { throw 'Unexpected D1 read-back' }
    return @($Result[0].results)
}
function Read-Preflight([string]$Path) {
    if (Test-Path -LiteralPath $Path) { throw 'Do not overwrite earlier evidence' }
    $Raw = (& $Wrangler d1 list --config $ConfigFile --json | Out-String)
    if ($LASTEXITCODE -ne 0) { throw 'Inventory unavailable' }
    $Inventory = @($Raw | ConvertFrom-Json)
    $DbMatches = @($Inventory | Where-Object { $_.name -ceq 'apu-ms-site-dev-telemetry' -or $_.uuid -ceq $Identity.databaseId })
    if ($DbMatches.Count -ne 1 -or $DbMatches[0].name -cne 'apu-ms-site-dev-telemetry' -or $DbMatches[0].uuid -cne $Identity.databaseId) { throw 'Inventory identity mismatch' }
    $Raw = (& $Wrangler d1 info apu-ms-site-dev-telemetry --config $ConfigFile --json | Out-String)
    if ($LASTEXITCODE -ne 0) { throw 'Info unavailable' }
    $Info = $Raw | ConvertFrom-Json
    if ($Info.uuid -cne $Identity.databaseId -or $Info.name -cne 'apu-ms-site-dev-telemetry' -or $Info.jurisdiction -cne 'eu') { throw 'Name/UUID/EU mismatch' }
    $Schema = @(Read-D1 "SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*' AND name NOT GLOB '_cf_*' ORDER BY type,name")
    $Applied = @()
    if (@($Schema | Where-Object { $_.type -ceq 'table' -and $_.name -ceq 'd1_migrations' }).Count) {
        $Applied = @(Read-D1 'SELECT name,COUNT(*) AS applied FROM d1_migrations GROUP BY name')
    }
    $Readback = @{ inventory=$Inventory; info=$Info; schema=$Schema; applied=$Applied }
    [IO.File]::WriteAllText($Path, ($Readback | ConvertTo-Json -Depth 32), (New-Object Text.UTF8Encoding $false))
    return $Readback
}
function Assert-Deployment([string]$Path) {
    if (Test-Path -LiteralPath $Path) { throw 'Do not overwrite deployment evidence' }
    & $Wrangler deployments list --name apu-ms-site-dev --config $ConfigFile --json > $Path
    if ($LASTEXITCODE -ne 0) { throw 'Deployment read-back unavailable' }
    $Expected = Get-Content -Raw $DeploymentReceipt | ConvertFrom-Json | Sort-Object created_on | Select-Object -Last 1
    $Current = Get-Content -Raw $Path | ConvertFrom-Json | Sort-Object created_on | Select-Object -Last 1
    $ExpectedVersions = ConvertTo-Json -InputObject @($Expected.versions | Sort-Object version_id | Select-Object version_id,percentage) -Compress -Depth 10
    $CurrentVersions = ConvertTo-Json -InputObject @($Current.versions | Sort-Object version_id | Select-Object version_id,percentage) -Compress -Depth 10
    if (!$Expected.id -or @($Expected.versions).Count -eq 0 -or $Current.id -cne $Expected.id -or $CurrentVersions -cne $ExpectedVersions) { throw 'DEV deployment/traffic changed' }
}
Assert-Deployment (Join-Path $Evidence 'migration-deployment-before.json')
$BeforeFile = Join-Path $Evidence 'migration-before.json'
$Before = Read-Preflight $BeforeFile
if ($Before.schema.Count -ne 0 -or $Before.applied.Count -ne 0) { throw 'Unexpected existing schema; reconcile, do not force/reapply' }
```

Compare deployment/version/traffic to the original restricted receipt, not an invented baseline. Inventory must contain exactly one matching name/UUID (other unrelated databases may exist); absence or auth failure is not permission to recreate. Verify metadata size/initial state and jurisdiction `eu`. If jurisdiction is missing, STOP. Initial schema must agree with #78: empty. If someone already applied the migration, STOP and reconcile current evidence without executing apply again. Never repurpose another database.

### 4. Authorized Wrangler bookkeeping and the single approved migration

**`migrations list` may create `d1_migrations`; it is not part of pre-authorization read-only work.** The mechanism below preserves Wrangler bookkeeping. No raw CREATE/DDL, force/reset or repeated apply. Wrangler may skip prompts in non-interactive shells; a prompt is not authorization.

```powershell
$ListJson = node.exe ops/dev/prepare-telemetry-migration.mjs --plan list --identity $IdentityFile --config $ConfigFile --preflight $BeforeFile
if ($LASTEXITCODE -ne 0) { throw 'List plan rejected' }
$MigrationArgs = @($ListJson | ConvertFrom-Json)
& $Wrangler @MigrationArgs > (Join-Path $Evidence 'migration-pending.txt')
if ($LASTEXITCODE -ne 0) { throw 'List failed; STOP' }
# Inspect pending list: only 0001_pilot_v1.sql. Any discrepancy means STOP.
$ApplyFile = Join-Path $Evidence 'migration-apply-preflight.json'
$Ready = Read-Preflight $ApplyFile # Fresh inventory/info/schema/bookkeeping after the authorized list.
Assert-Deployment (Join-Path $Evidence 'migration-deployment-at-apply.json')
$ApplyJson = node.exe ops/dev/prepare-telemetry-migration.mjs --plan apply --identity $IdentityFile --config $ConfigFile --preflight $ApplyFile
if ($LASTEXITCODE -ne 0) { throw 'Apply plan rejected: resource, SQL, existing schema or bookkeeping mismatch' }
$MigrationArgs = @($ApplyJson | ConvertFrom-Json)
# Exact plan: d1 migrations apply apu-ms-site-dev-telemetry --remote --config <absolute private config>.
& $Wrangler @MigrationArgs > (Join-Path $Evidence 'migration-apply.txt')
if ($LASTEXITCODE -ne 0) { throw 'Apply failed/uncertain; STOP without retry or destructive recovery' }
$AfterFile = Join-Path $Evidence 'migration-after.json'
$After = Read-Preflight $AfterFile
$Telemetry = @($After.schema | Where-Object { $_.name -clike 'telemetry_*' })
if ($After.schema.Count -ne 14 -or @($Telemetry | Where-Object type -eq 'table').Count -ne 3 -or
    @($Telemetry | Where-Object type -eq 'index').Count -ne 6 -or @($Telemetry | Where-Object type -eq 'trigger').Count -ne 4) { throw 'Unexpected schema' }
if ($After.applied.Count -ne 1 -or $After.applied[0].name -cne '0001_pilot_v1.sql' -or $After.applied[0].applied -ne 1) { throw 'Unexpected migration bookkeeping' }
if (@(Read-D1 'PRAGMA foreign_key_check').Count -ne 0) { throw 'Foreign key violation' }
$Counts = @(Read-D1 'SELECT (SELECT COUNT(*) FROM telemetry_sessions)+(SELECT COUNT(*) FROM telemetry_events)+(SELECT COUNT(*) FROM telemetry_ai_calls) AS records')
if ($Counts.Count -ne 1 -or $Counts[0].records -ne 0) { throw 'Telemetry data appeared; STOP' }
$ListJson = node.exe ops/dev/prepare-telemetry-migration.mjs --plan list --identity $IdentityFile --config $ConfigFile --preflight $AfterFile
if ($LASTEXITCODE -ne 0) { throw 'Final list plan rejected' }
$MigrationArgs = @($ListJson | ConvertFrom-Json)
& $Wrangler @MigrationArgs > (Join-Path $Evidence 'migration-pending-after.txt')
if ($LASTEXITCODE -ne 0) { throw 'Final listing failed' }
# Confirm no pending migration; compare all stored schema definitions with the reviewed original SQL.
Assert-Deployment (Join-Path $Evidence 'migration-deployment-after.json')
```

Expected telemetry tables are `telemetry_sessions`, `telemetry_events`, `telemetry_ai_calls`, with six explicit indexes/four triggers exactly as in the approved file. The additional table is Wrangler bookkeeping; internal SQLite/Cloudflare objects are excluded from the query. Verify the actual definitions, JSON/check constraints and cascade references, not just counts. Preserve command results, source/hash, timestamp, identity/jurisdiction/size, deployment/traffic comparisons and zero-row result in restricted evidence. Publish only a scoped summary without full UUID. Failures/timeouts require target read-back and human reconciliation, never D1 delete/recreate, DROP/DELETE, manual DDL or automatic apply retry.

## C. Worker staging/binding — later integration batch

Migration-only preparation does not publish a binding or a Worker version and deliberately has no runtime vars. The existing strict DEV Worker preparer remains unchanged and will require its protected KV/Access inputs **only in a separately reviewed integration batch**. Then retain **APU_TELEMETRY_ENABLED=0**, **APU_TELEMETRY_METADATA_ENABLED=0**, no enrollment/privacy override. Do not replace its guards with the migration-only checks.

Future secret names remain **TELEMETRY_PSEUDONYM_KEY** and **TELEMETRY_CONTEXT_KEY**; no values in Git/inputs/logs. Do not run `secret put`, `deploy`, `versions upload`, auth/Zero Trust changes, provider calls or telemetry activation here. G0/G2/G4/G5 and remaining runtime/privacy/retention/headroom gates remain independent. A migrated D1 and a locally prepared binding are not effective hosted integration.

## Source V2 verification — 2026-10-24

Verified base PR #78 HEAD `630a7bf97e0cb4628e244464b2238825a67b7910`; ancestor G1-A `bf32bd2fd29f6f6ebd717deea2b7df8163cb8a56`. Node 24.19.0 / installed locked Wrangler 4.150.0 / Linux. **167 tests PASS** (28 migration-only + 139 unchanged DEV preparation). The final combined run passed all 167 tests; focused lint and typecheck PASS. LF/CRLF fixtures exercise both approved byte forms independently of checkout line endings. No new application build required: application/config/build inputs unchanged; prior G1-A build evidence is reused, not presented as a fresh build.

```sh
node --test --test-concurrency=1 tests/telemetry-migration-preparation.test.mjs tests/dev-worker-preparation.test.mjs
node --test tests/telemetry-migration-preparation.test.mjs
node --test --test-name-pattern="only byte-exact" tests/telemetry-migration-preparation.test.mjs
npm run typecheck
npx --no-install eslint ops/dev/prepare-telemetry-migration.mjs tests/telemetry-migration-preparation.test.mjs
git diff --check
```

Actual local Wrangler/Miniflare D1 loads the minimal external config from an unrelated cwd without Worker artifact/inputs, discovers the absolute approved migration, applies it once, reconciles exact schema **3/6/4**, one bookkeeping row, zero telemetry rows and no foreign-key violations. Target/account/name/binding/UUID tampering, wrong/duplicate/missing read-back, missing EU, modified/extra/symlink SQL and replay/unknown schema all reject. LF and CRLF hashes both verified; no SQL changes. CLI is local files/pure argument planning only; test subprocesses enforce `--local` and reject `--remote` execution.

Native PowerShell procedure and current remote state were **not executed/verified by this correction**. G1-B remains **PARTIAL**, created D1 / unapplied remote migration per #78; this batch made **zero remote mutations**. No changelog, backlog or Known Issues update; no history rewrite. STOP after source preparation; operator remote migration and later Worker integration are separate execution boundaries.


## R01/R02 operator compatibility correction — 2026-10-24

Verified starting HEAD: `3f5c6d39266396b10dc69587ac0d5350ec96707d` (PR #80). Node **22.23.2 / Linux x64**, official archive from `https://nodejs.org/dist/v22.23.2/` checked against its published `SHASUMS256.txt`. The unchanged migration CLI and its actual Wrangler child processes ran through `process.execPath` under Node 22.23.2; configuration preparation/check/planning, local D1 application, exact schema/bookkeeping/zero-row checks and unchanged DEV preparation guards all passed. This verifies Node 22.23.2 on Linux, not native Windows or every Node patch at/above the unchanged project minimum. Package/dependency versions and migration/Worker production code are unchanged.

**V2 Linux PASS: 169 tests, zero fail/skip** — 30 migration-preparation tests (including two isolated symlink subtests) plus 139 original DEV preparation regressions. Both real symlinks were created and their original security assertions executed successfully. Typecheck and focused lint also PASS under Node 22.23.2; diff/scope checks PASS. No build or timing-sensitive operation ran concurrently with the runtime tests.

Actual Cloud commands (temporary Node binary only; no project install/version changes):

```sh
/tmp/apu-node-22.23.2/node-v22.23.2-linux-x64/bin/node --version
/tmp/apu-node-22.23.2/node-v22.23.2-linux-x64/bin/node --test --test-concurrency=1 tests/telemetry-migration-preparation.test.mjs tests/dev-worker-preparation.test.mjs
/tmp/apu-node-22.23.2/node-v22.23.2-linux-x64/bin/node node_modules/typescript/bin/tsc --noEmit
/tmp/apu-node-22.23.2/node-v22.23.2-linux-x64/bin/node node_modules/eslint/bin/eslint.js tests/telemetry-migration-preparation.test.mjs
git diff --check
```

Each migration-test symlink subtest attempts creation in its own existing writable fixture. **Only Windows `EPERM`/`EACCES` from that creation call** cause the corresponding child to report **SKIP / NOT VERIFIED: Windows symlink creation denied**. Other parent assertions still run. Successful creation always runs the original refusal assertion; assertion failures and every other unexpected error (including non-Windows permission errors) remain FAIL. No production symlink/path guard was changed. A capability skip is not a security PASS; rerun that check with an authorized symlink-capable Windows environment to close its coverage.

### Exact native Windows G1-B-R2 verification handoff — offline only

Use the corrective commit from PR #80/completion report in a preserved reviewed checkout, existing locked dependencies and installed Node **22.23.2**. This exact patch check is for reproducing the compatibility evidence, not a new project minimum. Do not reset/clean an evidence worktree or change permissions automatically. No Worker build, private DEV KV/Access values, D1 identity receipt or Cloudflare authentication is required for these synthetic tests.

```powershell
$ExpectedSource = '<exact R01/R02 correction commit from PR #80 completion report>'
if ((git rev-parse HEAD).Trim() -cne $ExpectedSource) { throw 'Wrong source' }
$NodeVersion = (& node.exe --version | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $NodeVersion -cne 'v22.23.2') { throw 'Use Node 22.23.2 for this native compatibility verification' }
$WranglerVersion = (& .\node_modules\.bin\wrangler.cmd --version | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $WranglerVersion -cne '4.150.0') { throw 'Use the existing pinned Wrangler' }
$NativeLog = Join-Path $env:TEMP ('apu-g1b-r2-native-' + [guid]::NewGuid().ToString() + '.log')
"Source=$ExpectedSource`nNode=$NodeVersion`nWrangler=$WranglerVersion`nOS=$([Environment]::OSVersion.VersionString)" | Set-Content -LiteralPath $NativeLog -Encoding utf8
node.exe --test --test-reporter=spec tests/telemetry-migration-preparation.test.mjs 2>&1 | Tee-Object -FilePath $NativeLog -Append
$TestExitCode = $LASTEXITCODE
Write-Output "Evidence: $NativeLog"
if ($TestExitCode -ne 0) { throw 'Native migration tests FAIL; preserve the log' }
```

Record exit code, exact SHA/OS/Node/Wrangler versions, PASS/FAIL/SKIP counts and individual skip reasons. Expected suite size is **30**: with symlink capability, **30 PASS / 0 SKIP**; if both Windows symlink creations are permission-denied, **28 PASS / 2 capability SKIP**. A single denied check yields one capability SKIP. Even with exit code zero, mark each skipped symlink security check **NOT VERIFIED**. Other tests must pass; do not hide a failure by skipping a parent or broadening tolerated errors. This native handoff covers migration preparation, not native DEV Worker/toolchain/hosted acceptance; the 139 unchanged DEV preparation regressions were separately run in Linux V2.

**Native Windows NOT VERIFIED in Cloud.** G1-B remote state remains PARTIAL per #78; this compatibility correction made no Cloudflare remote call/mutation, migration, deployment, secret publication or activation. Existing approval remains limited to the original single migration on the already-created EU D1; do not execute it as part of this offline compatibility check. STOP here.
