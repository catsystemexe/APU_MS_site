import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const vitePackagePath = require.resolve("vite/package.json");
const { bin } = require(vitePackagePath);
const viteBin = typeof bin === "string" ? bin : bin.vite;
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--runtime-mode")) {
  throw new Error("Usage: node scripts/dev-local.mjs [--runtime-mode DEV|PUBLIC]");
}
const runtimeMode = args[1] ?? process.env.APU_RUNTIME_MODE ?? "DEV";
if (runtimeMode !== "DEV" && runtimeMode !== "PUBLIC") {
  throw new Error("APU_RUNTIME_MODE must be DEV or PUBLIC.");
}

if (!viteBin) {
  throw new Error("Unable to resolve the local Vite executable.");
}

// Invoke Vite with the current Node executable rather than passing npm or a
// platform-specific .bin shim to spawn. In particular, this avoids Windows'
// child_process handling of .cmd files.
const child = spawn(
  process.execPath,
  [resolve(dirname(vitePackagePath), viteBin)],
  {
    env: {
      ...process.env,
      APU_LOCAL_DEV_AUTH: "1",
      APU_RUNTIME_MODE: runtimeMode,
      NODE_ENV: "development",
      WRANGLER_LOG_PATH: ".wrangler/wrangler.log",
    },
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  console.error(`Unable to start the local development server: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});
