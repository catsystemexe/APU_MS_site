IMPLEMENTATION PROFILE
Mode: Work
Execution environment: Codex Cloud
Recommended model: Sol
Reasoning effort: Medium
Change radius: R4
Verification: V3
Reason: A bounded new persistence/collector feature crosses client, server and DEV configuration boundaries. Existing business persistence and authentication remain outside the change.

## Goal

Implement the disabled-by-default telemetry foundation specified in `03_APU_SITE/TELEMETRY/PILOT_TELEMETRY_SPEC.md` and `TELEMETRY_ARCHITECTURE.md`, ready for later instrumentation and offline synthetic validation.

## Scope

Base: `dev`, audited application SHA `fc8ac5520b7b49b442bedc47558c73f20ce2bea6` or a verified descendant. The old `next` ref redirects toward production; do not use it. Documentation package must be present in the checkout (include its reviewed documentation commit if not yet integrated). Read root AGENTS and the two named telemetry docs; reuse the audit. Review only relevant changes since the audited SHA if they affect the specified integration points.

Create contract/validators, context/collector routes, participant/session adapter, in-memory client queue/opt-in boundary, telemetry-only migration files/store interface and DEV preparation support. Exact module names may follow architecture §2.

## Non-scope

No production config change, auth/role redesign, business DB activation, existing notebook storage migration, remote resource creation/migrations, existing CI policy rewrite or live provider execution. Do not instrument all workflows yet; B2 owns those emitters. No content classification.

## Required changes

1. Implement strict v1 discriminated schemas, limits, enum allowlists and server/client event separation from spec §4. No arbitrary metadata/text/hash payloads. Server overrides trusted envelope fields.
2. Implement existing-identity HMAC pseudonym and signed in-memory session context, separate keys, cohort/key versions, same-origin/no-store routes, existing Access validation, enrollment and per-visit voluntary opt-in stop/refusal behavior. Default is no collection. No persistent browser participant identifier or raw identity in telemetry. G2 policy approval is required for real participants; synthetic fixtures use generated identities and test keys only.
3. Implement session vs workflow separation and context lifetime/ownership rules; expose a small typed client emit API and bounded memory queue. No AI usage/client pricing accepted through ingest. Validation/dedup writes are atomic; ID/sequence conflicts differ from ordinary duplicate acknowledgements. Apply architecture §4 per-session/context budgets without IP collection or new access policy.
4. Author telemetry-only SQL migrations for sessions/events/AI calls and parameterized store methods. Use emulated/in-memory local SQL in tests; no remote D1 creation/migration, no changes to empty business `db/schema.ts`.
5. Add an optional request-scoped safe server sink interface for B2. Verify how the pinned Vinext/Worker runtime provides request execution lifetime; use it without global request state. Keep resource handles distinct from request identity/context. Prove asynchronous interleaving isolation and bounded failure containment. If that narrow runtime integration is unsupported, report the exact blocker; do not add a new host, DO or event bus.
6. Extend `wrangler.dev.json`, `ops/dev/prepare-worker.mjs`, the provisioning-input example and dedicated preparation tests for optional telemetry flags/binding inputs. Preserve the old output when telemetry is absent/disabled. Enabled future config requires explicit dedicated DEV resource input. Keep all unrelated exact-key/target/isolation checks and default disabled values. Do not edit `wrangler.jsonc`, old preview guards or deploy workflows.
7. Add off-by-default DEV/environment/hostname/cohort/eligibility checks and fixed readiness/health codes. Missing binding/key is collection no-op, not an APU outage. No raw request/rejected-body logging.

## Acceptance criteria

- Disabled mode produces no telemetry requests/writes or persistent tracking, with existing application behavior unchanged.
- Consent refusal/stop, identity change/uncertainty and ineligible account produce no new collection; same app functionality remains available.
- Malformed/oversized/unknown-version/unknown-key/client-AI payloads rejected; repeated identical events counted once; conflicting ID/sequence rejected.
- Session ownership and HMAC cohort separation hold across two interleaved requests; no raw identity or forbidden content appears in rows/exports/log assertions.
- Pending/final store API is monotonic; fail-open sink errors cannot escape to provider caller.
- DEV preparation passes both original disabled and new explicit telemetry shapes while rejecting resource/target substitutions.
- No remote infrastructure mutation, deployment or actual provider request occurred.

## Verification

V3, bounded to new cross-layer feature and existing access/DEV preparation boundaries. Run typecheck, new telemetry schema/store/context/queue/consent tests, existing access-control/server-capabilities and dev-worker-preparation/deployment-config tests, canonical build and artifact validation. Use synthetic identities and emulated DB. Verify actual request-lifetime API against pinned runtime; document result. No broad F1 provider eval or unrelated visual suite.

Record source SHA, exact commands/results and tested scope. Existing feature/docs→dev PRs are rejected by release-context CI (`unsupported_pr_branches`); keep local technical results separate and do not alter workflow guards to manufacture a green check. Open a reviewable implementation PR against dev; integration remains operator-controlled.

## Documentation & Tracking

Documentation Impact:
Type: IMPLEMENTED CONTRACT / VERIFICATION

Documents:
- `03_APU_SITE/TELEMETRY/TELEMETRY_ARCHITECTURE.md` — mark implemented foundation vs remaining planned work, exact module/runtime integration evidence.
- `03_APU_SITE/TELEMETRY/TELEMETRY_ROADMAP.md` — B1 result and unresolved gates.
- `03_APU_SITE/CURRENT/APU_SITE_RUNTIME_TECHNICAL_CURRENT.md` — concise disabled foundation state only, no deployed-resource claims.

Changelog: YES — source foundation only after technical PASS, explicitly not deployed/collecting.
Backlog: UPDATE — B-07 foundation milestone; do not resolve.
Known Issues: NONE — retain existing KI-01/KI-03.

## Deployment Authorization

NOT AUTHORIZED

Database provisioning, remote migration, key provisioning, hosted update and real-user collection are also not authorized by this batch. This file is an implementation handoff; the audit session must stop before executing it.
