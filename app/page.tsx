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

  return <ApuClient isDeveloper={identity.role === "developer"} />;
}
