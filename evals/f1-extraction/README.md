# F1 canonical extraction evaluation

This harness compares the production extraction/grounding contract without changing production routing. The `coverage` pipeline is test-only:

`EXTRACT → COVERAGE CHECK → GROUNDING`

## Safe dry run

```bash
npm run eval:f1 -- --dry-run --profiles baseline,terra-extract --pipelines baseline,coverage --repetitions 3 --max-calls 1000
```

Dry runs never require `OPENAI_API_KEY` and make no provider calls. A live run reads `OPENAI_API_KEY` only from the process environment and refuses to start when it is absent.

## Filters and profiles

Use `--suite atomic,mixed,dense`, `--case <comma-separated ids>`, `--profiles baseline,terra-extract,terra-both,terra-medium,sol-reference`, and `--pipelines baseline,coverage`. Explicit `--extraction-model`, `--extraction-reasoning`, `--grounding-model`, and `--grounding-reasoning` flags can override a selected profile for a controlled experiment. `--judge-model` enables an isolated optional semantic judge for deterministic `REVIEW` matches; judge decisions are recorded and never rewrite gold fixtures or silently count as deterministic passes.

Use `--max-calls` to bound a live sweep. Results are written below `evals/f1-extraction/results/` and ignored by Git. Each run emits raw JSONL, case-score JSONL, aggregate JSON/CSV, and a Markdown summary. Do not commit live outputs by default.
