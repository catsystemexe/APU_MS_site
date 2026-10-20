# APU Site — Known Issues

Status: CURRENT

This file contains confirmed current defects or concrete verification gaps only. Product limitations and future capabilities belong in Backlog. Historical resolved defects belong in Changelog/checkpoints.

## RESOLUTION REFERENCES

### KI-02 — Manual Notebook serialization — RESOLVED in source (2026-10-14)
B1.9-R1 corrected the undefined/undefined exclusion comparison in `compactNotepad()`. Nonempty manual records, including source-less edits, now survive default serialization; explicit source-message exclusion remains exact. Typecheck and **249 focused provider-free/mocked regressions** passed, including actual F1 request boundaries, all three F2 canonical-need paths and immutable downstream source behavior. Native Windows, hosted/live-provider and production verification are not claimed. Historical defect and repair details are recorded in the [Changelog](../CHANGELOG/APU_SITE_CHANGELOG.md#2026-10-14--b19-r1-manual-notebook-serialization-repair).

## VERIFICATION GAPS

### KI-03 — DEV Preview Version schema evidenced; effective bindings and authorized update remain unverified

Run [39475401133](https://github.com/catsystemexe/APU_MS_site/actions/runs/39475401133) failed with `wrong_deployment_preview`; its old error does not prove the exact stage or upload-attempt state. Subsequent authenticated diagnostic [39494160174](https://github.com/catsystemexe/APU_MS_site/actions/runs/39494160174), source `6d3ebf5cec1b5f58bd4468cb9a2b3b1c4f277359`, confirms correct Preview ID/name and a Version-shaped latest result with exactly these typed keys: `annotations`, `assets`, `author_email`, `author_id`, `compatibility_date`, `compatibility_flags`, `created_on`, `env`, `id`, `main_module`, `number`, `source`, `startup_time_ms`, `urls`, `usage_model`. `preview_id`/`preview_name` are absent; Version ID is `ee7c9e97-f7cf-420f-ba55-e23d50688cbd`, distinct from rollout/inventory ID `7ed83603-ffb0-43ae-be75-ac66f65fac85`; only historical annotation key `workers/triggered_by` was exposed. The capture's payload-field relationship classification was `UNPROVABLE`, not a binding/source inspection.

**Status: OPEN.** ENV-D4-B2-LIVE-CONTRACT-REPAIR supports the captured outer Version schema with strict optional identifiers and authenticated fixed Preview-before-scoped-Version reads; **332/332 provider-free tests**, typecheck/build/artifact/config checks pass. Historical missing commit SHA is allowed, while new read-back must prove the exact approved source. Upload, Version and rollout IDs remain separate; target/source/exact URL correlation replaces unproven cross-model UUID equality. Scope association trusts Cloudflare routing and stable Preview identity across non-atomic checks; it does not invent absent identity fields or claim provider-enforced IAM isolation.

**Still missing:** actual captured `env` entries and URL values, supported future live POST/output semantics, new Version commit annotation and successful authenticated update/production preservation. Binding equality and URL allowlists remain strict; no unknown representation is transformed based only on `env: object`. Synthetic successful binding/upload fixtures are not live evidence. The repair is retained locally without push at the operator's request; no deployment/rerun is authorized.

**Close when:** remaining live binding/URL/source/response compatibility is evidenced and a separately authorized V3 hosted update proves exact approved source/Preview identity, isolated bindings/no inherited secrets, both Access protections, upload/read-back agreement and independently unchanged production deployment/traffic. Record run/source/Version/rollout identifiers separately and restore disabled gates. Diagnostic success, B1/P2 history and mocked success cannot close this gap. Automatic DEV updates remain unconfigured/unverified.

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
