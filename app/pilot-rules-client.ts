import { PILOT_RULES_EVENT } from "./pilot-rules";

export async function fetchPedagogical(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  if (response.status === 428 || response.headers.get("X-APU-Pilot-Rules") === "unavailable") {
    window.dispatchEvent(new Event(PILOT_RULES_EVENT));
  }
  return response;
}
