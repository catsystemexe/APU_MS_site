import type { AccessIdentity } from "./access-auth";
import { PILOT_INFORMATION_VERSION, PILOT_RULES_VERSION, parsePilotRulesReceipt, type PilotRulesReceipt } from "./pilot-rules";
import { getPilotRulesBindings } from "./worker-bindings";

export type PilotRulesNamespace = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options: { expirationTtl: number }): Promise<void>;
};
export function pilotRulesResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
export function pilotRulesUnavailable() {
  const response = pilotRulesResponse({ code: "PILOT_RULES_UNAVAILABLE", error: "Potvrzení pravidel nyní nelze ověřit nebo uložit. Zkus to znovu později." }, 503);
  response.headers.set("X-APU-Pilot-Rules", "unavailable");
  return response;
}
export function pilotRulesConfiguration() {
  const bindings = getPilotRulesBindings();
  const ttl = Number(bindings.ttlSeconds);
  // No retention default. The operator must approve and configure a finite TTL.
  return bindings.namespace && Number.isSafeInteger(ttl) && ttl >= 60 && ttl <= 31_536_000
    ? { namespace: bindings.namespace, ttl } : null;
}
export async function pilotRulesKey(identity: Pick<AccessIdentity, "email">) {
  const email = identity.email.trim().toLocaleLowerCase("en-US");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email));
  const id = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  // This is a pseudonymous lookup key, not anonymization or an authentication token.
  return `pilot-rules:${PILOT_RULES_VERSION}:${id}`;
}
export async function readPilotRulesReceipt(identity: AccessIdentity): Promise<PilotRulesReceipt | null> {
  const config = pilotRulesConfiguration();
  if (!config) throw new Error("rules unavailable");
  const raw = await config.namespace.get(await pilotRulesKey(identity));
  if (raw === null) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  const receipt = parsePilotRulesReceipt(value);
  return receipt && Date.parse(receipt.expiresAt) - Date.parse(receipt.acceptedAt) <= config.ttl * 1000 ? receipt : null;
}
export async function requirePilotRulesAcceptance(identity: AccessIdentity): Promise<Response | null> {
  try {
    if (await readPilotRulesReceipt(identity)) return null;
    return pilotRulesResponse({ code: "PILOT_RULES_REQUIRED", error: "Nejprve se seznam s pravidly používání APU a potvrď jejich přijetí.", rulesVersion: PILOT_RULES_VERSION }, 428);
  } catch { return pilotRulesUnavailable(); }
}
export async function savePilotRulesReceipt(identity: AccessIdentity): Promise<PilotRulesReceipt> {
  const config = pilotRulesConfiguration();
  if (!config) throw new Error("rules unavailable");
  const now = Date.now();
  const receipt = { rulesVersion: PILOT_RULES_VERSION, informationVersion: PILOT_INFORMATION_VERSION,
    acceptedAt: new Date(now).toISOString(), expiresAt: new Date(now + config.ttl * 1000).toISOString() };
  await config.namespace.put(await pilotRulesKey(identity), JSON.stringify(receipt), { expirationTtl: config.ttl });
  // Do not assume KV read-after-write consistency. Each AI request still rechecks KV.
  return receipt;
}
