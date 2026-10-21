import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
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
  assert.deepEqual(validate(pr()), { event: 'pull_request', sourceBranch: 'dev', targetBranch: 'next', candidateSourceSha: source, testedCheckoutSha: merge, baseSha: base });
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
  ['wrong merge SHA', pr, f => f.event.pull_request.merge_commit_sha = base],
  ['malformed source SHA', pr, f => f.event.pull_request.head.sha = 'short'],
  ['missing base SHA', pr, f => delete f.event.pull_request.base.sha],
  ['unknown merge relationship', pr, f => f.checkout.parents = []],
  ['wrong merge parent order', pr, f => f.checkout.parents.reverse()],
  ['wrong source merge parent', pr, f => f.checkout.parents[1] = merge],
]) test(`context fails closed: ${name}`, () => {
  const f = structuredClone(fixture()); mutate(f); assert.throws(() => validate(f));
});
