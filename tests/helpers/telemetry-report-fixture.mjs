import { build } from "esbuild";
import { createPilot } from "../../app/telemetry/pilot.ts";
import { EmulatedTelemetryD1 } from "./telemetry-sql.mjs";
import { fileURLToPath } from "node:url";
const root=fileURLToPath(new URL("../../",import.meta.url));
const bundle=await build({stdin:{contents:`export * from './app/telemetry/server.ts'; export * from './app/telemetry/d1-store.ts'; export * from './app/telemetry/model-usage-adapter.ts'; export * from './app/usage-ledger.ts'; export {runWithExecutionContext} from 'vinext/shims/request-context';`,resolveDir:root,loader:"ts"},bundle:true,write:false,platform:"node",format:"esm"});
export const m=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
export const START=Date.parse("2026-10-20T08:00:00Z"), AS_OF=Date.parse("2026-10-24T12:00:00Z");
export const reportOptions={cohort:"b3-synthetic",testClass:"synthetic",linkage:true,from:"2026-10-19",to:"2026-10-24",asOf:AS_OF,retainedSince:Date.parse("2026-10-18T00:00:00Z")};
export async function reportingFixture(t,{duplicate=false}={}){
  const db=new EmulatedTelemetryD1(),pilots=[],batches=[];let now=START;
  t.mock.method(Date,"now",()=>now);
  const config={APU_TELEMETRY_ENABLED:"1",APU_TELEMETRY_ENV:"dev",APU_TELEMETRY_HOSTNAME:"localhost",APU_TELEMETRY_SYNTHETIC:"1",APU_TELEMETRY_COHORT:"b3-synthetic",APU_TELEMETRY_KEY_VERSION:"k1",APU_TELEMETRY_NOTICE_VERSION:"n1",TELEMETRY_PSEUDONYM_KEY:"synthetic-b3-pseudonym-".repeat(3),TELEMETRY_CONTEXT_KEY:"synthetic-b3-context-".repeat(3),APU_TELEMETRY_ELIGIBLE:""};
  const resources={config,store:new m.D1TelemetryStore(db)};
  const request=(path,body)=>new Request(`http://localhost/api/telemetry/${path}`,{method:"POST",headers:{Origin:"http://localhost","Content-Type":"application/json"},body:JSON.stringify(body)});
  t.after(async()=>{for(const p of pilots)await p.stop();db.db.close();});
  async function client(name="a",at=now){
    now=at;const opened=at,identity={email:`${name}@synthetic.invalid`,role:"tester"};
    const participant=await m.participantId(identity,{cohort:config.APU_TELEMETRY_COHORT,pseudonymKey:config.TELEMETRY_PSEUDONYM_KEY});
    config.APU_TELEMETRY_ELIGIBLE=[config.APU_TELEMETRY_ELIGIBLE,participant].filter(Boolean).join(",");
    let context;
    const pilot=createPilot({enabled:true,eligible:true,noticeVersion:"n1",monotonic:()=>now-opened,wall:()=>now,random:()=>0,fetcher:async(path,init)=>{
      const body=JSON.parse(init.body);
      if(path.endsWith("context")){const result=await m.handleContext(request("context",body),identity,resources,now);if(body.action==="start")context=result;return Response.json(result);}
      batches.push(body.events);
      const result=await m.handleEvents(request("events",{...body,events:[...body.events].reverse()}),identity,resources,now);
      if(duplicate)for(let i=0;i<2;i++)await m.handleEvents(request("events",body),identity,resources,now);
      return Response.json(result);
    }});
    pilots.push(pilot);if(!await pilot.optIn())throw Error("synthetic_context_failed");
    return {pilot,identity,participant,get context(){return context;}};
  }
  async function drain(client){for(let i=0;i<100;i++){await new Promise(setImmediate);await client.pilot.flush();if(client.pilot.status().queued===0)return;}throw Error("synthetic_queue_not_drained");}
  async function call(c,operation,tokens,{pending=false,unknown=false,retryOf=null,fallbackFor=null,failed=false}={}){
    const headers=await operation.headers(),writes=[],started=now;
    const record=m.createModelUsageRecord({call_id:crypto.randomUUID(),request_id:crypto.randomUUID(),turn_id:"PRIVATE_BUSINESS_ID",phase:"F1",operation:"main_chat",attempt_index:retryOf||fallbackFor?1:0,retry_of_call_id:retryOf,fallback_for_call_id:fallbackFor,started_at:new Date(started).toISOString(),completed_at:null,requested_model:unknown?"unmapped-private-model":"gpt-5.6-terra",reported_model:null,reasoning_effort:"low",requested_service_tier:"default",reported_service_tier:null,provider_request_id:"PRIVATE_PROVIDER",provider_response_id:null,provider_status:"unknown",application_status:"not_applicable",error:null});
    await m.runWithExecutionContext({waitUntil(p){writes.push(p);}},async()=>{
      const sink=await m.createRequestTelemetrySink(new Request("http://localhost/api/chat",{headers}),c.identity,resources);
      await sink.sink(record);
      if(!pending)await sink.sink(m.finalizeModelUsageRecord(record,{completed_at:new Date(started+1).toISOString(),provider_status:failed?"failed":"completed",application_status:failed?"failed":"accepted",provider_usage:{input_tokens:tokens,output_tokens:0,input_tokens_details:{cached_tokens:0,cache_write_tokens:0},output_tokens_details:{reasoning_tokens:0}}}));
    });
    await Promise.all(writes);now=started+2;return record.call_id;
  }
  return {db,resources,client,drain,call,batches,time(value){now=value;},advance(ms){now+=ms;},get now(){return now;}};
}
