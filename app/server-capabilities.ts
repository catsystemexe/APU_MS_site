import type { AccessIdentity } from "./access-auth";
import { isSupportedModel } from "./model-config.ts";

export type ServerIdentity = Pick<AccessIdentity, "role">;

// Callers must use the identity verified by getAccessIdentity, never request data.
export function manualModelOverrideDenied(identity: ServerIdentity, model: unknown) {
  return identity.role !== "developer" && isSupportedModel(model);
}

const DEVELOPER_RESPONSE_FIELDS = new Set([
  "model_usage_records", "diagnostics", "diagnostic", "telemetry", "controllerDiagnostics",
]);

// Only reserved response-envelope fields are filtered. Pedagogical content is
// opaque: never recursively rewrite document/source objects or ordinary text.
export function authorizedModelPayload<T extends Record<string, unknown>>(payload: T, identity?: ServerIdentity | null) {
  if (identity?.role === "developer") return payload;
  return Object.fromEntries(Object.entries(payload).filter(([key]) => !DEVELOPER_RESPONSE_FIELDS.has(key)));
}
