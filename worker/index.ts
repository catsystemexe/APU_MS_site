/** Standalone Cloudflare Worker entry point for APU. */
import handler from "vinext/server/app-router-entry";
import { runWithTelemetryResources, type TelemetryBindings } from "../app/telemetry/runtime";
import { configureWorkerBindings } from "../app/worker-bindings";

type Env = Parameters<typeof handler.fetch>[1] & Parameters<typeof configureWorkerBindings>[0] & TelemetryBindings;

const worker = {
  fetch(request: Request, env: Env, context: ExecutionContext) {
    configureWorkerBindings(env);
    return runWithTelemetryResources(env, () => handler.fetch(request, env, context));
  },
};

export default worker;
