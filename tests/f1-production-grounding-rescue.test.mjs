import assert from "node:assert/strict";
import test from "node:test";
import {
  GROUNDING_RESCUE_INSTRUCTIONS,
  GROUNDING_RESCUE_REASON_CATEGORIES,
  GROUNDING_RESCUE_SCHEMA,
  PRODUCTION_GROUNDING_RESCUE_MODEL,
  PRODUCTION_GROUNDING_RESCUE_REASONING,
  applyMonotonicGroundingRescue,
  validateGroundingRescueVerdicts,
} from "../app/f1-extraction-contract.ts";

const accept = (index, reasonCategory = "accept_shared_subject") => ({
  index, accepted: true, reasonCategory, reason: "explicit grammatical relation",
});
const reject = (index, reasonCategory = "reject_modifier_only") => ({
  index, accepted: false, reasonCategory, reason: "unsupported transformation",
});

test("all primary-accepted candidates bypass rescue", async () => {
  let rescueCalls = 0;
  const result = await applyMonotonicGroundingRescue(
    ["first", "second"],
    [{ index: 0, accepted: true, reason: null }, { index: 1, accepted: true, reason: null }],
    async () => { rescueCalls += 1; throw new Error("rescue must not run"); },
  );
  assert.equal(rescueCalls, 0);
  assert.deepEqual([...result.acceptedIndexes], [0, 1]);
  assert.equal(result.rescueAttempted, false);
});

test("rescue receives only explicit primary rejections and maps local indexes monotonically", async () => {
  const candidates = ["primary survivor", "rescue reject", "missing verdict", "rescue accept"];
  let submitted;
  const result = await applyMonotonicGroundingRescue(
    candidates,
    [
      { index: 0, accepted: true, reason: null },
      { index: 1, accepted: false, reason: "too narrow" },
      { index: 3, accepted: false, reason: "too narrow" },
    ],
    async (rescueCandidates) => {
      submitted = rescueCandidates;
      return { verdicts: [reject(0), accept(1, "accept_shared_context")] };
    },
  );
  assert.deepEqual(submitted, ["rescue reject", "rescue accept"]);
  assert.equal(submitted.includes("primary survivor"), false);
  assert.equal(submitted.includes("missing verdict"), false);
  assert.deepEqual([...result.primaryAcceptedIndexes], [0]);
  assert.deepEqual(result.rescueCandidateOriginalIndexes, [1, 3]);
  assert.deepEqual([...result.acceptedIndexes].sort(), [0, 3]);
  assert.equal(result.rescueSucceeded, true);
});

test("an invalid rescue result is discarded atomically", async (t) => {
  const malformedResults = {
    incomplete: { verdicts: [accept(0)] },
    duplicate: { verdicts: [accept(0), reject(0)] },
    "out-of-range": { verdicts: [accept(0), reject(2)] },
    "category-mismatch": { verdicts: [accept(0), { ...reject(1), accepted: true }] },
  };
  for (const [name, rescueResult] of Object.entries(malformedResults)) {
    await t.test(name, async () => {
      const result = await applyMonotonicGroundingRescue(
        ["primary survivor", "rejected one", "rejected two"],
        [{ index: 0, accepted: true }, { index: 1, accepted: false }, { index: 2, accepted: false }],
        async () => rescueResult,
      );
      assert.deepEqual([...result.acceptedIndexes], [0]);
      assert.equal(result.rescueAttempted, true);
      assert.equal(result.rescueSucceeded, false);
    });
  }
});

test("rescue provider failure preserves the complete primary result", async () => {
  const result = await applyMonotonicGroundingRescue(
    ["accepted", "rejected"],
    [{ index: 0, accepted: true }, { index: 1, accepted: false }],
    async () => { throw new Error("provider unavailable"); },
  );
  assert.deepEqual([...result.acceptedIndexes], [0]);
  assert.equal(result.rescueAttempted, true);
  assert.equal(result.rescueSucceeded, false);
});

test("failed primary and missing primary verdicts are never converted into rescue eligibility", async (t) => {
  for (const [name, primary, expected] of [
    ["failed primary", null, []],
    ["invalid primary", { verdicts: [] }, []],
    ["missing verdict", [{ index: 0, accepted: true }], [0]],
  ]) {
    await t.test(name, async () => {
      let rescueCalls = 0;
      const result = await applyMonotonicGroundingRescue(["first", "second"], primary, async () => {
        rescueCalls += 1;
        return { verdicts: [] };
      });
      assert.equal(rescueCalls, 0);
      assert.deepEqual([...result.acceptedIndexes], expected);
    });
  }
});

test("a contradictory primary acceptance wins and can never enter rescue", async () => {
  let submitted;
  const result = await applyMonotonicGroundingRescue(
    ["accepted despite duplicate", "rejected"],
    [
      { index: 0, accepted: false },
      { index: 0, accepted: true },
      { index: 1, accepted: false },
    ],
    async (rescueCandidates) => {
      submitted = rescueCandidates;
      return { verdicts: [reject(0)] };
    },
  );
  assert.deepEqual(submitted, ["rejected"]);
  assert.deepEqual([...result.acceptedIndexes], [0]);
});

test("the canonical allowed relation classes can add candidates and audited hard rejects cannot", async (t) => {
  for (const reasonCategory of [
    "accept_shared_subject",
    "accept_shared_context",
    "accept_shared_predicate",
    "accept_coreference",
    "accept_relational_coordination",
    "accept_context_completion",
  ]) {
    await t.test(reasonCategory, async () => {
      const result = await applyMonotonicGroundingRescue(
        [reasonCategory],
        [{ index: 0, accepted: false }],
        async () => ({ verdicts: [accept(0, reasonCategory)] }),
      );
      assert.deepEqual([...result.acceptedIndexes], [0]);
    });
  }
  for (const reasonCategory of [
    "reject_modifier_only",
    "reject_inferred_relation",
    "reject_unsupported_helps",
    "reject_semantic_strengthening",
  ]) {
    await t.test(reasonCategory, async () => {
      const result = await applyMonotonicGroundingRescue(
        [reasonCategory],
        [{ index: 0, accepted: false }],
        async () => ({ verdicts: [reject(0, reasonCategory)] }),
      );
      assert.deepEqual([...result.acceptedIndexes], []);
    });
  }
});

test("canonical rescue contract retains the audited narrow semantic boundary", () => {
  assert.equal(PRODUCTION_GROUNDING_RESCUE_MODEL, "gpt-5.6-luna");
  assert.equal(PRODUCTION_GROUNDING_RESCUE_REASONING, "low");
  assert.deepEqual(GROUNDING_RESCUE_SCHEMA.properties.verdicts.items.properties.reasonCategory.enum, GROUNDING_RESCUE_REASON_CATEGORIES);
  assert.match(GROUNDING_RESCUE_INSTRUCTIONS, /SHARED SUBJECT/);
  assert.match(GROUNDING_RESCUE_INSTRUCTIONS, /SHARED PREPOSED CONTEXT/);
  assert.match(GROUNDING_RESCUE_INSTRUCTIONS, /SHARED GOVERNING PREDICATE/);
  assert.match(GROUNDING_RESCUE_INSTRUCTIONS, /UNAMBIGUOUS COREFERENCE/);
  assert.match(GROUNDING_RESCUE_INSTRUCTIONS, /EXPLICIT RELATIONAL COORDINATION/);
  assert.match(GROUNDING_RESCUE_INSTRUCTIONS, /EXPLICIT CONTEXT COMPLETION/);
  assert.match(GROUNDING_RESCUE_INSTRUCTIONS, /TVRDÝ ZÁKAZ MODIFIER-ONLY/);
  assert.match(GROUNDING_RESCUE_INSTRUCTIONS, /kvalifikátor jindy se nesmí změnit na někdy/);
  assert.match(GROUNDING_RESCUE_INSTRUCTIONS, /Po dokončení úkolu požádá o další/);
  assert.match(GROUNDING_RESCUE_INSTRUCTIONS, /helps bez explicitní podmínky nebo změny a jejího pozorovaného účinku/);
  assert.doesNotThrow(() => validateGroundingRescueVerdicts({ verdicts: [
    accept(0),
    reject(1, "reject_inferred_relation"),
    reject(2, "reject_unsupported_helps"),
    reject(3, "reject_semantic_strengthening"),
  ] }, 4));
});
