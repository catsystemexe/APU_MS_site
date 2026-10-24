import assert from "node:assert/strict";
import test, { after } from "node:test";
import { build } from "esbuild";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PILOT_RULES_VERSION, PILOT_INFORMATION_VERSION, parsePilotRulesReceipt } from "../app/pilot-rules.ts";

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
