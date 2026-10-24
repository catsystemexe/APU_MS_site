"use client";

import { createContext, useContext, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { PILOT_INFORMATION_VERSION, PILOT_RULES_EVENT, PILOT_RULES_VERSION, parsePilotRulesReceipt, type PilotRulesReceipt } from "./pilot-rules";

const ReceiptContext = createContext<PilotRulesReceipt | null>(null);

export function PilotRulesInformation({ idPrefix = "settings" }: { idPrefix?: string }) {
  const receipt = useContext(ReceiptContext);
  return <section className="pilot-rules-information" aria-labelledby={`${idPrefix}-rules-title`}>
    <h2 id={`${idPrefix}-rules-title`}>Informace a pravidla</h2>
    <p className="pilot-rules-draft"><strong>DRAFT — vývojový návrh.</strong> Texty a provozní podmínky čekají na schválení před rozšířením PUBLIC pilotu.</p>
    <p><strong>Popiš skutečnou situaci, vynech identitu.</strong> APU je určené pro skutečné pedagogické potřeby, pozorované projevy a nezbytný kontext.</p>
    <ul>
      <li>Neuváděj jména, kontakty, přesnou školu, třídu, datum ani kombinaci podrobností, podle které lze někoho poznat. Přezdívka sama nestačí.</li>
      <li>Nevkládej diagnózy — skutečné ani modelové — a nepožaduj jejich odvozování. Nevkládej zdravotnické či poradenské zprávy.</li>
      <li>Popiš svou pedagogickou potřebu, konkrétní pozorované jednání a co už pomohlo nebo nepomohlo. Vynech nepotřebné okolnosti a celé záznamy či komunikaci dalších osob.</li>
    </ul>
    <p>Před odesláním zvaž: <strong>Potřebuje APU tuto podrobnost? Může podle ní někdo dítě poznat?</strong> Pravidla platí také pro Zápisník a diktování.</p>
    <details><summary>Jak se údaje zpracovávají</summary>
      <p>Při AI operacích se zadaný text a potřebný pracovní kontext předávají přes server APU do OpenAI API. Hosting a ochranu přístupu zajišťuje Cloudflare.</p>
      <p>Nový projekt ani odhlášení nejsou výmazem všech kopií u dodavatelů. Kopírování, tisk a stažené soubory vytvářejí další kopie. Diktování nemusí zpracovávat zvuk pouze v zařízení.</p>
      <p>Úplné informace o správci, právních základech, retenčních lhůtách, právech a funkčním kontaktu musí být doplněny a schváleny před PUBLIC nasazením této funkce.</p>
      <p>Při omylem vložených osobních údajích dál případ nerozvíjej. Kontaktuj provozovatele známým kanálem pro pilot; do hlášení nekopíruj znovu celý případ.</p>
    </details>
    <details><summary>Krátký průvodce APU</summary>
      <ol>
        <li><strong>Zápisník:</strong> zachyť a zkontroluj, co skutečně pozoruješ a potřebuješ. Zápisník je podkladem další práce.</li>
        <li><strong>Rozbor:</strong> posuzuj možné interpretace, jejich oporu a nejistoty. Návrh APU není automaticky ověřený fakt.</li>
        <li><strong>Výstup:</strong> připrav pracovní návrh postupu nebo materiálu a před použitím posuď jeho vhodnost.</li>
      </ol>
    </details>
    <p className="pilot-rules-ack-note">Potvrzení pravidel není souhlasem za dítě nebo rodiče ani oprávněním školy předávat osobní údaje.</p>
    {idPrefix === "settings" && <p className="pilot-rules-receipt">{receipt
      ? `Přijatá verze: ${receipt.rulesVersion}. Potvrzeno: ${new Date(receipt.acceptedAt).toLocaleString("cs-CZ")}.`
      : "Potvrzení pravidel zatím není dostupné."}</p>}
  </section>;
}

type Status = "checking" | "required" | "saving" | "verifying" | "accepted" | "unavailable" | "outdated";
export function PilotRulesBoundary({ children, onLogout }: { children: ReactNode; onLogout: () => void }) {
  const [status, setStatus] = useState<Status>("checking");
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PilotRulesReceipt | null>(null);
  const panel = useRef<HTMLElement>(null);
  const generation = useRef({ value: 0 });
  const pending = useRef<AbortController | null>(null);
  const reloadStatus = useRef<() => void>(() => {});

  async function requestStatus(afterSave = false) {
    const current = ++generation.current.value;
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch("/api/pilot-rules", { cache: "no-store", credentials: "same-origin", redirect: "error", signal: controller.signal });
      if (!response.ok) throw new Error("unavailable");
      const data = await response.json() as { rulesVersion?: unknown; informationVersion?: unknown; receipt?: unknown };
      if (generation.current.value !== current) return;
      if (data.rulesVersion !== PILOT_RULES_VERSION || data.informationVersion !== PILOT_INFORMATION_VERSION) { setStatus("outdated"); return; }
      const accepted = parsePilotRulesReceipt(data.receipt);
      if (data.receipt !== null && !accepted) throw new Error("invalid receipt");
      setError(null); setReceipt(accepted); setStatus(accepted ? "accepted" : afterSave ? "verifying" : "required");
    } catch {
      if (generation.current.value === current) { setStatus("unavailable"); setError("Potvrzení pravidel nyní nelze ověřit. Pracovní obsah zůstává uzamčený; zkus ověření znovu."); }
    } finally { window.clearTimeout(timeout); if (pending.current === controller) pending.current = null; }
  }

  useEffect(() => {
    const lifecycle = generation.current;
    reloadStatus.current = () => { setChecked(false); setStatus("checking"); setError(null); void requestStatus(); };
    const recheck = () => reloadStatus.current();
    window.addEventListener(PILOT_RULES_EVENT, recheck);
    const initialCheck = window.setTimeout(() => { void requestStatus(); }, 0);
    return () => { window.clearTimeout(initialCheck); ++lifecycle.value; pending.current?.abort(); window.removeEventListener(PILOT_RULES_EVENT, recheck); };
  }, []);
  useEffect(() => { if (status !== "accepted") panel.current?.focus(); }, [status]);

  async function accept() {
    if (!checked || status !== "required" || pending.current) return;
    const current = ++generation.current.value;
    const controller = new AbortController(); pending.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    setStatus("saving"); setError(null);
    try {
      const response = await fetch("/api/pilot-rules", { method: "POST", credentials: "same-origin", redirect: "error", signal: controller.signal,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accepted: true, rulesVersion: PILOT_RULES_VERSION, informationVersion: PILOT_INFORMATION_VERSION }) });
      const data = await response.json() as { rulesVersion?: unknown; informationVersion?: unknown; receipt?: unknown };
      if (generation.current.value !== current) return;
      if (response.status === 409) { setStatus("outdated"); return; }
      if (!response.ok || !parsePilotRulesReceipt(data.receipt)) throw new Error("save failed");
      // A successful write is not a guarantee of KV propagation to the next AI request.
      await requestStatus(true);
    } catch {
      if (generation.current.value === current) { setStatus("required"); setError("Potvrzení se nepodařilo uložit. Zkus to znovu."); }
    } finally { window.clearTimeout(timeout); if (pending.current === controller) pending.current = null; }
  }

  function containKeyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); return; }
    if (event.key !== "Tab") return;
    const items = [...(panel.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), summary, a[href]") ?? [])];
    const first = items[0], last = items.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
  }
  return <ReceiptContext.Provider value={receipt}>
    {status !== "accepted" && <div className="pilot-rules-overlay">
      <section ref={panel} className="pilot-rules-dialog" role="dialog" aria-modal="true" aria-labelledby="pilot-entry-title" tabIndex={-1} onKeyDown={containKeyboard}>
        <h1 id="pilot-entry-title">Než začneš používat APU</h1>
        <PilotRulesInformation idPrefix="entry" />
        {status === "checking" && <p role="status">Ověřuji přijetí pravidel…</p>}
        {status === "verifying" && <p role="status">Potvrzení bylo uloženo, ale zatím není dostupné při ověření. Chvíli vyčkej a ověř ho znovu.</p>}
        {status === "outdated" && <p role="alert">Pravidla se změnila. Načti aktuální aplikaci a seznam se s nimi znovu.</p>}
        {error && <p className="pilot-rules-error" role="alert">{error}</p>}
        <label className="pilot-rules-checkbox"><input type="checkbox" checked={checked} disabled={status !== "required"} onChange={event => setChecked(event.target.checked)} />
          <span>Seznámil/a jsem se s pravidly a uvedenými informacemi a přijímám pravidla používání APU.</span>
        </label>
        <div className="pilot-rules-actions">
          <button type="button" disabled={!checked || status !== "required"} onClick={() => void accept()}>{status === "saving" ? "Ukládám potvrzení…" : "Pokračovat do APU"}</button>
          {(status === "unavailable" || status === "verifying") && <button type="button" onClick={() => { setStatus("checking"); setError(null); void requestStatus(status === "verifying"); }}>Ověřit znovu</button>}
          {status === "outdated" && <button type="button" onClick={() => window.location.reload()}>Načíst aktuální pravidla</button>}
          <button type="button" onClick={() => { ++generation.current.value; pending.current?.abort(); onLogout(); }}>Odhlásit se</button>
        </div>
      </section>
    </div>}
    <div style={{ display: status === "accepted" ? "contents" : "none" }} inert={status !== "accepted"} aria-hidden={status !== "accepted"}>{children}</div>
  </ReceiptContext.Provider>;
}
