# APU Site — Known Issues

Status: CURRENT

This file contains confirmed current defects or concrete verification gaps only. Product limitations and future capabilities belong in Backlog. Historical resolved defects belong in Changelog/checkpoints.

## RESOLUTION REFERENCES

### KI-02 — Manual Notebook serialization — RESOLVED in source (2026-10-14)
B1.9-R1 corrected the undefined/undefined exclusion comparison in `compactNotepad()`. Nonempty manual records, including source-less edits, now survive default serialization; explicit source-message exclusion remains exact. Typecheck and **249 focused provider-free/mocked regressions** passed, including actual F1 request boundaries, all three F2 canonical-need paths and immutable downstream source behavior. Native Windows, hosted/live-provider and production verification are not claimed. Historical defect and repair details are recorded in the [Changelog](../CHANGELOG/APU_SITE_CHANGELOG.md#2026-10-14--b19-r1-manual-notebook-serialization-repair).

## VERIFICATION GAPS

### KI-01 — Full authenticated hosted F1 → F2 → F3 regression is not continuously evidenced
The repository provides build/typecheck/test verification paths, but a successful repository verification does not by itself prove a complete authenticated hosted user journey through all phases.

**Status:** verification gap, not a reproduced product defect.

**Close when:** a current hosted smoke/E2E pass is recorded for the critical F1 → F2 Entry/Working → F3 path under the intended Cloudflare Access configuration.

## NOT KNOWN ISSUES
The following are intentional limitations or backlog items rather than confirmed defects:
- unfinished structured F3 Output workspace;
- lack of durable multi-project Save/Open;
- attachments and optional external integrations not yet activated;
- historical/legacy audit-export modules that are not part of the current primary UI flow.
