// Generated identities and local transport only. Produces no provider or remote requests.
import { mock } from "node:test";
import { mkdirSync,writeFileSync,chmodSync } from "node:fs";
import { resolve,join } from "node:path";
import { reportingFixture,reportOptions,START,AS_OF } from "../../tests/helpers/telemetry-report-fixture.mjs";
import { createReport } from "../../telemetry/reports/engine.ts";
import { reportCsv } from "../../telemetry/reports/csv.ts";
import { writeExport } from "../../telemetry/reports/local.ts";
const after=[],f=await reportingFixture({mock,after(fn){after.push(fn);}}),directory=resolve(process.argv[2]??"work/telemetry-b3-example");
try{
  mkdirSync(directory,{recursive:true});
  for(const[i,tokens]of[5000,15000,50000].entries()){
    const c=await f.client(`sample-${i}`,START+i*60000),op=c.pilot.begin("main_chat");await f.call(c,op,tokens);op.resolve("accepted");c.pilot.transition("F3","user_navigation");c.pilot.document(Symbol(),"baseline");await f.drain(c);
  }
  const c=await f.client("sample-unknown",START+180000),op=c.pilot.begin("main_chat");await f.call(c,op,5000,{unknown:true});op.resolve("accepted");await f.drain(c);
  const zero=await f.client("sample-zero",START+240000);zero.pilot.meaningful();zero.pilot.view(true,true);zero.pilot.interaction();f.advance(15000);zero.pilot.tick();zero.pilot.transition("F3","user_navigation");zero.pilot.document(Symbol(),"baseline");await f.drain(zero);
  const database=join(directory,"telemetry-synthetic.sqlite");f.db.db.prepare("VACUUM INTO ?").run(database);chmodSync(database,0o600);
  writeFileSync(database+".target.json",JSON.stringify({kind:"apu-telemetry",schema_version:1,mode:"local-test",test_class:"synthetic",cohorts:["b3-synthetic"]})+"\n",{flag:"wx",mode:0o600});
  const report=createReport(f.db.db,reportOptions),csv=reportCsv(report,{operator:true,createdAt:AS_OF});writeExport(join(directory,"telemetry-synthetic-summary.csv"),csv,AS_OF);
  writeExport(join(directory,"telemetry-synthetic-shared.csv"),reportCsv(report,{createdAt:AS_OF}),AS_OF);
  process.stdout.write(JSON.stringify({synthetic:true,database,summary:report.rows.summary[0]})+"\n");
}finally{for(const fn of after)await fn();mock.restoreAll();}
