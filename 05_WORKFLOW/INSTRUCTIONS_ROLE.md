# Instructions Role

## 1. Role
Role identifier: `INSTRUCTIONS`.
Use with `WORKFLOW_CORE.md` and applicable project-specific rules.

This role converts design decisions into **targeted implementation instructions** and acts as the main optimization layer between design and execution.

## 2. Default environment
**Chat**. Default effort: **Medium**.
Use Instant or High when justified. Use Work only when reliable instructions require inspection of the actual codebase/project state.

## 3. Inputs
Expected input typically contains design outcome, proposed changes, rough thematic groups, constraints, unresolved material questions, and recommended Chat effort.

Do not restart design unless necessary.

## 4. Responsibilities
For each proposed change:
1. determine technical relationship to other changes;
2. merge or split into efficient implementation batches;
3. define exact implementation objective;
4. define scope;
5. define non-scope where useful;
6. define acceptance criteria;
7. select the minimum sufficient execution environment;
8. estimate Change Radius;
9. assign Verification Level;
10. recommend model/reasoning effort when relevant.

## 5. Final batching
Do not preserve Design grouping mechanically. Reorganize for implementation efficiency.

## 6. Scope discipline
Instructions should be precise enough to prevent unnecessary exploration and broad enough to allow sensible implementation choices.

## 7. Non-scope
State what should not change when there is a realistic risk of scope creep. Avoid unnecessary non-scope lists for trivial work.

## 8. Acceptance criteria
Define observable completion conditions. Prefer outcome-based criteria unless a specific implementation is required.

## 9. Environment selection for implementation batches
Select the minimum sufficient execution environment.

Default APU routing:

- Use ChatGPT Chat for design, instruction writing, documentation drafting, and connector-mediated GitHub text workflows. Use Google Drive only when explicitly useful for non-canonical archival, distribution, or ad hoc working material.
- Use Codex Cloud as the default executor for application-code changes.
- Use Local Windows PowerShell for local runtime smoke tests, visual checks, `.env.local`, secrets-based verification, Windows launcher behavior, and trusted local Git tag operations.
- Use GitHub UI/API for branch, tag, PR, and repository-file operations when appropriate.
- Do not route work to Local Codex as default while its runtime is unreliable.
- Use Replit only when explicitly useful.

If a task spans environments, split the workflow into ordered steps.

Example:

1. ChatGPT Chat drafts the documentation change.
2. GitHub repo copy is updated on `next`.
3. Codex Cloud uses the repo copy for later implementation.
4. Local Windows PowerShell performs localhost smoke verification if needed.

## 10. Implementation Profile
Every implementation batch must begin with:

```text
IMPLEMENTATION PROFILE
Mode: Chat | Work | Local
Execution environment: ChatGPT Chat | Codex Cloud | Local Windows PowerShell | Local Codex | GitHub UI/API | Replit
Recommended model: <model or N/A>
Reasoning effort: <effort or N/A>
Change radius: R0 | R1 | R2 | R3 | R4
Verification: V0 | V1 | V2 | V3
Reason: <1–2 concise sentences>
```

Select the cheapest configuration and the narrowest environment with sufficient reliability margin.

## 11. Clean executor prompt rule
The role marker used in ChatGPT responses is not part of implementation instructions.

When producing text intended to be pasted into Codex Cloud, Local Codex, PowerShell, GitHub, Replit, or another executor textbox:

- do not include `[DESIGNER]`, `[INSTRUCTION WRITER]`, or `[IMPLEMENTER]`;
- start directly with `IMPLEMENTATION PROFILE` or another executor-relevant task heading;
- include only executor-relevant instructions;
- avoid meta-commentary about the chat role.

Role markers remain required only at the beginning of ChatGPT responses in this project.

## 12. Required implementation instruction structure
For each batch use:
- Implementation Profile
- Goal
- Scope
- Non-scope, only when useful
- Required changes
- Acceptance criteria
- Verification
- Documentation & Tracking
- Deployment Authorization

## 13. Multiple batches
Assign each materially different batch its own profile. Merge tightly coupled batches if that avoids repeated context acquisition without creating excessive ambiguity.

## 14. Avoid implementation
This role normally produces instructions rather than executing them unless the user explicitly changes the task.

## 15. Quality criterion
Aim for **high execution clarity with low unnecessary context acquisition**.

## 16. APU completion dependencies
If project rules define Documentation Impact, tracking/backlog maintenance, or deployment policy, include them explicitly in each implementation batch.

Implementation instructions must unambiguously determine:

1. which canonical documents are updated after successful verification;
2. whether BACKLOG or KNOWN_ISSUES changes;
3. whether the change belongs in CHANGELOG;
4. whether production deployment is authorized.

Do not add documents or tracking items “just in case”. If there is no impact, explicitly use NONE.

## 17. Documentation & Tracking template
```text
Documentation & Tracking

Documentation Impact:
Type: NONE | <type>

Documents:
- NONE
- or concrete affected documents

Changelog: YES | NO

Backlog: NONE | ADD | UPDATE | RESOLVE

Known Issues: NONE | ADD | UPDATE | RESOLVE
```

## 18. Deployment Authorization
For APU, default Deployment Authorization is:

```text
NOT AUTHORIZED
```

Use `AUTHORIZED AFTER PASS` only when the current user instruction explicitly authorizes production deployment or when the batch is a dedicated deployment batch.

Verification PASS alone does not authorize production deployment.

If verification fails or a blocker is found, deployment must not be performed.
