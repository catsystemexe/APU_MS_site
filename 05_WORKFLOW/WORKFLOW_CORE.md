# Workflow Core

## 1. Purpose
This document defines the shared workflow rules for software-development work. It governs how work is structured and executed, not project-specific product behavior.

Role-specific behavior is defined in `DESIGN_ROLE.md`, `INSTRUCTIONS_ROLE.md`, and `IMPLEMENTATION_ROLE.md`. Project-specific constraints are defined separately, e.g. `APU_PROJECT_RULES.md`.

## 2. Core workflow
Use: **DESIGN → INSTRUCTIONS → IMPLEMENTATION**.

- **Design:** determine what should change, why, expected behavior, alternatives/trade-offs, and rough thematic grouping.
- **Instructions:** transform approved design decisions into efficient implementation batches; define scope, non-scope, acceptance criteria, implementation profile, and verification.
- **Implementation:** execute approved instructions against the actual project. Do not repeat design or planning unless implementation reveals a material contradiction.

## 3. Optimization objective
Optimize for the **lowest-cost workflow that preserves reliable execution**.

Optimize in this order:
1. clarify the task;
2. optimize batching;
3. minimize scope;
4. select the appropriate environment;
5. select the lowest sufficient model/effort;
6. apply proportional verification.

## 4. Environment selection
### Chat
Prefer for discussion, design, brainstorming, evaluating alternatives, requirement clarification, grouping, and preparation of implementation instructions when codebase inspection is unnecessary.

### Work
Use when the task requires codebase inspection, project modification, implementation, testing, agentic multi-step execution, or verification against actual project state.

## 5. Model and effort principle
For every handoff, recommend the computational profile required by the next stage. Use the cheapest available configuration with sufficient reliability margin for the task.

## 6. Chat effort mapping
Current working taxonomy: **Instant / Medium / High**.

- **Instant:** mechanical transformation, simple classification, straightforward grouping, already-decided low-ambiguity tasks.
- **Medium:** default for standard design, UX reasoning, preparation of implementation instructions, ordinary technical reasoning, batching decisions.
- **High:** significant architecture reasoning, competing plausible solutions, consequential ambiguity, complex trade-offs, multiple interacting constraints, or high cost of reasoning error.

## 7. Work execution profile
When target environment is Work, recommend **Model + Reasoning effort + Change Radius + Verification Level** using options currently available in Work.

## 8. Change Radius
- **R0 — Micro:** isolated cosmetic/textual change.
- **R1 — Component:** localized change to one component or bounded unit.
- **R2 — Feature:** several related components, local state, or feature logic.
- **R3 — Flow:** meaningful application workflow or several subsystems.
- **R4 — Architecture:** foundational data model, persistence, routing, major state management, or cross-layer behavior.

## 9. Verification Level
- **V0 — Direct:** directly changed result.
- **V1 — Local:** component and immediate interactions.
- **V2 — Feature:** relevant feature flow and directly related dependencies.
- **V3 — System:** broader compatibility/regression verification when systemic risk justifies it.

Use the minimum verification sufficient for actual risk.

## 10. Batching principles
Optimize by **technical cohesion**, not item count.

Merge tasks when they touch the same component/subsystem, require the same context, share verification, or would otherwise duplicate context acquisition.

Split tasks when they concern independent areas, have substantially different risk, require different model/effort profiles, require different verification depth, or create excessive context breadth.

> One implementation batch should represent one coherent technical area and one reasonably verifiable outcome.

## 11. Minimal Scope Principle
Perform only work necessary to satisfy the approved task. Do not automatically audit the whole project, inspect unrelated architecture, refactor surrounding code, fix unrelated issues, or perform broad compatibility analysis.

## 12. Proportional Verification Principle
Use **minimum sufficient verification**, not maximum available verification.

## 13. No redundant replanning
Trust valid outputs from the previous stage. Reopen earlier reasoning only when instructions contradict actual project state, a required assumption is false, implementation reveals a material dependency, or acceptance criteria cannot be met as specified.

## 14. Active workflow optimization
Recommend merging, splitting, changing effort/environment, reducing unnecessary verification, or escalating when useful. Keep this optimization lightweight.

## 15. Handoff principle
### Design → Instructions
Include approved/proposed changes, rough thematic batches, unresolved material questions, and recommended Chat effort for Instructions.

### Instructions → Implementation
Include implementation batch, scope, non-scope, acceptance criteria, and Work execution profile.

## 16. Conflict priority
1. explicit current user instruction;
2. current project-specific rules;
3. current role rules;
4. Workflow Core;
5. older handoff assumptions.

Flag material contradictions rather than silently resolving them.
