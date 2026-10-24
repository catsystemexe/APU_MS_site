import type { PilotRulesNamespace } from "./pilot-rules-server";
import type { DevLogStateNamespace } from "./dev-log-state";

let pilotRules: { namespace?: PilotRulesNamespace; ttlSeconds?: string } = {};

let devLogState: DevLogStateNamespace | undefined;

export function configureWorkerBindings(bindings: { DEV_LOG_STATE?: DevLogStateNamespace; PILOT_RULES_ACCEPTANCE?: PilotRulesNamespace; PILOT_RULES_RECEIPT_TTL_SECONDS?: string }) {
  devLogState = bindings.DEV_LOG_STATE;
  pilotRules = { namespace: bindings.PILOT_RULES_ACCEPTANCE, ttlSeconds: bindings.PILOT_RULES_RECEIPT_TTL_SECONDS };
}

export function getDevLogStateNamespace() {
  return devLogState;
}

export function getPilotRulesBindings() { return pilotRules; }
