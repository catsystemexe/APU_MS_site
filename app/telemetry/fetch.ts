import type { PilotOperation } from "./pilot.ts";
/** Synchronous delegation in off/ready mode; only a renewing context may add a bounded wait. */
export function fetchWithPilot(operation: PilotOperation, input: RequestInfo | URL, init: RequestInit, fetcher: typeof fetch = fetch) {
  let supplied: ReturnType<PilotOperation["headers"]>;
  try { supplied = operation.headers(); } catch { return fetcher(input, init); }
  const invoke = (headers: Record<string, string>) => Object.keys(headers).length
    ? fetcher(input, { ...init, headers: { ...init.headers, ...headers } }) : fetcher(input, init);
  return supplied instanceof Promise ? supplied.then(invoke, () => fetcher(input, init)) : invoke(supplied);
}
