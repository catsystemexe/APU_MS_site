import { getAccessIdentity } from "../../access-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let unavailable = false;
  const identity = await getAccessIdentity(request.headers, () => { unavailable = true; });
  return Response.json(identity ? { email: identity.email, isDeveloper: identity.role === "developer" } : { error: unavailable ? "Přihlášení nyní nelze ověřit." : "Přihlášení není platné." }, {
    status: identity ? 200 : unavailable ? 503 : 401,
    headers: { "Cache-Control": "no-store, private", "Vary": "Cookie, Cf-Access-Jwt-Assertion" },
  });
}
