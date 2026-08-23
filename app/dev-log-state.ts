import { canTransitionDevLogStatus, DEV_LOG_STATUSES, parseDevLogStateOverride, type DevLogStateOverride, type DevLogStatus, type SharedFeedbackItem } from "./shared-feedback.ts";
import type { AccessIdentity } from "./access-auth";

export const DEV_LOG_STATE_VERSION = 1 as const;
export const DEV_LOG_STATE_KEY_PREFIX = "devlog:";
export const DEV_LOG_NOTE_MAX_LENGTH = 2000;

export type DevLogStateNamespace = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
};

type DeveloperIdentity = { email: string };

function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function persistenceError() {
  return response({ error: "DEV LOG persistence není dostupná." }, 503);
}

export function authorizeDevLogIdentity(identity: AccessIdentity | null): AccessIdentity | Response {
  if (!identity) return response({ error: "Chybí platná identita Cloudflare Access." }, 401);
  if (identity.role !== "developer") return response({ error: "DEV LOG je dostupný pouze developerům." }, 403);
  return identity;
}

export async function readDevLogOverrides(namespace: DevLogStateNamespace, sourceItems: SharedFeedbackItem[]) {
  const entries = await Promise.all(sourceItems.map(async ({ id }) => {
    try {
      const raw = await namespace.get(`${DEV_LOG_STATE_KEY_PREFIX}${id}`);
      if (raw === null) return null;
      const parsed = parseDevLogStateOverride(JSON.parse(raw));
      return parsed ? [id, parsed] as const : null;
    } catch (error) {
      if (error instanceof SyntaxError) return null;
      throw error;
    }
  }));
  return Object.fromEntries(entries.filter((entry): entry is readonly [string, DevLogStateOverride] => entry !== null));
}

export async function getDevLogState(namespace: DevLogStateNamespace | undefined, sourceItems: SharedFeedbackItem[]) {
  if (!namespace) return persistenceError();
  try {
    return response({ version: DEV_LOG_STATE_VERSION, items: await readDevLogOverrides(namespace, sourceItems) });
  } catch {
    return response({ error: "DEV LOG state se nepodařilo načíst." }, 500);
  }
}

export async function patchDevLogState(request: Request, identity: DeveloperIdentity, namespace: DevLogStateNamespace | undefined, sourceItems: SharedFeedbackItem[]) {
  if (!namespace) return persistenceError();
  let body: unknown;
  try { body = await request.json(); } catch { return response({ error: "Neplatný JSON request." }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => key !== "id" && key !== "status" && key !== "note")) return response({ error: "Neplatný request." }, 400);
  const { id, status, note } = body as { id?: unknown; status?: unknown; note?: unknown };
  const hasStatus = Object.prototype.hasOwnProperty.call(body, "status");
  const hasNote = Object.prototype.hasOwnProperty.call(body, "note");
  if (typeof id !== "string" || (!hasStatus && !hasNote)) return response({ error: "Request neobsahuje žádnou změnu." }, 400);
  if (hasStatus && (typeof status !== "string" || !DEV_LOG_STATUSES.includes(status as DevLogStatus))) return response({ error: "Neplatné ID nebo status." }, 400);
  if (hasNote && typeof note !== "string") return response({ error: "Neplatná poznámka." }, 400);
  const normalizedNote = typeof note === "string" ? note.trim() : undefined;
  if (normalizedNote && normalizedNote.length > DEV_LOG_NOTE_MAX_LENGTH) return response({ error: `Poznámka může mít maximálně ${DEV_LOG_NOTE_MAX_LENGTH} znaků.` }, 400);
  const sourceItem = sourceItems.find((item) => item.id === id);
  if (!sourceItem) return response({ error: "DEV LOG položka neexistuje." }, 404);

  const key = `${DEV_LOG_STATE_KEY_PREFIX}${id}`;
  try {
    const raw = await namespace.get(key);
    let currentOverride: DevLogStateOverride | null = null;
    if (raw !== null) {
      try { currentOverride = parseDevLogStateOverride(JSON.parse(raw)); } catch { currentOverride = null; }
    }
    const currentStatus = currentOverride?.status ?? sourceItem.status;
    if (hasStatus && !canTransitionDevLogStatus(currentStatus, status as DevLogStatus)) return response({ error: "Nepovolený přechod statusu." }, 409);
    const stored: DevLogStateOverride = {
      status: hasStatus ? status as DevLogStatus : currentStatus as DevLogStatus,
      note: hasNote ? normalizedNote ?? "" : currentOverride?.note ?? sourceItem.note,
      updatedAt: new Date().toISOString(), updatedBy: identity.email,
    };
    await namespace.put(key, JSON.stringify(stored));
    return response(stored);
  } catch {
    return response({ error: "DEV LOG state se nepodařilo uložit." }, 500);
  }
}
