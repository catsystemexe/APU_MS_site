import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import { createCurrentRozborState } from "../app/f2-build-model.ts";

const require = createRequire(import.meta.url);
const operationsSource = await readFile(new URL("../app/f2-build-operations.tsx", import.meta.url), "utf8");
const javascript = ts.transpileModule(operationsSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  .replace('"react/jsx-runtime"', JSON.stringify(pathToFileURL(require.resolve("react/jsx-runtime")).href))
  .replace('"./f2-build-model"', JSON.stringify(new URL("../app/f2-build-model.ts", import.meta.url).href));
const { F2BuildOperations } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
const client = await readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8");
const labels = {
  POCHOPIT: ["Porovnat a propojit hypotézy", "Doplnit odborný rámec"],
  POZOROVAT: ["Porovnat a propojit hypotézy", "Určit klíčové indikátory", "Stanovit priority pozorování"],
  VYTVOŘIT: ["Navrhnout možné přístupy", "Zpřesnit cíl", "Určit podmínky úspěchu", "Určit, co následně ověřovat"],
};
function descendants(element) {
  if (!element || typeof element !== "object") return [];
  const children = [element.props?.children].flat(Infinity).filter(Boolean);
  return [element, ...children.flatMap(descendants)];
}
for (const path of Object.keys(labels)) {
  test(`normal/developer mode uses exactly one ${path} operation set; all controls work`, () => {
    let state = createCurrentRozborState();
    const render = () => F2BuildOperations({ activeF2Path: path, currentRozbor: state, setCurrentRozbor: (update) => { state = update(state); } });
    const initial = renderToStaticMarkup(render());
    // This mode-independent component is the only Build operations renderer in the client.
    assert.equal(renderToStaticMarkup(F2BuildOperations({ activeF2Path: path, currentRozbor: state, setCurrentRozbor: () => {}, isDeveloper: true })), initial);
    for (const [candidate, set] of Object.entries(labels)) for (const label of set) {
      if (candidate === path) assert.ok(initial.includes(label), label);
      else if (!labels[path].includes(label)) assert.ok(!initial.includes(label), label);
    }
    assert.equal(descendants(render()).filter((element) => element.type === "button").length, 3 + labels[path].length);
    assert.doesNotMatch(initial, /radiogroup|role="radio"|Směr rozboru|POCHOPIT|POZOROVAT|VYTVOŘIT|F2 ·/);
    const buttons = descendants(render()).filter((element) => element.type === "button");
    for (const button of buttons) button.props.onClick();
    assert.equal(state[path].config.expansionDepth, 3);
    assert.ok(Object.entries(state[path].config).filter(([key]) => key !== "expansionDepth").every(([, value]) => value === true));
    for (const other of Object.keys(labels).filter((other) => other !== path)) assert.deepEqual(state[other], createCurrentRozborState()[other]);
    assert.ok(renderToStaticMarkup(render()).includes('aria-pressed="true"'));
    for (const button of descendants(render()).filter((element) => element.type === "button")) button.props.onClick();
    assert.deepEqual(state[path], createCurrentRozborState()[path]);
  });
}
test("client shares routing and Build UI for both modes without a path switch or internal heading", async () => {
  assert.equal((client.match(/<F2BuildOperations /g) ?? []).length, 1);
  const shell = client.slice(client.indexOf('{f2Build && <section'), client.indexOf('        <WorkspacePanel'));
  assert.doesNotMatch(shell, /isDeveloper|F2 ·|Směr rozboru|onPathChange/);
  assert.match(shell, /<h2>Build<\/h2>/);
  const routing = client.slice(client.indexOf('const sourceF2Need'), client.indexOf('const dictationTranscriptRef'));
  assert.doesNotMatch(routing, /isDeveloper|scenario\.path/);
  const picker = client.slice(client.indexOf('{scenarioMenuOpen &&'), client.indexOf('const [storedF2Build'));
  assert.doesNotMatch(picker, /DEV_TEST_SCENARIO_PATHS|scenario\.path|aria-label=\{path\}/);
  const editor = await readFile(new URL("../app/f2-build-editor.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(editor, /onPathChange|Směr rozboru|role="radio"/);
});
