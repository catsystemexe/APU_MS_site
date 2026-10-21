import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { validateReleaseContext } from '../ops/release/verify-context.mjs';

const yaml = createRequire(import.meta.url)('js-yaml'); // Existing locked dependency.
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const text = await read('.github/workflows/pilot-release-verification.yml');
const workflow = yaml.load(text);
const steps = workflow.jobs.verify.steps;
const source = 'a'.repeat(40), base = 'b'.repeat(40), merge = 'c'.repeat(40);
const repository = { full_name: 'catsystemexe/APU_MS_site' };
const push = () => ({ env: { GITHUB_REPOSITORY: repository.full_name, GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/dev', GITHUB_SHA: source },
  event: { repository, ref: 'refs/heads/dev', deleted: false, after: source, head_commit: { id: source } }, checkout: { head: source, parents: [base] } });
const pr = () => ({ env: { GITHUB_REPOSITORY: repository.full_name, GITHUB_EVENT_NAME: 'pull_request', GITHUB_REF: 'refs/pull/61/merge', GITHUB_SHA: merge },
  event: { repository, number: 61, action: 'synchronize', pull_request: { number: 61, state: 'open', merged: false,
    head: { repo: repository, ref: 'dev', sha: source }, base: { repo: repository, ref: 'next', sha: base }, merge_commit_sha: merge } },
  checkout: { head: merge, parents: [base, source] } });
const validate = f => validateReleaseContext(f.env, f.event, f.checkout);

test('only DEV pushes and next PR events trigger one read-only, non-environment job', () => {
  assert.deepEqual(Object.keys(workflow).sort(), ['jobs', 'name', 'on', 'permissions']);
  assert.deepEqual(workflow.on, { push: { branches: ['dev'] }, pull_request: { branches: ['next'], types: ['opened', 'synchronize', 'reopened'] } });
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.deepEqual(Object.keys(workflow.jobs), ['verify']);
  assert.deepEqual(Object.keys(workflow.jobs.verify).sort(), ['defaults', 'env', 'name', 'runs-on', 'steps', 'timeout-minutes']);
  assert.equal(workflow.jobs.verify['runs-on'], 'ubuntu-24.04');
  assert.deepEqual(workflow.jobs.verify.defaults, { run: { shell: 'bash' } });
  assert.deepEqual(workflow.jobs.verify.env, { CI: 'true', WRANGLER_SEND_METRICS: 'false', WRANGLER_WRITE_LOGS: 'false' });
  assert.doesNotMatch(text, /secrets\.|github\.token|vars\.|environment:|workflow_dispatch|pull_request_target|continue-on-error|always\(\)|curl|webhook|upload-artifact|download-artifact|--deploy|npm run deploy|wrangler (deploy|preview|versions)/i);
});
test('only reviewed pinned actions; exact checkout without persisted credentials', () => {
  assert.deepEqual(steps.filter(s => s.uses).map(s => s.uses), [
    'actions/checkout@11d5960a326750d5838078e36cf38b85af677262',
    'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020',
  ]);
  assert.deepEqual(steps[0].with, { ref: '${{ github.sha }}', 'fetch-depth': 2, 'persist-credentials': false });
  assert.deepEqual(steps[1].with, { 'node-version-file': 'ops/ci/.node-version' });
  assert.ok(steps.every(s => Object.keys(s).every(k => ['name', 'run', 'uses', 'with'].includes(k))));
});
test('fixed fail-fast commands validate provenance before dependency installation and never publish', () => {
  const commands = steps.filter(s => s.run).map(s => s.run.trim());
  assert.deepEqual(commands.slice(0, 5), ['node ops/release/verify-context.mjs', 'npm ci --ignore-scripts --no-audit --no-fund',
    'npm run typecheck', 'npm run build', 'npm run validate:artifact']);
  assert.equal(commands.length, 8);
  assert.deepEqual(commands[5].split(/\s+/), ['node', '--test',
    ...['pilot-release-verification', 'f1-response-contract', 'manual-notebook-context', 'notebook-ownership',
      'f2-build-model', 'f2-api-contract', 'f3-api-contract', 'f3-finalization-model', 'f3-generation-eligibility',
      'access-control', 'server-capabilities', 'deployment-config', 'dev-worker-preparation', 'dev-preview-ci',
      'e2e-preview-preparation', 'preview-metadata-capture'].map(n => `tests/${n}.test.mjs`)]);
  assert.deepEqual(commands.slice(6), ['node ops/dev/prepare-worker.mjs --check-template --target apu-ms-site-dev',
    'node ops/ci/dev-preview-guard.mjs --check-config']);
});
test('invoked npm scripts have no deployment lifecycle or provider credentials', async () => {
  const pkg = JSON.parse(await read('package.json'));
  for (const name of ['preinstall', 'install', 'postinstall', 'prepare', 'pretypecheck', 'posttypecheck', 'prebuild', 'postbuild', 'prevalidate:artifact', 'postvalidate:artifact']) assert.equal(pkg.scripts[name], undefined);
  assert.equal(pkg.scripts.typecheck, 'tsc --noEmit');
  assert.equal(pkg.scripts.build, 'bash scripts/build-verified.sh');
  assert.equal(pkg.scripts['validate:artifact'], 'bash scripts/validate-artifact.sh');
  for (const path of ['scripts/build-verified.sh', 'scripts/validate-artifact.sh', 'scripts/sites-env.sh', 'vite.config.ts']) {
    const script = await read(path);
    assert.doesNotMatch(script, /wrangler\s+(deploy|preview|versions)|npm run deploy|https?:\/\/api\.cloudflare\.com|deploy_hooks/i);
  }
});
test('valid push records equal source and tested SHAs', () => {
  assert.deepEqual(validate(push()), { event: 'push', sourceBranch: 'dev', candidateSourceSha: source, testedCheckoutSha: source });
});
test('valid PR records candidate separately from verified synthetic merge checkout', () => {
  assert.deepEqual(validate(pr()), { event: 'pull_request', sourceBranch: 'dev', targetBranch: 'next', candidateSourceSha: source, testedCheckoutSha: merge, baseSha: base, webhookMergeShaStatus: 'matches' });
});
// Synthetic webhook fixtures: none reconstructs the uncaptured run 39630801929 payload.
for (const [name, value, status] of [
  ['null', null, 'unavailable'], ['missing', undefined, 'unavailable'],
  ['stale', base, 'differs'], ['malformed diagnostic', 'not-a-sha', 'invalid'],
]) test(`verified merge accepts ${name} optional webhook merge SHA`, () => {
  const f = pr(); f.event.pull_request.merge_commit_sha = value;
  if (value === undefined) delete f.event.pull_request.merge_commit_sha;
  assert.deepEqual(validate(f), { event: 'pull_request', sourceBranch: 'dev', targetBranch: 'next',
    candidateSourceSha: source, testedCheckoutSha: merge, baseSha: base, webhookMergeShaStatus: status });
});
for (const [name, fixture, mutate] of [
  ['foreign runner repository', push, f => f.env.GITHUB_REPOSITORY = 'fork/APU_MS_site'],
  ['foreign payload repository', push, f => f.event.repository = { full_name: 'fork/APU_MS_site' }],
  ['unsupported event', push, f => f.env.GITHUB_EVENT_NAME = 'workflow_dispatch'],
  ['privileged PR event', pr, f => f.env.GITHUB_EVENT_NAME = 'pull_request_target'],
  ['production push', push, f => f.env.GITHUB_REF = f.event.ref = 'refs/heads/next'],
  ['deleted push', push, f => f.event.deleted = true],
  ['unproven deletion state', push, f => delete f.event.deleted],
  ['payload branch mismatch', push, f => f.event.ref = 'refs/heads/main'],
  ['payload source mismatch', push, f => f.event.after = base],
  ['missing head commit', push, f => delete f.event.head_commit],
  ['wrong head commit', push, f => f.event.head_commit.id = base],
  ['checkout mismatch', push, f => f.checkout.head = base],
  ['malformed SHA', push, f => f.env.GITHUB_SHA = 'A'.repeat(40)],
  ['zero SHA', push, f => f.env.GITHUB_SHA = f.checkout.head = '0'.repeat(40)],
  ['newline in SHA', push, f => f.env.GITHUB_SHA = f.checkout.head = source + '\n'],
  ['wrong PR source branch', pr, f => f.event.pull_request.head.ref = 'feature'],
  ['wrong PR target branch', pr, f => f.event.pull_request.base.ref = 'main'],
  ['fork PR', pr, f => f.event.pull_request.head.repo = { full_name: 'fork/APU_MS_site' }],
  ['foreign PR base', pr, f => f.event.pull_request.base.repo = { full_name: 'fork/APU_MS_site' }],
  ['closed PR', pr, f => f.event.pull_request.state = 'closed'],
  ['merged PR', pr, f => f.event.pull_request.merged = true],
  ['unsupported PR action', pr, f => f.event.action = 'closed'],
  ['invalid PR number', pr, f => f.event.number = -1],
  ['mismatched PR number', pr, f => f.event.pull_request.number = 62],
  ['head ref instead of merge', pr, f => f.env.GITHUB_REF = 'refs/heads/dev'],
  ['missing PR metadata', pr, f => delete f.event.pull_request],
  ['missing head metadata', pr, f => delete f.event.pull_request.head],
  ['missing base metadata', pr, f => delete f.event.pull_request.base],
  ['array PR metadata', pr, f => f.event.pull_request = []],
  ['PR checkout mismatch', pr, f => f.checkout.head = source],
  ['head-only checkout', pr, f => { f.env.GITHUB_SHA = f.checkout.head = source; f.event.pull_request.merge_commit_sha = source; f.checkout.parents = [base]; }],
  ['malformed source SHA', pr, f => f.event.pull_request.head.sha = 'short'],
  ['missing base SHA', pr, f => delete f.event.pull_request.base.sha],
  ['invalid base SHA', pr, f => f.event.pull_request.base.sha = '0'.repeat(40)],
  ['newline source SHA', pr, f => f.event.pull_request.head.sha = source + '\n'],
  ['unknown merge relationship', pr, f => f.checkout.parents = []],
  ['wrong merge parent order', pr, f => f.checkout.parents.reverse()],
  ['wrong base merge parent', pr, f => f.checkout.parents[0] = merge],
  ['wrong source merge parent', pr, f => f.checkout.parents[1] = merge],
  ['octopus merge', pr, f => f.checkout.parents.push(source)],
]) test(`context fails closed: ${name}`, () => {
  const f = structuredClone(fixture()); mutate(f); assert.throws(() => validate(f));
});

for (const [code, change] of [
  ['unsupported_event', f => f.env.GITHUB_EVENT_NAME = 'workflow_dispatch'],
  ['unsupported_pr_ref', f => f.env.GITHUB_REF = 'refs/heads/dev'],
  ['unsupported_repository', f => f.env.GITHUB_REPOSITORY = 'fork/APU_MS_site'],
  ['unsupported_pr_branches', f => f.event.pull_request.base.ref = 'main'],
  ['invalid_pr_source', f => f.event.pull_request.head.sha = 'invalid'],
  ['invalid_checkout_sha', f => f.env.GITHUB_SHA = 'invalid'],
  ['checkout_sha_mismatch', f => f.checkout.head = source],
  ['unproven_merge_source', f => f.checkout.parents.reverse()],
  ['unsupported_pr_metadata', f => delete f.event.pull_request],
]) test(`fixed diagnostic code: ${code}`, () => {
  const f = pr(); change(f); assert.throws(() => validate(f), { message: code });
});

test('CLI provenance and sanitized rejection use the real local HEAD without logging payloads', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'apu-provenance-'));
  try {
    const cwd = fileURLToPath(new URL('../', import.meta.url));
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
    const eventPath = join(directory, 'event.json'), summary = join(directory, 'summary.md');
    const payload = { repository, ref: 'refs/heads/dev', deleted: false, after: head, head_commit: { id: head }, private_canary: 'DO_NOT_LOG_PAYLOAD' };
    const env = { PATH: process.env.PATH, GITHUB_REPOSITORY: repository.full_name, GITHUB_EVENT_NAME: 'push',
      GITHUB_REF: 'refs/heads/dev', GITHUB_SHA: head, GITHUB_EVENT_PATH: eventPath, GITHUB_STEP_SUMMARY: summary };
    const invoke = () => spawnSync(process.execPath, ['ops/release/verify-context.mjs'], { cwd, env, encoding: 'utf8' });
    await writeFile(eventPath, JSON.stringify(payload));
    const success = invoke(); assert.equal(success.status, 0); assert.equal(success.stderr, '');
    assert.equal(JSON.parse(success.stdout).testedCheckoutSha, head); assert.match(await readFile(summary, 'utf8'), new RegExp(head));
    payload.ref = 'refs/heads/next'; await writeFile(eventPath, JSON.stringify(payload));
    const rejected = invoke(); assert.equal(rejected.status, 1); assert.equal(rejected.stdout, '');
    assert.deepEqual(JSON.parse(rejected.stderr), { error: 'release_context_rejected', cause: 'unsupported_push' });
    await writeFile(eventPath, 'invalid private payload');
    const malformed = invoke(); assert.equal(malformed.status, 1); assert.equal(malformed.stdout, '');
    assert.deepEqual(JSON.parse(malformed.stderr), { error: 'release_context_rejected', cause: 'release_metadata_unavailable' });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
