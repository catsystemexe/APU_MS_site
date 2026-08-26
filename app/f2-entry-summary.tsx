import { ChevronRight, ScanSearch } from "lucide-react";
type F2EntrySummaryProps = {
  onOpenAnalysis: () => void;
  onOpenBuild: () => void;
};

export function F2EntrySummary({ onOpenAnalysis, onOpenBuild }: F2EntrySummaryProps) {
  return <section className="f2-entry-summary" aria-label="Shrnutí Rozboru">
    <button type="button" className="f2-entry-callout" onClick={onOpenAnalysis}>
      <ScanSearch className="f2-entry-callout-icon" aria-hidden="true" />
      <span>Připravil jsem kartu Rozbor z aktuálního Zápisníku.</span>
      <ChevronRight aria-hidden="true" />
    </button>
    <p>V kartě Rozbor máte připravené pracovní situační hypotézy.</p>
    <p className="f2-entry-build-guidance">
      Jednotlivé směry můžete dál rozpracovat v kartě{" "}
      <button type="button" onClick={onOpenBuild}>Build</button>
      <span>Build</span>.
    </p>
  </section>;
}
