import { check, keys, object, uuid, integer, LIMITS, MEASUREMENT_VERSION, TelemetryError, validateBatch, type Health } from "./contract.ts";
import { ownerOf, type Session } from "./store.ts";
import type { TelemetryResources } from "./runtime.ts";
import type { AccessIdentity } from "../access-auth.ts";
export type Policy = { environment: "dev" | "public"; cohort: string; keyVersion: string; notice: string; pseudonymKey: string; contextKey: string;
  eligible: Set<string>; synthetic: boolean; metadata: boolean };
const tag = (v: unknown): v is string => typeof v === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(v);
const hash = (v: unknown): v is string => typeof v === "string" && /^[a-zA-Z0-9_-]{43}$/.test(v);
const secret = (v: unknown): v is string => typeof v === "string" && v.length >= 32 && v.length <= 512;
// DEV messages start with a tag/base64 character; the leading NUL makes the
// PUBLIC domain disjoint even for a malformed identity containing a NUL.
const PUBLIC_HMAC_DOMAIN = "\0apu-public\0";
export function readiness(request: Request, r: TelemetryResources): { code: Health; policy?: Policy } {
  const c = r.config;
  if (c.APU_TELEMETRY_ENABLED !== "1") return { code: "disabled" };
  const url = new URL(request.url);
  const environment = c.APU_TELEMETRY_ENV;
  if (environment !== "dev" && environment !== "public") return { code: "not_ready" };
  const hostedName = environment === "dev" ? "apu-ms-site-dev.catsystem-exe.workers.dev" : "apu.catsystem.ai";
  const localSynthetic = environment === "dev" && c.APU_TELEMETRY_SYNTHETIC === "1" &&
    ["http:", "https:"].includes(url.protocol) && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (c.APU_TELEMETRY_HOSTNAME !== url.hostname ||
    !((url.protocol === "https:" && !url.port && url.hostname === hostedName) || localSynthetic) ||
    (environment === "public" && c.APU_TELEMETRY_SYNTHETIC !== "0")) return { code: "not_ready" };
  const synthetic = c.APU_TELEMETRY_SYNTHETIC === "1";
  if ((!synthetic && c.APU_TELEMETRY_PRIVACY_APPROVED !== "1") || !r.store || !tag(c.APU_TELEMETRY_COHORT) ||
    !tag(c.APU_TELEMETRY_KEY_VERSION) || !tag(c.APU_TELEMETRY_NOTICE_VERSION) ||
    !secret(c.TELEMETRY_PSEUDONYM_KEY) || !secret(c.TELEMETRY_CONTEXT_KEY) || c.TELEMETRY_PSEUDONYM_KEY === c.TELEMETRY_CONTEXT_KEY)
    return { code: "not_ready" };
  const eligible = typeof c.APU_TELEMETRY_ELIGIBLE === "string" ? c.APU_TELEMETRY_ELIGIBLE.split(",").filter(Boolean) : [];
  if (!eligible.length || eligible.length > 1000 || !eligible.every(hash)) return { code: "not_ready" };
  return { code: "ready", policy: { environment, cohort: c.APU_TELEMETRY_COHORT, keyVersion: c.APU_TELEMETRY_KEY_VERSION,
    notice: c.APU_TELEMETRY_NOTICE_VERSION, pseudonymKey: c.TELEMETRY_PSEUDONYM_KEY, contextKey: c.TELEMETRY_CONTEXT_KEY,
    eligible: new Set(eligible), synthetic, metadata: c.APU_TELEMETRY_METADATA_ENABLED === "1" } };
}
function encode(value: Uint8Array) { return btoa(String.fromCharCode(...value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function decode(value: string) { return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0)); }
async function key(secretValue: string) { return crypto.subtle.importKey("raw", new TextEncoder().encode(secretValue), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]); }
export async function participantId(identity: AccessIdentity, policy: Pick<Policy, "cohort" | "pseudonymKey"> & Partial<Pick<Policy, "environment">>) {
  // Preserve existing DEV enrollment; PUBLIC has a disjoint HMAC domain even if
  // an operator accidentally copies DEV key material. Separate D1/keys are still required.
  const domain = policy.environment === "public" ? PUBLIC_HMAC_DOMAIN : "";
  return encode(new Uint8Array(await crypto.subtle.sign("HMAC", await key(policy.pseudonymKey),
    new TextEncoder().encode(`${domain}${policy.cohort}\0${identity.email.trim().toLocaleLowerCase("en-US")}`))));
}
export async function eligibleParticipant(identity: AccessIdentity | null, policy: Policy) {
  check(identity, "unauthorized");
  check(!policy.synthetic || /^[a-z0-9-]+@synthetic\.invalid$/.test(identity.email), "ineligible");
  check(policy.synthetic || identity.role === "tester", "ineligible");
  const id = await participantId(identity, policy);
  check(policy.eligible.has(id), "ineligible");
  return id;
}
export function sameOrigin(request: Request) {
  check(request.headers.get("origin") === new URL(request.url).origin &&
    (!request.headers.has("sec-fetch-site") || request.headers.get("sec-fetch-site") === "same-origin") &&
    /^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? ""), "invalid_request");
}
export async function readJson(request: Request): Promise<unknown> {
  check(!request.headers.has("content-encoding"), "invalid_request");
  const length = request.headers.get("content-length");
  check(length === null || (/^\d+$/.test(length) && Number(length) <= LIMITS.requestBytes), "invalid_request");
  const reader = request.body?.getReader(); check(reader, "invalid_request");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > LIMITS.requestBytes) { await reader.cancel(); throw new TelemetryError("invalid_request"); }
      chunks.push(value);
    }
    const data = new Uint8Array(size); let i = 0; for (const chunk of chunks) { data.set(chunk, i); i += chunk.length; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data));
  } catch { throw new TelemetryError("invalid_request"); }
  finally { reader.releaseLock(); }
}
function contextMessage(body: string, policy: Policy) {
  return new TextEncoder().encode(`${policy.environment === "public" ? PUBLIC_HMAC_DOMAIN : ""}${body}`);
}
export async function signContext(session: Session, policy: Policy) {
  // Opaque server lookup ID only; participant pseudonym is never sent to the browser.
  const body = encode(new TextEncoder().encode(JSON.stringify({ v: 1, id: session.session_id, exp: session.expires_at, key: session.key_version })));
  return `${body}.${encode(new Uint8Array(await crypto.subtle.sign("HMAC", await key(policy.contextKey), contextMessage(body, policy))))}`;
}
export async function resolveContext(token: unknown, participant: string, policy: Policy, r: TelemetryResources, now: number, allowStopped = false) {
  try {
    check(typeof token === "string" && token.length <= 1024, "invalid_context");
    const parts = token.split("."); check(parts.length === 2 && parts.every(p => /^[A-Za-z0-9_-]+$/.test(p)), "invalid_context");
    check(await crypto.subtle.verify("HMAC", await key(policy.contextKey), decode(parts[1]), contextMessage(parts[0], policy)), "invalid_context");
    const claims: unknown = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    keys(claims, ["v", "id", "exp", "key"]); check(claims.v === 1 && uuid(claims.id) && integer(claims.exp) && claims.exp > now && claims.key === policy.keyVersion, "invalid_context");
    const session = await r.store!.getSession(claims.id);
    check(session && session.participant_id === participant && session.cohort_id === policy.cohort && session.key_version === policy.keyVersion &&
      session.expires_at === claims.exp && (allowStopped || (session.stopped_at === null && now - session.last_interaction_at < LIMITS.idleMs)), "invalid_context");
    return session;
  } catch (error) { if (error instanceof TelemetryError && error.code === "unavailable") throw error; throw new TelemetryError("invalid_context"); }
}
export async function handleContext(request: Request, identity: AccessIdentity | null, r: TelemetryResources, now = Date.now()) {
  const ready = readiness(request, r); check(ready.policy, ready.code); sameOrigin(request);
  const policy = ready.policy, participant = await eligibleParticipant(identity, policy), body = await readJson(request);
  check(object(body));
  if ("action" in body && body.action === "stop") {
    keys(body, ["action", "context"]);
    const session = await resolveContext(body.context, participant, policy, r, now, true);
    await r.store!.stopSession(ownerOf(session), now); return { code: "stopped" as const };
  }
  keys(body, ["action", "opt_in", "notice_version", "tab_id"]);
  check(body.action === "start" && body.opt_in === true && body.notice_version === policy.notice, "consent_required");
  check(uuid(body.tab_id));
  const session: Session = { session_id: crypto.randomUUID(), tab_id: body.tab_id, participant_id: participant,
    cohort_id: policy.cohort, key_version: policy.keyVersion, notice_version: policy.notice, measurement_version: MEASUREMENT_VERSION,
    test_class: policy.synthetic ? "synthetic" : identity!.role, opened_at: now, last_interaction_at: now, expires_at: now + LIMITS.lifetimeMs, stopped_at: null };
  await r.store!.createSession(session);
  return { code: "ready" as const, context: await signContext(session, policy), session_id: session.session_id,
    tab_id: session.tab_id, server_anchor_ms: now, expires_at: session.expires_at, measurement_version: MEASUREMENT_VERSION,
    metadata_enabled: policy.metadata, interval_ms: LIMITS.intervalMs, idle_ms: LIMITS.idleMs };
}
export async function handleEvents(request: Request, identity: AccessIdentity | null, r: TelemetryResources, now = Date.now()) {
  const ready = readiness(request, r); check(ready.policy, ready.code); sameOrigin(request);
  const policy = ready.policy, participant = await eligibleParticipant(identity, policy), body = await readJson(request);
  keys(body, ["context", "events", "sent_elapsed_ms"]);
  check(integer(body.sent_elapsed_ms, LIMITS.lifetimeMs));
  const events = validateBatch(body.events, policy.metadata);
  const session = await resolveContext(body.context, participant, policy, r, now);
  // Send-time anchor separates bounded queue age from actual clock inconsistency.
  check(Math.abs(session.opened_at + body.sent_elapsed_ms - now) <= 5000);
  for (const e of events) check(e.elapsed_ms <= body.sent_elapsed_ms && body.sent_elapsed_ms - e.elapsed_ms <= LIMITS.delayMs && e.session_id === session.session_id && e.tab_id === session.tab_id &&
    session.opened_at + e.elapsed_ms <= now + 5000 && now - (session.opened_at + e.elapsed_ms) <= LIMITS.delayMs);
  const acknowledged = await r.store!.ingest(ownerOf(session), events.map(event => ({ event,
    occurred_at: session.opened_at + event.elapsed_ms, received_at: now, app_version: "unknown" })), now);
  return { code: "ready" as const, acknowledged };
}
export function telemetryResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Origin, Cf-Access-Jwt-Assertion",
    ...(status === 429 ? { "Retry-After": "60" } : {}) } });
}
export function telemetryFailure(error: unknown) {
  const code = error instanceof TelemetryError ? error.code : "unavailable";
  const status = code === "disabled" || code === "not_ready" || code === "ineligible" ? 200 :
    code === "unauthorized" ? 401 : code === "conflict" ? 409 : code === "rate_limited" ? 429 : code === "unavailable" ? 503 : 400;
  return telemetryResponse({ code }, status);
}


/** Minimal authenticated page bootstrap; no context/request/write before voluntary opt-in. */
export async function pilotAvailability(request: Request, identity: AccessIdentity, r: TelemetryResources) {
  const ready = readiness(request, r);
  if (!ready.policy) return { enabled: false as const };
  const notice = r.config.APU_TELEMETRY_NOTICE_TEXT;
  if (typeof notice !== "string" || !notice.trim() || notice.length > 4000) return { enabled: false as const };
  try {
    await eligibleParticipant(identity, ready.policy);
    return { enabled: true as const, noticeVersion: ready.policy.notice, noticeText: notice };
  } catch { return { enabled: false as const }; }
}
