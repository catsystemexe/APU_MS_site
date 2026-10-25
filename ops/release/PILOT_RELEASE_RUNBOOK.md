# APU pilot release — verification and authorization runbook

Status: release preparation only. **No integration, deployment or rollback is authorized by this document.**

Permanent source branch: `dev`. Protected production release target: `public`.
Migration state: the production ref is still `next` until authenticated rename and
protection read-back are recorded; this preparation does not claim migration PASS.
Production Worker: `apu-ms-site`; stable URL: `https://apu-ms-site.catsystem-exe.workers.dev`.
Dedicated DEV Worker: `apu-ms-site-dev`, unchanged by this migration. Its hosted
bootstrap/smoke evidence and remaining provider limits are recorded in Runtime Technical Current.
`automaticDevUpdatesConfigured=false`; future deployment authorization remains false.

## Current solo-operator governance — P4-B1-FINAL / P4-B2 (2026-10-21)

**Release controls verified / no merge or deployment authorized.** The operator reports
the pre-migration `next` protection below as operationally updated and verified.
Apply and verify the same controls on actual `public` after rename; prior `next`
evidence does not prove new-branch protection. This
documentation task did not independently read the administration protection endpoint
or change protection, permissions or settings. GitHub run/ref/check-provider evidence
in the next section was independently read back.

| Effective control | Verified operator-reported setting |
| --- | --- |
| Pull request | Required |
| Required human reviews | **0**; no independent reviewer or additional approval mechanism |
| Required status check | `Provider-free release checks` |
| Check provider | GitHub Actions, **App ID `15368`** |
| Administrator enforcement | ON |
| Force push / branch deletion | Prohibited / prohibited |
| Strict branch-up-to-date check | OFF |
| Auto-merge | OFF |

`catsystemexe` is the **sole intended human integration/release authority**. This is
the project's governance rule. PR/check protection, administrator enforcement and
zero required reviews do not constitute an identity allowlist restricting all GitHub
merge permissions to that account; this record is not an audit of collaborator,
administrator or bypass permissions. No GitHub permission change is implied.
Pilot application access remains separate from repository integration authority.

CI SUCCESS is evidence for a specific source and tested merge, **not authorization
to merge or deploy**. `catsystemexe` must explicitly authorize integration and must
separately authorize any production deployment. No second reviewer is required.
With strict up-to-date OFF, GitHub does not require an up-to-date merge check before
integration; recheck the actual candidate/base against the assessed run evidence.
Draft PR #62 remains **OPEN / DRAFT / unmerged**: verification evidence only, not an
approved production release. Auto-merge is not enabled or authorized.

## Verified source and PR provenance — 2026-10-21

Exact repair `8f5d0d69e4ce5f55a748c77eb2e9aabde5f8f049`, parent
`ccdf975cab8665386725cfa042b8af9b240d5cce`, was published by normal fast-forward to `dev`.

| Actual run | Result | Check identity |
| --- | --- | --- |
| [Push `39650429541`](https://github.com/catsystemexe/APU_MS_site/actions/runs/39650429541) | SUCCESS, 648/648 tests | `Provider-free release checks`, App `15368` |
| [PR #62 `39650438040`](https://github.com/catsystemexe/APU_MS_site/actions/runs/39650438040) | SUCCESS, 648/648 tests | `Provider-free release checks`, App `15368` |

Both are completed first attempts; their successful logs verify the candidate source
SHA above. The PR tested synthetic merge `50495afc0ca8760e8e9412ee8aef53c1d9b48acb`,
with exactly base `b0162eb2c0f72d1bc0fea2886ae8695418beb251` (`next`) then the candidate
as its parents. The push tested the candidate directly. The PR reported optional
webhook merge metadata `differs` while the authoritative checkout/parent validation
passed. This observed new value does not reconstruct the historical event payload.
Historical [run `39630801929`](https://github.com/catsystemexe/APU_MS_site/actions/runs/39630801929)
remains **FAILURE**, not superseded with a successful result or manually retried.

Production Builds OFF and Preview Builds OFF, production branch `next` and the
disabled old DEV/capture gates are accepted **operator-verified configuration evidence**,
not a fresh Cloudflare runtime inspection. No dedicated DEV Worker is provisioned;
KI-01/KI-03 remain OPEN and automatic DEV deployment remains disabled. The separate
`APU manual deploy` hook boundary below is unchanged. This closeout itself remains
unpublished until separate source-publication authorization and fresh disabled-Builds/
gate preflight. Any later authorized documentation push may generate new push and
PR #62 checks; assess both as new results, not as these already completed runs.

## Branch migration sequence — source only

1. Capture `next`, `dev`, `main`, PR #60/#62, original branch protection and Workers
   deployment/Version/traffic evidence. Check automatic Production/Preview Builds
   OFF and both old activation gates disabled. Never print a Deploy Hook URL.
2. Review two independent source-only PRs: `codex/production-branch-dev-compat → dev`
   and `codex/production-branch-compat → next`. These exact migration pairs (also
   production compatibility into `public` after rename) are the only maintenance
   exceptions to the normal DEV release source. The guard requires actual ordered
   merge parents and a nonempty exact CI/governance-file allowlist; application,
   dependency, Wrangler/binding and unrelated workflow changes fail closed.
3. Require real `Provider-free release checks` SUCCESS from GitHub Actions App
   `15368` on each PR before integrating only its bounded source diff. The same CI
   files are installed in both branches. Preserve every existing full DEV test and
   offline isolation check. The old production branch has no DEV preparation code:
   its smaller explicit test inventory is accepted only with every DEV marker absent
   and exact pinned application/Core/configuration/dependency/script tree identities
   from production `b0162eb2c0f72d1bc0fea2886ae8695418beb251`. Missing/partial tests or
   any altered legacy source fail closed. No application or dependency is changed.
4. Rename `next` to `public` through authenticated GitHub administration, without
   force push or history rewrite. Verify the captured pre-rename HEAD equals actual
   `public`, protections including App ID and admin enforcement, no force/deletion,
   zero reviews and auto-merge OFF; keep `main` untouched. A 403 administration read
   is an executor permission limit, not proof that protection transferred.
5. Verify production branch mapping `public` with Automatic/Preview Builds still
   OFF. Inspect hook configuration/callers read-only; never invoke, rotate or delete
   it. Preserve unresolved hook dependencies and both Workers unchanged. No Worker
   deployment, KV/Access/secret change, rollback or automatic promotion is authorized.
6. Assess a fresh real `dev → public` merge-ref check with actual candidate/base
   parent provenance. Keep PR #62 Draft/unmerged as migration verification evidence
   with an explicit reason, or close it as superseded only after new verification.
   Confirm PR #60's source is already represented in permanent DEV and no longer an
   approved release source before closing it as obsolete; never merge it implicitly.
7. Reconcile actual migration results without rewriting historical `next` evidence.
   Synchronize approved project-rule/workflow copies to Drive only after their GitHub
   publication is verified. Refresh ChatGPT Project Sources from those approved files;
   no source-refresh capability is assumed when the executor has no such tool.

Until steps 4–6 have actual evidence, report migration BLOCKED/PARTIAL. Source-level
PASS is not end-to-end governance PASS. Transitional `next` and exact maintenance
pairs remain explicitly bounded migration compatibility, not additional production
branches or authorization to deploy. Remove them only through a separately verified
source cleanup after migration, preserving required-check operation.

## Evidence and verification boundary

The `Pilot release verification` workflow runs provider-free checks on pushes to `dev`,
development PRs targeting `dev`, and release PR events targeting `public` (legacy `next` during migration). Its runtime
guard accepts only this repository and proven source/merge parents. Normal release
PRs must be `dev → public` or transitional `dev → next`. PR #60's stabilization branch is not
a release source and is not repurposed or merged by this process.

### Development PR verification — CI-01 (2026-10-24)

Same-repository working branches may target `dev` for provider-free verification;
the provenance record marks them `verificationScope: development`. Sources named
`main`, `dev`, `next` or `public` cannot use this development path. Both exact migration
source names remain reserved for their existing branch pairs and nonempty bounded
CI/governance-file diff checks, including rejection of application/configuration changes.
Development eligibility grants no production release eligibility: a working branch
targeting `next` or `public` is still rejected. Forks, privileged events, unsupported
actions, closed/merged PRs, malformed SHAs, head-only checkouts and wrong merge parents
remain rejected. No workflow trigger, permission, action pin, regression selection,
branch protection or integration/deployment authorization is changed by CI-01.

Local CI-01 V2: **72/72 context/workflow tests** and the actual release runner
**660/660 provider-free tests** plus inactive DEV/Preview configuration checks PASS.
This source result does not replace a hosted check: read the new PR #81 run and its
exact candidate, tested merge and ordered parents after publication. Earlier rejected
feature-PR runs remain failures. Application/browser evidence from the unchanged
combined candidate remains scoped to its recorded local checks.

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

### Historical PR provenance repair preparation — P4-B1-R1 (2026-10-21)

The source contract remains current. Preparation-time publication/hosted-verification
limits below were superseded by the independently verified runs above; retain the
historical failure and its uncaptured-payload limitation.

| Value | Source and trust boundary |
| --- | --- |
| `GITHUB_SHA` / `GITHUB_REF` | Runner-provided Actions context: PR merge-ref SHA / exact `refs/pull/N/merge`, not the candidate head SHA. |
| `GITHUB_EVENT_PATH` | Runner-provided path to the event snapshot; the path itself proves no source identity. Read only the required event fields. |
| `pull_request.head.sha` / `base.sha` | Declared candidate/base snapshot; validate SHA syntax, exact repository/branches and compare with the local merge parents. |
| `pull_request.merge_commit_sha` | Nullable mergeability metadata; not an additional identity authority or a guaranteed synchronized copy of `GITHUB_SHA`. |
| Actual checkout HEAD / parents | Local Git object evidence: HEAD must equal `GITHUB_SHA`, with exactly two parents equal to declared base, then candidate. A head-only checkout is rejected. |
| Actions run API `head_sha` | Run/candidate metadata; never substitute it for the synthetic merge SHA. |

The [Actions PR event contract](https://github.com/github/docs/blob/cca0c9d7299f760587d6601bd96acfd2f5cb8929/content/actions/reference/workflows-and-actions/events-that-trigger-workflows.md#pull_request)
defines the merge-ref SHA and default PR actions. The [REST PR contract](https://docs.github.com/rest/pulls/pulls#get-a-pull-request)
describes asynchronous mergeability computation; the official API/webhook schema at
`github/rest-api-description` commit `755ee33b4a81d51f6f07a902cce26cbec3b822f2`
allows nullable `merge_commit_sha`. Requiring its equality in the event snapshot was
an unsupported redundant condition. The repair retains all checkout/parent, open
same-repository PR, `dev → next`, action/ref/number and SHA checks. Missing, null,
different or malformed optional merge metadata does not authorize a checkout;
only the complete validated Git relationship can pass. Logs expose only its fixed
`webhookMergeShaStatus`: `unavailable`, `matches`, `differs` or `invalid`.

Historical run [39630801929](https://github.com/catsystemexe/APU_MS_site/actions/runs/39630801929)
remains **FAILURE**, at the provenance step, with subsequent validation steps skipped.
GitHub independently confirms checkout `3f783948ae6c02e94384991c06d16216b6ad4951`
and parents `b0162eb2c0f72d1bc0fea2886ae8695418beb251`, then
`ccdf975cab8665386725cfa042b8af9b240d5cce`. The event snapshot and historical
`merge_commit_sha` value were not captured; the exact rejecting condition is therefore
**NOT PROVEN**. The current PR API value does not reconstruct that old snapshot.

New rejection output contains only `release_context_rejected` and a fixed cause:
`unsupported_repository`, `unsupported_event`, `unsupported_push`, `push_source_mismatch`,
`unsupported_pr_metadata`, `unsupported_pr_state`, `unsupported_pr_ref`,
`unsupported_pr_branches`, `invalid_pr_source`, `invalid_checkout_sha`,
`checkout_sha_mismatch` or `unproven_merge_source`. Event/Git read/parse failures use
`release_metadata_unavailable`; summary-write failures retain `release_provenance_record_failed`.
Never log raw payload/environment/errors. No workflow change, reviewer-policy change,
retry or new authorization is introduced. The repair is offline V2 evidence only;
source publication needs separate operator authorization and current Builds/gates
preflight. A later authorized push may create a fresh Draft PR #62 synchronize run;
evaluate that actual result before any branch-protection change, without rerunning
the historical failure or marking the PR ready/merged.

A successful offline job proves neither hosted acceptance nor a deployment. A new
workflow is **CI NOT VERIFIED** until its actual run completes successfully. The two
specific runs above passed; future candidate results must be assessed independently.
The current required check and zero-review solo-operator model are recorded above;
the earlier P2 one-review assumption is historical and superseded. Recheck effective
protection before integration. A skipped/missing job is not a release-check PASS.

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
5. Identify the exact candidate in the release PR from `dev` to `public`. Existing
   Draft PR #62 is verification evidence, not an approved release; this record
   authorizes no Draft transition or integration. Do not use PR #60 or silently
   integrate the stabilization branch.
6. Require successful `Provider-free release checks` from GitHub Actions App `15368`
   for the assessed current candidate/merge and recheck effective protection and base
   provenance. Required human reviews are **0**; do not add an independent reviewer
   requirement. Pilot application access grants no integration authority. No protection
   or permission change is performed by this runbook.
7. Obtain explicit `catsystemexe` approval for integration, then integrate only within
   that authorization. A green workflow alone does not authorize a merge or release.
8. Read back automatic **Production Builds OFF** and **Preview Builds OFF**, production
   branch `public` after cutover (legacy `next` before it), both old CI gates exactly `disabled`, no competing operation and
   integration/hook ownership. Resolve the Deploy Hook blocker below before release.
9. Immediately before any authorized release, record authenticated production
   Deployment ID, Version IDs, traffic allocations and current source with timestamps.
   The prior baseline is Deployment `08a0cd96-fb57-4f2f-9a6b-14950420b89e`, Version
   `2a28cdf6-5a61-4f6c-be55-382e5bfa28cd` at 100%, from earlier operator evidence;
   **re-read it**, do not assume it remains current from this runbook.
10. Obtain **separate deployment authorization from `catsystemexe`**, naming the exact integrated source,
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
historically targeting `next`, not `dev`. Do not assume a branch rename retargets
the hook or disables it. After production mapping changes to `public`, re-read the
hook target without invoking it; unresolved/stale ownership, callers or behavior
remain an open release dependency. Repository connection must be preserved. The hook's existence
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
