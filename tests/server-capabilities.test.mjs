import { createPilot } from "../app/telemetry/pilot.ts";
import { createDocumentObserver } from "../app/telemetry/document-observer.ts";
import { EmulatedTelemetryD1 } from "./helpers/telemetry-sql.mjs";
import { acceptedPilotRulesBindingsPlugin } from "./pilot-rules-fixture.mjs";
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
import { acceptF3Render, updateF3Config, createF3RenderRequest, createF3State } from "../app/f3-finalization-model.ts";

// Actual server authentication, routes, validation and instrumentation. Only the
// Next request-context import, accepted-rules store and provider/JWKS transport are test doubles.
const root = fileURLToPath(new URL("..", import.meta.url));
const artifacts = await mkdtemp(join(tmpdir(), "apu-server-capabilities-"));
after(() => rm(artifacts, { recursive: true, force: true }));
const handlers = {};
for (const name of ["chat", "extract", "analysis", "need-route", "f2", "f3", "session"]) {
  const outfile = join(artifacts, name + ".mjs");
  await build({ stdin: { contents: `export * from './app/api/${name}/route.ts'; export * from './app/telemetry/runtime.ts'; export * from './app/telemetry/server.ts'; export {runWithExecutionContext} from 'vinext/shims/request-context';`, resolveDir: root, loader: "ts" }, outfile, bundle: true, platform: "node", format: "esm", logLevel: "silent",
    plugins: [acceptedPilotRulesBindingsPlugin, { name: "provider-free-server-boundaries", setup(plugin) {
      plugin.onResolve({ filter: /^next\/headers$/ }, () => ({ path: "headers", namespace: "fixture" }));
      plugin.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const headers=()=>{throw Error('No request-context bypass permitted')};", loader: "js" }));
      plugin.onResolve({ filter: /openai-responses-instrumentation$/ }, () => ({ path: "collector", namespace: "observe" }));
      plugin.onLoad({ filter: /.*/, namespace: "observe" }, () => ({ contents: `export * from ${JSON.stringify(join(root,"app/openai-responses-instrumentation.ts"))}; import {createRequestUsageCollector as original} from ${JSON.stringify(join(root,"app/openai-responses-instrumentation.ts"))}; export function createRequestUsageCollector(...args){const c=original(...args);globalThis.__envS1Collectors.push(c);return c;}`, resolveDir: root, loader: "js" }));
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
function fixture(t, { emptyAllowlist = false, mode = "success", streamGate } = {}) {
  const vars = { NODE_ENV:"production", APU_LOCAL_DEV_AUTH:"0", CF_ACCESS_TEAM_DOMAIN:issuer, CF_ACCESS_AUD:audience, APU_DEVELOPER_EMAILS:emptyAllowlist?"":"developer@example.com", OPENAI_API_KEY:"synthetic-only", APU_VECTOR_STORE_ID:"synthetic-only" };
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
      if(mode==="disconnect"){
        let sent=false;return new Response(new ReadableStream({async pull(c){
          if(!sent){sent=true;c.enqueue(new TextEncoder().encode('data: '+JSON.stringify({type:"response.output_text.delta",delta:"Ordinary reply."})+'\n\n'));return;}
          await streamGate;c.enqueue(new TextEncoder().encode('data: '+JSON.stringify({type:"response.completed",response})+'\n\n'));c.close();
        }}),{headers:{"Content-Type":"text/event-stream"}});
      }
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
    } else if(format==="apu_notepad_extraction")result={situationRelation:"same",situationReason:null,categoryReview:{manifestations:"none",goals:"none",context:"none",course:"none",helps:"none"},candidates:mode==="rescue"?[{category:"manifestations",sourceQuote:"Observation.",notebookText:"Observation.",action:"add",relatedEntryId:null,reason:null}]:[]};
    else if(format==="apu_notepad_grounding_verification")result={verdicts:[{index:0,accepted:false,reason:"Synthetic explicit rejection."}]};
    else if(format==="apu_notepad_grounding_rescue")result={verdicts:[{index:0,accepted:true,reasonCategory:"accept_shared_subject",reason:"Synthetic direct evidence."}]};
    else if(format.startsWith("apu_phase_2"))result={hypotheses:[{...hypothesis,question:null}],needs:[{needId:"n",title:need.needText,direction:"Understand.",relevantHypotheses:["h"],question:null}],mainUncertainty:"Limited evidence.",chatUpdate:{kind:"entry",summary:"Provisional analysis.",nextPrompt:null},transitionReady:true};
    else if(format==="apu_f2_need_route")result={path:"POCHOPIT",clarification:null};
    else if(format.endsWith("_build"))result=buildResult;
    else if(format.endsWith("_preview"))result=material;
    else if(format.endsWith("_components"))result={components:Object.fromEntries(componentRequest.components.map(c=>[c.id,"Accepted expansion."]))};
    else if(format.endsWith("_final_render"))result={kind:"material",material,boundaryIssue:null};
    else throw Error("Unexpected format: "+format);
    return Response.json({...response,output_text:mode==="invalid-output"?"{invalid":JSON.stringify(result)});
  });
  const invoke=async(c,{email="teacher@example.com",model,body={},headers={},telemetry,cancel=false}={})=>{
    const request=new Request(`https://${telemetry ? "apu-ms-site-dev.catsystem-exe.workers.dev" : "apu.invalid"}/api/${c.route}`,{method:"POST",headers:{"Content-Type":"application/json",...(email?{"cf-access-jwt-assertion":await token(email)}:{}),...headers},body:JSON.stringify({...c.body,...(model===undefined?{}:{model}),...body})});
    const handler=handlers[c.route];
    const response=await (telemetry ? handler.runWithTelemetryResources(telemetry.bindings,()=>handler.runWithExecutionContext(telemetry.lifetime,()=>handler.POST(request))) : handler.POST(request));
    if(cancel){await response.body.cancel();return {response,payload:[]};}
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

async function pilotFixture(t, { synthetic = true } = {}) {
  const db = new EmulatedTelemetryD1(); t.after(()=>db.db.close());
  const identities = [{email:"participant-a@synthetic.invalid",role:"tester"},{email:"participant-b@synthetic.invalid",role:"tester"}];
  const config = { APU_TELEMETRY_ENABLED:"1", APU_TELEMETRY_ENV:"dev", APU_TELEMETRY_HOSTNAME:"apu-ms-site-dev.catsystem-exe.workers.dev",
    APU_TELEMETRY_COHORT:"b2-fixture", APU_TELEMETRY_KEY_VERSION:"k1", APU_TELEMETRY_NOTICE_VERSION:"n1", APU_TELEMETRY_NOTICE_TEXT:"Synthetic test notice.",
    APU_TELEMETRY_SYNTHETIC:synthetic?"1":"0", APU_TELEMETRY_PRIVACY_APPROVED:"1", TELEMETRY_PSEUDONYM_KEY:"synthetic-pseudonym-key-".repeat(3), TELEMETRY_CONTEXT_KEY:"synthetic-signing-key-".repeat(3) };
  const ids=await Promise.all(identities.map(identity=>handlers.chat.participantId(identity,{cohort:config.APU_TELEMETRY_COHORT,pseudonymKey:config.TELEMETRY_PSEUDONYM_KEY})));
  config.APU_TELEMETRY_ELIGIBLE=ids.join(",");
  const bindings={...config,TELEMETRY_DB:db}, writes=[];
  const telemetry={bindings,lifetime:{waitUntil:p=>writes.push(p)}};
  const contexts=[];
  for(const identity of identities)contexts.push(await handlers.chat.runWithTelemetryResources(bindings,()=>handlers.chat.handleContext(new Request("https://apu-ms-site-dev.catsystem-exe.workers.dev/api/telemetry/context",{
    method:"POST",headers:{Origin:"https://apu-ms-site-dev.catsystem-exe.workers.dev","Content-Type":"application/json"},body:JSON.stringify({action:"start",opt_in:true,notice_version:"n1",tab_id:crypto.randomUUID()})}),identity,handlers.chat.telemetryResources())));
  const headers=index=>({"x-apu-telemetry-context":contexts[index].context,"x-apu-telemetry-workflow":crypto.randomUUID(),"x-apu-telemetry-operation":crypto.randomUUID()});
  return {db,identities,ids,contexts,telemetry,headers,writes};
}
test("B2 actual endpoints persist eligible tester calls without exposing diagnostics, preserving call counts",async t=>{
  const p=await pilotFixture(t,{synthetic:false}),f=fixture(t);
  let expected=0;
  for(const c of cases){
    const start=f.calls.length, headers=p.headers(0);
    const {response,payload}=await f.invoke(c,{email:p.identities[0].email,headers,telemetry:p.telemetry,
      body:c.route==="chat"?{requestId:"PRIVATE_RAW_CLIENT_REQUEST",turnId:"PRIVATE_TURN"}:{}});
    assert.equal(response.status,200,c.name);assertPublic(payload);
    const count=f.calls.length-start;assert.equal(count,c.route==="chat"?2:1,c.name);expected+=count;
    await Promise.all(p.writes);
    const rows=p.db.rows("telemetry_ai_calls");assert.equal(rows.length,expected,c.name);
    const recent=rows.slice(-count).map(row=>JSON.parse(row.projection_json));
    assert.ok(recent.every(row=>row.state==="final"&&row.cost_nano_usd>0&&row.workflow_id===headers["x-apu-telemetry-workflow"]&&row.operation_instance_id===headers["x-apu-telemetry-operation"]));
    if(c.route==="chat"){assert.deepEqual(new Set(recent.map(r=>r.operation)),new Set(["controller","main_chat"]));assert.equal(new Set(recent.map(r=>r.request_id)).size,1);assert.ok(recent.every(r=>r.attempt_index===0&&r.fallback_for_call_id===null));}
  }
  assert.equal(p.db.rows("telemetry_sessions")[0].test_class,"tester");
  assert.doesNotMatch(JSON.stringify(p.db.rows("telemetry_ai_calls")),/PRIVATE|@|provider_request_id|provider_response_id|turn_id/);
});
for(const mode of ["transport","http-failure","invalid-output","incomplete","interrupted","unterminated","stream-error","missing-body"])test(`B2 server/MAIN terminal persistence mode=${mode}`,async t=>{
  const p=await pilotFixture(t),f=fixture(t,{mode});
  const c=mode==="invalid-output"?cases.find(c=>c.route==="f3"):cases[0];
  const {payload}=await f.invoke(c,{email:p.identities[0].email,headers:p.headers(0),telemetry:p.telemetry});assertPublic(payload);
  await Promise.all(p.writes);const rows=p.db.rows("telemetry_ai_calls").map(row=>JSON.parse(row.projection_json));
  assert.equal(rows.length,f.calls.length);assert.ok(rows.every(row=>row.state==="final"));
  if(["transport","interrupted","unterminated","stream-error","missing-body"].includes(mode))assert.ok(rows.some(row=>row.cost_nano_usd===null&&row.usage_coverage==="incomplete"));
  if(mode==="invalid-output")assert.ok(rows.some(row=>row.application_status==="rejected_invalid_output"&&row.cost_nano_usd>0));
});
test("B2 two interleaved API participants preserve original request scope and fallback errors never alter output",async t=>{
  const p=await pilotFixture(t),f=fixture(t),c=cases[0];
  const requests=p.identities.map((identity,index)=>f.invoke(c,{email:identity.email,headers:p.headers(index),telemetry:p.telemetry}));
  const responses=await Promise.all(requests);responses.forEach(({response,payload})=>{assert.equal(response.status,200);assertPublic(payload);});
  await Promise.all(p.writes);const rows=p.db.rows("telemetry_ai_calls");assert.equal(rows.length,4);
  for(const[index,context]of p.contexts.entries()){
    const scoped=rows.filter(row=>row.session_id===context.session_id);assert.equal(scoped.length,2);
    assert.ok(scoped.every(row=>JSON.parse(row.identity_json).owner.participant_id===p.ids[index]));
  }
  const before=f.calls.length;
  // Same authenticated request with unusable telemetry never fails the application or adds provider retries.
  const broken={...p.telemetry,bindings:{...p.telemetry.bindings,TELEMETRY_DB:{prepare(){throw Error("PRIVATE_DB_FAILURE");}}}};
  const result=await f.invoke(c,{email:p.identities[0].email,headers:p.headers(0),telemetry:broken});
  assert.equal(result.response.status,200);assertPublic(result.payload);assert.equal(f.calls.length-before,2);
});
test("B2 grounding rescue records a separate priced attempt linked to primary grounding, not extraction",async t=>{
  const p=await pilotFixture(t),f=fixture(t,{mode:"rescue"});
  const result=await f.invoke(cases.find(c=>c.route==="extract"),{email:p.identities[0].email,headers:p.headers(0),telemetry:p.telemetry});
  assert.equal(result.response.status,200);await Promise.all(p.writes);
  assert.equal(f.calls.length,3);const rows=p.db.rows("telemetry_ai_calls").map(r=>JSON.parse(r.projection_json));
  assert.equal(rows.length,3);const grounding=rows.filter(r=>r.operation==="grounding"),primary=grounding.find(r=>r.attempt_index===0),rescue=grounding.find(r=>r.attempt_index===1);
  assert.equal(rescue.fallback_for_call_id,primary.call_id);assert.equal(rescue.retry_of_call_id,null);assert.ok(rows.every(r=>r.cost_nano_usd>0));
});
test("B2 full synthetic workflow stores exact client semantics and eight actual server calls, baseline adds zero calls",async t=>{
  const p=await pilotFixture(t),f=fixture(t,{mode:"rescue"}),identity=p.identities[0];
  const pilot=createPilot({enabled:true,eligible:true,noticeVersion:"n1",fetcher:async(path,init)=>{
    const request=new Request("https://apu-ms-site-dev.catsystem-exe.workers.dev"+path,{...init,headers:{...init.headers,Origin:"https://apu-ms-site-dev.catsystem-exe.workers.dev"}});
    return handlers.chat.runWithTelemetryResources(p.telemetry.bindings,async()=>handlers.chat.telemetryResponse(await(path.endsWith("context")?
      handlers.chat.handleContext(request,identity,handlers.chat.telemetryResources()):handlers.chat.handleEvents(request,identity,handlers.chat.telemetryResources()))));
  }});t.after(()=>pilot.stop());assert.equal(await pilot.optIn(),true);
  async function run(name,kind,body={}){
    const operation=pilot.begin(kind),headers=await operation.headers(),c=cases.find(c=>c.name===name);
    const result=await f.invoke(c,{email:identity.email,headers,telemetry:p.telemetry,body});assert.equal(result.response.status,200,name);assertPublic(result.payload);operation.resolve("accepted");return {result,operation};
  }
  await run("extract","extraction");await run("chat","main_chat");pilot.transition("F2","user_navigation");
  await run("need-route","need_routing");await run("analysis","analysis");
  pilot.begin("f2_local_reconciliation").resolve("local_noop");
  const observer=createDocumentObserver(pilot),baseline=createF3State(createF2ToF3Snapshot(need,[hypothesis],"POCHOPIT",current,0));
  pilot.transition("F3","user_navigation");observer.expose();observer.observe(baseline,true);observer.observe(baseline,true);
  assert.equal(f.calls.length,7,"default usable F3 adds zero provider calls");
  pilot.transition("F2","return");pilot.transition("F3","user_navigation");observer.expose();observer.observe(baseline,true);
  const configured=updateF3Config(baseline,{structureMode:"cards"}),request=createF3RenderRequest(configured);
  const operation=pilot.begin("f3_render"),headers=await operation.headers();
  const generated=await f.invoke(cases.find(c=>c.name==="f3"),{email:identity.email,headers,telemetry:p.telemetry,body:request});
  assert.equal(generated.response.status,200);observer.expect(operation,request,configured.finalRender);
  const accepted=acceptF3Render(configured,generated.payload.result,request);observer.observe(accepted,true);observer.observe(accepted,true);
  for(let n=0;n<20&&pilot.status().queued;n++){await Promise.resolve();await pilot.flush();}await Promise.all(p.writes);
  assert.equal(pilot.status().queued,0);assert.equal(f.calls.length,8);assert.equal(p.db.rows("telemetry_ai_calls").length,8);
  const events=p.db.rows("telemetry_events").sort((a,b)=>a.client_seq-b.client_seq).map(row=>JSON.parse(row.event_json));
  assert.equal(events.filter(e=>e.event_name==="workflow_started").length,1);
  assert.equal(events.filter(e=>e.event_name==="operation_requested").length,6);
  assert.equal(events.filter(e=>e.event_name==="operation_resolved").length,6);
  assert.equal(events.filter(e=>e.event_name==="phase_transition").length,4);
  assert.deepEqual(events.filter(e=>e.event_name==="document_accepted").map(e=>e.payload.representation),["baseline","generated"]);
  assert.equal(new Set(events.map(e=>e.workflow_id)).size,1);const workflow=events[0].workflow_id;
  assert.ok(p.db.rows("telemetry_ai_calls").every(row=>row.workflow_id===workflow&&JSON.parse(row.projection_json).cost_nano_usd>0));
  assert.doesNotMatch(JSON.stringify(p.db.rows("telemetry_events")),/PRIVATE|private-business|needText|sourceFingerprint|cf-access|Bearer/);
});
test("B2 actual controller and MAIN remain usable when every lifecycle write exceeds its 100ms budget",async t=>{
  const p=await pilotFixture(t),f=fixture(t),gates=[];
  const slow={...p.telemetry,bindings:{...p.telemetry.bindings,TELEMETRY_DB:{prepare(sql){
    const statement=p.db.prepare(sql);if(sql.includes("INSERT INTO telemetry_ai_calls"))statement.run=()=>new Promise(resolve=>gates.push(()=>resolve(statement.execute())));
    return statement;
  },batch:statements=>p.db.batch(statements)}}};
  const start=performance.now(),result=await f.invoke(cases[0],{email:p.identities[0].email,headers:p.headers(0),telemetry:slow});
  assert.equal(result.response.status,200);assertPublic(result.payload);assert.equal(f.calls.length,2);
  assert.equal(gates.length,4);assert.equal(p.db.rows("telemetry_ai_calls").length,0,"provider completed before held lifecycle writes");
  assert.ok(performance.now()-start<1500,"four 100ms waiting budgets plus bounded test scheduler margin");
  gates.reverse().forEach(release=>release());await Promise.all(p.writes);
  assert.equal(p.db.rows("telemetry_ai_calls").length,2);assert.ok(p.db.rows("telemetry_ai_calls").every(row=>row.state==="final"));
});
test("B2 cancelled downstream MAIN stream retains provider completion and known cost under its original request lifetime",async t=>{
  let release;const gate=new Promise(resolve=>release=resolve),p=await pilotFixture(t),f=fixture(t,{mode:"disconnect",streamGate:gate});
  const result=await f.invoke(cases[0],{email:p.identities[0].email,headers:p.headers(0),telemetry:p.telemetry,cancel:true});
  assert.equal(result.response.status,200);release();await Promise.all(p.writes);
  const rows=p.db.rows("telemetry_ai_calls").map(r=>JSON.parse(r.projection_json));assert.equal(rows.length,2);assert.equal(f.calls.length,2);
  const main=rows.find(r=>r.operation==="main_chat");assert.equal(main.state,"final");assert.equal(main.provider_status,"completed");assert.ok(main.cost_nano_usd>0);
});
test("B2 approved page bootstrap exposes only notice/version and never creates a telemetry session",async t=>{
  const p=await pilotFixture(t),request=new Request("https://apu-ms-site-dev.catsystem-exe.workers.dev/"),count=p.db.rows("telemetry_sessions").length;
  const available=await handlers.chat.runWithTelemetryResources(p.telemetry.bindings,()=>handlers.chat.pilotAvailability(request,p.identities[0],handlers.chat.telemetryResources()));
  assert.deepEqual(available,{enabled:true,noticeVersion:"n1",noticeText:"Synthetic test notice."});
  assert.doesNotMatch(JSON.stringify(available),/@|participant|KEY|context|HMAC/);
  for(const changes of [{APU_TELEMETRY_ENABLED:"0"},{APU_TELEMETRY_NOTICE_TEXT:undefined},{APU_TELEMETRY_ELIGIBLE:""}]){
    const unavailable=await handlers.chat.runWithTelemetryResources({...p.telemetry.bindings,...changes},()=>handlers.chat.pilotAvailability(request,p.identities[0],handlers.chat.telemetryResources()));
    assert.deepEqual(unavailable,{enabled:false});
  }
  assert.equal(p.db.rows("telemetry_sessions").length,count);
});
test("B2 off/on/broken telemetry preserves exact provider payloads, call counts and pedagogical results on every endpoint",async t=>{
  const p=await pilotFixture(t),f=fixture(t);
  for(const c of cases){
    const start=f.calls.length,plain=await f.invoke(c,{email:p.identities[0].email}),expected=f.calls.slice(start);
    const resultOf=payload=>{
      const ids=new Map();
      const normalize=value=>{
        if(typeof value==="string"&&/^hypothesis-[0-9a-f-]{36}$/.test(value)){if(!ids.has(value))ids.set(value,"hypothesis-"+ids.size);return ids.get(value);}
        if(Array.isArray(value))return value.map(normalize);
        if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,normalize(v)]));
        return value;
      };
      // Existing analysis creates fresh hypothesis IDs on every request. Preserve its reference graph while comparing content.
      return normalize(c.route==="chat"?payload.filter(e=>["delta","done"].includes(e.type)).map(({responseId,...event})=>event):payload);
    };
    for(const telemetry of [p.telemetry,{...p.telemetry,bindings:{...p.telemetry.bindings,TELEMETRY_DB:{prepare(){throw Error("PRIVATE_DB_FAILURE");}}}}]){
      const begin=f.calls.length,observed=await f.invoke(c,{email:p.identities[0].email,headers:p.headers(0),telemetry});
      assert.equal(observed.response.status,plain.response.status,c.name);assert.deepEqual(resultOf(observed.payload),resultOf(plain.payload),c.name);
      assert.deepEqual(f.calls.slice(begin),expected,c.name);
    }
  }
  await Promise.all(p.writes);
});
