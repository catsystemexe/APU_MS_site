import assert from "node:assert/strict";
import test, { after } from "node:test";
import { build } from "esbuild";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PILOT_RULES_VERSION, PILOT_INFORMATION_VERSION, PILOT_RULES_APPROVED_TTL_SECONDS, parsePilotRulesReceipt } from "../app/pilot-rules.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const artifacts = await mkdtemp(join(tmpdir(), "apu-pilot-rules-"));
after(() => rm(artifacts, { recursive: true, force: true }));
const routes = {};
for (const name of ["pilot-rules", "chat", "extract", "analysis", "need-route", "f2", "f3"]) {
  const outfile = join(artifacts, `${name}.mjs`);
  await build({ stdin: { contents: `export * from ${JSON.stringify(join(root, `app/api/${name}/route.ts`))}; export { configureWorkerBindings } from ${JSON.stringify(join(root, "app/worker-bindings.ts"))}; export {pilotRulesKey, savePilotRulesReceipt} from ${JSON.stringify(join(root,"app/pilot-rules-server.ts"))};`, resolveDir: root },
    outfile, bundle: true, platform: "node", format: "esm", logLevel: "silent",
    plugins: [{ name: "synthetic-access-only", setup(plugin) {
      plugin.onResolve({ filter: /access-auth$/ }, () => ({ path: "auth", namespace: "test-auth" }));
      plugin.onLoad({ filter: /.*/, namespace: "test-auth" }, () => ({ loader: "js", contents: `export async function getAccessIdentity(headers) { const email=headers.get('x-email');return email?{email,role:headers.get('x-role')||'tester'}:null; }` }));
      plugin.onResolve({ filter: /\.md\?raw$/ }, args => ({ path: join(dirname(args.importer), args.path.replace(/\?raw$/, "")), namespace: "raw" }));
      plugin.onLoad({ filter: /.*/, namespace: "raw" }, async args => ({ loader: "js", contents: `export default ${JSON.stringify((await readFile(args.path,"utf8")).replace(/\r\n/g,"\n"))}` }));
    } }],
  });
  routes[name] = await import(pathToFileURL(outfile).href);
}
const identity = { email: "teacher@example.invalid", role: "tester" };
const other = "other@example.invalid";
const body = { accepted: true, rulesVersion: PILOT_RULES_VERSION, informationVersion: PILOT_INFORMATION_VERSION };
const receipt = (overrides = {}) => ({ rulesVersion: PILOT_RULES_VERSION, informationVersion: PILOT_INFORMATION_VERSION,
  acceptedAt: new Date(Date.now()-1000).toISOString(), expiresAt: new Date(Date.now()+600000).toISOString(), ...overrides });
function store() {
  const values = new Map(), writes = [];
  return { values, writes, async get(key) { return values.get(key) ?? null; }, async put(key,value,options) { values.set(key,value); writes.push({key,value,options}); } };
}
function configure(namespace, ttl = "3600") {
  for (const handler of Object.values(routes)) handler.configureWorkerBindings({ PILOT_RULES_ACCEPTANCE: namespace, PILOT_RULES_RECEIPT_TTL_SECONDS: ttl });
}
function request(name, { method = "GET", email = identity.email, origin = "https://apu.test", value = body, role = "tester" } = {}) {
  return new Request(`https://apu.test/api/${name}`, { method, headers: { ...(email ? { "x-email": email, "x-role": role } : {}), "content-type": "application/json", ...(origin ? {origin} : {}) }, ...(method === "GET" ? {} : {body:JSON.stringify(value)}) });
}

test("first entry, versioned acceptance and another device use server identity/time and finite KV TTL", async () => {
  const kv = store(); configure(kv);
  const initial = await routes["pilot-rules"].GET(request("pilot-rules"));
  assert.equal(initial.headers.get("cache-control"), "no-store");
  assert.equal((await initial.json()).receipt, null);
  const saved = await routes["pilot-rules"].POST(request("pilot-rules", {method:"POST"}));
  assert.equal(saved.status, 200);
  const result = await saved.json();
  assert.equal(result.receipt.rulesVersion, PILOT_RULES_VERSION);
  assert.ok(Date.now()-Date.parse(result.receipt.acceptedAt) < 5000);
  assert.equal(Date.parse(result.receipt.expiresAt)-Date.parse(result.receipt.acceptedAt), 3600000);
  assert.equal(kv.writes.length, 1);
  assert.deepEqual(kv.writes[0].options, {expirationTtl:3600});
  assert.doesNotMatch(JSON.stringify(kv.writes), /teacher@|User-Agent|userAgent|ipAddress|sourceQuote|notebook|jwt/i);
  assert.deepEqual((await (await routes["pilot-rules"].GET(request("pilot-rules"))).json()).receipt,result.receipt, "no browser storage or device identity is needed");
  assert.equal((await (await routes["pilot-rules"].GET(request("pilot-rules", {email:other}))).json()).receipt,null);
  assert.equal(await routes["pilot-rules"].pilotRulesKey(identity), await routes["pilot-rules"].pilotRulesKey({...identity,email:" TEACHER@EXAMPLE.INVALID "}));
});

test("PILOT-TECH-R1 explicit 90-day contract expires without read renewal; DEV test TTL and missing-config denial remain", async t => {
  assert.equal(PILOT_RULES_APPROVED_TTL_SECONDS, 7_776_000);
  const start = Date.parse("2026-10-26T12:00:00Z"); let now = start;
  t.mock.method(Date, "now", () => now);
  const kv = store(); configure(kv, String(PILOT_RULES_APPROVED_TTL_SECONDS));
  const response = await routes["pilot-rules"].POST(request("pilot-rules", { method: "POST" }));
  assert.equal(response.status, 200);
  const saved = (await response.json()).receipt;
  assert.equal(Date.parse(saved.expiresAt) - Date.parse(saved.acceptedAt), 7_776_000_000);
  assert.deepEqual(kv.writes[0].options, { expirationTtl: 7_776_000 });
  for (const elapsed of [1, 86_400_000, 7_776_000_000 - 1]) {
    now = start + elapsed;
    assert.deepEqual((await (await routes["pilot-rules"].GET(request("pilot-rules"))).json()).receipt, saved);
    assert.equal(kv.writes.length, 1, "ordinary reads cannot renew expiry");
  }
  now = Date.parse(saved.expiresAt);
  assert.equal((await (await routes["pilot-rules"].GET(request("pilot-rules"))).json()).receipt, null);
  assert.equal((await routes.chat.POST(request("chat", { method: "POST" }))).status, 428);
  const renewed = (await (await routes["pilot-rules"].POST(request("pilot-rules", { method: "POST" }))).json()).receipt;
  assert.equal(Date.parse(renewed.acceptedAt), now);
  assert.equal(Date.parse(renewed.expiresAt), now + 7_776_000_000);
  configure(kv, "86400");
  const dev = (await (await routes["pilot-rules"].POST(request("pilot-rules", { method: "POST" }))).json()).receipt;
  assert.equal(Date.parse(dev.expiresAt) - Date.parse(dev.acceptedAt), 86_400_000);
  assert.equal(kv.writes.at(-1).options.expirationTtl, 86400);
  configure(kv, "");
  assert.equal((await routes["pilot-rules"].POST(request("pilot-rules", { method: "POST" }))).status, 503);
  assert.equal(kv.writes.length, 3, "approved policy never becomes a missing-config default");
});

test("PILOT-TECH-R1 prior version keys cannot unlock current rules and GET never rewrites versioned receipts", async () => {
  const kv = store(); configure(kv);
  const currentKey = await routes["pilot-rules"].pilotRulesKey(identity);
  const oldVersion = "pilot-rules-2026-10-24-draft-1";
  const oldKey = currentKey.replace(PILOT_RULES_VERSION, oldVersion);
  kv.values.set(oldKey, JSON.stringify(receipt({ rulesVersion: oldVersion })));
  assert.equal((await (await routes["pilot-rules"].GET(request("pilot-rules"))).json()).receipt, null);
  assert.equal(kv.writes.length, 0);
  await routes["pilot-rules"].POST(request("pilot-rules", { method: "POST" }));
  assert.equal(kv.writes.length, 1);
  assert.equal(kv.writes[0].key, currentKey);
  assert.equal(kv.values.has(oldKey), true, "old keys expire by their original KV TTL; offboarding must cover all versions");
});

test("identity, origin, explicit acknowledgement and both displayed versions are mandatory", async () => {
  const kv = store(); configure(kv);
  assert.equal((await routes["pilot-rules"].GET(request("pilot-rules", {email:null}))).status,401);
  assert.equal((await routes["pilot-rules"].POST(request("pilot-rules", {method:"POST",email:null}))).status,401);
  for (const origin of [null,"https://foreign.invalid"]) assert.equal((await routes["pilot-rules"].POST(request("pilot-rules", {method:"POST",origin}))).status,403);
  for (const value of [{...body,accepted:false},{...body,email:other},{...body,acceptedAt:"2000-01-01"},[],null]) assert.equal((await routes["pilot-rules"].POST(request("pilot-rules",{method:"POST",value}))).status,400);
  for (const value of [{...body,rulesVersion:"older"},{...body,informationVersion:"older"}]) assert.equal((await routes["pilot-rules"].POST(request("pilot-rules",{method:"POST",value}))).status,409);
  assert.equal(kv.writes.length,0);
});

test("missing/invalid configuration and KV failures fail closed without exposing internal errors", async () => {
  for (const ttl of [undefined,"","59","Infinity","31536001","1.5"]) {
    const kv = store(); configure(kv, ttl ?? "");
    assert.equal((await routes["pilot-rules"].POST(request("pilot-rules",{method:"POST"}))).status,503);
    assert.equal(kv.writes.length,0);
  }
  configure(undefined);
  assert.equal((await routes["pilot-rules"].GET(request("pilot-rules"))).status,503);
  configure({get:async()=>{throw Error("PRIVATE_STORAGE_DETAIL");},put:async()=>{throw Error("PRIVATE_STORAGE_DETAIL");}});
  for (const method of ["GET","POST"]) {
    const response = await routes["pilot-rules"][method](request("pilot-rules",{method}));
    assert.equal(response.status,503);
    assert.doesNotMatch(await response.text(),/PRIVATE_STORAGE_DETAIL/);
  }
});

test("malformed, expired, future-dated and obsolete receipts never authorize; privacy-only revisions do not force new rules acceptance", async () => {
  const kv = store(); configure(kv); const key = await routes["pilot-rules"].pilotRulesKey(identity);
  for (const value of ["bad json",JSON.stringify(receipt({rulesVersion:"old"})),JSON.stringify(receipt({expiresAt:new Date(0).toISOString()})),JSON.stringify(receipt({acceptedAt:new Date(Date.now()+100000).toISOString()})),JSON.stringify(receipt({expiresAt:new Date(Date.now()+7200000).toISOString()}))]) {
    kv.values.set(key,value);
    assert.equal((await (await routes["pilot-rules"].GET(request("pilot-rules"))).json()).receipt,null);
  }
  kv.values.set(key,JSON.stringify(receipt({informationVersion:"previous-information"})));
  assert.equal((await (await routes["pilot-rules"].GET(request("pilot-rules"))).json()).receipt.informationVersion,"previous-information");
  assert.equal(parsePilotRulesReceipt({}),null);
});

for (const name of ["chat","extract","analysis","need-route","f2","f3"]) test(`${name}: direct API bypass, other-account receipts and unavailable stores stop before any provider call`, async t => {
  let calls=0;t.mock.method(globalThis,"fetch",async()=>{calls++;throw Error("provider must not run");});
  const kv=store();configure(kv);
  let response=await routes[name].POST(request(name,{method:"POST",value:{...body,accepted:true,notebook:"PRIVATE_PEDAGOGICAL_SENTINEL"}}));
  assert.equal(response.status,428);
  const result=await response.text();assert.match(result,/PILOT_RULES_REQUIRED/);assert.doesNotMatch(result,/PRIVATE_PEDAGOGICAL_SENTINEL|model_usage/);
  kv.values.set(await routes[name].pilotRulesKey({...identity,email:other}),JSON.stringify(receipt()));
  assert.equal((await routes[name].POST(request(name,{method:"POST"}))).status,428);
  assert.equal((await routes[name].POST(request(name,{method:"POST",email:null}))).status,401);
  configure(undefined);response=await routes[name].POST(request(name,{method:"POST"}));
  assert.equal(response.status,503);assert.equal(response.headers.get("X-APU-Pilot-Rules"),"unavailable");
  assert.equal(calls,0);
});

test("KV propagation delay stays blocked after a successful write, then authorizes without another write", async () => {
  const kv=store();configure(kv);
  const original=kv.get;kv.get=async()=>null;
  assert.equal((await routes["pilot-rules"].POST(request("pilot-rules",{method:"POST"}))).status,200);
  assert.equal((await routes.chat.POST(request("chat",{method:"POST"}))).status,428);
  kv.get=original;
  // No configured provider: valid receipt gets past onboarding and reaches existing request validation/configuration.
  const response=await routes["pilot-rules"].GET(request("pilot-rules"));assert.ok((await response.json()).receipt);
  assert.equal(kv.writes.length,1);
});

test("combined flow: verified rules unlock stateless Notebook-based Main without granting another account access", async t => {
  const { fallbackQuestController } = await import("../app/dialog-action.ts");
  const kv=store();configure(kv);
  const notebook=[
    {id:"observation",category:"manifestations",text:"Při zadání odkládá tužku.",trust:"confirmed"},
    {id:"need",category:"goals",text:"Potřebuji porozumět situaci.",trust:"confirmed"},
  ];
  const value={message:"Při společné práci.",notebook,intakeNotebook:notebook,phase:"intake",
    dialogContext:{lastQuestions:["Při které činnosti?"]},
    previousResponseId:"OBSOLETE_PROVIDER_CHAIN",messages:[{role:"user",content:"DO_NOT_REPLAY_TRANSCRIPT"}]};
  const payloads=[];
  for(const key of ["OPENAI_API_KEY","APU_VECTOR_STORE_ID"]) {
    const previous=process.env[key];process.env[key]="synthetic-integration-only";
    t.after(()=>{if(previous===undefined)delete process.env[key];else process.env[key]=previous;});
  }
  t.mock.method(globalThis,"fetch",async(url,init)=>{
    assert.equal(url,"https://api.openai.com/v1/responses");
    const payload=JSON.parse(init.body);payloads.push(payload);
    const response={id:"synthetic-provider-response",status:"completed",model:payload.model,usage:{input_tokens:10,output_tokens:2,total_tokens:12}};
    if(payload.stream) return new Response([
      {type:"response.output_text.delta",delta:"Rozumím."},
      {type:"response.completed",response:{...response,output:[{type:"message"}]}},
    ].map(event=>`data: ${JSON.stringify(event)}\n\n`).join(""),{headers:{"Content-Type":"text/event-stream"}});
    assert.equal(payload.text.format.name,"apu_quest_controller");
    return Response.json({...response,output_text:JSON.stringify({...fallbackQuestController(notebook,"intake"),chat_navigation_event:"none"})});
  });
  assert.equal((await routes.chat.POST(request("chat",{method:"POST",value,role:"developer"}))).status,428);
  assert.equal(payloads.length,0,"no model call before server acceptance");
  assert.equal((await routes["pilot-rules"].POST(request("pilot-rules",{method:"POST"}))).status,200);
  const response=await routes.chat.POST(request("chat",{method:"POST",value,role:"developer"}));
  assert.equal(response.status,200);
  const events=(await response.text()).trim().split("\n").map(line=>JSON.parse(line));
  assert.equal(payloads.length,2);
  const main=payloads.find(payload=>payload.stream);
  assert.equal(main.input,value.message);
  assert.ok(main.instructions.includes(JSON.stringify(notebook)));
  assert.ok(main.instructions.includes(JSON.stringify({dialogContext:value.dialogContext})));
  for(const payload of payloads) {
    assert.equal(payload.store,false);
    assert.equal(Object.hasOwn(payload,"previous_response_id"),false);
    assert.doesNotMatch(JSON.stringify(payload),/OBSOLETE_PROVIDER_CHAIN|DO_NOT_REPLAY_TRANSCRIPT/);
  }
  const done=events.find(event=>event.type==="done");
  assert.equal(done.telemetry.context_sizes.previous_response_context,0);
  assert.equal(done.model_usage_records.length,2);
  assert.equal((await routes.chat.POST(request("chat",{method:"POST",email:other,value,role:"developer"}))).status,428);
  assert.equal(payloads.length,2,"another account cannot inherit the acknowledgement or response chain");
});
