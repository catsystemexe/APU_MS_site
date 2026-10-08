# F1 extraction fixtures

- `corpus.json` contains the committed synthetic and DEV-derived Suites 1–3.
- `corpus.schema.json` defines the machine-readable fixture contract.
- `suite4-real-case-studies.json` is the intentionally empty holdout location for later cases supplied by Michal and Zdenda.

Gold facts must be explicit in their referenced input. Do not use another model to create or silently revise gold data. Every `source.quote` must be an exact substring of `inputs[source.inputIndex]`; the automated integrity test enforces this.

Suite 4 must remain separately reportable. Do not copy synthetic substitutes into the holdout file and do not commit live provider results or sensitive real-case content without an explicit data-handling decision.
