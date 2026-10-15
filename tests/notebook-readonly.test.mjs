import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { EMPTY_NOTEPAD } from "../app/notepad-model.ts";
const require = createRequire(import.meta.url);
const hooks = `data:text/javascript;base64,${Buffer.from('export function useState(value){return [typeof value === "function" ? value() : value,()=>{}]};export function useEffect(){};export function useCallback(value){return value};export function useRef(value){return {current:value}}').toString('base64')}`;
const source = (await readFile(new URL("../app/notepad.tsx", import.meta.url), "utf8")) + '\nexport { NotepadPanel };';
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  .replace(/import \{ F3Finalization \} from "\.\/f3-finalization";/, 'const F3Finalization=()=>null;')
  .replace(/from "react"/g, `from ${JSON.stringify(hooks)}`)
  .replace(/from "(react\/jsx-runtime|lucide-react)"/g, (_,name)=>`from ${JSON.stringify(pathToFileURL(require.resolve(name)).href)}`)
  .replace(/from "(\.\/[^";]+)"/g, (_,name)=>`from ${JSON.stringify(new URL(`../app/${name.slice(2)}.ts`,import.meta.url).href)}`);
const { NotepadPanel } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const descendants = node => !node || typeof node !== 'object' ? [] : [node,...[node.props?.children].flat(Infinity).flatMap(descendants)];
const entries = structuredClone(EMPTY_NOTEPAD);
entries.context=[{id:'context1',text:'Původní informace.\nDruhý řádek.',origin:'extracted',source:{messageId:'m1',quote:'Původní informace.',start:0,end:18}}];
entries.goals=[{id:'goal1',text:'Původní potřeba.',origin:'manual'}];

test("retrospective source view retains wording/order/provenance with no editable controls", () => {
  let changes=0;
  const before=JSON.stringify(entries);
  const tree=NotepadPanel({entries,readOnly:true,onEntriesChange:()=>changes++,onEntryNavigate:()=>{},onEntrySeen:()=>{}});
  const html=renderToStaticMarkup(tree);
  assert.doesNotMatch(html, /<textarea|add-notepad-item|Přidat položku/);
  assert.match(html, /Zápisník je zdrojem aktuální analýzy/);
  assert.match(html, /Původní informace\.\nDruhý řádek\./);
  assert.match(html, /Přejít ke zdrojové větě v chatu/);
  assert.ok(html.indexOf('Původní potřeba.')<html.indexOf('Původní informace.'));
  const items=descendants(tree).filter(node=>node.type?.name==='ItemEditor');
  for(const item of items){item.props.onChange('Attempted mutation');item.props.onRemove();}
  assert.equal(changes,0,'callbacks must enforce read-only, not just CSS');
  assert.equal(JSON.stringify(entries),before);
});

test("F1 source UI retains existing add/edit behavior before baseline acceptance", () => {
  const changes=[];
  const tree=NotepadPanel({entries,onEntriesChange:value=>changes.push(value),onEntryNavigate:()=>{},onEntrySeen:()=>{}});
  assert.match(renderToStaticMarkup(tree), /<textarea/);
  assert.equal(descendants(tree).filter(node=>node.props?.className==='add-notepad-item').length,5);
  const item=descendants(tree).find(node=>node.type?.name==='ItemEditor' && node.props.entry.id==='context1');
  item.props.onChange('Manual change');
  assert.equal(changes[0].context[0].text,'Manual change');
  assert.equal(changes[0].context[0].origin,'manual');
});
