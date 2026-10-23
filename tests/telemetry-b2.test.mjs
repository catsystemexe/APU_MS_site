import assert from "node:assert/strict";
import test from "node:test";
import { createPilot } from "../app/telemetry/pilot.ts";
import { createActivityClock } from "../app/telemetry/activity-clock.ts";
import { createDocumentObserver } from "../app/telemetry/document-observer.ts";
import { fetchWithPilot } from "../app/telemetry/fetch.ts";
import { createCurrentRozborState, createF2ToF3Snapshot } from "../app/f2-build-model.ts";
import { createF3State, acceptF3Render, createF3RenderRequest, updateF3Config, markF3SourceStale } from "../app/f3-finalization-model.ts";
const id=()=>crypto.randomUUID();
function fixture(t,{enabled=true,contextReady}={}){
  let now=0,civil=0;const sent=[],events=[],contexts=[];
  const pilot=createPilot({enabled,eligible:enabled,noticeVersion:"test-notice-v1",monotonic:()=>now,wall:()=>civil,random:()=>0,
    fetcher:async(path,init)=>{
      const body=JSON.parse(init.body);sent.push({path,body});
      if(path.endsWith("context")){
        if(body.action==="stop")return Response.json({code:"stopped"});
        if(contextReady)await contextReady;
        const context={code:"ready",context:"synthetic-opaque-context-"+contexts.length,session_id:id(),tab_id:body.tab_id,server_anchor_ms:0,expires_at:43200000,measurement_version:"pilot-v1",metadata_enabled:false};
        contexts.push(context);return Response.json(context);
      }
      events.push(...body.events);return Response.json({code:"ready",acknowledged:body.events.map(e=>e.event_id)});
    }});
  t.after(()=>pilot.stop());
  async function drain(){for(let attempt=0;attempt<20;attempt++){await Promise.resolve();await pilot.flush();if(pilot.status().queued===0)return;}assert.fail("healthy synthetic transport did not drain bounded queue");}
  return {pilot,sent,events,contexts,drain,time(n,w=n){now=n;civil=w;}, get now(){return now;}};
}
const names=f=>f.events.map(e=>e.event_name);
function baseline(){return createF3State(createF2ToF3Snapshot({needId:"private-business-id",needText:"PRIVATE_PEDAGOGY",initialF2Path:"POCHOPIT",f3Target:null},[{id:"h",rank:1,title:"PRIVATE_HYPOTHESIS",summary:"PRIVATE_SUMMARY",relevantNeeds:["private-business-id"],question:null,questions:[],supportingInformation:[],limitations:[],unknowns:[]}],"POCHOPIT",createCurrentRozborState().POCHOPIT,0));}
const material={kind:"material",title:"PRIVATE_TITLE",introduction:"PRIVATE_INTRO",sections:[{heading:"PRIVATE_HEADING",content:"PRIVATE_CONTENT"}],table:null,cards:[],usageNote:null};
test("active time is visible/focused only, clipped at 60s and split across phase/idle boundaries without overlap",()=>{
  const c=createActivityClock();assert.deepEqual(c.view(0,0,true,true),[]);assert.deepEqual(c.tick(15000,15000),[]);
  c.interaction(15000,15000);
  const intervals=[...c.tick(30000,30000),...c.phase(36000,36000,"F2"),...c.tick(45000,45000),...c.view(50000,50000,true,false)];
  assert.deepEqual(intervals.map(i=>[i.start_ms,i.end_ms,i.phase]),[[15000,30000,"F1"],[30000,36000,"F1"],[36000,45000,"F2"],[45000,50000,"F2"]]);
  assert.deepEqual(c.tick(60000,60000),[]);c.view(65000,65000,true,true);
  assert.deepEqual(c.tick(80000,80000).map(i=>[i.start_ms,i.end_ms]),[[65000,75000]]);
  assert.deepEqual(c.tick(95000,95000),[]);
  for(let i=1;i<intervals.length;i++)assert.ok(intervals[i].start_ms>=intervals[i-1].end_ms);
});
test("sleep, monotonic reversal and wall-clock edits cannot create inflated intervals",()=>{
  for(const[n,w]of [[120000,120000],[10000,90000],[-1,10000]]){
    const c=createActivityClock();c.view(0,0,true,true);c.interaction(0,0);assert.deepEqual(c.tick(n,w),[]);
    assert.deepEqual(c.tick(n+15000,w+15000),[]);
    c.interaction(n+15000,w+15000);assert.equal(c.tick(n+30000,w+30000).length,1);
  }
});
test("off and refusal cause no telemetry requests/IDs/clock listeners while original fetch body is preserved",async t=>{
  const f=fixture(t,{enabled:false});assert.equal(await f.pilot.optIn(),false);
  f.pilot.meaningful();f.pilot.transition("F2","user_navigation");const operation=f.pilot.begin("analysis");
  f.pilot.document(Symbol(),"baseline");f.pilot.tick();await f.drain();assert.deepEqual(f.sent,[]);
  let called=false;const init={method:"POST",headers:{"Content-Type":"application/json"},body:'{"notebook":"PRIVATE"}'};
  const pending=fetchWithPilot(operation,"/api/analysis",init,async(url,actual)=>{called=true;assert.equal(actual,init);assert.equal(url,"/api/analysis");return Response.json({analysis:"unchanged"});});
  assert.equal(called,true,"off mode delegates synchronously without an extra context await");assert.deepEqual(await(await pending).json(),{analysis:"unchanged"});
});
test("deterministic workflow emits exact semantics, baseline completes once without any F3 AI request",async t=>{
  const f=fixture(t);await f.pilot.optIn();f.pilot.view(true,true);
  f.pilot.meaningful();const extraction=f.pilot.begin("extraction");const headers=await extraction.headers();assert.ok(headers["x-apu-telemetry-context"]);extraction.resolve("accepted");
  const chat=f.pilot.begin("main_chat");await chat.headers();chat.resolve("accepted");
  f.time(15000);f.pilot.tick();f.pilot.transition("F2","user_navigation");
  const analysis=f.pilot.begin("analysis");await analysis.headers();analysis.resolve("accepted");
  const local=f.pilot.begin("f2_local_reconciliation");local.resolve("local_noop");
  const state=baseline(),before=JSON.stringify(state),observer=createDocumentObserver(f.pilot);
  f.pilot.transition("F3","user_navigation");observer.expose();observer.observe(state,true);observer.observe(state,true);
  f.pilot.transition("F2","return");f.pilot.transition("F3","user_navigation");observer.expose();observer.observe(state,true);
  await f.drain();
  assert.equal(names(f).filter(n=>n==="workflow_started").length,1);assert.equal(names(f).filter(n=>n==="document_accepted").length,1);
  assert.deepEqual(f.events.filter(e=>e.event_name==="phase_transition").map(e=>[e.payload.from,e.payload.to]),[["F1","F2"],["F2","F3"],["F3","F2"],["F2","F3"]]);
  assert.deepEqual(f.events.filter(e=>e.event_name==="operation_requested").map(e=>e.payload.operation),["extraction","main_chat","analysis","f2_local_reconciliation"]);
  assert.equal(f.events.find(e=>e.event_name==="document_accepted").payload.representation,"baseline");
  assert.equal(JSON.stringify(state),before);assert.doesNotMatch(JSON.stringify(f.sent),/PRIVATE|private-business-id|fingerprint|email/);
});
test("only committed material is a new output; boundary, stale, queued React updates and effect replay cannot complete",async t=>{
  const f=fixture(t);await f.pilot.optIn();f.pilot.meaningful();f.pilot.transition("F3","user_navigation");
  const observer=createDocumentObserver(f.pilot),base=updateF3Config(baseline(),{structureMode:"cards"});
  const op=f.pilot.begin("f3_render"),req=createF3RenderRequest(base);await op.headers();observer.expect(op,req,base.finalRender);
  observer.observe(base,true);assert.equal(f.events.filter(e=>e.event_name==="document_accepted").length,0);
  const accepted=acceptF3Render(base,material,req);observer.observe(accepted,true);observer.observe(accepted,true);observer.expose();observer.observe(accepted,true);
  const boundaryOp=f.pilot.begin("f3_render","regenerate"),changed=updateF3Config(accepted,{structureMode:"text"}),boundaryReq=createF3RenderRequest(changed);
  await boundaryOp.headers();observer.expect(boundaryOp,boundaryReq,changed.finalRender);
  observer.observe(acceptF3Render(changed,{kind:"boundary_issue",reason:"PRIVATE",affectedArea:"PRIVATE",suggestedReturnToF2:"PRIVATE"},boundaryReq),true);
  const stale=f.pilot.begin("f3_render","retry");await stale.headers();observer.expect(stale,req,base.finalRender);
  observer.observe(markF3SourceStale(accepted,"new-private-fingerprint"),true);
  await f.drain();assert.equal(f.events.filter(e=>e.event_name==="document_accepted").length,1);
  assert.deepEqual(f.events.filter(e=>e.event_name==="operation_resolved").map(e=>e.payload.outcome),["accepted","failed","stale_discarded"]);
  const requested=f.events.filter(e=>e.event_name==="operation_requested");assert.deepEqual(requested.map(e=>e.payload.reason),["initial","regenerate","retry"]);
  assert.equal(requested[2].payload.prior_operation_id,requested[1].payload.operation_instance_id);
});
test("reset during AI keeps captured headers/workflow and resolves stale into the old episode only",async t=>{
  const f=fixture(t);await f.pilot.optIn();const op=f.pilot.begin("f3_render"),old=await op.headers();
  f.pilot.reset();f.pilot.meaningful();const newer=f.pilot.begin("analysis"),fresh=await newer.headers();op.resolve("accepted");newer.resolve("accepted");await f.drain();
  assert.notEqual(old["x-apu-telemetry-workflow"],fresh["x-apu-telemetry-workflow"]);assert.equal(old["x-apu-telemetry-context"],fresh["x-apu-telemetry-context"]);
  const stale=f.events.find(e=>e.event_name==="operation_resolved"&&e.payload.outcome==="stale_discarded");assert.equal(stale.workflow_id,old["x-apu-telemetry-workflow"]);
  assert.equal(f.contexts.length,1,"project reset does not rotate telemetry visit");
});
test("30m idle renews on next genuine action, heartbeats don't renew, and old callbacks cannot attach to new visit",async t=>{
  const f=fixture(t);await f.pilot.optIn();const old=f.pilot.begin("main_chat");const prior=await old.headers();
  for(const n of [15000,30000,45000,60000,1800000]){f.time(n);f.pilot.tick();}
  assert.equal(f.contexts.length,1);
  f.pilot.interaction();const next=f.pilot.begin("analysis");const fresh=await next.headers();old.resolve("accepted");next.resolve("accepted");await f.drain();
  assert.equal(f.contexts.length,2);assert.notEqual(prior["x-apu-telemetry-context"],fresh["x-apu-telemetry-context"]);
  assert.equal(f.events.filter(e=>e.event_name==="operation_resolved"&&e.payload.operation_instance_id===prior["x-apu-telemetry-operation"]).length,0);
  assert.equal(new Set(f.events.filter(e=>e.event_name==="workflow_started").map(e=>e.workflow_id)).size,1);
});
test("consent stop/identity uncertainty clear queue and prevent late operation completions and headers",async t=>{
  for(const action of ["stop","uncertain"]){
    const f=fixture(t);await f.pilot.optIn();const op=f.pilot.begin("analysis");await op.headers();
    await f.pilot[action]();const count=f.sent.length;op.resolve("accepted");f.pilot.meaningful();f.pilot.tick();await f.drain();
    assert.equal(f.sent.length,count);assert.deepEqual(await op.headers(),{});assert.equal(f.pilot.status().queued,0);
  }
});
test("frequent real interactions are coalesced into four intervals per active minute, AI waiting is separate",async t=>{
  const c=createActivityClock();c.view(0,0,true,true);c.interaction(0,0);const intervals=[];
  for(let n=100;n<=60000;n+=100){intervals.push(...c.interaction(n,n));if(n%15000===0)intervals.push(...c.tick(n,n));}
  assert.equal(intervals.length,4);assert.equal(intervals.reduce((sum,i)=>sum+i.end_ms-i.start_ms,0),60000);
  const f=fixture(t);await f.pilot.optIn();f.pilot.view(true,true);await f.pilot.begin("analysis").headers();f.time(15000);f.pilot.tick();await f.drain();
  assert.equal(f.events.filter(e=>e.event_name==="activity_interval").length,0,"a provider request alone is not visible activity");
});
test("late timers still emit valid non-overlapping intervals with genuine bounded interaction anchors",()=>{
  const c=createActivityClock();c.view(0,0,true,true);c.interaction(0,0);
  const intervals=[...c.interaction(14000,14000),...c.interaction(19000,19000),...c.tick(20000,20000)];
  assert.equal(intervals.reduce((sum,i)=>sum+i.end_ms-i.start_ms,0),20000);
  for(const i of intervals){assert.ok(i.end_ms-i.start_ms<=15000);assert.ok(i.last_interaction_ms<=i.end_ms);}
  assert.deepEqual(c.tick(20000,20000),[]);
});
test("header preparation failures delegate once; a provider transport error is never retried by telemetry",async()=>{
  const body={method:"POST",body:"PRIVATE"};
  for(const headers of [()=>{throw Error("telemetry failure");},()=>Promise.reject(Error("telemetry failure"))]){
    let calls=0;await fetchWithPilot({headers,resolve(){}},"/api/chat",body,async(_,init)=>{calls++;assert.equal(init,body);return Response.json({ok:true});});assert.equal(calls,1);
  }
  let calls=0;await assert.rejects(fetchWithPilot({headers:()=>Promise.resolve({}),resolve(){}},"/api/chat",body,async()=>{calls++;throw Error("provider transport");}));assert.equal(calls,1);
});
test("old async continuations after consent stop/re-opt-in cannot change the new visit's path or complete output",async t=>{
  const f=fixture(t);await f.pilot.optIn();const old=f.pilot.begin("f3_render");await old.headers();
  await f.pilot.stop();await f.pilot.optIn();const before=f.events.length,observer=createDocumentObserver(f.pilot);
  const state=updateF3Config(baseline(),{structureMode:"cards"}),request=createF3RenderRequest(state);
  old.transition("F3","controller_instruction");observer.expect(old,request,null);observer.observe(acceptF3Render(state,material,request),true);old.resolve("accepted");await f.drain();
  assert.equal(f.events.slice(before).filter(e=>["workflow_started","phase_transition","document_accepted","operation_resolved"].includes(e.event_name)).length,0);
  assert.deepEqual(await old.headers(),{});
});
for(const boundary of ["reset","stop/re-opt-in","idle renewal"])test(`stale transition after ${boundary} cannot overwrite the next real transition's from/to`,async t=>{
  const f=fixture(t);await f.pilot.optIn();const old=f.pilot.begin("main_chat");await old.headers();
  if(boundary==="reset")f.pilot.reset();
  else if(boundary==="stop/re-opt-in"){await f.pilot.stop();await f.pilot.optIn();}
  else{f.time(1800000);f.pilot.interaction();}
  const fresh=f.pilot.begin("analysis"),headers=await fresh.headers();
  assert.equal(old.isCurrent(),false);assert.equal(fresh.isCurrent(),true);
  fresh.transition("F2","user_navigation");await f.drain();const before=f.events.length;
  old.transition("F3","controller_instruction");await f.drain();assert.equal(f.events.length,before);
  fresh.transition("F3","user_navigation");f.pilot.transition("F2","return");await f.drain();
  assert.deepEqual(f.events.filter(e=>e.event_name==="phase_transition"&&e.workflow_id===headers["x-apu-telemetry-workflow"]).map(e=>[e.payload.from,e.payload.to]),[["F1","F2"],["F2","F3"],["F3","F2"]]);
});
for(const boundary of ["reset","stop","opt-in"])test(`unmeasured ticket cannot change phase after ${boundary}`,async t=>{
  const f=fixture(t),old=f.pilot.begin("main_chat");assert.deepEqual(await old.headers(),{});
  if(boundary==="reset")f.pilot.reset();else if(boundary==="stop")await f.pilot.stop();
  if(boundary!=="opt-in")old.transition("F3","controller_instruction");
  await f.pilot.optIn();old.transition("F3","controller_instruction");
  const fresh=f.pilot.begin("analysis");await fresh.headers();f.pilot.transition("F2","user_navigation");await f.drain();
  assert.equal(f.events.find(e=>e.event_name==="workflow_started").payload.phase,"F1");
  assert.deepEqual(f.events.filter(e=>e.event_name==="phase_transition").map(e=>[e.payload.from,e.payload.to]),[["F1","F2"]]);
});
test("current unmeasured transition keeps the actual phase until opt-in without collecting",async t=>{
  const f=fixture(t),operation=f.pilot.begin("main_chat");operation.transition("F2","controller_instruction");
  await f.drain();assert.deepEqual(f.sent,[]);
  await f.pilot.optIn();await f.pilot.begin("analysis").headers();f.pilot.transition("F3","user_navigation");await f.drain();
  assert.equal(f.events.find(e=>e.event_name==="workflow_started").payload.phase,"F2");
  assert.deepEqual(f.events.filter(e=>e.event_name==="phase_transition").map(e=>[e.payload.from,e.payload.to]),[["F2","F3"]]);
});
test("pre-consent ticket cannot change phase while the new visit context is still pending",async t=>{
  let release;const contextReady=new Promise(resolve=>{release=resolve;}),f=fixture(t,{contextReady}),old=f.pilot.begin("main_chat");
  const pending=f.pilot.optIn();old.transition("F3","controller_instruction");release();await pending;
  await f.pilot.begin("analysis").headers();await f.drain();
  assert.equal(f.events.find(e=>e.event_name==="workflow_started").payload.phase,"F1");
});
