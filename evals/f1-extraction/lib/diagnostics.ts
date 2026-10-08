import { EvalProviderCallError } from "./pipeline.ts";

const MAX_DETAIL_LENGTH = 700;

export type RunIdentity = { caseId: string; profile: string; pipeline: string; repetition: number };

export function sanitizeDiagnostic(value: string) {
  return value
    .replace(/authorization\s*[:=]\s*[^;\s]+/gi, "authorization=[redacted]")
    .replace(/bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [redacted]")
    .replace(/\bsk-[A-Za-z0-9_-]+\b/g, "[redacted-key]")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, MAX_DETAIL_LENGTH);
}

export function formatRunFailure(identity: RunIdentity, error: unknown) {
  const context = `case=${identity.caseId}; profile=${identity.profile}; pipeline=${identity.pipeline}; repetition=${identity.repetition}`;
  const detail = error instanceof EvalProviderCallError
    ? sanitizeDiagnostic(error.message)
    : `category=eval_internal; type=${error instanceof Error ? error.name : "UnknownError"}; message=${error instanceof Error ? sanitizeDiagnostic(error.message) : "Evaluation run failed"}`;
  return `${context}; ${detail}`;
}
