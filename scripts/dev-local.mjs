import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(npmCommand, ["exec", "--", "vite"], {
  env: {
    ...process.env,
    APU_LOCAL_DEV_AUTH: "1",
    NODE_ENV: "development",
    WRANGLER_LOG_PATH: ".wrangler/wrangler.log",
  },
  stdio: "inherit",
});

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
