IMPLEMENTATION PROFILE
Mode: Local
Execution environment: Local Windows PowerShell
Recommended model: N/A
Reasoning effort: N/A
Change radius: R2
Verification: V3
Reason: Browser focus/idle/streaming and Worker-emulated persistence need actual local runtime acceptance. Provider and cloud credentials are not needed for synthetic acceptance.

## Goal

Verify B1–B3 as an actual local application/collector/SQL flow and record whether the disabled source package is ready for a separately authorized hosted synthetic trial.

## Scope

Requires B3 PASS, exact reviewed `dev`-based source SHA, a healthy Windows Node/runtime and local browser. Reuse telemetry docs and completed technical evidence. Use the existing `npm.cmd run dev:local` workflow and synthetic provider responses/emulated telemetry DB. Test keys and generated identities only. If existing local auth bypass is used by the established launcher, keep its existing development-only constraint; do not create or alter a bypass.

## Non-scope

No Cloudflare mutation, remote D1, secret provisioning, auth-policy change, provider-backed call, release tag, merge or deployment. `.env.local` values must not enter prompts/reports. Do not invoke default `npm run deploy`.

## Required changes

No feature code changes are intended. Run the implemented local test/fixture commands and actual UI scenarios from roadmap §3. Save a concise verification record under `03_APU_SITE/TELEMETRY/` with source SHA, runtime versions, commands, expected/actual results and limits.

1. Verify opt-out/disabled mode and opted-in synthetic tester path across context creation, input, F1→F2→F3 default document, repeat visit, return, regeneration and reset.
2. Exercise foreground/background, idle, multi-tab, reload, identity invalidation, duplicate resend, induced ingest outage and streaming cancellation. Use clock-controlled fixtures for 30m/24h/DST cases; no long waits.
3. Inspect only synthetic persisted rows and CSV; compare server ledger totals to the existing developer diagnostics for the same controlled calls. Tester diagnostics remain filtered while server collection still works.
4. Verify active-time and cost reports against fixture expected counts, no sensitive fields, and bounded failure behavior. A visual UI pass concerns opt-in/navigation parity, not telemetry accuracy by itself.
5. Record G0 live infrastructure evidence only if already available through separately authorized read-only access. A local pass cannot prove deployed source, bindings, provider behavior or EU/global processing.

## Acceptance criteria

- All material local scenarios pass with exact source/test provenance and expected/stored/report reconciliation.
- Normal APU behavior and current developer diagnostic totals remain unchanged outside telemetry.
- No real data/credentials enter verification artifacts; no cloud/provider mutation occurs.
- Remaining hosted/privacy/provisioning gates remain explicitly open. Failures are assigned to B1/B2/B3 with smallest reproduction; no fake overall PASS.

## Verification

V3 local synthetic runtime only. Record PASS/FAIL/NOT VERIFIED separately for UI, API/streaming, SQL/reporting, disabled mode, Windows launcher and hosted/provider checks. Reuse prior build/unit evidence unless source changed. If runtime unavailable, report that concrete blocker without modifying auth or moving to another hosting service.

## Documentation & Tracking

Documentation Impact:
Type: LOCAL ACCEPTANCE EVIDENCE

Documents:
- `03_APU_SITE/TELEMETRY/LOCAL_VERIFICATION.md` — create once for this verified implementation; replace/update the same record on reruns.
- `03_APU_SITE/TELEMETRY/TELEMETRY_ROADMAP.md` — B4 results and active launch gates.
- `03_APU_SITE/TELEMETRY/README.md` — source/local readiness, explicitly not deployed.

Changelog: NO — verification only, no functionality changed.
Backlog: RESOLVE B-07 only if B1–B4 technical/local acceptance passes; otherwise UPDATE remaining milestone. Real-user activation stays separately gated in roadmap.
Known Issues: NONE — report any new confirmed defect for a targeted repair decision.

## Deployment Authorization

NOT AUTHORIZED

Next possible work is a separately authorized DEV provisioning/hosted synthetic verification batch after G0–G4. Real-user collection additionally requires G5. This local test batch does not grant either permission.
