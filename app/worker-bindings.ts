import type { DevLogStateNamespace } from "./dev-log-state";

let devLogState: DevLogStateNamespace | undefined;

export function configureWorkerBindings(bindings: { DEV_LOG_STATE?: DevLogStateNamespace }) {
  devLogState = bindings.DEV_LOG_STATE;
}

export function getDevLogStateNamespace() {
  return devLogState;
}
