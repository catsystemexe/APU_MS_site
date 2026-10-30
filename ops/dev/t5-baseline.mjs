// Future authorized READ ONLY preflight. Fixed DEV endpoints; no provider client or mutation method.
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual as same } from 'node:util';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { DEV, validateDevInputs } from './prepare-worker.mjs';
import { activeVersion } from './prepare-t5-worker.mjs';
import { privatePath, T5 } from '../../scripts/telemetry/t5-evidence.mjs';
const check = (ok, code) => { if(!ok) throw Error(code); };
const select = (v, keys) => Object.fromEntries(keys.filter(k => v?.[k] !== undefined).map(k => [k,v[k]]));
export async function collectBaseline(get, inputs, expected = T5.baseline) {
  validateDevInputs(inputs); check(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(expected), 'BLOCKED_EXPECTED_VERSION');
  const script=`/accounts/${DEV.account}/workers/scripts/${DEV.worker}`, service=`/accounts/${DEV.account}/workers/services/${DEV.worker}/environments/production`;
  const before=await get(script+'/deployments'); check(activeVersion(before.deployments) === expected, 'BLOCKED_ACTIVE_VERSION');
  const version=await get(script+'/versions/'+T5.baseline), current=expected === T5.baseline ? version : await get(script+'/versions/'+expected);
  const [catalog, environment, subdomain, routes, domains, schedules, assetsVersion, d1] = await Promise.all([
    get(script+'/versions'),get(service),get(service+'/subdomain'),get(service+'/routes?show_zonename=true'),
    get(`/accounts/${DEV.account}/workers/domains/records?page=0&per_page=100&service=${DEV.worker}&environment=production`),get(script+'/schedules'),
    get(`/accounts/${DEV.account}/workers/workers/${DEV.worker}/versions/${T5.baseline}`),get(`/accounts/${DEV.account}/d1/database/${inputs.telemetry.databaseId}`),
  ]);
  check(Array.isArray(catalog.items) && /^[a-f0-9-]{36}$/.test(catalog.items[0]?.id), 'BLOCKED_VERSION_CATALOG');
  const latest=await get(script+'/versions/'+catalog.items[0].id), after=await get(script+'/deployments'), catalogAfter=await get(script+'/versions');
  const [latestAfter,environmentAfter]=await Promise.all([get(script+'/versions/'+catalog.items[0].id),get(service)]);
  check(latest.id === catalog.items[0].id && same(before.deployments,after.deployments) && same(latest,latestAfter) && same(environment.script,environmentAfter.script) && activeVersion(after.deployments) === expected && catalogAfter.items?.[0]?.id === catalog.items[0].id && environment.script?.etag === current.resources?.script?.etag, 'BLOCKED_PREFLIGHT_RACE');
  for(const v of [version,current,latest]) {
    check(Array.isArray(v.resources?.bindings), 'BLOCKED_VERSION_SHAPE');
    for(const b of v.resources.bindings.filter(b => b.type === 'secret_text')) check(Object.keys(b).every(k => ['name','type'].includes(k)), 'BLOCKED_SECRET_METADATA_SHAPE');
  }
  check(assetsVersion.assets?.config, 'BLOCKED_ASSET_READBACK');
  const currentAssets=expected === T5.baseline ? assetsVersion : await get(`/accounts/${DEV.account}/workers/workers/${DEV.worker}/versions/${expected}`);
  check(!environment.script.tags?.length && !environment.script.migration_tag, 'BLOCKED_UNSUPPORTED_SCRIPT_SETTINGS');
  const settings=select(environment.script,['observability','logpush','placement','tail_consumers','streaming_tail_consumers','limits','cache']);
  if(environment.script.placement_mode && !settings.placement) { check(['off','smart'].includes(environment.script.placement_mode),'BLOCKED_UNSUPPORTED_PLACEMENT'); settings.placement={mode:environment.script.placement_mode}; }
  if(environment.script.cache_options && !settings.cache) settings.cache=environment.script.cache_options;
  return {kind:'apu-t5-baseline',account_id:DEV.account,worker:DEV.worker,read_at:Date.now(),version,current,latest,deployments:after.deployments,
    settings,current_assets:currentAssets.assets?.config,
    subdomain,routes,domains,schedules:schedules.schedules,assets:assetsVersion.assets.config,d1:select(d1,['uuid','name','jurisdiction']),
  };
}
export async function authorizedRead(cli, config, inputs, getFetch = fetch, runner = spawnSync, expected = T5.baseline) {
  // Only the existing Cloudflare CLI authentication is consumed in memory. No OpenAI secret is read.
  validateDevInputs(inputs);
  check(createHash('sha256').update(readFileSync(cli)).digest('hex') === '71da1f9bcf69a9f56c4ff4f68e71315365d03db8ea11207577b47a8e1a0a1064', 'BLOCKED_WRANGLER_VERSION');
  check(JSON.stringify(JSON.parse(readFileSync(config))) === JSON.stringify({name:T5.worker,account_id:T5.account,send_metrics:false}), 'BLOCKED_READ_CONFIG');
  const tokenResult=runner(process.execPath,[cli,'auth','token','--json','--config',config],{encoding:'utf8',timeout:10000,killSignal:'SIGKILL',windowsHide:true,stdio:['ignore','pipe','ignore']});
  check(!tokenResult.error && tokenResult.status === 0, 'BLOCKED_EXISTING_CF_AUTH');
  let auth; try {auth=JSON.parse(tokenResult.stdout);} catch {throw Error('BLOCKED_EXISTING_CF_AUTH');}
  check(['oauth','api_token'].includes(auth.type) && typeof auth.token === 'string' && auth.token.length > 0, 'BLOCKED_UNSUPPORTED_CF_AUTH');
  const get=async path => {
    check(path.startsWith(`/accounts/${DEV.account}/`), 'BLOCKED_READ_TARGET');
    const response=await getFetch('https://api.cloudflare.com/client/v4'+path,{method:'GET',headers:{Authorization:'Bearer '+auth.token},signal:AbortSignal.timeout(10000)});
    check(response.ok,'BLOCKED_READ_HTTP'); const body=await response.json(); check(body.success === true,'BLOCKED_READ_API'); return body.result;
  };
  try {return await collectBaseline(get,inputs,expected);} finally {auth=undefined;}
}
async function main(a) {
  check(a[0] === '--execute-authorized-read' && (a.length === 6 || a.length === 7), 'BLOCKED_READ_ARGUMENTS');
  const [config,input,out,repo,cli,expected]=a.slice(1); for(const p of [config,input]) privatePath(p,repo); check(isAbsolute(out),'BLOCKED_READ_OUTPUT'); privatePath(resolve(out,'..'),repo,true);
  process.env.CI='true'; process.env.WRANGLER_WRITE_LOGS='false'; process.env.WRANGLER_SEND_METRICS='false';
  const result=await authorizedRead(realpathSync(cli),config,JSON.parse(readFileSync(input,'utf8')),fetch,spawnSync,expected ?? T5.baseline);
  writeFileSync(out,JSON.stringify(result)+'\n',{flag:'wx',mode:0o600}); console.log(JSON.stringify({status:'DEV_METADATA_READ_NO_PROVIDER_TEST'}));
}
if(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {try{await main(process.argv.slice(2));}catch(e){console.error(/^BLOCKED_[A-Z_]+$/.test(e.message)?e.message:'BLOCKED_BASELINE_READ');process.exitCode=1;}}
