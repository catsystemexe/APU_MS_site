# APU Site — Runtime & Technical Current

Status: CURRENT SOURCE/RUNTIME CONTRACT

Purpose: describe the current repository/runtime contract. Deployment state is recorded only when independently verified; this document must not infer production state from repository contents alone.

## Repository baseline
- Canonical repository: `catsystemexe/APU_MS_site`.
- Stable branch: `main`.
- Active development branch: `next`.
- Application identity: APU Site 0.1 / package name `apu-site-01`.
- Node requirement: `>=22.13.0`.
- Current stack: Next.js App Router + Vinext + Vite targeting a standalone Cloudflare Worker.

## Canonical commands
- `npm run install:ci` — bounded lockfile installation for CI-style environments.
- `npm run dev` — Vite/Vinext development server.
- `npm run dev:local` — explicit local development entrypoint.
- `npm run build` — build and validate the deployable standalone Worker artifact.
- `npm run validate:artifact` — validate an existing Worker artifact.
- `npm run typecheck` — TypeScript check without emit.
- `npm run lint` — repository lint command.
- `npm test` — build plus automated test suite.
- `npm run deploy` — deploy an already-built verified Worker artifact with Wrangler while preserving dashboard-managed values.

## Build / deploy contract
- Build output is produced under `dist/server` and `dist/client` according to the repository build pipeline.
- Repository verification must not imply deployment.
- Production deployment is a distinct operation and is not authorized merely because build/tests pass.
- Cloudflare is the hosted runtime/deployment platform; repository code owns the deployment contract while Cloudflare owns hosted runtime values.

## Authentication and access
- Cloudflare Access is the intended hosted authentication gate for the Worker.
- OpenAI-backed API requests additionally validate the Cloudflare Access JWT as defense in depth.
- Developer/tester behavior is derived from authenticated identity and configured developer allowlist rules.
- Local development may use an explicit development-only auth bypass; that bypass must never be enabled in hosted environments.

## Runtime configuration
Server/runtime configuration includes names such as:
- `OPENAI_API_KEY` — secret.
- `APU_VECTOR_STORE_ID` — secret.
- `CF_ACCESS_TEAM_DOMAIN` — Access configuration.
- `CF_ACCESS_AUD` — Access audience.
- `APU_DEVELOPER_EMAILS` — developer allowlist configuration.
- `GOOGLE_DRIVE_CLIENT_ID` — optional public Google OAuth client identifier where relevant.

Secret values must never be committed, logged, pasted into implementation prompts, or copied into project documentation. Hosted values remain managed by Cloudflare; local secret files remain local and Git-ignored.

## Product/runtime boundaries
- Pedagogical policy is owned by versioned APU Core.
- Technical context composition/routing belongs to the application runtime.
- F1/F2/F3 boundaries and `Zápisník → Rozbor → Výstup` data ownership remain invariant across hosting changes.
- Model/KB routing is runtime policy and must not silently change canonical data ownership.

## State / persistence
- User/session persistence must be documented according to verified implementation, not historical Sites assumptions.
- DEV LOG content is repository-backed; mutable DEV LOG overrides use the configured Cloudflare KV binding where deployed/configured.
- Preview and production runtime persistence/configuration are environment-specific and must be verified separately.

## DEV LOG
- Canonical feedback entries live under `data/dev-log/entries/*.md`.
- Cloudflare KV binding `DEV_LOG_STATE` stores mutable per-item overrides such as status, note, updatedAt and updatedBy.
- Missing or invalid overrides fall back safely to repository-backed values.
- Preview and production may use separate KV namespaces.

## Verification policy
- Use the minimum verification level required by the implementation batch.
- Available checks include typecheck, lint, build/artifact validation and tests.
- UI/layout/interaction work should include rendered visual verification when materially necessary and available.
- Successful repository checks are evidence of implementation verification, not evidence of production deployment.

## Deployment status
Do not encode a fixed “currently deployed” or “not deployed” statement here unless it has been verified against current Cloudflare state. Completion reports and changelog entries must distinguish implemented, verified, locally smoke-tested, tagged and deployed states.

## Documentation source model
- GitHub is canonical for code and project documentation.
- Google Drive is outside the mandatory development synchronization chain; it may remain archival or ad hoc but is not required by Codex for normal implementation.
- ChatGPT Project Sources are runtime copies of selected workflow documents and must be refreshed when those governing documents change.
