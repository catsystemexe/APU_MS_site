# G1 — DEV telemetry D1 operator runbook

**Procedure only; no remote command below was executed by G1-A.** Source staging V2 PASS on 2026-10-24, based on G0 `50cb49d41b0b299a0f0a0f2d34c9bd7430830cbd` / PR #74. Use the final reviewed G1-A commit from its stacked PR/completion report. G1-A is not G1-B provisioning approval, G0 closure, hosted integration, deployment or collection approval.

Target: account `DEV.account` in [prepare-worker.mjs](../../ops/dev/prepare-worker.mjs), Worker **apu-ms-site-dev**, database **apu-ms-site-dev-telemetry**, jurisdiction **eu**, future binding **TELEMETRY_DB**. No production config or default npm deploy command is used. Region hints such as `weur` do not establish jurisdiction. UUID/ownership cannot be authenticated by the offline preparer; G1-B must read them back.

## 1. Preconditions and local preparation — no remote mutation

Use native Windows PowerShell in the reviewed source checkout. Preserve other worktrees/uncommitted operator records. STOP on any failure; do not reset, force, clean or overwrite earlier evidence. Use an existing access-restricted operator directory outside Git; check its Windows ACL before writing. POSIX file modes do not establish Windows ACL protection.

Required before creation: reviewed G1-A SOURCE PASS, accepted G0 evidence for this action, Workers Paid confirmed active, correct authenticated Cloudflare account, fresh D1 inventory, target absent, migration hash/path reviewed, and **separate explicit written approval for G1-B creation and migration**. Current G0 retains missing route/policy/log/headroom/source-provenance evidence; resolve the prerequisites required for the authorized action rather than declaring all G0 closed. G0/G2/G4/G5 activation gates remain separate.

```powershell
$SourceSha = '<exact reviewed final G1-A SHA>'
if ((git rev-parse HEAD).Trim() -ne $SourceSha) { throw 'Wrong source' }
if (git status --porcelain) { throw 'Preserve/review worktree changes first' }
$Repo = (git rev-parse --show-toplevel).Trim()
Set-Location $Repo
$Evidence = '<existing absolute restricted operator directory outside repository>'
if (!(Test-Path -LiteralPath $Evidence -PathType Container)) { throw 'Missing protected evidence directory' }
$Wrangler = Join-Path $Repo 'node_modules\.bin\wrangler.cmd'
& $Wrangler --version
if ($LASTEXITCODE -ne 0) { throw 'Project-local Wrangler unavailable' }
# Required project/lock version: 4.150.0. STOP on mismatch.
node.exe ops/dev/prepare-worker.mjs --check-template --target apu-ms-site-dev
if ($LASTEXITCODE -ne 0) { throw 'Invalid DEV template' }
```

Use locked dependencies and the established canonical build (`npm.cmd ci`, then `npm.cmd run build`) if the reviewed canonical `dist/server/index.js` and `dist/server/wrangler.json` are unavailable. Finish build/artifact verification **before** resource creation, separately from runtime-heavy tests. If Windows build/toolchain or artifact provenance cannot be established, STOP; do not bypass the preparer or substitute the production config. Do not rebuild over preserved staging/evidence without first reviewing its disposition. No Worker upload is part of a build.

The checked-in `wrangler.dev.json` deliberately contains null Access/KV placeholders and is not directly deployable. Before a database UUID exists, create a **local bootstrap config with no bindings/main/vars**, derived from the reviewed DEV constants. This avoids fake UUIDs and automatic production-config discovery. Its three-field shape is checked against the pinned Wrangler schema.

```powershell
$CreationConfig = Join-Path $Evidence 'g1-d1-create.json'
if (Test-Path -LiteralPath $CreationConfig) { throw 'Use a fresh evidence path' }
@'
import { writeFileSync } from "node:fs";
import { DEV } from "./ops/dev/prepare-worker.mjs";
writeFileSync(process.argv[2], JSON.stringify({name:DEV.worker, account_id:DEV.account, send_metrics:false}, null, 2), {flag:"wx", mode:0o600});
'@ | node.exe --input-type=module - $CreationConfig
if ($LASTEXITCODE -ne 0) { throw 'Bootstrap config failed' }
$Bootstrap = Get-Content -Raw -LiteralPath $CreationConfig | ConvertFrom-Json
if ($Bootstrap.name -ne 'apu-ms-site-dev') { throw 'Wrong Worker' }
if ($env:CLOUDFLARE_ACCOUNT_ID -and $env:CLOUDFLARE_ACCOUNT_ID -ne $Bootstrap.account_id) { throw 'Conflicting ambient account' }
if ($env:CLOUDFLARE_ENV) { throw 'Unexpected named environment' }
$env:WRANGLER_SEND_METRICS = 'false'
$env:WRANGLER_SEND_ERROR_REPORTS = 'false'
$env:CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV = 'false'
```

## 2. Read-only account / Worker / inventory preflight

These commands are for the authorized operator, not execution by G1-A. Keep returned identity/resource metadata in the protected directory, not public chat/CI logs. Use existing authentication; do not print credentials or automatically initiate login on failure.

```powershell
& $Wrangler whoami --config $CreationConfig
if ($LASTEXITCODE -ne 0) { throw 'Account authentication failed' }
# Verify the listed account matches Bootstrap.account_id and Workers Paid is active.
& $Wrangler deployments list --name apu-ms-site-dev --config $CreationConfig --json > (Join-Path $Evidence 'dev-deployment-before.json')
if ($LASTEXITCODE -ne 0) { throw 'DEV target read-back failed' }
# Run inventory immediately before creation, after all other preparation/review.
& $Wrangler d1 list --config $CreationConfig --json > (Join-Path $Evidence 'd1-before.json')
if ($LASTEXITCODE -ne 0) { throw 'D1 inventory unavailable' }
$Inventory = Get-Content -Raw (Join-Path $Evidence 'd1-before.json') | ConvertFrom-Json
if (@($Inventory | Where-Object { $_.name -eq 'apu-ms-site-dev-telemetry' }).Count) { throw 'Target already exists; STOP, reconcile identity, do not recreate' }
```

Record source SHA, project-local Wrangler version, account ownership, plan evidence, exact target and inventory timestamp. Inventory is freshness-sensitive: rerun if creation is delayed or account/credentials change. Do not infer absence from an authorization error. **STOP here unless separate G1-B approval covers resource creation and approved schema migration on this exact account/target.**

## 3. Create and verify EU jurisdiction — G1-B authorization required

```powershell
& $Wrangler d1 create apu-ms-site-dev-telemetry --jurisdiction=eu --update-config=false --config $CreationConfig > (Join-Path $Evidence 'd1-create.txt')
if ($LASTEXITCODE -ne 0) { throw 'Creation failed/uncertain; do not blindly retry' }
& $Wrangler d1 info apu-ms-site-dev-telemetry --config $CreationConfig --json > (Join-Path $Evidence 'd1-info.json')
if ($LASTEXITCODE -ne 0) { throw 'D1 read-back failed' }
$Info = Get-Content -Raw (Join-Path $Evidence 'd1-info.json') | ConvertFrom-Json
if ($Info.name -cne 'apu-ms-site-dev-telemetry' -or $Info.jurisdiction -cne 'eu') { throw 'Exact name/EU jurisdiction not verified; STOP before migration' }
$DatabaseId = $Info.uuid
if ($DatabaseId -cnotmatch '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') { throw 'Invalid UUID' }
# Compare UUID with the creation receipt; retain both only in restricted evidence.
```

Read back name, UUID, owning account, jurisdiction, `created_in_region` if returned, creation date and `database_size`/`file_size` initial state. Confirm UUID matches the creation receipt. If the installed CLI/API omits jurisdiction, STOP before migrations and obtain authoritative account-scoped jurisdiction evidence; a region or creation command alone is insufficient. Account selection/authentication and metadata must agree. A nonzero initial SQLite file size alone is not participant data.

`--update-config=false` prevents Wrangler's resource-creation config update. No staged binding, Worker version or hosted secret is published by this command. Do not use `--location=weur` as a replacement for `--jurisdiction=eu`.

## 4. Prepare DEV-only staged binding — offline

Use an absolute UTF-8 input file without BOM with the **existing reviewed DEV KV/Access inputs**, not production values or ambient defaults. Add only this telemetry object, substituting the verified UUID from step 3:

```json
{
  "enabled": false,
  "staged": true,
  "dedicatedDev": true,
  "databaseId": "<verified EU DEV telemetry UUID>",
  "databaseName": "apu-ms-site-dev-telemetry",
  "hostname": "apu-ms-site-dev.catsystem-exe.workers.dev"
}
```

This is the value of the existing top-level `telemetry` property, not the whole preparation input. `TELEMETRY_DB` is fixed by code; binding overrides and unrecognized fields are rejected. No cohort, enrollment, notice/key versions, privacy override or secret belongs in staging input. Supplied UUIDs that reuse DEV/known production KV or Access identities, or a D1 declared in the canonical production artifact, are rejected; other ownership still requires authoritative read-back.

```powershell
$Inputs = '<absolute private DEV preparation input JSON path>'
node.exe ops/dev/prepare-worker.mjs --check-config --target apu-ms-site-dev --inputs $Inputs
if ($LASTEXITCODE -ne 0) { throw 'Input/artifact/isolation check failed' }
node.exe ops/dev/prepare-worker.mjs --prepare-config --target apu-ms-site-dev --inputs $Inputs
if ($LASTEXITCODE -ne 0) { throw 'Staging failed; preserve any earlier staging path, do not force overwrite' }
$StagedPath = Join-Path $Repo 'dist/dev-worker/wrangler.json'
$Staged = Get-Content -Raw -LiteralPath $StagedPath | ConvertFrom-Json
if ($Staged.name -cne 'apu-ms-site-dev' -or $Staged.account_id -ne $Bootstrap.account_id -or
    $Staged.d1_databases[0].database_id -cne $DatabaseId -or
    $Staged.vars.APU_TELEMETRY_ENABLED -cne '0' -or $Staged.vars.APU_TELEMETRY_METADATA_ENABLED -cne '0') { throw 'Staged target/UUID/OFF mismatch' }
```

Output is exclusively created under ignored `dist/dev-worker`; existing paths/symlinks are not overwritten. It has one `TELEMETRY_DB`, the exact name/UUID, `migrations_dir: ../../telemetry/migrations`, DEV environment/hostname and both flags **0**. Access, KV, artifact rules and `keep_vars:false` retain their existing validation. A local prepared config is **not an effective hosted binding**.

## 5. Remote migration preflight / application / read-back — G1-B approval required

Approved schema is only `telemetry/migrations/0001_pilot_v1.sql`, SHA-256 **81d3a4f48446b9583fd13b6288518fc06ea1ff283360001c2c84825f474c9d37**. No business schema or regeneration. Wrangler 4.150.0 resolves `migrations_dir` relative to the **config directory**, so `dist/dev-worker/../../telemetry/migrations` resolves to the repository directory regardless of cwd. Its default bookkeeping table is `d1_migrations`.

**Important:** `wrangler d1 migrations list --remote` calls `initMigrationsTable` and may issue `CREATE TABLE IF NOT EXISTS d1_migrations`. It is not strictly read-only. Do not run it during the earlier read-only preflight or before remote-migration authorization.

```powershell
$MigrationPath = Join-Path $Repo 'telemetry/migrations'
$Files = @(Get-ChildItem -LiteralPath $MigrationPath -File -Filter '*.sql')
if ($Files.Count -ne 1 -or $Files[0].Name -cne '0001_pilot_v1.sql') { throw 'Unreviewed migration set' }
if ((Get-FileHash -Algorithm SHA256 $Files[0].FullName).Hash.ToLowerInvariant() -cne '81d3a4f48446b9583fd13b6288518fc06ea1ff283360001c2c84825f474c9d37') { throw 'Migration changed' }
# Repeat exact-name info using the staged config; verify account/UUID/name/EU again.
& $Wrangler d1 info apu-ms-site-dev-telemetry --config $StagedPath --json > (Join-Path $Evidence 'd1-before-migration.json')
if ($LASTEXITCODE -ne 0) { throw 'Final target read-back failed' }
$Before = Get-Content -Raw (Join-Path $Evidence 'd1-before-migration.json') | ConvertFrom-Json
if ($Before.uuid -cne $DatabaseId -or $Before.name -cne 'apu-ms-site-dev-telemetry' -or $Before.jurisdiction -cne 'eu') { throw 'Target changed/unverified' }
```

Before the first list/apply, read schema against the **exact named** database. A newly created target must have no unrelated application objects. If telemetry tables or bookkeeping already exist unexpectedly, STOP and reconcile receipts instead of forcing a repeat.

```powershell
$SchemaQuery = "SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*' AND name NOT GLOB '_cf_*' ORDER BY type,name"
& $Wrangler d1 execute apu-ms-site-dev-telemetry --remote --config $StagedPath --command $SchemaQuery --json > (Join-Path $Evidence 'schema-before.json')
if ($LASTEXITCODE -ne 0) { throw 'Schema preflight failed' }
```

Wrangler can skip its confirmation in a non-interactive shell; a prompt is not the authorization boundary. Use the pure argument planner so neither database nor config can be replaced by a caller-supplied target. It validates the full staged configuration; it does not execute commands or authorize anything. Run from the repository root. Expected list arguments are exactly `d1 migrations list apu-ms-site-dev-telemetry --remote --config dist/dev-worker/wrangler.json`.

```powershell
$Plan = @'
import { readFileSync } from "node:fs";
import { telemetryMigrationArgs } from "./ops/dev/prepare-worker.mjs";
const read = p => JSON.parse(readFileSync(p, "utf8"));
process.stdout.write(JSON.stringify(telemetryMigrationArgs(process.argv[2], read("dist/dev-worker/wrangler.json"), read("wrangler.dev.json"), read(process.argv[3]))));
'@
$PlanJson = $Plan | node.exe --input-type=module - list $Inputs
if ($LASTEXITCODE -ne 0) { throw 'Migration list plan rejected' }
$MigrationArgs = @($PlanJson | ConvertFrom-Json)
& $Wrangler @MigrationArgs > (Join-Path $Evidence 'migrations-before.txt')
if ($LASTEXITCODE -ne 0) { throw 'Migration listing failed; STOP' }
# Review the list: exactly 0001_pilot_v1.sql pending. No extra migration is approved.
# Recheck source/hash/config before apply if anything changed since preflight.
$PlanJson = $Plan | node.exe --input-type=module - apply $Inputs
if ($LASTEXITCODE -ne 0) { throw 'Migration apply plan rejected' }
$MigrationArgs = @($PlanJson | ConvertFrom-Json)
& $Wrangler @MigrationArgs > (Join-Path $Evidence 'migration-apply.txt')
if ($LASTEXITCODE -ne 0) { throw 'Migration failed/uncertain; STOP without destructive recovery' }
& $Wrangler d1 execute apu-ms-site-dev-telemetry --remote --config $StagedPath --command $SchemaQuery --json > (Join-Path $Evidence 'schema-after.json')
if ($LASTEXITCODE -ne 0) { throw 'Schema read-back failed' }
$CheckQuery = "SELECT name,COUNT(*) AS applied FROM d1_migrations GROUP BY name; PRAGMA foreign_key_check; SELECT (SELECT COUNT(*) FROM telemetry_sessions)+(SELECT COUNT(*) FROM telemetry_events)+(SELECT COUNT(*) FROM telemetry_ai_calls) AS records;"
& $Wrangler d1 execute apu-ms-site-dev-telemetry --remote --config $StagedPath --command $CheckQuery --json > (Join-Path $Evidence 'migration-check.json')
if ($LASTEXITCODE -ne 0) { throw 'Bookkeeping/data check failed' }
$PlanJson = $Plan | node.exe --input-type=module - list $Inputs
if ($LASTEXITCODE -ne 0) { throw 'Final list plan rejected' }
$MigrationArgs = @($PlanJson | ConvertFrom-Json)
& $Wrangler @MigrationArgs > (Join-Path $Evidence 'migrations-after.txt')
if ($LASTEXITCODE -ne 0) { throw 'Final migration listing failed' }
```

Expected application tables: `telemetry_sessions`, `telemetry_events`, `telemetry_ai_calls`; exactly six explicit telemetry indexes and four triggers matching the approved SQL, plus SQLite automatic indexes and Wrangler bookkeeping. Verify every schema definition against the reviewed file, cascade foreign keys and JSON/check constraints. `d1_migrations` must record `0001_pilot_v1.sql` **once**, no pending migrations; `foreign_key_check` returns no violations; all three telemetry tables have **zero rows**. Do not insert synthetic/real participants in G1-B. Local Miniflare D1 verification in G1-A proves SQL compatibility there; remote acceptance still requires this read-back.

## 6. Stop, evidence and failure recovery

- Capture execution date/time, exact source SHA, account/plan evidence, restricted UUID/name/jurisdiction/region/size, approved migration hash, schema/index/trigger/bookkeeping results and before/after DEV deployment/version IDs. Re-read `deployments list --name apu-ms-site-dev --config $CreationConfig --json` after the operation; confirm no deployment was introduced. Distinguish the migrated D1 from the still-unpublished Worker binding. Record summaries in the separately authorized G1-B documentation; do not publish raw account logs/UUID unnecessarily.
- Creation error/timeout: inventory/read-back first. A lost receipt is not permission to create a second DB. Existing name, wrong account, unknown UUID/jurisdiction, unexpected tables/migrations or any auth error means **STOP**. No `d1 delete`, `DROP`, schema regeneration, config overwrite or cleanup of unrelated resources.
- Migration error/timeout: preserve evidence, read exact-target schema/bookkeeping under the approved scope and reconcile the single migration. Never repair a partial/unknown state destructively or bypass bookkeeping with raw SQL. A future retry requires an understood state/review; do not assume failure means nothing changed.
- Required future secret names are **TELEMETRY_PSEUDONYM_KEY** and **TELEMETRY_CONTEXT_KEY**. No values belong in Git, inputs or logs. Do **not** run `wrangler secret put`: it can publish/deploy a Worker version immediately. Defer secret and binding publication to a separately reviewed DEV integration batch.
- Keep both telemetry flags **0**, metadata **0**, no enrollment or privacy override. Do not run `deploy`, `versions upload`, default npm deployment, provider calls or activation. Production Worker/Zero Trust remain untouched. G0/G2/G4/G5 and applicable source/runtime/integration/consent/retention/headroom gates remain open until separately evidenced.

G1-B PASS requires verified dedicated EU DB + exact once-applied schema + empty participant data + unchanged effective Worker deployment. A created DB without verified schema is PARTIAL; a failed prerequisite is BLOCKED. Neither outcome authorizes Worker deployment or collection. **Stop before DEV integration.**
