# APU pilot telemetry — implementation package

Status: **B1/B2 + B3 SOURCE IMPLEMENTED / LOCAL TECHNICAL PASS / COLLECTION OFF / NOT DEPLOYED.** B4 Local Verification and G0–G5 remain pending; not ready for collection from real participants. No infrastructure provisioning is claimed.

Prepared: 2026-10-23, Europe/Prague. Audited source: `dev` at `fc8ac5520b7b49b442bedc47558c73f20ce2bea6`.

The request called the development branch `next`. Authenticated GitHub reads show that `next` no longer exists and its branch endpoint redirects to protected `public`. Current `AGENTS.md` and `05_WORKFLOW/APU_PROJECT_RULES.md` identify `dev` as development. This package follows the requested **developers-only boundary** using `dev`; it must never be executed against the redirect or production branch. `main` is a legacy/reference branch.

## Read in this order

1. [PILOT_TELEMETRY_SPEC](PILOT_TELEMETRY_SPEC.md): data minimum, metric catalog, event contract and measurement definitions.
2. [TELEMETRY_INFRA_AUDIT](TELEMETRY_INFRA_AUDIT.md): source evidence, hosted evidence limits, Cloudflare capabilities and costs.
3. [TELEMETRY_ARCHITECTURE](TELEMETRY_ARCHITECTURE.md): selected architecture, alternatives, privacy and failure contracts.
4. [TELEMETRY_ROADMAP](TELEMETRY_ROADMAP.md): dependencies, estimates, gates and verification scenarios.

## Executor prompts

- [B1 — foundation](batches/B1_FOUNDATION.md), Codex Cloud.
- [B2 — core metrics](batches/B2_CORE_METRICS.md), Codex Cloud; depends on B1.
- [B3 — reporting and verification](batches/B3_REPORTING.md), Codex Cloud; depends on B2.
- [B4 — local runtime acceptance](batches/B4_LOCAL_VERIFICATION.md), Local Windows PowerShell; depends on B3.

The original audit prompts were not implementation authorization. B1–B3 have since been explicitly authorized and verified as source; B4 still needs its own instruction. All batches: Deployment Authorization **NOT AUTHORIZED**. Provisioning, hosted updates and live provider tests require separate authorization. A source PR is a reviewable proposal, not a merge or deployment.

## Decision checkpoint

- Reuse the existing server-side AI usage/pricing ledger; add one request-scoped telemetry adapter, same-Worker collector and dedicated DEV D1 storage.
- Avoid a new persistent browser user identifier. Proposed cross-visit key is cohort-scoped server HMAC of the already validated Access identity, subject to privacy gate G2. No raw email is added to telemetry.
- Start with costs, activity, explicit workflow transitions and completion. Content classification is deferred; existing coarse route/format enums are optional, gate-controlled metadata.
- Expected implementation: **48–72 engineering hours**, plus **4–8 operator hours** for separately authorized infrastructure/privacy/launch work. Pilot scope assumption: 20–100 participants, up to 200 sessions/day.
- Live Cloudflare Dashboard was inaccessible (sign-in wall). The exact deployed DEV source SHA, effective resources, plan headroom and current build integrations remain **NOT VERIFIED**. Repository and dated operator evidence are distinguished in the audit.
- Gates G0–G5 in the roadmap distinguish source implementation, hosted synthetic verification and real-user collection. None silently authorize deployment.

GitHub repository documentation is canonical. Google Drive workflow copies are older distribution material; current project rules explicitly exclude mandatory Drive synchronization. No governing workflow document is changed by this package. Existing Project Sources naming `next` as development should be refreshed manually from current GitHub governance; this package does not rewrite those rules.

## Current reporting tools — B3 source PASS

Entry points: [report/export CLI](../../scripts/telemetry/report.ts), [export expiry CLI](../../scripts/telemetry/prune-exports.ts), [synthetic generator](../../scripts/telemetry/example.mjs), [independent CSV check](../../scripts/telemetry/verify-example.py), [resource model](../../scripts/telemetry/resource-model.mjs). Node ≥22.13 and Python 3; verified in Codex Cloud with Node 24.19.0. No provider key or application server required.

```sh
node scripts/telemetry/example.mjs work/b3-example-new
python scripts/telemetry/verify-example.py work/b3-example-new
node scripts/telemetry/resource-model.mjs work/b3-resource-new 6000
```

Use fresh output directories; exclusive creation prevents overwriting previous data. Generated identities/keys/transport are synthetic and local. [Actual synthetic summary CSV](../../telemetry/reports/examples/synthetic-summary.csv), [suppressed shared CSV](../../telemetry/reports/examples/synthetic-shared.csv), [measured resource artifact](../../telemetry/reports/examples/resource-model.json). Examples use fixed synthetic timestamps, not real-user data.

Reports cover unique AI attempts/model/token/cost coverage, session mean/median, first-output and mature workflow/output economics, account-day/week interval union and returns, pipeline paths/rework/unfinished/censored episodes. `--view summary` is default; other views require `--operator yes`. G2-unavailable participant metrics remain unavailable and account fields are omitted from CSV. Shared summaries suppress small and complementary cells; files are not automatically published. Empty cells represent null, never substituted zero.

The CLI requires an explicit absolute dedicated telemetry SQLite target, matching scope manifest/cohort/test-class and bounded date/as_of/retention filters. Real/developer/synthetic traffic is not silently merged. Retention/participant deletion default to dry-run; writes require a matching reviewed plan digest and are limited to local synthetic targets. CSVs expire after seven days; raw retention is 30d. [Complete commands, metric definitions, deletion/restore replay and access boundaries](TELEMETRY_ARCHITECTURE.md#12-implemented-b3-reporting-and-verification--2026-10-23).

V2: **225 tests PASS**, actual CSV inspection, typecheck and focused lint PASS. B2 build evidence reused because the application bundle is unchanged. Upper model (100 accounts, 200 sessions/day, 30d) is ~730MB and ~204k estimated steady indexed writes/day, exceeding published Free limits; actual account/hosted quotas remain unverified. No CI-policy change. B4 Local Verification is ready for separate authorization; no browser/hosted acceptance or activation is implied. **Collection/metadata OFF; no remote operations, paid AI calls, real data or deployment.**
