import { readFile, appendFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const REPOSITORY = 'catsystemexe/APU_MS_site';
const sha = value => typeof value === 'string' && value.length === 40 && /^[a-f0-9]{40}$/.test(value) && value !== '0'.repeat(40);
const requireValue = (condition, code) => { if (!condition) throw new Error(code); };

// Event fixtures in tests are synthetic GitHub contracts, not hosted evidence.
export function validateReleaseContext(env, event, checkout) {
  requireValue(env.GITHUB_REPOSITORY === REPOSITORY && event?.repository?.full_name === REPOSITORY, 'unsupported_repository');
  requireValue(sha(env.GITHUB_SHA) && checkout?.head === env.GITHUB_SHA, 'checkout_sha_mismatch');
  if (env.GITHUB_EVENT_NAME === 'push') {
    requireValue(env.GITHUB_REF === 'refs/heads/dev' && event.ref === env.GITHUB_REF && event.deleted === false, 'unsupported_push');
    requireValue(event.after === env.GITHUB_SHA && event.head_commit?.id === env.GITHUB_SHA, 'push_source_mismatch');
    return { event: 'push', sourceBranch: 'dev', candidateSourceSha: env.GITHUB_SHA, testedCheckoutSha: checkout.head };
  }
  requireValue(env.GITHUB_EVENT_NAME === 'pull_request', 'unsupported_event');
  const pr = event.pull_request;
  requireValue(['opened', 'synchronize', 'reopened'].includes(event.action) && pr?.state === 'open' && pr.merged === false, 'unsupported_pr_state');
  requireValue(Number.isSafeInteger(event.number) && event.number > 0 && pr.number === event.number &&
    env.GITHUB_REF === `refs/pull/${event.number}/merge`, 'unsupported_pr_ref');
  requireValue(pr.head?.repo?.full_name === REPOSITORY && pr.base?.repo?.full_name === REPOSITORY &&
    pr.head.ref === 'dev' && pr.base.ref === 'next', 'unsupported_pr_branches');
  requireValue(sha(pr.head.sha) && sha(pr.base.sha) && pr.merge_commit_sha === env.GITHUB_SHA, 'invalid_pr_source');
  requireValue(Array.isArray(checkout.parents) && checkout.parents.length === 2 &&
    checkout.parents[0] === pr.base.sha && checkout.parents[1] === pr.head.sha, 'unproven_merge_source');
  return { event: 'pull_request', sourceBranch: 'dev', targetBranch: 'next',
    candidateSourceSha: pr.head.sha, testedCheckoutSha: checkout.head, baseSha: pr.base.sha };
}

async function main() {
  let result;
  try {
    const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const git = args => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    result = validateReleaseContext(process.env, event, {
      head: git(['rev-parse', 'HEAD']), parents: git(['show', '-s', '--format=%P', 'HEAD']).split(' '),
    });
  } catch {
    // Never echo an event payload, subprocess output, environment or raw error.
    console.error('release_context_rejected');
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
