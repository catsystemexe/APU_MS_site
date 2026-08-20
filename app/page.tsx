import ApuClient from "./apu-client";
import ApuLogo from "./apu-logo";
import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
  getChatGPTUser,
  isAllowedChatGPTUser,
} from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();

  if (!user) {
    return (
      <main className="access-page">
        <section className="access-card" aria-labelledby="access-title">
          <div className="access-mark" aria-hidden="true"><ApuLogo /></div>
          <h1 id="access-title">APU Site 0.1</h1>
          <p>Tato testovací verze je přístupná pouze pozvaným uživatelům.</p>
          <a className="access-button" href={chatGPTSignInPath("/")}>
            Přihlásit se přes ChatGPT
          </a>
        </section>
      </main>
    );
  }

  if (!isAllowedChatGPTUser(user.email)) {
    return (
      <main className="access-page">
        <section className="access-card" aria-labelledby="access-title">
          <div className="access-mark" aria-hidden="true"><ApuLogo /></div>
          <h1 id="access-title">Účet nemá přístup</h1>
          <p>Přihlášený účet <strong>{user.email}</strong> není mezi pozvanými testery.</p>
          <a className="access-button access-button-secondary" href={chatGPTSignOutPath("/")}>
            Přihlásit jiný účet
          </a>
        </section>
      </main>
    );
  }

  return <ApuClient />;
}
