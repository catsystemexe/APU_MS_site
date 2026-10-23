import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync,writeFileSync,readFileSync,copyFileSync,existsSync,rmSync,symlinkSync,statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { openTarget,deletionPlan,applyDeletion,writeExport } from "../telemetry/reports/local.ts";
import { expiryPlan,pruneExports } from "../telemetry/reports/export-expiry.ts";
import { createReport } from "../telemetry/reports/engine.ts";
import { reportCsv } from "../telemetry/reports/csv.ts";
import { reportingFixture,reportOptions,START,AS_OF } from "./helpers/telemetry-report-fixture.mjs";
const root=new URL("../",import.meta.url);
function directory(t){const dir=mkdtempSync(join(tmpdir(),"apu-telemetry-b3-"));t.after(()=>rmSync(dir,{recursive:true,force:true}));return dir;}
function snapshot(t,f){const dir=directory(t),path=join(dir,"telemetry-synthetic.sqlite");f.db.db.prepare("VACUUM INTO ?").run(path);writeFileSync(path+".target.json",JSON.stringify({kind:"apu-telemetry",schema_version:1,mode:"local-test",test_class:"synthetic",cohorts:["b3-synthetic","other"]}));return {database:path,cohort:"b3-synthetic",testClass:"synthetic",mode:"local-test"};}
test("local target refuses ambiguity, wrong cohort/class, links, business tables and remote mutation",async t=>{
  const f=await reportingFixture(t),c=await f.client();c.pilot.meaningful();await f.drain(c);const target=snapshot(t,f);
  for(const bad of [{database:"remote-db"},{database:"https://example.com/db.sqlite"},{cohort:"missing"},{testClass:"tester"},{mode:"operator-snapshot"}])assert.throws(()=>openTarget({...target,...bad}));
  const symlink=join(directory(t),"telemetry-link.sqlite");symlinkSync(target.database,symlink);assert.throws(()=>openTarget({...target,database:symlink}));
  assert.throws(()=>openTarget({...target,mode:"operator-snapshot"},true),/invalid_local_target/);
  const db=openTarget(target,true);db.exec("CREATE TABLE business_data(id TEXT)");db.close();assert.throws(()=>openTarget(target),/not_telemetry_only/);
});
test("30d retention dry-run/confirmed apply keeps exact cutoff, other cohort and newer children; deletion replay after restore",async t=>{
  const f=await reportingFixture(t),cutoff=AS_OF-30*86400000;
  const expired=await f.client("expired",cutoff-1),old=expired.pilot.begin("main_chat");await f.call(expired,old,5000);await f.drain(expired);
  const fresh=await f.client("fresh",cutoff),current=fresh.pilot.begin("main_chat");await f.call(fresh,current,5000);await f.drain(fresh);
  f.resources.config.APU_TELEMETRY_COHORT="other";const other=await f.client("other",cutoff-60000);other.pilot.meaningful();await f.drain(other);
  const target=snapshot(t,f),db=openTarget(target,true);t.after(()=>db.close());const request={action:"retention",asOf:AS_OF},plan=deletionPlan(db,target,request);
  assert.deepEqual(plan.counts,{events:2,ai_calls:1,sessions:1});assert.equal(db.prepare("SELECT count(*) n FROM telemetry_sessions").get().n,3);
  assert.throws(()=>applyDeletion(db,target,request,"wrong",join(target.database,"unused")),/local_deletion_only/);
  const ledger=join(target.database,".."); // invalid destination must never mutate
  assert.throws(()=>applyDeletion(db,target,request,plan.confirmation,ledger));
  const backup=join(directory(t),"telemetry-backup.sqlite");copyFileSync(target.database,backup);
  const result=applyDeletion(db,target,request,plan.confirmation,join(target.database,"..","telemetry-deletion-retention.json"));assert.equal(result.counts.sessions,1);
  assert.equal(db.prepare("SELECT count(*) n FROM telemetry_sessions").get().n,2);assert.equal(db.prepare("SELECT count(*) n FROM telemetry_ai_calls").get().n,1);
  assert.equal(db.prepare("SELECT count(*) n FROM telemetry_sessions WHERE cohort_id='other'").get().n,1);
  const restored=new DatabaseSync(backup);t.after(()=>restored.close());const restoredTarget={...target,database:backup},replay=deletionPlan(restored,restoredTarget,request);
  applyDeletion(restored,restoredTarget,request,replay.confirmation,join(backup,"..","telemetry-deletion-replay.json"));assert.equal(restored.prepare("SELECT count(*) n FROM telemetry_sessions").get().n,2);
  assert.deepEqual(deletionPlan(db,target,request).counts,{events:0,ai_calls:0,sessions:0});
});
test("participant deletion is cohort scoped, plan drift refuses apply, and all three tables are removed atomically",async t=>{
  const f=await reportingFixture(t),a=await f.client("same"),op=a.pilot.begin("main_chat");await f.call(a,op,5000);await f.drain(a);
  const b=await f.client("same",START+60000);b.pilot.meaningful();await f.drain(b);
  const safe=await f.client("safe",START+120000);safe.pilot.meaningful();await f.drain(safe);
  const target=snapshot(t,f),db=openTarget(target,true);t.after(()=>db.close());
  // Same pseudonym value in another cohort must remain untouched (namespace is mandatory).
  const existing=db.prepare("SELECT * FROM telemetry_sessions WHERE session_id=?").get(a.context.session_id);
  db.prepare("INSERT INTO telemetry_sessions SELECT ?,tab_id,participant_id,'other',key_version,test_class,notice_version,measurement_version,opened_at,last_interaction_at,expires_at,stopped_at,budget_minute,budget_count FROM telemetry_sessions WHERE session_id=?").run(crypto.randomUUID(),existing.session_id);
  const request={action:"participant",participant:a.participant,asOf:AS_OF},plan=deletionPlan(db,target,request);
  assert.equal(plan.counts.sessions,2);db.prepare("DELETE FROM telemetry_events WHERE session_id=?").run(b.context.session_id);
  const ledger=join(target.database,"..","telemetry-deletion-participant.json");assert.throws(()=>applyDeletion(db,target,request,plan.confirmation,ledger),/deletion_plan_changed/);assert.equal(existsSync(ledger),false);
  const current=deletionPlan(db,target,request);applyDeletion(db,target,request,current.confirmation,ledger);
  assert.equal(statSync(ledger).mode&0o777,0o600);assert.equal(db.prepare("SELECT count(*) n FROM telemetry_sessions").get().n,2);assert.equal(db.prepare("SELECT count(*) n FROM telemetry_ai_calls").get().n,0);
  assert.equal(db.prepare("SELECT count(*) n FROM telemetry_sessions WHERE cohort_id='other'").get().n,1);
  assert.equal(JSON.parse(readFileSync(ledger)).request.participant,a.participant);
});
test("real CLI produces a bounded synthetic CSV with safe headers, nulls and seven-day expiry, then prunes only managed exports",async t=>{
  const f=await reportingFixture(t),c=await f.client(),op=c.pilot.begin("main_chat");await f.call(c,op,5000);op.resolve("accepted");await f.drain(c);
  const target=snapshot(t,f),out=join(target.database,"..","telemetry-example.csv"),args=["scripts/telemetry/report.ts","export","--database",target.database,"--cohort",target.cohort,"--test-class","synthetic","--mode","local-test","--from",reportOptions.from,"--to",reportOptions.to,"--as-of",new Date(AS_OF).toISOString(),"--retained-since",new Date(reportOptions.retainedSince).toISOString(),"--linkage","approved","--operator","yes","--out",out];
  const run=spawnSync(process.execPath,args,{cwd:root,encoding:"utf8"});assert.equal(run.status,0,run.stderr);assert.match(run.stdout,/export_written_local/);
  const csv=readFileSync(out,"utf8");assert.match(csv,/mean_ai_session_usd/);assert.match(csv,/"0\.01"/);assert.doesNotMatch(csv,/PRIVATE|participant_id|email|call_id|projection_json/);assert.equal(statSync(out).mode&0o777,0o600);
  assert.equal(spawnSync(process.execPath,args,{cwd:root,encoding:"utf8"}).status,1,"exports never overwrite");
  const m=JSON.parse(readFileSync(out+".expiry.json","utf8"));assert.equal(m.expires_at-m.created_at,7*86400000);
  const dir=join(out,"..");writeFileSync(join(dir,"unmanaged.csv"),"untouched");
  assert.equal(expiryPlan(dir,m.expires_at-1).files,0);const plan=expiryPlan(dir,m.expires_at);assert.equal(plan.files,1);
  assert.throws(()=>pruneExports(dir,m.expires_at,"wrong"),/export_plan_changed/);pruneExports(dir,m.expires_at,plan.confirmation);
  assert.equal(existsSync(out),false);assert.equal(existsSync(join(dir,"unmanaged.csv")),true);
  assert.throws(()=>reportCsv(createReport(f.db.db,reportOptions),{view:"calls"}));
  // Modified/linked managed files fail closed instead of deleting arbitrary local data.
  writeExport(out,"synthetic\r\n",AS_OF);writeFileSync(out,"changed");assert.throws(()=>expiryPlan(dir,AS_OF+8*86400000),/invalid_export_manifest/);
});
