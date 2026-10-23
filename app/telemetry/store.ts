import { check, integer, keys, oneOf, uuid, LIMITS, MEASUREMENT_VERSION, type StoredEvent } from "./contract.ts";
import type { AiCall } from "./model-usage-adapter.ts";
export type Session = {
  session_id: string; tab_id: string; participant_id: string; cohort_id: string; key_version: string;
  test_class: "tester" | "developer" | "synthetic"; notice_version: string; measurement_version: "pilot-v1";
  opened_at: number; last_interaction_at: number; expires_at: number; stopped_at: number | null;
};
export type Owner = Pick<Session, "session_id" | "participant_id" | "cohort_id" | "key_version" | "tab_id">;
export interface TelemetryStore {
  createSession(session: Session): Promise<void>;
  getSession(id: string): Promise<Session | null>;
  stopSession(owner: Owner, now: number): Promise<void>;
  ingest(owner: Owner, events: StoredEvent[], now: number): Promise<string[]>;
  touchRequest(owner: Owner, now: number): Promise<void>;
  upsertAi(call: AiCall): Promise<void>;
}
export function ownerOf(session: Session): Owner {
  const { session_id, participant_id, cohort_id, key_version, tab_id } = session;
  return { session_id, participant_id, cohort_id, key_version, tab_id };
}

/** Server-owned session_opened v1 record; represented once in telemetry_sessions. */
export function validateNewSession(value: unknown): asserts value is Session {
  keys(value, ["session_id", "tab_id", "participant_id", "cohort_id", "key_version", "test_class", "notice_version", "measurement_version",
    "opened_at", "last_interaction_at", "expires_at", "stopped_at"]);
  check(uuid(value.session_id) && uuid(value.tab_id) && typeof value.participant_id === "string" && /^[A-Za-z0-9_-]{43}$/.test(value.participant_id));
  check([value.cohort_id, value.key_version, value.notice_version].every(v => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v)));
  check(value.measurement_version === MEASUREMENT_VERSION && oneOf(value.test_class, ["tester", "developer", "synthetic"]) &&
    integer(value.opened_at) && integer(value.expires_at) && value.expires_at > value.opened_at && value.expires_at <= value.opened_at + LIMITS.lifetimeMs &&
    value.last_interaction_at === value.opened_at && value.stopped_at === null);
}
