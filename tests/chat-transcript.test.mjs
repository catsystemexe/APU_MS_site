import assert from "node:assert/strict";
import test from "node:test";
import { formatChatTranscript } from "../app/chat-transcript.ts";

test("copied transcript contains the visible conversation and testing metadata", () => {
  const transcript = formatChatTranscript([
    { role: "user", content: "Žák při výuce usíná." },
    {
      role: "assistant",
      content: "Rozumím situaci.",
      phaseLabel: "[FÁZE 1]",
      dialogActions: [{
        type: "MAIN",
        target: "teacher_need",
        question: "Co potřebujete změnit?",
        required: true,
        options: [],
      }],
      debugText: "[DEBUG | Profil: P2 | Blok: E | Zóna: 1]",
      diagnostics: {
        callId: "chat-1",
        model: "gpt-5.6-luna",
        inputTokens: 100,
        outputTokens: 20,
        totalTokens: 120,
        estimatedCostUsd: 0.001,
      },
      controllerDiagnostics: {
        callId: "qc-1",
        model: "gpt-5.6-luna",
        inputTokens: 30,
        outputTokens: 10,
        totalTokens: 40,
        estimatedCostUsd: 0.0002,
      },
    },
  ]);

  assert.match(transcript, /^VY\nŽák při výuce usíná\./);
  assert.match(transcript, /APU\n\[FÁZE 1\]\nRozumím situaci\./);
  assert.match(transcript, /OTÁZKA MAIN: Co potřebujete změnit\?/);
  assert.match(transcript, /MODEL: gpt-5\.6-luna · IN 100 · OUT 20 · Σ 120/);
  assert.match(transcript, /QUEST CONTROLLER: gpt-5\.6-luna · IN 30 · OUT 10 · Σ 40/);
  assert.match(transcript, /\[DEBUG \| Profil: P2 \| Blok: E \| Zóna: 1\]/);
});

test("navigation options are included in the copied transcript", () => {
  const transcript = formatChatTranscript([{
    role: "assistant",
    content: "Povinné minimum máme.",
    dialogActions: [{
      type: "NAV",
      target: "phase",
      question: "Kam dál?",
      required: false,
      options: [
        { id: "continue_to_solution", label: "Přejít k řešení" },
        { id: "add_context", label: "Doplnit kontext" },
      ],
    }],
  }]);

  assert.match(transcript, /OTÁZKA NAV: Kam dál\?/);
  assert.match(transcript, /MOŽNOSTI: Přejít k řešení \| Doplnit kontext/);
});
