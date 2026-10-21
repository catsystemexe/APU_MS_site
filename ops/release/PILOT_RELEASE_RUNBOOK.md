# APU pilot release — verification and authorization runbook

Status: release preparation only. **No integration, deployment or rollback is authorized by this document.**

Permanent source branch: `dev`. Protected production release branch: `next`.
Production Worker: `apu-ms-site`; stable URL: `https://apu-ms-site.catsystem-exe.workers.dev`.
Dedicated DEV target: `apu-ms-site-dev`, source-prepared by P3 but **not provisioned or hosted-verified**.
`automaticDevUpdatesConfigured=false`; future deployment authorization remains false.

## Evidence and verification boundary

The `Pilot release verification` workflow runs provider-free checks on pushes to `dev`
and on PR events targeting `next`. Its runtime guard accepts only this repository,
DEV pushes or same-repository `dev → next` PRs. PR #60's stabilization branch is not
a release source and is not repurposed or merged by this process.

The job `Provider-free release checks` uses SHA-pinned checkout/setup-node, read-only
contents permission and no persisted checkout credentials, deployment environment,
secret/variable references, hooks, upload or publishing steps. It installs the lockfile
without lifecycle scripts, typechecks, builds and validates the canonical artifact,
runs selected F1/F2/F3/security/environment regressions and validates inactive DEV and
old Preview configuration offline. Existing deployment scripts are unchanged and never invoked.

For a push, candidate and tested SHA must match the event and local checkout. For a PR,
the candidate is `pull_request.head.sha`; the tested checkout is the GitHub synthetic
merge SHA. The local merge parents must equal the event's base and candidate SHAs in
that order. Both SHAs are recorded in logs and the job summary. Reject stale or unproven
relationships; do not substitute a successful check for a different candidate.

A successful offline job proves neither hosted acceptance nor a deployment. A new
workflow is **CI NOT VERIFIED** until its actual run completes successfully. No required
status check is configured by this task. P2's PR/one-approval protection on `next` is
operator-reported; eligible reviewer permissions and effective protection must be
read back before integration. A skipped/missing job is not a release-check PASS.

## Ordered future release gates

1. Identify an immutable candidate SHA on `dev`; record repository, branch, source,
   check-run ID/conclusion and exact tested checkout SHA. Recheck the candidate after
   any change; do not manufacture or reuse check results from another SHA.
2. When dedicated DEV becomes available, obtain separately authorized provisioning/
   hosted verification evidence for that candidate: isolated KV, Access application,
   exact effective bindings, source/artifact identity and production preservation.
   Until then record **HOSTED DEV NOT PROVISIONED**, not PASS. P3's null template is
   intentionally incomplete; do not deploy it or use the production target as fallback.
3. Complete authenticated **F1 → F2 Entry/Working → F3** acceptance for the intended
   roles and record source, environment, scenarios, results and timestamps. KI-01
   remains OPEN until current hosted evidence meets its closure criteria.
4. Verify applicable product/security gates: canonical Notebook ownership, derived
   F2/F3 boundaries, Access/login/roles, provider-secret handling, DEV/production
   isolation, logging and retention review. Assess KI-03 explicitly; offline parser
   tests do not close its missing hosted structured-output/full-binding evidence.
5. Under **separate authorization**, create a release PR from `dev` to `next` for the
   exact candidate. Do not use PR #60 or silently integrate the stabilization branch.
6. Require completed successful release checks on the current merge candidate and
   an eligible **independent** approving reviewer. Recheck branch protection and
   reviewer eligibility. Pilot application access grants no GitHub review permissions.
   Configure required status checks only in a separately authorized administration task.
7. Obtain explicit operator approval for integration, then integrate only within
   that authorization. A green workflow alone does not authorize a merge or release.
8. Read back automatic **Production Builds OFF** and **Preview Builds OFF**, production
   branch `next`, both old CI gates exactly `disabled`, no competing operation and
   integration/hook ownership. Resolve the Deploy Hook blocker below before release.
9. Immediately before any authorized release, record authenticated production
   Deployment ID, Version IDs, traffic allocations and current source with timestamps.
   The prior baseline is Deployment `08a0cd96-fb57-4f2f-9a6b-14950420b89e`, Version
   `2a28cdf6-5a61-4f6c-be55-382e5bfa28cd` at 100%, from earlier operator evidence;
   **re-read it**, do not assume it remains current from this runbook.
10. Obtain **separate deployment authorization**, naming the exact integrated source,
    account, production target, reviewed mechanism, credential scope and rollback target.
11. Execute only that selected reviewed mechanism within its authorization. This
    runbook deliberately supplies no executable deployment or hook invocation command.
    Stop on contradictory metadata or unexpected traffic; no automatic retry/fallback.
12. Verify deployed source/Version/Deployment, intended traffic, anonymous Access
    redirects and authenticated role/login behavior, F1/F2/F3 smoke, sanitized operational
    logs and production health. Record actual results, identifiers and check timestamps;
    do not turn an upload or cancelled/failed CI run into a successful release claim.
13. Preserve a verified previous production Version/artifact, deployment/traffic and
    compatible runtime configuration as a rollback target. Rollback requires explicit
    authorization after impact review; never invoke it automatically.

## Deploy Hook — unresolved release blocker

The operator's authenticated Dashboard evidence identifies `APU manual deploy` as
targeting `next`, not `dev`. Repository connection is preserved. The hook's existence
does not prove automatic invocation, nor does **Disable builds** prove the hook is
disabled. Its behavior with Builds OFF, activation/ownership and complete external
caller inventory remain **UNVERIFIED**. It may be an independent production build trigger.

Before selecting a production release mechanism, verify ownership, authorized callers,
activation and Builds-OFF behavior through a separately scoped review. Do not display,
log, invoke, rotate or delete the hook URL. Do not adopt it as the release mechanism
without that verification. Unknown external callers were accepted only as residual
uncertainty for P3/source publication, not as production release readiness.

## Pilot identities and data boundary

Exactly two intended application users: **operator — developer** and **Zdenda — tester**.
Verify both approved email addresses and the effective Cloudflare Access allow policies
before production release; this document supplies no guessed tester address and changes
no policy. Verify application roles independently of GitHub collaborator/reviewer rights.

The pilot is session-only. Save/Open, a persistent project database and a user-account
subsystem are not required. Do not promise persistence or recovery across sessions.
Before real personal/pedagogical data is used, complete a separate data-retention and
sensitive operational logging review, including provider handling and log access;
provider-free tests and Access redirects alone do not establish those guarantees.

## Publication reconciliation

- Structured-output repair `2f8639bcd3fcb6f3b23c6312cdb3336f227d88e6` is
  **SOURCE PUBLISHED / OFFLINE V2 PASS / HOSTED CI V3 NOT VERIFIED**. Its publication
  run `39585437533` completed/skipped, not a hosted repair execution. KI-03 stays OPEN.
- P3 `8c03562188868a9b4760e8e621a6ecd009e2dd4d`, parent `2f8639b`, was published
  by normal fast-forward to `dev`: **SOURCE PUBLISHED / OFFLINE V2 492/492 PASS /
  HOSTED DEV NOT PROVISIONED**. No workflow triggered on that P3 publication. Prior
  UNPUBLISHED/held records describe preparation time, not current publication state.
- P1 runtime/Access/Builds findings are operator evidence, not a fresh Cloudflare
  inspection by this source task. Preserve historical failed/cancelled Preview runs.
  Neither this runbook nor source publication closes KI-01/KI-03 or authorizes deployment.
