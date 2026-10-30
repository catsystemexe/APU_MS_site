// One fixed, explicitly authorized future GET. No login, retry or mutation.
import {readFileSync,openSync,writeFileSync,closeSync,realpathSync} from 'node:fs';
import {resolve,dirname,join,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {isDeepStrictEqual as same} from 'node:util';
import {DEV} from './prepare-worker.mjs';
import {sourceCheck} from './provider-bootstrap-operator.mjs';
import {privatePath,restorePlan} from '../../scripts/telemetry/t5-evidence.mjs';
const check=(ok,code)=>{if(!ok)throw Error(code);};
export const SETTINGS_ENDPOINT=`https://api.cloudflare.com/client/v4/accounts/${DEV.account}/workers/scripts/${DEV.worker}/script-settings`;
export const CLI_PIN='71da1f9bcf69a9f56c4ff4f68e71315365d03db8ea11207577b47a8e1a0a1064';
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const evidenceKeys=['kind','account_id','worker','endpoint','method','source_sha','cli_sha256','read_started_at','read_at','http_status','raw_body'];
function evidenceEnvelope(e,now=Date.now(),fresh=false){
 check(e&&same(Object.keys(e).sort(),[...evidenceKeys].sort())&&e.kind==='apu-dev-script-settings-read'&&e.account_id===DEV.account&&e.worker===DEV.worker&&e.endpoint===SETTINGS_ENDPOINT&&e.method==='GET'&&e.cli_sha256===CLI_PIN&&typeof e.source_sha==='string'&&/^[a-f0-9]{40}$/.test(e.source_sha),'BLOCKED_SCRIPT_SETTINGS_SOURCE');
 check(Number.isSafeInteger(e.read_started_at)&&Number.isSafeInteger(e.read_at)&&e.read_started_at>=0&&e.read_at>=e.read_started_at&&e.read_at-e.read_started_at<=10000&&e.read_at<=now+5000&&(!fresh||now-e.read_started_at<=60000),'BLOCKED_SCRIPT_SETTINGS_TIME');
}
export function scriptSettingsResult(e,now=Date.now(),fresh=false,allowNull=false){
 evidenceEnvelope(e,now,fresh);
 check(e.http_status===200&&typeof e.raw_body==='string','BLOCKED_SCRIPT_SETTINGS_RESPONSE');
 let body;try{body=JSON.parse(e.raw_body);}catch{throw Error('BLOCKED_SCRIPT_SETTINGS_RESPONSE');}
 check(body?.success===true&&body.result&&typeof body.result==='object'&&!Array.isArray(body.result),'BLOCKED_SCRIPT_SETTINGS_RESPONSE');
 const result=body.result;
 check((!Object.hasOwn(result,'logpush')||typeof result.logpush==='boolean')&&(!Object.hasOwn(result,'tail_consumers')||result.tail_consumers===null||Array.isArray(result.tail_consumers)),'BLOCKED_SCRIPT_SETTINGS_FIELDS');
 check(Object.keys(result).every(k=>['observability','logpush','tail_consumers','tags'].includes(k))&&(!Object.hasOwn(result,'tags')||result.tags===null||same(result.tags,[])),'BLOCKED_SCRIPT_SETTINGS_FIELDS');
 check((allowNull&&Object.hasOwn(result,'observability')&&result.observability===null)||(result.observability&&typeof result.observability==='object'&&!Array.isArray(result.observability)&&typeof result.observability.enabled==='boolean'),'BLOCKED_OBSERVABILITY_EVIDENCE_REQUIRED');
 return result;
}
export function effectiveSettings(raw,evidence,now=Date.now(),fresh=false,policy='preserve-explicit'){
 check(['preserve-explicit','declare-disabled'].includes(policy),'BLOCKED_OBSERVABILITY_POLICY');
 check(evidence,'BLOCKED_OBSERVABILITY_EVIDENCE_REQUIRED');const result=scriptSettingsResult(evidence,now,fresh,policy==='declare-disabled');
 for(const key of ['logpush','tail_consumers'])if(Object.hasOwn(raw,key))check(Object.hasOwn(result,key)&&same(raw[key],result[key]),'BLOCKED_SCRIPT_SETTINGS_CHANGED');
 if(raw.observability!=null)check(same(raw.observability,result.observability),'BLOCKED_SCRIPT_SETTINGS_CHANGED');
 if(policy==='declare-disabled'){check(result.observability===null&&raw.observability==null,'BLOCKED_OBSERVABILITY_POLICY_SOURCE');return {...raw,observability:{enabled:false}};}
 return {...raw,observability:result.observability};
}
export function settingsOrigin(e){evidenceEnvelope(e);return {kind:e.kind,endpoint:e.endpoint,method:e.method,source_sha:e.source_sha,read_started_at:e.read_started_at,read_at:e.read_at,sha256:createHash('sha256').update(JSON.stringify(e)).digest('hex')};}
export async function readScriptSettings(repo,sha,target,out,getFetch=fetch,runner=spawnSync,checkSource=sourceCheck,now=Date.now,allowNull=false){
 checkSource(repo,sha);restorePlan(target,repo);
 check(isAbsolute(out)&&resolve(out)===out,'BLOCKED_SETTINGS_OUTPUT');privatePath(dirname(out),repo,true);
 const cli=realpathSync(join(repo,'node_modules/wrangler/wrangler-dist/cli.js'));check(hash(cli)===CLI_PIN,'BLOCKED_WRANGLER_VERSION');
 // Reserve before authentication/network. Existing evidence/symlinks never overwritten.
 const fd=openSync(out,'wx',0o600);let auth;
 try{
  const r=runner(process.execPath,[cli,'auth','token','--json','--config',target],{cwd:repo,env:{...process.env,CI:'true',WRANGLER_WRITE_LOGS:'false',WRANGLER_SEND_METRICS:'false'},encoding:'utf8',timeout:10000,killSignal:'SIGKILL',maxBuffer:1048576,windowsHide:true,stdio:['ignore','pipe','ignore']});
  check(!r.error&&r.status===0,'BLOCKED_EXISTING_CF_AUTH');
  try{auth=JSON.parse(r.stdout);}catch{throw Error('BLOCKED_EXISTING_CF_AUTH');}
  check(['oauth','api_token'].includes(auth?.type)&&typeof auth.token==='string'&&auth.token.length>0,'BLOCKED_UNSUPPORTED_CF_AUTH');
  const started=now();
  const response=await getFetch(SETTINGS_ENDPOINT,{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+auth.token},signal:AbortSignal.timeout(10000)});
  const raw=await response.text(),ended=now();
  const evidence={kind:'apu-dev-script-settings-read',account_id:DEV.account,worker:DEV.worker,endpoint:SETTINGS_ENDPOINT,method:'GET',source_sha:sha,cli_sha256:CLI_PIN,read_started_at:started,read_at:ended,http_status:response.status,raw_body:raw};
  writeFileSync(fd,JSON.stringify(evidence)+'\n'); // Exact response text retained only in restricted evidence.
  const result=scriptSettingsResult(evidence,ended,false,allowNull);
  return {status:result.observability===null?'SCRIPT_SETTINGS_READ_NULL_NOT_DISABLED':'SCRIPT_SETTINGS_READ_EXPLICIT_OBSERVABILITY',checked_at:new Date(ended).toISOString(),evidence:out,explicit_observability_enabled_boolean:result.observability!==null};
 }finally{auth=undefined;closeSync(fd);}
}
export function profileReadPaths(profile,repo){
 privatePath(profile,repo);const p=JSON.parse(readFileSync(profile,'utf8'));
 check(p.kind==='apu-provider-bootstrap-local-profile'&&p.repo===repo&&typeof p.sha==='string'&&/^[a-f0-9]{40}$/.test(p.sha),'BLOCKED_PROFILE_IDENTITY');
 privatePath(p.dir,repo,true);restorePlan(p.target,repo);
 check(hash(p.target)===p.hashes?.target&&p.hashes.cli===CLI_PIN&&realpathSync(p.cli)===realpathSync(join(repo,'node_modules/wrangler/wrangler-dist/cli.js'))&&hash(p.cli)===CLI_PIN,'BLOCKED_PROFILE_CHANGED');
 return {target:p.target,out:join(p.dir,'script-settings-review.json')};
}
async function main(a){
 let out;try{
  check(['--execute-authorized-read','--execute-profile-read'].includes(a[0]),'BLOCKED_ARGUMENTS');
  const [mode,repo,sha,...rest]=a;sourceCheck(repo,sha);let target;
  const allowNull=rest.at(-1)==='--capture-null-observability';if(allowNull)rest.pop();
  if(mode==='--execute-profile-read'){check(rest.length===1,'BLOCKED_ARGUMENTS');({target,out}=profileReadPaths(rest[0],repo));}
  else{check(rest.length===2,'BLOCKED_ARGUMENTS');[target,out]=rest;}
  console.log(JSON.stringify(await readScriptSettings(repo,sha,target,out,fetch,spawnSync,sourceCheck,Date.now,allowNull)));
 }catch(e){let explicit=false;try{const v=JSON.parse(JSON.parse(readFileSync(out,'utf8')).raw_body)?.result?.observability;explicit=!!v&&typeof v==='object'&&!Array.isArray(v)&&typeof v.enabled==='boolean';}catch{}console.log(JSON.stringify({status:/^BLOCKED_[A-Z0-9_]+$/.test(e.message)?e.message:'BLOCKED_SCRIPT_SETTINGS_READ',checked_at:new Date().toISOString(),evidence:out??null,explicit_observability_enabled_boolean:explicit}));process.exitCode=1;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main(process.argv.slice(2));
