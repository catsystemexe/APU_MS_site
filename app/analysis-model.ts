import type { CategoryId } from "./notepad-model";

export type AnalysisQuestionStatus = "active" | "skipped" | "answered";
export type AnalysisQuestion = { id: string; text: string; target: CategoryId; status: AnalysisQuestionStatus };
export type WorkingHypothesis = {
  id: string; rank: number; title: string; summary: string;
  relevantNeeds: string[]; question: AnalysisQuestion | null;
  supportingInformation: string[]; limitations: string[]; unknowns: string[];
  questions: AnalysisQuestion[];
};
export type NeedAnalysis = {
  needId: string; title: string; sourceText: string; relevantHypotheses: string[]; direction: string;
  question: AnalysisQuestion | null;
  distinctions: string[]; parameters: string[]; limitations: string[];
  questions: AnalysisQuestion[]; intendedOutput: string;
};
export type SuggestedNeed = { id: string; title: string; reason: string };
export type HypothesisChange = {
  hypothesisId: string;
  kind: "strengthened" | "weakened" | "merged" | "removed" | "updated";
  description: string;
};
export type AnalysisNextPrompt = { type: "question" | "navigation"; text: string } | null;
export type AnalysisChatUpdate = {
  kind: "entry" | "update";
  summary: string;
  notebookChanges: string[];
  hypothesisChanges: HypothesisChange[];
  remainingUncertainty: string;
  nextPrompt: AnalysisNextPrompt;
};
export type AnalysisState = {
  hypotheses: WorkingHypothesis[]; needs: NeedAnalysis[]; suggestedNeeds: SuggestedNeed[];
  mode: "entry" | "working";
  mainUncertainty: string; chatUpdate: AnalysisChatUpdate; transitionReady: boolean;
};
export type AnalysisSelection = { selectedHypothesisId: string | null; activeNeedId: string | null };
export const EMPTY_ANALYSIS: AnalysisState = {
  hypotheses: [], needs: [], suggestedNeeds: [], mainUncertainty: "",
  mode: "entry",
  chatUpdate: { kind: "entry", summary: "", notebookChanges: [], hypothesisChanges: [], remainingUncertainty: "", nextPrompt: null },
  transitionReady: false,
};

export function cleanAnalysisQuestionText(value: string) {
  return value.trim().replace(/^(?:💬\s*)+/, "");
}

function questionKey(value: string) {
  return cleanAnalysisQuestionText(value).toLocaleLowerCase("cs-CZ").replace(/\s+/g, " ");
}

export function stripLegacyQuestionFromSummary(summary: string, nextPrompt: AnalysisNextPrompt) {
  const promptKey = nextPrompt?.type === "question" ? questionKey(nextPrompt.text) : "";
  if (!promptKey) return summary.trim();
  return summary.split(/\n{2,}/).filter((part) => questionKey(part) !== promptKey).join("\n\n").trim();
}

export function preserveAnalysisSelection(previous: AnalysisSelection, analysis: AnalysisState): AnalysisSelection {
  return {
    selectedHypothesisId: analysis.hypotheses.some((item) => item.id === previous.selectedHypothesisId)
      ? previous.selectedHypothesisId : analysis.hypotheses[0]?.id ?? null,
    activeNeedId: analysis.needs.some((item) => item.needId === previous.activeNeedId)
      ? previous.activeNeedId : analysis.needs[0]?.needId ?? null,
  };
}

function signature(value: unknown) { return Array.isArray(value) ? JSON.stringify(value) : String(value ?? ""); }

export function analysisChangeKeys(previous: AnalysisState, next: AnalysisState) {
  const changed = new Set<string>();
  const previousHypotheses = new Map(previous.hypotheses.map((item) => [item.id, item]));
  for (const item of next.hypotheses) {
    const old = previousHypotheses.get(item.id);
    if (!old || old.title !== item.title || old.summary !== item.summary) changed.add(`hypothesis:${item.id}:header`);
    if (!old || old.question?.text !== item.question?.text || ["relevantNeeds", "supportingInformation", "limitations", "unknowns"].some((key) =>
      signature(old[key as keyof WorkingHypothesis]) !== signature(item[key as keyof WorkingHypothesis]))) changed.add(`hypothesis:${item.id}:detail`);
    const oldQuestions = new Map((old?.questions ?? []).map((question) => [question.id, question]));
    for (const question of item.questions) {
      const oldQuestion = oldQuestions.get(question.id);
      if (!oldQuestion || oldQuestion.text !== question.text || oldQuestion.status !== question.status) changed.add(`question:${question.id}`);
    }
  }
  const previousNeeds = new Map(previous.needs.map((item) => [item.needId, item]));
  for (const item of next.needs) {
    const old = previousNeeds.get(item.needId);
    if (!old || old.title !== item.title) changed.add(`need:${item.needId}:tab`);
    if (!old || old.question?.text !== item.question?.text || ["direction", "relevantHypotheses", "distinctions", "parameters", "limitations", "intendedOutput"].some((key) =>
      signature(old[key as keyof NeedAnalysis]) !== signature(item[key as keyof NeedAnalysis]))) changed.add(`need:${item.needId}:content`);
    const oldQuestions = new Map((old?.questions ?? []).map((question) => [question.id, question]));
    for (const question of item.questions) {
      const oldQuestion = oldQuestions.get(question.id);
      if (!oldQuestion || oldQuestion.text !== question.text || oldQuestion.status !== question.status) changed.add(`question:${question.id}`);
    }
  }
  return changed;
}

export function formatAnalysisChat(analysis: AnalysisState) {
  const update = analysis.chatUpdate;
  const lines: string[] = [];
  if (update.notebookChanges.length) lines.push(`V Zápisníku se doplnilo: ${update.notebookChanges.join("; ")}.`);
  const summary = stripLegacyQuestionFromSummary(update.summary, update.nextPrompt);
  if (summary) lines.push(summary);
  if (update.hypothesisChanges.length) lines.push(update.hypothesisChanges.map((change) => change.description).join(" "));
  const uncertainty = update.remainingUncertainty.trim() || analysis.mainUncertainty.trim();
  if (uncertainty) lines.push(`Nejdůležitější nejistota: ${uncertainty}`);
  return lines.join("\n\n");
}
