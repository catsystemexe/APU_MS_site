// Explicit T5 variant. Does not weaken prepare-worker, execute commands, provision or read secrets.
import { readFileSync, writeFileSync, readdirSync, lstatSync, realpathSync, statSync } from 'node:fs';
import { resolve, dirname, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, createHmac } from 'node:crypto';
import { isDeepStrictEqual as same } from 'node:util';
import Ajv from 'ajv';
import { DEV, buildDevConfig } from './prepare-worker.mjs';
import { T5, privatePath } from '../../scripts/telemetry/t5-evidence.mjs';
const validateConfig = new Ajv({ allErrors:true, jsonPointers:true }).compile(JSON.parse(readFileSync(new URL('../../node_modules/wrangler/config-schema.json',import.meta.url),'utf8')));
const check = (ok, code) => { if (!ok) throw Error(code); };
const obj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const hash = v => createHash('sha256').update(typeof v === 'string' || Buffer.isBuffer(v) ? v : JSON.stringify(v)).digest('hex');
const BASE_VARS = ['APU_LOCAL_DEV_AUTH', 'CF_ACCESS_TEAM_DOMAIN', 'CF_ACCESS_AUD', 'APU_DEVELOPER_EMAILS', 'PILOT_RULES_RECEIPT_TTL_SECONDS'];
export const T5_VARS = ['APU_TELEMETRY_ENABLED', 'APU_TELEMETRY_METADATA_ENABLED', 'APU_TELEMETRY_ENV', 'APU_TELEMETRY_HOSTNAME', 'APU_TELEMETRY_SYNTHETIC', 'APU_TELEMETRY_PRIVACY_APPROVED', 'APU_TELEMETRY_COHORT', 'APU_TELEMETRY_KEY_VERSION', 'APU_TELEMETRY_NOTICE_VERSION', 'APU_TELEMETRY_NOTICE_TEXT', 'APU_TELEMETRY_ELIGIBLE', 'APU_T5_TRACE_ENABLED', 'APU_T5_TRACE_COHORT'];
const PROVIDER = ['APU_VECTOR_STORE_ID', 'OPENAI_API_KEY'];
const TEMP_KEYS = ['TELEMETRY_CONTEXT_KEY', 'TELEMETRY_PSEUDONYM_KEY'];
function keys(v, allowed) { check(obj(v) && Object.keys(v).every(k => allowed.includes(k)), 'BLOCKED_UNEXPECTED_FIELDS'); }
export function activeVersion(deployments) {
  check(Array.isArray(deployments) && deployments.length > 0, 'BLOCKED_DEPLOYMENT_SHAPE');
  const sorted = [...deployments].sort((a,b) => Date.parse(b.created_on) - Date.parse(a.created_on)), latest = sorted[0];
  check(Number.isFinite(Date.parse(latest.created_on)) && (sorted.length === 1 || latest.created_on !== sorted[1].created_on), 'BLOCKED_DEPLOYMENT_AMBIGUOUS');
  check(Array.isArray(latest.versions) && latest.versions.length === 1 && latest.versions[0].percentage === 100, 'BLOCKED_TRAFFIC');
  return latest.versions[0].version_id;
}
function normalizeD1(binding, expectedId) {
  check(Object.keys(binding).every(k => ['name','type','id','database_id'].includes(k)), 'BLOCKED_D1_BINDING_SCHEMA');
  const present=['id','database_id'].filter(k => Object.hasOwn(binding,k));
  const uuid=v => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
  check(present.length > 0 && present.every(k => uuid(binding[k])) && uuid(expectedId), 'BLOCKED_D1_BINDING_ID');
  check(present.length !== 2 || binding.id === binding.database_id, 'BLOCKED_D1_BINDING_CONFLICT');
  const id=binding[present[0]];
  check(id === expectedId, 'BLOCKED_D1_BINDING_TARGET');
  // Comparison view only: raw metadata remains untouched for hashes/freshness.
  return {name:binding.name,type:'d1',id};
}
function bindingMap(version, databaseId) {
  check(obj(version?.resources?.script_runtime) && Array.isArray(version.resources.bindings), 'BLOCKED_VERSION_SHAPE');
  const out = new Map();
  for (const b of version.resources.bindings) {
    check(obj(b) && typeof b.name === 'string' && !out.has(b.name), 'BLOCKED_BINDING_SHAPE');
    if (b.type === 'plain_text') { keys(b, ['name','type','text']); check(typeof b.text === 'string' && [...BASE_VARS, ...T5_VARS].includes(b.name), 'BLOCKED_UNEXPECTED_BINDING'); }
    else if (b.type === 'secret_text') { keys(b, ['name','type']); check([...PROVIDER, ...TEMP_KEYS].includes(b.name), 'BLOCKED_UNEXPECTED_SECRET'); }
    else if (b.type === 'kv_namespace') { keys(b, ['name','type','namespace_id']); check(['DEV_LOG_STATE','PILOT_RULES_ACCEPTANCE'].includes(b.name), 'BLOCKED_UNEXPECTED_KV'); }
    else if (b.type === 'd1') { check(b.name === 'TELEMETRY_DB', 'BLOCKED_UNEXPECTED_D1'); out.set(b.name,normalizeD1(b,databaseId)); continue; }
    else if (b.type === 'assets') { keys(b, ['name','type']); check(b.name === 'ASSETS', 'BLOCKED_UNEXPECTED_ASSETS'); }
    else throw Error('BLOCKED_UNSUPPORTED_BINDING');
    out.set(b.name, b);
  }
  return out;
}
function routing(record) {
  check(same(record.subdomain,{enabled:true,previews_enabled:false}) && same(record.routes,[]) && same(record.domains,[]) && same(record.schedules,[]), 'BLOCKED_ROUTING_OR_TRIGGERS');
}
export function verifyBaselineGuard(record, original, now = Date.now(), restored = false) {
  check(record.account_id === DEV.account && record.worker === DEV.worker && record.current?.id === T5.baseline && activeVersion(record.deployments) === T5.baseline, 'BLOCKED_BASELINE_TARGET');
  check(Number.isSafeInteger(record.read_at) && record.read_at <= now + 5000 && now-record.read_at <= 60000, 'BLOCKED_STALE_READBACK');
  check(same(record.current,original.version) && (restored || same(record.latest,original.latest)) && same(record.settings,original.settings) && same(record.current_assets,original.assets) && same(record.d1,original.d1), 'BLOCKED_BASELINE_CHANGED');
  routing(record); return {status:restored?'RUNTIME_RESTORED_READBACK_VERIFIED_NOT_RECONCILIATION_PASS':'BASELINE_GUARD_VERIFIED'};
}
export function buildT5Configs(baseline, inputs, proposal, template, artifact, artifactRoot, sourceSha) {
  check(baseline?.kind === 'apu-t5-baseline' && baseline.account_id === DEV.account && baseline.worker === DEV.worker && baseline.version?.id === T5.baseline && same(baseline.current,baseline.version) && activeVersion(baseline.deployments) === T5.baseline, 'BLOCKED_BASELINE_TARGET');
  check(baseline.d1?.uuid === inputs?.telemetry?.databaseId && baseline.d1?.name === T5.database && baseline.d1?.jurisdiction === 'eu', 'BLOCKED_D1_IDENTITY');
  check(inputs.telemetry?.enabled === false && inputs.telemetry.staged === true && inputs.pilotRules?.ttlSeconds === 86400, 'BLOCKED_STRICT_STAGE_INPUTS');
  check(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(baseline.latest?.id), 'BLOCKED_LATEST_VERSION');
  const base = buildDevConfig(template, artifact, inputs), bindings = bindingMap(baseline.version,inputs.telemetry.databaseId), latest = bindingMap(baseline.latest,inputs.telemetry.databaseId);
  for (const [name, expected] of [['DEV_LOG_STATE', { name:'DEV_LOG_STATE', type:'kv_namespace', namespace_id:inputs.kvNamespaceId }], ['PILOT_RULES_ACCEPTANCE', { name:'PILOT_RULES_ACCEPTANCE', type:'kv_namespace', namespace_id:inputs.pilotRules.namespaceId }], ['TELEMETRY_DB', { name:'TELEMETRY_DB', type:'d1', id:inputs.telemetry.databaseId }], ['ASSETS',{ name:'ASSETS',type:'assets' }], ...PROVIDER.map(name => [name,{name,type:'secret_text'}])]) {
    check(same(bindings.get(name), expected) && same(latest.get(name), expected), 'BLOCKED_RESOURCE_SUBSTITUTION');
  }
  check([...bindings.values()].filter(b => b.type === 'secret_text').length === PROVIDER.length && [...latest.values()].filter(b => b.type === 'secret_text').length === PROVIDER.length, 'BLOCKED_STALE_TELEMETRY_SECRETS');
  for (const name of [...BASE_VARS, 'APU_TELEMETRY_ENABLED', 'APU_TELEMETRY_METADATA_ENABLED']) check(bindings.get(name)?.type === 'plain_text', 'BLOCKED_MISSING_BINDING');
  const vars = Object.fromEntries([...bindings.values()].filter(b => b.type === 'plain_text').map(b => [b.name,b.text]));
  check(vars.APU_LOCAL_DEV_AUTH === '0' && vars.APU_DEVELOPER_EMAILS === DEV.operator && vars.PILOT_RULES_RECEIPT_TTL_SECONDS === '86400' && vars.APU_TELEMETRY_ENABLED === '0' && vars.APU_TELEMETRY_METADATA_ENABLED === '0', 'BLOCKED_BASELINE_FLAGS');
  check(vars.CF_ACCESS_TEAM_DOMAIN === inputs.accessTeamDomain && vars.CF_ACCESS_AUD === inputs.accessAudience, 'BLOCKED_ACCESS_SUBSTITUTION');
  routing(baseline);
  const runtime = baseline.version.resources.script_runtime;
  check(runtime.compatibility_date === base.compatibility_date && same(runtime.compatibility_flags, base.compatibility_flags), 'BLOCKED_RUNTIME_COMPATIBILITY');
  // Standard deploy inherits secrets from the last upload, not the active deployment.
  // Validate that source independently; never require identical version IDs/code/metadata.
  check(baseline.latest.resources.script_runtime.compatibility_date === runtime.compatibility_date && same(baseline.latest.resources.script_runtime.compatibility_flags, runtime.compatibility_flags), 'BLOCKED_LATEST_RUNTIME_COMPATIBILITY');
  keys(baseline.settings, ['observability','logpush','placement','tail_consumers','streaming_tail_consumers','limits','cache']);
  check(obj(baseline.settings.observability) && typeof baseline.settings.observability.enabled === 'boolean', 'BLOCKED_MISSING_RUNTIME_SETTINGS');
  check(obj(baseline.assets) && baseline.assets.not_found_handling === 'none', 'BLOCKED_ASSET_SETTINGS');
  keys(baseline.assets, ['not_found_handling','html_handling','run_worker_first','base_path']);
  check(isAbsolute(artifactRoot) && realpathSync(artifactRoot) === artifactRoot && /^[a-f0-9]{40}$/.test(sourceSha), 'BLOCKED_ARTIFACT_SOURCE');
  check(proposal?.kind === 'apu-t5-overlay-PROPOSAL-NOT-A-DEPLOYMENT-CONFIG' && proposal.worker === DEV.worker && proposal.baseline === T5.baseline && /^t5_\d{8}_[a-f0-9]{8}$/.test(proposal.cohort), 'BLOCKED_PROPOSAL');
  check(obj(proposal.secrets) && same(Object.keys(proposal.secrets).sort(), TEMP_KEYS) && Object.values(proposal.secrets).every(k => typeof k === 'string' && /^[a-zA-Z0-9_-]{43}$/.test(k)) && new Set(Object.values(proposal.secrets)).size === 2, 'BLOCKED_TEMP_KEYS');
  const participant = createHmac('sha256', proposal.secrets.TELEMETRY_PSEUDONYM_KEY).update(proposal.cohort + '\0' + DEV.operator).digest('base64url');
  check(proposal.participant === participant && proposal.vars.APU_TELEMETRY_ELIGIBLE === participant && proposal.vars.APU_TELEMETRY_COHORT === proposal.cohort, 'BLOCKED_ENROLLMENT');
  keys(proposal.vars, ['APU_DEVELOPER_EMAILS', ...T5_VARS]);
  check(proposal.vars.APU_DEVELOPER_EMAILS === '' && proposal.vars.APU_TELEMETRY_ENABLED === '1' && proposal.vars.APU_TELEMETRY_METADATA_ENABLED === '0' && proposal.vars.APU_TELEMETRY_SYNTHETIC === '0' && proposal.vars.APU_TELEMETRY_PRIVACY_APPROVED === '1' && proposal.vars.APU_TELEMETRY_ENV === 'dev' && proposal.vars.APU_TELEMETRY_HOSTNAME === 'apu-ms-site-dev.catsystem-exe.workers.dev' && proposal.vars.APU_TELEMETRY_NOTICE_VERSION === 't5-v1' && proposal.vars.APU_TELEMETRY_KEY_VERSION === 't5-v1' && typeof proposal.vars.APU_TELEMETRY_NOTICE_TEXT === 'string' && proposal.vars.APU_TELEMETRY_NOTICE_TEXT.length > 0 && proposal.vars.APU_TELEMETRY_NOTICE_TEXT.length <= 1000, 'BLOCKED_PROPOSAL_FLAGS');
  const common = { ...base, ...structuredClone(baseline.settings), keep_vars:true, main:join(artifactRoot,'server/index.js'), base_dir:join(artifactRoot,'server'), assets:{ directory:join(artifactRoot,'client'), binding:'ASSETS', ...baseline.assets }, send_metrics:false };
  common.d1_databases[0].migrations_dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../telemetry/migrations');
  const stageDefaults = Object.fromEntries(T5_VARS.map(k => [k, vars[k] ?? '']));
  const staged = { ...common, vars:{ ...vars, ...stageDefaults, APU_T5_TRACE_ENABLED:'0', APU_T5_TRACE_COHORT:'', APU_TELEMETRY_ENABLED:'0', APU_TELEMETRY_METADATA_ENABLED:'0' }, secrets:{ required:PROVIDER } };
  const enabled = { ...common, vars:{ ...vars, ...proposal.vars, APU_T5_TRACE_ENABLED:'1', APU_T5_TRACE_COHORT:proposal.cohort }, secrets:{ required:[...PROVIDER,...TEMP_KEYS] } };
  check(validateConfig(staged) && validateConfig(enabled), 'BLOCKED_WRANGLER_CONFIG_SCHEMA');
  const changed = Object.keys(enabled.vars).filter(k => enabled.vars[k] !== vars[k]);
  check(changed.every(k => k === 'APU_DEVELOPER_EMAILS' || T5_VARS.includes(k)), 'BLOCKED_UNAUTHORIZED_DELTA');
  // Review artifact contains hashes, never resource UUIDs, Access values, email, enrollment or key material.
  const review = { kind:'apu-t5-config-review', baseline:T5.baseline, latest_upload:{version_id:baseline.latest.id,sha256:hash(baseline.latest),differs_from_active:baseline.latest.id !== T5.baseline}, source_sha:sourceSha, staged_sha256:hash(staged), enabled_sha256:hash(enabled),
    preserved_bindings:baseline.version.resources.bindings.filter(b => b.type !== 'plain_text').map(b => ({name:b.name,type:b.type,identity_sha256:hash(b)})),
    preserved_vars:BASE_VARS.filter(k => k !== 'APU_DEVELOPER_EMAILS').map(name => ({name,sha256:hash(vars[name])})), changed_vars:changed,
    settings_sha256:hash(baseline.settings), assets_sha256:hash(baseline.assets), inherited_provider_secret_names:PROVIDER, new_secret_names:TEMP_KEYS, telemetry_secrets_sha256:hash(proposal.secrets), secrets_preservation:'Wrangler keepSecrets + required inherit bindings without version_id: previous/latest upload, independently validated and freshness guarded; provider plaintext not retrieved or supplied' };
  return { staged, enabled, review, telemetrySecrets:structuredClone(proposal.secrets) };
}
export function guardDeployment(deployments, expected, readAt, now=Date.now()) {
  check(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(expected) && readAt<=now+1000 && now-readAt<=15000,'BLOCKED_RESTORE_GUARD_FRESHNESS');
  const current=activeVersion(deployments); check(current === expected || current === T5.baseline,'BLOCKED_FOREIGN_DEPLOYMENT');
  return {status:current === T5.baseline?'ALREADY_BASELINE_READBACK_REQUIRED':'EXCLUSIVE_T5_VERSION_GUARD_VERIFIED'};
}
export function futureT5Command(mode, config, secrets, sourceSha) {
  check(/^[a-f0-9]{40}$/.test(sourceSha) && ['staged','enabled'].includes(mode) && isAbsolute(config) && (mode !== 'enabled' || isAbsolute(secrets)), 'BLOCKED_DEPLOY_ARGUMENTS');
  return ['deploy','--config',config,'--name',DEV.worker,'--keep-vars','--strict','--tag','t5-r2-'+sourceSha,'--experimental-provision=false','--experimental-auto-create=false', ...(mode === 'enabled' ? ['--secrets-file',secrets] : [])];
}
export function verifyT5Readback(record, config, sourceSha, expectedId, now = Date.now()) {
  check(record.account_id === DEV.account && record.worker === DEV.worker && record.current?.id === expectedId && same(record.latest,record.current) && activeVersion(record.deployments) === expectedId, 'BLOCKED_CANDIDATE_TARGET');
  check(Number.isSafeInteger(record.read_at) && record.read_at <= now + 5000 && now - record.read_at <= 60000, 'BLOCKED_STALE_READBACK');
  check(record.current.annotations?.['workers/tag'] === 't5-r2-'+sourceSha, 'BLOCKED_CANDIDATE_SOURCE_TAG');
  routing(record);
  const map=bindingMap(record.current,config.d1_databases?.find(d=>d.binding === 'TELEMETRY_DB')?.database_id), vars=Object.fromEntries([...map.values()].filter(b => b.type === 'plain_text').map(b=>[b.name,b.text]));
  check(same(vars,config.vars),'BLOCKED_CANDIDATE_FLAGS');
  const expectedBindings=[...config.kv_namespaces.map(k=>({name:k.binding,type:'kv_namespace',namespace_id:k.id})),...config.d1_databases.map(d=>({name:d.binding,type:'d1',id:d.database_id})),{name:'ASSETS',type:'assets'},...config.secrets.required.map(name=>({name,type:'secret_text'}))];
  const actual=[...map.values()].filter(b=>b.type !== 'plain_text').sort((a,b)=>a.name.localeCompare(b.name));
  check(same(actual,expectedBindings.sort((a,b)=>a.name.localeCompare(b.name))), 'BLOCKED_CANDIDATE_BINDINGS');
  const runtime=record.current.resources.script_runtime;
  check(runtime.compatibility_date === config.compatibility_date && same(runtime.compatibility_flags,config.compatibility_flags),'BLOCKED_CANDIDATE_RUNTIME');
  const expectedSettings=Object.fromEntries(['observability','logpush','placement','tail_consumers','streaming_tail_consumers','limits','cache'].filter(k=>Object.hasOwn(config,k)).map(k=>[k,config[k]]));
  check(same(expectedSettings,record.settings) && same(record.current_assets, Object.fromEntries(Object.entries(config.assets).filter(([k])=>!['directory','binding'].includes(k)))), 'BLOCKED_CANDIDATE_SETTINGS');
  return {status:'CANDIDATE_CONFIG_VERIFIED_NOT_PROVIDER_PASS',version:expectedId,telemetry:vars.APU_TELEMETRY_ENABLED,metadata:vars.APU_TELEMETRY_METADATA_ENABLED,trace:vars.APU_T5_TRACE_ENABLED};
}
function artifactHashes(dir) {
  const out = {};
  const walk = (root, prefix = '') => { for (const item of readdirSync(root).sort()) { const p=join(root,item), rel=prefix+item, st=lstatSync(p); if(rel === 't5-build.json') continue; check(!st.isSymbolicLink(), 'BLOCKED_ARTIFACT_SYMLINK'); if(st.isDirectory()) walk(p,rel+'/'); else if(st.isFile()) out[rel]=hash(readFileSync(p)); } };
  walk(dir); check(out['server/index.js'] && out['server/wrangler.json'] && Object.keys(out).some(k => k.startsWith('client/')), 'BLOCKED_ARTIFACT_INCOMPLETE'); return out;
}
function cleanSource(execFileSync,root,sha) {
  check(execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim() === sha && !execFileSync('git',['-C',root,'status','--porcelain','--untracked-files=all'],{encoding:'utf8'}).split('\n').filter(s=>s && s !== '?? tsconfig.tsbuildinfo').length, 'BLOCKED_BUILD_SOURCE');
}
async function main(a) {
  if(a[0] === '--guard-deployment' && a.length === 4) {
    privatePath(a[1],a[3]);console.log(JSON.stringify(guardDeployment(JSON.parse(readFileSync(a[1])),a[2],statSync(a[1]).mtimeMs)));return;
  }
  if(['--guard-baseline','--verify-restore'].includes(a[0]) && a.length === 4) {
    for(const p of a.slice(1,3)) privatePath(p,a[3]);
    console.log(JSON.stringify(verifyBaselineGuard(...a.slice(1,3).map(p=>JSON.parse(readFileSync(p))),Date.now(),a[0] === '--verify-restore'))); return;
  }
  if(a[0] === '--verify' && a.length === 6) {
    const [recordPath,configPath,sha,expected,repo]=a.slice(1); for(const p of [recordPath,configPath]) privatePath(p,repo);
    console.log(JSON.stringify(verifyT5Readback(JSON.parse(readFileSync(recordPath)),JSON.parse(readFileSync(configPath)),sha,expected))); return;
  }
  if(a[0] === '--plan' && a.length === 4) {
    const [mode,out,repo]=a.slice(1); privatePath(out,repo,true); check(['staged','enabled'].includes(mode),'BLOCKED_DEPLOY_ARGUMENTS');
    const cfg=join(out,'t5-'+mode+'.wrangler.json'), secret=join(out,'t5-telemetry-secrets.json'), review=JSON.parse(readFileSync(join(out,'t5-config-review.json')));
    check(hash(JSON.parse(readFileSync(cfg))) === review[mode === 'staged' ? 'staged_sha256':'enabled_sha256'], 'BLOCKED_CONFIG_CHANGED');
    check(same(artifactHashes(join(repo,'dist')),review.artifact_hashes),'BLOCKED_STALE_ARTIFACT');
    if(mode === 'enabled') {
      const keys=JSON.parse(readFileSync(secret)), config=JSON.parse(readFileSync(cfg));
      check(hash(keys) === review.telemetry_secrets_sha256 && same(Object.keys(keys).sort(),TEMP_KEYS) && Object.values(keys).every(k=>typeof k === 'string' && /^[a-zA-Z0-9_-]{43}$/.test(k)) && new Set(Object.values(keys)).size === 2 && createHmac('sha256',keys.TELEMETRY_PSEUDONYM_KEY).update(config.vars.APU_TELEMETRY_COHORT+'\0'+DEV.operator).digest('base64url') === config.vars.APU_TELEMETRY_ELIGIBLE,'BLOCKED_TEMP_KEYS');
    }
    const {execFileSync}=await import('node:child_process'); cleanSource(execFileSync,repo,review.source_sha);
    console.log(JSON.stringify(futureT5Command(mode,cfg,secret,review.source_sha))); return;
  }
  if(a[0] === '--build' && a.length === 3) {
    const root=realpathSync(a[1]), sha=a[2], {execFileSync}=await import('node:child_process');
    check(/^[a-f0-9]{40}$/.test(sha),'BLOCKED_BUILD_SOURCE'); cleanSource(execFileSync,root,sha);
    execFileSync('bash',['scripts/build-verified.sh'],{cwd:root,stdio:'inherit',timeout:240000});
    cleanSource(execFileSync,root,sha);
    writeFileSync(join(root,'dist/t5-build.json'), JSON.stringify({kind:'apu-t5-build',source_sha:sha,artifact_hashes:artifactHashes(join(root,'dist'))})+'\n'); return;
  }
  check(a.length === 7 && a[0] === '--prepare', 'BLOCKED_PREPARATION_ARGUMENTS');
  const [baselinePath,inputPath,proposalPath,out,sourceSha,repo] = a.slice(1);
  for(const p of [baselinePath,inputPath,proposalPath]) privatePath(p,repo); privatePath(out,repo,true);
  const root=realpathSync(repo), artifactRoot=join(root,'dist'), artifact=JSON.parse(readFileSync(join(artifactRoot,'server/wrangler.json'),'utf8'));
  const { execFileSync } = await import('node:child_process');
  cleanSource(execFileSync,root,sourceSha);
  const baseline=JSON.parse(readFileSync(baselinePath,'utf8')), inputs=JSON.parse(readFileSync(inputPath,'utf8')), proposal=JSON.parse(readFileSync(proposalPath,'utf8'));
  const result=buildT5Configs(baseline,inputs,proposal,JSON.parse(readFileSync(join(root,'wrangler.dev.json'),'utf8')),artifact,artifactRoot,sourceSha);
  const built=JSON.parse(readFileSync(join(artifactRoot,'t5-build.json'),'utf8'));
  check(built.kind === 'apu-t5-build' && built.source_sha === sourceSha && same(built.artifact_hashes,artifactHashes(artifactRoot)), 'BLOCKED_STALE_ARTIFACT');
  result.review.artifact_hashes=built.artifact_hashes;
  for(const [name,value] of [['t5-staged.wrangler.json',result.staged],['t5-enabled.wrangler.json',result.enabled],['t5-config-review.json',result.review],['t5-telemetry-secrets.json',result.telemetrySecrets]]) writeFileSync(join(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({status:'PREPARED_NOT_DEPLOYED',review_sha256:hash(result.review)}));
}
if(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { try { await main(process.argv.slice(2)); } catch(e) { console.error(/^BLOCKED_[A-Z0-9_]+$/.test(e.message)?e.message:'BLOCKED_T5_PREPARATION'); process.exitCode=1; } }
