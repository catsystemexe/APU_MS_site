"use client";
import { useEffect, useRef, useState } from "react";
import { createPilot, type PilotAvailability } from "./pilot.ts";
export function usePilot(availability: PilotAvailability = { enabled: false }) {
  const [pilot] = useState(() => createPilot({ enabled: availability.enabled, eligible: availability.enabled,
    noticeVersion: availability.enabled ? availability.noticeVersion : undefined }));
  const revision = useRef(0);
  const [status, setStatus] = useState<"available" | "active" | "declined" | "unavailable">("available");
  useEffect(() => {
    if (status !== "active" || !availability.enabled) return;
    const view = () => pilot.view(document.visibilityState === "visible", document.hasFocus());
    const interaction = () => pilot.interaction();
    const hide = () => { pilot.view(false, false); void pilot.flush(true); };
    view();
    for (const name of ["pointerdown", "keydown", "touchstart", "scroll"]) window.addEventListener(name, interaction, { passive: true });
    window.addEventListener("focus", view); window.addEventListener("blur", view); window.addEventListener("pagehide", hide);
    document.addEventListener("visibilitychange", view);
    const timer = setInterval(() => { pilot.tick(); void pilot.flush(); }, 15000);
    return () => {
      clearInterval(timer);
      for (const name of ["pointerdown", "keydown", "touchstart", "scroll"]) window.removeEventListener(name, interaction);
      window.removeEventListener("focus", view); window.removeEventListener("blur", view); window.removeEventListener("pagehide", hide);
      document.removeEventListener("visibilitychange", view);
    };
  }, [availability.enabled, pilot, status]);
  useEffect(() => () => pilot.uncertain(), [pilot]);
  return {
    pilot,
    uncertain() { revision.current++; pilot.uncertain(); setStatus("available"); },
    consent: availability.enabled ? <section aria-label="Dobrovolné pilotní měření">
      {status === "active" ? <button type="button" onClick={() => { revision.current++; void pilot.stop(); setStatus("declined"); }}>Zastavit měření</button> :
        status === "declined" ? <button type="button" onClick={() => setStatus("available")}>Možnosti měření</button> : <>
          <p>{availability.noticeText}</p>
          {status === "unavailable" && <p role="status">Měření se nepodařilo zapnout. Aplikaci můžete dál používat.</p>}
          <button type="button" onClick={() => { const current = ++revision.current; void pilot.optIn().then(ok => { if (revision.current === current) setStatus(ok ? "active" : "unavailable"); }); }}>Zapojit měření pro tuto návštěvu</button>
          <button type="button" onClick={() => { revision.current++; void pilot.stop(); setStatus("declined"); }}>Pokračovat bez měření</button>
        </>}
    </section> : null,
  };
}
