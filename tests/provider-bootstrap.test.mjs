import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {buildDevConfig,DEV} from '../ops/dev/prepare-worker.mjs';
import {T5} from '../scripts/telemetry/t5-evidence.mjs';
import {preflight,verify,rollbackPlan,parseInventory} from '../ops/dev/provider-bootstrap.mjs';
import {setup,readPhase,loadProfile,sourceCheck} from '../ops/dev/provider-bootstrap-operator.mjs';
const template=JSON.parse(readFileSync('wrangler.dev.json')),artifact=JSON.parse(readFileSync('dist/server/wrangler.json'));
function fixture(){
 const inputs={kvNamespaceId:'0123456789abcdef0011223344556677',accessApplicationId:'d00d1234-2222-4333-8444-555566667777',accessAudience:'0123456789abcdef'.repeat(4),accessTeamDomain:DEV.issuer,operatorEmail:DEV.operator,telemetry:{enabled:false,staged:true,dedicatedDev:true,databaseName:T5.database,databaseId:'12345678-1234-4234-8234-123456789abc',hostname:'apu-ms-site-dev.catsystem-exe.workers.dev'},pilotRules:{dedicatedDev:true,namespaceId:'1123456789abcdef0011223344556677',ttlSeconds:86400}};
 const c=buildDevConfig(template,artifact,inputs),v={id:T5.baseline,annotations:{},metadata:{},resources:{script:{etag:'synthetic-code'},script_runtime:{compatibility_date:c.compatibility_date,compatibility_flags:c.compatibility_flags},bindings:[...Object.entries(c.vars).map(([name,text])=>({name,type:'plain_text',text})),...c.kv_namespaces.map(k=>({name:k.binding,type:'kv_namespace',namespace_id:k.id})),{name:'TELEMETRY_DB',type:'d1',database_id:inputs.telemetry.databaseId},{name:'ASSETS',type:'assets'}]}};
 const now=Date.now(),before={worker:DEV.worker,account_id:DEV.account,read_at:now,inventory_read_at:now,inventory:[],current:v,version:v,latest:v,deployments:[{created_on:'2026-10-30T00:00:00Z',versions:[{version_id:v.id,percentage:100}]}],settings:{observability:{enabled:false}},assets:{not_found_handling:'none'},current_assets:{not_found_handling:'none'},subdomain:{enabled:true,previews_enabled:false},routes:[],domains:[],schedules:[],d1:{uuid:inputs.telemetry.databaseId,name:T5.database,jurisdiction:'eu'}};
 const after=structuredClone(before);after.current.id=crypto.randomUUID();after.latest=after.current;after.deployments[0].versions[0].version_id=after.current.id;after.inventory=['OPENAI_API_KEY','APU_VECTOR_STORE_ID'].map(name=>({name,type:'secret_text'}));after.current.resources.bindings.push(...after.inventory);
 return {before,after,inputs,now};
}
test('empty inventory permits only an OFF/OFF exact-target bootstrap plan; post proof establishes a separate rollback point',()=>{const f=fixture();assert.equal(preflight(f.before,f.inputs,template,artifact,f.now).method,'PATCH');const e=verify(f.before,f.after,f.inputs,template,artifact,f.now);assert.notEqual(e.post_bootstrap_version,T5.baseline);assert.equal(e.t5,'BLOCKED_PENDING_REVIEWED_POST_BOOTSTRAP_BASELINE');const dir=mkdtempSync(join(tmpdir(),'apu-bootstrap-')),cfg=join(dir,'target.json');try{writeFileSync(cfg,JSON.stringify({name:DEV.worker,account_id:DEV.account,send_metrics:false}));const plan=rollbackPlan(e,crypto.randomUUID(),cfg,process.cwd());assert.equal(plan.target,f.after.current.id);assert.ok(plan.args.includes('--config'));assert.ok(plan.args.includes(cfg));}finally{rmSync(dir,{recursive:true,force:true});}});
for(const [name,change]of [['foreign account',r=>r.account_id='bad'],['latest not active',r=>{r.latest=structuredClone(r.current);r.latest.id=crypto.randomUUID();}],['nonempty inventory',r=>r.inventory=[{name:'OPENAI_API_KEY',type:'secret_text'}]],['stale inventory',r=>r.inventory_read_at=0],['telemetry ON',r=>r.current.resources.bindings.find(b=>b.name==='APU_TELEMETRY_ENABLED').text='1'],['foreign D1',r=>r.current.resources.bindings.find(b=>b.type==='d1').database_id=crypto.randomUUID()],['extra binding',r=>r.current.resources.bindings.push({name:'EXTRA',type:'secret_text'})]])test('preflight stops '+name,()=>{const f=fixture();change(f.before);assert.throws(()=>preflight(f.before,f.inputs,template,artifact,f.now));});
for(const [name,change]of [['missing secret',r=>r.current.resources.bindings.pop()],['extra inventory',r=>r.inventory.push({name:'EXTRA',type:'secret_text'})],['secret plaintext',r=>r.current.resources.bindings.find(b=>b.type==='secret_text').text='NEVER'],['changed code',r=>r.current.resources.script.etag='changed'],['changed vars',r=>r.current.resources.bindings.find(b=>b.name==='APU_LOCAL_DEV_AUTH').text='1'],['changed settings',r=>r.settings.observability.enabled=true],['changed assets',r=>r.current_assets.not_found_handling='single-page-application']])test('readback stops '+name,()=>{const f=fixture();change(f.after);assert.throws(()=>verify(f.before,f.after,f.inputs,template,artifact,f.now));});
test('pinned bulk function uses one fixed PATCH without draft Worker creation; input/response never escapes double',async()=>{
 const src=readFileSync('node_modules/wrangler/wrangler-dist/cli.js','utf8');assert.equal(createHash('sha256').update(src).digest('hex'),'71da1f9bcf69a9f56c4ff4f68e71315365d03db8ea11207577b47a8e1a0a1064');
 const start=src.indexOf('async function putBulkSecrets('),end=src.indexOf('var VERSION_NOT_DEPLOYED_ERR_CODE',start),calls=[];
 const fn=runInNewContext('('+src.slice(start,end).trim()+')',{fetchResult2:async(_c,path,init)=>{calls.push({path,init});return{};},throwIfLatestVersionNotDeployed:()=>{throw Error('BLOCKED_LATEST');}});
 await fn({},DEV.account,DEV.worker,{OPENAI_API_KEY:'SYNTHETIC_ONLY',APU_VECTOR_STORE_ID:'SYNTHETIC_ONLY'});assert.equal(calls.length,1);assert.equal(calls[0].init.method,'PATCH');assert.equal(calls[0].path,`/accounts/${DEV.account}/workers/scripts/${DEV.worker}/secrets-bulk`);assert.doesNotMatch(src.slice(start,end),/createDraftWorker/);
});

test('historical before validation keeps actual inventory timestamp when reads were several seconds apart',()=>{const f=fixture();f.before.inventory_read_at+=9000;assert.equal(preflight(f.before,f.inputs,template,artifact,f.now+9000).status,'PREFLIGHT_PASS_NOT_AUTHORIZATION');assert.match(verify(f.before,f.after,f.inputs,template,artifact,f.now+9000).status,/VERIFIED/);});

test('optional version metadata absence is preserved while comparing non-secret state',()=>{const f=fixture();delete f.before.current.annotations;delete f.before.current.metadata;assert.match(verify(f.before,f.after,f.inputs,template,artifact,f.now).status,/VERIFIED/);});

test('inventory is parsed from complete stdout: empty and two rows preserve arrays; malformed shapes never escape',()=>{
 assert.deepEqual(parseInventory(' \n[]\n'),[]);
 const rows=['OPENAI_API_KEY','APU_VECTOR_STORE_ID'].map(name=>({name,type:'secret_text'}));
 assert.deepEqual(parseInventory(JSON.stringify(rows,null,2)),rows);
 for(const raw of ['', 'null','{}','"NEVER_RAW"','[]\n[]','banner\n[]',JSON.stringify([{name:'OPENAI_API_KEY',type:'secret_text',text:'NEVER_RAW'}]),JSON.stringify([null]),JSON.stringify([rows[0],rows[0]])])assert.throws(()=>parseInventory(raw),e=>/^BLOCKED_SECRET_INVENTORY_/.test(e.message)&&!e.message.includes('NEVER_RAW'));
});
test('independent read phases load verified paths from persisted profile; complete child stdout stays private',()=>{
 const f=fixture(),dir=mkdtempSync(join(tmpdir(),'apu-bootstrap-profile-')),repo=process.cwd(),sha='a'.repeat(40),inputs=join(dir,'inputs.json'),target=join(dir,'t5-restore-target.json');
 const checkSource=(r,s)=>{assert.equal(r,repo);assert.equal(s,sha);};
 try {
  writeFileSync(inputs,JSON.stringify(f.inputs));writeFileSync(target,JSON.stringify({name:DEV.worker,account_id:DEV.account,send_metrics:false}));
  const profile=setup(repo,sha,inputs,target,dir,checkSource);let calls=0;
  const runner=(_node,args,opts)=>{calls++;assert.deepEqual(opts.stdio,['ignore','pipe','pipe']);assert.ok(!args.includes('PATCH'));if(args[0].endsWith('t5-baseline.mjs')){const r=args.at(-1)===f.after.current.id?f.after:f.before;writeFileSync(args[4],JSON.stringify(r));return{status:0,stdout:'{"status":"READ"}'};}return{status:0,stdout:JSON.stringify(calls===2?[]:f.after.inventory,null,2)};};
  assert.equal(readPhase(profile,repo,sha,'before',undefined,runner,checkSource).status,'PREFLIGHT_PASS_NOT_AUTHORIZATION');
  assert.equal(loadProfile(profile,repo,sha,checkSource).target,target);
  assert.match(readPhase(profile,repo,sha,'after',f.after.current.id,runner,checkSource).status,/VERIFIED_NOT_PROVIDER/);
  assert.equal(calls,4);assert.throws(()=>readPhase(profile,repo,sha,'before',undefined,runner,checkSource),/OUTPUT_EXISTS/);assert.equal(calls,4);
  writeFileSync(inputs,'{}');assert.throws(()=>loadProfile(profile,repo,sha,checkSource),/PROFILE_CHANGED/);
  assert.throws(()=>sourceCheck(repo,'wrong'),/SOURCE/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('malformed full inventory stdout produces only a safe code and never an enriched snapshot',()=>{
 const f=fixture(),dir=mkdtempSync(join(tmpdir(),'apu-bootstrap-invalid-')),repo=process.cwd(),sha='b'.repeat(40),inputs=join(dir,'inputs.json'),target=join(dir,'t5-restore-target.json');
 try{
  writeFileSync(inputs,JSON.stringify(f.inputs));writeFileSync(target,JSON.stringify({name:DEV.worker,account_id:DEV.account,send_metrics:false}));
  const profile=setup(repo,sha,inputs,target,dir,()=>{});
  const runner=(_node,args)=>{if(args[0].endsWith('t5-baseline.mjs')){writeFileSync(args[4],JSON.stringify(f.before));return{status:0,stdout:'safe reader status'};}return{status:0,stdout:'NEVER_RAW_CREDENTIAL\n[]',stderr:'NEVER_RAW_STDERR'};};
  assert.throws(()=>readPhase(profile,repo,sha,'before',undefined,runner,()=>{}),{message:'BLOCKED_SECRET_INVENTORY_JSON'});
  assert.equal(existsSync(join(dir,'before.json')),false);assert.doesNotMatch(readFileSync(join(dir,'before-raw.json'),'utf8'),/NEVER_RAW/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('different latest cannot be promoted implicitly or mutate the preserved active snapshot',()=>{
 const f=fixture();f.before.latest=structuredClone(f.before.current);f.before.latest.id=crypto.randomUUID();f.before.latest.resources.script.etag='UNVERIFIED_LATEST_CODE';
 const original=structuredClone(f.before);
 assert.throws(()=>preflight(f.before,f.inputs,template,artifact,f.now),{message:'BLOCKED_LATEST_NOT_ACTIVE'});
 assert.deepEqual(f.before,original);
});
test('pinned versions-secret helper always targets latest and exposes no exact source-version selector',async()=>{
 const src=readFileSync('node_modules/wrangler/wrangler-dist/cli.js','utf8');assert.equal(createHash('sha256').update(src).digest('hex'),'71da1f9bcf69a9f56c4ff4f68e71315365d03db8ea11207577b47a8e1a0a1064');
 const start=src.indexOf('async function patchLatestWorkerVersionWithSecrets('),end=src.indexOf('var versionsSecretNamespace,',start),calls=[];
 const fn=runInNewContext('('+src.slice(start,end).trim()+')',{fetchResult2:async(_c,path,init)=>{calls.push({path,init});return{id:'SYNTHETIC_VERSION'};},getMetricsUsageHeaders:async()=>({})});
 await fn({config:{},accountId:DEV.account,scriptName:DEV.worker,secrets:{OPENAI_API_KEY:'SYNTHETIC_ONLY',APU_VECTOR_STORE_ID:'SYNTHETIC_ONLY'},sourceVersionId:T5.baseline});
 assert.equal(calls.length,1);assert.equal(calls[0].path,`/accounts/${DEV.account}/workers/workers/${DEV.worker}/versions/latest`);assert.equal(calls[0].init.method,'PATCH');
 assert.equal(JSON.stringify(JSON.parse(calls[0].init.body)).includes(T5.baseline),false);
 const bulk=src.slice(src.indexOf('versionsSecretPutBulkHandler(args'),src.indexOf('// src/versions/secrets/delete.ts'));
 assert.doesNotMatch(bulk,/args\.(?:versionId|fromVersion|sourceVersion)/);
});
