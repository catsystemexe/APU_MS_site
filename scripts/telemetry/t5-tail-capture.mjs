import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, appendFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { T5_TRACE_PREFIX, validateTrace } from '../../app/telemetry/t5-trace.ts';
import { privatePath, restorePlan, T5 } from './t5-evidence.mjs';
const check = (ok, code) => { if (!ok) throw Error(code); };
// Bounded framing for Wrangler's pretty-printed JSON objects. Raw frames are never emitted or retained.
export function tailSanitizer(cohort, emit, ready = () => {}) {
  check(/^t5_[a-zA-Z0-9_-]{1,60}$/.test(cohort), 'BLOCKED_CAPTURE_COHORT');
  const decoder = new StringDecoder('utf8'); let buffer = '', depth = 0, quoted = false, escaped = false, bytes = 0;
  const status = { records: 0, invalid: 0, malformed: 0, overflow: false, ready: false };
  function frame(text) {
    try {
      const event = JSON.parse(text);
      if (event.scriptName !== undefined && event.scriptName !== T5.worker) { status.invalid++; return; }
      if (event.scriptName === T5.worker && event.outcome === 'ok' && event.event?.request?.method === 'GET' && event.event?.request?.url === 'https://apu-ms-site-dev.catsystem-exe.workers.dev/api/session' && event.event?.response?.status === 200 && !status.ready) { status.ready = true; ready(); }
      if (!Array.isArray(event.logs)) return;
      for (const entry of event.logs) {
        const messages = entry?.message;
        if (!Array.isArray(messages) || !messages.some(m => typeof m === 'string' && m.startsWith(T5_TRACE_PREFIX))) continue;
        if (messages.length !== 1 || typeof messages[0] !== 'string' || messages[0].length > 8192) { status.invalid++; continue; }
        let record; try { record = JSON.parse(messages[0].slice(T5_TRACE_PREFIX.length)); } catch { status.invalid++; continue; }
        if (!validateTrace(record)) { status.invalid++; continue; }
        if (record.cohort_id !== cohort) continue;
        emit(JSON.stringify(record) + '\n'); status.records++;
      }
    } catch { status.malformed++; }
  }
  function text(chunk) {
    for (const c of chunk) {
      if (!depth) { if (c.trim() && c !== '{') status.malformed++; if (c === '{') { buffer = '{'; depth = 1; quoted = false; escaped = false; } continue; }
      buffer += c;
      if (buffer.length > 1048576) { status.overflow = true; buffer = ''; depth = 0; return; }
      if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; }
      else if (c === '"') quoted = true;
      else if (c === '{' || c === '[') depth++;
      else if (c === '}' || c === ']') { depth--; if (!depth) { frame(buffer); buffer = ''; } }
    }
  }
  return {
    push(chunk) { bytes += Buffer.byteLength(chunk); if (bytes > 8388608) { status.overflow = true; return; } text(typeof chunk === 'string' ? chunk : decoder.write(chunk)); },
    state() { return {...status}; },
    lost() { status.malformed++; },
    finish(cleanStop) { text(decoder.end()); return { ...status, status: cleanStop && status.records > 0 && !depth && !status.invalid && !status.malformed && !status.overflow ? 'closed' : 'NOT_VERIFIED' }; },
  };
}
export function traceEvidence(records, manifest, ui) {
  check(manifest?.kind === 'apu-t5-capture' && manifest.status === 'closed' && manifest.ready === true && manifest.records === records.length && !manifest.invalid && !manifest.malformed && !manifest.overflow, 'BLOCKED_CAPTURE_LOSS');
  const cohort = manifest.cohort;
  check(records.every(r => validateTrace(r) && r.cohort_id === cohort), 'FAIL_CAPTURE_SCHEMA');
  const ids = [...new Set(records.map(r => r.call_id))], calls = [], lifecycle = [];
  check(ids.length >= 3 && ids.length <= 5, 'FAIL_PROVIDER_COUNT');
  for (const id of ids) {
    const events = records.filter(r => r.call_id === id), invokes = events.filter(r => r.stage === 'invoke'), responses = events.filter(r => r.stage === 'response');
    check(invokes.length === 1 && responses.length === 1 && !events.some(r => r.stage === 'transport_error'), 'BLOCKED_CAPTURE_PAIR');
    const invoke = invokes[0], response = responses[0];
    check(invoke.time_ms <= response.time_ms && invoke.operation === response.operation && invoke.attempt_index === response.attempt_index && response.usage_valid && response.usage && response.http_status === 200, 'FAIL_RAW_PROVIDER_RESPONSE');
    calls.push({ call_id: id, operation: response.operation, attempt_index:response.attempt_index, service_tier:response.service_tier, model: response.model, provider_status: response.provider_status, usage: response.usage, file_search_calls: response.file_search_calls });
    for (const ack of events.filter(r => r.stage === 'write_ack')) lifecycle.push({ call_id: id, state: ack.state, observed_at: ack.time_ms, source: 'd1-write-ack' });
  }
  return { provider_basis: 'response-boundary-trace-v1', cohort, ui_accepted: ui.ui_accepted === true, browser_paths: ui.browser_paths, lifecycle_observations: lifecycle, calls };
}
export async function capture(cli, config, directory, repo, cohort, duration, spawnProcess = spawn) {
  check(Number.isSafeInteger(duration) && duration >= 1000 && duration <= 600000, 'BLOCKED_CAPTURE_DURATION');
  restorePlan(config, repo); privatePath(directory, repo, true);
  check(realpathSync(cli) === resolve(cli) && createHash('sha256').update(readFileSync(cli)).digest('hex') === '71da1f9bcf69a9f56c4ff4f68e71315365d03db8ea11207577b47a8e1a0a1064', 'BLOCKED_WRANGLER_VERSION');
  const output = join(directory, 't5-provider-trace.jsonl'), sidecar = join(directory, 't5-provider-trace.capture.json');
  writeFileSync(sidecar, JSON.stringify({ kind: 'apu-t5-capture', cohort, status: 'NOT_VERIFIED', records: 0 }) + '\n', { flag: 'wx', mode: 0o600 });
  writeFileSync(output, '', { flag: 'wx', mode: 0o600 });
  const readyPath = join(directory,'t5-provider-trace.ready.json');
  const started=Date.now(), deadline=started+duration;
  const sanitizer = tailSanitizer(cohort, text => appendFileSync(output, text), () => writeFileSync(readyPath, JSON.stringify({kind:'apu-t5-capture-ready',cohort,observed_at:Date.now(),source:'GET_session_tail_event'})+'\n',{flag:'wx',mode:0o600}));
  const progress=()=>{const st=sanitizer.state();writeFileSync(sidecar,JSON.stringify({kind:'apu-t5-capture',cohort,...st,status:'CAPTURING_NOT_VERIFIED',capturing:true,deadline})+'\n',{mode:0o600});};
  progress();
  return await new Promise(resolveDone => {
    let closing = false, settled = false, timer, grace;
    const child = spawnProcess(process.execPath, [cli, 'tail', T5.worker, '--config', config, '--format', 'json', '--sampling-rate', '1'], { cwd: dirname(config), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const stop = () => { closing = true; child.kill('SIGTERM'); grace = setTimeout(() => child.kill('SIGKILL'), 500); };
    const done = clean => {
      if (settled) return; settled = true; clearTimeout(timer); clearTimeout(grace); process.removeListener('SIGINT', stop);
      const summary = { kind: 'apu-t5-capture', cohort, ...sanitizer.finish(clean), capturing:false, deadline, sha256: createHash('sha256').update(readFileSync(output)).digest('hex') };
      if(!summary.ready) summary.status='NOT_VERIFIED';
      writeFileSync(sidecar, JSON.stringify(summary) + '\n', { mode: 0o600 }); resolveDone(summary);
    };
    child.stdout.on('data', chunk => { try { sanitizer.push(chunk); progress(); } catch { child.kill('SIGKILL'); done(false); } });
    // Warnings include reconnect notices. Never print/store raw stderr, and never certify a potentially lost stream.
    child.stderr.on('data', () => {sanitizer.lost();progress();});
    child.once('error', () => done(false)); child.once('close', () => done(closing));
    timer = setTimeout(stop, duration); process.once('SIGINT', stop);
  });
}
export function captureReady(manifest,cohort,now=Date.now()) {
  check(manifest.kind === 'apu-t5-capture' && manifest.cohort === cohort && manifest.capturing === true && manifest.ready === true && !manifest.invalid && !manifest.malformed && !manifest.overflow && Number.isSafeInteger(manifest.deadline) && manifest.deadline-now >= 180000,'BLOCKED_CAPTURE_NOT_READY');
  return {status:'CAPTURE_READY_FOR_SINGLE_AUTHORIZED_ATTEMPT_NOT_ACCEPTANCE_PASS'};
}
async function main(a) {
  if(a[0] === '--ready' && a.length === 4) {privatePath(a[1],a[3]);console.log(JSON.stringify(captureReady(JSON.parse(readFileSync(a[1])),a[2])));return;}
  if (a[0] === '--execute-authorized' && a.length === 7) {
    // Local CLI flags only; no provider credentials read or changed.
    process.env.CI = 'true'; process.env.WRANGLER_WRITE_LOGS = 'false'; process.env.WRANGLER_SEND_METRICS = 'false';
    const summary = await capture(a[1], a[2], a[3], a[4], a[5], Number(a[6]));
    console.log(JSON.stringify({ status: summary.status, records: summary.records })); if (summary.status !== 'closed') process.exitCode = 2; return;
  }
  if (a[0] === '--evidence' && a.length === 6) {
    for (const file of [a[1], a[2], a[3]]) privatePath(file, a[5]);
    const raw = readFileSync(a[1]); const manifest = JSON.parse(readFileSync(a[2], 'utf8'));
    check(manifest.sha256 === createHash('sha256').update(raw).digest('hex'), 'FAIL_CAPTURE_HASH');
    const evidence = traceEvidence(raw.toString('utf8').trim().split('\n').filter(Boolean).map(s => JSON.parse(s)), manifest, JSON.parse(readFileSync(a[3], 'utf8')));
    privatePath(dirname(a[4]), a[5], true); writeFileSync(a[4], JSON.stringify(evidence), { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ status: 'EVIDENCE_DERIVED_NOT_ACCEPTANCE_PASS', calls: evidence.calls.length })); return;
  }
  throw Error('BLOCKED_CAPTURE_ARGUMENTS');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(process.argv.slice(2)); } catch (e) { console.error(/^(FAIL|BLOCKED)_[A-Z_]+$/.test(e.message) ? e.message : 'BLOCKED_CAPTURE'); process.exitCode = 1; }
}
