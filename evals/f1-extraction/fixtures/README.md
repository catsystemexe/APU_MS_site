# F1 extraction fixtures

- `corpus.json` contains the committed version 2 synthetic and DEV-derived Suites 1–3: 48 cases, 184 canonical facts, and 25 explicit relations.
- `corpus.schema.json` defines the machine-readable fixture contract.
- `suite4-real-case-studies.json` is the intentionally empty holdout location for later cases supplied by Michal and Zdenda.

Gold facts must be explicit in their referenced input. Do not use another model to create or silently revise gold data. Every `source.quote` must be an exact substring of `inputs[source.inputIndex]`; the automated integrity test enforces this.

Every committed fact requires an atomic `canonicalText`, and every case requires `expectedRelations` (an empty array is valid). Canonicalization must preserve supported semantic strength: qualifiers such as `někdy` and `jindy` stay when removing them would make a claim unconditional. Relations must use canonical, non-duplicated signatures and same-turn source evidence. After fact or relation changes, recalculate `dimensions.factCount` and `dimensions.categoryCount`, validate the full corpus, and require the relation-aware audit to return zero deterministic violations and zero heuristic/relation findings.

The one-time v1→v2 migration was gated on a fully approved deterministic proposal before `corpus.json` changed. `npm run propose:f1-gold-v2` now reports `already_migrated` for this normalized corpus and does not reapply the migration. Legacy v1 inputs remain loadable for historical compatibility, but evaluation comparisons must record the corpus version because v1 and v2 gold targets are not directly interchangeable.

Suite 4 must remain separately reportable. Do not copy synthetic substitutes into the holdout file and do not commit live provider results or sensitive real-case content without an explicit data-handling decision.
