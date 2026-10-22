import { access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const FULL_TESTS = Object.freeze(['pilot-release-verification', 'f1-response-contract', 'manual-notebook-context',
  'notebook-ownership', 'f2-build-model', 'f2-api-contract', 'f3-api-contract', 'f3-finalization-model',
  'f3-generation-eligibility', 'access-control', 'server-capabilities', 'deployment-config',
  'dev-worker-preparation', 'dev-preview-ci', 'e2e-preview-preparation', 'preview-metadata-capture']);
export const BASELINE_TESTS = Object.freeze(['pilot-release-verification', 'f1-response-contract', 'f2-build-model',
  'f2-api-contract', 'f3-api-contract', 'f3-finalization-model', 'access-control', 'deployment-config']);
export const DEV_MARKERS = Object.freeze(['wrangler.dev.json', 'ops/dev/prepare-worker.mjs',
  'ops/ci/dev-preview-guard.mjs', 'tests/dev-worker-preparation.test.mjs', 'tests/dev-preview-ci.test.mjs',
  'tests/e2e-preview-preparation.test.mjs', 'tests/preview-metadata-capture.test.mjs']);
// The production branch has no DEV preparation code. Its smaller test inventory
// is valid only for these exact immutable source trees from b0162eb, never as a
// fallback for missing tests or an arbitrary future application revision.
export const PRODUCTION_BASELINE = Object.freeze({
  app: '3dd6e92597b316eba7417876441d0dc635096b53', worker: '4c481b94d14b7222aa9c56f34b442aca6dfbd2a4',
  'apu-core': '1f392edc73257b2307bc12c6c8600d4d3db61f7f', scripts: '9c016f10688646a2022387ba648074f6598ae40e',
  'package.json': '645446495b2831a666754295fa2689a0c8c0da22',
  'package-lock.json': '222c6d3d63b95d0c74a3696fe488907f1361ce5e',
  'wrangler.jsonc': '722c69bc336363bb6e5e92fdeaab1a29e8ad1bcf',
  'vite.config.ts': 'bf7d554c513c7f7d996dac8ee1f9cd9b9ac6a3d0',
  'tsconfig.json': '4ac5386477418c005c50f144917ccb6447fdc63e',
});

export function selectReleaseProfile(present, trees) {
  if (!DEV_MARKERS.every(path => typeof present[path] === 'boolean')) throw new Error('invalid_release_inventory');
  if (DEV_MARKERS.every(path => present[path])) return { name: 'full-dev', tests: FULL_TESTS };
  if (DEV_MARKERS.some(path => present[path])) throw new Error('partial_dev_inventory');
  if (!Object.entries(PRODUCTION_BASELINE).every(([path, hash]) => trees[path] === hash)) throw new Error('unsupported_production_baseline');
  return { name: 'immutable-production-baseline-b0162eb', tests: BASELINE_TESTS };
}

async function main() {
  if (process.argv.length !== 2) throw new Error('unsupported_release_arguments');
  const present = Object.fromEntries(await Promise.all(DEV_MARKERS.map(async path => {
    try { await access(path); return [path, true]; } catch (error) { if (error.code === 'ENOENT') return [path, false]; throw error; }
  })));
  const trees = {};
  if (DEV_MARKERS.every(path => !present[path])) for (const path of Object.keys(PRODUCTION_BASELINE)) {
    trees[path] = execFileSync('git', ['rev-parse', `HEAD:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  }
  const profile = selectReleaseProfile(present, trees);
  for (const name of profile.tests) await access(`tests/${name}.test.mjs`); // Missing mandatory tests fail closed.
  console.log(JSON.stringify({ verificationProfile: profile.name, testFiles: profile.tests.length }));
  execFileSync(process.execPath, ['--test', ...profile.tests.map(name => `tests/${name}.test.mjs`)], { stdio: 'inherit' });
  if (profile.name === 'full-dev') {
    execFileSync(process.execPath, ['ops/dev/prepare-worker.mjs', '--check-template', '--target', 'apu-ms-site-dev'], { stdio: 'inherit' });
    execFileSync(process.execPath, ['ops/ci/dev-preview-guard.mjs', '--check-config'], { stdio: 'inherit' });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('release_verification_failed'); process.exitCode = 1; });
}
