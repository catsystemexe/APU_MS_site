IMPLEMENTATION PROFILE
Mode: Work
Execution environment: Codex Cloud
Recommended model: Sol
Reasoning effort: High
Change radius: R3
Verification: V3
Reason: Accurate session/workflow/AI attribution spans asynchronous client state and streaming server paths. Existing lifecycle and pricing code should be reused with narrow emitters.

## Goal

Connect the B1 foundation to real application control flow, producing all P0 economics/activity/workflow metrics with synthetic fixtures and collection still disabled by default.

## Scope

Depends on B1 technical PASS and its documented request-scoped sink. Use `dev` plus the reviewed B1 change. Read telemetry spec and architecture integration map; do not repeat the infrastructure audit unless directly affected source has changed. Relevant files: `apu-client.tsx`, `openai-responses-instrumentation.ts`, `model-call-instrumentation.ts`, AI API routes, `quest-controller.ts`, existing F2/F3 acceptance/lifecycle modules and B1 telemetry modules.

## Non-scope

No new AI calls/classifier, model-routing or prompt changes, business-state transition redesign, new project persistence, metadata activation or auth/response-capability change. Do not make usage diagnostics visible to testers.

## Required changes

1. Compose the existing request collector with the B1 safe server adapter after auth validation for extract/chat/analysis/need-route/f2/f3; controller inherits its request collector. Preserve existing developer in-memory records/envelopes and tester field filtering.
2. Persist pending/final server call projections from existing lifecycle hooks, including raw MAIN streaming lifecycle in `/api/chat`, extraction/grounding primary+rescue, application-invalid output and transport failures. Do not wrap only `callOpenAIResponses` and miss streaming. Terminal wins over late pending; DB failures never change AI result/retry policy.
3. Thread telemetry session/workflow and operation-instance linkage through bounded headers/context. Server call/request IDs remain canonical. Distinguish user retry/regeneration, grounding fallback and normal pipeline multi-call work; populate currently default/null attempt/fallback fields only when actual semantics are known.
4. Implement visible/focused interaction-clock intervals, 60s idle proxy, 15s flush, split on phase/focus/visibility/idle, 30m new-session rule and clock/suspend bounds. No keyboard values, coordinates, DOM targets, microphone streams or text. Do not reuse diagnostic `sessionRef` as telemetry visit ID.
5. Emit workflow start/reset, successful explicit runtime phase transitions, operation intent/outcome and accepted documents at the concrete acceptance points in architecture §6. Cover usable default F3 without a new provider call, F2 local-only reconciliation, stale/discarded continuations, retained output revisit and reset mid-flight. React effect/rerender must not create duplicate semantic events.
6. Retain existing pricing snapshots as calculated estimates with completeness/regime metadata. No duplicated rate catalog; cached/write/reasoning subsets counted once, missing/unknown usage stays null. Telemetry cannot claim invoice reconciliation or fully loaded costs.
7. Preserve original request scope when reset/navigation happens while AI is running. The incurred AI row remains associated with the old workflow; it must not complete a new workflow or write pedagogical state.

## Acceptance criteria

- A deterministic full synthetic session produces exactly the expected workflow/phase/accepted-output events and all expected server AI calls.
- Eligible tester cost rows exist independent of developer response diagnostics; developer/test traffic excluded by class in default reports.
- Default F3 completes once at zero additional F3 calls; stale/boundary/error responses don't complete; backward navigation isn't an error.
- All attempt costs persist even if client result is discarded; incomplete/uncertain totals are explicit and not zero.
- Two participant requests cannot exchange identity/context; overlapping tabs do not create inflated raw intervals; timing tests cover sleep/idle/visibility/phase boundaries.
- Telemetry-disabled and DB-failing paths preserve existing pedagogical state, source ownership, responses and provider call count.

## Verification

V3 for this flow. Run typecheck, focused new server/streaming/clock/client-instrumentation tests and existing model-call-instrumentation, openai-responses-instrumentation, usage-ledger, model-usage-endpoint/streaming/client contracts, project-usage-isolation, project-reset, access/session and directly touched F2/F3 stale/acceptance/navigation tests. Canonical build/artifact validation after code passes. Provider-free synthetic API responses only.

Cover roadmap scenarios for duplicate deliveries, interleaved requests, retries/rescue, active-time clock, default/generated output, stale work and sink failure. Measure bounded persistence latency using injected slow/rejected stores. Actual local-browser acceptance belongs to B4; do not call synthetic tests hosted PASS. Report existing feature-PR CI provenance limitation separately.

## Documentation & Tracking

Documentation Impact:
Type: IMPLEMENTED METRICS / VERIFICATION

Documents:
- `03_APU_SITE/TELEMETRY/PILOT_TELEMETRY_SPEC.md` — implemented coverage per metric; preserve measurement definitions and explicit unsupported scope.
- `03_APU_SITE/TELEMETRY/TELEMETRY_ARCHITECTURE.md` — actual emitter/adapter map and failure limits.
- `03_APU_SITE/TELEMETRY/TELEMETRY_ROADMAP.md` — B2 evidence/gates.
- `03_APU_SITE/CURRENT/APU_SITE_RUNTIME_TECHNICAL_CURRENT.md` — disabled source instrumentation, not hosted collection.

Changelog: YES — implemented/verified source behavior after PASS, not deployed.
Backlog: UPDATE — B-07 core metrics milestone; do not resolve.
Known Issues: NONE — new blockers reported in completion, no speculative issue entries.

## Deployment Authorization

NOT AUTHORIZED

No remote DB migration/provisioning, hosted update, actual provider call or real-user collection is authorized by this batch.
