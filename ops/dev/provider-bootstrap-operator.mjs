// Local setup + explicitly authorized read-only orchestration. No secret values, PATCH or deploy capability.
import {readFileSync,writeFileSync,existsSync,realpathSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {DEV,buildDevConfig} from './prepare-worker.mjs';
import {privatePath,restorePlan} from '../../scripts/telemetry/t5-evidence.mjs';
import {parseInventory,preflight,verify} from './provider-bootstrap.mjs';
const check=(ok,code)=>{if(!ok)throw Error(code);};
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const pin='71da1f9bcf69a9f56c4ff4f68e71315365d03db8ea11207577b47a8e1a0a1064';
export function sourceCheck(repo,sha) {
  check(/^[a-f0-9]{40}$/.test(sha)&&realpathSync(repo)===resolve(repo),'BLOCKED_SOURCE');
  const git=args=>execFileSync('git',['-C',repo,...args],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
  check(git(['rev-parse','HEAD'])===sha&&realpathSync(git(['rev-parse','--show-toplevel']))===repo&&!git(['status','--porcelain','--untracked-files=no']),'BLOCKED_SOURCE');
  check(['https://github.com/catsystemexe/APU_MS_site.git','git@github.com:catsystemexe/APU_MS_site.git'].includes(git(['remote','get-url','origin'])),'BLOCKED_REPOSITORY');
}
export function setup(repo,sha,inputs,target,dir,checkSource=sourceCheck) {
  checkSource(repo,sha);privatePath(inputs,repo);privatePath(target,repo);privatePath(dir,repo,true);restorePlan(target,repo);
  const cli=realpathSync(join(repo,'node_modules/wrangler/wrangler-dist/cli.js')),artifact=join(repo,'dist/server/wrangler.json');
  check(hash(cli)===pin,'BLOCKED_PINNED_CLI');
  const i=read(inputs);check(i.telemetry?.enabled===false&&i.telemetry.staged===true&&i.pilotRules?.ttlSeconds===86400,'BLOCKED_OFF_INPUTS');
  buildDevConfig(read(join(repo,'wrangler.dev.json')),read(artifact),i);
  check(['before-raw.json','before.json','after-raw.json','after.json'].every(f=>!existsSync(join(dir,f))),'BLOCKED_OUTPUT_EXISTS');
  const profile={kind:'apu-provider-bootstrap-local-profile',repo,sha,inputs,target,dir,cli,node:realpathSync(process.execPath),node_version:process.version,hashes:{inputs:hash(inputs),target:hash(target),cli:hash(cli),artifact:hash(artifact)}};
  const out=join(dir,'bootstrap-local-profile.json');writeFileSync(out,JSON.stringify(profile)+'\n',{flag:'wx',mode:0o600});return out;
}
export function loadProfile(path,repo,sha,checkSource=sourceCheck) {
  checkSource(repo,sha);privatePath(path,repo);const p=read(path);
  check(p.kind==='apu-provider-bootstrap-local-profile'&&p.repo===repo&&p.sha===sha&&p.node===realpathSync(process.execPath)&&p.node_version===process.version,'BLOCKED_PROFILE_IDENTITY');
  for(const f of [p.inputs,p.target])privatePath(f,repo);privatePath(p.dir,repo,true);restorePlan(p.target,repo);
  check(p.cli===realpathSync(join(repo,'node_modules/wrangler/wrangler-dist/cli.js'))&&hash(p.cli)===pin&&p.hashes.cli===pin&&hash(p.inputs)===p.hashes.inputs&&hash(p.target)===p.hashes.target&&hash(join(repo,'dist/server/wrangler.json'))===p.hashes.artifact,'BLOCKED_PROFILE_CHANGED');
  return p;
}
export function readPhase(path,repo,sha,mode,version,runner=spawnSync,checkSource=sourceCheck) {
  const p=loadProfile(path,repo,sha,checkSource);check(['before','after'].includes(mode),'BLOCKED_PHASE');
  check(mode==='before'||typeof version==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(version),'BLOCKED_EXPECTED_VERSION');
  const raw=join(p.dir,mode+'-raw.json'),out=join(p.dir,mode+'.json');check(!existsSync(raw)&&!existsSync(out),'BLOCKED_OUTPUT_EXISTS');
  const env={...process.env,CI:'true',WRANGLER_WRITE_LOGS:'false',WRANGLER_SEND_METRICS:'false'};
  const run=(args,timeout)=>{const r=runner(process.execPath,args,{cwd:repo,env,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout,killSignal:'SIGKILL',maxBuffer:1048576,windowsHide:true});check(!r.error&&r.status===0,'BLOCKED_READ_PROCESS');return r.stdout;};
  run([join(repo,'ops/dev/t5-baseline.mjs'),'--execute-authorized-read',p.target,p.inputs,raw,repo,p.cli,...(mode==='after'?[version]:[])],90000);
  // Parse the COMPLETE stdout once in Node. No PowerShell pipeline or raw output forwarding.
  const rows=parseInventory(run([p.cli,'secret','list','--format','json','--name',DEV.worker,'--config',p.target],10000));
  const record={...read(raw),inventory:rows,inventory_read_at:Date.now()};
  writeFileSync(out,JSON.stringify(record)+'\n',{flag:'wx',mode:0o600});
  const inputs=read(p.inputs),template=read(join(repo,'wrangler.dev.json')),artifact=read(join(repo,'dist/server/wrangler.json'));
  return mode==='before'?preflight(record,inputs,template,artifact):verify(read(join(p.dir,'before.json')),record,inputs,template,artifact);
}
async function main(a) {
  if(a[0]==='setup'&&a.length===6){const path=setup(...a.slice(1));console.log(JSON.stringify({status:'LOCAL_SETUP_ONLY',profile:path}));return;}
  check(['read-before','read-after'].includes(a[0])&&a.length===(a[0]==='read-before'?4:5),'BLOCKED_ARGUMENTS');
  console.log(JSON.stringify(readPhase(a[1],a[2],a[3],a[0]==='read-before'?'before':'after',a[4])));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{await main(process.argv.slice(2));}catch(e){console.error(/^BLOCKED_[A-Z0-9_]+$/.test(e.message)?e.message:'BLOCKED_OPERATOR_READ');process.exitCode=1;}}
