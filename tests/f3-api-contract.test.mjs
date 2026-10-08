import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { F3_PROVIDER_SCHEMA, parseF3ProviderResult } from "../app/f3-provider-contract.ts";
const route = await readFile(new URL("../app/api/f3/route.ts", import.meta.url), "utf8");
function assertStrictObjects(schema, path = "root") {
  if (!schema || typeof schema !== "object") return;
  if (schema.type === "object") {
    assert.equal(schema.additionalProperties, false, `${path} additionalProperties`);
    assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort(), `${path} required properties`);
  }
  for (const [key, nested] of Object.entries(schema)) {
    if (key === "properties") for (const [name, property] of Object.entries(nested)) assertStrictObjects(property, `${path}.${name}`);
    else if (key === "items") assertStrictObjects(nested, `${path}[]`);
    else if (key === "anyOf") nested.forEach((option, index) => assertStrictObjects(option, `${path}.anyOf[${index}]`));
  }
}
test("F3 API is current-Rozbor snapshot-only, path-aware and emits distinct telemetry", () => { for (const text of ["sourceSnapshot", "sourceFingerprint", "isF2ToF3Snapshot", "F3 final render — ${path}", "POCHOPIT", "POZOROVAT", "VYTVOŘIT"]) assert.ok(route.includes(text), text); assert.equal(route.includes("conversation"), false); assert.equal(route.includes("processedBuild"), false); });
test("F3 prompt protects substantive F2 decisions and returns a boundary issue", () => { for (const text of ["autoritativní věcný zdroj", "pouze materializuje", "Neměň pedagogický cíl", "nepřidávej ani nevyřazuj hypotézy", "nenahrazuj vybraný přístup", "neměň účel ani evidenci pozorování", "vymyšlenou jistotou", "boundary_issue"]) assert.ok(route.includes(text), text); });
test("path rules permit materialization without selecting new substance", () => { assert.match(route, /skutečný materiál podle již zvoleného cíle/); assert.match(route, /tabulka smí obsahovat jen dodané indikátory/); assert.match(route, /bez nové intervence/); });
test("parsed F3 output crosses a local runtime validation boundary", () => { assert.match(route, /parseF3ProviderResult\(JSON\.parse\(text\)\)/); });
test("F3 strict structured output uses a supported root object instead of a top-level union", () => {
  assert.equal(F3_PROVIDER_SCHEMA.type, "object");
  assert.equal("anyOf" in F3_PROVIDER_SCHEMA, false);
  assert.equal(F3_PROVIDER_SCHEMA.additionalProperties, false);
  assert.deepEqual([...F3_PROVIDER_SCHEMA.required].sort(), Object.keys(F3_PROVIDER_SCHEMA.properties).sort());
  assert.deepEqual(F3_PROVIDER_SCHEMA.properties.kind.enum, ["material", "boundary_issue"]);
  assertStrictObjects(F3_PROVIDER_SCHEMA);
});
test("F3 provider envelope preserves the application material and boundary-issue union", () => {
  const material = parseF3ProviderResult({
    kind: "material",
    material: { title: "Výstup", introduction: "Úvod", sections: [{ heading: "Část", content: "Obsah" }], table: null, cards: [], usageNote: null },
    boundaryIssue: null,
  });
  assert.equal(material.kind, "material");
  const issue = parseF3ProviderResult({
    kind: "boundary_issue",
    material: null,
    boundaryIssue: { reason: "Chybí volba", affectedArea: "přístup", suggestedReturnToF2: "Doplňte přístup" },
  });
  assert.equal(issue.kind, "boundary_issue");
  assert.throws(() => parseF3ProviderResult({ kind: "material", material: null, boundaryIssue: null }), /nekonzistentní/);
  assert.throws(() => parseF3ProviderResult({ kind: "material", material: { title: "neúplné" }, boundaryIssue: null }), /neplatný F3/);
  assert.throws(() => parseF3ProviderResult({ kind: "material", material: { kind: "boundary_issue", reason: "override", affectedArea: "x", suggestedReturnToF2: "x" }, boundaryIssue: null }), /neplatný F3/);
});
test("F3 exposes only a sanitized provider failure diagnostic to developers", () => {
  assert.match(route, /identity\.role === "developer"/);
  assert.match(route, /\^\[a-z0-9_\.-\]\{1,80\}\$/i);
  assert.match(route, /F3 provider request failed: status=/);
});
test("primary F3 workspace is decoupled from rendered PREVIEW and exposes explicit source adoption", async () => {
  const [workspace, client] = await Promise.all([
    readFile(new URL("../app/f3-finalization.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(workspace, /F2Preview|explicitní PREVIEW|aktuální preview/);
  assert.match(workspace, /Aktuální Rozbor · předávací snapshot/);
  assert.match(workspace, /Přijmout aktuální Rozbor/);
  assert.match(client, /createF2ToF3Snapshot/);
  assert.match(client, /markF3SourceStale/);
  assert.match(await readFile(new URL("../app/notepad.tsx", import.meta.url), "utf8"), /PŘEJÍT K VÝSTUPU/);
});
