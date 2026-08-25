APU — Current State
Status: CURRENT
Purpose: canonical product-level answer to “How does APU work now?” This document describes current verified product behavior, not deployment history. Runtime provenance belongs to APU Site — Runtime & Technical Current; history belongs to CHANGELOG and checkpoints.

PRODUCT FLOW
APU uses three distinct working layers: Zápisník → Rozbor → Výstup.

Zápisník
• Canonical structured source of explicit user facts and pedagogical needs for the current situation.
• Five categories: Pozorovaný projev; Pedagogická potřeba; Kontext; Intenzita / trend; Zkušenosti.
• Automatic extraction may add only explicitly grounded information and should preserve source evidence. Hypotheses and recommendations do not become canonical facts.

Rozbor
• Derived analytical layer built from the current Zápisník.
• The verified current POCHOPIT prototype starts from the situation/pedagogical need plus concise open baseline hypotheses.
• Baseline hypotheses stay distinct from generated analysis and are not rewritten by Build operations.
• Desktop F2 uses Build on the left and Rozbor on the right; the composer remains available, Build can hide to reveal chat, and the divider is resizable.
• POCHOPIT Build currently offers exactly three operations:
  – Rozvinout hypotézy: Základně / Podrobně / Do hloubky;
  – Porovnat a propojit hypotézy;
  – Doplnit odborný rámec.
• VYTVOŘIT ROZBOR creates only the required generated components for active operations.
• Each expansion is rendered directly below its matching baseline hypothesis. Porovnání a souvislosti and Odborný rámec are separate cross-cutting blocks below the hypothesis list.
• Generated content remains a working component collage, not one polished final report.
• Build changes do not silently regenerate model content. AKTUALIZOVAT ROZBOR is explicit and incremental.
• Unchanged components are preserved. Only missing or dependency-stale components are regenerated; pure removals make no model call.
• Turning an operation OFF does not immediately destroy the visible prior Rozbor; removal is applied on explicit AKTUALIZOVAT.
• Mixed removals and generations are atomic. If generation fails, the previous complete generated Rozbor remains visible and retryable.
• Stale in-flight model responses are discarded if the source need, hypotheses, Build config or required component specs changed meanwhile.
• Generated Markdown is safely rendered for presentation without mutating stored source content or enabling raw HTML execution.
• Rozbor must not silently rewrite Zápisník or present model interpretation as canonical fact.

Výstup
• F3 remains the downstream realization layer for concrete recommendations, plans and documents.
• Product direction is that F3 should consume the current Rozbor substance and decide composition, audience, form and style without changing substantive F2 logic.
• The new verified POCHOPIT slice has not yet migrated the existing immediate F2→F3 source contract. Legacy Preview-bound F3 implementation may still exist in the repository.
• Therefore the new POCHOPIT flow must not currently be described as already entering F3 through the new current-Rozbor contract.

PHASE BEHAVIOR
F1 — Intake
• Goal: capture at least one Pozorovaný projev and one Pedagogická potřeba before transition readiness.
• Structured F1 questions are rendered separately from normal assistant prose and must not be duplicated in prose.
• MAIN and NAV are mutually exclusive. A relevant intake turn may additionally contain one useful SIDE question, with at most two visible questions total.

F1 → F2
• Transition is explicit: NAV action or unambiguous user instruction.
• Opening the Rozbor panel alone does not change phase.

F2 — Rozbor
• Entry presents the concise baseline need + hypotheses rather than an exhaustive checklist.
• Build controls are separate from baseline analytical content.
• Ordinary Build selection changes are local and cause no model call.
• VYTVOŘIT ROZBOR and AKTUALIZOVAT ROZBOR are the explicit model-backed actions for the verified POCHOPIT slice.
• POZOROVAT and VYTVOŘIT redesign are not part of this verified slice.
• The old path selector, five-skill track, processed path build and explicit PREVIEW generation are not current POCHOPIT interaction behavior.

F2 → F3
• The intended product boundary is current Rozbor substance → F3 materialization.
• Immediate contract migration is still pending and was not implemented in the completed POCHOPIT slice.
• No product documentation should imply that this migration is already complete.

CURRENT INTERACTION PRINCIPLES
• Communication profiles Operátor, Kolega and Metodik change presentation style, not the underlying pedagogical decision structure.
• Phase and active working layer determine context and model-routing policy; manual model override does not redefine product boundaries.
• Project state and unread/seen state are presentation/state concerns and must not silently alter canonical data.
• APU Session JSON is a diagnostic/session snapshot, not a long-term project database or substitute for canonical project documentation.

CURRENT LIMITATIONS
• Long-term project persistence, multi-project history, rich document editing, arbitrary templates and multiple saved F3 versions remain separate capabilities.
• The new F2 POCHOPIT current-Rozbor source contract has not yet been wired into the existing F3 implementation.
• POZOROVAT and VYTVOŘIT still require their own design/implementation cycle under the new F2 mental model.
• Integrations or deployment-specific access mechanisms are not product invariants and belong in technical current documentation.

DOCUMENT OWNERSHIP
• APU — Current State: current product behavior.
• APU — Architecture: architectural relationships, canonical/derived layers and phase boundaries.
• APU Site — Runtime & Technical Current: repository/runtime/deployment provenance and technical configuration.
• APU — Product Decisions: durable product decisions and rationale.
• CHANGELOG: implemented historical changes.
• BACKLOG / KNOWN_ISSUES: unfinished work and confirmed current defects.
