import type { ExpectedRelation } from "./eval-contract.ts";

function sorted(ids: string[]) {
  return [...ids].sort((left, right) => left.localeCompare(right));
}

function compareSides(left: string[], right: string[]) {
  return JSON.stringify(left).localeCompare(JSON.stringify(right));
}

export function canonicalRelationShape(relation: ExpectedRelation): Omit<ExpectedRelation, "id" | "source"> {
  let sourceFactIds = sorted(relation.sourceFactIds);
  let targetFactIds = sorted(relation.targetFactIds);
  if (relation.type === "contrast_with" && compareSides(sourceFactIds, targetFactIds) > 0) {
    [sourceFactIds, targetFactIds] = [targetFactIds, sourceFactIds];
  }
  return {
    type: relation.type,
    sourceFactIds,
    targetFactIds,
    projectionFactIds: sorted(relation.projectionFactIds),
  };
}

export function relationSignature(relation: ExpectedRelation) {
  const canonical = canonicalRelationShape(relation);
  return JSON.stringify([canonical.type, canonical.sourceFactIds, canonical.targetFactIds, canonical.projectionFactIds]);
}

function compareEvidence(left: ExpectedRelation["source"], right: ExpectedRelation["source"]) {
  return left.inputIndex - right.inputIndex || right.quote.length - left.quote.length || left.quote.localeCompare(right.quote);
}

export function canonicalizeRelations(relations: ExpectedRelation[]) {
  const rawIds = new Set<string>();
  const grouped = new Map<string, ExpectedRelation[]>();
  for (const relation of relations) {
    if (rawIds.has(relation.id)) throw new Error(`Duplicate proposed relation id: ${relation.id}`);
    rawIds.add(relation.id);
    const signature = relationSignature(relation);
    grouped.set(signature, [...(grouped.get(signature) ?? []), relation]);
  }
  const signatures = [...grouped.keys()].sort((left, right) => left.localeCompare(right));
  const signatureToId = new Map<string, string>();
  const canonical = signatures.map((signature, index): ExpectedRelation => {
    const candidates = grouped.get(signature)!;
    const shape = canonicalRelationShape(candidates[0]);
    const id = `rel_${String(index + 1).padStart(2, "0")}_${shape.type}`;
    signatureToId.set(signature, id);
    return { id, ...shape, source: [...candidates].map((item) => item.source).sort(compareEvidence)[0] };
  });
  return { relations: canonical, signatureToId, deduplicatedCount: relations.length - canonical.length };
}
