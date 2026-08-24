export function toggleExpandedHypothesis(expanded: Set<string>, hypothesisId: string) {
  const next = new Set(expanded);
  if (next.has(hypothesisId)) next.delete(hypothesisId);
  else next.add(hypothesisId);
  return next;
}
