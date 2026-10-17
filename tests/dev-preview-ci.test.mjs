import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { TARGET, ACCESS_VARS, validateConfig, validateContext, validateCommand, validatePreview, validateDeployment,
  productionState, previewArgs, updateExistingPreview, liveIO } from "../ops/ci/dev-preview-guard.mjs";
const require = createRequire(import.meta.url);
const yaml = require("js-yaml"); // Existing locked tooling dependency; no dependency upgrade.
const read = path => readFile(new URL(path, import.meta.url), "utf8");
const template = await read("../ops/ci/dev-preview.workflow.yml.template");
const workflow = yaml.load(template, { json: false });
const generated = JSON.parse(await read("../dist/server/wrangler.json"));
const sha = "1234567890abcdef1234567890abcdef12345678";
const env = () => ({ GITHUB_REPOSITORY: TARGET.repository, GITHUB_REF: `refs/heads/${TARGET.branch}`, GITHUB_EVENT_NAME: "push",
  GITHUB_SHA: sha, APU_DEV_PREVIEW_CI_ENABLED: "approved", APU_DEV_PREVIEW_CI_MODE: "once",
  APU_DEV_PREVIEW_CI_APPROVED_SHA: sha, CLOUDFLARE_ACCOUNT_ID: TARGET.account,
  CLOUDFLARE_API_TOKEN: "synthetic-cf-only", GITHUB_TOKEN: "synthetic-github-only" });
const bindings = () => ({ ...Object.fromEntries(Object.entries(ACCESS_VARS).map(([name,text]) => [name,{type:"plain_text",text}])),
  DEV_LOG_STATE:{type:"kv_namespace",namespace_id:TARGET.kv}, ASSETS:{type:"assets"} });
const preview = () => ({ id:TARGET.previewId, name:TARGET.preview, urls:[TARGET.url] });
const deployment = (fresh = false) => ({ id:fresh?"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee":"11111111-2222-3333-4444-555555555555",
  preview_id:TARGET.previewId, preview_name:TARGET.preview, env:bindings(), annotations:{"workers/commit_sha":fresh?sha:'0'.repeat(40)},
  urls:[`https://${fresh?"aaaaaaaa":"11111111"}-apu-ms-site.catsystem-exe.workers.dev`] });
const production = () => ({ deployments:[{id:"99999999-8888-7777-6666-555555555555", versions:[
  {version_id:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",percentage:70},
  {version_id:"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",percentage:30},
]}] });
function fixture() {
  const calls=[], args=[]; let uploaded=false;
  const io={ env:env(), head:async()=>sha, config:async()=>structuredClone(generated), clean:async()=>calls.push("clean"), wranglerContract:async()=>calls.push("contract"),
    branchHead:async()=>{calls.push("branch");return sha;}, preview:async()=>{calls.push("preview");return preview();},
    deployment:async()=>{calls.push("deployment");return deployment(uploaded);}, production:async()=>{calls.push("production");return production();},
    upload:async command=>{calls.push("upload");args.push(command);uploaded=true;return {preview:preview(),deployment:deployment(true)};},
    anonymous:async url=>{calls.push("anonymous");assert.ok([TARGET.url,deployment(true).urls[0]].includes(url));},
  };
  return {io,calls,args};
}

test("template is valid YAML and remains undiscoverable/inactive with no active workflow added",async()=>{
  assert.equal(workflow.name,"Guarded APU DEV Preview");
  assert.deepEqual(workflow.on,{push:{branches:[TARGET.branch]}});
  const files=await readdir(new URL("../.github/workflows",import.meta.url)).catch(error=>{if(error.code==='ENOENT')return [];throw error;});
  const activeFiles=files.filter(name=>/\.ya?ml$/i.test(name));
  // PREP must have no active file. Later, the guarded GitHub job can test its
  // identical installed copy without weakening the runtime deployment guards.
  const installedRun=process.env.GITHUB_ACTIONS==='true' && process.env.GITHUB_WORKFLOW_REF===`${TARGET.repository}/.github/workflows/dev-preview.yml@refs/heads/${TARGET.branch}`;
  if(installedRun){
    assert.equal(process.env.GITHUB_REPOSITORY,TARGET.repository);
    assert.equal(process.env.GITHUB_REF,`refs/heads/${TARGET.branch}`);
    assert.deepEqual(activeFiles,['dev-preview.yml']);
    assert.equal(await read('../.github/workflows/dev-preview.yml'),template,'installed workflow must exactly match reviewed template');
  }else assert.deepEqual(activeFiles,[],"PREP has no active workflows; no activation permitted");
  assert.equal(Object.keys(workflow.jobs).length,1);
  const job=workflow.jobs.preview;
  for(const value of ["github.repository == 'catsystemexe/APU_MS_site'","github.ref == 'refs/heads/codex/f1-f3-mvp-stabilization'","github.event_name == 'push'","github.event.deleted == false","vars.APU_DEV_PREVIEW_CI_ENABLED == 'approved'"]) assert.ok(job.if.includes(value));
  assert.equal(job.environment,"apu-dev-preview"); assert.equal(job['runs-on'],"ubuntu-24.04");
  assert.deepEqual(workflow.permissions,{contents:'read'});
  assert.deepEqual(workflow.concurrency,{group:'apu-ms-site-apu-pr60-e2e','cancel-in-progress':false});
  assert.equal((await read('../ops/ci/.node-version')).trim(),'24.19.0');
});
test("canonical build/security/config gates precede the single credential-bearing guard step",()=>{
  const steps=workflow.jobs.preview.steps;
  assert.equal(steps[0].with.ref,'${{ github.sha }}'); assert.equal(steps[0].with['persist-credentials'],false);
  assert.ok(steps.filter(s=>s.uses).every(s=>/@[a-f0-9]{40}$/.test(s.uses)));
  assert.equal(steps[1].with['node-version-file'],'ops/ci/.node-version');
  const commands=steps.filter(s=>s.run).map(s=>s.run.trim());
  assert.deepEqual(commands.slice(0,4),['npm ci','npm run typecheck','npm run build','npm run validate:artifact']);
  assert.match(commands[4],/^node --test tests\/dev-preview-ci\.test\.mjs/);
  for(const name of ['e2e-preview-preparation','deployment-config','access-control','server-capabilities','f1-response-contract'])assert.ok(commands[4].includes(`tests/${name}.test.mjs`));
  assert.equal(commands[5],'node ops/ci/dev-preview-guard.mjs --check-config');
  assert.equal(commands[6],'node ops/ci/dev-preview-guard.mjs --deploy-approved');
  assert.equal(commands.length,7);
  assert.deepEqual(steps.at(-1).env, {CLOUDFLARE_API_TOKEN:'${{ secrets.CLOUDFLARE_API_TOKEN }}',CLOUDFLARE_ACCOUNT_ID:'${{ vars.CLOUDFLARE_ACCOUNT_ID }}',GITHUB_TOKEN:'${{ github.token }}',APU_DEV_PREVIEW_CI_ENABLED:'${{ vars.APU_DEV_PREVIEW_CI_ENABLED }}',APU_DEV_PREVIEW_CI_MODE:'${{ vars.APU_DEV_PREVIEW_CI_MODE }}',APU_DEV_PREVIEW_CI_APPROVED_SHA:'${{ vars.APU_DEV_PREVIEW_CI_APPROVED_SHA }}'});
  assert.ok(steps.slice(0,-1).every(s=>!s.env));
  assert.equal(workflow.jobs.preview.env.CLOUDFLARE_API_TOKEN,undefined);
  assert.doesNotMatch(template,/pull_request|workflow_dispatch|wrangler\s+(deploy|versions)|upload-artifact|download-artifact/);
});
test("job authorization skips missing/unknown modes and unapproved once SHAs",()=>{
  // Evaluate this bounded GitHub condition, including its native case-insensitive
  // string equality. Runtime authorization independently requires exact values.
  const condition=workflow.jobs.preview.if.trim();
  const expression=condition.replace(/\b([a-zA-Z_][\w.]*)\s*==\s*('[^']*'|[a-zA-Z_][\w.]*)/g,'eq($1,$2)');
  assert.doesNotMatch(expression,/==|\$\{/);
  const evaluate=new Function('github','vars','eq',`return (${expression});`);
  const eq=(a,b)=>typeof a==='string'&&typeof b==='string'?a.toLowerCase()===b.toLowerCase():a===b;
  const github={repository:TARGET.repository,event_name:'push',event:{deleted:false},ref:`refs/heads/${TARGET.branch}`,sha};
  const vars={APU_DEV_PREVIEW_CI_ENABLED:'approved',APU_DEV_PREVIEW_CI_MODE:'once',APU_DEV_PREVIEW_CI_APPROVED_SHA:sha};
  assert.equal(evaluate(github,vars,eq),true);
  for(const patch of [{APU_DEV_PREVIEW_CI_MODE:undefined},{APU_DEV_PREVIEW_CI_MODE:'unknown'},
    {APU_DEV_PREVIEW_CI_APPROVED_SHA:undefined},{APU_DEV_PREVIEW_CI_APPROVED_SHA:'f'.repeat(40)},
    {APU_DEV_PREVIEW_CI_APPROVED_SHA:'1234'},{APU_DEV_PREVIEW_CI_APPROVED_SHA:'g'.repeat(40)},
    {APU_DEV_PREVIEW_CI_ENABLED:undefined},{APU_DEV_PREVIEW_CI_ENABLED:'disabled'}])assert.equal(evaluate(github,{...vars,...patch},eq),false);
  assert.equal(evaluate(github,{...vars,APU_DEV_PREVIEW_CI_MODE:'auto',APU_DEV_PREVIEW_CI_APPROVED_SHA:undefined},eq),true);
  for(const patch of [{repository:'fork/APU_MS_site'},{ref:'refs/heads/next'},{event_name:'pull_request'},{event:{deleted:true}}]){
    for(const mode of ['once','auto'])assert.equal(evaluate({...github,...patch},{...vars,APU_DEV_PREVIEW_CI_MODE:mode},eq),false);
  }
});
for(const [label,patch,reason] of [
  ['wrong approved SHA',{APU_DEV_PREVIEW_CI_APPROVED_SHA:'f'.repeat(40)},'source_sha_not_approved'],
  ['missing approved SHA',{APU_DEV_PREVIEW_CI_APPROVED_SHA:undefined},'invalid_approved_sha'],
  ['short approved SHA',{APU_DEV_PREVIEW_CI_APPROVED_SHA:'1234'},'invalid_approved_sha'],
  ['long approved SHA',{APU_DEV_PREVIEW_CI_APPROVED_SHA:sha+'0'},'invalid_approved_sha'],
  ['trailing newline in approved SHA',{APU_DEV_PREVIEW_CI_APPROVED_SHA:sha+'\n'},'invalid_approved_sha'],
  ['leading space in approved SHA',{APU_DEV_PREVIEW_CI_APPROVED_SHA:' '+sha},'invalid_approved_sha'],
  ['trailing newline in source SHA',{GITHUB_SHA:sha+'\n'},'invalid_source_sha'],
  ['non-hex approved SHA',{APU_DEV_PREVIEW_CI_APPROVED_SHA:'g'.repeat(40)},'invalid_approved_sha'],
  ['uppercase approved SHA',{APU_DEV_PREVIEW_CI_APPROVED_SHA:sha.toUpperCase()},'invalid_approved_sha'],
  ['missing mode',{APU_DEV_PREVIEW_CI_MODE:undefined},'invalid_ci_mode'],
  ['unknown mode',{APU_DEV_PREVIEW_CI_MODE:'unknown'},'invalid_ci_mode'],
  ['uppercase mode',{APU_DEV_PREVIEW_CI_MODE:'ONCE'},'invalid_ci_mode'],
  ['disabled gate',{APU_DEV_PREVIEW_CI_ENABLED:'disabled'},'ci_not_activated'],
])test(`runtime authorization rejects before upload: ${label}`,async()=>{
  const f=fixture();Object.assign(f.io.env,patch);const before=structuredClone(f.io.env);
  await assert.rejects(updateExistingPreview(f.io),{message:reason});
  assert.equal(f.args.length,0);assert.deepEqual(f.calls,[]);assert.deepEqual(f.io.env,before);
});
test("auto needs no approved SHA and retains production checks without changing its mode",async()=>{
  const f=fixture();f.io.env.APU_DEV_PREVIEW_CI_MODE='auto';delete f.io.env.APU_DEV_PREVIEW_CI_APPROVED_SHA;
  const before=structuredClone(f.io.env);await updateExistingPreview(f.io);
  assert.equal(f.args.length,1);assert.equal(f.calls.filter(x=>x==='production').length,2);assert.deepEqual(f.io.env,before);
});
test("auto still enforces activation, branch, target, source, isolation and production preflight",async()=>{
  for(const change of [f=>delete f.io.env.APU_DEV_PREVIEW_CI_ENABLED,f=>f.io.env.GITHUB_REF='refs/heads/next',
    f=>f.io.preview=async()=>null,f=>f.io.branchHead=async()=>'f'.repeat(40),
    f=>f.io.deployment=async()=>({...deployment(),env:{...bindings(),EXTRA:{type:'inherit'}}}),
    f=>f.io.production=async()=>({deployments:[]})]){
    const f=fixture();f.io.env.APU_DEV_PREVIEW_CI_MODE='auto';change(f);
    await assert.rejects(updateExistingPreview(f.io));assert.equal(f.args.length,0);
  }
});
test("once rejects a matching verified latest source at either preflight read",async()=>{
  for(const matchingRead of [1,2]){
    const f=fixture();let reads=0;
    f.io.deployment=async()=>{const d=deployment();if(++reads===matchingRead)d.annotations['workers/commit_sha']=sha;return d;};
    await assert.rejects(updateExistingPreview(f.io),{message:'approved_sha_already_deployed'});
    assert.equal(f.args.length,0);assert.equal(f.io.env.APU_DEV_PREVIEW_CI_MODE,'once');
  }
});
test("successful once remains SHA-bound and rejects a rerun against the updated Preview",async()=>{
  const f=fixture(),before=structuredClone(f.io.env);await updateExistingPreview(f.io);
  assert.deepEqual(f.io.env,before);assert.equal(f.args.length,1);
  await assert.rejects(updateExistingPreview(f.io),{message:'approved_sha_already_deployed'});
  assert.equal(f.args.length,1);assert.deepEqual(f.io.env,before);
});
test("only fixed Preview arguments are accepted; every requested option is supported by installed Wrangler",()=>{
  const help=execFileSync(process.execPath,[fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url)),'preview','--help'],{
    encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false'},timeout:15000,
  });
  assert.equal(JSON.parse(require('node:fs').readFileSync(new URL('../node_modules/wrangler/package.json',import.meta.url),'utf8')).version,'4.150.0');
  for(const flag of ['--config','--worker-name','--name','--ignore-base-config','--json'])assert.ok(help.includes(flag),flag);
  assert.deepEqual(previewArgs(),['--no-install','wrangler','preview','--config','dist/server/wrangler.json','--worker-name',TARGET.worker,'--name',TARGET.preview,'--ignore-base-config','--json']);
  for(const command of [previewArgs().filter(x=>x!=='--ignore-base-config'),[...previewArgs(),'--unsupported-flag'],['wrangler','deploy'],['wrangler','versions','upload'],previewArgs().map(x=>x===TARGET.worker?'other-worker':x),previewArgs().map(x=>x===TARGET.preview?'replacement-preview':x)])assert.throws(()=>validateCommand(command));
});
test("valid generated artifact is accepted without inheriting its top-level production resources",()=>{
  assert.doesNotThrow(()=>validateConfig(generated));
  assert.equal(generated.kv_namespaces[0].id,'4a24c791d31a4c0983170c921cb744aa');
  assert.deepEqual(generated.previews.kv_namespaces,[{binding:'DEV_LOG_STATE',id:TARGET.kv}]);
});

const changes = [
  ['wrong branch',f=>f.io.env.GITHUB_REF='refs/heads/next'], ['fork repository',f=>f.io.env.GITHUB_REPOSITORY='fork/APU_MS_site'],
  ['PR event',f=>f.io.env.GITHUB_EVENT_NAME='pull_request'], ['inactive flag',f=>delete f.io.env.APU_DEV_PREVIEW_CI_ENABLED],
  ['missing token',f=>delete f.io.env.CLOUDFLARE_API_TOKEN], ['missing GitHub token',f=>delete f.io.env.GITHUB_TOKEN],
  ['wrong account',f=>f.io.env.CLOUDFLARE_ACCOUNT_ID='other'], ['provider credentials',f=>f.io.env.OPENAI_API_KEY='synthetic-forbidden'],
  ['wrong checkout',f=>f.io.head=async()=> 'f'.repeat(40)], ['advanced source',f=>f.io.branchHead=async()=> 'f'.repeat(40)],
  ['dirty source',f=>f.io.clean=async()=>{throw Error('dirty');}], ['unsupported Wrangler',f=>f.io.wranglerContract=async()=>{throw Error('version');}],
  ['missing Preview',f=>f.io.preview=async()=>null], ['wrong Preview ID',f=>f.io.preview=async()=>({...preview(),id:'replacement'})],
  ['wrong Preview name',f=>f.io.preview=async()=>({...preview(),name:'other'})], ['wrong Preview URL',f=>f.io.preview=async()=>({...preview(),urls:['https://production.invalid']})],
  ['missing latest bindings',f=>f.io.deployment=async()=>({...deployment(),env:undefined})],
  ['inherited remote binding',f=>f.io.deployment=async()=>({...deployment(),env:{...bindings(),EXTRA:{type:'inherit'}}})],
  ['remote provider secret',f=>f.io.deployment=async()=>({...deployment(),env:{...bindings(),OPENAI_API_KEY:{type:'secret_text'}}})],
  ['missing production',f=>f.io.production=async()=>({deployments:[]})], ['unavailable production',f=>f.io.production=async()=>{throw Error('unavailable');}],
];
for(const [label,change]of changes)test(`fails before upload: ${label}`,async()=>{
  const f=fixture();change(f);await assert.rejects(updateExistingPreview(f.io));assert.equal(f.calls.includes('upload'),false);
});
for(const [label,mutate]of [
  ['wrong Worker',c=>c.name='other-worker'], ['production KV',c=>c.previews.kv_namespaces[0].id='4a24c791d31a4c0983170c921cb744aa'],
  ['legacy preview_id',c=>c.previews.kv_namespaces[0].preview_id='8dd4e8a10dc74086bbd746e733b3d8d8'],
  ['inherited config',c=>delete c.previews], ['missing Access',c=>delete c.previews.vars.CF_ACCESS_AUD],
  ['bypass',c=>c.previews.vars.APU_LOCAL_DEV_AUTH='1'], ['provider var',c=>c.previews.vars.OPENAI_API_KEY='synthetic-forbidden'],
  ['unknown Preview resources',c=>c.previews.d1_databases=[{binding:'db',database_id:'unknown'}]],
  ['unknown generated resources',c=>c.custom_resources={id:'unknown'}], ['top-level inherited fallback',c=>c.services=[{binding:'production',service:'other'}]],
  ['Wrangler secondary build',c=>c.build={command:'unexpected command'}],
])test(`generated isolation fails before upload: ${label}`,async()=>{
  const f=fixture(),c=structuredClone(generated);mutate(c);f.io.config=async()=>c;
  await assert.rejects(updateExistingPreview(f.io));assert.equal(f.calls.includes('upload'),false);
});
test("source/target are checked again immediately before upload",async()=>{
  for(const resource of ['branchHead','preview','config','head','clean']){
    const f=fixture(),original=f.io[resource];let count=0;
    f.io[resource]=async()=>{if(++count===2)throw Error('changed during preflight');return original();};
    await assert.rejects(updateExistingPreview(f.io));assert.equal(f.calls.includes('upload'),false);
  }
});
test("Wrangler adapter strips credential/base/output overrides and suppresses raw failures",async()=>{
  const calls=[],input={...env(),PATH:'/synthetic/bin',CLOUDFLARE_API_BASE_URL:'https://forbidden.invalid',WRANGLER_OUTPUT_FILE_PATH:'/forbidden',OPENAI_API_KEY:'synthetic-forbidden'};
  const io=liveIO(input,{execute:async(command,args,options)=>{calls.push({command,args,options});return {stdout:JSON.stringify({preview:preview(),deployment:deployment(true)})};}});
  assert.deepEqual(await io.upload(previewArgs()),{preview:preview(),deployment:deployment(true)});
  assert.equal(calls.length,1);assert.equal(calls[0].command,'npx');assert.deepEqual(calls[0].args,previewArgs());
  const passed=calls[0].options.env;
  assert.deepEqual(Object.keys(passed).sort(),['PATH','GITHUB_SHA','GITHUB_REPOSITORY','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN','CI','GITHUB_SERVER_URL','WRANGLER_SEND_METRICS','WRANGLER_WRITE_LOGS'].sort());
  assert.equal(passed.CLOUDFLARE_API_TOKEN,input.CLOUDFLARE_API_TOKEN);
  await assert.rejects(io.upload([...previewArgs(),'--secrets-file','forbidden']));assert.equal(calls.length,1);
  const failure=liveIO(env(),{execute:async()=>{throw Error('SYNTHETIC_PRIVATE_PROVIDER_OR_TOKEN_DETAIL');}});
  await assert.rejects(failure.upload(previewArgs()),error=>error.message==='preview_upload_failed_output_suppressed');
});
test("single successful Preview update validates remote source/bindings/URLs and compares live production allocations",async()=>{
  const f=fixture(),result=await updateExistingPreview(f.io);
  assert.equal(f.args.length,1);assert.deepEqual(f.args[0],previewArgs());
  assert.equal(f.calls.filter(x=>x==='production').length,2);
  assert.equal(f.calls.filter(x=>x==='anonymous').length,2);
  assert.equal(f.calls.filter(x=>x==='branch').length,3);
  assert.equal(f.calls.at(-1),'production');assert.equal(result.source,sha);assert.equal(result.previewId,TARGET.previewId);
  assert.equal(JSON.stringify(result).includes('synthetic-cf-only'),false);
  assert.deepEqual(productionState(production()).versions.map(x=>x.percentage),[70,30],"actual split accepted; no historical single-version constant");
});
for(const cause of ['upload','postflight binding','postflight SHA','anonymous Access','postflight source'])test(`post-update ${cause} failure still checks production and never retries/rolls back`,async()=>{
  const f=fixture();
  if(cause==='upload')f.io.upload=async()=>{f.calls.push('upload');throw Error('synthetic');};
  if(cause==='postflight binding'||cause==='postflight SHA'){
    const original=f.io.deployment;f.io.deployment=async()=>{const d=await original();if(f.calls.includes('upload')){if(cause==='postflight binding')d.env.EXTRA={type:'secret_text'};else d.annotations['workers/commit_sha']='f'.repeat(40);}return d;};
  }
  if(cause==='anonymous Access')f.io.anonymous=async()=>{throw Error('unprotected');};
  if(cause==='postflight source'){let count=0;f.io.branchHead=async()=>++count===3?'f'.repeat(40):sha;}
  await assert.rejects(updateExistingPreview(f.io));assert.equal(f.calls.at(-1),'production');assert.equal(f.calls.filter(x=>x==='upload').length,1);
});
for(const change of [result=>result.deployments[0].versions[0].percentage=60,result=>result.deployments[0].versions[0].version_id='cccccccc-cccc-cccc-cccc-cccccccccccc',result=>result.deployments=[]])test("changed or unavailable postflight production is CRITICAL; no rollback",async()=>{
  const f=fixture();let n=0;f.io.production=async()=>{f.calls.push('production');const p=production();if(++n===2)change(p);return p;};
  await assert.rejects(updateExistingPreview(f.io),/CRITICAL_production_preservation/);assert.equal(f.args.length,1);
});
test("production schema rejects missing, duplicate or invalid traffic evidence",()=>{
  for(const result of [{}, {deployments:[]}, {deployments:[{id:'unknown',versions:[]}]}, {deployments:[{...production().deployments[0],versions:[{version_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',percentage:99}]}]}])assert.throws(()=>productionState(result));
  const p=production();p.deployments[0].versions.push(p.deployments[0].versions[0]);assert.throws(()=>productionState(p));
});
test("read-only transports use supported fixed API paths; anonymous checks never receive deployment credentials",async t=>{
  const requests=[];t.mock.method(globalThis,'fetch',async(url,init)=>{
    requests.push({url,init});
    if(url.startsWith('https://api.github.com/'))return Response.json({object:{sha}});
    if(url===TARGET.url)return new Response(null,{status:302,headers:{Location:TARGET.issuer+'/cdn-cgi/access/login/fixture'}});
    return Response.json({success:true,result:url.endsWith('/deployments/latest')?deployment():url.endsWith('/deployments')?production():preview()});
  });
  const io=liveIO(env());await io.branchHead();await io.preview();await io.deployment();await io.production();await io.anonymous(TARGET.url);
  assert.deepEqual(requests.slice(1,4).map(x=>x.url),[
    `https://api.cloudflare.com/client/v4/accounts/${TARGET.account}/workers/workers/${TARGET.worker}/previews/${TARGET.preview}`,
    `https://api.cloudflare.com/client/v4/accounts/${TARGET.account}/workers/workers/${TARGET.worker}/previews/${TARGET.preview}/deployments/latest`,
    `https://api.cloudflare.com/client/v4/accounts/${TARGET.account}/workers/scripts/${TARGET.worker}/deployments`,
  ]);
  assert.ok(requests.slice(0,4).every(x=>x.init.method==='GET'));
  assert.equal(requests.at(-1).init.headers,undefined);assert.equal(requests.at(-1).init.redirect,'manual');assert.equal(requests.at(-1).init.credentials,'omit');
  for(const response of [Response.json({}, {status:200}),new Response(null,{status:302,headers:{Location:'https://other.invalid/login'}})]){
    t.mock.method(globalThis,'fetch',async()=>response);await assert.rejects(io.anonymous(TARGET.url));
  }
});
