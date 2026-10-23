// Linux-only diagnostic: enforce Windows' no-open-SQLite-file deletion precondition.
// Use with `node --import ./tests/helpers/telemetry-cleanup-lock-check.mjs --test ...`.
import fs from "node:fs";
import { basename, resolve, sep } from "node:path";
import { syncBuiltinESMExports } from "node:module";

if (process.platform !== "linux") throw Error("Linux procfs diagnostic only; run native tests directly on Windows");
const remove = fs.rmSync;
fs.rmSync = function(path, options) {
  const directory = resolve(String(path));
  if (basename(directory).startsWith("apu-telemetry-b3-")) {
    for (const descriptor of fs.readdirSync("/proc/self/fd")) {
      let target;
      try { target = fs.readlinkSync(`/proc/self/fd/${descriptor}`); }
      catch (error) { if (error.code === "ENOENT") continue; throw error; }
      if (target.startsWith(directory + sep) && /\.sqlite(?:-wal|-shm)?$/.test(target)) {
        throw Error("SQLite connection still open before temp directory removal (Linux diagnostic, not native Windows verification)");
      }
    }
  }
  return remove(path, options);
};
syncBuiltinESMExports();
