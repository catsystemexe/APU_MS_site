/** Standalone Cloudflare Worker entry point for APU. */
import handler from "vinext/server/app-router-entry";
import { configureWorkerBindings } from "../app/worker-bindings";

type Env = Parameters<typeof handler.fetch>[1] & Parameters<typeof configureWorkerBindings>[0];

const worker = {
  fetch(request: Request, env: Env, context: ExecutionContext) {
    configureWorkerBindings(env);
    return handler.fetch(request, env, context);
  },
};

export default worker;
