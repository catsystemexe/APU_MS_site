# F1 canonical extraction evaluation

This harness compares the production extraction/grounding contract without changing production routing. The `coverage` pipeline is test-only:

`EXTRACT → COVERAGE CHECK → GROUNDING`

## Gold Contract versions

The committed canonical corpus remains version 1. Version 1 scores `expectedFacts[].text` and has no explicit relation gold.

Version 2 is accepted by the loader and adds two required fields:

- every gold fact has `canonicalText`, the atomic, category-specific primary scoring target; `text` remains available for a supported relation-preserving surface form;
- every case has `expectedRelations` (possibly empty), using `context_of`, `course_of`, `condition_effect`, or `contrast_with` with exact same-turn source evidence and validated fact references.

Version 2 validation rejects duplicate IDs and list members, missing references, invalid or cross-turn source evidence, empty source/target sides, category-invalid context/course sources or helps projections, and self-overlapping contrasts. Semantic agreement between a canonical paraphrase and its evidence remains an audit/review responsibility rather than being guessed lexically by the loader.

Current F1 output contains facts only and does not expose relation objects. Consequently `relationRecall` is reported as `null`/unavailable; the harness never infers a relation prediction from fact text. Canonical fact recall continues to enforce source, category, action, related-entry, uncertainty, negation, and required-marker constraints. Version 1 automatically falls back to `text`.

Audit the current or a proposed corpus with:

```bash
npm run audit:f1-gold
```

The audit uses `canonicalText` when present and recognizes explicit relations, so a relation-preserving surface `text` is not treated as category contamination when its atomic canonical fact and companion relation are present. For condition-dependent course, the explanatory graph is `context → course → manifestation`: `condition_effect` links context to course (and its helps projection), then `course_of` links course to the observed manifestation. A context link only to a downstream manifestation does not explain context retained in course wording. `Někdy`/`jindy` branches alone are contrasts, not automatic course facts; explicit frequency, duration, and intensity remain course signals.

Generate the deterministic version 2 migration proposal without changing the canonical corpus:

```bash
npm run propose:f1-gold-v2
```

The command writes JSON and Markdown under `evals/f1-extraction/results/gold-v2-proposal/`. Optional positional arguments select a source corpus and output directory. Fact-level changes reference canonical case-level facts and relations instead of embedding duplicate relation objects. Each case merges new facts, helps projections, and relations before output.

Directional relation signatures use relation type plus sorted source, target, and projection IDs. `contrast_with` is symmetric: both sides are individually sorted, then the two sides are oriented by stable fact-ID order, so inverse declarations collapse to one relation. Canonical relations are sorted by signature and receive deterministic case-local IDs.

Before writing output, the generator applies the proposal to a clone in memory, sets version 2 fields, recalculates dimensions, and runs both corpus validation and the v2 audit. It fails on deterministic violations, duplicate/broken relations, or unexpected heuristics. Human-review changes remain `pending_human_review`; while any remain, `readyToApply` is false even when `validationPassed` is true. The command makes no provider calls and never writes the canonical corpus.

## Safe dry run

```bash
npm run eval:f1 -- --dry-run --profiles baseline,terra-extract --pipelines baseline,coverage --repetitions 3 --max-calls 1000
```

Dry runs never require `OPENAI_API_KEY` and make no provider calls. A live run reads `OPENAI_API_KEY` only from the process environment and refuses to start when it is absent.

## Filters and profiles

Use `--suite atomic,mixed,dense`, `--case <comma-separated ids>`, `--profiles baseline,terra-extract,terra-both,terra-medium,sol-reference`, and `--pipelines baseline,coverage`. Explicit `--extraction-model`, `--extraction-reasoning`, `--grounding-model`, and `--grounding-reasoning` flags can override a selected profile for a controlled experiment. `--judge-model` enables an isolated optional semantic judge for deterministic `REVIEW` matches; judge decisions are recorded and never rewrite gold fixtures or silently count as deterministic passes.

Use `--max-calls` to bound a live sweep. Results are written below `evals/f1-extraction/results/` and ignored by Git. Each run emits raw JSONL, case-score JSONL, aggregate JSON/CSV, and a Markdown summary. Do not commit live outputs by default.
