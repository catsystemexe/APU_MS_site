import assert from "node:assert/strict";
import test from "node:test";
import { createReport } from "../telemetry/reports/engine.ts";
import { midnight, civilDate, isoWeek, splitDays, union } from "../telemetry/reports/time.ts";
import { reportCsv,csvCell } from "../telemetry/reports/csv.ts";
import { reportingFixture,reportOptions,START,AS_OF } from "./helpers/telemetry-report-fixture.mjs";

test("B2 → authenticated context/collector → real B1 SQL/store → reports/CSV: exact prices, duplicate delivery, zero-call default",async t=>{
  const f=await reportingFixture(t,{duplicate:true});
  for(const [i,tokens] of [5000,15000,50000].entries()){
    const c=await f.client(`price-${i}`,START+i*60000),op=c.pilot.begin("main_chat");await f.call(c,op,tokens);op.resolve("accepted");
    c.pilot.transition("F2","user_navigation");c.pilot.transition("F3","user_navigation");c.pilot.document(Symbol(),"baseline");await f.drain(c);
  }
  const incomplete=await f.client("incomplete",START+180000),unpriced=incomplete.pilot.begin("main_chat");await f.call(incomplete,unpriced,100,{unknown:true});unpriced.resolve("accepted");await f.drain(incomplete);
  const zero=await f.client("zero",START+240000);zero.pilot.meaningful();zero.pilot.view(true,true);zero.pilot.interaction();f.advance(15000);zero.pilot.tick();
  zero.pilot.transition("F3","user_navigation");zero.pilot.document(Symbol(),"baseline");await f.drain(zero);
  const report=createReport(f.db.db,reportOptions),s=report.rows.summary[0];
  assert.deepEqual(report.rows.sessions.slice(0,3).map(s=>s.complete_cost_nano_usd),[10000000,30000000,100000000]);
  assert.equal(s.ai_count,4);assert.equal(s.known_cost_nano_usd,140000000);assert.equal(s.unknown_cost_count,1);
  assert.equal(s.complete_ai_sessions_n,3);assert.ok(Math.abs(s.mean_ai_session_usd-0.14/3)<1e-12);assert.equal(s.median_ai_session_usd,0.03);
  assert.equal(s.complete_active_sessions_n,4);assert.equal(s.mean_all_active_session_usd,0.035);assert.equal(s.median_all_active_session_usd,0.02);
  assert.equal(s.incomplete_mature_sessions,1);assert.equal(s.outputs,4);assert.equal(s.first_completion_complete_n,4);
  assert.equal(s.first_completion_mean_usd,0.035);assert.equal(s.cost_per_completed_workflow_usd,0.035);assert.equal(s.mature_cost_incomplete,true);
  assert.equal(report.rows.workflows.find(w=>w.participant_id===zero.participant).complete_cost_nano_usd,0);
  assert.equal(report.rows.calls.filter(c=>c.operation==="f3_render").length,0);
  assert.equal(f.db.rows("telemetry_events").length,f.batches.flat().length,"triple reordered delivery remains idempotent");
  const csv=reportCsv(report,{operator:true,createdAt:AS_OF});assert.match(csv,/pilot-report-v1/);assert.match(csv,/0\.046666/);
  assert.doesNotMatch(csv,/PRIVATE|private-model|email|provider_request|projection_json|participant_id|call_id/);
  const before=s.known_cost_nano_usd;
  f.time(START+300000);const many=await f.client("more-events");for(let i=0;i<20;i++){many.pilot.transition(i%2?"F1":"F2","user_navigation");}await f.drain(many);
  assert.equal(createReport(f.db.db,reportOptions).rows.summary[0].known_cost_nano_usd,before);
});
test("participant union, session time, civil day/week boundaries and linkage gate",async t=>{
  const f=await reportingFixture(t),a=await f.client("same",START),b=await f.client("same",START+15000);
  f.time(START);a.pilot.view(true,true);a.pilot.interaction();a.pilot.meaningful();
  f.time(START+15000);a.pilot.tick();b.pilot.view(true,true);b.pilot.interaction();b.pilot.meaningful();
  f.time(START+30000);a.pilot.tick();a.pilot.view(true,false);b.pilot.tick();await f.drain(a);
  f.time(START+45000);b.pilot.tick();await f.drain(b);
  const r=createReport(f.db.db,reportOptions);
  assert.deepEqual(r.rows.sessions.map(s=>s.active_ms),[30000,30000]);assert.equal(r.rows.participants[0].active_ms,45000);
  assert.equal(r.rows.days.find(d=>d.date==="2026-10-20").active_ms,45000);assert.equal(r.rows.weeks[0].active_ms,45000);
  assert.equal(r.rows.participants[0].returning,true);assert.equal(r.rows.participants[0].return_day,false);assert.equal(r.rows.participants[0].additional_same_day_visits,1);
  const gated=createReport(f.db.db,{...reportOptions,linkage:false});assert.deepEqual(gated.rows.participants,[]);assert.equal(gated.rows.summary[0].participant_active_ms,null);assert.equal(gated.rows.days[0].active_ms,null);
  assert.throws(()=>reportCsv(gated,{operator:true,view:"participants"}),/participant_linkage_unavailable/);
});
test("Prague DST days are 23/25h; half-open midnight split and ISO year boundary remain exact",()=>{
  assert.equal(midnight("2026-03-30")-midnight("2026-03-29"),23*3600000);
  assert.equal(midnight("2026-10-26")-midnight("2026-10-25"),25*3600000);
  assert.equal(isoWeek("2027-01-01"),"2026-W53");assert.equal(isoWeek("2026-01-01"),"2026-W01");
  const boundary=midnight("2026-10-26"),parts=splitDays(boundary-10000,boundary+5000);
  assert.deepEqual(parts.map(p=>[p.date,p.interval[1]-p.interval[0]]),[["2026-10-25",10000],["2026-10-26",5000]]);
  assert.equal(civilDate(Date.parse("2026-10-25T00:30:00Z")),civilDate(Date.parse("2026-10-25T01:30:00Z")));
  assert.equal(union([[0,30000],[15000,45000],[0,30000]]),45000);
});
test("conversion distinguishes completed/reset/unfinished/censored/left-truncated; stale reset cost stays with old workflow",async t=>{
  const f=await reportingFixture(t),completed=await f.client("completed");completed.pilot.meaningful();completed.pilot.transition("F3","user_navigation");completed.pilot.document(Symbol(),"baseline");await f.drain(completed);
  const reset=await f.client("reset",START+60000),old=reset.pilot.begin("main_chat");await f.call(reset,old,5000);reset.pilot.reset();old.transition("F3","controller_instruction");old.resolve("accepted");await f.drain(reset);
  const unfinished=await f.client("unfinished",START+120000);unfinished.pilot.meaningful();await f.drain(unfinished);
  const pending=await f.client("censored",AS_OF-18*3600000);pending.pilot.meaningful();await f.drain(pending);
  const left=await f.client("left",START+180000);left.pilot.meaningful();await f.drain(left);
  f.db.db.prepare("DELETE FROM telemetry_events WHERE event_name='workflow_started' AND session_id=?").run(left.context.session_id);
  // An observed associated call with missing WS must remain partial, never a zero-call completion.
  f.time(START+180000);const leftOp=left.pilot.begin("main_chat");await f.call(left,leftOp,5000);await f.drain(left);
  const report=createReport(f.db.db,reportOptions),s=report.rows.summary[0];
  assert.deepEqual(report.rows.workflows.map(w=>w.status).sort(),["completed","left_truncated","reset","right_censored","unfinished_observed"].sort());
  assert.equal(s.workflows_mature,3);assert.equal(s.workflows_completed,1);assert.equal(s.workflows_reset,1);assert.equal(s.workflows_unfinished,1);assert.equal(s.workflows_censored,1);assert.equal(s.mature_conversion,1/3);
  assert.equal(s.cost_per_completed_workflow_usd,0.01);assert.equal(s.outputs,1);
  assert.equal(report.rows.workflows.find(w=>w.status==="left_truncated").complete_cost_nano_usd,null);
});
test("pending/unknown usage, explicit retries and fallback retain distinct attempts and incomplete denominators",async t=>{
  const f=await reportingFixture(t),c=await f.client("rework"),first=c.pilot.begin("main_chat");
  const id=await f.call(c,first,5000,{failed:true});first.resolve("failed");const retry=c.pilot.begin("main_chat","retry");
  const next=await f.call(c,retry,15000,{retryOf:id});await f.call(c,retry,5000,{fallbackFor:next});retry.resolve("accepted");
  const regenerate=c.pilot.begin("f3_render","regenerate");await f.call(c,regenerate,0,{pending:true});
  c.pilot.transition("F3","user_navigation");c.pilot.document(Symbol(),"baseline");await f.drain(c);
  const r=createReport(f.db.db,reportOptions),s=r.rows.summary[0],q=r.rows.quality[0];
  assert.equal(s.ai_count,4);assert.equal(s.retry_calls,1);assert.equal(s.fallback_calls,1);assert.equal(s.user_retries,1);assert.equal(s.user_regenerations,1);assert.equal(s.failed_provider_calls,1);
  assert.equal(s.known_cost_nano_usd,50000000);assert.equal(s.complete_cost_nano_usd,null);assert.equal(s.mean_ai_session_usd,null);assert.equal(s.first_completion_complete_n,0);
  assert.equal(q.pending_calls,1);assert.equal(q.unresolved_over_15m,1);assert.equal(q.expected_live_calls,null);
});
test("bounded filters, formula injection, small/complementary-cell suppression, operator row-export boundary",async t=>{
  const f=await reportingFixture(t),c=await f.client();c.pilot.meaningful();await f.drain(c);const r=createReport(f.db.db,reportOptions);
  const shared=reportCsv(r,{createdAt:AS_OF});assert.match(shared,/suppressed_small_or_complementary_cells/);assert.equal(shared.split("\r\n")[1].split(",")[shared.split("\r\n")[0].split(",").indexOf('"known_cost_nano_usd"')],"");
  assert.throws(()=>reportCsv(r,{view:"sessions"}),/operator_export_required/);
  assert.match(reportCsv(r,{view:"sessions",operator:true}),/session_id/);
  for(const value of ["=1+2"," +cmd","\t@SUM(1)","\n-2","\u0001=2"])assert.ok(csvCell(value).startsWith('"\''));
  assert.equal(csvCell(null),"");assert.equal(csvCell(0),'"0"');assert.equal(csvCell('a,"b"'),'"a,""b"""');
  for(const bad of [{cohort:"x' OR 1=1"},{from:"2026-02-30"},{to:"2027-01-01"},{retainedSince:0},{testClass:"all"}])assert.throws(()=>createReport(f.db.db,{...reportOptions,...bad}));
  const empty=createReport(f.db.db,{...reportOptions,testClass:"tester"});assert.equal(empty.rows.summary[0].mean_ai_session_usd,null);assert.equal(empty.rows.summary[0].mature_conversion,null);
});
test("first-output price is frozen at acceptance; later unknown regeneration does not erase it; same-ms reset retains prior output",async t=>{
  const f=await reportingFixture(t),c=await f.client(),op=c.pilot.begin("main_chat");await f.call(c,op,5000);op.resolve("accepted");
  c.pilot.transition("F3","user_navigation");c.pilot.document(Symbol(),"baseline");await f.drain(c);
  f.advance(10);const later=c.pilot.begin("f3_render","regenerate");await f.call(c,later,0,{pending:true});c.pilot.reset();await f.drain(c);
  const r=createReport(f.db.db,reportOptions),w=r.rows.workflows[0];assert.equal(w.first_completion_cost_nano_usd,10000000);assert.equal(w.complete_cost_nano_usd,null);assert.equal(w.status,"completed");
  const zero=await f.client("instant",START+60000);zero.pilot.meaningful();zero.pilot.transition("F3","user_navigation");zero.pilot.document(Symbol(),"baseline");zero.pilot.reset();await f.drain(zero);
  const z=createReport(f.db.db,reportOptions).rows.workflows.find(w=>w.participant_id===zero.participant);assert.equal(z.status,"completed");assert.equal(z.output_count,1);assert.equal(z.first_completion_cost_nano_usd,0);
});
test("cross-day return and midnight ACT split are reported from actual B2 intervals",async t=>{
  const f=await reportingFixture(t),boundary=midnight("2026-10-22"),a=await f.client("returning",boundary-10000);
  a.pilot.view(true,true);a.pilot.interaction();a.pilot.meaningful();f.advance(15000);a.pilot.tick();await f.drain(a);
  const b=await f.client("returning",boundary+60000);b.pilot.view(true,true);b.pilot.interaction();f.advance(15000);b.pilot.tick();await f.drain(b);
  const r=createReport(f.db.db,reportOptions);assert.deepEqual(r.rows.days.filter(d=>d.active_ms>0).map(d=>[d.date,d.active_ms]),[["2026-10-21",10000],["2026-10-22",20000]]);
  assert.equal(r.rows.participants[0].active_days,2);assert.equal(r.rows.participants[0].return_day,true);assert.equal(r.rows.summary[0].return_day_share,1);
});
test("shared overall aggregate opens for adequate cells and suppresses their small complement",async t=>{
  const f=await reportingFixture(t);
  for(let i=0;i<6;i++){const c=await f.client(`shared-${i}`,START+i*60000);c.pilot.view(true,true);c.pilot.meaningful();c.pilot.interaction();f.advance(15000);c.pilot.tick();c.pilot.transition("F3","user_navigation");c.pilot.document(Symbol(),"baseline");await f.drain(c);}
  assert.match(reportCsv(createReport(f.db.db,reportOptions)),/"observed"/);
  const other=await f.client("complement",START+600000);other.pilot.meaningful();other.pilot.reset();await f.drain(other);
  assert.match(reportCsv(createReport(f.db.db,reportOptions)),/suppressed_small_or_complementary_cells/);
});
