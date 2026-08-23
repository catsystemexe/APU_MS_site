# APU Project Rules

## 1. Purpose
This document contains APU-specific constraints and architectural principles used together with the general workflow documents. It does not duplicate general workflow rules.

Applicable files:
- `WORKFLOW_CORE.md`
- one active role file: `DESIGN_ROLE.md`, `INSTRUCTIONS_ROLE.md`, or `IMPLEMENTATION_ROLE.md`

## 2. Project identity
Project: **APU**.
Development workflow: **Design → Instructions → Implementation**.
The active role of each chat must be explicit.

## 3. Product architecture
Primary conceptual flow:

**Zápisník → Rozbor → Výstup**

### Zápisník
Canonical structured source of user facts and pedagogical needs. Treat it as the primary source of truth for downstream analytical content.

### Rozbor
Analytical layer derived from the current Zápisník. It may contain working hypotheses, relationships to pedagogical needs, uncertainty, limitations, and targeted follow-up questions. Its content must remain grounded in the current Zápisník.

### Výstup
Downstream layer that turns the preceding state into concrete recommendations, plans, documents, or other actionable outputs.

Do not collapse these layers without an explicit architectural decision.

## 4. Truth hierarchy
Do not silently convert derived interpretation into canonical fact. Changes to derived layers must not silently rewrite canonical information.

## 5. Phase boundaries
When modifying one APU phase, preserve responsibilities of adjacent phases unless the task explicitly changes those boundaries. Do not move functionality across phase boundaries without explicit design approval.

## 6. UI work
For localized UI changes:
- prefer local component-level changes;
- preserve established visual language unless redesign is requested;
- avoid unrelated visual cleanup;
- consider mobile layout when the reported problem is mobile-specific;
- do not infer that a local visual defect requires structural redesign.

### Visual verification
For UI, layout, responsive, or interaction changes, include visual verification when it materially improves confidence in the result.

- Prefer verification against the actual rendered APU UI when the environment is accessible to the Implementer.
- If authentication or another external access barrier prevents visual inspection, do not automatically modify authentication, create a bypass, or expand implementation scope solely for verification.
- Complete the remaining minimum sufficient technical verification and report visual verification explicitly as PASS, FAIL, or NOT VERIFIED — access blocked.
- Treat unavailable visual verification as a blocker only when the change is visually critical and cannot be reliably verified by other means.
- For visually critical changes, Instruction Writer should flag the access dependency in advance when it is known.
- If visual access can be enabled through an already available, low-overhead project mechanism, prefer using it; do not build new access infrastructure merely for a routine UI check.

## 7. Responsive behavior
Do not assume desktop and mobile must use identical layout mechanics. Preserve unaffected layouts unless broader behavior is explicitly part of the task.

## 8. Content vs presentation
Distinguish content logic, analytical logic, state, presentation, and interaction. Presentation changes should not alter analytical content unless explicitly required. Interaction changes should not silently alter the canonical data model.

## 9. Source-of-truth model
For APU Site source code, the canonical source of truth is:

- GitHub repository: `catsystemexe/APU_MS_site`
- Stable branch: `main`
- Active development branch: `next`

Current checkpoint tags:

- `v0.1.0-baseline` — verified migrated source baseline
- `v0.1.1-local-dev-pass` — verified Windows local development baseline

For project and workflow documentation, use this source model:

1. GitHub repository copy is the canonical development source of truth.
2. Project documentation lives in the same repository as application code so Codex Cloud can inspect and update the verified project state directly.
3. ChatGPT Project Sources are runtime copies of selected workflow documents, not an independent source of truth. Refresh them manually after governing workflow documents change.
4. Google Drive is not part of the mandatory development synchronization chain. It may still be used for archival storage, human distribution, or ad hoc working material when explicitly useful.

Avoid maintaining conflicting synchronized copies. Normal implementation should update the canonical GitHub documentation identified by the batch's Documentation & Tracking section after successful verification.

## 10. Environment routing
Use the minimum sufficient environment.

### ChatGPT Chat
Use for:
- DESIGN;
- INSTRUCTIONS;
- requirement clarification;
- batching;
- prompt/instruction drafting;
- project documentation planning;
- connector-mediated GitHub project-documentation work when appropriate;

### Codex Cloud
Codex Cloud is the default executor for APU application-code implementation.

Use for:
- source-code changes;
- repository inspection;
- build/typecheck/test;
- technical verification;
- commits and pull requests on GitHub branches.

Codex Cloud does not see Google Drive or ChatGPT Project Sources unless they are explicitly present in the repository checkout or exposed through a verified mount/tool.

Codex Cloud may expose the checkout as branch `work` even when the task is based on `next`. Do not treat `work` alone as wrong branch. Verify by expected HEAD commit and task base ref.

Do not create checkpoint or release tags from Codex Cloud unless `origin`, remote refs, and existing tags are available and verified.

### Local Windows PowerShell
Use for:
- `npm.cmd run dev:local`;
- Windows launcher verification;
- local browser smoke tests;
- `.env.local` and secrets-based runtime tests;
- visual verification on localhost;
- trusted local Git operations such as checkpoint tags when remote/tag state must be reliable.

### Local Codex
Local Codex is not the default executor while its runtime is unreliable.

Known issue:

`Failed to create unified exec process: helper_unknown_error: setup refresh had errors`

Use Local Codex only when its runtime has been confirmed healthy in the current context.

### GitHub UI/API
Use for:
- branch/tag/commit verification;
- creating or updating text files when appropriate;
- fallback GitHub operations when Codex checkout lacks remote refs.

### Replit
Replit is optional only when explicitly useful, for example for shared preview or external runtime. It is not a default APU implementation environment while Codex Cloud and local Windows verification are sufficient.

## 11. Project-documentation update flow
For ordinary implementation batches:

1. Instruction Writer determines Documentation & Tracking impact before implementation.
2. Implementer changes application code within the approved scope.
3. Assigned verification must pass.
4. Implementer updates only the explicitly identified canonical GitHub documents and tracking items so they describe the actually implemented and verified state.
5. Do not perform a broad documentation audit unless concrete implementation evidence shows the specified impact is incomplete.

For governing workflow documents such as `WORKFLOW_CORE.md`, role files, `APU_PROJECT_RULES.md`, or repository `AGENTS.md`:

1. Change them only through an explicit workflow/design decision.
2. Update the canonical GitHub copy on `next`.
3. Verify the resulting repository content.
4. Refresh affected ChatGPT Project Sources manually from the approved GitHub version.

Ordinary implementation must not autonomously rewrite the rules that govern its own execution.

Google Drive is outside this workflow. If it is used for archival or ad hoc working material, no automatic synchronization with the canonical GitHub documentation is implied.

## 12. Secrets policy
- `.env.local` is local-only and must remain ignored by Git.
- `.env.local` and `.env*.local` must not be committed.
- Never commit, print, or paste `OPENAI_API_KEY`, `APU_VECTOR_STORE_ID`, or other secrets.
- Prompts and implementation instructions must refer to secret names, not secret values.
- Local smoke tests may use `.env.local`; Codex Cloud must not receive secret values in prompts.

## 13. Role routing
### DESIGN
Use `WORKFLOW_CORE.md` + `DESIGN_ROLE.md` + `APU_PROJECT_RULES.md`.
Primary objective: determine desired APU behavior and organize proposed changes.

### INSTRUCTIONS
Use `WORKFLOW_CORE.md` + `INSTRUCTIONS_ROLE.md` + `APU_PROJECT_RULES.md`.
Primary objective: convert approved APU design changes into efficient implementation batches and execution profiles.

### IMPLEMENTATION
Use `WORKFLOW_CORE.md` + `IMPLEMENTATION_ROLE.md` + `APU_PROJECT_RULES.md`.
Primary objective: execute approved APU implementation batches with minimal sufficient scope and verification.

## 14. APU workflow handoff
```text
APU DESIGN
  ↓
design outcome + thematic groups + constraints + next Chat profile
  ↓
APU INSTRUCTIONS
  ↓
optimized batches + scope/non-scope + acceptance criteria + execution environment + verification + deployment authorization
  ↓
APU IMPLEMENTATION
  ↓
targeted implementation + proportional verification + documentation/tracking + concise completion report
```

## 15. Optimization priority
For APU development, prioritize:
1. correctness;
2. preservation of established architecture and product decisions;
3. sufficiently reliable execution;
4. targeted scope;
5. efficient context use;
6. computational/token efficiency.

Token or credit savings must not create material risk of incorrect implementation. Project complexity alone does not justify maximum reasoning, broad diagnostics, or system-wide verification.

## 16. Implementation completion policy
Each APU implementation batch must contain:

```text
Documentation & Tracking
```

It must specify:

Documentation Impact:
- NONE
- or the concrete affected canonical documents

Changelog:
- YES | NO

Backlog:
- NONE | ADD | UPDATE | RESOLVE

Known Issues:
- NONE | ADD | UPDATE | RESOLVE

Update only items actually affected by the implementation.

Do not use BACKLOG as a general work log. If implementation is unrelated to an active or newly created backlog item, use `Backlog: NONE`.

After successful verification, Implementer updates only the specified documentation and tracking items.

## 17. Deployment policy
Production deployment is **NOT AUTHORIZED BY DEFAULT**.

Implementation and production deployment are distinct operations. Verification PASS does not imply production deployment authorization.

Production deployment requires one of:

1. explicit current user instruction authorizing deployment; or
2. a dedicated deployment implementation batch whose primary goal is deployment.

If Deployment Authorization is `NOT AUTHORIZED`, do not deploy.

If deployment is authorized and verification fails or a blocker appears, do not deploy.

Completion reports must distinguish:
- implemented;
- verified;
- locally smoke-tested;
- tagged;
- deployed.

Do not present undeployed changes as current production state.
