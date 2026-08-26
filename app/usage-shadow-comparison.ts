import { summarizeDiagnostics, type ConversationSummary, type Diagnostics } from "./conversation-diagnostics.ts";
import type { ModelUsageSession } from "./model-usage-collection.ts";
import type { ModelUsageRecord } from "./usage-ledger.ts";

type TokenDifference = {
  field: "input_tokens" | "cached_input_tokens" | "cache_write_tokens" | "output_tokens" | "reasoning_tokens" | "normalized_total_tokens";
  legacy: number;
  canonical: number;
};

export type UsageShadowObservation = {
  legacy_call_id: string;
  canonical_call_ids: string[];
  missing_canonical_call_ids: string[];
  token_differences: TokenDifference[];
  cost_difference: { legacy: number | null; canonical: number | null } | null;
};

export type UsageShadowComparison = {
  legacy_summary: ConversationSummary;
  canonical_summary: ModelUsageSession["summary"];
  legacy_diagnostic_count: number;
  canonical_only_operations: Array<{ operation: ModelUsageRecord["operation"]; count: number }>;
  observations: UsageShadowObservation[];
  status: "consistent" | "needs_investigation" | "no_legacy_observation";
};

function sum(records: ModelUsageRecord[], pick: (record: ModelUsageRecord) => number | null) {
  return records.reduce((total, record) => total + (pick(record) ?? 0), 0);
}

function completeCost(records: ModelUsageRecord[]) {
  if (records.some((record) => record.pricing_snapshot.estimated_cost_usd === null)) return null;
  return records.reduce((total, record) => total + (record.pricing_snapshot.estimated_cost_usd ?? 0), 0);
}

function tokenDifferences(diagnostic: Diagnostics, records: ModelUsageRecord[]): TokenDifference[] {
  const values: Array<[TokenDifference["field"], number | undefined, number]> = [
    ["input_tokens", diagnostic.inputTokens, sum(records, (record) => record.usage.input_tokens)],
    ["cached_input_tokens", diagnostic.cachedInputTokens, sum(records, (record) => record.usage.cached_input_tokens)],
    ["cache_write_tokens", diagnostic.cacheWriteTokens, sum(records, (record) => record.usage.cache_write_tokens)],
    ["output_tokens", diagnostic.outputTokens, sum(records, (record) => record.usage.output_tokens)],
    ["reasoning_tokens", diagnostic.reasoningTokens, sum(records, (record) => record.usage.reasoning_tokens)],
    ["normalized_total_tokens", diagnostic.totalTokens, sum(records, (record) => record.usage.normalized_total_tokens)],
  ];
  return values.flatMap(([field, legacy, canonical]) => legacy === undefined || legacy === canonical ? [] : [{ field, legacy, canonical }]);
}

function canonicalOnlyOperations(records: ModelUsageRecord[], referencedCallIds: Set<string>) {
  const counts = new Map<ModelUsageRecord["operation"], number>();
  for (const record of records) {
    if (referencedCallIds.has(record.call_id)) continue;
    counts.set(record.operation, (counts.get(record.operation) ?? 0) + 1);
  }
  return [...counts].map(([operation, count]) => ({ operation, count }));
}

// Legacy diagnostics are DEV-only UI observations. They may represent one
// canonical call or a deliberate composite such as extraction + grounding.
// The canonical ledger remains the only source of session totals.
export function compareUsageShadow(
  legacyDiagnostics: Array<Diagnostics | undefined>,
  canonicalSession: ModelUsageSession,
): UsageShadowComparison {
  const diagnostics = legacyDiagnostics.filter((item): item is Diagnostics => Boolean(item));
  const byCallId = new Map(canonicalSession.records.map((record) => [record.call_id, record]));
  const referencedCallIds = new Set<string>();
  const observations = diagnostics.map((diagnostic) => {
    const canonicalCallIds = diagnostic.canonicalCallIds ?? [diagnostic.callId];
    canonicalCallIds.forEach((callId) => referencedCallIds.add(callId));
    const records = canonicalCallIds.flatMap((callId) => {
      const record = byCallId.get(callId);
      return record ? [record] : [];
    });
    const missingCanonicalCallIds = canonicalCallIds.filter((callId) => !byCallId.has(callId));
    const canonicalCost = completeCost(records);
    const costDifference = diagnostic.estimatedCostUsd === canonicalCost
      ? null
      : { legacy: diagnostic.estimatedCostUsd, canonical: canonicalCost };
    return {
      legacy_call_id: diagnostic.callId,
      canonical_call_ids: canonicalCallIds,
      missing_canonical_call_ids: missingCanonicalCallIds,
      token_differences: tokenDifferences(diagnostic, records),
      // A cost delta is evidence, not a failure: legacy uses its historical
      // price table while canonical records carry their pricing snapshot.
      cost_difference: costDifference,
    };
  });
  const hasUnexplainedDifference = observations.some((observation) =>
    observation.missing_canonical_call_ids.length > 0 || observation.token_differences.length > 0,
  );

  return {
    legacy_summary: summarizeDiagnostics(diagnostics),
    canonical_summary: canonicalSession.summary,
    legacy_diagnostic_count: diagnostics.length,
    canonical_only_operations: canonicalOnlyOperations(canonicalSession.records, referencedCallIds),
    observations,
    status: diagnostics.length === 0
      ? "no_legacy_observation"
      : hasUnexplainedDifference ? "needs_investigation" : "consistent",
  };
}
