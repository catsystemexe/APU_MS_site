export type ApuRuntimeMode = "DEV" | "PUBLIC";

// Server-owned runtime setting. Missing/invalid values always fail closed.
// PUBLIC previews and releases deliberately share this exact policy.
export function getRuntimeMode(value = process.env.APU_RUNTIME_MODE): ApuRuntimeMode {
  return value === "DEV" ? "DEV" : "PUBLIC";
}
