# F1 canonical extraction evaluation

This harness compares the production extraction/grounding contract without changing production routing. The `coverage` pipeline is test-only:

`EXTRACT → COVERAGE CHECK → GROUNDING`

## Gold Contract versions

The committed 48-case canonical corpus is version 2. It contains 184 facts and 25 explicit relations. Version 2 requires two fields beyond the legacy contract:

- every gold fact has `canonicalText`, the atomic, category-specific primary scoring target; `text` remains available for a supported relation-preserving surface form;
- every case has `expectedRelations` (possibly empty), using `context_of`, `course_of`, `condition_effect`, or `contrast_with` with exact same-turn source evidence and validated fact references.

Version 2 validation rejects duplicate IDs and list members, missing references, invalid or cross-turn source evidence, empty source/target sides, category-invalid context/course sources or helps projections, and self-overlapping contrasts. Semantic agreement between a canonical paraphrase and its evidence remains an audit/review responsibility rather than being guessed lexically by the loader.

Current F1 output contains facts only and does not expose relation objects. Consequently `relationRecall` is reported as `null`/unavailable; the harness never infers a relation prediction from fact text. Canonical fact recall continues to enforce source, category, action, related-entry, uncertainty, negation, and required-marker constraints. The loader retains version 1 fallback to `text` only for historical fixtures and results.

Canonical text is atomic and category-specific, but it must not strengthen or weaken supported meaning. In particular, Czech qualifiers such as `někdy` and `jindy` remain in `canonicalText` when removing them would turn a qualified alternative into an unconditional claim. They may identify contrast branches without creating an unsupported frequency/course fact. Explicit duration is isolated as course when supported; for example, Ondra's `Po pár minutách.` course fact is related to the `Jindy odbíhá.` manifestation.

Audit the current or a proposed corpus with:

```bash
npm run audit:f1-gold
```

The audit uses `canonicalText` when present and recognizes explicit relations, so a relation-preserving surface `text` is not treated as category contamination when its atomic canonical fact and companion relation are present. For condition-dependent course, the explanatory graph is `context → course → manifestation`: `condition_effect` links context to course (and its helps projection), then `course_of` links course to the observed manifestation. A context link only to a downstream manifestation does not explain context retained in course wording. `Někdy`/`jindy` branches alone are contrasts, not automatic course facts; explicit frequency, duration, and intensity remain course signals.

Inspect the deterministic version 2 migration status without changing the canonical corpus:

```bash
npm run propose:f1-gold-v2
```

The command writes JSON and Markdown under `evals/f1-extraction/results/gold-v2-proposal/`. Optional positional arguments select a source corpus and output directory. On a legacy v1 corpus, fact-level changes reference canonical case-level facts and relations instead of embedding duplicate relation objects. On the committed normalized v2 corpus, the command returns the deterministic `already_migrated` no-op status with no changes or pending decisions. A v2 corpus that does not match the approved normalized migration fails clearly instead of being rewritten.

Directional relation signatures use relation type plus sorted source, target, and projection IDs. `contrast_with` is symmetric: both sides are individually sorted, then the two sides are oriented by stable fact-ID order, so inverse declarations collapse to one relation. Canonical relations are sorted by signature and receive deterministic case-local IDs.

Before the canonical migration, the generator applied the proposal to a clone in memory, recalculated dimensions, and ran corpus validation plus the v2 audit. The approved gate required `humanReviewRequired = 0`, `readyToApply = true`, `validationPassed = true`, and both audit counters at zero. The migration then added `canonicalText` to every fact, added `expectedRelations` to every case, applied all 19 approved fact changes and 17 new facts across eight cases, and committed the validated result. The command makes no provider calls and never writes the canonical corpus.

Historical comparisons must identify the corpus version used. Version 2 changes gold fact targets and adds relation gold, so v1 and v2 aggregate fact metrics are not directly interchangeable even though production extraction and scoring logic are unchanged. `SCORING_CONTRACT_VERSION` therefore remains `4`; relation scoring remains unavailable until production F1 emits a relation representation.

## Safe dry run

```bash
npm run eval:f1 -- --dry-run --profiles baseline,terra-extract --pipelines baseline,coverage --repetitions 3 --max-calls 1000
```

Dry runs never require `OPENAI_API_KEY` and make no provider calls. A live run reads `OPENAI_API_KEY` only from the process environment and refuses to start when it is absent.

## Filters and profiles

Use `--suite atomic,mixed,dense`, `--case <comma-separated ids>`, `--profiles baseline,terra-extract,terra-both,terra-medium,sol-reference`, and `--pipelines baseline,coverage`. Explicit `--extraction-model`, `--extraction-reasoning`, `--grounding-model`, and `--grounding-reasoning` flags can override a selected profile for a controlled experiment. `--judge-model` enables an isolated optional semantic judge for deterministic `REVIEW` matches; judge decisions are recorded and never rewrite gold fixtures or silently count as deterministic passes.

Use `--max-calls` to bound a live sweep. Results are written below `evals/f1-extraction/results/` and ignored by Git. Each run emits raw JSONL, case-score JSONL, aggregate JSON/CSV, and a Markdown summary. Do not commit live outputs by default.
