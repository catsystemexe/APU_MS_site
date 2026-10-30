import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync,realpathSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';
import {buildDevConfig,DEV} from '../ops/dev/prepare-worker.mjs';
import {T5} from '../scripts/telemetry/t5-evidence.mjs';
import {preflight} from '../ops/dev/provider-bootstrap.mjs';
import {buildCandidate,inspectCandidate,offlineCheck,projectSettings,validateProviderValues,freshGuard,futureCommand,candidateReadback,collectFresh,collectReadback} from '../ops/dev/prepare-provider-candidate.mjs';
const template=JSON.parse(readFileSync('wrangler.dev.json')),artifact=JSON.parse(readFileSync('dist/server/wrangler.json'));
function fixture(){
 const inputs={kvNamespaceId:'0123456789abcdef0011223344556677',accessApplicationId:'d00d1234-2222-4333-8444-555566667777',accessAudience:'0123456789abcdef'.repeat(4),accessTeamDomain:DEV.issuer,operatorEmail:DEV.operator,telemetry:{enabled:false,staged:true,dedicatedDev:true,databaseName:T5.database,databaseId:'12345678-1234-4234-8234-123456789abc',hostname:'apu-ms-site-dev.catsystem-exe.workers.dev'},pilotRules:{dedicatedDev:true,namespaceId:'1123456789abcdef0011223344556677',ttlSeconds:86400}};
 const c=buildDevConfig(template,artifact,inputs),v={id:T5.baseline,annotations:{},metadata:{},resources:{script:{etag:'synthetic-code'},script_runtime:{compatibility_date:c.compatibility_date,compatibility_flags:c.compatibility_flags},bindings:[...Object.entries(c.vars).map(([name,text])=>({name,type:'plain_text',text})),...c.kv_namespaces.map(k=>({name:k.binding,type:'kv_namespace',namespace_id:k.id})),{name:'TELEMETRY_DB',type:'d1',database_id:inputs.telemetry.databaseId},{name:'ASSETS',type:'assets'}]}};
 const now=Date.now(),before={worker:DEV.worker,account_id:DEV.account,read_at:now,inventory_read_at:now,inventory:[],current:v,version:v,latest:v,deployments:[{created_on:'2026-10-30T00:00:00Z',versions:[{version_id:v.id,percentage:100}]}],settings:{observability:{enabled:false}},assets:{not_found_handling:'none'},current_assets:{not_found_handling:'none'},subdomain:{enabled:true,previews_enabled:false},routes:[],domains:[],schedules:[],d1:{uuid:inputs.telemetry.databaseId,name:T5.database,jurisdiction:'eu'}};
 const after=structuredClone(before);after.current.id=crypto.randomUUID();after.latest=after.current;after.deployments[0].versions[0].version_id=after.current.id;after.inventory=['OPENAI_API_KEY','APU_VECTOR_STORE_ID'].map(name=>({name,type:'secret_text'}));after.current.resources.bindings.push(...after.inventory);
 return {before,after,inputs,now};
}

const sha='c'.repeat(40);
function candidateFixture(){const f=fixture(),root=realpathSync(mkdtempSync(join(tmpdir(),'apu-provider-candidate-')));f.before.latest=structuredClone(f.before.current);f.before.latest.id=crypto.randomUUID();f.before.latest.resources.script.etag='UNVERIFIED_LATEST';f.before.latest.resources.bindings.push({name:'APU_T5_TRACE_ENABLED',type:'plain_text',text:'1'});f.root=root;f.build=()=>buildCandidate(f.before,f.inputs,template,artifact,root,sha);f.close=()=>rmSync(root,{recursive:true,force:true});return f;}
test('explicit new candidate accepts distinct latest, preserves all active vars/resources/settings, and never claims old binary identity',()=>{const f=candidateFixture();try{const r=f.build();assert.equal(r.config.keep_vars,false);assert.equal(r.config.name,DEV.worker);assert.deepEqual(r.config.vars,Object.fromEntries(f.before.current.resources.bindings.filter(b=>b.type==='plain_text').map(b=>[b.name,b.text])));assert.equal(r.config.vars.APU_TELEMETRY_ENABLED,'0');assert.equal(r.config.vars.APU_TELEMETRY_METADATA_ENABLED,'0');assert.equal(r.config.vars.APU_DEVELOPER_EMAILS,DEV.operator);assert.equal(r.config.vars.PILOT_RULES_RECEIPT_TTL_SECONDS,'86400');assert.deepEqual(r.review.vars_changed,[]);assert.equal(r.review.new_t5_restore_version,null);assert.equal(r.review.intended_changes.length,2);assert.deepEqual(r.config.secrets.required,['APU_VECTOR_STORE_ID','OPENAI_API_KEY']);assert.throws(()=>preflight(f.before,f.inputs,template,artifact,f.now),/LATEST_NOT_ACTIVE/);const args=futureCommand(join(f.root,'config.json'),join(f.root,'operator-only.json'),sha);assert.equal(args[0],'deploy');assert.equal(args.includes('--keep-vars'),false);assert.ok(args.includes('--secrets-file'));assert.ok(args.includes('--experimental-provision=false'));}finally{f.close();}});
for(const [name,change]of [['foreign Worker',f=>f.before.worker='apu-ms-site'],['ON',f=>f.before.current.resources.bindings.find(b=>b.name==='APU_TELEMETRY_ENABLED').text='1'],['tester role',f=>f.before.current.resources.bindings.find(b=>b.name==='APU_DEVELOPER_EMAILS').text=''],['TTL',f=>f.inputs.pilotRules.ttlSeconds=60],['latest unprovided secret',f=>f.before.latest.resources.bindings.push({name:'TELEMETRY_CONTEXT_KEY',type:'secret_text'})],['latest unknown var',f=>f.before.latest.resources.bindings.push({name:'UNREVIEWED',type:'plain_text',text:'x'})],['latest wrong KV',f=>f.before.latest.resources.bindings.find(b=>b.name==='DEV_LOG_STATE').namespace_id='f'.repeat(32)],['active D1',f=>f.before.current.resources.bindings.find(b=>b.type==='d1').database_id=crypto.randomUUID()],['extra settings',f=>f.before.settings.unsafe={}],['asset behavior',f=>f.before.assets.not_found_handling='single-page-application']])test('candidate rejects '+name,()=>{const f=candidateFixture();try{change(f);assert.throws(f.build);}finally{f.close();}});
test('only exactly two nonempty operator-local provider strings are accepted, never null/deletion/extra fields',()=>{const good={OPENAI_API_KEY:'SYNTHETIC',APU_VECTOR_STORE_ID:'SYNTHETIC'};assert.match(validateProviderValues(good).status,/NO_VALUES/);for(const v of [null,[],{}, {...good,OPENAI_API_KEY:null},{...good,APU_VECTOR_STORE_ID:''},{...good,APU_DEVELOPER_EMAILS:'x'},{...good,OPENAI_API_KEY:'x\ny'}])assert.throws(()=>validateProviderValues(v),/PROVIDER_FILE/);});
test('fresh guard accepts stable different latest, rejects age or any reviewed source/config change',()=>{const f=candidateFixture();try{assert.match(freshGuard(f.before,structuredClone(f.before),f.now).status,/PASS/);for(const change of [r=>r.read_at=0,r=>r.latest.id=crypto.randomUUID(),r=>r.settings.observability.enabled=true,r=>r.current.resources.bindings.find(b=>b.name==='APU_TELEMETRY_ENABLED').text='1']){const r=structuredClone(f.before);change(r);assert.throws(()=>freshGuard(f.before,r,f.now));}}finally{f.close();}});
test('new candidate readback verifies source tag and complete config without treating old etag or secret presence as provider E2E',()=>{const f=candidateFixture();try{const r=f.build();f.after.current.annotations={'workers/tag':'dev-provider-'+sha};f.after.current.resources.script.etag='NEW_CANONICAL_ARTIFACT';assert.match(candidateReadback(f.after,r.config,sha,f.after.current.id).status,/NOT_PROVIDER_E2E/);assert.equal(candidateReadback(f.after,r.config,sha,f.after.current.id).new_t5_restore_version,null);for(const change of [x=>x.current.annotations['workers/tag']='wrong',x=>x.current.resources.bindings.find(b=>b.name==='APU_LOCAL_DEV_AUTH').text='1',x=>x.d1.jurisdiction='default',x=>x.inventory=[],x=>x.read_at=0]){const x=structuredClone(f.after);change(x);assert.throws(()=>candidateReadback(x,r.config,sha,x.current.id));}}finally{f.close();}});
test('fresh review collector makes only bounded metadata/inventory reads, parses full stdout in Node, and refuses output reuse',()=>{const f=candidateFixture();try{const p={repo:process.cwd(),dir:f.root,target:join(f.root,'target.json'),inputs:join(f.root,'inputs.json'),cli:join(f.root,'cli.js')};let calls=0;const runner=(_node,args,opts)=>{calls++;assert.deepEqual(opts.stdio,['ignore','pipe','pipe']);if(args[0].endsWith('t5-baseline.mjs')){writeFileSync(args[4],JSON.stringify(f.before));return{status:0,stdout:'reader status'};}assert.deepEqual(args.slice(1,3),['secret','list']);return{status:0,stdout:' \n[]\n'};};const path=collectFresh(p,f.before,runner);assert.equal(calls,2);assert.deepEqual(JSON.parse(readFileSync(path)).inventory,[]);assert.throws(()=>collectFresh(p,f.before,runner),/OUTPUT_EXISTS/);assert.equal(calls,2);}finally{f.close();}});

test('pinned standard deploy supplies both provider secrets explicitly and keeps no latest plain vars',()=>{
 const f=candidateFixture();try{
 const config=f.build().config,src=readFileSync('node_modules/wrangler/wrangler-dist/cli.js','utf8');assert.equal(createHash('sha256').update(src).digest('hex'),'71da1f9bcf69a9f56c4ff4f68e71315365d03db8ea11207577b47a8e1a0a1064');
 const section=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a))),context={import_undici9:{FormData},File,INHERIT_SYMBOL:Symbol(),toMimeType:()=> 'application/javascript+module',getBindingKey:()=> 'binding',isUnsafeBindingType:t=>t.startsWith('unsafe_')};
 runInNewContext(section('function extractBindingsOfType(','function getBindings(')+section('function addRequiredSecretsInheritBindings(','function handleMissingSecretsError(')+section('function createWorkerUploadForm(','var import_undici9, moduleTypeMimeType;'),context);
 const bindings=Object.fromEntries(Object.entries(config.vars).map(([name,value])=>[name,{type:'plain_text',value}]));for(const k of config.kv_namespaces)bindings[k.binding]={type:'kv_namespace',id:k.id};bindings.TELEMETRY_DB={type:'d1',database_id:config.d1_databases[0].database_id};bindings.ASSETS={type:'assets'};for(const name of config.secrets.required)bindings[name]={type:'secret_text',value:'SYNTHETIC_ONLY'};
 context.addRequiredSecretsInheritBindings(config,bindings,{type:'deploy',workerExists:true});
 const metadata=JSON.parse(context.createWorkerUploadForm({main:{name:'index.js',type:'esm',content:'export default {}'},modules:[],keepVars:config.keep_vars,keepSecrets:true},bindings).get('metadata'));
 assert.deepEqual(metadata.keep_bindings,['secret_text','secret_key']);assert.equal(metadata.bindings.filter(b=>b.type==='inherit').length,0);assert.deepEqual(metadata.bindings.filter(b=>b.type==='secret_text').map(b=>b.name).sort(),config.secrets.required);assert.deepEqual(Object.fromEntries(metadata.bindings.filter(b=>b.type==='plain_text').map(b=>[b.name,b.text])),config.vars);
 assert.match(src,/keepVars: Boolean\(args\.keepVars \|\| config2\.keep_vars\)/);assert.match(src,/if \(props\.secretsFile\)/);
 }finally{f.close();}
});

test('future readback collector binds the actual expected new UUID, keeps raw evidence and uses the same Node inventory parser',()=>{
 const f=candidateFixture();try{const c=f.build().config;f.after.current.annotations={'workers/tag':'dev-provider-'+sha};let calls=0;const p={repo:process.cwd(),dir:f.root,target:join(f.root,'target.json'),inputs:join(f.root,'inputs.json'),cli:join(f.root,'cli.js')};const runner=(_node,args)=>{calls++;if(args[0].endsWith('t5-baseline.mjs')){assert.equal(args.at(-1),f.after.current.id);writeFileSync(args[4],JSON.stringify(f.after));return{status:0,stdout:'reader status'};}return{status:0,stdout:JSON.stringify(f.after.inventory,null,2)};};assert.match(collectReadback(p,c,sha,f.after.current.id,runner).status,/NOT_PROVIDER_E2E/);assert.equal(calls,2);assert.throws(()=>collectReadback(p,c,sha,'not-a-version',runner),/EXPECTED_VERSION/);assert.equal(calls,2);}finally{f.close();}
});

test('known provider names in unactivated latest are overwritten explicitly, never inherited or copied',()=>{const f=candidateFixture();try{f.before.latest.resources.bindings.push({name:'OPENAI_API_KEY',type:'secret_text'},{name:'APU_VECTOR_STORE_ID',type:'secret_text'});const r=f.build();assert.deepEqual(r.review.overwritten_latest_provider_names,['APU_VECTOR_STORE_ID','OPENAI_API_KEY']);assert.deepEqual(r.config.secrets.required,r.review.overwritten_latest_provider_names);assert.deepEqual(r.review.vars_changed,[]);}finally{f.close();}});

for(const previews of [true,false])test(`reviewed preview ${previews} is explicit, fresh-stable and preserved at readback`,()=>{
 const f=candidateFixture();try{
 f.before.subdomain.previews_enabled=previews;f.after.subdomain.previews_enabled=previews;
 const {config,review}=f.build();assert.equal(config.workers_dev,true);assert.equal(config.preview_urls,previews);assert.deepEqual(review.routing.subdomain,f.before.subdomain);
 assert.match(freshGuard(f.before,structuredClone(f.before),f.now).status,/PASS/);
 const changed=structuredClone(f.before);changed.subdomain.previews_enabled=!previews;assert.throws(()=>freshGuard(f.before,changed,f.now),/REVIEW_CHANGED/);
 f.after.current.annotations={'workers/tag':'dev-provider-'+sha};assert.match(candidateReadback(f.after,config,sha,f.after.current.id).status,/NOT_PROVIDER_E2E/);
 f.after.subdomain.previews_enabled=!previews;assert.throws(()=>candidateReadback(f.after,config,sha,f.after.current.id),/ROUTING/);
 }finally{f.close();}
});
for(const [name,change]of [
 ['missing preview',r=>delete r.subdomain.previews_enabled],['nonboolean preview',r=>r.subdomain.previews_enabled='true'],['extra subdomain field',r=>r.subdomain.extra=true],['workers.dev disabled',r=>r.subdomain.enabled=false],['route',r=>r.routes=['example.invalid/*']],['domain',r=>r.domains=['example.invalid']],['schedule',r=>r.schedules=['* * * * *']]
])test('candidate routing still rejects '+name+' at review, fresh preflight and readback',()=>{
 const f=candidateFixture();try{const {config}=f.build();const fresh=structuredClone(f.before);change(fresh);assert.throws(()=>freshGuard(f.before,fresh,f.now),/ROUTING/);f.after.current.annotations={'workers/tag':'dev-provider-'+sha};change(f.after);assert.throws(()=>candidateReadback(f.after,config,sha,f.after.current.id),/ROUTING/);change(f.before);assert.throws(f.build,/ROUTING/);}finally{f.close();}
});
test('pinned Wrangler maps explicit preview_urls to subdomain API previews_enabled for both baseline states',async()=>{
 const src=readFileSync('node_modules/wrangler/wrangler-dist/cli.js','utf8');assert.equal(createHash('sha256').update(src).digest('hex'),'71da1f9bcf69a9f56c4ff4f68e71315365d03db8ea11207577b47a8e1a0a1064');
 const section=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
 for(const previews of [true,false]){
 const requests=[],ctx={URL,logger:{},getWorkerSubdomain:async()=>({enabled:true,previews_enabled:previews,url:'https://apu-ms-site-dev.example.workers.dev'}),retryOnAPIFailure:fn=>fn(),fetchResult:async(_config,url,opts)=>{requests.push({url,method:opts.method,body:JSON.parse(opts.body)});return JSON.parse(opts.body);},validateSubdomainMixedState:async()=>{}};
 runInNewContext(section('function getSubdomainValues(','function getSubdomainValuesAPIMock(')+section('async function subdomainDeploy(','function validateEventTriggerTargets('),ctx);
 const result=await ctx.subdomainDeploy({config:{workers_dev:true,preview_urls:previews}},'synthetic-account','apu-ms-site-dev','/synthetic-worker',[],[],false);
 assert.deepEqual(requests,[{url:'/synthetic-worker/subdomain',method:'POST',body:{enabled:true,previews_enabled:previews}}]);assert.equal(result.previewsInSync,true);
 }
});

test('missing or null observability stays unresolved, never inherited from template false',()=>{
 const f=candidateFixture();try{
 for(const raw of [{logpush:true,tail_consumers:null},{logpush:false,tail_consumers:null},{observability:null,tail_consumers:null}]){
 f.before.settings=raw;const original=JSON.stringify(f.before);const report=inspectCandidate(f.before,f.inputs,template,artifact,f.root,sha);
 assert.equal(report.status,'OFFLINE_CONTRACT_BLOCKED');assert.ok(report.issues.some(x=>x.code==='BLOCKED_OBSERVABILITY_EVIDENCE_REQUIRED'));
 assert.equal(report.checks.find(x=>x.section==='settings.tail_consumers').status,'PASS');assert.equal(report.checks.find(x=>x.section==='assets').status,'PASS');
 assert.equal(report.checks.find(x=>x.section==='runtime').status,'PASS');assert.equal(JSON.stringify(f.before),original);
 assert.throws(f.build,/OBSERVABILITY_EVIDENCE_REQUIRED/);
 }
 }finally{f.close();}
});
for(const enabled of [true,false])test(`explicit observability ${enabled}, logpush and null tail project without fabricated defaults`,()=>{
 const f=candidateFixture();try{
 const raw={observability:{enabled,head_sampling_rate:0.25,logs:{enabled,invocation_logs:false,persist:false}},logpush:enabled,tail_consumers:null};
 f.before.settings=structuredClone(raw);f.after.settings=structuredClone(raw);const {config,review}=f.build();
 assert.deepEqual(config.observability,raw.observability);assert.equal(config.logpush,enabled);assert.equal(Object.hasOwn(config,'tail_consumers'),false);
 assert.equal(Object.hasOwn(config,'placement'),false);assert.deepEqual(review.settings_projection,projectSettings(raw));assert.deepEqual(f.before.settings,raw);
 f.after.current.annotations={'workers/tag':'dev-provider-'+sha};assert.match(candidateReadback(f.after,config,sha,f.after.current.id).status,/NOT_PROVIDER_E2E/);
 for(const change of [r=>r.settings.logpush=!enabled,r=>r.settings.observability.enabled=!enabled,r=>r.settings.tail_consumers=[],r=>r.settings.unknown='PRIVATE_SENTINEL']){
 const fresh=structuredClone(f.before);change(fresh);assert.throws(()=>freshGuard(f.before,fresh,f.now),/REVIEW_CHANGED/);
 const after=structuredClone(f.after);change(after);assert.throws(()=>candidateReadback(after,config,sha,after.current.id));
 }
 }finally{f.close();}
});
test('explicit supported settings are preserved exactly; unsupported/null values fail without guessing',()=>{
 const raw={observability:{enabled:false},logpush:false,tail_consumers:[{service:'synthetic-tail',environment:'synthetic-env'}],placement:{mode:'off'},limits:{cpu_ms:50},cache:{enabled:true,cross_version_cache:false},streaming_tail_consumers:[]};
 assert.deepEqual(projectSettings(raw),raw);
 for(const change of [r=>r.logpush=null,r=>r.tail_consumers='invalid',r=>r.tail_consumers=[{name:'invalid'}],r=>r.observability={enabled:false,unknown:1},r=>r.observability={enabled:'false'},r=>r.placement=null]){const r=structuredClone(raw);change(r);assert.throws(()=>projectSettings(r));}
});
test('offline evaluation reports independent mismatches together and never emits metadata values or candidate config',()=>{
 const f=candidateFixture();try{
 f.before.settings={logpush:'PRIVATE_SENTINEL',tail_consumers:null,unknown:'PRIVATE_SENTINEL'};
 f.before.subdomain.previews_enabled='PRIVATE_SENTINEL';f.before.d1.jurisdiction='wrong';f.before.assets.not_found_handling='wrong';
 f.before.current.resources.bindings.find(x=>x.name==='APU_LOCAL_DEV_AUTH').text='1';
 const report=inspectCandidate(f.before,f.inputs,template,artifact,f.root,sha);
 for(const section of ['routing','d1','assets','baseline_vars','settings.fields','settings.observability','settings.logpush'])assert.ok(report.issues.some(x=>x.section===section&&x.status==='FAIL'),section);
 assert.equal(report.checks.find(x=>x.section==='settings.tail_consumers').status,'PASS');assert.equal(report.checks.find(x=>x.section==='config_schema').status,'NOT_CHECKED');
 assert.doesNotMatch(JSON.stringify(report),/PRIVATE_SENTINEL|config_sha256|synthetic-code|APU_LOCAL_DEV_AUTH/);assert.equal(Object.hasOwn(report,'config'),false);assert.equal(report.hosted_verified,false);
 }finally{f.close();}
});
test('offline evaluation passes resolved contract without mutating inputs and still requires a new build/strict prepare',()=>{
 const f=candidateFixture();try{const before=JSON.stringify(f.before);const report=inspectCandidate(f.before,f.inputs,template,artifact,f.root,sha);assert.equal(report.status,'OFFLINE_CONTRACT_PASS_NOT_PREPARED');assert.equal(report.issues.length,0);assert.equal(report.build_required_after_pass,true);assert.equal(JSON.stringify(f.before),before);assert.equal(f.build().config.vars.APU_TELEMETRY_ENABLED,'0');}finally{f.close();}
});
test('pinned deploy omits absent/null-projected tail but forcibly disables unspecified observability: absence is unsafe',async()=>{
 const src=readFileSync('node_modules/wrangler/wrangler-dist/cli.js','utf8');assert.equal(createHash('sha256').update(src).digest('hex'),'71da1f9bcf69a9f56c4ff4f68e71315365d03db8ea11207577b47a8e1a0a1064');
 const section=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
 const ctx={import_undici9:{FormData},File,INHERIT_SYMBOL:Symbol(),toMimeType:()=> 'application/javascript+module',getBindingKey:()=> 'binding',isUnsafeBindingType:t=>t.startsWith('unsafe_')};
 runInNewContext(section('function extractBindingsOfType(','function getBindings(')+section('function createWorkerUploadForm(','var import_undici9, moduleTypeMimeType;'),ctx);
 const projected=projectSettings({observability:{enabled:true},logpush:false,tail_consumers:null});
 const metadata=JSON.parse(ctx.createWorkerUploadForm({main:{name:'index.js',type:'esm',content:'export default {}'},modules:[],...projected},{}).get('metadata'));
 assert.equal(Object.hasOwn(metadata,'tail_consumers'),false);assert.deepEqual(metadata.observability,{enabled:true});assert.equal(metadata.logpush,false);
 // Execute the exact pinned deploy PATCH call with local doubles, including its unsafe fallback.
 const call=section('await patchNonVersionedScriptSettings(config2, accountId, scriptName, {','        } catch {');
 assert.match(call,/observability: worker.observability \?\? \{ enabled: false \}/);
 const requests=[];const patchCtx={fetchResult:async(_c,url,opts)=>{requests.push({url,body:JSON.parse(opts.body)});}};
 runInNewContext(section('async function patchNonVersionedScriptSettings(','var init_versions_api ='),patchCtx);
 for(const worker of [projected,{logpush:false}]){
 const context={...patchCtx,worker,config2:{},accountId:'synthetic-account',scriptName:'apu-ms-site-dev',nextTags:[]};
 await runInNewContext('(async()=>{'+call+'})()',context);
 }
 assert.equal(Object.hasOwn(requests[0].body,'tail_consumers'),false);assert.deepEqual(requests[0].body.observability,{enabled:true});assert.deepEqual(requests[1].body.observability,{enabled:false});
 assert.match(src,/this\._client\.get\(`\/accounts\/\$\{account_id\}\/workers\/scripts\/\$\{scriptName\}\/script-settings`/);
});

test('offline file validator reads existing artifacts with historical provenance, needs no profile/build, writes nothing',()=>{
 const f=candidateFixture();try{
 const repo=process.cwd(),snapshot=join(f.root,'historical.json'),inputs=join(f.root,'inputs.json');
 f.before.settings={logpush:false,tail_consumers:null};writeFileSync(snapshot,JSON.stringify(f.before));writeFileSync(inputs,JSON.stringify(f.inputs));
 const beforeFiles=readdirSync(f.root),beforeRaw=readFileSync(snapshot,'utf8'),beforeManifest=readFileSync('dist/t5-build.json','utf8');let checks=0;
 const report=offlineCheck(repo,sha,snapshot,inputs,join(repo,'dist/server/wrangler.json'),(r,s)=>{checks++;assert.equal(r,repo);assert.equal(s,sha);});
 assert.equal(checks,1);assert.equal(report.status,'OFFLINE_CONTRACT_BLOCKED');assert.ok(report.issues.some(x=>x.code==='BLOCKED_OBSERVABILITY_EVIDENCE_REQUIRED'));
 assert.equal(report.artifact_provenance.status,'HISTORICAL_BUILD_NEW_BUILD_REQUIRED');assert.deepEqual(readdirSync(f.root),beforeFiles);assert.equal(readFileSync(snapshot,'utf8'),beforeRaw);assert.equal(readFileSync('dist/t5-build.json','utf8'),beforeManifest);
 assert.doesNotMatch(JSON.stringify(report),/synthetic-code|namespace_id|database_id|CF_ACCESS_AUD/);
 writeFileSync(snapshot,'not-json PRIVATE_SENTINEL');writeFileSync(inputs,'not-json PRIVATE_SENTINEL');
 const malformed=offlineCheck(repo,sha,snapshot,inputs,join(repo,'dist/server/wrangler.json'),()=>{});
 for(const section of ['file.snapshot','file.input'])assert.ok(malformed.issues.some(x=>x.section===section&&x.code==='BLOCKED_LOCAL_JSON'));
 assert.doesNotMatch(JSON.stringify(malformed),/PRIVATE_SENTINEL/);assert.deepEqual(readdirSync(f.root),beforeFiles);
 }finally{f.close();}
});
