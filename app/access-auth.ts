import { headers } from "next/headers";

export type AccessRole = "developer" | "tester";
export type AccessIdentity = { email: string; role: AccessRole };

type AccessClaims = {
  aud?: string | string[];
  email?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  nbf?: number;
};

type JwtHeader = { alg?: string; kid?: string; typ?: string };
type AccessConfig = { audience: string; issuer: string; developerEmails: Set<string> };
type AccessFailureReason =
  | "missing_config"
  | "missing_access_header"
  | "malformed_token"
  | "invalid_header"
  | "issuer_mismatch"
  | "audience_mismatch"
  | "missing_email"
  | "token_expired"
  | "token_not_yet_valid"
  | "invalid_iat"
  | "jwks_unavailable"
  | "jwk_not_found"
  | "signature_invalid"
  | "validation_error";
type ValidationResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      reason: AccessFailureReason;
      expectedIssuerHost?: string;
      actualIssuerHost?: string;
    };

const ACCESS_JWT_HEADER = "cf-access-jwt-assertion";
const LOCAL_IDENTITY: AccessIdentity = {
  email: "local-development@apu.invalid",
  role: "developer",
};
const jwksCache = new Map<string, { expiresAt: number; keys: JsonWebKey[] }>();

function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function accessConfig(): ValidationResult<AccessConfig> & { missing?: string[] } {
  const audience = process.env.CF_ACCESS_AUD?.trim();
  const configuredDomain = process.env.CF_ACCESS_TEAM_DOMAIN?.trim();
  const missing = [
    ...(!audience ? ["CF_ACCESS_AUD"] : []),
    ...(!configuredDomain ? ["CF_ACCESS_TEAM_DOMAIN"] : []),
  ];
  if (missing.length > 0) return { ok: false, reason: "missing_config", missing };

  try {
    const url = new URL(
      configuredDomain!.includes("://") ? configuredDomain! : `https://${configuredDomain}`,
    );
    if (url.protocol !== "https:" || url.pathname !== "/") {
      return { ok: false, reason: "validation_error" };
    }
    const developerEmails = new Set(
      (process.env.APU_DEVELOPER_EMAILS ?? "")
        .split(",")
        .map(normalizeEmail)
        .filter(Boolean),
    );
    return { ok: true, value: { audience: audience!, issuer: url.origin, developerEmails } };
  } catch {
    return { ok: false, reason: "validation_error" };
  }
}

function decodeSegment<T>(value: string): T | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)))) as T;
  } catch {
    return null;
  }
}

async function accessJwks(issuer: string): Promise<JsonWebKey[]> {
  const cached = jwksCache.get(issuer);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;
  const response = await fetch(`${issuer}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error("unavailable");
  const body = await response.json() as { keys?: unknown };
  if (!Array.isArray(body.keys)) throw new Error("unavailable");
  const keys = body.keys.filter((key): key is JsonWebKey => Boolean(key && typeof key === "object"));
  jwksCache.set(issuer, { keys, expiresAt: Date.now() + 5 * 60_000 });
  return keys;
}

function validateClaims(claims: AccessClaims, config: AccessConfig): ValidationResult<string> {
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== config.issuer) {
    return {
      ok: false,
      reason: "issuer_mismatch",
      expectedIssuerHost: issuerHostname(config.issuer),
      actualIssuerHost: issuerHostname(claims.iss),
    };
  }
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(config.audience)) return { ok: false, reason: "audience_mismatch" };
  if (typeof claims.email !== "string" || !normalizeEmail(claims.email)) {
    return { ok: false, reason: "missing_email" };
  }
  if (typeof claims.exp !== "number" || claims.exp <= now) return { ok: false, reason: "token_expired" };
  if (claims.nbf !== undefined && (typeof claims.nbf !== "number" || claims.nbf > now)) {
    return { ok: false, reason: "token_not_yet_valid" };
  }
  if (claims.iat !== undefined && (typeof claims.iat !== "number" || claims.iat > now + 60)) {
    return { ok: false, reason: "invalid_iat" };
  }
  return { ok: true, value: normalizeEmail(claims.email) };
}

function issuerHostname(issuer: unknown): string {
  if (typeof issuer !== "string") return "invalid";
  try {
    return new URL(issuer).hostname || "invalid";
  } catch {
    return "invalid";
  }
}

async function validateAccessJwt(token: string, config: AccessConfig): Promise<ValidationResult<string>> {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) return { ok: false, reason: "malformed_token" };
  const header = decodeSegment<JwtHeader>(parts[0]);
  const claims = decodeSegment<AccessClaims>(parts[1]);
  if (!header || !claims) return { ok: false, reason: "malformed_token" };
  if (header.alg !== "RS256" || typeof header.kid !== "string" || !header.kid) {
    return { ok: false, reason: "invalid_header" };
  }
  const claimsResult = validateClaims(claims, config);
  if (!claimsResult.ok) return claimsResult;

  let keys: JsonWebKey[];
  try {
    keys = await accessJwks(config.issuer);
  } catch {
    return { ok: false, reason: "jwks_unavailable" };
  }
  const jwk = keys.find((candidate) => (candidate as JsonWebKey & { kid?: string }).kid === header.kid);
  if (!jwk || jwk.kty !== "RSA") return { ok: false, reason: "jwk_not_found" };

  try {
    const key = await crypto.subtle.importKey(
      "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"],
    );
    const encodedSignature = parts[2].replace(/-/g, "+").replace(/_/g, "/");
    const signature = Uint8Array.from(
      atob(encodedSignature.padEnd(Math.ceil(encodedSignature.length / 4) * 4, "=")),
      (char) => char.charCodeAt(0),
    );
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5", key, signature, new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    return valid ? claimsResult : { ok: false, reason: "signature_invalid" };
  } catch {
    return { ok: false, reason: "signature_invalid" };
  }
}

function logAccessFailure(
  reason: AccessFailureReason,
  options: { missing?: string[]; expectedIssuerHost?: string; actualIssuerHost?: string } = {},
): void {
  let suffix = reason === "missing_config" && options.missing?.length
    ? ` missing=${options.missing.join(",")}`
    : "";
  if (reason === "issuer_mismatch") {
    suffix = ` expected_issuer_host=${options.expectedIssuerHost ?? "invalid"}`
      + ` actual_issuer_host=${options.actualIssuerHost ?? "invalid"}`;
  }
  console.warn(`[access-auth] validation_failed reason=${reason}${suffix}`);
}

export async function getAccessIdentity(requestHeaders: Headers): Promise<AccessIdentity | null> {
  if (process.env.NODE_ENV === "development" && process.env.APU_LOCAL_DEV_AUTH === "1") {
    return LOCAL_IDENTITY;
  }
  const configResult = accessConfig();
  if (!configResult.ok) {
    logAccessFailure(configResult.reason, { missing: configResult.missing });
    return null;
  }
  const token = requestHeaders.get(ACCESS_JWT_HEADER);
  if (!token) {
    logAccessFailure("missing_access_header");
    return null;
  }
  const result = await validateAccessJwt(token, configResult.value);
  if (!result.ok) {
    logAccessFailure(result.reason, result);
    return null;
  }
  return {
    email: result.value,
    role: configResult.value.developerEmails.has(result.value) ? "developer" : "tester",
  };
}

export async function getCurrentAccessIdentity(): Promise<AccessIdentity | null> {
  return getAccessIdentity(new Headers(await headers()));
}
