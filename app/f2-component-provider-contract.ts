import {
  parseGeneratedRozborComponents,
  type GeneratedRozborComponent,
  type RequiredRozborComponent,
} from "./f2-build-model.ts";
import type { F2Path } from "./notepad-model.ts";

const stringArray = { type: "array", items: { type: "string" } } as const;
const nonEmptyString = { type: "string", minLength: 1 } as const;
const nonEmptyStringArray = { type: "array", minItems: 1, items: nonEmptyString } as const;
const strictObject = (required: string[], properties: Record<string, object>) => ({ type: "object", additionalProperties: false, required, properties });
const objectArray = (items: object) => ({ type: "array", minItems: 1, items });
const RESPONSE_FORMAT_PATH_NAMES: Record<F2Path, string> = {
  POCHOPIT: "pochopit",
  POZOROVAT: "pozorovat",
  VYTVOŘIT: "vytvorit",
};

export function rozborComponentResponseFormatName(path: F2Path) {
  return `f2_${RESPONSE_FORMAT_PATH_NAMES[path]}_components`;
}

function componentContentSchema(spec: RequiredRozborComponent, hypothesisIds: string[]) {
  const hypothesisId = { type: "string", enum: hypothesisIds };
  const hypothesisIdsArray = { type: "array", items: hypothesisId };
  const requiredHypothesisIds = { type: "array", minItems: 1, items: hypothesisId };
  if (["hypothesis-expansion", "hypothesis-comparison", "expert-frame"].includes(spec.kind)) return nonEmptyString;
  if (spec.kind === "observation-indicators") return strictObject(["purpose", "indicators", "limitations"], {
    purpose: nonEmptyString,
    indicators: objectArray(strictObject(["indicator", "observableAs", "situation", "supportSignal", "weakeningSignal", "supportsHypothesisIds", "weakensHypothesisIds", "doesNotDiscriminateWhen", "limitations"], {
      indicator: nonEmptyString, observableAs: nonEmptyString, situation: nonEmptyString, supportSignal: nonEmptyString, weakeningSignal: nonEmptyString, supportsHypothesisIds: hypothesisIdsArray, weakensHypothesisIds: hypothesisIdsArray, doesNotDiscriminateWhen: nonEmptyString, limitations: stringArray,
    })),
    limitations: nonEmptyStringArray,
  });
  if (spec.kind === "observation-comparison") return strictObject(["contrasts", "limitations"], {
    contrasts: objectArray(strictObject(["conditionA", "conditionB", "whatToObserve", "supportSignal", "weakeningSignal", "supportsHypothesisIds", "weakensHypothesisIds", "doesNotDiscriminateWhen", "limitations"], {
      conditionA: nonEmptyString, conditionB: nonEmptyString, whatToObserve: nonEmptyString, supportSignal: nonEmptyString, weakeningSignal: nonEmptyString, supportsHypothesisIds: hypothesisIdsArray, weakensHypothesisIds: hypothesisIdsArray, doesNotDiscriminateWhen: nonEmptyString, limitations: stringArray,
    })),
    limitations: nonEmptyStringArray,
  });
  if (spec.kind === "observation-priorities") return strictObject(["priorities", "limitations"], {
    priorities: objectArray(strictObject(["priority", "focus", "reason", "hypothesisIds"], { priority: { type: "integer", minimum: 1 }, focus: nonEmptyString, reason: nonEmptyString, hypothesisIds: requiredHypothesisIds })),
    limitations: nonEmptyStringArray,
  });
  if (spec.kind === "creation-approaches") {
    const approach = strictObject(["title", "description", "hypothesisIds", "limitations"], { title: nonEmptyString, description: nonEmptyString, hypothesisIds: requiredHypothesisIds, limitations: stringArray });
    const workingApproach = strictObject(["title", "rationale", "hypothesisIds", "limitations"], { title: nonEmptyString, rationale: nonEmptyString, hypothesisIds: requiredHypothesisIds, limitations: stringArray });
    return strictObject(["candidateApproaches", "workingApproach"], { candidateApproaches: objectArray(approach), workingApproach });
  }
  if (spec.kind === "creation-objective") return strictObject(["objective", "hypothesisIds", "limitations"], { objective: nonEmptyString, hypothesisIds: requiredHypothesisIds, limitations: stringArray });
  if (spec.kind === "success-conditions") return strictObject(["conditions", "limitations"], { conditions: objectArray(strictObject(["condition", "whyRequired"], { condition: nonEmptyString, whyRequired: nonEmptyString })), limitations: stringArray });
  return strictObject(["checks", "limitations"], {
    checks: objectArray(strictObject(["indicator", "when", "successSignal", "adjustmentSignal", "hypothesisIds"], { indicator: nonEmptyString, when: nonEmptyString, successSignal: nonEmptyString, adjustmentSignal: nonEmptyString, hypothesisIds: requiredHypothesisIds })),
    limitations: stringArray,
  });
}

export function rozborComponentProviderSchema(specs: RequiredRozborComponent[], hypothesisIds: string[]) {
  const componentIds = specs.map(({ id }) => id);
  return {
    type: "object",
    additionalProperties: false,
    required: ["components"],
    properties: {
      components: {
        type: "object",
        additionalProperties: false,
        required: componentIds,
        properties: Object.fromEntries(specs.map((spec) => [spec.id, componentContentSchema(spec, hypothesisIds)])),
      },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function parseProviderRozborComponents(value: unknown, requested: RequiredRozborComponent[]): GeneratedRozborComponent[] {
  const providerComponents = isRecord(value) ? value.components : null;
  if (!isRecord(providerComponents)) throw new Error("Model nevrátil úplnou sadu komponent Rozboru.");
  const componentIds = Object.keys(providerComponents);
  const requestedIds = new Set(requested.map(({ id }) => id));
  if (componentIds.length !== requested.length || componentIds.some((id) => !requestedIds.has(id))) throw new Error("Model nevrátil úplnou sadu komponent Rozboru.");
  const components = requested.map((spec) => ({
    id: spec.id,
    kind: spec.kind,
    ...(spec.hypothesisId ? { hypothesisId: spec.hypothesisId } : {}),
    content: providerComponents[spec.id],
  }));
  return parseGeneratedRozborComponents({ components }, requested);
}
