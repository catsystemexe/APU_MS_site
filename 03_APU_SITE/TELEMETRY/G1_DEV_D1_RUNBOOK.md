# G1 — existing EU D1 migration-only handoff

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
