import assert from "node:assert/strict";
import test, { after } from "node:test";
import { build } from "esbuild";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { authorizedModelPayload } from "../app/server-capabilities.ts";
import { fallbackQuestController } from "../app/dialog-action.ts";
import { createF2BuildState, createF2BuildRequest, applyF2BuildResult, createF2PreviewSnapshot, createF2ToF3Snapshot, createCurrentRozborState, createCurrentRozborGenerationRequest } from "../app/f2-build-model.ts";
import { createF3RenderRequest, createF3State } from "../app/f3-finalization-model.ts";

// Actual server authentication, routes, validation and instrumentation. Only the
// Next request-context import and provider/JWKS transport are test doubles.
const root = fileURLToPath(new URL("..", import.meta.url));
const artifacts = await mkdtemp(join(tmpdir(), "apu-server-capabilities-"));
after(() => rm(artifacts, { recursive: true, force: true }));
const handlers = {};
for (const name of ["chat", "extract", "analysis", "need-route", "f2", "f3", "session", "devlog-state"]) {
  const outfile = join(artifacts, name + ".mjs");
  await build({ entryPoints: [join(root, `app/api/${name}/route.ts`)], outfile, bundle: true, platform: "node", format: "esm", logLevel: "silent",
    plugins: [{ name: "provider-free-server-boundaries", setup(plugin) {
      plugin.onResolve({ filter: /dev-log-data$/ }, () => ({ path: "dev-log-data", namespace: "test-log" }));
      plugin.onLoad({ filter: /.*/, namespace: "test-log" }, () => ({ contents: "export function loadDevLog(){return {data:{items:[]}}}", loader: "js" }));
      plugin.onResolve({ filter: /^next\/headers$/ }, () => ({ path: "headers", namespace: "fixture" }));
      plugin.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const headers=()=>{throw Error('No request-context bypass permitted')};", loader: "js" }));
      plugin.onResolve({ filter: /openai-responses-instrumentation$/ }, () => ({ path: "collector", namespace: "observe" }));
      plugin.onLoad({ filter: /.*/, namespace: "observe" }, () => ({ contents: `export * from ${JSON.stringify(join(root,"app/openai-responses-instrumentation.ts"))}; import {createRequestUsageCollector as original} from ${JSON.stringify(join(root,"app/openai-responses-instrumentation.ts"))}; export function createRequestUsageCollector(){const c=original();globalThis.__envS1Collectors.push(c);return c;}`, resolveDir: root, loader: "js" }));
      plugin.onResolve({ filter: /\.md\?raw$/ }, args => ({ path: join(dirname(args.importer), args.path.replace(/\?raw$/, "")), namespace: "raw" }));
      plugin.onLoad({ filter: /.*/, namespace: "raw" }, async args => ({ contents: `export default ${JSON.stringify((await readFile(args.path,"utf8")).replace(/\r\n/g,"\n"))}`, loader: "js" }));
    } }],
  });
  handlers[name] = await import(pathToFileURL(outfile).href);
}

const issuer = "https://env-s1.cloudflareaccess.com", audience = "synthetic-env-s1-audience", kid = "env-s1";
const keyPair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: "SHA-256" }, true, ["sign","verify"]);
const jwk = { ...await crypto.subtle.exportKey("jwk",keyPair.publicKey), kid, alg: "RS256", use: "sig" };
const usage = { input_tokens: 100, output_tokens: 10, total_tokens: 110 };
const privateDetail = "PRIVATE_PROVIDER_DETAIL token_cost=999";
const need = { needId: "n", needText: "Understand the situation.", initialF2Path: "POCHOPIT", f3Target: null };
const hypothesis = { id: "h", rank: 1, title: "Possibility", summary: "Uncertain explanation.", relevantNeeds: ["n"], question: null, questions: [], supportingInformation: [], limitations: ["Limited evidence."], unknowns: [] };
const buildResult = { hypotheses: [hypothesis], pathResult: { kind: "understanding", relationships: [], comparisons: [], expertFrame: [], synthesis: "Provisional synthesis." }, decisions: [], uncertainties: [], missingInformation: [] };
const buildState = createF2BuildState(need, [], [hypothesis]);
const current = createCurrentRozborState().POCHOPIT;
const componentRequest = createCurrentRozborGenerationRequest("POCHOPIT",need,[hypothesis],{...current.config,expansionDepth:1},[]);
const notebook = [{ id: "f", category: "manifestations", text: "Observation.", trust: "confirmed" }, { id: "n", category: "goals", text: need.needText, trust: "confirmed", needMapping: { f2Path: "POCHOPIT", f3Target: null } }];
const material = { title: "Output", introduction: "Accepted source.", sections: [{ heading: "Context", content: "Uncertainty is retained." }], table: null, cards: [], usageNote: null };
const cases = [
  { name: "chat", route: "chat", body: { message: "Observation.", notebook, phase: "intake" }, field: "done" },
  { name: "extract", route: "extract", body: { message: "Observation.", notebook: [] }, field: "extraction" },
  { name: "analysis", route: "analysis", body: { notebook, canonicalNeed: need }, field: "analysis" },
  { name: "need-route", route: "need-route", body: { needText: need.needText }, field: "decision" },
  { name: "f2-build", route: "f2", body: { operation: "build", build: createF2BuildRequest(buildState,[]) }, field: "result" },
  { name: "f2-preview", route: "f2", body: { operation: "preview", snapshot: createF2PreviewSnapshot(applyF2BuildResult(buildState,buildResult,"POCHOPIT",0)) }, field: "result" },
  { name: "f2-components", route: "f2", body: { operation: "generate-rozbor-components", request: componentRequest }, field: "components" },
  { name: "f3", route: "f3", body: createF3RenderRequest(createF3State(createF2ToF3Snapshot(need,[hypothesis],"POCHOPIT",current,0))), field: "result" },
];

async function token(email) {
  const part = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${part({alg:"RS256",kid})}.${part({iss:issuer,aud:audience,email,exp:Math.floor(Date.now()/1000)+300})}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5",keyPair.privateKey,new TextEncoder().encode(unsigned));
  return unsigned+"."+Buffer.from(signature).toString("base64url");
}
function fixture(t, { emptyAllowlist = false, mode = "success", runtimeMode = "DEV" } = {}) {
  const vars = { APU_RUNTIME_MODE:runtimeMode, NODE_ENV:"production", APU_LOCAL_DEV_AUTH:"0", CF_ACCESS_TEAM_DOMAIN:issuer, CF_ACCESS_AUD:audience, APU_DEVELOPER_EMAILS:emptyAllowlist?"":"developer@example.com", OPENAI_API_KEY:"synthetic-only", APU_VECTOR_STORE_ID:"synthetic-only" };
  const saved = new Map(Object.keys(vars).map(key=>[key,process.env[key]]));
  const originalCollectors = Object.getOwnPropertyDescriptor(globalThis,"__envS1Collectors");
  const collectors = globalThis.__envS1Collectors = [];
  Object.assign(process.env,vars);
  t.after(()=>{for(const[key,value]of saved){if(value===undefined)delete process.env[key];else process.env[key]=value;}if(originalCollectors)Object.defineProperty(globalThis,"__envS1Collectors",originalCollectors);else delete globalThis.__envS1Collectors;});
  const calls = [];
  t.mock.method(globalThis,"fetch",async(url,init)=>{
    if(String(url)===issuer+"/cdn-cgi/access/certs") return Response.json({keys:[jwk]});
    assert.equal(String(url),"https://api.openai.com/v1/responses","no external transport allowed");
    const p=JSON.parse(init.body); calls.push(p);
    const response={id:"synthetic-"+calls.length,status:"completed",model:p.model,service_tier:"default",usage};
    if(p.stream){
      if(mode==="transport")throw Error(privateDetail);
      if(mode==="http-failure")return Response.json({error:{message:privateDetail,code:"fixture_failure"},usage},{status:429});
      if(mode==="missing-body")return new Response(null,{status:200});
      if(mode==="interrupted") {let n=0;return new Response(new ReadableStream({pull(c){if(n++===0)c.enqueue(new TextEncoder().encode('data: '+JSON.stringify({type:"response.output_text.delta",delta:"Ordinary reply."})+'\n\n'));else c.error(Error(privateDetail));}}));}
      const events=[{type:"response.output_text.delta",delta:"Ordinary reply."}];
      if(mode==="incomplete"||mode==="failed")events.push({type:"response."+mode,response:{...response,status:mode,error:{message:privateDetail}}});
      else if(mode==="stream-error")events.push({type:"error",message:privateDetail,code:"fixture_failure"});
      else if(mode!=="unterminated"&&mode!=="malformed-stream")events.push({type:"response.completed",response});
      return new Response(mode==="malformed-stream"?'data: {broken\n\n':events.map(e=>'data: '+JSON.stringify(e)+'\n\n').join(''),{headers:{"Content-Type":"text/event-stream"}});
    }
    if(mode==="transport")throw Error(privateDetail);
    if(mode==="http-failure"||(mode==="controller-failure"&&p.text?.format.name==="apu_quest_controller"))return Response.json({error:{message:privateDetail,code:"fixture_failure"},usage},{status:429});
    if(mode==="incomplete")return Response.json({...response,status:"incomplete",incomplete_details:{reason:"max_output_tokens"}});
    const format=p.text.format.name;
    let result;
    if(format==="apu_quest_controller"){
      const context=JSON.parse(p.input[1].content[0].text);
      result={...fallbackQuestController(context.currentNotebook,context.phase),chat_navigation_event:"none"};
    } else if(format==="apu_notepad_extraction")result={situationRelation:"same",situationReason:null,categoryReview:{manifestations:"none",goals:"none",context:"none",course:"none",helps:"none"},candidates:[]};
    else if(format.startsWith("apu_phase_2"))result={hypotheses:[{...hypothesis,question:null}],needs:[{needId:"n",title:need.needText,direction:"Understand.",relevantHypotheses:["h"],question:null}],mainUncertainty:"Limited evidence.",chatUpdate:{kind:"entry",summary:"Provisional analysis.",nextPrompt:null},transitionReady:true};
    else if(format==="apu_f2_need_route")result={path:"POCHOPIT",clarification:null};
    else if(format.endsWith("_build"))result=buildResult;
    else if(format.endsWith("_preview"))result=material;
    else if(format.endsWith("_components"))result={components:Object.fromEntries(componentRequest.components.map(c=>[c.id,"Accepted expansion."]))};
    else if(format.endsWith("_final_render"))result={kind:"material",material,boundaryIssue:null};
    else throw Error("Unexpected format: "+format);
    return Response.json({...response,output_text:mode==="invalid-output"?"{invalid":JSON.stringify(result)});
  });
  const invoke=async(c,{email="teacher@example.com",model,body={},headers={}}={})=>{
    const request=new Request(`https://apu.invalid/api/${c.route}`,{method:"POST",headers:{"Content-Type":"application/json",...(email?{"cf-access-jwt-assertion":await token(email)}:{}),...headers},body:JSON.stringify({...c.body,...(model===undefined?{}:{model}),...body})});
    const response=await handlers[c.route].POST(request);
    const payload=c.route==="chat"&&response.status===200?(await response.text()).trim().split("\n").map(JSON.parse):await response.json();
    return {response,payload};
  };
  return {invoke,calls,collectors};
}
function assertPublic(payload) {
  const records=Array.isArray(payload)?payload:[payload];
  for(const p of records)for(const key of ["model_usage_records","diagnostics","diagnostic","telemetry","controllerDiagnostics"])assert.equal(Object.hasOwn(p,key),false,key);
  assert.doesNotMatch(JSON.stringify(payload),/PRIVATE_PROVIDER_DETAIL|token_cost|pricing_snapshot|estimatedCostUsd|cached_input_tokens/);
}

test("diagnostic envelope filtering defaults closed and never rewrites pedagogical content",()=>{
  const content={sections:[{heading:"telemetry",content:"diagnostics is ordinary quoted content"}]};
  const payload={result:content,model_usage_records:[1],diagnostics:{inputTokens:100},diagnostic:"private",telemetry:{},controllerDiagnostics:{}};
  assert.deepEqual(authorizedModelPayload(payload),{result:content});
  assert.deepEqual(authorizedModelPayload(payload,{role:"tester"}),{result:content});
  assert.equal(authorizedModelPayload(payload,{role:"developer"}),payload);
  assert.equal(payload.model_usage_records.length,1);
});
test("anonymous requests cannot reach any model route",async t=>{
  const f=fixture(t);
  for(const c of cases){const{response,payload}=await f.invoke(c,{email:null,model:"gpt-5.6-sol"});assert.equal(response.status,401,c.name);assertPublic(payload);}
  const catalog=await handlers.chat.GET(new Request("https://apu.invalid/api/chat"));
  assert.equal(catalog.status,401);assert.equal((await catalog.json()).models,undefined);
  assert.equal(f.calls.length,0);assert.equal(f.collectors.length,0);
});
for(const emptyAllowlist of [false,true])test(`manual selection is denied before provider calls; forged roles do not grant privilege (empty=${emptyAllowlist})`,async t=>{
  const f=fixture(t,{emptyAllowlist});
  for(const c of cases.filter(c=>["chat","f2","f3"].includes(c.route)))for(const model of ["gpt-5.6-sol","gpt-5.6-terra","gpt-5.6-luna"]){
    const{response,payload}=await f.invoke(c,{email:emptyAllowlist?"developer@example.com":"teacher@example.com",model,body:{role:"developer",isDeveloper:true},headers:{"x-role":"developer","x-fixture-role":"developer"}});
    assert.equal(response.status,403,c.name);assertPublic(payload);
  }
  assert.equal(f.calls.length,0);assert.equal(f.collectors.length,0);
});
test("unauthorized manual overrides remain forbidden when provider configuration is absent",async t=>{
  const f=fixture(t);delete process.env.OPENAI_API_KEY;delete process.env.APU_VECTOR_STORE_ID;
  for(const c of cases.filter(c=>["chat","f2","f3"].includes(c.route))){const{response,payload}=await f.invoke(c,{model:"gpt-5.6-sol"});assert.equal(response.status,403,c.name);assertPublic(payload);}
  assert.equal(f.calls.length,0);assert.equal(f.collectors.length,0);
});
for(const developer of [false,true])for(const mode of ["success","http-failure","invalid-output","transport","incomplete"])test(`JSON/stream response authorization developer=${developer} outcome=${mode}`,async t=>{
  const f=fixture(t,{mode});
  for(const c of cases){
    await t.test(c.name,async()=>{
      const start=f.calls.length;
      const{response,payload}=await f.invoke(c,{email:developer?"developer@example.com":"teacher@example.com"});
      if(c.route!=="chat")assert.equal(response.status,mode==="success"?200:502);
      const terminal=c.route==="chat"?payload.find(e=>e.type===(mode==="success"||mode==="invalid-output"?"done":"error")):payload;
      assert.ok(terminal,JSON.stringify(payload));
      if(developer){assert.ok(terminal.model_usage_records.length>0);assert.ok(terminal.model_usage_records.every(r=>r.call_id&&r.pricing_snapshot));if(c.route==="chat"&&mode==="http-failure")assert.equal(terminal.message,privateDetail);}
      else assertPublic(payload);
      if(mode==="success")assert.ok(c.route==="chat"?payload.some(e=>e.type==="delta"&&e.text):payload[c.field]);
      const internal=f.collectors.at(-1).records();
      assert.equal(internal.length,f.calls.length-start,"all internal call records retained");
      assert.ok(internal.every(r=>r.completed_at&&r.call_id));
      assert.ok(internal.some(r=>r.provider_status!=='unknown'));
      if(mode==="success")assert.ok(internal.every(r=>r.pricing_snapshot.status==="priced"));
    });
  }
});
for(const developer of [false,true])for(const mode of ["missing-body","failed","stream-error","unterminated","malformed-stream","interrupted","controller-failure"])test(`stream terminal path developer=${developer} outcome=${mode}`,async t=>{
  const f=fixture(t,{mode});const{payload}=await f.invoke(cases[0],{email:developer?"developer@example.com":"teacher@example.com"});
  const terminal=payload.find(e=>e.type===(mode==="controller-failure"?"done":"error"));assert.ok(terminal);
  if(developer){assert.equal(terminal.model_usage_records.length,f.calls.length);if(mode==="stream-error")assert.equal(terminal.message,privateDetail);}
  else assertPublic(payload);
  const records=f.collectors[0].records();assert.equal(records.length,f.calls.length);assert.ok(records.every(r=>r.completed_at));
});
test("automatic/default routing and supported DEV overrides retain the existing model policy",async t=>{
  const f=fixture(t);
  for(const c of cases.filter(c=>["chat","f2","f3"].includes(c.route))){
    for(const model of [undefined,"auto"]){const start=f.calls.length;const{response,payload}=await f.invoke(c,{model});assert.equal(response.status,200);assertPublic(payload);assert.equal(f.calls.at(-1).model,c.route==="chat"?"gpt-5.6-luna":"gpt-5.6-terra");assert.ok(f.calls.length>start);}
    for(const model of ["gpt-5.6-sol","gpt-5.6-luna","gpt-5.6-terra"]){const{response}=await f.invoke(c,{email:"developer@example.com",model});assert.equal(response.status,200);assert.equal(f.calls.at(-1).model,model);}
  }
  const{payload}=await f.invoke(cases[0],{body:{phase:"development"}});assertPublic(payload);assert.equal(f.calls.at(-1).model,"gpt-5.6-terra");
});
test("empty STABLE developer allowlist preserves successful ordinary output on every route",async t=>{
  const f=fixture(t,{emptyAllowlist:true});
  for(const c of cases){const{response,payload}=await f.invoke(c,{email:"developer@example.com"});assert.equal(response.status,200,c.name);assertPublic(payload);assert.ok(c.route==="chat"?payload.some(e=>e.type==="done"):payload[c.field]);}
});
test("malformed JSON/body and invalid chat model retain input errors without provider calls",async t=>{
  const f=fixture(t);
  for(const name of ["chat","f2","f3"]){
    for(const text of ['{broken','null','[]']){const response=await handlers[name].POST(new Request(`https://apu.invalid/api/${name}`,{method:"POST",headers:{"cf-access-jwt-assertion":await token("teacher@example.com")},body:text}));assert.equal(response.status,400);assertPublic(await response.json());}
  }
  const{response}=await f.invoke(cases[0],{model:{invalid:true}});assert.equal(response.status,400);assert.equal(f.calls.length,0);
});

for (const emptyAllowlist of [false, true]) test(`session revalidation is authenticated, minimal and no-store (empty=${emptyAllowlist})`, async t => {
  const f = fixture(t, { emptyAllowlist });
  for (const email of [null, "teacher@example.com", "developer@example.com"]) {
    const response = await handlers.session.GET(new Request("https://apu.invalid/api/session", { headers: {
      ...(email ? {"cf-access-jwt-assertion": await token(email)} : {}), "x-role": "developer",
    } }));
    assert.equal(response.status, email ? 200 : 401);
    assert.match(response.headers.get("cache-control"), /no-store/);
    const payload = await response.json();
    assert.deepEqual(payload, email ? { email, isDeveloper: !emptyAllowlist && email === "developer@example.com" } : { error: "Přihlášení není platné." });
  }
  assert.equal(f.calls.length, 0); assert.equal(f.collectors.length, 0);
});

test("session verification configuration outage returns recoverable 503 rather than confirmed logout", async t => {
  const f = fixture(t);
  const previous = process.env.CF_ACCESS_AUD;
  delete process.env.CF_ACCESS_AUD;
  t.after(() => { process.env.CF_ACCESS_AUD = previous; });
  const response = await handlers.session.GET(new Request("https://apu.invalid/api/session"));
  assert.equal(response.status, 503);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.deepEqual(await response.json(), { error: "Přihlášení nyní nelze ověřit." });
  assert.equal(f.calls.length, 0);
});

for (const runtimeMode of ["PUBLIC", "unknown", ""]) test(`PUBLIC policy denies allowlisted developer operations (mode=${runtimeMode || "empty"})`, async t => {
  const f = fixture(t, { runtimeMode });
  for (const c of cases.filter(c => ["chat", "f2", "f3"].includes(c.route))) {
    const before = f.calls.length;
    const { response, payload } = await f.invoke(c, { email: "developer@example.com", model: "gpt-5.6-sol" });
    assert.equal(response.status, 403, c.name);
    assertPublic(payload);
    assert.equal(f.calls.length, before, "denied override must not call provider");
  }
  for (const c of cases) {
    const { response, payload } = await f.invoke(c, { email: "developer@example.com" });
    assert.equal(response.status, 200, c.name);
    assertPublic(payload);
  }
  const headers = { "cf-access-jwt-assertion": await token("developer@example.com"), "x-role": "developer" };
  const session = await handlers.session.GET(new Request("https://apu.invalid/api/session", { headers }));
  assert.deepEqual(await session.json(), { email: "developer@example.com", isDeveloper: false });
  for (const method of ["GET", "PATCH"]) {
    const response = await handlers["devlog-state"][method](new Request("https://apu.invalid/api/devlog-state", { method, headers, ...(method === "PATCH" ? { body: JSON.stringify({ id: "test", status: "done" }) } : {}) }));
    assert.equal(response.status, 403);
  }
});

test("missing runtime configuration denies privileges despite local developer authentication", async t => {
  fixture(t);
  delete process.env.APU_RUNTIME_MODE;
  process.env.NODE_ENV = "development";
  process.env.APU_LOCAL_DEV_AUTH = "1";
  const response = await handlers.session.GET(new Request("http://localhost/api/session"));
  assert.deepEqual(await response.json(), { email: "local-development@apu.invalid", isDeveloper: false });
});
