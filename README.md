# APU Site

A standalone Cloudflare Worker application built with Next.js App Router,
[Vinext](https://github.com/cloudflare/vinext), and Vite.

## Prerequisites

- Node.js `>=22.13.0`
- Linux with `flock`, `curl`, and GNU `timeout`

## Standalone Cloudflare lifecycle

`npm run build` produces the Worker server artifact under `dist/server` and
static assets under `dist/client`. `npm run deploy` is the canonical production
code-deploy command for Cloudflare's deploy stage: it uploads the already-built
`dist/server/index.js` entry with Wrangler bundling disabled and retains
dashboard-managed values with `--keep-vars`. Configure Cloudflare with Build
command `npm run build` and Deploy command `npm run deploy`; the deploy stage
must receive the build stage's `dist` artifact. Repository verification uses
only a dry run and does not deploy the Worker.

Cloudflare Access is the intended authentication gate for the complete Worker.
The application independently validates `Cf-Access-Jwt-Assertion` on every
OpenAI-backed API request as defense in depth.

`install:ci` is intentionally a single, non-retrying `npm ci`. It refuses a concurrent install for the same project, consumes a matching image-seeded npm cache with `--prefer-offline` while retaining registry fallback for a missing cache object, otherwise downloads and verifies the complete vinext tarball recorded in `package-lock.json`, limits npm to one socket, and terminates a stalled install. `build` applies a short timeout and then validates the standalone Worker artifact. These helpers target Linux and use GNU `timeout`; they are not native macOS scripts.

Scripts that need writable project-scoped home, npm, XDG, and temporary paths use `scripts/sites-env.sh`. The `dev` and `start` scripts honor the caller's runtime environment and keep Wrangler logs inside the checkout. The generated `.sites-runtime/` directory is disposable and ignored by Git.

## Runtime configuration

- `OPENAI_API_KEY`: Cloudflare-managed secret; server-only OpenAI credential
- `APU_VECTOR_STORE_ID`: Cloudflare-managed secret; server-only vector store identifier
- `CF_ACCESS_TEAM_DOMAIN`: Cloudflare-managed plain-text variable; Access team domain, with or without `https://`
- `CF_ACCESS_AUD`: Cloudflare-managed plain-text variable; Access application audience
- `APU_DEVELOPER_EMAILS`: Cloudflare-managed plain-text variable; comma-separated developer email allowlist
- `GOOGLE_DRIVE_CLIENT_ID`: optional public Google OAuth client identifier

Do not commit runtime values. Configure the two credentials with `wrangler
secret put` (or the Cloudflare dashboard) and configure the three Access values
as variables on the actively deployed Worker once. They deliberately are not
duplicated in `wrangler.jsonc`: `keep_vars` in both the configuration and the
canonical deploy command carries the dashboard-owned values into each new code
version. Missing Access issuer/audience configuration fails closed.

Previously, a code upload that did not preserve variables could create and
activate a Worker version without the Access values. Re-adding values in the
dashboard afterward created another version, which still needed a separate
deployment before it became active. The canonical command now performs an
immediate code deployment while retaining the variables and secrets already on
the active Worker, so repeated deploys do not require a post-deploy dashboard
edit or manual version activation. Cloudflare remains the single owner of all
runtime values; the repository owns only the deployment policy.

For explicit local development only, `npm run dev:local` sets
`APU_LOCAL_DEV_AUTH=1`. The bypass is also restricted to
`NODE_ENV=development` and must not be configured in hosted environments.

## Shared Feedback roadmap

The developer-only DEV LOG reads the versioned Shared Feedback contract from
`data/shared-feedback.json`. Version 1 is a read-only repository-backed layer
outside the canonical Zápisník → Rozbor → Výstup workflow. Its records contain
`id`, stable `type` and `status` enums, `title`, ISO `createdAt`, `source`,
`summary`, an ordered array of generic `{ label, text }` details, and `note`.
Runtime parsing fails safely inside the DEV LOG if the contract is invalid.

Server-side persistence, status editing, and developer-note editing remain
pending. Deployment and live verification of this batch are not authorized.

## Access roles

`app/access-auth.ts` verifies the Access JWT signature against the team JWKS,
issuer, audience, lifetime, and authenticated email. Emails listed in
`APU_DEVELOPER_EMAILS` receive the `developer` role; every other identity admitted
by the Cloudflare Access policy receives the `tester` role. Developer diagnostics
are omitted from tester API responses and UI.

The repository is deployment-ready, not deployed. Before production use, enable
Worker-level Access protection, configure its allow policy, and ensure that
workers.dev and preview URLs cannot bypass Access.

## Diagnostic Commands

- `npm run install:ci`: perform the one bounded lockfile install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build and validate the deployable standalone Worker artifact
- `npm run deploy`: deploy the existing verified build artifact without rebuilding, while retaining Cloudflare-managed runtime values
- `npm run start`: start the built Vinext application
- `npm test`: build, validate, and verify the rendered development-preview metadata
- `npm run validate:artifact`: recheck an existing Worker's ESM `default.fetch` export
- `npm run db:generate`: generate Drizzle migrations after schema changes

Use build and validation commands for targeted diagnosis after a remote failure, not as part of the normal checkpoint path.

The timeout defaults can be overridden for a controlled canary with `SITES_INSTALL_TIMEOUT`, `SITES_INSTALL_KILL_AFTER`, `SITES_BUILD_TIMEOUT`, and `SITES_BUILD_KILL_AFTER`. A timeout fails the command; the helpers never retry an unchanged install or build.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
