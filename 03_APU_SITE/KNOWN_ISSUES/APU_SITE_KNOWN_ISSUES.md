# APU Site — Known Issues

Status: CURRENT

This file contains confirmed current defects or concrete verification gaps only. Product limitations and future capabilities belong in Backlog. Historical resolved defects belong in Changelog/checkpoints.

## RESOLUTION REFERENCES

### KI-02 — Manual Notebook serialization — RESOLVED in source (2026-10-14)
B1.9-R1 corrected the undefined/undefined exclusion comparison in `compactNotepad()`. Nonempty manual records, including source-less edits, now survive default serialization; explicit source-message exclusion remains exact. Typecheck and **249 focused provider-free/mocked regressions** passed, including actual F1 request boundaries, all three F2 canonical-need paths and immutable downstream source behavior. Native Windows, hosted/live-provider and production verification are not claimed. Historical defect and repair details are recorded in the [Changelog](../CHANGELOG/APU_SITE_CHANGELOG.md#2026-10-14--b19-r1-manual-notebook-serialization-repair).

## VERIFICATION GAPS

### KI-03 — Hosted Preview mutated; CI parser and complete binding equality remain unverified

**Status: OPEN.** GitHub independently confirms source `b266d4058bb7ca937d72ac2dcb834e631fbcabbc`, PR #60 OPEN/unmerged into `next` and run [39567377884](https://github.com/catsystemexe/APU_MS_site/actions/runs/39567377884) COMPLETED / CANCELLED. Its credential-bearing guard step failed with `upload_response_normalization / upload_json_invalid / returned`; the upload command returned and a mutation occurred according to the separate operator V3 evidence. The workflow did not PASS, and the parser failure does not establish its exact underlying stdout/format cause.

**Hosted evidence — operator-reported, not independently inspected through Cloudflare by Codex:** active Preview Version `764e8603-d50b-41c5-94b6-030edd77755d`, rollout `4b89c5c6-444c-440b-a7d3-1e737e5fdc16`, source `b266d4058bb7ca937d72ac2dcb834e631fbcabbc`, 100% allocation; both named and unique URL Access redirects PASS; production deployment/traffic preserved. Actual unique URL and separate Cloudflare inspection timestamp were not supplied in this batch. This supersedes the earlier no-hosted-mutation-evidence state, without closing the security/CI gap.

**Still missing:** supported stdout/JSON parsing and successful normalization/upload-read-back agreement; exact deployed `DEV_LOG_STATE` namespace ID and full effective binding equality. Binding names/types were verified by the operator, but their detailed listing was not supplied here; the historical expected dedicated KV `1729ce8a6acd4cdcbed8248ac543677b` is not fresh proof of the new Version's binding. Exact comparisons of `APU_LOCAL_DEV_AUTH`, `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` do not prove `APU_DEVELOPER_EMAILS`, whose exact effective value was not demonstrated. Access redirects alone do not prove KV isolation or developer roles. Raw subprocess/API/binding contents must not be logged to diagnose this gap.

**Historical evidence retained:** Run [39475401133](https://github.com/catsystemexe/APU_MS_site/actions/runs/39475401133) failed with `wrong_deployment_preview`; its old error does not prove the exact stage or upload-attempt state. Subsequent authenticated diagnostic [39494160174](https://github.com/catsystemexe/APU_MS_site/actions/runs/39494160174), source `6d3ebf5cec1b5f58bd4468cb9a2b3b1c4f277359`, confirms correct Preview ID/name and a Version-shaped latest result with exactly these typed keys: `annotations`, `assets`, `author_email`, `author_id`, `compatibility_date`, `compatibility_flags`, `created_on`, `env`, `id`, `main_module`, `number`, `source`, `startup_time_ms`, `urls`, `usage_model`. `preview_id`/`preview_name` are absent; Version ID is `ee7c9e97-f7cf-420f-ba55-e23d50688cbd`, distinct from rollout/inventory ID `7ed83603-ffb0-43ae-be75-ac66f65fac85`; only historical annotation key `workers/triggered_by` was exposed. The capture's payload-field relationship classification was `UNPROVABLE`, not a binding/source inspection.

Published repair `88e997911d0e1cb1460476216036988a1965224b` had Codex-reported local V2 **332/332 provider-free tests PASS** and skipped publication run `39500813016`; that local count is not asserted for run `39567377884` and was not rerun for this V1 documentation task. Historical missing source annotation support, strict optional target identifiers and the fixed Preview-before-scoped-Version trust boundary remain as documented in Runtime Technical Current; no provider-enforced Preview-only IAM isolation or atomic cross-call guarantee is claimed.

**Close when:** the real parser/output contract is safely evidenced and corrected under a separate approved repair, exact effective bindings including KV namespace and all four Access-related values are verified, and a separately authorized V3 guarded flow proves normalization, approved source/Preview identity, no unknown/inherited secrets, both Access protections, upload/read-back agreement and unchanged production. Preserve the actual prior CANCELLED/FAILURE result and record source/Version/rollout separately. Confirm disabled gates before any source publication; no retry/deployment is authorized here. `automaticDevUpdatesConfigured=false` and future deployment authorization false remain unchanged. A mutation, historical ENV-D3/B1/P2 evidence or mocked success alone cannot close KI-03.

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
