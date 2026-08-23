import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  AUTO_MODEL_SELECTION,
  isModelSelection,
  resolveRequestRuntime,
} from "../app/model-routing.ts";

const automatic = (phase) => resolveRequestRuntime({
  manualModelOverride: AUTO_MODEL_SELECTION,
  phase,
});

test("phase 1 uses Luna low without Knowledge Base", () => {
  assert.deepEqual(automatic("intake"), {
    model: "gpt-5.6-luna", reasoning: "low", useKnowledgeBase: false,
    automatic: true, routingSource: "phase-1",
  });
});

test("phase 2 and output phase use Terra low with Knowledge Base", () => {
  for (const phase of ["development", "output"]) {
    assert.deepEqual(automatic(phase), {
      model: "gpt-5.6-terra", reasoning: "low", useKnowledgeBase: true,
      automatic: true, routingSource: "phase-2",
    });
  }
});

test("workspace view state cannot change runtime routing", () => {
  const panelStates = [null, "notepad", "analysis", "output"];
  for (const phase of ["intake", "development", "output"]) {
    const expected = automatic(phase);
    for (const activePanel of panelStates) {
      assert.deepEqual(resolveRequestRuntime({
        manualModelOverride: AUTO_MODEL_SELECTION,
        phase,
        activePanel,
      }), expected);
    }
  }
});

test("manual model override has priority but KB and reasoning still follow context", () => {
  assert.deepEqual(resolveRequestRuntime({
    manualModelOverride: "gpt-5.6-sol", phase: "development",
  }), {
    model: "gpt-5.6-sol", reasoning: "low", useKnowledgeBase: true,
    automatic: false, routingSource: "manual-override",
  });
  assert.deepEqual(resolveRequestRuntime({
    manualModelOverride: "gpt-5.6-sol", phase: "intake",
  }), {
    model: "gpt-5.6-sol", reasoning: "low", useKnowledgeBase: false,
    automatic: false, routingSource: "manual-override",
  });
  assert.equal(isModelSelection("auto"), true);
  assert.equal(isModelSelection("gpt-5.6-terra"), true);
  assert.equal(isModelSelection("unknown"), false);
});

test("workspace toggles are view-only and do not affect the next request payload", async () => {
  const client = await readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8");
  assert.match(client, /function togglePanel\(panel: WorkspacePanelId\) \{\s*setActivePanel/);
  assert.doesNotMatch(client.match(/function togglePanel[\s\S]*?\n  \}/)?.[0] ?? "", /fetch\(/);
  assert.doesNotMatch(client, /activeWorkspacePanel/);
});

test("chat route resolves every request after the Quest Controller and records actual runtime diagnostics", async () => {
  const source = await readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");
    assert.match(source, /executionPhase = controllerResult\.phase/);
  assert.match(source, /resolveRequestRuntime\(\{[\s\S]*?phase: executionPhase/);
  assert.doesNotMatch(source, /activeWorkspacePanel/);
  assert.match(source, /reasoning: \{ effort: execution\.reasoning \}/);
  assert.match(source, /if \(execution\.useKnowledgeBase\)/);
  assert.match(source, /buildDiagnostics\(response, callId, execution\)/);
  assert.match(source, /knowledgeBaseEnabled: runtime\.useKnowledgeBase/);
  assert.doesNotMatch(source, /tools: \[\{ type: "file_search"/);
});
