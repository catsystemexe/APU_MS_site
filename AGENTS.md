# APU — Codex Repository Instructions

## Purpose

This repository contains the APU application and its canonical project documentation.

Codex should implement approved tasks conservatively, preserve established project boundaries, and use repository documentation as the source of truth for project-specific decisions.

Do not treat this file as a complete project specification. Use it as a map to the relevant canonical documents.

---

## Authoritative project documentation

Before implementing a task, consult only the documentation relevant to that task.

Primary workflow documents:

- `05_WORKFLOW/WORKFLOW_CORE.md`
- `05_WORKFLOW/IMPLEMENTATION_ROLE.md`
- `05_WORKFLOW/APU_PROJECT_RULES.md`

When the task concerns product behavior, architecture, runtime state, or tracking, use the corresponding canonical documents:

- `01_PRODUCT/CURRENT_STATE/APU_CURRENT_STATE.md`
- `01_PRODUCT/ARCHITECTURE/APU_ARCHITECTURE.md`
- `01_PRODUCT/PRODUCT_DECISIONS/APU_PRODUCT_DECISIONS.md`
- `03_APU_SITE/CURRENT/APU_SITE_RUNTIME_TECHNICAL_CURRENT.md`
- `03_APU_SITE/BACKLOG/APU_SITE_BACKLOG.md`
- `03_APU_SITE/KNOWN_ISSUES/APU_SITE_KNOWN_ISSUES.md`
- `03_APU_SITE/CHANGELOG/APU_SITE_CHANGELOG.md`

Historical material under `04_HISTORY/` is archival context only and is not a current source of truth.

Knowledge/Core versions already present under `apu-core/` are authoritative for their respective versioned Core content.

---

## Instruction priority

Follow instructions in this order:

1. explicit current task instructions;
2. more specific applicable `AGENTS.md` instructions, if any;
3. this root `AGENTS.md`;
4. canonical project and workflow documentation referenced above.

If the actual repository state materially contradicts the task, verify the contradiction rather than blindly implementing an invalid assumption.

Do not reinterpret the requested outcome merely because an alternative implementation appears preferable.

---

## Repository model

- Canonical repository: `catsystemexe/APU_MS_site`
- Stable branch: `main`
- Active development branch: `next`

Codex Cloud may expose its checkout as branch `work`. Do not treat that name alone as evidence of an incorrect base.

Verify the expected base using repository state, HEAD, and task context when branch identity matters.

Do not create or modify release/checkpoint tags unless explicitly requested and the relevant remote/tag state has been verified.

---

## Implementation discipline

Implement only the approved task or batch.

Use the minimum context acquisition necessary to understand:

- the requested change;
- directly affected components;
- required dependencies;
- applicable project rules.

Do not perform unrelated:

- refactoring;
- cleanup;
- modernization;
- redesign;
- architectural migration;
- speculative fixes.

Prefer the smallest safe change that satisfies the requested outcome.

Preserve existing behavior outside the approved scope unless the task explicitly changes it.

If a small local correction is necessary to make the requested implementation valid, keep it narrow and report it.

---

## Core project invariants

Preserve the architectural flow:

`Zápisník → Rozbor → Výstup`

Unless an explicit design decision changes it:

- Zápisník owns canonical explicit user information and pedagogical needs.
- Rozbor is a derived analytical layer.
- Výstup is a downstream realization/output layer.
- Derived layers must not silently rewrite canonical Zápisník data.
- Opening a working panel must not implicitly change runtime phase.
- Phase transitions remain explicit user actions or explicit supported instructions.
- Pedagogical policy belongs to the versioned APU Core.
- Runtime/UI code must not silently redefine Core pedagogical policy.

Do not infer new product architecture from implementation convenience.

---

## Runtime and infrastructure boundaries

The application targets the repository's current Cloudflare Worker architecture.

Use the current repository configuration and scripts as authoritative implementation evidence.

Important boundaries:

- Cloudflare owns hosted runtime configuration and secrets.
- Repository code owns the expected runtime/deployment contract.
- Build or test PASS does not imply production deployment.
- Local development authentication bypasses must never be enabled in hosted environments.
- Secret values must never be committed, logged, printed, or placed in documentation.

Relevant repository commands are defined in `package.json`.

Use only the checks required by the current task and applicable verification level.

---

## Verification

Follow the Verification Level specified by the task.

Use the minimum sufficient verification appropriate to the change.

Available checks may include:

- typecheck;
- lint;
- targeted tests;
- full automated tests;
- build;
- Worker artifact validation;
- rendered UI / interaction verification where materially necessary.

Do not claim verification that was not actually performed.

Do not substitute build success for runtime, visual, or deployment verification when those are separately required.

If required verification cannot be completed in the current environment, report that explicitly.

---

## Documentation and tracking

The task's `Documentation & Tracking` section determines documentation scope.

After successful implementation verification:

- update the explicitly identified canonical documents;
- update CHANGELOG only when instructed;
- update BACKLOG only when instructed;
- update KNOWN_ISSUES only when instructed.

Do not automatically audit or rewrite unrelated project documentation.

If implementation evidence reveals that a specified documentation impact is materially incomplete, report the discrepancy instead of expanding documentation scope broadly.

Governing workflow documents under `05_WORKFLOW/` and repository agent instructions are not ordinary implementation documentation.

Do not autonomously modify:

- `AGENTS.md`;
- `05_WORKFLOW/WORKFLOW_CORE.md`;
- `05_WORKFLOW/DESIGN_ROLE.md`;
- `05_WORKFLOW/INSTRUCTIONS_ROLE.md`;
- `05_WORKFLOW/IMPLEMENTATION_ROLE.md`;
- `05_WORKFLOW/APU_PROJECT_RULES.md`

unless the current task explicitly authorizes a workflow/instruction change.

---

## Deployment authorization

Production deployment is not implied by implementation or verification success.

Default:

`NOT AUTHORIZED`

Deploy only when the current task explicitly authorizes production deployment.

If verification fails or a blocker remains, do not deploy.

---

## Completion report

At completion, report concisely:

- what was changed;
- verification actually performed and its result;
- documentation/tracking updates actually performed;
- material deviations from the task;
- unresolved blockers;
- deployment status.

Do not report planned, inferred, or attempted actions as completed.
