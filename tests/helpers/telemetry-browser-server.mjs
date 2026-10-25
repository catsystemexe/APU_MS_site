import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { bundleFixture, syntheticFixture, root } from "./telemetry-browser-fixture.mjs";

// No test-control HTTP endpoints, configurable bind address, env-file loader or
// identity shortcut. Call explicitly from tests with syntheticOnly:true.
export async function startHarness({ syntheticOnly, enabled = false } = {}) {
  if (syntheticOnly !== true) throw Error("Explicit synthetic test context required");
  const directory = await mkdtemp(join(tmpdir(), "apu-telemetry-browser-"));
  let fixture, server;
  try {
    const bundled = await bundleFixture(directory), r = bundled.routes;
    fixture = await syntheticFixture(directory, r, { enabled });
    const css = (await readFile(join(root, "app/globals.css"), "utf8")).replace(/@import\s+["']tailwindcss["'];?/, "");
    const routeNames = ["chat", "extract", "analysis", "need-route", "f2", "f3"];
    const handlers = { "/api/telemetry/context": r.contextPOST, "/api/telemetry/events": r.eventsPOST, "/api/session": r.sessionGET,
      ...Object.fromEntries(routeNames.map((n, i) => ["/api/" + n, r["route" + i]])) };
    const requests = [], inFlight = new Set();
    let origin;
    server = createServer((req, res) => {
      const work = (async () => {
        if (req.headers.host !== new URL(origin).host || !["127.0.0.1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress)) { res.writeHead(403).end(); return; }
        const url = new URL(req.url, origin);
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'");
        if (req.method === "GET" && url.pathname === "/client.js") { res.setHeader("Content-Type", "text/javascript"); res.end(bundled.client); return; }
        if (req.method === "GET" && url.pathname === "/style.css") { res.setHeader("Content-Type", "text/css"); res.end(css); return; }
        if (req.method === "GET" && url.pathname === "/favicon.ico") { res.writeHead(204).end(); return; }
        if (req.method === "GET" && /\.(svg|woff2?)$/.test(url.pathname)) {
          const file = resolve(root, "public", "." + url.pathname);
          if (!file.startsWith(resolve(root, "public") + sep)) { res.writeHead(403).end(); return; }
          try { const bytes = await readFile(file); res.setHeader("Content-Type", file.endsWith("svg") ? "image/svg+xml" : "font/woff2"); res.end(bytes); } catch { res.writeHead(404).end(); } return;
        }
        const rulesRoute = url.pathname === "/api/pilot-rules" && ["GET", "POST"].includes(req.method);
        if (!rulesRoute && !(url.pathname === "/" && req.method === "GET") && (!handlers[url.pathname] || (url.pathname === "/api/session" ? req.method !== "GET" : req.method !== "POST"))) { res.writeHead(404).end(); return; }
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > 1024 * 1024) { res.writeHead(413).end(); return; } chunks.push(chunk); }
        const headers = new Headers();
        for (const [k, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(k, Array.isArray(value) ? value.join(",") : value);
        const request = new Request(url, { method: req.method, headers, ...(req.method === "POST" ? { body: Buffer.concat(chunks) } : {}) });
        const entry = { path: url.pathname, status: null };
        if (url.pathname === "/api/telemetry/events") { try { entry.body = JSON.parse(await request.clone().text()); } catch { /* Real handler validates malformed JSON. */ } }
        requests.push(entry);
        r.configureWorkerBindings(fixture.bindings);
        const response = await r.requestScope.run(request, () => r.runWithTelemetryResources(fixture.bindings, () => r.runWithExecutionContext({ waitUntil: p => fixture.track(p) }, async () => {
          if (rulesRoute) return (req.method === "GET" ? r.rulesGET : r.rulesPOST)(request);
          if (url.pathname !== "/") return handlers[url.pathname](request);
          const element = await r.Home();
          if (typeof element.props.email !== "string") return new Response("Verified synthetic Access identity required", { status: 401 });
          const props = JSON.stringify(element.props).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
          return new Response(`<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="application/json" id="bootstrap">${props}</script><script type="module" src="/client.js"></script></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
        })));
        entry.status = response.status;
        res.writeHead(response.status, Object.fromEntries(response.headers));
        const reader = response.body?.getReader();
        if (!reader) { res.end(); return; }
        res.on("close", () => { if (!res.writableEnded) void reader.cancel().catch(() => {}); });
        try { while (!res.destroyed) { const { done, value } = await reader.read(); if (done) break; res.write(value); } } finally { reader.releaseLock(); res.end(); }
      })().catch(() => { if (!res.headersSent) res.writeHead(500); res.end("Synthetic harness failure"); });
      inFlight.add(work); void work.finally(() => inFlight.delete(work));
    });
    await new Promise((yes, no) => { server.once("error", no); server.listen(0, "127.0.0.1", yes); });
    origin = `http://127.0.0.1:${server.address().port}`;
    return { ...fixture, get now() { return fixture.now; }, directory, origin, requests, inputs: bundled.inputs,
      async request(path, { token, body, headers = {}, method = "POST" } = {}) {
        if (!path.startsWith("/api/") || path.includes("://")) throw Error("Local API test request only");
        return fixture.fetch(origin + path, { method, headers: { Origin: origin, "Content-Type": "application/json", ...(token ? { "cf-access-jwt-assertion": token } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      },
      async close() {
        fixture.releaseStreams();
        server.closeAllConnections(); await new Promise(yes => server.close(yes));
        await Promise.allSettled([...inFlight]); await fixture.close(); await rm(directory, { recursive: true, force: true, maxRetries: 3 });
      },
    };
  } catch (error) {
    server?.closeAllConnections(); server?.close();
    if (fixture) await fixture.close();
    await rm(directory, { recursive: true, force: true, maxRetries: 3 }); throw error;
  }
}
