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
• Interpretation, working hypotheses and recommendations do not belong here.

2\. ROZBOR — DERIVED ANALYTICAL LAYER  
• AnalysisState is generated from the current Zápisník through the analysis flow.  
• It may contain hypotheses, needs, relationships, uncertainty, limitations, follow-up questions and transition-readiness information.  
• Entry is intentionally concise; Working deepens only a relevant selected branch.  
• Card and chat representation are projections of one structured analytical state, not independent sources of truth.

3\. VÝSTUP — DOWNSTREAM REALIZATION LAYER  
• F3 consumes the preceding state to produce concrete recommendations, plans or documents.  
• It must preserve uncertainty and must not retroactively convert derived interpretation into Zápisník facts.  
• A dedicated structured Output state/editor is a separate capability and must not be assumed merely because F3 routing exists.

DATA FLOW  
• User message → extraction / grounding → supported candidates → Zápisník.  
• Zápisník → analysis flow → AnalysisState → Rozbor card \+ chat representation.  
• Zápisník \+ current Rozbor context → F3/output context → downstream work.  
• Derived layers do not silently write backwards into Zápisník.

PHASE BOUNDARIES  
• Runtime phases correspond to F1 Intake, F2 Rozbor and F3 Výstup.  
• F1 → F2 requires explicit user navigation/instruction and applicable intake readiness.  
• F2 → F3 requires explicit user action; complete elaboration of the entire Rozbor is not required.  
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

