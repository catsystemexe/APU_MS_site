**APU — Current State**  
Status: CURRENT  
Purpose: concise product-level answer to “How does APU work now?” Technical deployment provenance belongs to APU Site — Runtime & Technical Current.

PRODUCT FLOW  
APU uses three distinct working layers: Zápisník → Rozbor → Výstup.

Zápisník  
• Canonical structured source of explicit user facts and pedagogical needs for the current situation.  
• Five categories: Pozorovaný projev; Pedagogická potřeba; Kontext; Intenzita / trend; Zkušenosti.  
• Automatic extraction may add only explicitly grounded information and should preserve source evidence. Hypotheses and recommendations do not become canonical facts.

Rozbor  
• Derived analytical layer built from the current Zápisník.  
• Contains working hypotheses, relationships to pedagogical needs, uncertainty, limitations and targeted follow-up questions.  
• Must not silently rewrite Zápisník or present model interpretation as canonical fact.  
• Card and chat representation are views of the same structured Analysis state.

Výstup  
• Downstream realization layer for concrete recommendations, plans and documents.  
• It must preserve relevant uncertainty and limitations inherited from Zápisník and Rozbor.  
• A structured standalone Output artifact/editor remains a separate implementation concern; the existence of F3 routing does not by itself imply a finished output-management layer.

PHASE BEHAVIOR  
F1 — Intake  
• Goal: capture at least one Pozorovaný projev and one Pedagogická potřeba before transition readiness.  
• Structured F1 questions are rendered separately from normal assistant prose and must not be duplicated in prose.  
• MAIN and NAV are mutually exclusive. A relevant intake turn may additionally contain one useful SIDE question, with at most two visible questions total.

F1 → F2  
• Transition is explicit: NAV action or unambiguous user instruction.  
• Opening the Rozbor panel alone does not change phase.

F2 — Rozbor  
• The stateful build editor works with one canonical pedagogical need. Its initial path comes from the need mapping in Zápisník, while the active path can be switched without rewriting that mapping.
• `POCHOPIT`, `POZOROVAT` and `VYTVOŘIT` are model-driven build paths sharing one lifecycle: local configuration → explicit execution → structured processed build → explicit revision-bound snapshot → model-rendered preview.
• Their five optional skills are composable and path-specific. `POCHOPIT` develops expert understanding, `POZOROVAT` turns uncertainty into targeted evidence gathering, and `VYTVOŘIT` creates a justified practical build specification rather than a finished artifact.
• Working hypotheses remain shared and dynamic across paths. Uncertainty is path-relative and localized to affected evidence or decisions, but never automatically blocks continuation.
• Ordinary skill, parameter and context edits make no model call, do not write back to Zápisník, and visibly leave analytical changes unapplied until the user executes the build again.
• PREVIEW explicitly freezes the current accepted build and asks the model to render only that immutable snapshot. Later edits preserve the successful preview, mark it outdated and never regenerate it automatically; a failed refresh also preserves the previous preview.
• Switching paths preserves shared hypotheses and each path's local skill configuration, makes no automatic model call, and requires explicit execution when the target path's processed state is not current. The F3 target does not select the path and remains an early contract separate from F2 logic.

F2 → F3  
• The current boundary is an explicit model-rendered snapshot PREVIEW on the Výstup surface: an F2 output and early F3 contract, not a final F3 artifact.
• Full elaboration of every Rozbor branch is not required; remaining uncertainty is carried forward transparently.

CURRENT INTERACTION PRINCIPLES  
• Communication profiles Operátor, Kolega and Metodik change presentation style, not the underlying pedagogical decision structure.  
• Phase and active working layer determine context and model-routing policy; manual model override does not redefine product boundaries.  
• Project state and unread/seen state are presentation/state concerns and must not silently alter canonical data.  
• APU Session JSON is a diagnostic/session snapshot, not a long-term project database or substitute for canonical project documentation.

CURRENT LIMITATIONS  
• Long-term project persistence, multi-project history and a fully structured Output editor are separate capabilities and must be documented only when actually implemented and verified.  
• Integrations or deployment-specific access mechanisms are not product invariants and belong in technical current documentation.

DOCUMENT OWNERSHIP  
• APU — Current State: current product behavior.  
• APU — Architecture: architectural relationships, canonical/derived layers and phase boundaries.  
• APU Site — Runtime & Technical Current: repository/runtime/deployment provenance and technical configuration.  
• APU — Product Decisions: durable product decisions and rationale.  
• CHANGELOG: implemented historical changes.  
• BACKLOG / KNOWN\_ISSUES: unfinished work and confirmed current defects.
