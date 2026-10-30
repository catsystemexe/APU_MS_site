// Explicit new-source DEV candidate. No upload/deploy/secret-writing executor.
import {readFileSync,writeFileSync,realpathSync,existsSync} from 'node:fs';
import {join,resolve,isAbsolute,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as same} from 'node:util';
import Ajv from 'ajv';
import {DEV,buildDevConfig} from './prepare-worker.mjs';
import {bindingMap,activeVersion,artifactHashes} from './prepare-t5-worker.mjs';
import {loadProfile,sourceCheck} from './provider-bootstrap-operator.mjs';
import {parseInventory} from './provider-bootstrap.mjs';
import {T5,privatePath} from '../../scripts/telemetry/t5-evidence.mjs';
const check=(ok,code)=>{if(!ok)throw Error(code);};
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const names=['APU_VECTOR_STORE_ID','OPENAI_API_KEY'];
const settingKeys=['observability','logpush','placement','tail_consumers','streaming_tail_consumers','limits','cache'];
const schema=new Ajv({allErrors:true}).compile(read(new URL('../../node_modules/wrangler/config-schema.json',import.meta.url)));
function routing(r){
 check(typeof r.subdomain?.previews_enabled==='boolean'&&same(r.subdomain,{enabled:true,previews_enabled:r.subdomain.previews_enabled})&&same(r.routes,[])&&same(r.domains,[])&&same(r.schedules,[]),'BLOCKED_ROUTING');
 return {workers_dev:true,preview_urls:r.subdomain.previews_enabled};
}
function context(r){
 check(r.account_id===DEV.account&&r.worker===DEV.worker&&r.current?.id===T5.baseline&&same(r.current,r.version)&&activeVersion(r.deployments)===T5.baseline,'BLOCKED_ACTIVE_BASELINE');
 check(typeof r.latest?.id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(r.latest.id),'BLOCKED_LATEST_ID');
 routing(r);
 check(parseInventory(JSON.stringify(r.inventory)).length===0,'BLOCKED_SECRET_INVENTORY');
}
// Missing/null API metadata is not a guessed Wrangler default. In particular,
// standard deploy PATCHes observability:false when config.observability is absent.
function projectedSetting(raw,key){
 const value=raw[key];
 if(key==='observability')check(value&&typeof value.enabled==='boolean','BLOCKED_OBSERVABILITY_EVIDENCE_REQUIRED');
 if(value===undefined||(key==='tail_consumers'&&value===null))return undefined;
 check(schema({[key]:value}),'BLOCKED_SETTINGS_SCHEMA');
 return structuredClone(value);
}
function settingsStages(raw,run){
 const shape=run('settings.shape',()=>{check(raw&&typeof raw==='object'&&!Array.isArray(raw),'BLOCKED_SETTINGS');return raw;});
 run('settings.fields',()=>check(Object.keys(shape).every(k=>settingKeys.includes(k)),'BLOCKED_SETTINGS'),['settings.shape']);
 const projection={};
 for(const key of settingKeys){const v=run('settings.'+key,()=>projectedSetting(shape,key),['settings.shape']);if(v!==undefined)projection[key]=v;}
 return projection;
}
export function projectSettings(raw){
 return settingsStages(raw,(_section,fn)=>fn());
}
function candidateEvaluation(r,inputs,template,artifact,root,sha,collect){
 const checks=[],values=new Map();
 const run=(section,fn,deps=[])=>{
  if(deps.some(d=>!values.has(d))){checks.push({section,status:'NOT_CHECKED',code:'BLOCKED_DEPENDENCY'});return;}
  try{const v=fn();values.set(section,v);checks.push({section,status:'PASS'});return v;}catch(e){
   const code=/^BLOCKED_[A-Z0-9_]+$/.test(e.message)?e.message:'BLOCKED_CONTRACT_SHAPE';
   if(!collect)throw Error(code);checks.push({section,status:'FAIL',code});
  }
 };
 run('active',()=>check(r?.account_id===DEV.account&&r.worker===DEV.worker&&r.current?.id===T5.baseline&&same(r.current,r.version)&&activeVersion(r.deployments)===T5.baseline,'BLOCKED_ACTIVE_BASELINE'));
 run('latest',()=>check(typeof r?.latest?.id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(r.latest.id),'BLOCKED_LATEST_ID'));
 const route=run('routing',()=>routing(r));
 run('inventory',()=>check(parseInventory(JSON.stringify(r?.inventory)).length===0,'BLOCKED_SECRET_INVENTORY'));
 run('off_inputs',()=>check(inputs?.telemetry?.enabled===false&&inputs.telemetry.staged===true&&inputs.pilotRules?.ttlSeconds===86400,'BLOCKED_OFF_INPUTS'));
 const config=run('dev_config',()=>buildDevConfig(template,artifact,inputs));
 const active=run('active_bindings',()=>bindingMap(r?.current,inputs?.telemetry?.databaseId));
 const latest=run('latest_bindings',()=>bindingMap(r?.latest,inputs?.telemetry?.databaseId));
 const expected=run('expected_bindings',()=>[...config.kv_namespaces.map(k=>({name:k.binding,type:'kv_namespace',namespace_id:k.id})),{name:'TELEMETRY_DB',type:'d1',id:inputs.telemetry.databaseId},{name:'ASSETS',type:'assets'}].sort((a,b)=>a.name.localeCompare(b.name)),['dev_config']);
 run('active_resources',()=>check(same([...active.values()].filter(b=>b.type!=='plain_text').sort((a,b)=>a.name.localeCompare(b.name)),expected),'BLOCKED_RESOURCE_SUBSTITUTION'),['active_bindings','expected_bindings']);
 run('latest_resources',()=>check(same([...latest.values()].filter(b=>!['plain_text','secret_text'].includes(b.type)).sort((a,b)=>a.name.localeCompare(b.name)),expected)&&[...latest.values()].filter(b=>b.type==='secret_text').every(b=>names.includes(b.name)),'BLOCKED_RESOURCE_SUBSTITUTION'),['latest_bindings','expected_bindings']);
 run('d1',()=>check(r?.d1?.uuid===inputs?.telemetry?.databaseId&&r.d1.name===T5.database&&r.d1.jurisdiction==='eu','BLOCKED_D1_IDENTITY'));
 const vars=run('plain_vars',()=>Object.fromEntries([...active.values()].filter(b=>b.type==='plain_text').map(b=>[b.name,b.text])),['active_bindings']);
 run('baseline_vars',()=>{for(const [name,value]of Object.entries(config.vars))check(vars[name]===value,'BLOCKED_BASELINE_VARS');},['plain_vars','dev_config']);
 run('role_trace',()=>check(vars.APU_DEVELOPER_EMAILS===DEV.operator&&['0',undefined].includes(vars.APU_T5_TRACE_ENABLED),'BLOCKED_ROLE_OR_TRACE'),['plain_vars']);
 run('runtime',()=>check(r.current.resources.script_runtime.compatibility_date===config.compatibility_date&&same(r.current.resources.script_runtime.compatibility_flags,config.compatibility_flags),'BLOCKED_RUNTIME'),['dev_config']);
 const settings=settingsStages(r?.settings,run);
 run('assets',()=>check(r?.assets&&Object.keys(r.assets).every(k=>['not_found_handling','html_handling','run_worker_first','base_path'].includes(k))&&r.assets.not_found_handling==='none'&&same(r.current_assets,r.assets),'BLOCKED_ASSETS'));
 run('source_artifact',()=>check(isAbsolute(root)&&realpathSync(root)===root&&/^[a-f0-9]{40}$/.test(sha),'BLOCKED_SOURCE_ARTIFACT'));
 run('config_schema',()=>{
  // In collect mode this validates all available fields even if one setting
  // is unresolved; its separate failed stage still blocks overall PASS/prepare.
  // Remove template settings before applying the exact reviewed projection.
  for(const key of settingKeys)delete config[key];
  Object.assign(config,settings,route,{vars,keep_vars:false,main:join(root,'server/index.js'),base_dir:join(root,'server'),assets:{directory:join(root,'client'),binding:'ASSETS',...r.assets},secrets:{required:names},send_metrics:false});
  config.d1_databases[0].migrations_dir=fileURLToPath(new URL('../../telemetry/migrations',import.meta.url));
  check(schema(config),'BLOCKED_WRANGLER_SCHEMA');
 },['dev_config','routing','plain_vars','assets','source_artifact']);
 if(collect)return {status:checks.every(c=>c.status==='PASS')?'OFFLINE_CONTRACT_PASS_NOT_PREPARED':'OFFLINE_CONTRACT_BLOCKED',checks,issues:checks.filter(c=>c.status!=='PASS'),build_required_after_pass:true,hosted_verified:false};
 return {config,review:{kind:'apu-new-dev-provider-candidate',source_sha:sha,pre_change_version:T5.baseline,active_sha256:hash(r.current),latest_sha256:hash(r.latest),settings_sha256:hash(r.settings),settings_projection:structuredClone(settings),assets_sha256:hash(r.assets),routing:structuredClone({subdomain:r.subdomain,routes:r.routes,domains:r.domains,schedules:r.schedules}),config_sha256:hash(config),intended_changes:['new canonical server/client artifact (no binary equivalence claim)','add exactly OPENAI_API_KEY and APU_VECTOR_STORE_ID'],vars_changed:[],preserved_bindings:r.current.resources.bindings.map(b=>({name:b.name,type:b.type,sha256:hash(b)})),complete_plain_vars:true,flags:{telemetry:vars.APU_TELEMETRY_ENABLED,metadata:vars.APU_TELEMETRY_METADATA_ENABLED,trace:vars.APU_T5_TRACE_ENABLED??'absent: default OFF'},keep_vars:false,reason:'All active plain vars supplied explicitly; inherit no latest plain vars. Pinned deploy keeps secrets: active set must be empty; latest may contain only the two explicitly overwritten provider names, never any unprovided secret.',provider_secret_names:names,overwritten_latest_provider_names:[...latest.values()].filter(b=>b.type==='secret_text').map(b=>b.name).sort(),pre_change_restore_provider_ready:false,new_t5_restore_version:null}};
}
export function buildCandidate(...args){return candidateEvaluation(...args,false);}
export function inspectCandidate(...args){return candidateEvaluation(...args,true);}
export function validateProviderValues(v){
 check(v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),names)&&Object.values(v).every(x=>typeof x==='string'&&x.trim().length>0&&x.length<=8192&&!/[\r\n]/.test(x)),'BLOCKED_PROVIDER_FILE');
 return {status:'LOCAL_PROVIDER_FILE_VALID_NO_VALUES_EMITTED'};
}
function freshTimes(r,now=Date.now()){
 check(Number.isSafeInteger(r.read_at)&&Number.isSafeInteger(r.inventory_read_at)&&now-r.read_at<=60000&&now-r.inventory_read_at<=60000&&r.read_at<=now+5000&&r.inventory_read_at<=now+5000&&Math.abs(r.read_at-r.inventory_read_at)<=10000,'BLOCKED_STALE_PREFLIGHT');
}
export function freshGuard(reviewed,fresh,now=Date.now()){
 context(fresh);freshTimes(fresh,now);
 for(const field of ['current','version','latest','deployments','settings','assets','current_assets','d1','subdomain','routes','domains','schedules'])check(same(reviewed[field],fresh[field]),'BLOCKED_REVIEW_CHANGED');
 return {status:'FRESH_SOURCE_REVIEW_PASS_NOT_AUTHORIZATION'};
}
export function futureCommand(config,providerFile,sha){
 check(isAbsolute(config)&&isAbsolute(providerFile)&&/^[a-f0-9]{40}$/.test(sha),'BLOCKED_COMMAND');
 return ['deploy','--config',config,'--name',DEV.worker,'--strict','--tag','dev-provider-'+sha,'--experimental-provision=false','--experimental-auto-create=false','--secrets-file',providerFile];
}
export function candidateReadback(r,config,sha,id){
 freshTimes(r);
 check(typeof id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)&&r.account_id===DEV.account&&r.worker===DEV.worker&&r.current?.id===id&&id!==T5.baseline&&same(r.current,r.latest)&&activeVersion(r.deployments)===id,'BLOCKED_CANDIDATE_TARGET');
 check(r.current.annotations?.['workers/tag']==='dev-provider-'+sha,'BLOCKED_SOURCE_TAG');
 const map=bindingMap(r.current,config.d1_databases[0].database_id),vars=Object.fromEntries([...map.values()].filter(b=>b.type==='plain_text').map(b=>[b.name,b.text]));
 check(same(vars,config.vars),'BLOCKED_CANDIDATE_VARS');
 check(same(parseInventory(JSON.stringify(r.inventory)).map(b=>b.name).sort(),names),'BLOCKED_SECRET_INVENTORY');
 const expected=[...config.kv_namespaces.map(k=>({name:k.binding,type:'kv_namespace',namespace_id:k.id})),{name:'TELEMETRY_DB',type:'d1',id:config.d1_databases[0].database_id},{name:'ASSETS',type:'assets'},...names.map(name=>({name,type:'secret_text'}))].sort((a,b)=>a.name.localeCompare(b.name));
 check(same([...map.values()].filter(b=>b.type!=='plain_text').sort((a,b)=>a.name.localeCompare(b.name)),expected),'BLOCKED_RESOURCE_SUBSTITUTION');
 check(r.d1?.uuid===config.d1_databases[0].database_id&&r.d1.name===T5.database&&r.d1.jurisdiction==='eu','BLOCKED_D1_IDENTITY');
 const runtime=r.current.resources.script_runtime;
 check(runtime.compatibility_date===config.compatibility_date&&same(runtime.compatibility_flags,config.compatibility_flags),'BLOCKED_RUNTIME');
 check(same(projectSettings(r.settings),Object.fromEntries(settingKeys.filter(k=>Object.hasOwn(config,k)).map(k=>[k,config[k]])))&&same(r.current_assets,Object.fromEntries(Object.entries(config.assets).filter(([k])=>!['directory','binding'].includes(k)))),'BLOCKED_SETTINGS');
 check(same(routing(r),{workers_dev:config.workers_dev,preview_urls:config.preview_urls}),'BLOCKED_ROUTING');
 return {status:'DEPLOYMENT_METADATA_VERIFIED_NOT_PROVIDER_E2E',version:id,new_t5_restore_version:null,gate:'Artifact upload provenance, session/developer/OFF readback and review required before nominating a T5 restore point'};
}
function captureSnapshot(p,prefix,version,runner){
 const raw=join(p.dir,prefix+'-raw.json'),out=join(p.dir,prefix+'.json');check(!existsSync(raw)&&!existsSync(out),'BLOCKED_OUTPUT_EXISTS');
 const run=(args,timeout)=>{const r=runner(process.execPath,args,{cwd:p.repo,env:{...process.env,CI:'true',WRANGLER_WRITE_LOGS:'false',WRANGLER_SEND_METRICS:'false'},encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout,killSignal:'SIGKILL',maxBuffer:1048576,windowsHide:true});check(!r.error&&r.status===0,'BLOCKED_READ_PROCESS');return r.stdout;};
 run([join(p.repo,'ops/dev/t5-baseline.mjs'),'--execute-authorized-read',p.target,p.inputs,raw,p.repo,p.cli,...(version?[version]:[])],90000);
 const inventory=parseInventory(run([p.cli,'secret','list','--format','json','--name',DEV.worker,'--config',p.target],10000));
 const record={...read(raw),inventory,inventory_read_at:Date.now()};writeFileSync(out,JSON.stringify(record)+'\n',{flag:'wx',mode:0o600});return {record,path:out};
}
export function collectFresh(p,historical,runner=spawnSync){const result=captureSnapshot(p,'candidate-fresh',undefined,runner);freshGuard(historical,result.record);return result.path;}
export function collectReadback(p,config,sha,id,runner=spawnSync){
 check(typeof id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id),'BLOCKED_EXPECTED_VERSION');
 const result=captureSnapshot(p,'candidate-after',id,runner);return candidateReadback(result.record,config,sha,id);
}
function built(p){const b=read(join(p.repo,'dist/t5-build.json'));check(b.kind==='apu-t5-build'&&b.source_sha===p.sha&&same(b.artifact_hashes,artifactHashes(join(p.repo,'dist'))),'BLOCKED_BUILD_PROVENANCE');return b;}
export function offlineCheck(repo,sha,snapshot,input,artifactPath,checkSource=sourceCheck){
  checkSource(repo,sha);for(const p of [snapshot,input])privatePath(p,repo);
  check(realpathSync(artifactPath)===join(realpathSync(join(repo,'dist')),'server','wrangler.json'),'BLOCKED_ARTIFACT_PATH');
  const files={},fileChecks=[];
  try{check(createHash('sha256').update(readFileSync(join(repo,'node_modules/wrangler/wrangler-dist/cli.js'))).digest('hex')==='71da1f9bcf69a9f56c4ff4f68e71315365d03db8ea11207577b47a8e1a0a1064','BLOCKED_PINNED_CLI');fileChecks.push({section:'pinned_cli',status:'PASS'});}catch{fileChecks.push({section:'pinned_cli',status:'FAIL',code:'BLOCKED_PINNED_CLI'});}
  for(const [key,path]of Object.entries({snapshot,input,artifact:artifactPath,template:join(repo,'wrangler.dev.json')})){
   try{files[key]=read(path);fileChecks.push({section:'file.'+key,status:'PASS'});}catch{fileChecks.push({section:'file.'+key,status:'FAIL',code:'BLOCKED_LOCAL_JSON'});}
  }
  const report=inspectCandidate(files.snapshot,files.input,files.template,files.artifact,dirname(dirname(artifactPath)),sha);
  report.checks=[...fileChecks,...report.checks];report.issues=report.checks.filter(c=>c.status!=='PASS');
  report.status=report.issues.length?'OFFLINE_CONTRACT_BLOCKED':'OFFLINE_CONTRACT_PASS_NOT_PREPARED';
  // Old manifest remains evidence, never re-label it as this source's build.
  try{const b=read(join(repo,'dist/t5-build.json'));report.artifact_provenance={status:b.source_sha===sha?'CURRENT_SHA_REQUIRES_PREPARE_HASH_CHECK':'HISTORICAL_BUILD_NEW_BUILD_REQUIRED',source_sha:/^[a-f0-9]{40}$/.test(b.source_sha)?b.source_sha:null};}catch{report.artifact_provenance={status:'NOT_VERIFIED_NEW_BUILD_REQUIRED'};}
  return report;
}
async function main(a){
 if(a[0]==='offline-check'){
  check(a.length===6,'BLOCKED_ARGUMENTS');const report=offlineCheck(...a.slice(1));
  console.log(JSON.stringify(report));if(report.issues.length)process.exitCode=1;return;
 }
 check(['prepare','future-plan','readback','fresh-read','validate-provider-file','hosted-readback','provider-file-path'].includes(a[0]),'BLOCKED_ARGUMENTS');
 const [mode,profilePath,repo,sha,...rest]=a;const p=loadProfile(profilePath,repo,sha),b=built(p),configPath=join(p.dir,'provider-candidate.wrangler.json'),reviewPath=join(p.dir,'provider-candidate.review.json');
 if(mode==='provider-file-path'){check(rest.length===0,'BLOCKED_ARGUMENTS');const path=join(p.dir,'provider-values.json');check(!existsSync(path),'BLOCKED_PROVIDER_FILE_EXISTS');console.log(JSON.stringify({path}));return;}
 if(mode==='validate-provider-file'){check(rest.length===1,'BLOCKED_ARGUMENTS');privatePath(rest[0],repo);console.log(JSON.stringify(validateProviderValues(read(rest[0]))));return;}
 if(mode==='prepare'){
  check(rest.length===1,'BLOCKED_ARGUMENTS');privatePath(rest[0],repo);const r=read(rest[0]),result=buildCandidate(r,read(p.inputs),read(join(repo,'wrangler.dev.json')),read(join(repo,'dist/server/wrangler.json')),join(repo,'dist'),sha);
  result.review.artifact_hashes=b.artifact_hashes;result.review.snapshot_sha256=hash(r);
  writeFileSync(configPath,JSON.stringify(result.config,null,2)+'\n',{flag:'wx',mode:0o600});writeFileSync(reviewPath,JSON.stringify(result.review,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({status:'PREPARED_NEW_SOURCE_NOT_DEPLOYED',review:reviewPath}));return;
 }
 const config=read(configPath),review=read(reviewPath);check(hash(config)===review.config_sha256&&same(review.artifact_hashes,b.artifact_hashes),'BLOCKED_CONFIG_CHANGED');
 if(mode==='fresh-read'){check(rest.length===1,'BLOCKED_ARGUMENTS');privatePath(rest[0],repo);const historical=read(rest[0]);check(hash(historical)===review.snapshot_sha256,'BLOCKED_SNAPSHOT_CHANGED');buildCandidate(historical,read(p.inputs),read(join(repo,'wrangler.dev.json')),read(join(repo,'dist/server/wrangler.json')),join(repo,'dist'),sha);const path=collectFresh(p,historical);buildCandidate(read(path),read(p.inputs),read(join(repo,'wrangler.dev.json')),read(join(repo,'dist/server/wrangler.json')),join(repo,'dist'),sha);console.log(JSON.stringify({status:'FRESH_REVIEW_PASS_NOT_AUTHORIZATION',snapshot:path}));return;}
 if(mode==='hosted-readback'){check(rest.length===1,'BLOCKED_ARGUMENTS');console.log(JSON.stringify(collectReadback(p,config,sha,rest[0])));return;}
 if(mode==='readback'){check(rest.length===2,'BLOCKED_ARGUMENTS');privatePath(rest[0],repo);console.log(JSON.stringify(candidateReadback(read(rest[0]),config,sha,rest[1])));return;}
 check(rest.length===3,'BLOCKED_ARGUMENTS');for(const f of rest)privatePath(f,repo);
 const historical=read(rest[0]);check(hash(historical)===review.snapshot_sha256,'BLOCKED_SNAPSHOT_CHANGED');freshGuard(historical,read(rest[1]));
 const regenerated=buildCandidate(read(rest[1]),read(p.inputs),read(join(repo,'wrangler.dev.json')),read(join(repo,'dist/server/wrangler.json')),join(repo,'dist'),sha);check(same(config,regenerated.config),'BLOCKED_CONFIG_CONTRACT');
 validateProviderValues(read(rest[2]));console.log(JSON.stringify(futureCommand(configPath,rest[2],sha)));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{await main(process.argv.slice(2));}catch(e){console.error(/^BLOCKED_[A-Z0-9_]+$/.test(e.message)?e.message:'BLOCKED_PROVIDER_CANDIDATE');process.exitCode=1;}}
