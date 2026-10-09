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

## Eval-only grounding replay

The `evidence-scope-v2` experiment replays only the grounding stage over the exact PRE-grounding candidates stored in a judged `stage-runs.jsonl`. It does not rerun extraction, coverage, or the semantic judge, and it does not change the production grounding prompt, schema, parser, routing, or model selection. The replay supports the `baseline` profile and calls only `gpt-5.6-luna` with low reasoning.

Its evidence contract treats `sourceQuote` as a local anchor and `newUserMessage` as the complete authoritative evidence context. Grounding may restore a shared grammatical subject, a clearly scoped preposed context/adjunct, a shared governing predicate, an explicit pronoun/coreference or ellipsis, relation-preserving context from the same sentence/clause, or an omitted subject/referent with exactly one grammatically plausible resolution. It must still reject unsupported facts, causes, diagnoses, intentions, needs, interpretations and recommendations; category changes; qualifier, uncertainty, or negation loss; inferred temporal/causal relations; ambiguous coreference; and `helps` without an explicit observed condition/change plus effect. Material qualifiers including `někdy`, `jindy`, `asi`, and `ne vždy` must remain intact.

Run the baseline replay from native Windows PowerShell:

```powershell
npm.cmd run eval:f1-grounding-replay -- `
  --source ".\evals\f1-extraction\results\f1-full48-luna-vs-terra-gold-v2-sol-judged" `
  --profile baseline `
  --variant evidence-scope-v2 `
  --run-id "f1-grounding-evidence-scope-v2-baseline" `
  --output-dir ".\evals\f1-extraction\results" `
  --max-calls 48
```

The source must be a judged result directory (or its `stage-runs.jsonl`) containing the original stable PRE candidate IDs, complete original grounding traces, PRE and current POST scores, and staged semantic evidence. The canonical corpus must still contain every referenced case and supplies the original `newUserMessage`. For multi-turn cases, `currentNotebook` is reconstructed from the starting notebook and the original surviving add candidates, keeping all upstream inputs fixed while only grounding verdicts change. The replay records SHA-256 hashes for the source stage artifact and corpus, refuses an existing output directory, refuses to write inside the source result directory, and verifies both hashes again before completion.

Provider verdicts require exactly one unique index for every submitted candidate, covering `0..N-1`; missing, duplicate, or out-of-range indexes invalidate the entire response instead of becoming implicit rejections. Every verdict also uses a deterministic reason category: `accept_direct`, `accept_shared_subject`, `accept_shared_scope`, `accept_coreference`, `accept_relation_context`, `reject_unsupported_meaning`, `reject_category_mismatch`, `reject_semantic_strengthening`, `reject_ambiguous_coreference`, `reject_inferred_relation`, or `reject_other`.

The fresh result directory contains `replay-plan.json`, `run-state.json`, `grounding-replay-verdicts.jsonl`, `case-scores.jsonl`, `aggregate.json`, `dimension-breakdown.csv`, and `summary.md`. Reports compare current and replay PRE/POST recall, grounding losses, semantic precision, grounded extras, unsupported candidates, rejected/restored Gold-supporting candidates, and newly accepted grounded-extra versus unsupported candidates overall, by suite, and for Human Gate cases. Saved Sol semantic evidence is filtered by replay survival IDs; no new semantic-judge call is made.

### Monotonic evidence-scope-v3 rescue

The `evidence-scope-v3-rescue` variant is a monotonic rescue experiment over the same judged artifacts. It never submits a candidate whose original grounding verdict was accepted. For each turn, it sends only original rejections to `gpt-5.6-luna` with low reasoning; a turn with no rejection makes no provider call. Final acceptance is composed as `originalAccepted || rescueAccepted`, so current final candidates are retained and rescued candidates can only be added. The harness hard-fails if any Gold fact covered by current POST becomes uncovered in v3 POST.

The v3 rescue question is deliberately narrower than general grounding: was the rejection caused only by a local `sourceQuote` omitting an otherwise explicit and unambiguous grammatical relation in the same `newUserMessage`? Rescue is limited to a shared subject, shared preposed context, shared governing predicate, unambiguous coreference, explicit relational coordination, or explicit context completion. It continues to reject unsupported meaning, category changes, ambiguous reference, negation or uncertainty changes, inferred causal/temporal relations, and `helps` without an explicit condition/change and observed effect.

The hard modifier-only rule rejects a rescue whenever `sourceQuote` contains only frequency, duration, intensity, degree, time, manner, or a similar modifier while `notebookText` imports a substantive predicate absent from the quote. This includes `někdy`, `jindy`, `rychle`, and `po pár minutách` when used alone to anchor an added action. Atomization remains category-aware: one source span may support separate manifestation and course/context atoms, and a manifestation need not duplicate an independent qualifier atom unless the qualifier materially changes that manifestation proposition.

Run the monotonic rescue from native Windows PowerShell:

```powershell
npm.cmd run eval:f1-grounding-replay -- `
  --source ".\evals\f1-extraction\results\f1-full48-luna-vs-terra-gold-v2-sol-judged" `
  --profile baseline `
  --variant evidence-scope-v3-rescue `
  --run-id "f1-grounding-evidence-scope-v3-rescue-baseline" `
  --output-dir ".\evals\f1-extraction\results" `
  --max-calls 14
```

The call estimate is computed from turns containing at least one original rejection; `14` is the expected bound for the current 48-case artifact, not a harness constant. The plan records both estimated calls and rescue candidates submitted. Reports expose original accepted/rejected counts, rescue submitted/accepted/rejected counts, restored Gold facts, remaining grounding losses, newly accepted `ALIGNED`, `GROUNDED_EXTRA`, and `UNSUPPORTED` candidates, and current-covered Gold facts lost, overall and by atomic/mixed/dense suite and Human Gate case. Saved Gold IDs and semantic classifications are never provider inputs; saved Sol evidence is applied only after rescue to evaluate outcomes. A successful result requires zero newly accepted `UNSUPPORTED` candidates and zero current-covered Gold facts lost.

## Safe dry run

```bash
npm run eval:f1 -- --dry-run --profiles baseline,terra-extract --pipelines baseline,coverage --repetitions 3 --max-calls 1000
```

Dry runs never require `OPENAI_API_KEY` and make no provider calls. A live run reads `OPENAI_API_KEY` only from the process environment and refuses to start when it is absent.

## Filters and profiles

Use `--suite atomic,mixed,dense`, `--case <comma-separated ids>`, `--profiles baseline,terra-extract,terra-both,terra-medium,sol-reference`, and `--pipelines baseline,coverage`. Explicit `--extraction-model`, `--extraction-reasoning`, `--grounding-model`, and `--grounding-reasoning` flags can override a selected profile for a controlled experiment. `--judge-model` enables an isolated optional semantic judge for deterministic `REVIEW` matches; judge decisions are recorded and never rewrite gold fixtures or silently count as deterministic passes.

Use `--max-calls` to bound a live sweep. Results are written below `evals/f1-extraction/results/` and ignored by Git. Each run emits raw JSONL, case-score JSONL, aggregate JSON/CSV, and a Markdown summary. Do not commit live outputs by default.
