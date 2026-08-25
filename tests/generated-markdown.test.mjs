import assert from "node:assert/strict";
import test from "node:test";
import { parseGeneratedMarkdown } from "../app/generated-markdown-parser.ts";

const text = (inline) => inline.map((item) => item.kind === "text" ? item.value : text(item.children)).join("");

test("generated Markdown parses paragraphs, line breaks and restrained headings", () => {
  const blocks = parseGeneratedMarkdown("Plain paragraph\nwith a line break.\n\n## Modest heading");
  assert.deepEqual(blocks.map(({ kind }) => kind), ["paragraph", "heading"]);
  assert.equal(blocks[0].lines.length, 2);
  assert.equal(text(blocks[0].lines[0]), "Plain paragraph");
  assert.equal(text(blocks[1].children), "Modest heading");
});

test("bold and italic markers become semantic inline nodes", () => {
  const source = "**First label** text\n\n**Second label** and *detail*";
  const blocks = parseGeneratedMarkdown(source);
  assert.equal(blocks[0].lines[0][0].kind, "strong");
  assert.equal(blocks[1].lines[0][0].kind, "strong");
  assert.equal(blocks[1].lines[0].at(-1).kind, "emphasis");
  assert.equal(JSON.stringify(blocks).includes("**"), false);
});

test("unordered and ordered Markdown become list structures", () => {
  const blocks = parseGeneratedMarkdown("- one\n- **two**\n\n1. first\n2. second");
  assert.deepEqual(blocks.map(({ kind }) => kind), ["unordered-list", "ordered-list"]);
  assert.equal(blocks[0].items.length, 2);
  assert.equal(blocks[1].items.length, 2);
});

test("raw HTML remains inert text and source content is not mutated", () => {
  const source = '<img src=x onerror="globalThis.compromised=true"> **safe**';
  const original = source.slice();
  const blocks = parseGeneratedMarkdown(source);
  assert.equal(blocks[0].lines[0][0].kind, "text");
  assert.match(blocks[0].lines[0][0].value, /<img/);
  assert.equal(source, original);
});

test("renderer does not use an HTML injection escape hatch", async () => {
  const renderer = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../app/generated-markdown.tsx", import.meta.url), "utf8"));
  assert.doesNotMatch(renderer, /dangerouslySetInnerHTML/);
  assert.match(renderer, /<strong/);
  assert.match(renderer, /<em/);
  assert.match(renderer, /<li/);
});
