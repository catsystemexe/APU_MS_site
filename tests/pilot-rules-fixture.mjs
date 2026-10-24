import { fileURLToPath } from "node:url";

// Existing provider/role tests start with the new rules precondition fulfilled.
// Dedicated pilot-rules tests exercise the actual store, account and gate failures.
export const acceptedPilotRulesBindingsPlugin = {
  name: "synthetic-accepted-rules-store",
  setup(plugin) {
    plugin.onResolve({ filter: /worker-bindings(?:\.ts)?$/ }, () => ({ path: "accepted-rules", namespace: "rules-fixture" }));
    plugin.onLoad({ filter: /.*/, namespace: "rules-fixture" }, () => ({ loader: "js", resolveDir: fileURLToPath(new URL("..", import.meta.url)), contents: `
      import { PILOT_RULES_VERSION, PILOT_INFORMATION_VERSION } from ${JSON.stringify(fileURLToPath(new URL("../app/pilot-rules.ts", import.meta.url)))};
      export function getPilotRulesBindings() { return { ttlSeconds: '3600', namespace: {
        async get() { return JSON.stringify({rulesVersion:PILOT_RULES_VERSION,informationVersion:PILOT_INFORMATION_VERSION,acceptedAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()}); },
        async put() { throw Error('No rules writes in existing provider fixtures'); }
      }}; }
    ` }));
  },
};
