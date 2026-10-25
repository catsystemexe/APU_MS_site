import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import { fallbackQuestController } from "../../app/dialog-action.ts";
import { EmulatedTelemetryD1 } from "./telemetry-sql.mjs";

export const root = fileURLToPath(new URL("../../", import.meta.url));
export const START = Date.parse("2026-10-20T08:00:00Z");
export const reportOptions = { cohort: "browser-h1", testClass: "synthetic", linkage: true,
  from: "2026-10-20", to: "2026-10-21", asOf: Date.parse("2026-10-24T12:00:00Z"), retainedSince: Date.parse("2026-10-19T00:00:00Z") };

export async function bundleFixture(directory) {
  const outfile = join(directory, "routes.mjs");
  await build({ stdin: { contents: `
    export {default as Home} from './app/page.tsx';
    export {POST as contextPOST} from './app/api/telemetry/context/route.ts';
    export {POST as eventsPOST} from './app/api/telemetry/events/route.ts';
    export {GET as sessionGET} from './app/api/session/route.ts';
    export {GET as rulesGET, POST as rulesPOST} from './app/api/pilot-rules/route.ts';
    export {configureWorkerBindings} from './app/worker-bindings.ts';
    export {pilotRulesKey} from './app/pilot-rules-server.ts';
    export {PILOT_RULES_VERSION, PILOT_INFORMATION_VERSION} from './app/pilot-rules.ts';
    ${["chat", "extract", "analysis", "need-route", "f2", "f3"].map((r, i) => `export {POST as route${i}} from './app/api/${r}/route.ts';`).join("\n")}
    export * from './app/telemetry/runtime.ts';
    export {participantId} from './app/telemetry/server.ts';
    export {runWithExecutionContext} from 'vinext/shims/request-context';
    export {requestScope} from 'next/headers';
  `, resolveDir: root, loader: "tsx" }, outfile, bundle: true, platform: "node", format: "esm", jsx: "automatic", logLevel: "silent",
    // Lexical dependencies affect only this isolated route bundle, never Node's
    // test runner or Playwright's own wall clock/transport.
    banner: { js: `
      const NativeDate=globalThis.Date;
      export const testClock={offset:${START}-NativeDate.now(),fixed:null,
        get now(){return this.fixed??NativeDate.now()+this.offset;},
        advance(ms){if(this.fixed===null)this.offset+=ms;else this.fixed+=ms;},
        freeze(at=this.now){this.fixed=at;return at;}};
      const Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[testClock.now]));}static now(){return testClock.now;}};
      let testTransport;
      export function setTestTransport(value){testTransport=value;}
      const fetch=(...args)=>{if(!testTransport)throw Error('No synthetic transport');return testTransport(...args);};
    ` },
    plugins: [{ name: "isolated-browser-boundaries", setup(plugin) {
      plugin.onResolve({ filter: /^next\/headers$/ }, () => ({ path: "headers", namespace: "fixture" }));
      plugin.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ loader: "js", contents: `
        import {AsyncLocalStorage} from 'node:async_hooks';
        export const requestScope=new AsyncLocalStorage();
        export async function headers(){const request=requestScope.getStore();if(!request)throw Error('Missing real test request');return request.headers;}
      ` }));
      // Home itself authenticates and computes actual pilot props. RSC/SSR/hydration
      // are excluded: only its client boundary is a marker in this server bundle.
      plugin.onResolve({ filter: /^\.\/apu-client$/ }, args => args.importer.endsWith("page.tsx") ? { path: "client-marker", namespace: "fixture-client" } : undefined);
      plugin.onLoad({ filter: /.*/, namespace: "fixture-client" }, () => ({ contents: "export default function ClientBoundary(){throw Error('Not an SSR harness')}", loader: "js" }));
      plugin.onResolve({ filter: /\.md\?raw$/ }, args => ({ path: join(dirname(args.importer), args.path.replace(/\?raw$/, "")), namespace: "raw" }));
      plugin.onLoad({ filter: /.*/, namespace: "raw" }, async args => ({ contents: `export default ${JSON.stringify((await readFile(args.path, "utf8")).replace(/\r\n/g, "\n"))}`, loader: "js" }));
    } }],
  });
  const browser = await build({ entryPoints: [join(root, "tests/browser/telemetry/entry.jsx")], bundle: true, write: false, platform: "browser", format: "esm", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, metafile: true, logLevel: "silent" });
  // Inspection evidence: this bundle contains actual components/client/emitters,
  // never the server fixture, credentials, Node runtime or a provider transport.
  await writeFile(join(directory, "client-inputs.json"), JSON.stringify(Object.keys(browser.metafile.inputs), null, 2));
  return { routes: await import(pathToFileURL(outfile).href), client: browser.outputFiles[0].text, inputs: Object.keys(browser.metafile.inputs) };
}

export async function syntheticFixture(directory, routes, { enabled = false } = {}) {
  const db = new EmulatedTelemetryD1(join(directory, "telemetry-browser.sqlite"));
  const issuer = "https://browser-auth.synthetic.invalid", audience = "browser-h1", kid = "ephemeral-h1";
  const key = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const jwk = { ...await crypto.subtle.exportKey("jwk", key.publicKey), kid, alg: "RS256" };
  // Existing H1 scenarios start with rules accepted. Joint tests revoke/expire
  // these real receipt records; the actual gate and API remain in the bundle.
  const receipts = new Map(), receiptWrites = [];
  const rules = { receipts, writes: receiptWrites, unavailable: false };
  const receiptNamespace = {
    async get(key) { if (rules.unavailable) throw Error("synthetic_rules_unavailable"); return receipts.get(key) ?? null; },
    async put(key, value, options) { if (rules.unavailable) throw Error("synthetic_rules_unavailable"); receipts.set(key, value); receiptWrites.push({ key, value, options }); },
  };
  const receiptTime = routes.testClock.now;
  for (const name of ["browser-a", "browser-b"]) receipts.set(await routes.pilotRulesKey({ email: name + "@synthetic.invalid" }), JSON.stringify({
    rulesVersion: routes.PILOT_RULES_VERSION, informationVersion: routes.PILOT_INFORMATION_VERSION,
    acceptedAt: new Date(receiptTime - 1000).toISOString(), expiresAt: new Date(receiptTime + 3_599_000).toISOString(),
  }));
  const bindings = { TELEMETRY_DB: db, APU_TELEMETRY_ENV: "dev", APU_TELEMETRY_HOSTNAME: "127.0.0.1", APU_TELEMETRY_SYNTHETIC: "1",
    PILOT_RULES_ACCEPTANCE: receiptNamespace, PILOT_RULES_RECEIPT_TTL_SECONDS: "3600",
    APU_TELEMETRY_COHORT: reportOptions.cohort, APU_TELEMETRY_KEY_VERSION: "h1", APU_TELEMETRY_NOTICE_VERSION: "h1",
    APU_TELEMETRY_NOTICE_TEXT: "Synthetic voluntary measurement. Test data only.",
    TELEMETRY_PSEUDONYM_KEY: randomBytes(32).toString("base64url"), TELEMETRY_CONTEXT_KEY: randomBytes(32).toString("base64url"),
    APU_TELEMETRY_ELIGIBLE: "", ...(enabled ? { APU_TELEMETRY_ENABLED: "1" } : {}) };
  bindings.APU_TELEMETRY_ELIGIBLE = (await Promise.all(["browser-a", "browser-b"].map(name => routes.participantId({ email: name + "@synthetic.invalid", role: "tester" }, { cohort: bindings.APU_TELEMETRY_COHORT, pseudonymKey: bindings.TELEMETRY_PSEUDONYM_KEY })))).join(",");
  const env = { NODE_ENV: "production", APU_LOCAL_DEV_AUTH: "0", CF_ACCESS_TEAM_DOMAIN: issuer, CF_ACCESS_AUD: audience, APU_DEVELOPER_EMAILS: "",
    OPENAI_API_KEY: "synthetic-transport-only", APU_VECTOR_STORE_ID: "synthetic-transport-only" };
  const saved = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]]));
  Object.assign(process.env, env);
  const fetch = globalThis.fetch;
  let unavailable = false, unknownUsage = false, gate = null, replyGate = null;
  const now = () => routes.testClock.now;
  const held = new Set();
  const providerCalls = [], providerPayloads = [], blocked = [], lifetimes = new Set();
  const batch = db.batch.bind(db);
  db.batch = async statements => { if (unavailable) throw Error("synthetic_store_unavailable"); return batch(statements); };
  routes.setTestTransport(async (url, init) => {
    if (String(url) === issuer + "/cdn-cgi/access/certs") return Response.json({ keys: [jwk] });
    if (String(url) !== "https://api.openai.com/v1/responses") { blocked.push("unexpected_outbound"); throw Error("Unexpected outbound test transport"); }
    const p = JSON.parse(init.body); providerPayloads.push(p); providerCalls.push({ stream: !!p.stream, format: p.text?.format?.name ?? null, model: p.model });
    if (replyGate && p.text?.format?.name.endsWith(replyGate.suffix)) { const pending = replyGate; replyGate = null; await pending.promise; held.delete(pending); }
    const response = { id: "synthetic-" + providerCalls.length, status: "completed", model: p.model, service_tier: "default",
      ...(unknownUsage ? {} : { usage: { input_tokens: 100, output_tokens: 10, total_tokens: 110 } }) };
    if (p.stream) {
      const pending = gate; gate = null;
      return new Response(new ReadableStream({ async start(c) {
        c.enqueue(new TextEncoder().encode('data: ' + JSON.stringify({ type: "response.output_text.delta", delta: "Synthetic response." }) + '\n\n'));
        if (pending) { await pending.promise; held.delete(pending); }
        c.enqueue(new TextEncoder().encode('data: ' + JSON.stringify({ type: "response.completed", response }) + '\n\n')); c.close();
      } }), { headers: { "Content-Type": "text/event-stream" } });
    }
    const format = p.text.format.name;
    const hypothesis = { id: "h", rank: 1, title: "Synthetic possibility", summary: "Provisional explanation.", relevantNeeds: ["n"], question: null, questions: [], supportingInformation: [], limitations: ["Limited evidence."], unknowns: [] };
    const material = { title: "Synthetic output", introduction: "Synthetic accepted source.", sections: [{ heading: "Context", content: "Uncertainty retained." }], table: null, cards: [], usageNote: null };
    let result;
    if (format === "apu_quest_controller") { const context = JSON.parse(p.input[1].content[0].text); result = { ...fallbackQuestController(context.currentNotebook, context.phase), chat_navigation_event: "none" }; }
    else if (format === "apu_notepad_extraction") result = { situationRelation: "same", situationReason: null, categoryReview: { manifestations: "none", goals: "none", context: "none", course: "none", helps: "none" }, candidates: [] };
    else if (format.startsWith("apu_phase_2")) result = { hypotheses: [hypothesis], needs: [{ needId: "n", title: "Understand the situation.", direction: "Understand.", relevantHypotheses: ["h"], question: null }], mainUncertainty: "Limited evidence.", chatUpdate: { kind: "entry", summary: "Provisional analysis.", nextPrompt: null }, transitionReady: true };
    else if (format === "apu_f2_need_route") result = { path: "POCHOPIT", clarification: null };
    else if (format.endsWith("_build")) result = { hypotheses: [hypothesis], pathResult: { kind: "understanding", relationships: [], comparisons: [], expertFrame: [], synthesis: "Provisional synthesis." }, decisions: [], uncertainties: [], missingInformation: [] };
    else if (format.endsWith("_components")) { const context = JSON.parse(p.input); result = { components: Object.fromEntries(context.components.map(c => [c.id, "Synthetic expansion."])) }; }
    else if (format.endsWith("_preview")) result = material;
    else if (format.endsWith("_final_render")) result = { kind: "material", material, boundaryIssue: null };
    else throw Error("Unsupported synthetic provider format");
    return Response.json({ ...response, output_text: JSON.stringify(result) });
  });
  return { db, bindings, providerCalls, providerPayloads, blocked, lifetimes, fetch, rules,
    get now() { return now(); }, advance: ms => routes.testClock.advance(ms), freeze: at => routes.testClock.freeze(at), setUnavailable(v) { unavailable = v; }, setUnknownUsage(v) { unknownUsage = v; },
    holdStream() { if (gate) throw Error("Stream already held"); let release; const promise = new Promise(r => { release = r; }); gate = { promise, release }; held.add(gate); return release; },
    holdReply(suffix) { if (replyGate) throw Error("Reply already held"); let release; const promise = new Promise(r => { release = r; }); replyGate = { promise, release, suffix }; held.add(replyGate); return release; },
    async token({ email = "browser-a@synthetic.invalid", ...claims } = {}, { badSignature = false } = {}) {
      const part = v => Buffer.from(JSON.stringify(v)).toString("base64url");
      const raw = part({ alg: "RS256", kid }) + "." + part({ iss: issuer, aud: audience, email, exp: Math.floor(now() / 1000) + 3600, ...claims });
      const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key.privateKey, Buffer.from(raw)));
      if (badSignature) signature[0] ^= 1;
      return raw + "." + Buffer.from(signature).toString("base64url");
    },
    track(promise) { lifetimes.add(promise); void promise.finally(() => lifetimes.delete(promise)).catch(() => {}); },
    releaseStreams() { for (const pending of held) pending.release(); },
    async drain() { while (lifetimes.size) await Promise.allSettled([...lifetimes]); },
    async close() {
      this.releaseStreams(); await this.drain(); db.db.close(); routes.setTestTransport(null);
      for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    },
  };
}
