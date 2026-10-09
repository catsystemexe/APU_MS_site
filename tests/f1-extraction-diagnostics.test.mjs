import assert from "node:assert/strict";
import test from "node:test";
import { formatRunFailure } from "../evals/f1-extraction/lib/diagnostics.ts";

const identity = { caseId: "atomic-uncertainty", profile: "baseline", pipeline: "baseline", repetition: 1 };

test("internal eval diagnostics preserve the actionable Error message", () => {
  const diagnostic = formatRunFailure(identity, new Error("POST-uncovered gold fact m1 has a surviving support group"));
  assert.match(diagnostic, /category=eval_internal; type=Error; message=POST-uncovered gold fact m1 has a surviving support group/);
});

test("internal eval diagnostics redact credential-like text and remain bounded", () => {
  const diagnostic = formatRunFailure(identity, new Error(`support failed Authorization=secret Bearer abc.def sk-projectsecret ${"x".repeat(1_000)}`));
  assert.match(diagnostic, /support failed/);
  assert.match(diagnostic, /redacted/);
  assert.doesNotMatch(diagnostic, /secret|abc\.def|sk-projectsecret/);
  assert.ok(diagnostic.length < 900);
});
