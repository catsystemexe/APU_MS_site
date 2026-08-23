# APU DEV LOG Protocol

Status: CURRENT V1 CONTRACT

## Purpose
DEV LOG is the internal bridge between APU Shared feedback/discussion and APU development.

## Canonical storage
- Repository: `catsystemexe/APU_MS_site`.
- New feedback entries are committed to active development branch `next`.
- Canonical entry path: `data/dev-log/entries/`.
- Storage rule: one feedback item = one standalone Markdown file.
- Google Drive is not part of the runtime synchronization path.

## Entry contract
Each entry uses Markdown with YAML frontmatter and a stable ID.

Required metadata:
```yaml
schema: apu-dev-log/v1
id: DL-YYYYMMDD-NNN
created_at: <ISO-8601 timestamp with timezone>
type: <type>
status: NEW | IN_PROGRESS | DONE
title: <short title>
```

The ID is immutable and must never be reused.

## Feedback types
- `BUG` → UI category **Chyba**.
- `PRODUCT_CHANGE`, `METHODOLOGY_CHANGE` → **Zlepšení**.
- `PRODUCT_PROPOSAL`, `METHODOLOGY_PROPOSAL`, `UNCERTAINTY` → **Diskuze**.

The displayed category is derived from `type`; it is not a separate canonical field.

## Status mapping
- `NEW` → **NOVÉ**.
- `IN_PROGRESS` → **ŘEŠÍME**.
- `DONE` → **HOTOVO**.

New entries start as `NEW` unless an explicit workflow decision says otherwise.

## Mutable state
Repository Markdown defines the canonical baseline entry content. Mutable per-item overrides are stored through Cloudflare KV binding `DEV_LOG_STATE`, including supported fields such as status, note, updatedAt and updatedBy. Invalid/missing overrides fall back to repository values.

Preview and production may use separate KV namespaces.

## Scope discipline
DEV LOG is a lightweight feedback inbox, not a general issue tracker. Do not add discussion threads, assignment systems, priorities, or broad workflow states without an explicit product decision.

## Relationship to project tracking
A DEV LOG feedback item does not automatically become BACKLOG, KNOWN_ISSUES, or an approved implementation task. Design/Instructions decide whether and how it enters the development workflow.
