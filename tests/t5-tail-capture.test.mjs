import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createT5Trace, T5_TRACE_PREFIX } from '../app/telemetry/t5-trace.ts';
import { tailSanitizer, traceEvidence, capture, captureReady } from '../scripts/telemetry/t5-tail-capture.mjs';
import { T5 } from '../scripts/telemetry/t5-evidence.mjs';
const cohort = 't5_capture';
const readyEvent = {scriptName:T5.worker,outcome:'ok',event:{request:{method:'GET',url:'https://apu-ms-site-dev.catsystem-exe.workers.dev/api/session'},response:{status:200}},logs:[]};
function fixture() {
  const messages = [], trace = createT5Trace(cohort, line => messages.push(line), () => 1000);
  for (const operation of ['extraction', 'need_routing', 'analysis']) {
    const id = crypto.randomUUID(), c = trace.call(id, operation, 0); trace.writeAck(id, 'pending'); c.invoke();
    c.response({ model: operation === 'extraction' ? 'gpt-5.6-luna' : 'gpt-5.6-terra', status: 'completed', service_tier: 'default', usage: { input_tokens: 100, output_tokens: 10, total_tokens: 110 }, output: [] }, 200); trace.writeAck(id, 'final');
  }
  return { messages, records: messages.map(s => JSON.parse(s.slice(T5_TRACE_PREFIX.length))) };
}
test('pretty JSON tail is sanitized inline, including arbitrary UTF-8 chunks; raw request metadata never escapes', () => {
  const f = fixture(), safe = [], s = tailSanitizer(cohort, text => safe.push(text));
  s.push(JSON.stringify(readyEvent));
  const raw = Buffer.from(JSON.stringify({ scriptName: T5.worker, event: { request: { headers: { Authorization: 'NEVER_JWT', email: 'catsystem.exe@gmail.com' }, body: 'NEVER_PROMPT_ž' } }, logs: f.messages.map(message => ({ message: [message] })) }, null, 2));
  for (let i = 0; i < raw.length; i += 7) s.push(raw.subarray(i, i + 7));
  const summary = s.finish(true); assert.equal(summary.status, 'closed'); assert.equal(summary.records, 12); assert.doesNotMatch(safe.join(''), /NEVER_|gmail|Authorization|headers|request/);
  const evidence = traceEvidence(safe.map(JSON.parse), { kind: 'apu-t5-capture', cohort, ...summary }, { ui_accepted: true, browser_paths: ['/api/extract', '/api/need-route', '/api/analysis'] });
  assert.equal(evidence.calls.length, 3); assert.equal(evidence.lifecycle_observations.length, 6); assert.equal(evidence.provider_basis, 'response-boundary-trace-v1');
});
test('unexpected trace fields, other workers and broken/truncated streams cannot produce verified capture', () => {
  for (const raw of [
    JSON.stringify({ logs: [{ message: [T5_TRACE_PREFIX + JSON.stringify({ ...fixture().records[0], prompt: 'NEVER_SECRET' })] }] }),
    JSON.stringify({ scriptName: 'apu-ms-site', logs: [{ message: [fixture().messages[0]] }] }),
    '{"logs":',
  ]) { const out = [], s = tailSanitizer(cohort, text => out.push(text)); s.push(raw); assert.equal(s.finish(true).status, 'NOT_VERIFIED'); assert.equal(out.length, 0); }
  const s = tailSanitizer(cohort, () => {}); s.push(JSON.stringify({ logs: [{ message: [fixture().messages[0]] }] })); assert.equal(s.finish(false).status, 'NOT_VERIFIED');
});
test('missing/duplicate transport pair and lost capture never become independent provider evidence', () => {
  const f = fixture(), manifest = { kind: 'apu-t5-capture', cohort, status: 'closed', ready:true, records: f.records.length, invalid: 0, malformed: 0, overflow: false };
  assert.throws(() => traceEvidence(f.records, { ...manifest, status: 'NOT_VERIFIED' }, {}), /BLOCKED_CAPTURE_LOSS/);
  const missing = f.records.filter((r, i) => i !== f.records.findIndex(v => v.stage === 'response'));
  assert.throws(() => traceEvidence(missing, { ...manifest, records: missing.length }, {}), /BLOCKED_CAPTURE_PAIR/);
  const duplicate = [...f.records, f.records.find(v => v.stage === 'response')];
  assert.throws(() => traceEvidence(duplicate, { ...manifest, records: duplicate.length }, {}), /BLOCKED_CAPTURE_PAIR/);
});
test('capture child is bounded and piped; early exit leaves a protected NOT VERIFIED manifest without raw data', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'apu-t5-tail-')), config = join(dir, 'target.json');
  writeFileSync(config, JSON.stringify({ name: T5.worker, account_id: T5.account, send_metrics: false }));
  const cli = realpathSync(fileURLToPath(new URL('../node_modules/wrangler/wrangler-dist/cli.js', import.meta.url)));
  try {
    const result = await capture(cli, config, dir, process.cwd(), cohort, 1000, (_file, args, options) => {
      assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']); assert.ok(args.includes(T5.worker)); assert.ok(args.includes('json'));
      const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = () => child.emit('close', 1);
      queueMicrotask(() => { child.stdout.write(JSON.stringify({ event: { headers: 'NEVER_CREDENTIAL' }, logs: [{ message: [fixture().messages[0]] }] })); child.emit('close', 1); }); return child;
    });
    assert.equal(result.status, 'NOT_VERIFIED'); assert.doesNotMatch(readFileSync(join(dir, 't5-provider-trace.jsonl'), 'utf8'), /NEVER_CREDENTIAL/);
    await assert.rejects(capture(cli, config, dir, process.cwd(), cohort, 1000, () => { throw Error('must not launch twice'); }), /EEXIST/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('bounded capture confirms readiness only from an observed DEV session event; reconnect warnings invalidate it', async () => {
  for (const warn of [false,true]) {
    const dir=mkdtempSync(join(tmpdir(),'apu-t5-ready-')), config=join(dir,'target.json');
    writeFileSync(config,JSON.stringify({name:T5.worker,account_id:T5.account,send_metrics:false}));
    const cli=realpathSync(fileURLToPath(new URL('../node_modules/wrangler/wrangler-dist/cli.js',import.meta.url)));
    try {
      const result=await capture(cli,config,dir,process.cwd(),cohort,1000,()=>{
        const child=new EventEmitter(); child.stdout=new PassThrough(); child.stderr=new PassThrough(); child.kill=()=>{child.emit('close',0);return true;};
        queueMicrotask(()=>{child.stdout.write(JSON.stringify(readyEvent));child.stdout.write(JSON.stringify({scriptName:T5.worker,logs:fixture().messages.map(message=>({message:[message]}))}));if(warn)child.stderr.write('NEVER_RAW_RECONNECT');}); return child;
      });
      assert.equal(result.ready,true); assert.equal(result.status,warn?'NOT_VERIFIED':'closed');
      assert.equal(JSON.parse(readFileSync(join(dir,'t5-provider-trace.ready.json'))).source,'GET_session_tail_event');
      assert.doesNotMatch(readFileSync(join(dir,'t5-provider-trace.jsonl'),'utf8'),/NEVER_RAW|session|request/);
    } finally {rmSync(dir,{recursive:true,force:true});}
  }
});

test('readiness check requires a live healthy capture with enough remaining time; it is never acceptance',()=>{
  const m={kind:'apu-t5-capture',cohort,capturing:true,ready:true,invalid:0,malformed:0,overflow:false,deadline:200000};
  assert.match(captureReady(m,cohort,1).status,/NOT_ACCEPTANCE_PASS/);
  for(const change of [{ready:false},{capturing:false},{malformed:1},{deadline:1000}])assert.throws(()=>captureReady({...m,...change},cohort,1),/NOT_READY/);
});
