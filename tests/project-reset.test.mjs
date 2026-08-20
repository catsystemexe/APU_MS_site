import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createProjectResetState, shouldResetCurrentProject } from "../app/project-session.ts";

test("cancelling the New Project confirmation preserves the current project", () => {
  let confirmations = 0;
  const allowed = shouldResetCurrentProject(true, () => {
    confirmations += 1;
    return false;
  });
  assert.equal(allowed, false);
  assert.equal(confirmations, 1);
});

test("confirming New Project authorizes one central reset", () => {
  let confirmations = 0;
  assert.equal(shouldResetCurrentProject(true, () => {
    confirmations += 1;
    return true;
  }), true);
  assert.equal(confirmations, 1);
});

test("the project reset clears all project-scoped state and no global preferences", () => {
  const welcome = { id: "welcome", role: "assistant", content: "Start" };
  const reset = createProjectResetState(welcome);
  assert.deepEqual(reset.messages, [welcome]);
  assert.deepEqual(reset.notepad, { manifestations: [], goals: [], context: [], course: [], helps: [] });
  assert.equal(reset.responseId, null);
  assert.equal(reset.phase, "intake");
  assert.equal(reset.activePanel, null);
  assert.equal(reset.error, null);
  assert.equal(reset.failedInput, null);
  assert.equal(reset.composerInput, "");
  assert.equal(reset.isComposerExpanded, false);
  assert.equal(reset.isLoading, false);
  assert.equal(reset.exportStatus, "idle");
  assert.equal(reset.dictationNotice, null);
  assert.equal(reset.hasDictationDraft, false);
  assert.equal("theme" in reset, false);
  assert.equal("communicationProfile" in reset, false);
  assert.equal("selectedModel" in reset, false);
});

test("New Project uses the central handler once, preserves global preferences, and can start a fresh request", async () => {
  const source = await readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8");
  const requestHandler = source.match(/function requestNewProject\(\)[\s\S]*?\n  \}/)?.[0] ?? "";
  const resetHandler = source.match(/function resetCurrentProject\(\)[\s\S]*?\n  \}/)?.[0] ?? "";
  assert.equal((requestHandler.match(/resetCurrentProject\(\)/g) ?? []).length, 1);
  assert.doesNotMatch(source, /setIsExportMenuOpen|setDriveFileLink|resetConversation/);
  assert.match(resetHandler, /setResponseId\(reset\.responseId\)/);
  assert.match(resetHandler, /setActivePanel\(reset\.activePanel\)/);
  assert.match(resetHandler, /setNotepad\(reset\.notepad\)/);
  assert.doesNotMatch(resetHandler, /setCommunicationProfile|design\.|setSelectedModel/);
  assert.match(source, /previousResponseId: responseId/);
  assert.match(source, /if \(!text \|\| isLoading \|\| !isNotepadHydrated\) return/);
});
