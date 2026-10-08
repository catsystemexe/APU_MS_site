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

The audit uses `canonicalText` when present and recognizes explicit relations, so a relation-preserving surface `text` is not treated as category contamination when its atomic canonical fact and companion relation are present. `Někdy`/`jindy` branches alone are contrasts, not automatic course facts; explicit frequency, duration, and intensity remain course signals.

Generate the deterministic version 2 migration proposal without changing the canonical corpus:

```bash
npm run propose:f1-gold-v2
```

The command writes JSON and Markdown under `evals/f1-extraction/results/gold-v2-proposal/`. Optional positional arguments select a source corpus and output directory. Each proposed change records the current surface text, atomic `canonicalText`, whether the surface text may remain, companion facts, relations, helps projections, rationale, and confidence. It makes no provider calls.

## Safe dry run

```bash
npm run eval:f1 -- --dry-run --profiles baseline,terra-extract --pipelines baseline,coverage --repetitions 3 --max-calls 1000
```

Dry runs never require `OPENAI_API_KEY` and make no provider calls. A live run reads `OPENAI_API_KEY` only from the process environment and refuses to start when it is absent.

## Filters and profiles

Use `--suite atomic,mixed,dense`, `--case <comma-separated ids>`, `--profiles baseline,terra-extract,terra-both,terra-medium,sol-reference`, and `--pipelines baseline,coverage`. Explicit `--extraction-model`, `--extraction-reasoning`, `--grounding-model`, and `--grounding-reasoning` flags can override a selected profile for a controlled experiment. `--judge-model` enables an isolated optional semantic judge for deterministic `REVIEW` matches; judge decisions are recorded and never rewrite gold fixtures or silently count as deterministic passes.

Use `--max-calls` to bound a live sweep. Results are written below `evals/f1-extraction/results/` and ignored by Git. Each run emits raw JSONL, case-score JSONL, aggregate JSON/CSV, and a Markdown summary. Do not commit live outputs by default.
