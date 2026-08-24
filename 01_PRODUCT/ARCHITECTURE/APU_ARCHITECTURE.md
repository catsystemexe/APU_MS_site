**APU — Architecture**  
Status: CURRENT  
Ownership: architecture, data-layer relationships and phase boundaries. Product behavior belongs to APU — Current State; repository/runtime/deployment details belong to APU Site — Runtime & Technical Current.

ARCHITECTURAL PRINCIPLE  
APU separates canonical user data, derived analysis and downstream output:  
Zápisník → Rozbor → Výstup.  
Derived layers must never silently rewrite canonical information.

1\. ZÁPISNÍK — CANONICAL DATA  
• Contains explicit user facts and pedagogical needs for the current situation.  
• Items may originate from manual input or grounded extraction.  
• A canonical pedagogical need preserves its user-visible text and owns a mapped initial F2 path (`POCHOPIT`, `POZOROVAT` or `VYTVOŘIT`) plus a separate optional concrete F3 target.
• Interpretation, working hypotheses and recommendations do not belong here.

2\. ROZBOR — DERIVED ANALYTICAL LAYER  
• AnalysisState is generated from the current Zápisník through the analysis flow.  
• It may contain hypotheses, needs, relationships, uncertainty, limitations, follow-up questions and transition-readiness information.  
• The F2 build editor owns the authoritative working build state: the canonical mapped path is retained as `initialPath`, an editable `activePath` selects one of three paths, and five optional skill layers per path can hold short parameters.
• All three F2 paths use one model-driven lifecycle: local path-specific configuration → explicit execution → typed structured processed build → explicit immutable PREVIEW snapshot → model-rendered preview.
• `POCHOPIT` develops expert understanding, `POZOROVAT` specifies targeted evidence gathering, and `VYTVOŘIT` prepares a justified practical build specification. Their active skills are composed in one situation-level model operation and their processed layers remain identifiable by path.
• Shared hypotheses remain dynamic across paths. Uncertainty is normalized but path-relative: `POCHOPIT` tolerates conceptual openness, `POZOROVAT` converts observable unknowns into evidence design, and `VYTVOŘIT` localizes missing context to provisional decisions. Uncertainty never automatically blocks continuation.
• F2 working context and model interpretation do not silently write back to the canonical Zápisník. Local edits do not invoke model APIs and leave the last processed revision visibly unapplied.
• PREVIEW is an F2 output and early F3 contract. It is bound to one isolated accepted build revision; subsequent relevant edits preserve it and mark it stale rather than automatically regenerating it.
• The active F2 path is authoritative for execution and preview; it is never inferred from the requested artifact. F3 target remains separate, and F2 previews may anticipate its shape without fully materializing the final artifact.

3\. VÝSTUP — DOWNSTREAM REALIZATION LAYER  
• F3 consumes one explicitly accepted immutable F2 PREVIEW snapshot, not raw chat, `NeedAnalysis` or mutable live F2 state. The session remains bound to that snapshot until the user explicitly adopts a newer preview.
• F2 decides **WHAT** makes pedagogical and analytical sense; F3 decides **HOW** that accepted content is materialized. F3 may adapt audience, language, detail and text/table/card representation, but cannot alter the path, goal, hypotheses, selected approach, observation logic or substantive uncertainty.
• F3 parameter edits are local and make no model call. A single current final render is created only by the explicit final-render action; configuration or source changes preserve it as stale until explicit regeneration.
• If materialization would require a substantive decision absent from F2, F3 returns a boundary issue and offers an explicit return to the existing live Rozbor. Returning does not mutate F1, execute F2 or regenerate PREVIEW.
• It must preserve materially relevant uncertainty and must not retroactively convert derived interpretation into Zápisník facts. A rich text/WYSIWYG editor, arbitrary templates and output version history remain outside the minimum F3 layer.

DATA FLOW  
• User message → extraction / grounding → supported candidates → Zápisník.  
• Zápisník canonical pedagogical need → mapped F2 path + optional F3 target → F2.
• F1 canonical need → F2 analytical/build specification → explicit immutable PREVIEW snapshot → F3 materialization/finalization.
• Zápisník → analysis flow → AnalysisState → Rozbor card \+ chat representation.  
• Zápisník \+ current Rozbor context → F3/output context → downstream work.  
• Derived layers do not silently write backwards into Zápisník.

PHASE BOUNDARIES  
• Runtime phases correspond to F1 Intake, F2 Rozbor and F3 Výstup.  
• F1 → F2 requires explicit user navigation/instruction and applicable intake readiness.  
• The F1 mapped path is initial routing derived from the canonical need; a later F2 active path is an editable working choice and does not replace or rewrite that F1 mapping.
• F2 → F3 requires explicit acceptance of a PREVIEW snapshot and an explicit entry action; complete elaboration of the entire Rozbor is not required. Substantive changes require return to F2 and a new explicit execution/PREVIEW cycle before F3 can adopt them.
• Opening Zápisník, Rozbor or Výstup is a working-layer selection and does not itself change phase.

CORE, RUNTIME AND KNOWLEDGE  
• Pedagogical policy belongs to the versioned APU Core.  
• Technical orchestration, context composition, routing, diagnostics and UI contracts belong to the application runtime.  
• Runtime code must not silently duplicate or change Core pedagogical policy.  
• Knowledge Base access is a separate runtime capability and does not become canonical user data merely because it informed analysis.

RUNTIME SUBSYSTEM BOUNDARIES  
• Chat flow: conversation transport, phase controller, model routing, context composition and diagnostics.  
• Extraction flow: structured extraction of explicit user information with grounding safeguards.  
• Analysis flow: structured generation/update of AnalysisState.  
• Client: conversation UI, working panels, local interaction state, diagnostics and session export.  
• Persistence/storage layers, when used, are infrastructure concerns and must preserve the canonical-vs-derived data boundary.

SOURCE-CODE AND DEPLOYMENT ARCHITECTURE  
• Canonical application source is the GitHub repository catsystemexe/APU\_MS\_site.  
• main is the stable branch; next is the active development branch.  
• The application is implemented as a standalone Cloudflare Worker application using the repository’s current Next.js/Vinext/Vite toolchain.  
• Cloudflare owns hosted runtime configuration and access/deployment concerns; repository documentation owns the expected configuration contract, not secret values.  
• Local development and hosted deployment are distinct execution environments and may use different authentication mechanics without changing product phase architecture.

SECURITY AND SECRETS  
• Runtime credentials and identifiers such as OPENAI\_API\_KEY and APU\_VECTOR\_STORE\_ID are secrets and must never be committed or printed.  
• Local secret files remain local and ignored by Git.  
• Hosted authentication/access policy belongs to runtime/deployment configuration and must fail safely when required configuration is missing.

DOCUMENTATION ARCHITECTURE  
• GitHub is the canonical development source for application code and project documentation.  
• Product-state documents describe current verified behavior, not plans.  
• Historical checkpoints and audits remain historical snapshots and are never treated as current source of truth.  
• Workflow/meta-instruction documents may be changed only by explicit workflow decisions; ordinary implementation should not autonomously rewrite its own governing rules.
