APU — Product Decisions  
Status: CURRENT DECISION LOG  
Purpose: retain only durable, still-valid product/project decisions and their rationale. Implementation history belongs to CHANGELOG; temporary work belongs to BACKLOG / KNOWN\_ISSUES.

1\. ZÁPISNÍK IS THE CANONICAL SOURCE  
Decision: Explicit user facts and pedagogical needs belong to Zápisník. Rozbor and Výstup are derived layers and must not silently rewrite canonical information or present a model inference as canonical fact.  
Reason: Separating observation from interpretation preserves auditability, safe updates and pedagogical clarity.  
Status: CURRENT.

2\. PEDAGOGICAL CORE AND TECHNICAL RUNTIME ARE SEPARATE  
Decision: Pedagogical policy belongs to the versioned APU Core. Technical orchestration, routing, UI contracts and diagnostics belong to the application runtime.  
Reason: Technical changes must not silently alter pedagogical methodology, and active Core behavior must remain traceable.  
Status: CURRENT.

3\. PHASE TRANSITIONS ARE EXPLICIT  
Decision: F1 → F2 and F2 → F3 occur only through explicit user navigation or an unambiguous user instruction. Readiness, panel selection or model inference do not themselves change phase.  
Reason: The user retains control over depth and workflow progression.  
Status: CURRENT.

4\. F2 STARTS WITH A LIGHT ENTRY STATE  
Decision: The initial Rozbor is a concise working map. Detail is developed selectively by relevant branch; full elaboration of every branch is not a prerequisite for explicit transition to F3.  
Reason: F2 should support focused reasoning rather than become a mandatory exhaustive checklist.  
Status: CURRENT.

5\. MODEL ROUTING IS A RUNTIME POLICY, NOT A PRODUCT LAYER  
Decision: Model selection, reasoning configuration and Knowledge Base access may vary by phase/working layer, but they do not redefine the canonical/derived data model or phase boundaries.  
Reason: Runtime optimization should remain replaceable without changing the product architecture.  
Status: CURRENT.

6\. SESSION EXPORT IS A DIAGNOSTIC SNAPSHOT  
Decision: APU Session JSON is a machine-readable snapshot of the current session and relevant telemetry/state. It is not the canonical project database, project-history system or human-facing final document.  
Reason: Diagnostics and durable project persistence are different responsibilities.  
Status: CURRENT.

7\. GITHUB IS THE CANONICAL DEVELOPMENT SOURCE OF TRUTH  
Decision: The GitHub repository catsystemexe/APU\_MS\_site is the canonical source for application code and project documentation. main is stable; next is active development. Google Drive is not a mandatory synchronized development copy.  
Reason: One versioned source reduces drift between code, technical documentation and implementation instructions and makes the same project state directly visible to Codex Cloud.  
Status: CURRENT — the normalized 01–05 documentation set is maintained in GitHub; Google Drive is outside the mandatory development synchronization chain.

8\. DOCUMENTATION UPDATES ARE PART OF IMPLEMENTATION COMPLETION  
Decision: Instruction preparation determines explicit Documentation & Tracking impact for each implementation batch. After successful verification, the implementer updates only the specified affected canonical documents and tracking items. Ordinary implementation does not automatically perform a broad documentation audit.  
Reason: Documentation should track verified reality while preserving scope discipline and avoiding autonomous documentation sprawl.  
Status: CURRENT WORKFLOW DECISION.

9\. WORKFLOW RULES ARE NOT SELF-MODIFYING IMPLEMENTATION CONTENT  
Decision: Governing workflow documents and repository agent instructions are changed only through explicit workflow/design decisions. A normal implementation batch must not autonomously rewrite the rules that govern its own execution.  
Reason: Prevents executor-driven policy drift and circular changes to scope, verification or deployment authorization.  
Status: CURRENT WORKFLOW DECISION.

