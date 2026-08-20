import { ChevronRight } from "lucide-react";
import type { WorkingHypothesis } from "./analysis-model";

export type F2EntryHypothesis = Pick<WorkingHypothesis, "id" | "rank" | "title" | "summary">;

type F2EntrySummaryProps = {
  hypotheses: F2EntryHypothesis[];
  onOpenAnalysis: () => void;
};

export function F2EntrySummary({ hypotheses, onOpenAnalysis }: F2EntrySummaryProps) {
  return <section className="f2-entry-summary" aria-label="Shrnutí Rozboru">
    <button type="button" className="f2-entry-callout" onClick={onOpenAnalysis}>
      <span>Připravil jsem kartu Rozbor z aktuálního Zápisníku.</span>
      <ChevronRight aria-hidden="true" />
    </button>
    {hypotheses.length > 0 && <section className="f2-entry-hypotheses" aria-label="Možné směry k ověření">
      <h3>Možné směry k ověření</h3>
      <ol>
        {hypotheses.map((hypothesis) => <li key={hypothesis.id} value={hypothesis.rank}>
          <strong>{hypothesis.title}</strong>
          <span>{hypothesis.summary}</span>
        </li>)}
      </ol>
    </section>}
  </section>;
}
