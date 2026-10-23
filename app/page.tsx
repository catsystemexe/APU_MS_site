import { headers } from "next/headers";
import { telemetryResources } from "./telemetry/runtime";
import { pilotAvailability } from "./telemetry/server";
import ApuClient from "./apu-client";
import ApuLogo from "./apu-logo";
import { getCurrentAccessIdentity } from "./access-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const identity = await getCurrentAccessIdentity();

  if (!identity) {
    return (
      <main className="access-page">
        <section className="access-card" aria-labelledby="access-title">
          <div className="access-mark" aria-hidden="true"><ApuLogo /></div>
          <h1 id="access-title">APU Site 0.1</h1>
          <p>Ověřená identita Cloudflare Access není dostupná.</p>
        </section>
      </main>
    );
  }

  let pilot: Awaited<ReturnType<typeof pilotAvailability>> = { enabled: false };
  const resources = telemetryResources();
  if (resources.config.APU_TELEMETRY_ENABLED === "1") {
    try {
      const host = (await headers()).get("host");
      if (host) pilot = await pilotAvailability(new Request(`https://${host}/`), identity, resources);
    } catch { /* Telemetry readiness never prevents rendering the app. */ }
  }
  return <ApuClient email={identity.email} isDeveloper={identity.role === "developer"} pilot={pilot} />;
}
