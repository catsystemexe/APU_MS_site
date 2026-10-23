IMPLEMENTATION PROFILE
Mode: Work
Execution environment: Codex Cloud
Recommended model: Sol
Reasoning effort: Medium
Change radius: R2
Verification: V2
Reason: Reporting/export and deterministic metric reconciliation are one bounded feature once B1/B2 emitters exist. Reuse their fixtures instead of acquiring broader application context.

## Goal

Deliver reproducible SQL/CSV pilot metrics and safe retention/deletion tools, proving the complete synthetic measurement path from emitted events to reports.

## Scope

Depends on B2 PASS. Use `dev` with reviewed B1/B2 changes; read metric catalog and roadmap verification vectors. Implement `telemetry/reports/`, local scripts, fixtures and optional off-by-default allowlisted route/format projection. No hosted resource or user data needed.

## Non-scope

No dashboard, admin HTTP endpoint, raw Session JSON import, free-text category classifier, public report sharing, autonomous live exports or account-wide provider-usage ingestion. No runtime auth changes.

## Required changes

1. Implement exact session/workflow/participant/day/week reports for all P0 metrics. Deduplicate and preaggregate AI rows separately from general events before joins. Use participant interval union across tabs, Europe/Prague/DST day boundaries, complete-vs-lower-bound costs, sample sizes, mature/censored/left-truncated workflow states and baseline/generated output counts.
2. Export CSV from bounded SQL results/local synthetic DB or explicitly supplied operator export. Default aggregate output, no participant IDs in shared form; operator-only raw SQL export documented separately. Include metric/schema/measurement version, cohort/test filter, as_of/timezone and coverage counts. Escape CSV/formula-leading cells. Never silently produce zero for unknown/undefined ratios.
3. Author safe dry-run retention/deletion tools; refuse ambiguous database/cohort target, require explicit local/test target by default. No remote mutation is executed during this batch. Cover 30d base raw retention, seven-day export expiry procedure and backup restore/deletion replay. Daily operational owner is a launch gate, not an automation to create now.
4. Optional route/format projection may use existing `F2_PATHS` and F3 structure enum only, separate flag default off. No free-text f3Target/need text/content fingerprint. If this adds significant UI/state work, omit it and preserve G3/P1 status; core acceptance must not depend on metadata.
5. Create deterministic end-to-end fixtures exercising real B2 emitters/adapters and report queries, including costs, zero-call defaults, retries/rescue, incomplete usage, duplicated/reordered batches, reset/stale work, multi-tab overlap, inactivity and censored workflows. Assert expected values defined independently in the roadmap.
6. Measure actual emulated rows/index sizes/write amplification and query plans using the upper pilot load model. Document estimated Free headroom and trigger for plan/interval adjustment; do not declare the user's account plan verified.

## Acceptance criteria

- Every P0 metric has a runnable query/report and a documented denominator; gated participant metrics are explicitly unavailable when linkage off.
- 0.01/0.03/0.10 price fixture yields exact mean/median as specified; adding many workflow events cannot multiply AI costs.
- Tab overlap [0,30), [15,45) yields45s participant time; DST and censoring fixtures pass.
- Price unknowns/pending/transport uncertainty remain incomplete, true zero-call completion remains zero, invalid content never stored/exported.
- Retention/deletion dry-run and local execution affect only intended cohort/expired rows, with restore procedure documented.
- Synthetic end-to-end reconciliation passes; no claim of hosted or real-data verification.

## Verification

V2: new SQL/report/export/retention tests against actual emulated storage; B1/B2 targeted end-to-end fixtures and affected regression tests, typecheck. Rebuild only if application modules/bundle changed; otherwise reuse B2 build evidence and state why. Inspect produced sample CSV headers/values for forbidden fields and formula injection. No remote D1/provider calls.

## Documentation & Tracking

Documentation Impact:
Type: REPORTING / OPERATIONAL PROCEDURE / VERIFICATION

Documents:
- `03_APU_SITE/TELEMETRY/PILOT_TELEMETRY_SPEC.md` — report entrypoints and metric coverage.
- `03_APU_SITE/TELEMETRY/TELEMETRY_ARCHITECTURE.md` — implemented export/retention interface and measured resource model.
- `03_APU_SITE/TELEMETRY/TELEMETRY_ROADMAP.md` — B3 expected/actual evidence and remaining B4/G0–G5.
- `03_APU_SITE/TELEMETRY/README.md` — current readiness and runnable tool links.

Changelog: YES — reporting source after PASS, not hosted collection.
Backlog: UPDATE — B-07 reporting/automated verification milestone; B4 still pending.
Known Issues: NONE.

## Deployment Authorization

NOT AUTHORIZED

This batch also authorizes no remote deletion/migration, provisioning, hosted update or real-user collection.
