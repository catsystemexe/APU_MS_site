import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import { DEV, buildDevConfig } from '../ops/dev/prepare-worker.mjs';
import { buildT5Configs, activeVersion, futureT5Command, verifyT5Readback, verifyBaselineGuard, guardDeployment } from '../ops/dev/prepare-t5-worker.mjs';
import { collectBaseline, authorizedRead } from '../ops/dev/t5-baseline.mjs';
import { prepare, T5, boundedRestore } from '../scripts/telemetry/t5-evidence.mjs';
const root=process.cwd(), template=JSON.parse(readFileSync(new URL('../wrangler.dev.json',import.meta.url))), artifact=JSON.parse(readFileSync(new URL('../dist/server/wrangler.json',import.meta.url)));
const sha='a'.repeat(40), candidate='12345678-1234-4234-8234-123456789abc';
const cli=realpathSync(fileURLToPath(new URL('../node_modules/wrangler/wrangler-dist/cli.js',import.meta.url)));
// Synthetic fixture IDs only; never a real resource inventory or deployment input.
const inputs=()=>({kvNamespaceId:'0123456789abcdef0011223344556677',accessApplicationId:'d00d1234-2222-4333-8444-555566667777',accessAudience:'0123456789abcdef'.repeat(4),accessTeamDomain:DEV.issuer,operatorEmail:DEV.operator,
  telemetry:{enabled:false,staged:true,dedicatedDev:true,databaseName:T5.database,databaseId:'12345678-1234-4234-8234-123456789abc',hostname:'apu-ms-site-dev.catsystem-exe.workers.dev'},
  pilotRules:{dedicatedDev:true,namespaceId:'1123456789abcdef0011223344556677',ttlSeconds:86400}});
const deployments=id=>[{created_on:'2026-10-29T00:00:00Z',versions:[{version_id:id,percentage:100}]}];
function version(config,id=T5.baseline) {
  return {id,annotations:{'workers/tag':'t5-r2-'+sha},resources:{script:{etag:'synthetic-etag-'+id},script_runtime:{compatibility_date:config.compatibility_date,compatibility_flags:config.compatibility_flags},bindings:[
    ...Object.entries(config.vars).map(([name,text])=>({name,type:'plain_text',text})),
    ...config.kv_namespaces.map(k=>({name:k.binding,type:'kv_namespace',namespace_id:k.id})),
    ...config.d1_databases.map(d=>({name:d.binding,type:'d1',id:d.database_id})),{name:'ASSETS',type:'assets'},
    ...(config.secrets?.required ?? ['APU_VECTOR_STORE_ID','OPENAI_API_KEY']).map(name=>({name,type:'secret_text'}))]}};
}
function fixture() {
  const i=inputs(), base=buildDevConfig(template,artifact,i), v=version(base), dir=realpathSync(mkdtempSync(join(tmpdir(),'apu-t5-config-')));
  const baseline={kind:'apu-t5-baseline',worker:DEV.worker,account_id:DEV.account,read_at:Date.now(),version:v,current:v,latest:v,deployments:deployments(T5.baseline),d1:{uuid:i.telemetry.databaseId,name:T5.database,jurisdiction:'eu'},subdomain:{enabled:true,previews_enabled:false},routes:[],domains:[],schedules:[],assets:{not_found_handling:'none'},current_assets:{not_found_handling:'none'},settings:{observability:{enabled:false},logpush:false,placement:{mode:'off'},tail_consumers:[]}};
  const p=prepare();
  return {i,base,baseline,p,dir,build:()=>buildT5Configs(baseline,i,p,template,artifact,dir,sha),close:()=>rmSync(dir,{recursive:true,force:true})};
}
test('complete explicit T5 variant preserves strict resource guards, Access, assets/settings and secret names; review contains no private inputs',()=>{
  const f=fixture();try {
    const r=f.build(); assert.equal(r.staged.keep_vars,true); assert.equal(r.enabled.keep_vars,true);
    for(const c of [r.staged,r.enabled]) {assert.equal(c.name,DEV.worker);assert.equal(c.account_id,DEV.account);assert.deepEqual(c.kv_namespaces,f.base.kv_namespaces);assert.equal(c.d1_databases[0].database_id,f.i.telemetry.databaseId);assert.equal(c.vars.CF_ACCESS_AUD,f.i.accessAudience);assert.equal(c.vars.PILOT_RULES_RECEIPT_TTL_SECONDS,'86400');assert.equal(c.assets.not_found_handling,'none');assert.deepEqual(c.observability,f.baseline.settings.observability);assert.equal(c.vars.APU_TELEMETRY_METADATA_ENABLED,'0');}
    assert.equal(r.staged.vars.APU_DEVELOPER_EMAILS,DEV.operator);assert.equal(r.staged.vars.APU_TELEMETRY_ENABLED,'0');assert.equal(r.staged.vars.APU_T5_TRACE_ENABLED,'0');
    assert.equal(r.enabled.vars.APU_DEVELOPER_EMAILS,'');assert.equal(r.enabled.vars.APU_TELEMETRY_ENABLED,'1');assert.equal(r.enabled.vars.APU_T5_TRACE_COHORT,f.p.cohort);
    assert.deepEqual(Object.keys(r.telemetrySecrets).sort(),['TELEMETRY_CONTEXT_KEY','TELEMETRY_PSEUDONYM_KEY']);
    const review=JSON.stringify(r.review); for(const value of [f.i.kvNamespaceId,f.i.pilotRules.namespaceId,f.i.accessAudience,f.i.telemetry.databaseId,DEV.operator,f.p.participant,...Object.values(f.p.secrets)]) assert.ok(!review.includes(value));
    const args=futureT5Command('enabled',join(f.dir,'enabled.json'),join(f.dir,'keys.json'),sha);assert.ok(args.includes('--keep-vars'));assert.ok(args.includes('--strict'));assert.ok(args.includes('--experimental-provision=false'));assert.ok(!args.includes('versions'));
  }finally{f.close();}
});
for(const [label,mutate] of [
  ['account',f=>f.baseline.account_id='0'.repeat(32)],['worker',f=>f.baseline.worker='apu-ms-site'],['version',f=>f.baseline.version.id=candidate],['traffic',f=>f.baseline.deployments[0].versions[0].percentage=99],
  ['D1 UUID',f=>f.baseline.d1.uuid=crypto.randomUUID()],['EU',f=>f.baseline.d1.jurisdiction='default'],['missing receipt KV',f=>f.baseline.version.resources.bindings=f.baseline.version.resources.bindings.filter(b=>b.name!=='PILOT_RULES_ACCEPTANCE')],
  ['extra binding',f=>f.baseline.version.resources.bindings.push({name:'OTHER',type:'assets'})],['secret plaintext',f=>f.baseline.version.resources.bindings.find(b=>b.name==='OPENAI_API_KEY').text='NEVER_VALUE'],
  ['latest secret substitution',f=>{f.baseline.latest=structuredClone(f.baseline.latest);f.baseline.latest.resources.bindings.push({name:'TELEMETRY_CONTEXT_KEY',type:'secret_text'});}],
  ['production KV',f=>f.i.kvNamespaceId='4a24c791d31a4c0983170c921cb744aa'],['receipt reuse',f=>f.i.pilotRules.namespaceId=f.i.kvNamespaceId],['TTL',f=>f.i.pilotRules.ttlSeconds=3600],
  ['metadata',f=>f.p.vars.APU_TELEMETRY_METADATA_ENABLED='1'],['enrollment',f=>f.p.vars.APU_TELEMETRY_ELIGIBLE='x'.repeat(43)],['role',f=>f.p.vars.APU_DEVELOPER_EMAILS=DEV.operator],['public route',f=>f.baseline.routes=[{pattern:'example/*'}]],['asset behavior',f=>f.baseline.assets.not_found_handling='single-page-application'],['unsupported setting',f=>f.baseline.settings.unsafe={}],
]) test('T5 preparer rejects '+label,()=>{const f=fixture();try{mutate(f);assert.throws(f.build);}finally{f.close();}});
test('fresh original guard and candidate readback detect races/config drift and distinguish source from provider PASS',()=>{
  const f=fixture();try {
    assert.equal(verifyBaselineGuard(f.baseline,structuredClone(f.baseline)).status,'BASELINE_GUARD_VERIFIED');
    assert.throws(()=>verifyBaselineGuard({...f.baseline,read_at:0},f.baseline),/STALE/);
    const r=f.build(), record={...f.baseline,current:version(r.enabled,candidate),latest:version(r.enabled,candidate),deployments:deployments(candidate)};
    assert.equal(verifyT5Readback(record,r.enabled,sha,candidate).status,'CANDIDATE_CONFIG_VERIFIED_NOT_PROVIDER_PASS');
    for(const change of [r=>r.routes.push({pattern:'example/*'}),r=>delete r.settings.observability,r=>r.current.resources.bindings.find(b=>b.name==='APU_T5_TRACE_ENABLED').text='0',r=>r.current.annotations['workers/tag']='old']) {
      const bad=structuredClone(record);change(bad);assert.throws(()=>verifyT5Readback(bad,r.enabled,sha,candidate));
    }
    const restored={...f.baseline,latest:record.current};
    assert.match(verifyBaselineGuard(restored,f.baseline,Date.now(),true).status,/NOT_RECONCILIATION_PASS/);
    assert.throws(()=>verifyBaselineGuard(restored,f.baseline),/BASELINE_CHANGED/);
    assert.throws(()=>activeVersion([{created_on:'2026-10-29',versions:[{version_id:candidate,percentage:50},{version_id:T5.baseline,percentage:50}]}]),/TRAFFIC/);
  }finally{f.close();}
});
function fakeGet(f,alter=()=>{}) {
  const script=`/accounts/${DEV.account}/workers/scripts/${DEV.worker}`,service=`/accounts/${DEV.account}/workers/services/${DEV.worker}/environments/production`;
  const calls=[];const get=async path=>{calls.push(path);let result;
    if(path===script+'/deployments')result={deployments:f.baseline.deployments};
    else if(path===script+'/versions')result={items:[{id:T5.baseline}]};
    else if(path===script+'/versions/'+T5.baseline)result=f.baseline.version;
    else if(path===service)result={script:{etag:f.baseline.version.resources.script.etag,...f.baseline.settings}};
    else if(path===service+'/subdomain')result=f.baseline.subdomain;
    else if(path===service+'/routes?show_zonename=true')result=[];
    else if(path.includes('/workers/domains/records?'))result=[];
    else if(path===script+'/schedules')result={schedules:[]};
    else if(path===`/accounts/${DEV.account}/workers/workers/${DEV.worker}/versions/${T5.baseline}`)result={assets:{config:f.baseline.assets}};
    else if(path===`/accounts/${DEV.account}/d1/database/${f.i.telemetry.databaseId}`)result=f.baseline.d1;
    else throw Error('unexpected endpoint');
    result=structuredClone(result);alter(path,result,calls);return result;
  };return {get,calls};
}
test('future baseline reader uses only fixed GET endpoints and existing CF auth in memory, rejects race and secret plaintext',async()=>{
  const f=fixture();try {
    const target=join(f.dir,'target.json');writeFileSync(target,JSON.stringify({name:T5.worker,account_id:T5.account,send_metrics:false}));
    const fake=fakeGet(f), runner=(_exe,args,opts)=>{assert.deepEqual(args.slice(1,4),['auth','token','--json']);assert.deepEqual(opts.stdio,['ignore','pipe','ignore']);return {status:0,stdout:JSON.stringify({type:'oauth',token:'SYNTHETIC_CF_AUTH_NOT_A_REAL_TOKEN'})};};
    const result=await authorizedRead(cli,target,f.i,async(url,opts)=>{assert.equal(opts.method,'GET');assert.equal(opts.headers.Authorization,'Bearer SYNTHETIC_CF_AUTH_NOT_A_REAL_TOKEN');return {ok:true,json:async()=>({success:true,result:await fake.get(url.slice('https://api.cloudflare.com/client/v4'.length))})};},runner);
    assert.doesNotMatch(JSON.stringify(result),/SYNTHETIC_CF_AUTH/); assert.deepEqual(result.settings,f.baseline.settings);f.baseline=result;assert.doesNotThrow(f.build);
    const race=fakeGet(f,(path,v,calls)=>{if(path.endsWith('/deployments')&&calls.filter(p=>p.endsWith('/deployments')).length===2)v.deployments=deployments(candidate);});await assert.rejects(collectBaseline(race.get,f.i),/RACE/);
    const secret=fakeGet(f,(path,v)=>{if(path.endsWith('/versions/'+T5.baseline)&&v.resources)v.resources.bindings.find(b=>b.name==='OPENAI_API_KEY').text='NEVER_READ';});await assert.rejects(collectBaseline(secret.get,f.i),/SECRET_METADATA/);
  }finally{f.close();}
});
test('pinned actual Wrangler upload form inherits provider secrets and supplies only two synthetic T5 keys',()=>{
  const src=readFileSync(cli,'utf8');assert.equal(createHash('sha256').update(src).digest('hex'),'71da1f9bcf69a9f56c4ff4f68e71315365d03db8ea11207577b47a8e1a0a1064');
  const section=(start,end)=>src.slice(src.indexOf(start),src.indexOf(end,src.indexOf(start)));
  const context={import_undici9:{FormData},File,INHERIT_SYMBOL:Symbol(),toMimeType:()=> 'application/javascript+module',__name:()=>{},getBindingKey:()=> 'binding',isUnsafeBindingType:t=>t.startsWith('unsafe_')};
  runInNewContext(section('function extractBindingsOfType(', 'function getBindings(')+section('function addRequiredSecretsInheritBindings(','function handleMissingSecretsError(')+section('function createWorkerUploadForm(','var import_undici9, moduleTypeMimeType;'),context);
  const bindings={TELEMETRY_CONTEXT_KEY:{type:'secret_text',value:'SYNTHETIC_ONLY'},TELEMETRY_PSEUDONYM_KEY:{type:'secret_text',value:'SYNTHETIC_ONLY_2'},DEV_LOG_STATE:{type:'kv_namespace',id:'synthetic-dev'},PILOT_RULES_ACCEPTANCE:{type:'kv_namespace',id:'synthetic-receipt'},TELEMETRY_DB:{type:'d1',database_id:'synthetic-d1'},ASSETS:{type:'assets'},APU_TELEMETRY_ENABLED:{type:'plain_text',value:'1'}};
  context.addRequiredSecretsInheritBindings({secrets:{required:['OPENAI_API_KEY','APU_VECTOR_STORE_ID','TELEMETRY_CONTEXT_KEY','TELEMETRY_PSEUDONYM_KEY']}},bindings,{type:'deploy',workerExists:true});
  const form=context.createWorkerUploadForm({main:{name:'index.js',type:'esm',content:'export default {}'},modules:[],keepVars:true,keepSecrets:true,observability:{enabled:false},compatibility_date:'2026-08-21'},bindings);
  const metadata=JSON.parse(form.get('metadata'));
  assert.ok(metadata.keep_bindings.includes('secret_text'));assert.ok(metadata.keep_bindings.includes('secret_key'));assert.ok(metadata.keep_bindings.includes('plain_text'));
  for(const name of ['OPENAI_API_KEY','APU_VECTOR_STORE_ID'])assert.deepEqual(metadata.bindings.find(b=>b.name===name),{name,type:'inherit'});
  assert.deepEqual(metadata.bindings.filter(b=>b.type==='secret_text').map(b=>b.name).sort(),['TELEMETRY_CONTEXT_KEY','TELEMETRY_PSEUDONYM_KEY']);
  assert.equal(metadata.bindings.find(b=>b.name==='DEV_LOG_STATE').namespace_id,'synthetic-dev');assert.equal(metadata.bindings.find(b=>b.name==='TELEMETRY_DB').id,'synthetic-d1');
  assert.deepEqual(metadata.bindings.find(b=>b.name==='PILOT_RULES_ACCEPTANCE'),{name:'PILOT_RULES_ACCEPTANCE',type:'kv_namespace',namespace_id:'synthetic-receipt'});
  assert.deepEqual(metadata.bindings.find(b=>b.name==='ASSETS'),{name:'ASSETS',type:'assets'});
  assert.equal(metadata.bindings.find(b=>b.name==='APU_TELEMETRY_ENABLED').text,'1');
  assert.deepEqual(metadata.observability,{enabled:false});
});
test('normal and failure restore use exact original version; failure never claims closure or erases evidence',()=>{
  const f=fixture();try {
    const target=join(f.dir,'target.json');writeFileSync(target,JSON.stringify({name:T5.worker,account_id:T5.account,send_metrics:false}));
    for(const [mode,result]of [['normal',{status:0}],['failure',{status:null,error:{code:'ETIMEDOUT'}}]]) {
      const log=join(f.dir,'t5-restore-result-'+mode+'.jsonl');
      const output=boundedRestore(cli,target,log,root,Date.now()+60000,'T5_PRESERVING_AND_10220_REVIEWED',(_exe,args,opts)=>{assert.equal(args[1],'rollback');assert.equal(args[2],T5.baseline);assert.ok(opts.timeout<=60000);return result;});
      assert.equal(output.result,mode==='normal'?'RESTORE_COMMAND_COMPLETED_READBACK_REQUIRED':'RESTORE_UNCONFIRMED');
      assert.match(readFileSync(log,'utf8'),/restore_intent/);assert.notEqual(output.hosted_closed,'PASS');
    }
  }finally{f.close();}
});

test('restore guard accepts only fresh sole test version or already original, and refuses foreign/split traffic',()=>{
  assert.equal(guardDeployment(deployments(candidate),candidate,1000,1001).status,'EXCLUSIVE_T5_VERSION_GUARD_VERIFIED');
  assert.equal(guardDeployment(deployments(T5.baseline),candidate,1000,1001).status,'ALREADY_BASELINE_READBACK_REQUIRED');
  assert.throws(()=>guardDeployment(deployments(crypto.randomUUID()),candidate,1000,1001),/FOREIGN/);
  assert.throws(()=>guardDeployment(deployments(candidate),candidate,1000,20000),/FRESHNESS/);
});
