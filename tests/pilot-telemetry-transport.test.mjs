import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { build } from 'esbuild';
import { createPilot } from '../app/telemetry/pilot.ts';
import { fetchWithPilot } from '../app/telemetry/fetch.ts';
import { PILOT_RULES_EVENT } from '../app/pilot-rules.ts';
import { compactNotepad, EMPTY_NOTEPAD } from '../app/notepad-model.ts';

// Bundle the real browser wrapper (its extensionless imports use bundler resolution).
const root = fileURLToPath(new URL('..', import.meta.url));
const bundled = await build({ stdin: { contents: "export {fetchPedagogical} from './app/pilot-rules-client.ts';", resolveDir: root, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const { fetchPedagogical } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const source = await readFile(new URL('../app/apu-client.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('apu-client.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const calls = [];
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'fetchWithPilot') calls.push(node);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.equal(calls.length, 8);
const expectedPaths = ['/api/need-route', '/api/f2', '/api/f2', '/api/f2', '/api/f3', '/api/analysis', '/api/chat', '/api/extract'];
function browser(t) {
  const window = new EventTarget(), previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'window', previous); else delete globalThis.window; });
  return window;
}
function scope(operation) {
  return { fetchWithPilot, fetch: fetchPedagogical, operation, extractionOperation: operation,
    routingInput: { needText: 'Synthetic need.' }, selectedModel: 'auto', buildRequest: { synthetic: 'build' }, request: { synthetic: 'components' }, snapshot: { synthetic: 'preview' }, renderRequest: { synthetic: 'render' },
    notebook: [], notepad: structuredClone(EMPTY_NOTEPAD), notepadForChat: structuredClone(EMPTY_NOTEPAD), compactNotepad,
    analysis: { hypotheses: [], needs: [], mode: 'entry', mainUncertainty: null }, selectedHypothesisId: null, activeNeedId: null,
    focusInstruction: '', skippedAnalysisQuestions: [], resolvedNeed: null, turnId: 'synthetic-turn', requestId: 'synthetic-request',
    rawText: 'Synthetic observation.', dialogContext: { lastQuestions: ['Synthetic question?'] }, communicationProfile: 'supportive', sourceMessageId: 'synthetic-message',
    phase: 'intake', askedRefinementTargets: [], pendingSide: null, functionalMapping: null, dialogEvent: null, controllerFastPathEligible: false, answersNeedQuestion: false, options: undefined };
}
for (const enabled of [false, true]) test(`eight actual client call sites compose real transports; telemetry ${enabled}`, async t => {
  const window = browser(t), telemetry = [];
  let notifications = 0;
  window.addEventListener(PILOT_RULES_EVENT, () => notifications++);
  const pilot = createPilot({ enabled, eligible: enabled, noticeVersion: 'synthetic-v1', fetcher: async (url, init) => {
    const body = JSON.parse(init.body); telemetry.push(url);
    if (body.action === 'stop') return Response.json({ code: 'stopped' });
    if (url.endsWith('/context')) return Response.json({ code: 'ready', context: 'synthetic-only', session_id: crypto.randomUUID(), tab_id: body.tab_id, server_anchor_ms: Date.now(), expires_at: Date.now() + 43200000, measurement_version: 'pilot-v1', metadata_enabled: false });
    return Response.json({ code: 'ready', acknowledged: body.events.map(e => e.event_id) });
  } });
  t.after(() => pilot.stop());
  if (enabled) assert.equal(await pilot.optIn(), true);
  let network = [], status = 200;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    network.push({ url, init });
    return Response.json({}, { status, ...(status === 503 ? { headers: { 'X-APU-Pilot-Rules': 'unavailable' } } : {}) });
  });
  for (const [index, call] of calls.entries()) for (const code of [200, 428, 503]) await t.test(`call ${index + 1} ${expectedPaths[index]} status ${code}`, async () => {
    assert.equal(call.arguments.length, 4);
    assert.equal(call.arguments[3].getText(ast), 'fetch');
    status = code; network = [];
    const operation = pilot.begin('main_chat');
    const expectedBody = runInNewContext(call.getText(ast), { ...scope(operation), fetchWithPilot: (...args) => args[2].body });
    const response = await runInNewContext(call.getText(ast), scope(operation));
    assert.equal(response.status, status);
    assert.equal(network.length, 1, 'one transport request, no retry');
    const { url, init } = network[0];
    assert.equal(url, expectedPaths[index]);
    assert.equal(init.headers['Content-Type'], 'application/json');
    assert.equal(init.body, expectedBody, 'transport preserves the actual call-site body');
    if (enabled) {
      assert.equal(init.headers['x-apu-telemetry-context'], 'synthetic-only');
      assert.match(init.headers['x-apu-telemetry-operation'], /^[0-9a-f-]{36}$/);
    } else {
      assert.equal(init.headers['x-apu-telemetry-context'], undefined);
    }
    operation.resolve('failed');
  });
  assert.equal(notifications, 16);
  if (!enabled) assert.deepEqual(telemetry, []);
});

test('composed transports preserve abort signal/errors and telemetry-header failure stays fail-open', async t => {
  const window = browser(t); let notifications = 0, count = 0;
  window.addEventListener(PILOT_RULES_EVENT, () => notifications++);
  const controller = new AbortController();
  const init = { method: 'POST', body: '{}', signal: controller.signal };
  t.mock.method(globalThis, 'fetch', async (url, actual) => {
    count++; assert.equal(url, '/api/chat'); assert.equal(actual.signal, controller.signal);
    if (actual.signal.aborted) throw actual.signal.reason;
    return Response.json({}, { status: 428 });
  });
  const failedContext = { headers: () => Promise.reject(Error('synthetic header failure')) };
  assert.equal((await fetchWithPilot(failedContext, '/api/chat', init, fetchPedagogical)).status, 428);
  controller.abort(new DOMException('Synthetic cancellation', 'AbortError'));
  await assert.rejects(fetchWithPilot({ headers: () => ({}) }, '/api/chat', init, fetchPedagogical), { name: 'AbortError' });
  assert.equal(count, 2); assert.equal(notifications, 1);
});
