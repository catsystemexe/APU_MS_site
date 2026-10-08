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
• The verified current F2 prototype starts from the situation/pedagogical need plus concise open baseline hypotheses and supports three paths: POCHOPIT, POZOROVAT and VYTVOŘIT.
• Baseline hypotheses stay distinct from generated analysis and are not rewritten by Build operations.
• Desktop F2 uses Build on the left and Rozbor on the right; the composer remains available, Build can hide to reveal chat, and the divider is resizable.
• All three paths use one shared current-Rozbor component/reconciliation core with path-specific generated components.
• POCHOPIT offers:
  – Rozvinout hypotézy: Základně / Podrobně / Do hloubky;
  – Porovnat a propojit hypotézy;
  – Doplnit odborný rámec.
• POZOROVAT offers:
  – Rozvinout hypotézy;
  – Porovnat a propojit hypotézy as discriminative condition contrasts;
  – Určit klíčové indikátory;
  – Stanovit priority pozorování.
• VYTVOŘIT offers:
  – Rozvinout hypotézy;
  – Navrhnout možné přístupy with one explicit working/recommended approach;
  – Zpřesnit cíl;
  – Určit podmínky úspěchu;
  – Určit, co následně ověřovat.
• VYTVOŘIT ROZBOR creates only the required generated components for active operations.
• Each hypothesis expansion is rendered directly below its matching baseline hypothesis. Path-specific cross-cutting components are rendered separately below the hypothesis list.
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
• POCHOPIT, POZOROVAT and VYTVOŘIT can all hand off directly from the current Rozbor to F3; the primary F2→F3 pipeline no longer requires legacy PREVIEW.
• F3 consumes an immutable, validated snapshot of the current Rozbor plus its canonical pedagogical need, hypotheses, limitations and F3 target.
• F3 materializes, structures and reformulates that snapshot for the selected audience and form; it must not re-decide substantive F2 logic.
• VYTVOŘIT requires one explicit working/recommended approach before F3 materialization; alternatives alone are insufficient.
• Source or F3 presentation changes mark an existing Output stale while keeping the previous valid Output visible.
• A changed current Rozbor must be explicitly adopted, and generation or regeneration of Output is always explicit.
• Stale in-flight F3 responses cannot silently replace the current source/configuration state or the previous valid Output.

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
• VYTVOŘIT ROZBOR and AKTUALIZOVAT ROZBOR are the explicit model-backed actions for all three verified F2 paths.
• Ordinary path/configuration changes are local and do not themselves call the model.
• POZOROVAT is explicitly evidence-oriented: it separates observable indicators from interpretation and prioritizes contrasts that can discriminate between working hypotheses.
• VYTVOŘIT must produce an explicit working/recommended approach before downstream materialization; a list of alternatives alone is not sufficient.
• The old five-skill track, processed path build and explicit PREVIEW generation remain legacy contracts and are not the primary current-Rozbor interaction model.

F2 → F3
• The verified product boundary is current Rozbor substance → F3 materialization for POCHOPIT, POZOROVAT and VYTVOŘIT.
• The handoff creates an immutable validated current-Rozbor snapshot; conversation history and legacy PREVIEW are not sources for the primary F3 request.
• Opening F3 or adopting a newer snapshot does not implicitly generate Output. Initial generation and regeneration remain explicit user actions.
• A newer source is detected as stale, the previous Output remains visible, and the current Rozbor must be explicitly adopted before regeneration.
• Response acceptance is bound to the requested source fingerprint and F3 configuration revision so stale in-flight work cannot overwrite current state.

CURRENT INTERACTION PRINCIPLES
• Communication profiles Operátor, Kolega and Metodik change presentation style, not the underlying pedagogical decision structure.
• Phase and active working layer determine context and model-routing policy; manual model override does not redefine product boundaries.
• Project state and unread/seen state are presentation/state concerns and must not silently alter canonical data.
• APU Session JSON is a diagnostic/session snapshot, not a long-term project database or substitute for canonical project documentation.

CURRENT LIMITATIONS
• Long-term project persistence, multi-project history, rich document editing, arbitrary templates and multiple saved F3 versions remain separate capabilities.
• APU Session JSON does not yet include the real F3 Output state; its `output` field is still exported as `null`.
• Legacy PREVIEW implementation remains isolated in the repository for compatibility but is not required by the primary current-Rozbor → F3 pipeline.
• Integrations or deployment-specific access mechanisms are not product invariants and belong in technical current documentation.

DOCUMENT OWNERSHIP
• APU — Current State: current product behavior.
• APU — Architecture: architectural relationships, canonical/derived layers and phase boundaries.
• APU Site — Runtime & Technical Current: repository/runtime/deployment provenance and technical configuration.
• APU — Product Decisions: durable product decisions and rationale.
• CHANGELOG: implemented historical changes.
• BACKLOG / KNOWN_ISSUES: unfinished work and confirmed current defects.
