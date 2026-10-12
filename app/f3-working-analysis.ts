import { isF2ToF3Snapshot, type F2ToF3Snapshot, type ObservationComparisonContent, type ObservationIndicatorsContent, type ObservationPrioritiesContent, type CreationApproachesContent, type CreationObjectiveContent, type SuccessConditionsContent, type FollowUpVerificationContent } from "./f2-build-model.ts";
import type { F3Material } from "./f3-finalization-model";

const list = (items: string[]) => items.map((item) => `• ${item}`).join("\n");
const block = (label: string, items: string[]) => items.length ? `${label}:\n${list(items)}` : "";
const join = (items: Array<string | null | undefined>) => items.filter(Boolean).join("\n\n");

// Presentation of accepted content only. No inference, new analysis, or model call.
export function renderWorkingAnalysis(snapshot: F2ToF3Snapshot): F3Material {
  if (!isF2ToF3Snapshot(snapshot)) throw new Error("Neplatný zdroj pracovní analýzy.");
  const context = snapshot.analysisContext;
  const titles = new Map(snapshot.baselineHypotheses.map((h) => [h.id, h.title]));
  const related = (ids: string[]) => ids.map((id) => titles.get(id) ?? "Pracovní hypotéza").join(", ");
  const sections: F3Material["sections"] = [];
  const add = (heading: string, content: string) => { if (content.trim()) sections.push({ heading, content }); };
  add("Pedagogická potřeba", snapshot.canonicalNeed.needText);
  if (context) {
    add("Shrnutí Rozboru", context.summary);
    const categories = { manifestations: "Projevy", goals: "Pedagogické potřeby", context: "Kontext", course: "Průběh", helps: "Co pomáhá" };
    add("Výchozí informace ze Zápisníku", context.notebookContext.map((item) => `${categories[item.category]}: ${item.text}`).join("\n"));
    const need = context.needAnalysis;
    if (need) add("Zacílení pracovní analýzy", join([need.direction, block("Rozlišení", need.distinctions), block("Parametry", need.parameters), block("Omezení", need.limitations), block("Otázky ke zpřesnění", [...(need.question ? [need.question.text] : []), ...need.questions.map((q) => q.text)]), need.intendedOutput ? `Zamýšlený výstup (záměr): ${need.intendedOutput}` : null]));
  }
  for (const hypothesis of snapshot.baselineHypotheses) {
    add(`Pracovní hypotéza ${hypothesis.rank}: ${hypothesis.title}`, join([hypothesis.summary, block("Podpůrné informace", hypothesis.supportingInformation), block("Omezení", hypothesis.limitations), block("Neznámé", hypothesis.unknowns), block("Otázky ke zpřesnění", [...new Set([...(hypothesis.question ? [hypothesis.question.text] : []), ...hypothesis.questions.map((q) => q.text)])])]));
  }
  for (const component of snapshot.currentRozbor.components) {
    const labels = { "hypothesis-expansion": `Rozvinutí hypotézy: ${titles.get(component.hypothesisId ?? "") ?? "Pracovní hypotéza"}`, "hypothesis-comparison": "Porovnání a souvislosti", "expert-frame": "Odborný rámec", "observation-comparison": "Kontrasty podmínek", "observation-indicators": "Pozorovatelné indikátory", "observation-priorities": "Priority pozorování", "creation-approaches": "Pracovní přístup", "creation-objective": "Pedagogický cíl", "success-conditions": "Podmínky úspěchu", "follow-up-verification": "Následné ověřování" };
    if (typeof component.content === "string") { add(labels[component.kind], component.content); continue; }
    let content = "";
    switch (component.kind) {
      case "observation-comparison": {
        const value = component.content as ObservationComparisonContent;
        content = join([...value.contrasts.map((c) => join([`${c.conditionA} × ${c.conditionB}`, `Sledovat: ${c.whatToObserve}`, `Podpůrný signál: ${c.supportSignal}`, `Oslabující signál: ${c.weakeningSignal}`, c.supportsHypothesisIds.length ? `Podporuje: ${related(c.supportsHypothesisIds)}` : null, c.weakensHypothesisIds.length ? `Oslabuje: ${related(c.weakensHypothesisIds)}` : null, `Nerozliší, pokud: ${c.doesNotDiscriminateWhen}`, block("Omezení", c.limitations)])), block("Omezení", value.limitations)]); break;
      }
      case "observation-indicators": {
        const value = component.content as ObservationIndicatorsContent;
        content = join([value.purpose, ...value.indicators.map((i) => join([i.indicator, `Přímo pozorovat: ${i.observableAs}`, `Situace: ${i.situation}`, `Podpůrný signál: ${i.supportSignal}`, `Oslabující signál: ${i.weakeningSignal}`, i.supportsHypothesisIds.length ? `Podporuje: ${related(i.supportsHypothesisIds)}` : null, i.weakensHypothesisIds.length ? `Oslabuje: ${related(i.weakensHypothesisIds)}` : null, `Nerozliší, pokud: ${i.doesNotDiscriminateWhen}`, block("Omezení", i.limitations)])), block("Omezení", value.limitations)]); break;
      }
      case "observation-priorities": {
        const value = component.content as ObservationPrioritiesContent;
        content = join([...value.priorities.map((p) => `${p.priority}. ${p.focus}\n${p.reason}\nVazba na hypotézy: ${related(p.hypothesisIds)}`), block("Omezení", value.limitations)]); break;
      }
      case "creation-approaches": {
        const value = component.content as CreationApproachesContent;
        content = join([`Pracovní přístup: ${value.workingApproach.title}\n${value.workingApproach.rationale}\nVazba na hypotézy: ${related(value.workingApproach.hypothesisIds)}`, block("Omezení přístupu", value.workingApproach.limitations), ...value.candidateApproaches.map((a) => join([a.title, a.description, `Vazba na hypotézy: ${related(a.hypothesisIds)}`, block("Omezení", a.limitations)]))]); break;
      }
      case "creation-objective": {
        const value = component.content as CreationObjectiveContent;
        content = join([value.objective, `Vazba na hypotézy: ${related(value.hypothesisIds)}`, block("Omezení", value.limitations)]); break;
      }
      case "success-conditions": {
        const value = component.content as SuccessConditionsContent;
        content = join([...value.conditions.map((c) => `${c.condition}\n${c.whyRequired}`), block("Omezení", value.limitations)]); break;
      }
      case "follow-up-verification": {
        const value = component.content as FollowUpVerificationContent;
        content = join([...value.checks.map((c) => `${c.indicator}\nKdy: ${c.when}\nSignál úspěchu: ${c.successSignal}\nSignál k úpravě: ${c.adjustmentSignal}\nVazba na hypotézy: ${related(c.hypothesisIds)}`), block("Omezení", value.limitations)]); break;
      }
    }
    add(labels[component.kind], content);
  }
  add("Nejistota a omezení", list(snapshot.limitations));
  return { kind: "material", title: "Pracovní pedagogická analýza", introduction: "Pracovní hypotézy a jejich omezení podle přijatého Rozboru. Tento podklad sám o sobě není hotovou intervencí ani pozorovací specifikací.", sections, table: null, cards: [], usageNote: `Zdroj: přijatý Rozbor, revize ${snapshot.sourceRevision}. Hypotézy zůstávají pracovní; zachovejte uvedenou nejistotu.` };
}

export function f3MaterialToText(material: F3Material) {
  return join([material.title, material.introduction, ...material.sections.map((s) => `${s.heading}\n${s.content}`), material.table ? [material.table.columns.join("\t"), ...material.table.rows.map((row) => row.join("\t"))].join("\n") : null, ...material.cards.map((card) => `${card.title}\n${card.content}`), material.usageNote]);
}
