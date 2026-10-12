# APU Site — Known Issues

Status: CURRENT

This file contains confirmed current defects or concrete verification gaps only. Product limitations and future capabilities belong in Backlog. Historical resolved defects belong in Changelog/checkpoints.

## OPEN

### KI-02 — Manual notebook records without source references are omitted from compact requests
**Status:** confirmed pre-existing defect; found during the isolated desktop fixture setup on 2026-10-12. No serialization or F1 extraction/grounding code was changed by the layout batch.

`compactNotepad()` compares `entry.source?.messageId` with an optional `excludeSourceMessageId` even when both are undefined. Consequently manual records without a source reference disappear from a normal compact request. A local, non-provider reproduction with one nonempty manual manifestation returned `[]`; the same source filter also affects manual needs and can prevent their use at F1→F2/analysis boundaries. Browser workflow smoke therefore uses sourced records matching normal F1 extraction output.

**Close when:** a separately approved serialization correction retains source-less manual records while preserving explicit source-message exclusion, with focused notebook/analysis contract verification. This is outside the authorized frozen-F1/layout change.

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
