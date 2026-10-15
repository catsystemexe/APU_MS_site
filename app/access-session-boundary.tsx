"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { notebookOwnerId, type NotebookOwner } from "./notebook-storage";

export const SESSION_EVENT_KEY = "apu-site:access-session-event:v1";
export const ACCESS_LOGOUT_PATH = "/cdn-cgi/access/logout";
type SessionEvent = { type: "active" | "logout"; owner: string; nonce: string };
type Controls = { onLogout: (hasWork: boolean) => void; registerInvalidation: (callback: (logout?: boolean) => void) => () => void };

export function AccessSessionBoundary({ identity, children }: { identity: NotebookOwner; children: (controls: Controls) => ReactNode }) {
  const [status, setStatus] = useState<"checking" | "active" | "offline" | "ended">("checking");
  const ended = useRef(false);
  const invalidate = useRef<(logout?: boolean) => void>(() => {});
  const notify = useRef<(event: SessionEvent) => void>(() => {});
  const revalidate = useRef<() => void>(() => {});
  const owner = notebookOwnerId(identity);
  const registerInvalidation = useCallback((callback: (logout?: boolean) => void) => {
    invalidate.current = callback;
    return () => { if (invalidate.current === callback) invalidate.current = () => {}; };
  }, []);
  const end = useCallback((logout: boolean) => {
    if (ended.current) return;
    ended.current = true;
    invalidate.current(logout);
    setStatus("ended");
  }, []);

  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    let pending: AbortController | null = null;
    let disposed = false;
    const receive = (event: unknown) => {
      if (!event || typeof event !== "object") return;
      const value = event as Partial<SessionEvent>;
      if (typeof value.owner !== "string" || typeof value.nonce !== "string") return;
      // Notifications can only revoke visibility, never authenticate a client.
      if (value.type === "logout" && value.owner === owner) end(true);
      if (value.type === "active" && value.owner !== owner) end(false);
    };
    try { channel = new BroadcastChannel(SESSION_EVENT_KEY); channel.onmessage = event => receive(event.data); } catch { /* storage event fallback below */ }
    notify.current = event => {
      try { window.localStorage.setItem(SESSION_EVENT_KEY, JSON.stringify(event)); } catch { /* Channel/focus checks remain. */ }
      try { channel?.postMessage(event); } catch { /* storage/focus checks remain. */ }
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key !== SESSION_EVENT_KEY || !event.newValue) return;
      try { receive(JSON.parse(event.newValue)); } catch { /* Ignore malformed notifications. */ }
    };
    const check = async () => {
      if (ended.current || disposed || pending) return;
      invalidate.current();
      setStatus("checking");
      const controller = new AbortController(); pending = controller;
      const timeout = window.setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch("/api/session", { cache: "no-store", credentials: "same-origin", redirect: "error", signal: controller.signal });
        if (disposed || ended.current) return;
        if (response.status === 401 || response.status === 403) { end(true); return; }
        if (!response.ok) throw new Error("Session verification unavailable");
        const value = await response.json() as Partial<NotebookOwner> | null;
        if (disposed || ended.current) return;
        if (typeof value?.email !== "string" || typeof value?.isDeveloper !== "boolean") throw new Error("Invalid session response");
        if (notebookOwnerId({ email: value.email }) !== owner || value.isDeveloper !== identity.isDeveloper) { end(false); return; }
        setStatus("active");
      } catch {
        if (!disposed && !ended.current) setStatus("offline");
      } finally { window.clearTimeout(timeout); if (pending === controller) pending = null; }
    };
    const visibility = () => {
      if (ended.current) return;
      if (document.visibilityState === "hidden") { invalidate.current(); setStatus("checking"); }
      else void check();
    };
    const hide = () => { if (!ended.current) flushSync(() => { invalidate.current(); setStatus("checking"); }); };
    revalidate.current = () => { void check(); };
    window.addEventListener("storage", storageChanged);
    window.addEventListener("focus", revalidate.current);
    window.addEventListener("pageshow", revalidate.current);
    window.addEventListener("pagehide", hide);
    document.addEventListener("visibilitychange", visibility);
    // This initial identity was just verified by the server-rendered page.
    notify.current({ type: "active", owner, nonce: crypto.randomUUID() });
    setStatus("active");
    return () => {
      disposed = true; pending?.abort(); channel?.close();
      window.removeEventListener("storage", storageChanged);
      window.removeEventListener("focus", revalidate.current);
      window.removeEventListener("pageshow", revalidate.current);
      window.removeEventListener("pagehide", hide);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [end, identity.isDeveloper, owner]);

  const onLogout = (hasWork: boolean) => {
    if (hasWork && !window.confirm("Odhlášení smaže rozpracovanou konverzaci, Zápisník a dokumenty v této aplikaci. Neuloženou práci nebude možné obnovit. Opravdu se chcete odhlásit?")) return;
    flushSync(() => end(true));
    notify.current({ type: "logout", owner, nonce: crypto.randomUUID() });
    window.location.assign(ACCESS_LOGOUT_PATH);
  };
  return <>
    {status !== "active" && <main className="access-page"><section className="access-card" aria-labelledby="session-title">
      <h1 id="session-title">{status === "ended" ? "Relace byla ukončena" : "Ověření přihlášení"}</h1>
      <p role="status">{status === "offline" ? "Přihlášení nyní nelze ověřit. Vaše práce zůstává dočasně skrytá; zkuste ověření znovu." : status === "ended" ? "Pro bezpečné pokračování načtěte aplikaci s aktuálním přihlášením." : "Pracovní obsah je během ověřování skrytý."}</p>
      {status === "offline" && <button type="button" onClick={() => revalidate.current()}>Zkusit ověření znovu</button>}
      {status === "ended" && <button type="button" onClick={() => window.location.reload()}>Načíst přihlášenou aplikaci</button>}
      {status === "offline" && <button type="button" onClick={() => onLogout(true)}>Odhlásit se</button>}
    </section></main>}
    <div style={{ display: status === "active" ? "contents" : "none" }} inert={status !== "active"} aria-hidden={status !== "active"}>
      {status !== "ended" && children({ onLogout, registerInvalidation })}
    </div>
  </>;
}
