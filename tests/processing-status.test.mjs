import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("F1 processing status is transient, milestone-driven and separate from chat history", async () => {
  const [component, client, route, sessionExport] = await Promise.all([
    readFile(new URL("../app/processing-status.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/session-export.ts", import.meta.url), "utf8"),
  ]);

  assert.match(component, /Zpracovávám informace/);
  assert.match(component, /Informace zpracovány/);
  assert.match(component, /Aktualizuji Zápisník/);
  assert.match(component, /Zápisník aktualizován/);
  assert.match(component, /Připravuji odpověď/);
  assert.match(component, /LoaderCircle/);
  assert.match(component, /PencilLine/);
  assert.match(component, /Check/);

  assert.match(client, /const \[f1ProcessingStatus, setF1ProcessingStatus\]/);
  assert.match(client, /startF1ProcessingSequence\(assistantId, applied\.added\.length > 0\)/);
  assert.match(client, /if \(phase === "intake"\) clearF1ProcessingStatus\(\)/);
  assert.match(client, /<ProcessingStatus stage=\{f1ProcessingStatus\.stage\} \/>/);
  assert.match(client, /const isF1ProcessingTurn = phase === "intake" && !options\?\.dialogEvent/);
  assert.match(route, /emit\(\{ type: "status", status: "preparing_response" \}\)/);
  assert.doesNotMatch(sessionExport, /ProcessingStatus|f1ProcessingStatus|processing_input/);
});
