import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const route = await readFile(new URL("../app/api/f3/route.ts", import.meta.url), "utf8");
test("F3 API is snapshot-only, path-aware and emits distinct telemetry", () => { for (const text of ["sourceSnapshot", "F3 final render — ${path}", "POCHOPIT", "POZOROVAT", "VYTVOŘIT"]) assert.ok(route.includes(text), text); assert.equal(route.includes("conversation"), false); });
test("F3 prompt protects substantive F2 decisions and returns a boundary issue", () => { for (const text of ["autoritativní věcný zdroj", "pouze materializuje", "Neměň pedagogický cíl", "nepřidávej ani nevyřazuj hypotézy", "nenahrazuj vybraný přístup", "neměň účel ani evidenci pozorování", "vymyšlenou jistotou", "boundary_issue"]) assert.ok(route.includes(text), text); });
test("path rules permit materialization without selecting new substance", () => { assert.match(route, /skutečný materiál podle již zvoleného cíle/); assert.match(route, /tabulka smí obsahovat jen dodané indikátory/); assert.match(route, /bez nové intervence/); });
test("parsed F3 output crosses a local runtime validation boundary", () => { assert.match(route, /parseF3RenderResult\(JSON\.parse\(text\)\)/); });
