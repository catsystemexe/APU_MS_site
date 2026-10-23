import { getAccessIdentity } from "../../../access-auth";
import { telemetryResources } from "../../../telemetry/runtime";
import { handleEvents, readiness, telemetryFailure, telemetryResponse } from "../../../telemetry/server";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const resources = telemetryResources();
  const ready = readiness(request, resources);
  if (!ready.policy) return telemetryResponse({ code: ready.code });
  try { return telemetryResponse(await handleEvents(request, await getAccessIdentity(request.headers), resources)); }
  catch (error) { return telemetryFailure(error); }
}
