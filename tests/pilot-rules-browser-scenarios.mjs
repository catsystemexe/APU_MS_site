import assert from "node:assert/strict";

// Synthetic in-browser identity/store/provider fixtures only; no hosted requests.
export async function runPilotRulesScenarios({call,evaluate,waitFor,capture}) {
  const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const check=()=>click('.pilot-rules-checkbox input');
  const proceed=()=>click('.pilot-rules-actions button:first-child');
  const active=()=>waitFor('!document.querySelector(".pilot-rules-dialog")&&document.querySelector(".chat-card").getBoundingClientRect().width>0');
  const required=()=>waitFor('document.querySelector(".pilot-rules-checkbox input")&&!document.querySelector(".pilot-rules-checkbox input").disabled');
  const reopen=()=>evaluate(`window.dispatchEvent(new Event('apu:pilot-rules-required'))`);
  const key=async(name,code,shift=false)=>{await call('Input.dispatchKeyEvent',{type:'keyDown',key:name,code:name,windowsVirtualKeyCode:code,modifiers:shift?8:0});await call('Input.dispatchKeyEvent',{type:'keyUp',key:name,code:name,windowsVirtualKeyCode:code});};

  await evaluate('window.rules.enforceFirstEntry=true;window.rules.receipts.clear()');await reopen();await required();
  assert.equal(await evaluate('document.querySelector(".pilot-rules-checkbox input").checked'),false);
  assert.equal(await evaluate('document.querySelector(".pilot-rules-actions button:first-child").disabled'),true);
  assert.equal(await evaluate('document.querySelector(".chat-card").getBoundingClientRect().width'),0);
  assert.equal(await evaluate('window.calls.filter(c=>c.url!=="/api/chat").length'),0);
  assert.match(await evaluate('document.querySelector(".pilot-rules-dialog").innerText'),/skutečnou situaci.*vynech identitu/);
  assert.match(await evaluate('document.querySelector(".pilot-rules-dialog").innerText'),/skutečné ani modelové/);
  assert.match(await evaluate('document.querySelector(".pilot-rules-dialog").innerText'),/není souhlasem za dítě/);
  await key('Escape',27);assert.equal(await evaluate('Boolean(document.querySelector(".pilot-rules-dialog"))'),true);
  await evaluate('document.querySelector(".pilot-rules-dialog").focus()');await key('Tab',9);
  assert.equal(await evaluate('document.activeElement.tagName'),'SUMMARY');
  await key('Tab',9,true);assert.equal(await evaluate('document.activeElement.textContent'),'Odhlásit se');
  await key('Tab',9);assert.equal(await evaluate('document.activeElement.tagName'),'SUMMARY');
  await capture('pilot-rules-desktop');
  for (const width of [390,320]) {
    await call('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
    assert.equal(await evaluate('(()=>{const el=document.querySelector(".pilot-rules-dialog"),r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&el.scrollWidth<=el.clientWidth+1})()'),true);
    await capture(`pilot-rules-${width}`);
  }
  await call('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
  await evaluate('localStorage.setItem("forged-pilot-acceptance","true")');await reopen();await required();
  assert.equal(await evaluate('document.querySelector(".pilot-rules-actions button:first-child").disabled'),true);

  await check();await evaluate('window.rules.failPost=true');await proceed();
  await waitFor('document.querySelector(".pilot-rules-error")');
  assert.match(await evaluate('document.querySelector(".pilot-rules-error").textContent'),/nepodařilo uložit/);
  assert.equal(await evaluate('document.querySelector(".chat-card").getBoundingClientRect().width'),0);
  await evaluate('window.rules.failPost=false;window.rules.deferNextPost=true;window.rules.lag=true');
  const before=await evaluate('window.rules.calls.filter(c=>c.method==="POST").length');
  await proceed();await waitFor('window.rules.pending.length===1');await proceed();
  assert.equal(await evaluate('window.rules.calls.filter(c=>c.method==="POST").length'),before+1);
  await evaluate('window.rules.pending.shift()()');
  await waitFor('document.querySelector(".pilot-rules-dialog").innerText.includes("Potvrzení bylo uloženo")');
  assert.equal(await evaluate('document.querySelector(".chat-card").getBoundingClientRect().width'),0);
  await evaluate('window.rules.lag=false;[...document.querySelectorAll(".pilot-rules-actions button")].find(b=>b.textContent==="Ověřit znovu").click()');await active();
  const post=await evaluate('window.rules.calls.filter(c=>c.method==="POST").at(-1).body');
  assert.deepEqual(Object.keys(post).sort(),['accepted','informationVersion','rulesVersion']);
  // Combined feature check: accepted UI continues across two turns using explicit
  // last-question state, never the provider response ID returned by the fixture.
  await evaluate('window.overrideChatActions=[{type:"MAIN",target:"teacher_need",question:"Co potřebuješ pedagogicky vyřešit?",required:true,options:[]}]');
  const chatsBefore=await evaluate('window.calls.filter(c=>c.url==="/api/chat").length');
  for (const [index,text] of ["Syntetické pozorování pro test integrace.","Potřebuji porozumět situaci."].entries()) {
    await evaluate(`(()=>{const el=document.querySelector('#message');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,${JSON.stringify(text)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await click('.send-button');
    await waitFor(`window.calls.filter(c=>c.url==="/api/chat").length===${chatsBefore+index+1}`);
    await waitFor(`!document.querySelector('[aria-label="Nový projekt"]').disabled`);
  }
  const chatBody=await evaluate('window.calls.filter(c=>c.url==="/api/chat").at(-1).body');
  const extractBody=await evaluate('window.calls.filter(c=>c.url==="/api/extract").at(-1).body');
  assert.deepEqual(chatBody.dialogContext,{lastQuestions:["Co potřebuješ pedagogicky vyřešit?"]});
  assert.deepEqual(extractBody.dialogContext,chatBody.dialogContext);
  assert.equal(chatBody.previousResponseId,undefined);
  assert.equal(chatBody.messages,undefined);
  assert.equal(chatBody.message,"Potřebuji porozumět situaci.");
  await evaluate('delete window.overrideChatActions');
  await evaluate('window.confirm=()=>true');await click('[aria-label="Nový projekt"]');await active();
  await click('[aria-label="Otevřít nastavení"]');
  await waitFor('document.querySelector(".diagnostics-drawer.is-open .pilot-rules-information")');
  assert.match(await evaluate('document.querySelector(".pilot-rules-receipt").textContent'),/Přijatá verze: pilot-rules/);
  await click('.pilot-rules-settings > summary');
  await evaluate('document.querySelector(".diagnostics-drawer-content").scrollTop=0');
  assert.equal(await evaluate('document.querySelector(".pilot-rules-settings").open'),true);
  await capture('pilot-rules-settings');await click('[aria-label="Zavřít nastavení"]');

  await evaluate('window.rules.versionOverride="new-required-version"');await reopen();
  await waitFor('document.querySelector(".pilot-rules-dialog").innerText.includes("Pravidla se změnila")');
  assert.equal(await evaluate('document.querySelector(".pilot-rules-actions button:first-child").disabled'),true);
  await evaluate('delete window.rules.versionOverride');await reopen();await active();

  // Both unavailable storage and backend 428 lock an already active UI again.
  await evaluate('window.rules.failGet=true');await reopen();await waitFor('document.querySelector(".pilot-rules-error")');
  assert.equal(await evaluate('document.querySelector(".chat-card").getBoundingClientRect().width'),0);
  await evaluate('window.rules.failGet=false;[...document.querySelectorAll(".pilot-rules-actions button")].find(b=>b.textContent==="Ověřit znovu").click()');await active();
  await evaluate('window.rules.receipts.clear();window.rules.forceRequired=true;window.fixtureRulesFetch("/api/extract",{method:"POST"}).then(()=>{window.rules.forceRequired=false})');await required();

  // Late receipt for the old identity cannot unlock the newly mounted account.
  await evaluate('window.rules.deferNextPost=true');await check();await proceed();await waitFor('window.rules.pending.length===1');
  await evaluate('window.sessionRevalidation={email:"next@example.invalid",isDeveloper:false};window.rerenderFixture(window.sessionRevalidation)');await required();
  await evaluate('window.rules.pending.shift()()');
  await evaluate('new Promise(resolve=>setTimeout(resolve,80))');
  assert.equal(await evaluate('document.querySelector(".chat-card").getBoundingClientRect().width'),0);
  assert.equal(await evaluate('document.querySelector(".pilot-rules-checkbox input").checked'),false);
  // GET resolution has the same unmount/generation protection.
  await evaluate('window.rules.receipts.set(window.sessionRevalidation.email,[...window.rules.receipts.values()][0]);window.rules.deferNextGet=true');await reopen();await waitFor('window.rules.pending.length===1');
  await evaluate('window.sessionRevalidation={email:"third@example.invalid",isDeveloper:false};window.rerenderFixture(window.sessionRevalidation)');await required();
  await evaluate('window.rules.pending.shift()()');
  assert.equal(await evaluate('document.querySelector(".chat-card").getBoundingClientRect().width'),0);
  await evaluate('[...document.querySelectorAll(".pilot-rules-actions button")].find(b=>b.textContent==="Odhlásit se").click()');
  await waitFor('document.querySelector("#mock-logout")');
  console.log('Pilot rules browser PASS: first entry, unchecked/disabled acknowledgement, focus/Escape, 390/320px bounds, save failure/retry/deduplication, delayed KV verification, New Project, two-turn stateless Chat after acknowledgement, settings receipt, unavailable store, API re-lock, stale account GET/POST, logout.');
}
