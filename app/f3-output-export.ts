import { f3MaterialToText } from "./f3-working-analysis.ts";
import type { F3Material } from "./f3-finalization-model";

export async function copyF3Output(material: F3Material, clipboard: Pick<Clipboard, "writeText"> | undefined = globalThis.navigator?.clipboard, stale = false) {
  if (!clipboard) throw new Error("Kopírování není v tomto prohlížeči dostupné.");
  await clipboard.writeText(`${stale ? "Starší výstup — zdroj nebo nastavení se změnily.\n\n" : ""}${f3MaterialToText(material)}`);
}

// A temporary DOM clone isolates readable output from every application control.
// The browser owns printing/PDF creation; nothing is uploaded or persisted.
export function printF3Output(output: HTMLElement, browser: Window = window) {
  const document = browser.document;
  if (document.querySelector(".f3-print-document")) return;
  const printable = document.createElement("div");
  printable.className = "f3-print-document";
  printable.appendChild(output.cloneNode(true));
  document.body.appendChild(printable);
  document.body.classList.add("f3-printing");
  const cleanup = () => {
    printable.remove();
    document.body.classList.remove("f3-printing");
    browser.removeEventListener("afterprint", cleanup);
  };
  browser.addEventListener("afterprint", cleanup, { once: true });
  try { browser.print(); } catch (cause) { cleanup(); throw cause; }
}
