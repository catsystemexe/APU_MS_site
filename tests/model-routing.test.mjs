import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  AUTO_MODEL_SELECTION,
  isModelSelection,
  resolveRequestRuntime,
} from "../app/model-routing.ts";

const automatic = (phase, activePanel = null) => resolveRequestRuntime({
  manualModelOverride: AUTO_MODEL_SELECTION,
  activePanel,
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

test("Analysis forces Terra low with Knowledge Base in every phase", () => {
  for (const phase of ["intake", "development", "output"]) {
    assert.deepEqual(automatic(phase, "analysis"), {
      model: "gpt-5.6-terra", reasoning: "low", useKnowledgeBase: true,
      automatic: true, routingSource: "active-analysis",
    });
  }
});

test("Output workspace forces Terra low with Knowledge Base in every phase", () => {
  for (const phase of ["intake", "development", "output"]) {
    assert.deepEqual(automatic(phase, "output"), {
      model: "gpt-5.6-terra", reasoning: "low", useKnowledgeBase: true,
      automatic: true, routingSource: "active-output",
    });
  }
});

test("Notepad has no routing exception and closing a panel restores phase routing", () => {
  assert.equal(automatic("intake", "notepad").routingSource, "phase-1");
  assert.equal(automatic("intake", "analysis").routingSource, "active-analysis");
  assert.equal(automatic("intake", null).routingSource, "phase-1");
});

test("manual model override has priority but KB and reasoning still follow context", () => {
  assert.deepEqual(resolveRequestRuntime({
    manualModelOverride: "gpt-5.6-sol", activePanel: "analysis", phase: "intake",
  }), {
    model: "gpt-5.6-sol", reasoning: "low", useKnowledgeBase: true,
    automatic: false, routingSource: "manual-override",
  });
  assert.deepEqual(resolveRequestRuntime({
    manualModelOverride: "gpt-5.6-sol", activePanel: null, phase: "intake",
  }), {
    model: "gpt-5.6-sol", reasoning: "low", useKnowledgeBase: false,
    automatic: false, routingSource: "manual-override",
  });
  assert.equal(isModelSelection("auto"), true);
  assert.equal(isModelSelection("gpt-5.6-terra"), true);
  assert.equal(isModelSelection("unknown"), false);
});

test("workspace toggles never call the API and affect the next request payload", async () => {
  const client = await readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8");
  assert.match(client, /function togglePanel\(panel: WorkspacePanelId\) \{\s*setActivePanel/);
  assert.doesNotMatch(client.match(/function togglePanel[\s\S]*?\n  \}/)?.[0] ?? "", /fetch\(/);
  assert.match(client, /activeWorkspacePanel: activePanel/);
});

test("chat route resolves every request after the Quest Controller and records actual runtime diagnostics", async () => {
  const source = await readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");
    assert.match(source, /executionPhase = controllerResult\.phase/);
  assert.match(source, /resolveRequestRuntime\(\{[\s\S]*?activePanel: activeWorkspacePanel \?\? null/);
  assert.match(source, /reasoning: \{ effort: execution\.reasoning \}/);
  assert.match(source, /if \(execution\.useKnowledgeBase\)/);
  assert.match(source, /buildDiagnostics\(response, callId, execution\)/);
  assert.match(source, /knowledgeBaseEnabled: runtime\.useKnowledgeBase/);
  assert.doesNotMatch(source, /tools: \[\{ type: "file_search"/);
});
