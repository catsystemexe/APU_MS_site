# APU Site — Backlog

Status: CURRENT

Contains only unfinished or explicitly undecided work. Completed work belongs in the Changelog; confirmed defects belong in Known Issues. Ordering is not product priority.

## ACTIVE

### B-01 — Structured F3 Output
- Introduce a standalone structured Output state and actual Output workspace.
- Generate/update output from the current Zápisník and Rozbor while preserving uncertainty.
- Update APU Session JSON when a real Output state exists.

### B-02 — Durable project Save/Open
- Add durable project persistence beyond browser-local state.
- Define Save/Open, project lifecycle, multi-project history and cross-device recovery without violating canonical data ownership.

### B-03 — Working-layer history/versioning
- Decide and implement user-facing snapshots/revisions for Zápisník, Rozbor and Výstup if required.
- Keep diagnostic Session JSON distinct from a versioning system.

### B-04 — Attachments and external integrations
- Decide supported attachment types, limits and security model before activating attachment UI.
- Decide whether Google Drive, Gmail or other product integrations are required and in what order.

### B-05 — Authenticated hosted E2E regression path
- Establish a repeatable authenticated smoke/E2E path for critical F1 → F2 → F3 behavior against the hosted environment.
- Do not weaken Cloudflare Access or introduce a production auth bypass solely for tests.

## NEEDS DECISION

### D-01 — Legacy export/audit internals
Historical HTML audit/export and Drive-upload helpers remain separate from the current Session JSON flow. Before removal or reactivation, verify whether any legitimate internal/test workflow still depends on them.

## OUTSIDE ACTIVE BACKLOG
The following are not backlog items unless a new requirement or reproducible regression reopens them:
- structured F2 Analysis / Entry / Working flow;
- MAIN/SIDE/NAV question ownership and explicit phase transitions;
- APU Session JSON and request telemetry;
- Cloudflare Worker hosting baseline and Cloudflare Access architecture;
- developer/tester role split;
- repository-backed DEV LOG with Cloudflare KV mutable state.
