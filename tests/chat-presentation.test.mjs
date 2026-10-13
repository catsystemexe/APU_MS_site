import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { splitAssistantMetadata } from "../app/response-metadata.ts";

const [client, css] = await Promise.all([
  readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);

test("direct composer has no focus activation or expansion state; dictation and loading remain guarded", () => {
  assert.doesNotMatch(client, /composer-entry-trigger|isComposerExpanded|expandComposer/);
  assert.match(client, /INPUT_PLACEHOLDER = "Napište APU\.\.\."/);
  assert.match(client, /isDictating \? \([\s\S]*?composer-listening[\s\S]*?: \([\s\S]*?<textarea/);
  assert.match(client, /disabled=\{isLoading \|\| !isNotepadHydrated\}/);
  assert.match(client, /event\.key === "Enter" && !event\.shiftKey/);
  assert.match(client, /Math\.min\(textarea\.scrollHeight, 150\)/);
  assert.match(css, /\.composer textarea \{[^}]*cursor: text/);
  assert.doesNotMatch(css, /is-expanded|min-height 140ms/);
});

test("ordinary responses are transparent and scoped wrapping/tooltip rules constrain Chat", () => {
  assert.match(css, /\.assistant-response \{[^}]*background: transparent/);
  assert.match(css, /\.message-content \{[^}]*overflow-wrap: anywhere/);
  assert.match(css, /\.welcome-question \{[^}]*max-width: 100%/);
  assert.match(css, /\.welcome-help \{[^}]*width: min\(390px, 100%\)/);
  assert.match(client, /role="tooltip" className="welcome-help"/);
  assert.match(client, /className="extraction-warning"/);
  assert.match(client, /<DialogActionCard/);
});

test("all Chat phases share hidden visual scrollbar and one accessible bottom control", () => {
  assert.match(css, /\.message-list \{[^}]*overflow-y: auto[^}]*overflow-x: clip[^}]*scrollbar-width: none/);
  assert.match(css, /\.message-list::-webkit-scrollbar \{ display: none; \}/);
  assert.equal((client.match(/className="chat-scroll-bottom"/g) ?? []).length, 1);
  assert.match(client, /\{!isChatAtBottom && <button/);
  assert.match(client, /scrollHeight - list\.scrollTop - list\.clientHeight <= 48/);
  assert.match(client, /prefers-reduced-motion: reduce/);
});

test("inline phase/debug presentation is off, while metadata, functional mapping and notices survive", () => {
  assert.match(client, /const SHOW_INLINE_CHAT_DEBUG = false/);
  assert.match(client, /SHOW_INLINE_CHAT_DEBUG && isDeveloper && message\.role/);
  assert.match(client, /SHOW_INLINE_CHAT_DEBUG \|\| !\/\^\\\[FÁZE/);
  assert.match(client, /message\.debugMapping\)\?\.debugMapping/);
  assert.match(client, /functionalMapping \? \{ functionalMapping \}/);
  const metadata = splitAssistantMetadata("[FÁZE 2]\nNejistota a bezpečnostní upozornění.\n[DEBUG | Profil: P2 | Blok: A | Zóna: 1]");
  assert.equal(metadata.visibleContent, "Nejistota a bezpečnostní upozornění.");
  assert.equal(metadata.phaseLabel, "[FÁZE 2]");
  assert.deepEqual(metadata.debugMapping, { profiles: "P2", blocks: "A", zones: "1" });
  assert.ok(metadata.debugText);
});
