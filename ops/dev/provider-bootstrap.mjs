// Offline metadata validator/plan only. Never reads credentials, executes Wrangler or makes HTTP requests.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as same} from 'node:util';
import {DEV,buildDevConfig} from './prepare-worker.mjs';
import {bindingMap,activeVersion} from './prepare-t5-worker.mjs';
import {T5,privatePath,restorePlan} from '../../scripts/telemetry/t5-evidence.mjs';
const check=(ok,code)=>{if(!ok)throw Error(code);};
const provider=['APU_VECTOR_STORE_ID','OPENAI_API_KEY'];
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
function inventory(record,names) {
  check(Array.isArray(record.inventory)&&record.inventory.every(b=>same(Object.keys(b).sort(),['name','type'])&&b.type==='secret_text'),'BLOCKED_SECRET_INVENTORY_SCHEMA');
  check(same(record.inventory.map(b=>b.name).sort(),names),'BLOCKED_SECRET_INVENTORY');
}
function target(r,now) {
  check(r.account_id===DEV.account&&r.worker===DEV.worker&&uuid(r.current?.id)&&activeVersion(r.deployments)===r.current.id,'BLOCKED_TARGET');
  check(Number.isSafeInteger(r.inventory_read_at)&&Math.abs(r.inventory_read_at-r.read_at)<=10000&&r.inventory_read_at<=now+5000&&now-r.inventory_read_at<=60000,'BLOCKED_STALE_INVENTORY');
  check(Number.isSafeInteger(r.read_at)&&r.read_at<=now+5000&&now-r.read_at<=60000,'BLOCKED_STALE_PREFLIGHT');
  check(same(r.current,r.latest),'BLOCKED_LATEST_NOT_ACTIVE');
  check(same(r.subdomain,{enabled:true,previews_enabled:false})&&same(r.routes,[])&&same(r.domains,[])&&same(r.schedules,[]),'BLOCKED_ROUTING');
}
export function preflight(record,inputs,template,artifact,now=Date.now()) {
  target(record,now);inventory(record,[]);
  check(record.current.id===T5.baseline&&same(record.version,record.current),'BLOCKED_PRE_BOOTSTRAP_BASELINE');
  check(inputs.telemetry?.enabled===false&&inputs.telemetry.staged===true&&inputs.pilotRules?.ttlSeconds===86400,'BLOCKED_OFF_INPUTS');
  const base=buildDevConfig(template,artifact,inputs),map=bindingMap(record.current,inputs.telemetry.databaseId);
  check(![...map.values()].some(b=>b.type==='secret_text'),'BLOCKED_METADATA_INVENTORY_DISAGREEMENT');
  for(const [name,value]of Object.entries(base.vars))check(map.get(name)?.text===value,'BLOCKED_BASELINE_VARS');
  check(map.get('APU_DEVELOPER_EMAILS')?.text===DEV.operator&&['0',undefined].includes(map.get('APU_T5_TRACE_ENABLED')?.text),'BLOCKED_ROLE_OR_TRACE');
  const expected=[...base.kv_namespaces.map(k=>({name:k.binding,type:'kv_namespace',namespace_id:k.id})),{name:'TELEMETRY_DB',type:'d1',id:inputs.telemetry.databaseId},{name:'ASSETS',type:'assets'}];
  check(same([...map.values()].filter(b=>b.type!=='plain_text').sort((a,b)=>a.name.localeCompare(b.name)),expected.sort((a,b)=>a.name.localeCompare(b.name))),'BLOCKED_RESOURCE_SUBSTITUTION');
  check(record.d1?.uuid===inputs.telemetry.databaseId&&record.d1.name===T5.database&&record.d1.jurisdiction==='eu','BLOCKED_D1_IDENTITY');
  check(record.current.resources.script_runtime.compatibility_date===base.compatibility_date&&same(record.current.resources.script_runtime.compatibility_flags,base.compatibility_flags),'BLOCKED_RUNTIME');
  check(record.settings?.observability&&typeof record.settings.observability.enabled==='boolean'&&same(record.current_assets,record.assets)&&record.assets?.not_found_handling==='none','BLOCKED_SETTINGS_EVIDENCE');
  return {status:'PREFLIGHT_PASS_NOT_AUTHORIZATION',before_version:record.current.id,before_sha256:digest(record),method:'PATCH',path:`/accounts/${DEV.account}/workers/scripts/${DEV.worker}/secrets-bulk`,secret_names:provider};
}
export function verify(before,after,inputs,template,artifact,now=Date.now()) {
  // Validate the old snapshot at its original read time, without pretending it is fresh now.
  preflight(before,inputs,template,artifact,Math.max(before.read_at,before.inventory_read_at));target(after,now);inventory(after,provider);
  check(after.current.id!==before.current.id,'BLOCKED_NEW_VERSION_NOT_IDENTIFIED');
  const map=bindingMap(after.current,inputs.telemetry.databaseId);
  check(same([...map.values()].filter(b=>b.type==='secret_text').map(b=>b.name).sort(),provider),'BLOCKED_PROVIDER_BINDINGS');
  const stripped=structuredClone(after.current);stripped.id=before.current.id;stripped.annotations=before.current.annotations;stripped.metadata=before.current.metadata;
  stripped.resources.bindings=stripped.resources.bindings.filter(b=>b.type!=='secret_text');
  // Do not discard unrecognized fields/settings; code/runtime/non-secret metadata must stay exact.
  check(same(stripped,before.current),'BLOCKED_NON_SECRET_VERSION_DELTA');
  for(const field of ['settings','current_assets','assets','subdomain','routes','domains','schedules','d1'])check(same(after[field],before[field]),'BLOCKED_NON_SECRET_DELTA');
  return {status:'BOOTSTRAP_BINDINGS_VERIFIED_NOT_PROVIDER_E2E',pre_bootstrap_version:before.current.id,post_bootstrap_version:after.current.id,post_sha256:digest(after),telemetry:'0',metadata:'0',t5:'BLOCKED_PENDING_REVIEWED_POST_BOOTSTRAP_BASELINE',post_t5_rollback_version:after.current.id};
}
export function rollbackPlan(evidence,currentVersion,configPath,repo) {
  check(evidence?.status==='BOOTSTRAP_BINDINGS_VERIFIED_NOT_PROVIDER_E2E'&&uuid(evidence.post_bootstrap_version)&&uuid(currentVersion),'BLOCKED_RESTORE_EVIDENCE');
  const original=restorePlan(configPath,repo);
  return {status:'PLAN_ONLY_REQUIRES_FRESH_EXCLUSIVE_VERSION_GUARD_AND_AUTHORIZATION',expected_current:currentVersion,target:evidence.post_bootstrap_version,args:['rollback',evidence.post_bootstrap_version,...original.args.slice(2)],warning:'Pre-bootstrap rollback removes provider readiness; post-T5 target is the verified post-bootstrap version, never automatically 732bf950.'};
}
async function main(a) {
  check(['preflight','verify'].includes(a[0])&&a.length===(a[0]==='preflight'?4:5),'BLOCKED_ARGUMENTS');
  const repo=resolve(a.at(-1));for(const p of a.slice(1,-1))privatePath(p,repo);
  const read=p=>JSON.parse(readFileSync(p));const template=read(resolve(repo,'wrangler.dev.json')),artifact=read(resolve(repo,'dist/server/wrangler.json'));
  console.log(JSON.stringify(a[0]==='preflight'?preflight(read(a[1]),read(a[2]),template,artifact):verify(read(a[1]),read(a[2]),read(a[3]),template,artifact)));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{await main(process.argv.slice(2));}catch(e){console.error(/^BLOCKED_[A-Z0-9_]+$/.test(e.message)?e.message:'BLOCKED_BOOTSTRAP');process.exitCode=1;}}
