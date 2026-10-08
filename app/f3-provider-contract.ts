import { parseF3RenderResult, type F3RenderResult } from "./f3-finalization-model.ts";

const nonEmpty = { type: "string", minLength: 1 } as const;
const strings = { type: "array", items: nonEmpty } as const;
const material = {
  type: "object",
  additionalProperties: false,
  required: ["title", "introduction", "sections", "table", "cards", "usageNote"],
  properties: {
    title: nonEmpty,
    introduction: nonEmpty,
    sections: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["heading", "content"],
        properties: { heading: nonEmpty, content: nonEmpty },
      },
    },
    table: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["columns", "rows"],
          properties: {
            columns: { ...strings, minItems: 1 },
            rows: { type: "array", items: strings },
          },
        },
      ],
    },
    cards: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "content"],
        properties: { title: nonEmpty, content: nonEmpty },
      },
    },
    usageNote: { anyOf: [{ type: "null" }, nonEmpty] },
  },
} as const;
const boundaryIssue = {
  type: "object",
  additionalProperties: false,
  required: ["reason", "affectedArea", "suggestedReturnToF2"],
  properties: {
    reason: nonEmpty,
    affectedArea: nonEmpty,
    suggestedReturnToF2: nonEmpty,
  },
} as const;

// Responses strict structured output requires the root schema to be an object.
// The nullable branches keep the application-level discriminated union intact;
// parseF3ProviderResult enforces that exactly one matching branch is populated.
export const F3_PROVIDER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "material", "boundaryIssue"],
  properties: {
    kind: { type: "string", enum: ["material", "boundary_issue"] },
    material: { anyOf: [{ type: "null" }, material] },
    boundaryIssue: { anyOf: [{ type: "null" }, boundaryIssue] },
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function parseF3ProviderResult(value: unknown): F3RenderResult {
  if (!isRecord(value) || Object.keys(value).length !== 3 || !("material" in value) || !("boundaryIssue" in value)) {
    throw new Error("Model vrátil neplatný kořenový F3 kontrakt.");
  }
  if (value.kind === "material" && isRecord(value.material) && value.boundaryIssue === null) {
    return parseF3RenderResult({ ...value.material, kind: "material" });
  }
  if (value.kind === "boundary_issue" && value.material === null && isRecord(value.boundaryIssue)) {
    return parseF3RenderResult({ ...value.boundaryIssue, kind: "boundary_issue" });
  }
  throw new Error("Model vrátil nekonzistentní variantu F3 výsledku.");
}
