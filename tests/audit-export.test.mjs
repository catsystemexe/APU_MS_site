import assert from "node:assert/strict";
import test from "node:test";
import { deliverAuditFile } from "../app/audit-delivery.ts";
import { buildAuditData, createAuditFile, renderAuditHtml } from "../app/audit-export.ts";
import { GOOGLE_DRIVE_SCOPE, uploadAuditToDrive } from "../app/google-drive-audit.ts";

const EMPTY = { manifestations: [], goals: [], context: [], course: [], helps: [] };

function sampleAudit() {
  return buildAuditData({
    now: new Date("2026-08-14T08:32:00.000Z"),
    auditId: "apu-test-id",
    communicationProfile: "colleague",
    design: { colorTheme: "default", typography: "default", fontSize: "system" },
    notepad: {
      ...EMPTY,
      manifestations: [{
        id: "note-1",
        text: "Žák při výuce usíná.",
        origin: "extracted",
        reviewStatus: "reviewed",
        source: { messageId: "user-1", quote: "Žák při výuce usíná.", start: 0, end: 23 },
      }],
    },
    messages: [
      { id: "user-1", role: "user", content: "Žák při výuce usíná." },
      {
        id: "assistant-1",
        role: "assistant",
        sourceMessageId: "user-1",
        communicationProfile: "colleague",
        content: "Rozumím, žák při výuce usíná.",
        phaseLabel: "[FÁZE 1]",
        dialogActions: [{
          type: "NAV", target: "phase", required: false, question: "Kam dál?",
          options: [
            { id: "continue_to_solution", label: "Přejít k řešení" },
            { id: "add_context", label: "Doplnit kontext" },
          ],
        }],
        debugText: "[DEBUG | Profil: P2 / P5 | Blok: A / E | Zóna: 1 / 2]",
        diagnostics: {
          callId: "chat-1", model: "gpt-5.6-luna", inputTokens: 100, outputTokens: 20,
          totalTokens: 120, estimatedCostUsd: 0.001,
        },
      },
    ],
  });
}

test("audit HTML contains complete conversation, dialog semantics, highlights, diagnostics and notebook", () => {
  const data = sampleAudit();
  const html = renderAuditHtml(data);
  assert.match(html, /Žák při výuce usíná/);
  assert.match(html, /Rozumím, žák při výuce usíná/);
  assert.match(html, /NAV · target: phase/);
  assert.match(html, /continue_to_solution/);
  assert.match(html, /Přejít k řešení/);
  assert.match(html, /source--manifestations/);
  assert.match(html, /gpt-5\.6-luna/);
  assert.match(html, /Snapshot Zápisníku/);
  assert.match(html, /apu-audit\/1\.3/);
  assert.match(html, /apu-test-id/);
  assert.match(html, /Komunikační profil: Kolega/);
  assert.match(html, /\[DEBUG \| Profil: P2 \/ P5 \| Blok: A \/ E \| Zóna: 1 \/ 2\]/);
});

test("embedded JSON is valid and is the machine-readable source of truth", () => {
  const data = sampleAudit();
  const html = renderAuditHtml(data);
  const match = html.match(/<script type="application\/json" id="apu-audit-data">([\s\S]*?)<\/script>/);
  assert.ok(match);
  const parsed = JSON.parse(match[1]);
  assert.deepEqual(parsed, JSON.parse(JSON.stringify(data)));
  assert.equal(parsed.messages[1].dialogActions[0].type, "NAV");
  assert.equal(parsed.messages[1].dialogActions[0].target, "phase");
  assert.equal(parsed.metadata.communicationProfile.id, "colleague");
  assert.equal(parsed.metadata.design.fontSize, "system");
  assert.deepEqual(parsed.messages[1].debugMapping, {
    profiles: "P2 / P5",
    blocks: "A / E",
    zones: "1 / 2",
  });
});

test("conversation content cannot inject HTML or terminate the JSON script", () => {
  const data = sampleAudit();
  data.messages[0].content = `</script><script>alert("x")</script><img src=x onerror=alert(1)>`;
  const html = renderAuditHtml(data);
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;\/script&gt;/);
  assert.equal((html.match(/<script/g) ?? []).length, 1);
  const json = html.match(/id="apu-audit-data">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(json);
  assert.equal(JSON.parse(json).messages[0].content, data.messages[0].content);
});

test("audit file is a standalone HTML download with deterministic filename", async () => {
  const file = createAuditFile(sampleAudit());
  assert.match(file.filename, /^APU_audit_2026-08-14_\d{2}-32\.html$/);
  assert.equal(file.blob.type, "text/html;charset=utf-8");
  assert.doesNotMatch(file.html, /<link\b[^>]*stylesheet/i);
  assert.doesNotMatch(file.html, /<script\b[^>]*src=/i);
  assert.doesNotMatch(file.html, /<img\b/i);
  assert.match(await file.blob.text(), /^<!doctype html>/);
});

test("audit delivery opens the native file share flow when the device supports it", async () => {
  const audit = createAuditFile(sampleAudit());
  const shared = [];
  class TestFile extends Blob {
    constructor(parts, name, options) {
      super(parts, options);
      this.name = name;
    }
  }
  const result = await deliverAuditFile(audit, {
    File: TestFile,
    navigator: {
      canShare: (data) => data.files?.[0]?.name === audit.filename,
      share: async (data) => { shared.push(data); },
    },
  });
  assert.equal(result, "shared");
  assert.equal(shared.length, 1);
  assert.equal(shared[0].files[0].name, audit.filename);
  assert.equal(shared[0].files[0].type, "text/html;charset=utf-8");
});

test("audit delivery falls back to a regular download when file sharing is unavailable", async () => {
  const audit = createAuditFile(sampleAudit());
  const actions = [];
  const link = {
    href: "",
    download: "",
    rel: "",
    click: () => actions.push("click"),
    remove: () => actions.push("remove"),
  };
  const result = await deliverAuditFile(audit, {
    navigator: { canShare: () => false, share: async () => undefined },
    document: {
      createElement: () => link,
      body: { appendChild: () => actions.push("append") },
    },
    url: {
      createObjectURL: () => "blob:apu-audit",
      revokeObjectURL: (url) => actions.push(`revoke:${url}`),
    },
    schedule: (callback) => callback(),
  });
  assert.equal(result, "downloaded");
  assert.equal(link.download, audit.filename);
  assert.deepEqual(actions, ["append", "click", "remove", "revoke:blob:apu-audit"]);
});

test("Drive upload uses only app-created folder flow and multipart HTML", async () => {
  const calls = [];
  const fetcher = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("/drive/v3/files?fields=id")) {
      return new Response(JSON.stringify({ id: "folder-1" }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (String(url).includes("/drive/v3/files?") && !String(url).includes("upload")) {
      return new Response(JSON.stringify({ files: [] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ id: "file-1", name: "audit.html", webViewLink: "https://drive.google.com/file-1" }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const result = await uploadAuditToDrive({ accessToken: "temporary-token", filename: "audit.html", html: "<!doctype html>", fetcher });
  assert.equal(result.id, "file-1");
  assert.equal(GOOGLE_DRIVE_SCOPE, "https://www.googleapis.com/auth/drive.file");
  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call.init.headers.Authorization === "Bearer temporary-token"));
  assert.match(calls[0].url, /appProperties/);
  assert.match(String(calls[2].init.headers["Content-Type"]), /^multipart\/related/);
  assert.match(String(calls[2].init.body), /text\/html/);
});
