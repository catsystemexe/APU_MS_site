import type { CommunicationProfileId } from "./communication-profile.ts";
import { COMMUNICATION_PROFILES } from "./communication-profile.ts";
import type { Diagnostics, ConversationSummary } from "./conversation-diagnostics.ts";
import { summarizeDiagnostics } from "./conversation-diagnostics.ts";
import type { DialogAction } from "./dialog-action.ts";
import { findAssistantHighlightRanges } from "./assistant-highlights.ts";
import type { CategoryId, NotepadState } from "./notepad-model.ts";
import { parseDebugMapping, type DebugMapping } from "./response-metadata.ts";

export const AUDIT_SCHEMA_VERSION = "apu-audit/1.3";
const CZK_PER_USD = 21.5;

const AUDIT_CATEGORY_LABELS: Record<CategoryId, string> = {
  manifestations: "Pozorovaný projev",
  goals: "Pedagogická potřeba",
  context: "Kontext",
  course: "Intenzita / trend",
  helps: "Zkušenosti",
};

export type AuditSourceMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  phaseLabel?: string;
  dialogActions?: DialogAction[];
  debugText?: string;
  debugMapping?: DebugMapping;
  diagnostics?: Diagnostics;
  controllerDiagnostics?: Diagnostics;
  extractionDiagnostics?: Diagnostics;
  sourceMessageId?: string;
  communicationProfile?: CommunicationProfileId;
};

export type AuditHighlight = {
  start: number;
  end: number;
  category: CategoryId;
  sourceEntryId: string;
};

export type AuditMessage = AuditSourceMessage & { highlights: AuditHighlight[] };

export type AuditData = {
  metadata: {
    auditId: string;
    exportedAt: string;
    schemaVersion: typeof AUDIT_SCHEMA_VERSION;
    application: "APU Site 0.1";
    communicationProfile: { id: CommunicationProfileId; label: string };
    design: { colorTheme: string; typography: string; fontSize: string };
    pricing: { displayCurrency: "CZK"; czkPerUsd: number };
  };
  messages: AuditMessage[];
  notepad: NotepadState;
  diagnostics: ConversationSummary;
};

function randomAuditId() {
  const id = globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `apu-${id}`;
}

function exactSourceHighlights(message: AuditSourceMessage, notepad: NotepadState) {
  const matches: AuditHighlight[] = [];
  for (const category of Object.keys(notepad) as CategoryId[]) {
    for (const entry of notepad[category]) {
      if (entry.source?.messageId !== message.id) continue;
      const start = entry.source.start;
      const end = entry.source.end;
      if (start >= 0 && end > start && message.content.slice(start, end) === entry.source.quote) {
        matches.push({ start, end, category, sourceEntryId: entry.id });
      }
    }
  }
  return matches;
}

function assistantHighlights(message: AuditSourceMessage, notepad: NotepadState) {
  if (message.role !== "assistant" || !message.sourceMessageId) return [];
  const entries = (Object.keys(notepad) as CategoryId[]).flatMap((category) =>
    notepad[category]
      .filter((entry) => entry.source?.messageId === message.sourceMessageId)
      .map((entry) => ({ category, entry })),
  );
  return entries.flatMap(({ category, entry }) =>
    findAssistantHighlightRanges(message.content, [entry.text, entry.source?.quote ?? ""])
      .map((range) => ({ ...range, category, sourceEntryId: entry.id })),
  );
}

export function buildAuditData(input: {
  messages: AuditSourceMessage[];
  notepad: NotepadState;
  communicationProfile: CommunicationProfileId;
  design: { colorTheme: string; typography: string; fontSize: string };
  now?: Date;
  auditId?: string;
}): AuditData {
  const now = input.now ?? new Date();
  return {
    metadata: {
      auditId: input.auditId ?? randomAuditId(),
      exportedAt: now.toISOString(),
      schemaVersion: AUDIT_SCHEMA_VERSION,
      application: "APU Site 0.1",
      communicationProfile: {
        id: input.communicationProfile,
        label: COMMUNICATION_PROFILES[input.communicationProfile].label,
      },
      design: { ...input.design },
      pricing: { displayCurrency: "CZK", czkPerUsd: CZK_PER_USD },
    },
    messages: input.messages.map((message) => {
      const debugMapping = message.debugMapping ?? parseDebugMapping(message.debugText);
      return {
        ...message,
        ...(debugMapping ? { debugMapping } : {}),
        highlights: [...exactSourceHighlights(message, input.notepad), ...assistantHighlights(message, input.notepad)],
      };
    }),
    notepad: structuredClone(input.notepad),
    diagnostics: summarizeDiagnostics(input.messages.flatMap((message) => [
      message.diagnostics,
      message.controllerDiagnostics,
      message.extractionDiagnostics,
    ])),
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeJson(value: unknown) {
  return JSON.stringify(value, null, 2)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function flowerSvg() {
  const petals = ["#E86667", "#ED8845", "#E8B84E", "#82AE63", "#55B3AD", "#4C92C8", "#6775B8", "#A56AA2"];
  return `<svg class="flower" viewBox="0 0 256 256" role="img" aria-label="APU">${petals.map((color, index) => {
    const angles = [0, 45, 90, 135, 180, 225, 270, 315];
    const positions = [[128,97.44],[152.44,107.56],[162.56,132],[152.44,156.44],[128,166.56],[103.56,156.44],[93.44,132],[103.56,107.56]];
    return `<path d="M -10.8 0 C -12.96 -11.88 -23.76 -24.84 -25.92 -38.88 C -29.16 -56.16 -17.28 -70.2 0 -72.36 C 17.28 -70.2 29.16 -56.16 25.92 -38.88 C 23.76 -24.84 12.96 -11.88 10.8 0 Z" fill="${color}" transform="translate(${positions[index][0]} ${positions[index][1]}) rotate(${angles[index]})"/>`;
  }).join("")}</svg>`;
}

const ICONS: Record<string, string> = {
  MAIN: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>`,
  SIDE: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M4 12a8 8 0 0 1 16 0M12 15v7"/></svg>`,
  NAV: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l18-8-8 18-2-8-8-2z"/></svg>`,
};

function renderHighlightedText(message: AuditMessage) {
  const ranges = [...message.highlights]
    .filter((range) => range.start >= 0 && range.end > range.start && range.end <= message.content.length)
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .filter((range, index, all) => index === 0 || range.start >= all[index - 1].end);
  let cursor = 0;
  const parts: string[] = [];
  for (const range of ranges) {
    parts.push(escapeHtml(message.content.slice(cursor, range.start)));
    parts.push(`<mark class="source source--${escapeHtml(range.category)}">${escapeHtml(message.content.slice(range.start, range.end))}</mark>`);
    cursor = range.end;
  }
  parts.push(escapeHtml(message.content.slice(cursor)));
  return parts.join("");
}

function renderDiagnostics(label: string, diagnostics?: Diagnostics) {
  if (!diagnostics) return "";
  const cost = diagnostics.estimatedCostUsd === null ? "≈ —" : `≈ ${(diagnostics.estimatedCostUsd * CZK_PER_USD).toLocaleString("cs-CZ", { maximumFractionDigits: 3 })} Kč`;
  return `<div><b>${escapeHtml(label)}</b> · ${escapeHtml(diagnostics.model)} · IN ${diagnostics.inputTokens} · OUT ${diagnostics.outputTokens} · Σ ${diagnostics.inputTokens + diagnostics.outputTokens} · ${cost}</div>`;
}

function renderMessage(message: AuditMessage) {
  const actions = message.dialogActions ?? [];
  const profile = message.communicationProfile ? COMMUNICATION_PROFILES[message.communicationProfile].label : null;
  return `<article class="message message--${message.role}">
    <header>${message.role === "assistant" ? flowerSvg() : `<span class="user-badge">VY</span>`}<div><strong>${message.role === "assistant" ? "APU" : "Uživatel"}</strong>${message.phaseLabel ? `<span class="phase">${escapeHtml(message.phaseLabel)}</span>` : ""}${profile ? `<span class="profile">Komunikační profil: ${escapeHtml(profile)}</span>` : ""}</div></header>
    <div class="content">${renderHighlightedText(message)}</div>
    ${actions.map((action) => `<section class="dialog dialog--${action.type.toLowerCase()}"><span class="dialog-icon">${ICONS[action.type]}</span><div><div class="dialog-meta">${escapeHtml(action.type)} · target: ${escapeHtml(action.target)}${action.required ? " · povinné" : ""}</div><p>${escapeHtml(action.question)}</p>${action.options.length ? `<ul>${action.options.map((option) => `<li><code>${escapeHtml(option.id)}</code> ${escapeHtml(option.label)}</li>`).join("")}</ul>` : ""}</div></section>`).join("")}
    ${(message.debugText || message.diagnostics || message.controllerDiagnostics || message.extractionDiagnostics) ? `<aside class="diagnostics">${message.debugText ? `<div>${escapeHtml(message.debugText)}</div>` : ""}${renderDiagnostics("MODEL", message.diagnostics)}${renderDiagnostics("QUEST CONTROLLER", message.controllerDiagnostics)}${renderDiagnostics("EXTRAKCE", message.extractionDiagnostics)}</aside>` : ""}
  </article>`;
}

function renderNotepad(notepad: NotepadState) {
  return (Object.keys(notepad) as CategoryId[]).map((category) => {
    return `<section class="note-category note-category--${category}"><h3>${escapeHtml(AUDIT_CATEGORY_LABELS[category])}</h3>${notepad[category].length ? `<ul>${notepad[category].map((entry) => `<li><span>${escapeHtml(entry.text)}</span><small>${escapeHtml(entry.origin)}${entry.reviewStatus ? ` · ${escapeHtml(entry.reviewStatus)}` : ""}</small></li>`).join("")}</ul>` : `<p class="empty">Bez záznamu</p>`}</section>`;
  }).join("");
}

const AUDIT_CSS = `
:root{color-scheme:light;--page:#faf8f3;--surface:#fff;--ink:#12324a;--muted:#667985;--line:#d7dde0;--accent:#6faed6;--main:#7655a3;--side:#4d88ae;--nav:#b17b16}*{box-sizing:border-box}body{margin:0;background:var(--page);color:var(--ink);font:15px/1.55 Arial,sans-serif}.page{width:min(980px,calc(100% - 28px));margin:28px auto 60px}.audit-header{display:flex;align-items:center;gap:14px;padding:18px 20px;border:1px solid var(--line);border-radius:16px;background:var(--surface)}.flower{width:42px;height:42px;flex:none}.audit-header h1{margin:0;font-size:22px}.meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 18px;margin:14px 0 24px;padding:12px 16px;border:1px solid var(--line);border-radius:12px;background:#fff}.meta div{min-width:0}.meta dt{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em}.meta dd{margin:2px 0 0;overflow-wrap:anywhere;font:12px/1.4 ui-monospace,monospace}.layout{display:grid;grid-template-columns:minmax(0,2fr) minmax(250px,1fr);gap:18px;align-items:start}.conversation,.notepad{display:grid;gap:12px}.message{padding:16px 18px;border:1px solid var(--line);border-radius:14px;background:#fff}.message--user{margin-left:8%;background:#edf5fa}.message--assistant{margin-right:4%}.message header{display:flex;align-items:center;gap:9px;margin-bottom:10px}.message header .flower{width:26px;height:26px}.message header>div{display:flex;align-items:center;flex-wrap:wrap;gap:7px}.user-badge{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--ink);color:#fff;font-size:10px;font-weight:700}.phase,.profile{padding:2px 7px;border-radius:999px;background:#edf2f5;color:var(--muted);font-size:10px}.content{white-space:pre-wrap;overflow-wrap:anywhere}.source{padding:1px 2px;border-radius:3px;background:#f1e9ff;color:inherit}.source--goals{background:#e6f0fa}.source--context{background:#e8f4f1}.source--course{background:#fff1da}.source--helps{background:#e9f3df}.dialog{display:grid;grid-template-columns:24px 1fr;gap:8px;margin-top:13px;padding-top:11px;border-top:1px solid var(--line)}.dialog-icon{color:var(--side)}.dialog--main .dialog-icon{color:var(--main)}.dialog--nav .dialog-icon{color:var(--nav)}.dialog-icon svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.dialog-meta{color:var(--muted);font:10px/1.4 ui-monospace,monospace}.dialog p{margin:3px 0}.dialog ul{margin:6px 0 0;padding-left:18px}.dialog code{color:var(--muted);font-size:10px}.diagnostics{margin-top:12px;padding-top:8px;border-top:1px dashed var(--line);color:var(--muted);font:10px/1.55 ui-monospace,monospace;overflow-wrap:anywhere}.notepad{position:sticky;top:14px}.notepad>h2,.conversation>h2{margin:0 0 2px;font-size:16px}.note-category{padding:12px 14px;border-left:4px solid var(--side);border-radius:10px;background:#fff;box-shadow:0 0 0 1px var(--line)}.note-category--manifestations{border-color:var(--main)}.note-category--course{border-color:#b17b16}.note-category--helps{border-color:#82ae63}.note-category h3{margin:0 0 6px;font-size:12px}.note-category ul{display:grid;gap:6px;margin:0;padding-left:17px}.note-category li small{display:block;color:var(--muted);font-size:9px}.empty{margin:0;color:var(--muted);font-size:11px}.footer{margin-top:22px;color:var(--muted);font-size:10px;text-align:center}@media(max-width:720px){.page{width:min(100% - 18px,980px);margin-top:10px}.meta{grid-template-columns:1fr}.layout{grid-template-columns:1fr}.notepad{position:static;order:-1}.message--user,.message--assistant{margin-left:0;margin-right:0}.audit-header{padding:14px}.message{padding:14px}}@media print{body{background:#fff}.page{width:100%;margin:0}.notepad{position:static}.message,.note-category,.meta,.audit-header{break-inside:avoid;box-shadow:none}}
`;

const AUDIT_THEME_OVERRIDES: Record<string, string> = {
  default: "--page:#faf8f3;--surface:#fff;--ink:#12324a;--muted:#667985;--accent:#6faed6;",
  cool: "--page:#f8fafb;--surface:#fff;--ink:#102d46;--muted:#657783;--accent:#4f9ed1;",
  soft: "--page:#fbf8f1;--surface:#fff;--ink:#20394c;--muted:#718087;--accent:#7eafc8;",
  minimal: "--page:#fff;--surface:#fff;--ink:#172b3a;--muted:#687680;--accent:#5c99c6;",
};

export function renderAuditHtml(data: AuditData) {
  const exported = new Date(data.metadata.exportedAt).toLocaleString("cs-CZ");
  const theme = AUDIT_THEME_OVERRIDES[data.metadata.design.colorTheme] ?? AUDIT_THEME_OVERRIDES.default;
  const fontSize = data.metadata.design.fontSize === "smaller" ? "13.5px" : data.metadata.design.fontSize === "larger" ? "17px" : "15px";
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>APU audit ${escapeHtml(data.metadata.auditId)}</title><style>${AUDIT_CSS}:root{${theme}--audit-font-size:${fontSize}}body{font-size:var(--audit-font-size)}</style></head><body><main class="page">
    <header class="audit-header">${flowerSvg()}<div><h1>APU — audit konverzace</h1><div>Samostatný neměnný export pro kontrolu a další zpracování.</div></div></header>
    <dl class="meta"><div><dt>Datum exportu</dt><dd>${escapeHtml(exported)}</dd></div><div><dt>Auditní ID</dt><dd>${escapeHtml(data.metadata.auditId)}</dd></div><div><dt>Schéma</dt><dd>${escapeHtml(data.metadata.schemaVersion)}</dd></div><div><dt>Komunikační profil</dt><dd>${escapeHtml(data.metadata.communicationProfile.label)}</dd></div><div><dt>Zprávy</dt><dd>${data.messages.length}</dd></div><div><dt>Tokeny / cena</dt><dd>${data.diagnostics.totalTokens} / ${data.diagnostics.estimatedCostUsd === null ? "≈ —" : `≈ ${(data.diagnostics.estimatedCostUsd * CZK_PER_USD).toLocaleString("cs-CZ", { maximumFractionDigits: 3 })} Kč`}</dd></div></dl>
    <div class="layout"><section class="conversation"><h2>Konverzace</h2>${data.messages.map(renderMessage).join("")}</section><aside class="notepad"><h2>Snapshot Zápisníku</h2>${renderNotepad(data.notepad)}</aside></div>
    <footer class="footer">APU Site 0.1 · ${escapeHtml(data.metadata.schemaVersion)} · ${escapeHtml(data.metadata.auditId)}</footer>
  </main><script type="application/json" id="apu-audit-data">${safeJson(data)}</script></body></html>`;
}

export function auditFilename(exportedAt: string) {
  const date = new Date(exportedAt);
  const part = (value: number) => String(value).padStart(2, "0");
  return `APU_audit_${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}_${part(date.getHours())}-${part(date.getMinutes())}.html`;
}

export type AuditFile = {
  data: AuditData;
  html: string;
  filename: string;
  blob: Blob;
};

export function createAuditFile(data: AuditData): AuditFile {
  const html = renderAuditHtml(data);
  return { data, html, filename: auditFilename(data.metadata.exportedAt), blob: new Blob([html], { type: "text/html;charset=utf-8" }) };
}
