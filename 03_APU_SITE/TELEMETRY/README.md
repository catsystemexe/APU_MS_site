# APU pilot telemetry — implementation package

Status: **IMPLEMENTATION READY for disabled-by-default source implementation; NOT READY for collection from real participants.** No telemetry implementation or infrastructure provisioning is claimed.

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

These are prepared future instructions, **not authorization to start implementation in the audit session**. All batches: Deployment Authorization **NOT AUTHORIZED**. Provisioning, hosted updates and live provider tests require separate authorization. A documentation PR is a reviewable proposal, not a merge or deployment.

## Decision checkpoint

- Reuse the existing server-side AI usage/pricing ledger; add one request-scoped telemetry adapter, same-Worker collector and dedicated DEV D1 storage.
- Avoid a new persistent browser user identifier. Proposed cross-visit key is cohort-scoped server HMAC of the already validated Access identity, subject to privacy gate G2. No raw email is added to telemetry.
- Start with costs, activity, explicit workflow transitions and completion. Content classification is deferred; existing coarse route/format enums are optional, gate-controlled metadata.
- Expected implementation: **48–72 engineering hours**, plus **4–8 operator hours** for separately authorized infrastructure/privacy/launch work. Pilot scope assumption: 20–100 participants, up to 200 sessions/day.
- Live Cloudflare Dashboard was inaccessible (sign-in wall). The exact deployed DEV source SHA, effective resources, plan headroom and current build integrations remain **NOT VERIFIED**. Repository and dated operator evidence are distinguished in the audit.
- Gates G0–G5 in the roadmap distinguish source implementation, hosted synthetic verification and real-user collection. None silently authorize deployment.

GitHub repository documentation is canonical. Google Drive workflow copies are older distribution material; current project rules explicitly exclude mandatory Drive synchronization. No governing workflow document is changed by this package. Existing Project Sources naming `next` as development should be refreshed manually from current GitHub governance; this package does not rewrite those rules.
