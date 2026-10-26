// Development draft. A version change is a deliberate operator/legal decision.
export const PILOT_RULES_VERSION = "pilot-rules-2026-10-26-draft-2";
export const PILOT_INFORMATION_VERSION = "pilot-information-2026-10-26-draft-2";
// Approved future pilot policy, never a runtime default. Current hosted DEV
// test TTL (86400) is unchanged; deployment/retention approval is separate.
export const PILOT_RULES_APPROVED_TTL_SECONDS = 7_776_000;
export const PILOT_RULES_EVENT = "apu:pilot-rules-required";
export type PilotRulesReceipt = {
  rulesVersion: string;
  informationVersion: string;
  acceptedAt: string;
  expiresAt: string;
};
export function parsePilotRulesReceipt(value: unknown, now = Date.now()): PilotRulesReceipt | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<PilotRulesReceipt>;
  if (item.rulesVersion !== PILOT_RULES_VERSION || typeof item.informationVersion !== "string" || !item.informationVersion || item.informationVersion.length > 120 ||
    typeof item.acceptedAt !== "string" || typeof item.expiresAt !== "string") return null;
  const accepted = Date.parse(item.acceptedAt), expires = Date.parse(item.expiresAt);
  if (!Number.isFinite(accepted) || !Number.isFinite(expires) || accepted > now || expires <= now || expires <= accepted) return null;
  return { rulesVersion: item.rulesVersion, informationVersion: item.informationVersion, acceptedAt: item.acceptedAt, expiresAt: item.expiresAt };
}
