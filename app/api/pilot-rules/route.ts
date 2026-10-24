import { getAccessIdentity } from "../../access-auth";
import { PILOT_INFORMATION_VERSION, PILOT_RULES_VERSION } from "../../pilot-rules";
import { pilotRulesResponse, pilotRulesUnavailable, readPilotRulesReceipt, savePilotRulesReceipt } from "../../pilot-rules-server";

export const runtime = "edge";
export async function GET(request: Request) {
  const identity = await getAccessIdentity(request.headers);
  if (!identity) return pilotRulesResponse({ error: "Chybí platná identita Cloudflare Access." }, 401);
  try {
    const receipt = await readPilotRulesReceipt(identity);
    return pilotRulesResponse({ rulesVersion: PILOT_RULES_VERSION, informationVersion: PILOT_INFORMATION_VERSION, receipt });
  } catch { return pilotRulesUnavailable(); }
}
export async function POST(request: Request) {
  const identity = await getAccessIdentity(request.headers);
  if (!identity) return pilotRulesResponse({ error: "Chybí platná identita Cloudflare Access." }, 401);
  if (request.headers.get("origin") !== new URL(request.url).origin) return pilotRulesResponse({ error: "Potvrzení odešli přímo z APU." }, 403);
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return pilotRulesResponse({ error: "Neplatný formát potvrzení." }, 400);
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 2048) return pilotRulesResponse({ error: "Neplatný formát potvrzení." }, 400);
    body = JSON.parse(raw);
  } catch { return pilotRulesResponse({ error: "Neplatný formát potvrzení." }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return pilotRulesResponse({ error: "Neplatné potvrzení." }, 400);
  const value = body as Record<string, unknown>;
  if (Object.keys(value).some(key => !["accepted", "rulesVersion", "informationVersion"].includes(key)) || value.accepted !== true) return pilotRulesResponse({ error: "Potvrď přijetí pravidel." }, 400);
  if (value.rulesVersion !== PILOT_RULES_VERSION || value.informationVersion !== PILOT_INFORMATION_VERSION) return pilotRulesResponse({ code: "PILOT_RULES_VERSION_CHANGED", error: "Pravidla se změnila. Načti aktuální aplikaci a seznam se s nimi znovu." }, 409);
  try {
    return pilotRulesResponse({ rulesVersion: PILOT_RULES_VERSION, informationVersion: PILOT_INFORMATION_VERSION, receipt: await savePilotRulesReceipt(identity) });
  } catch { return pilotRulesUnavailable(); }
}
