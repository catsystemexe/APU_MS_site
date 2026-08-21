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

const ACCESS_JWT_HEADER = "cf-access-jwt-assertion";
const LOCAL_IDENTITY: AccessIdentity = {
  email: "local-development@apu.invalid",
  role: "developer",
};
const jwksCache = new Map<string, { expiresAt: number; keys: JsonWebKey[] }>();

function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function accessConfig(): AccessConfig | null {
  const audience = process.env.CF_ACCESS_AUD?.trim();
  const configuredDomain = process.env.CF_ACCESS_TEAM_DOMAIN?.trim();
  if (!audience || !configuredDomain) return null;

  let issuer: string;
  try {
    const url = new URL(
      configuredDomain.includes("://") ? configuredDomain : `https://${configuredDomain}`,
    );
    if (url.protocol !== "https:" || url.pathname !== "/") return null;
    issuer = url.origin;
  } catch {
    return null;
  }

  const developerEmails = new Set(
    (process.env.APU_DEVELOPER_EMAILS ?? "")
      .split(",")
      .map(normalizeEmail)
      .filter(Boolean),
  );
  return { audience, issuer, developerEmails };
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
  if (!response.ok) throw new Error("Cloudflare Access JWKS is unavailable");
  const body = await response.json() as { keys?: unknown };
  if (!Array.isArray(body.keys)) throw new Error("Cloudflare Access JWKS is invalid");
  const keys = body.keys.filter((key): key is JsonWebKey => Boolean(key && typeof key === "object"));
  jwksCache.set(issuer, { keys, expiresAt: Date.now() + 5 * 60_000 });
  return keys;
}

function validClaims(claims: AccessClaims, config: AccessConfig): claims is AccessClaims & { email: string } {
  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  return Boolean(
    claims.iss === config.issuer &&
    audiences.includes(config.audience) &&
    typeof claims.email === "string" && normalizeEmail(claims.email) &&
    typeof claims.exp === "number" && claims.exp > now &&
    (claims.nbf === undefined || (typeof claims.nbf === "number" && claims.nbf <= now)) &&
    (claims.iat === undefined || (typeof claims.iat === "number" && claims.iat <= now + 60)),
  );
}

async function validateAccessJwt(token: string, config: AccessConfig): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const header = decodeSegment<JwtHeader>(parts[0]);
  const claims = decodeSegment<AccessClaims>(parts[1]);
  if (!header || header.alg !== "RS256" || !header.kid || !claims || !validClaims(claims, config)) return null;

  try {
    const jwk = (await accessJwks(config.issuer)).find(
      (candidate) => (candidate as JsonWebKey & { kid?: string }).kid === header.kid,
    );
    if (!jwk || jwk.kty !== "RSA") return null;
    const key = await crypto.subtle.importKey(
      "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"],
    );
    const signature = Uint8Array.from(
      atob(parts[2].replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(parts[2].length / 4) * 4, "=")),
      (char) => char.charCodeAt(0),
    );
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5", key, signature, new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    return valid ? normalizeEmail(claims.email) : null;
  } catch {
    return null;
  }
}

export async function getAccessIdentity(requestHeaders: Headers): Promise<AccessIdentity | null> {
  if (process.env.NODE_ENV === "development" && process.env.APU_LOCAL_DEV_AUTH === "1") {
    return LOCAL_IDENTITY;
  }
  const config = accessConfig();
  const token = requestHeaders.get(ACCESS_JWT_HEADER);
  if (!config || !token) return null;
  const email = await validateAccessJwt(token, config);
  if (!email) return null;
  return { email, role: config.developerEmails.has(email) ? "developer" : "tester" };
}

export async function getCurrentAccessIdentity(): Promise<AccessIdentity | null> {
  return getAccessIdentity(new Headers(await headers()));
}
