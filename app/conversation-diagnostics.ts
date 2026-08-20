export type Diagnostics = {
  callId: string;
  model: string;
  reasoning?: "low" | "medium";
  knowledgeBaseEnabled?: boolean;
  routingSource?: "manual-override" | "active-analysis" | "active-output" | "phase-1" | "phase-2";
  inputTokens: number;
  cachedInputTokens?: number;
  cacheWriteTokens?: number;
  outputTokens: number;
  reasoningTokens?: number;
  totalTokens: number;
  fileSearchCalls?: number;
  estimatedCostUsd: number | null;
};

export type ConversationSummary = {
  inputTokens: number;
  cachedInputTokens?: number;
  cacheWriteTokens?: number;
  outputTokens: number;
  reasoningTokens?: number;
  totalTokens: number;
  fileSearchCalls?: number;
  estimatedCostUsd: number | null;
  responseCount: number;
};

export function summarizeDiagnostics(items: Array<Diagnostics | undefined>): ConversationSummary {
  const unique = new Map<string, Diagnostics>();
  for (const item of items) {
    if (item?.callId && !unique.has(item.callId)) unique.set(item.callId, item);
  }

  const values = [...unique.values()];
  const allHaveCost = values.every((item) => item.estimatedCostUsd !== null);
  const anyCached = values.some((item) => item.cachedInputTokens !== undefined);
  const anyCacheWrite = values.some((item) => item.cacheWriteTokens !== undefined);
  const anyReasoning = values.some((item) => item.reasoningTokens !== undefined);
  const anyFileSearch = values.some((item) => item.fileSearchCalls !== undefined);
  const sum = (pick: (item: Diagnostics) => number | undefined) =>
    values.reduce((total, item) => total + (pick(item) ?? 0), 0);

  const inputTokens = sum((item) => item.inputTokens);
  const outputTokens = sum((item) => item.outputTokens);

  return {
    inputTokens,
    cachedInputTokens: anyCached ? sum((item) => item.cachedInputTokens) : undefined,
    cacheWriteTokens: anyCacheWrite ? sum((item) => item.cacheWriteTokens) : undefined,
    outputTokens,
    reasoningTokens: anyReasoning ? sum((item) => item.reasoningTokens) : undefined,
    totalTokens: inputTokens + outputTokens,
    fileSearchCalls: anyFileSearch ? sum((item) => item.fileSearchCalls) : undefined,
    estimatedCostUsd: allHaveCost ? sum((item) => item.estimatedCostUsd ?? 0) : null,
    responseCount: values.length,
  };
}
