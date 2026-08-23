import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [component, categories, page, styles] = await Promise.all([
  readFile(new URL("../app/notepad.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/notepad-categories.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);

test("notepad uses local persistence and floating Lucide tool buttons", () => {
  assert.match(component, /localStorage\.getItem\(NOTEPAD_STORAGE_KEY\)/);
  assert.match(component, /localStorage\.setItem\(NOTEPAD_STORAGE_KEY, JSON\.stringify\(entries\)\)/);
  assert.match(component, /NotebookPen/);
  assert.match(page, /className="tool-rail"/);
  assert.match(page, /\bSettings\b/);
  assert.match(page, /tool-rail-diagnostics/);
  assert.match(page, /tool-rail-\$\{id\}/);
  assert.match(component, /className="analysis-need-tabs" role="tablist"/);
  assert.doesNotMatch(component, /workspace-tabs/);
  assert.doesNotMatch(component, /workspace-tab/);
  assert.match(component, /ScanSearch/);
  assert.match(component, /FileText/);
  assert.match(component, /type WorkspacePanel = "notepad" \| "analysis" \| "output" \| null/);
  assert.match(component, /function AnalysisPanel/);
  assert.match(component, /function OutputPanel/);
  assert.match(component, /Zde bude možné připravit výsledný výstup/);
  assert.doesNotMatch(page, /activeWorkspacePanel/);
  assert.doesNotMatch(page, /composer-workspace-indicator/);
  assert.match(page, /function togglePanel\(panel: WorkspacePanelId\)/);
  assert.match(page, /onClick=\{\(\) => togglePanel\(id\)\}/);
  assert.match(component, /Přejít ke zdrojové větě v chatu/);
  assert.match(categories, /Pozorovaný projev/);
  assert.match(categories, /Pedagogická potřeba/);
  assert.match(categories, /Intenzita \/ trend/);
  assert.match(categories, /Zkušenosti/);
  assert.match(component, /function PanelHeader/);
  assert.match(component, /Obsahuje potvrzené informace o situaci a je hlavním zdrojem pro další práci APU/);
  assert.match(component, /Zobrazuje možné interpretace, hypotézy, jejich oporu a nejistoty odvozené z informací v Zápisníku/);
  assert.match(component, /Slouží k vytvoření výsledného strukturovaného dokumentu z aktuálního rozboru situace/);
  assert.match(component, /aria-expanded=\{isDescriptionVisible\}/);
  assert.match(component, /closeOutside/);
  assert.match(component, /workspace-panel-description/);
  assert.doesNotMatch(component, /category-help-button/);
  assert.match(categories, /Nezapisují se sem nevyzkoušené návrhy APU/);
  assert.match(styles, /\.notepad-help-toggle/);
  assert.match(styles, /\.notepad-help-toggle\.is-active/);
  assert.match(styles, /\.notepad-help-toggle::before/);
  assert.match(styles, /touch-action:\s*manipulation/);
  assert.match(styles, /\.panel-description[\s\S]*position:\s*absolute/);
  assert.match(styles, /\.panel-description[\s\S]*width:\s*min\(300px, calc\(100vw - 82px\)\)/);
  assert.match(styles, /\.category-help/);
  assert.match(styles, /\.category-heading/);
  assert.match(styles, /\.category-help[\s\S]*position:\s*absolute/);
  assert.match(styles, /\.category-help[\s\S]*background:\s*var\(--bg-surface\)/);
  assert.match(styles, /\.category-help::before/);
  assert.match(page, /source-highlight/);
  assert.match(page, /<span[\s\S]*className="source-highlight"/);
  assert.match(page, /message\.role !== "assistant"/);
  assert.doesNotMatch(page, /cache write \{formatInteger\(message\.diagnostics\.cacheWriteTokens\)\}/);
  assert.doesNotMatch(page, /reasoning \{formatInteger\(message\.diagnostics\.reasoningTokens\)\}/);
  assert.doesNotMatch(page, /onClick=\{\(\) => onNavigate\(range\.entryIds\[0\]\)\}/);
  assert.match(page, /hasUnreadNotepadChange/);
  assert.match(page, /notepad-update-badge/);
  assert.match(styles, /\.notepad-update-badge/);
  assert.doesNotMatch(component, /Potvrdit nový nebo změněný zápis/);
  assert.match(component, /visibility === "unseen"/);
  assert.match(component, /IntersectionObserver/);
  assert.match(page, /\/api\/extract/);
  assert.match(page, /excludeSourceMessageId: sourceMessageId/);
  assert.match(page, /const INPUT_PLACEHOLDER = "Napište APU…"/);
  assert.doesNotMatch(page, /Doplňte Zápisník|Upřesněte Rozbor|Upravte Výstup|Popište situaci/);
  assert.match(page, /placeholder=\{INPUT_PLACEHOLDER\}/);
  assert.match(page, /\{!isComposerExpanded && <span>\{INPUT_PLACEHOLDER\}<\/span>\}/);
  assert.doesNotMatch(page, /Aktivní kontext:/);
  assert.doesNotMatch(page, /Aktivní vrstva:/);
  assert.doesNotMatch(styles, /\.composer-workspace-indicator/);
  assert.match(styles, /\.composer textarea::placeholder[\s\S]*white-space:\s*nowrap/);
  assert.match(styles, /\.composer-entry-trigger span[\s\S]*text-overflow:\s*ellipsis/);
});

test("responsive layout has 60\/40 split and content-only overlay", () => {
  assert.match(styles, /grid-template-columns:\s*minmax\(0, 3fr\) minmax\(300px, 2fr\)/);
  assert.match(styles, /min-width:\s*768px\) and \(orientation:\s*landscape\)/);
  assert.match(styles, /\.tool-rail[\s\S]*grid-row:\s*2/);
  assert.match(styles, /\.tool-rail[\s\S]*justify-self:\s*end/);
  assert.match(styles, /\.tool-rail[\s\S]*width:\s*0/);
  assert.match(styles, /\.tool-rail-button[\s\S]*position:\s*absolute/);
  assert.match(styles, /\.notepad-panel[\s\S]*grid-row:\s*2/);
  assert.match(styles, /\.notepad-panel[\s\S]*transform:\s*translateX\(calc\(100% \+ 48px\)\)/);
  assert.match(styles, /\.notepad-panel\.is-open\s*\{\s*transform:\s*translateX\(0\)/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /\.tool-rail-diagnostics\s*\{\s*top:\s*6px/);
  assert.match(styles, /\.tool-rail-notepad\s*\{\s*top:\s*calc\(50% - 50px\)/);
  assert.match(styles, /\.tool-rail-analysis\s*\{\s*top:\s*50%/);
  assert.match(styles, /\.tool-rail-output\s*\{\s*top:\s*calc\(50% \+ 50px\)/);
  assert.match(styles, /\.chat-card:has\(\.notepad-panel\.is-open\)[\s\S]*grid-template-columns:\s*minmax\(0, 3fr\) minmax\(300px, 2fr\)/);
  assert.doesNotMatch(styles, /\.chat-card:has\(\.notepad-panel\.is-open\) \.tool-rail-workspace/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.project-actions button:disabled \{ display: none; \}/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.project-actions button:not\(:disabled\)/);
  assert.match(styles, /\.diagnostics-drawer[\s\S]*width:\s*min\(320px, calc\(100% - 58px\)\)/);
  assert.match(styles, /\.notepad-header[\s\S]*min-height:\s*36px/);
  assert.match(styles, /\.panel-title h2[\s\S]*font-size:\s*12px/);
});
