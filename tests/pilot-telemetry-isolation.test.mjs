import assert from 'node:assert/strict';
import test from 'node:test';
import { startHarness } from './helpers/telemetry-browser-server.mjs';

const routes = ['chat', 'extract', 'analysis', 'need-route', 'f2', 'f3'];
const snapshot = h => JSON.stringify(['telemetry_sessions', 'telemetry_events', 'telemetry_ai_calls'].map(table => h.db.rows(table)));

test('actual JWT/rules denials precede all telemetry DB access and provider work on every AI route', async t => {
  const h = await startHarness({ syntheticOnly: true, enabled: true });
  t.after(() => h.close());
  const token = await h.token();
  const context = await (await h.request('/api/telemetry/context', { token, body: { action: 'start', opt_in: true, notice_version: 'h1', tab_id: crypto.randomUUID() } })).json();
  assert.equal(context.code, 'ready');
  const headers = { 'x-apu-telemetry-context': context.context, 'x-apu-telemetry-workflow': crypto.randomUUID(), 'x-apu-telemetry-operation': crypto.randomUUID() };
  const original = new Map(h.rules.receipts), namespace = h.bindings.PILOT_RULES_ACCEPTANCE;
  const mutations = [
    ['Access missing', 401, () => {}, null],
    ['Access bad signature', 401, () => {}, await h.token({}, { badSignature: true })],
    ['not accepted', 428, () => h.rules.receipts.clear(), token],
    ['another account only', 428, () => h.rules.receipts.delete(original.keys().next().value), token],
    ['missing receipt KV', 503, () => delete h.bindings.PILOT_RULES_ACCEPTANCE, token],
    ['missing receipt TTL', 503, () => delete h.bindings.PILOT_RULES_RECEIPT_TTL_SECONDS, token],
    ['receipt KV unavailable', 503, () => h.rules.unavailable = true, token],
    ['expired receipt', 428, () => {
      for (const [key, raw] of h.rules.receipts) h.rules.receipts.set(key, JSON.stringify({ ...JSON.parse(raw), acceptedAt: new Date(h.now - 3600000).toISOString(), expiresAt: new Date(h.now - 1).toISOString() }));
    }, token],
  ];
  for (const [name, status, mutate, jwt] of mutations) await t.test(name, async () => {
    h.rules.receipts.clear(); for (const [key, raw] of original) h.rules.receipts.set(key, raw);
    h.bindings.PILOT_RULES_ACCEPTANCE = namespace; h.bindings.PILOT_RULES_RECEIPT_TTL_SECONDS = '3600'; h.rules.unavailable = false;
    mutate();
    const before = snapshot(h); let databaseAccess = 0;
    const database = h.bindings.TELEMETRY_DB;
    h.bindings.TELEMETRY_DB = { prepare() { databaseAccess++; throw Error('Denied request touched telemetry'); }, batch() { databaseAccess++; throw Error('Denied request wrote telemetry'); } };
    try {
      for (const route of routes) {
        const response = await h.request('/api/' + route, { token: jwt, headers, body: { message: 'SYNTHETIC_DENIED_BODY', notebook: [] } });
        assert.equal(response.status, status, route);
        assert.doesNotMatch(await response.text(), /model_usage|call_id|SYNTHETIC_DENIED_BODY/);
      }
      await h.drain();
      assert.equal(databaseAccess, 0);
      assert.equal(snapshot(h), before);
      assert.equal(h.providerCalls.length, 0);
      assert.equal(h.rules.writes.length, 0);
      assert.deepEqual(h.blocked, []);
    } finally { h.bindings.TELEMETRY_DB = database; }
  });
});
