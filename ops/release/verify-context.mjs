import { readFile, appendFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const REPOSITORY = 'catsystemexe/APU_MS_site';
const sha = value => typeof value === 'string' && value.length === 40 && /^[a-f0-9]{40}$/.test(value) && value !== '0'.repeat(40);
class ReleaseContextFailure extends Error {}
const requireValue = (condition, code) => { if (!condition) throw new ReleaseContextFailure(code); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const MIGRATION_FILES = new Set([
  '.github/workflows/pilot-release-verification.yml', 'ops/release/verify-context.mjs',
  'ops/release/run-regressions.mjs', 'tests/pilot-release-verification.test.mjs',
  'ops/release/PILOT_RELEASE_RUNBOOK.md', '05_WORKFLOW/APU_PROJECT_RULES.md',
  '05_WORKFLOW/IMPLEMENTATION_ROLE.md', 'AGENTS.md',
]);

// Event fixtures in tests are synthetic GitHub contracts, not hosted evidence.
export function validateReleaseContext(env, event, checkout) {
  requireValue(env.GITHUB_REPOSITORY === REPOSITORY && event?.repository?.full_name === REPOSITORY, 'unsupported_repository');
  requireValue(sha(env.GITHUB_SHA), 'invalid_checkout_sha');
  requireValue(checkout?.head === env.GITHUB_SHA, 'checkout_sha_mismatch');
  if (env.GITHUB_EVENT_NAME === 'push') {
    requireValue(env.GITHUB_REF === 'refs/heads/dev' && event.ref === env.GITHUB_REF && event.deleted === false, 'unsupported_push');
    requireValue(event.after === env.GITHUB_SHA && event.head_commit?.id === env.GITHUB_SHA, 'push_source_mismatch');
    return { event: 'push', sourceBranch: 'dev', candidateSourceSha: env.GITHUB_SHA, testedCheckoutSha: checkout.head };
  }
  requireValue(env.GITHUB_EVENT_NAME === 'pull_request', 'unsupported_event');
  const pr = event.pull_request;
  requireValue(object(pr) && object(pr.head) && object(pr.base), 'unsupported_pr_metadata');
  requireValue(['opened', 'synchronize', 'reopened'].includes(event.action) && pr?.state === 'open' && pr.merged === false, 'unsupported_pr_state');
  requireValue(Number.isSafeInteger(event.number) && event.number > 0 && pr.number === event.number &&
    env.GITHUB_REF === `refs/pull/${event.number}/merge`, 'unsupported_pr_ref');
  requireValue(pr.head?.repo?.full_name === REPOSITORY && pr.base?.repo?.full_name === REPOSITORY, 'unsupported_pr_branches');
  const release = pr.head.ref === 'dev' && ['next', 'public'].includes(pr.base.ref);
  // Temporary, exact branch pairs for the two code-only migration PRs. Never
  // accept an arbitrary feature/fork PR or application changes via this path.
  const migration = (pr.head.ref === 'codex/production-branch-dev-compat' && pr.base.ref === 'dev') ||
    (pr.head.ref === 'codex/production-branch-compat' && ['next', 'public'].includes(pr.base.ref));
  // Development verification is separate from production release eligibility.
  // Reserve both exact migration names so they cannot bypass their scope guard.
  const development = pr.base.ref === 'dev' && typeof pr.head.ref === 'string' && pr.head.ref.length > 0 &&
    !['main', 'dev', 'next', 'public', 'codex/production-branch-dev-compat', 'codex/production-branch-compat'].includes(pr.head.ref);
  requireValue(release || migration || development, 'unsupported_pr_branches');
  requireValue(sha(pr.head.sha) && sha(pr.base.sha), 'invalid_pr_source');
  requireValue(Array.isArray(checkout.parents) && checkout.parents.length === 2 &&
    checkout.parents[0] === pr.base.sha && checkout.parents[1] === pr.head.sha, 'unproven_merge_source');
  if (migration) requireValue(Array.isArray(checkout.changedFiles) && checkout.changedFiles.length > 0 &&
    checkout.changedFiles.every(path => typeof path === 'string' && MIGRATION_FILES.has(path)), 'unsupported_migration_scope');
  // Actions defines GITHUB_SHA as the merge-ref commit. The nullable webhook
  // merge_commit_sha reflects asynchronous mergeability metadata; it is not an
  // additional checkout authority. Identity is proven by HEAD + both parents.
  const webhookMergeShaStatus = pr.merge_commit_sha == null ? 'unavailable' :
    !sha(pr.merge_commit_sha) ? 'invalid' : pr.merge_commit_sha === checkout.head ? 'matches' : 'differs';
  return { event: 'pull_request', sourceBranch: pr.head.ref, targetBranch: pr.base.ref,
    candidateSourceSha: pr.head.sha, testedCheckoutSha: checkout.head, baseSha: pr.base.sha, webhookMergeShaStatus,
    ...(migration ? { verificationScope: 'migration-only' } : development ? { verificationScope: 'development' } : {}) };
}

async function main() {
  let result;
  try {
    const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const git = args => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const head = git(['rev-parse', 'HEAD']), parents = git(['show', '-s', '--format=%P', 'HEAD']).split(' ');
    const changedFiles = process.env.GITHUB_EVENT_NAME === 'pull_request' && parents.length === 2 ?
      git(['diff', '--name-only', '--no-renames', parents[0], parents[1]]).split('\n').filter(Boolean) : undefined;
    result = validateReleaseContext(process.env, event, { head, parents, changedFiles });
  } catch (error) {
    // Never echo an event payload, subprocess output, environment or raw error.
    console.error(JSON.stringify({ error: 'release_context_rejected',
      cause: error instanceof ReleaseContextFailure ? error.message : 'release_metadata_unavailable' }));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(result));
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY,
      `Candidate source SHA: \`${result.candidateSourceSha}\`\n\nTested checkout SHA: \`${result.testedCheckoutSha}\`\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('release_provenance_record_failed'); process.exitCode = 1; });
}
