import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { clampDesktopSplit, DEFAULT_DESKTOP_SPLIT, DESKTOP_WORKSPACE_QUERY, INITIAL_PROCESSING_WORKSPACE, readDesktopSplitPreference, selectDesktopTool } from "../app/desktop-workspace.ts";

test("A/H: fresh 30/70 defaults respect readable minimums and preserve explicit legacy preferences", () => {
  assert.equal(DEFAULT_DESKTOP_SPLIT, 30);
  assert.equal(readDesktopSplitPreference(null), 30);
  assert.equal(readDesktopSplitPreference(""), 30);
  assert.equal(readDesktopSplitPreference("invalid"), 30);
  assert.equal(readDesktopSplitPreference("60"), 60);
  assert.equal(readDesktopSplitPreference("47.5"), 47.5);
  assert.equal(clampDesktopSplit(30, 1440), 30);
  assert.equal(clampDesktopSplit(30, 1024) * 1024 / 100, 420);
  assert.ok(1004 - clampDesktopSplit(99, 1004) * 1004 / 100 >= 300 - 0.001);
  assert.match(DESKTOP_WORKSPACE_QUERY, /orientation: landscape/);
});

test("B–F: independent tool/document navigation preserves the displayed document through Chat", () => {
  let workspace = { ...INITIAL_PROCESSING_WORKSPACE };
  workspace = selectDesktopTool(workspace, "chat");
  assert.deepEqual(workspace, { tool: "chat", document: "analysis" });
  workspace = selectDesktopTool(workspace, "build");
  assert.deepEqual(workspace, INITIAL_PROCESSING_WORKSPACE);
  workspace = selectDesktopTool(workspace, "output");
  assert.deepEqual(workspace, { tool: "output", document: "output" });
  workspace = selectDesktopTool(workspace, "chat");
  assert.deepEqual(workspace, { tool: "chat", document: "output" });
  workspace = selectDesktopTool(workspace, "output");
  assert.equal(workspace.document, "output");
});

test("I/J: one Chat instance, pure UI switching, safe F3 history and shared role-independent composition", async () => {
  const client = await readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8");
  assert.equal((client.match(/messages\.map\(\(message\) => \(/g) ?? []).length, 1);
  const switcher = client.slice(client.indexOf("function selectTool"), client.indexOf("function togglePanel"));
  assert.doesNotMatch(switcher, /fetch|setMessages|setNotepad|setF2Build|setF3State|setCurrentRozbor/);
  assert.match(client, /disabled=\{isChatReadOnly\}/);
  assert.match(client, /\{isChatReadOnly \? <div className="composer chat-read-only"/);
  const sender = client.slice(client.indexOf("async function sendMessage"), client.indexOf("const text = rawText.trim()", client.indexOf("async function sendMessage")));
  assert.match(sender, /if \(isChatReadOnly\).*return;/);
  assert.match(client, /activePanel=\{documentPanel\}/);
  assert.match(client, /f3ControlsTarget=\{isF2DesktopLayout \? f3ControlsTarget : null\}/);
  const nav = client.slice(client.indexOf('className="desktop-tool-tabs"'), client.indexOf('id="desktop-tool-chat"'));
  assert.doesNotMatch(nav, /isDeveloper|POCHOPIT|POZOROVAT|VYTVOŘIT/);
  assert.match(nav, /\['chat', 'Chat'\], \['build', 'Build'\], \['output', 'Výstup'\]/);
  assert.match(nav, /aria-pressed=\{desktopWorkspace.tool === tool\}/);
  assert.match(client, /localStorage.setItem\(DESKTOP_SPLIT_STORAGE_KEY/);
  assert.match(client, /onKeyDown=\{handleSplitKeyDown\}/);
});

test("Build action is an internal footer with unchanged explicit generation guard; divider only resizes", async () => {
  const client = await readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8");
  const footer = client.slice(client.indexOf('<footer className="f2-build-actions"'), client.indexOf('</footer>', client.indexOf('<footer className="f2-build-actions"')));
  assert.match(footer, /className="f2-build-action"/);
  assert.match(footer, /onClick=\{\(\) => void generateCurrentRozbor\(\)\}/);
  assert.match(footer, /rozborGenerationStatus === "loading" \|\| !isCurrentRozborUpdatePending \|\| \(!hasActiveRozborOperation && activeRozbor.components.length === 0\)/);
  assert.match(footer, /VYTVÁŘÍM ROZBOR.*AKTUALIZOVAT ROZBOR.*VYTVOŘIT ROZBOR/);
  assert.match(footer, /f2-generation-error.*role="alert"/);
  assert.doesNotMatch(client, /f2-build-divider-action/);
  const divider = client.slice(client.indexOf('className="workspace-resize-handle"'), client.indexOf('id="diagnostics-drawer"'));
  assert.match(divider, /onPointerDown|onPointerMove|onPointerUp|onKeyDown/);
  assert.doesNotMatch(divider, /generateCurrentRozbor|<button|VYTVOŘIT ROZBOR/);
});

test("desktop panels connect to selected tabs, scroll internally and keep their actions reachable", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /button\[aria-pressed="true"\][^}]*border-bottom-color: var\(--bg-surface\)/);
  assert.match(css, /\.desktop-tool-tabs button:focus-visible/);
  assert.match(css, /\.workspace-build \.f2-build-shell[^}]*grid-template-rows: auto minmax\(0, 1fr\) auto/);
  assert.match(css, /\.workspace-output-tools \.f3-tool-body[^}]*overflow-y: auto/);
  assert.match(css, /\.is-processing-workspace \.message-list[^}]*scrollbar-width: none/);
  const client = await readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8");
  assert.match(client, /onScroll=\{updateChatScrollPosition\} tabIndex=\{0\}/);
  assert.match(client, /!isChatAtBottom && <button[^>]*className="chat-scroll-bottom"/);
  assert.match(client, /onClick=\{scrollChatToBottom\}/);
  assert.match(client, /if \(!list\?\.clientHeight\) return/);
  assert.match(client, /if \(chatAtBottomRef.current\) list.scrollTo/);
});

test("G: F3 portals only controls while the single readable document retains print ownership", async () => {
  const output = await readFile(new URL("../app/f3-finalization.tsx", import.meta.url), "utf8");
  assert.equal((output.match(/<article ref=\{materialRef\}/g) ?? []).length, 1);
  assert.match(output, /createPortal\(controls, controlsTarget\)/);
  const controls = output.slice(output.indexOf("const controls ="), output.indexOf("return <div className={`f3-finalization"));
  assert.match(controls, /onRepresentation/);
  assert.match(controls, /onConfig/);
  assert.match(controls, /printF3Output\(materialRef.current\)/);
  assert.doesNotMatch(controls, /<article|content.sections.map/);
});
