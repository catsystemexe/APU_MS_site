import { AsyncLocalStorage } from "node:async_hooks";
import { D1TelemetryStore, type TelemetryDatabase } from "./d1-store.ts";
import type { TelemetryStore } from "./store.ts";
export type TelemetryBindings = { TELEMETRY_DB?: TelemetryDatabase } & Record<string, unknown>;
export type TelemetryResources = { config: Record<string, unknown>; store?: TelemetryStore };
// The ALS instance is shared; each request's resources are separate. No identity/token is stored here.
const resources = new AsyncLocalStorage<TelemetryResources>();
export function runWithTelemetryResources<T>(bindings: TelemetryBindings, fn: () => T): T {
  return resources.run({ config: { ...bindings }, store: bindings.TELEMETRY_DB ? new D1TelemetryStore(bindings.TELEMETRY_DB) : undefined }, fn);
}
export function telemetryResources(): TelemetryResources { return resources.getStore() ?? { config: {} }; }
