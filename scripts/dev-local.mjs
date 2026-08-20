import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const vitePackagePath = require.resolve("vite/package.json");
const { bin } = require(vitePackagePath);
const viteBin = typeof bin === "string" ? bin : bin.vite;

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
