import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  COLOR_THEMES,
  DESIGN_PREFERENCES_STORAGE_KEY,
  FONT_SIZE_OPTIONS,
  TYPOGRAPHY_PRESETS,
} from "../app/design-system.ts";
import {
  composeSpeechSegments,
  composeSpeechTranscript,
  updateSpeechTranscriptSegments,
} from "../app/speech-transcript.ts";

const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const client = await readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8");

test("APU Default is the first color and typography fallback", () => {
  assert.deepEqual(COLOR_THEMES.map(({ id }) => id), ["default", "cool", "soft", "minimal"]);
  assert.deepEqual(TYPOGRAPHY_PRESETS.map(({ id }) => id), ["default", "soft", "minimal"]);
  assert.deepEqual(FONT_SIZE_OPTIONS.map(({ id }) => id), ["system", "smaller", "larger"]);
  assert.equal(DESIGN_PREFERENCES_STORAGE_KEY, "apu-site:design-preferences:v1");
});

test("default design tokens match the frozen APU baseline", () => {
  for (const declaration of [
    "--bg-page: #FAF8F3",
    "--bg-surface: #FFFFFF",
    "--bg-soft: #DCECF5",
    "--text-primary: #12324A",
    "--text-secondary: #667985",
    "--accent: #6FAED6",
    "--font-display: var(--font-manrope)",
    "--font-body: var(--font-source-sans)",
  ]) assert.match(css, new RegExp(declaration.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
});

test("all experimental presets override tokens without component variants", () => {
  for (const theme of ["cool", "soft", "minimal"]) {
    assert.match(css, new RegExp(`:root\\[data-color-theme="${theme}"\\]`));
  }
  assert.match(css, /:root\[data-typography="soft"\]/);
  assert.match(css, /:root\[data-typography="minimal"\]/);
  assert.match(css, /:root\[data-font-size="smaller"\]/);
  assert.match(css, /:root\[data-font-size="larger"\]/);
});

test("model, usage and design controls share the right settings drawer", () => {
  assert.match(client, /aria-label="Nastavení modelu, diagnostiky a vzhledu"/);
  assert.match(client, /id="drawer-model-select"/);
  assert.match(client, /id="color-theme-select"/);
  assert.match(client, /id="typography-select"/);
  assert.match(client, /id="font-size-select"/);
  assert.doesNotMatch(client, /id="design-settings"/);
  assert.match(client, /<Settings aria-hidden="true" \/>/);
  assert.match(client, /<UserRound aria-hidden="true" \/>/);
});

test("mobile notebook editing prevents iOS focus zoom", () => {
  assert.match(css, /@supports \(-webkit-touch-callout: none\)[\s\S]*?@media \(hover: none\) and \(pointer: coarse\)[\s\S]*?\.notepad-item textarea \{[\s\S]*?font-size: max\(16px, calc\(16px \* var\(--font-scale\)\)\);/);
});

test("new project requires confirmation before clearing an active conversation", () => {
  assert.match(client, /shouldResetCurrentProject\([\s\S]*?window\.confirm\("Nový projekt smaže aktuální konverzaci i obsah Zápisníku v tomto zařízení\. Chceš pokračovat\?"\)/);
  assert.match(client, /resetCurrentProject\(\);/);
});

test("settings overlay is independent from workspace tabs", () => {
  assert.match(client, /onClick=\{\(\) => setIsDiagnosticsDrawerOpen\(\(open\) => !open\)\}/);
  assert.match(client, /setActivePanel\(\(current\) => current === panel \? null : panel\)/);
  assert.doesNotMatch(client, /setActivePanel\(null\);\s*setIsDiagnosticsDrawerOpen/);
  assert.doesNotMatch(client, /setIsDiagnosticsDrawerOpen\(false\);\s*setActivePanel/);
});

test("composer is compact by default and expands for typed text", () => {
  assert.match(client, /rows=\{1\}/);
  assert.doesNotMatch(client, /autoFocus/);
  assert.match(client, /requestAnimationFrame\(\(\) => textareaRef\.current\?\.focus\(\)\)/);
  assert.match(css, /\.composer textarea \{[\s\S]*?min-height: 44px;[\s\S]*?resize: none;/);
  assert.match(client, /isComposerExpanded/);
  assert.match(client, /className="composer-toolbar"/);
  assert.match(css, /\.composer-field \{[\s\S]*?min-height: 52px;/);
  assert.match(css, /\.composer-field\.is-expanded \{[\s\S]*?grid-template-rows: minmax\(44px, auto\) 42px;/);
  assert.match(css, /\.composer textarea \{[\s\S]*?width: 100%;/);
});

test("composer offers persistent Czech speech-to-text with delayed transcript", () => {
  assert.match(client, /SpeechRecognition\?\:/);
  assert.match(client, /webkitSpeechRecognition\?\:/);
  assert.match(client, /recognition\.lang = "cs-CZ"/);
  assert.match(client, /recognition\.interimResults = true/);
  assert.match(client, /dictationShouldContinueRef\.current/);
  assert.match(client, /setTimeout\(\(\) => startRecognitionCycle\(session\), 160\)/);
  assert.match(client, /aria-label=\{isDictating \? "Zastavit diktování" : "Spustit diktování"\}/);
  assert.match(client, /isDictating \? <Square aria-hidden="true" \/> : <Mic aria-hidden="true" \/>/);
  assert.match(client, /stopDictation\(true\)/);
  assert.match(client, /className="dictation-waveform"/);
  assert.match(client, /Zahodit diktovaný text/);
  assert.match(client, /Array\.from\(\{ length: 15 \}/);
  assert.match(client, /setIsComposerExpanded\(false\);[\s\S]*?setIsDictating\(true\)/);
  assert.doesNotMatch(client, /setComposerInput\(`\$\{prefix\}\$\{transcript\}`\)/);
  assert.match(client, /Diktování ukončíte tlačítkem Stop nebo Odeslat/);
  assert.match(css, /\.dictation-button \{[\s\S]*?width: 42px;[\s\S]*?height: 42px;/);
  assert.match(css, /\.send-button \{[\s\S]*?width: 42px;[\s\S]*?border-radius: 50%;/);
  assert.match(css, /@keyframes dictation-wave/);
});

test("speech-to-text replaces interim hypotheses instead of concatenating them", () => {
  const interimHistory = [
    { 0: { transcript: "test" }, isFinal: false },
    { 0: { transcript: "test raz" }, isFinal: false },
    { 0: { transcript: "test raz dva tři" }, isFinal: false },
  ];
  assert.equal(composeSpeechTranscript(interimHistory), "test raz dva tři");

  const finalizedWithInterim = [
    { 0: { transcript: "test raz dva" }, isFinal: true },
    { 0: { transcript: "tři" }, isFinal: false },
  ];
  assert.equal(composeSpeechTranscript(finalizedWithInterim), "test raz dva tři");

  const androidCumulativeFinals = [
    { 0: { transcript: "test" }, isFinal: true },
    { 0: { transcript: "test ras" }, isFinal: true },
    { 0: { transcript: "test ras 2" }, isFinal: true },
    { 0: { transcript: "test raz dva tři" }, isFinal: false },
  ];
  assert.equal(composeSpeechTranscript(androidCumulativeFinals), "test raz dva tři");

  const ordinaryFinalSegments = [
    { 0: { transcript: "test" }, isFinal: true },
    { 0: { transcript: "raz" }, isFinal: true },
    { 0: { transcript: "dva" }, isFinal: true },
    { 0: { transcript: "tři" }, isFinal: true },
  ];
  assert.equal(composeSpeechTranscript(ordinaryFinalSegments), "test raz dva tři");
});

test("speech-to-text updates only results changed since resultIndex", () => {
  let segments = updateSpeechTranscriptSegments([], [
    { 0: { transcript: "test" }, isFinal: true },
    { 0: { transcript: "test ras" }, isFinal: false },
  ], 0);
  assert.equal(composeSpeechSegments(segments), "test ras");

  segments = updateSpeechTranscriptSegments(segments, [
    { 0: { transcript: "ignored stale value" }, isFinal: true },
    { 0: { transcript: "test raz dva tři" }, isFinal: true },
  ], 1);
  assert.equal(composeSpeechSegments(segments), "test raz dva tři");
});

test("notepad uses a white surface and blue only for category labels", () => {
  assert.match(css, /\.notepad-scroll \{[\s\S]*?background: var\(--bg-surface\);/);
  assert.match(css, /\.category-tab \{[\s\S]*?background: var\(--accent-soft\);/);
});
