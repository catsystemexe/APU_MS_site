import assert from "node:assert/strict";

// Imported by the existing actual-client Chromium fixture (--session-only).
// All identities, revalidation responses and the Access logout destination are
// synthetic. No hosted authentication or provider API is contacted.
export async function runSessionScenarios({ call, evaluate, waitFor, capture, artifactRoot }) {
  const origin = "http://127.0.0.1:4333";
  const a = { call, evaluate, waitFor };
  const url = (email, developer = false, fallback = false) => `${origin}/?session-test=1&email=${encodeURIComponent(email)}${developer ? "&developer=1" : ""}${fallback ? "&no-broadcast=1" : ""}`;
  const navigate = async (tab, email, developer = false, fallback = false) => {
    const old = await tab.evaluate("window.fixtureMountId");
    await tab.call("Page.navigate", { url: url(email, developer, fallback) });
    await tab.waitFor(`window.fixtureMountId!==${JSON.stringify(old)} && document.querySelector('#message') && !document.querySelector('#message').disabled && document.querySelector('.app-shell').getBoundingClientRect().width>0`);
  };
  const input = (tab, selector, value) => tab.evaluate(`(() => {const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const add = async (tab, text) => {
    await tab.evaluate(`document.querySelector('.notepad-category .add-notepad-item').click()`);
    await tab.waitFor("document.querySelector('.notepad-items textarea')");
    await input(tab, ".notepad-items textarea", text);
    await tab.waitFor(`window.fixtureReadNotebook()?.manifestations[0]?.text===${JSON.stringify(text)}`);
  };
  const empty = async tab => assert.equal(await tab.evaluate("document.querySelectorAll('.notepad-items textarea').length"), 0);
  const ended = async tab => {
    await tab.waitFor("document.querySelector('#session-title')?.textContent==='Relace byla ukončena' && !document.querySelector('.app-shell')");
    assert.equal(await tab.evaluate("document.querySelector('#message, .working-document, .session-export-trigger')"), null);
  };
  const triggerCheck = tab => tab.evaluate("window.dispatchEvent(new Event('focus'))");
  const active = tab => tab.waitFor("document.querySelector('.app-shell')?.getBoundingClientRect().width>0");
  const screenshot = async name => { await call("Page.bringToFront"); await capture("session-" + name); };

  await evaluate(`localStorage.setItem('apu-site:notepad-map:v2',JSON.stringify({manifestations:[{id:'legacy',text:'UNOWNED_LEGACY',origin:'manual'}],goals:[],context:[],course:[],helps:[]}));localStorage.setItem('apu-site:notepad-map:v1','{"manifestations":["UNOWNED_V1"]}');localStorage.setItem('apu.session-test-preference','keep');`);
  const legacy = await evaluate("[localStorage.getItem('apu-site:notepad-map:v1'),localStorage.getItem('apu-site:notepad-map:v2')]");
  await navigate(a, "user-a@example.invalid"); await empty(a);
  await add(a, "A_PRIVATE_NOTEBOOK");
  const aKey = await evaluate("window.fixtureStorageKey");
  assert.equal(await evaluate(`localStorage.getItem(${JSON.stringify(aKey)})`), null);
  await navigate(a, "user-a@example.invalid");
  assert.equal(await evaluate("document.querySelector('.notepad-items textarea').value"), "A_PRIVATE_NOTEBOOK");
  await input(a, "#message", "Unsaved draft A");
  const beforeCancel = await evaluate("JSON.stringify({notebook:window.fixtureReadNotebook(),draft:document.querySelector('#message').value,calls:window.calls})");
  await evaluate("window.confirm=()=>false;document.querySelector('button[aria-label=\"Odhlásit se\"]').click()");
  assert.equal(await evaluate("JSON.stringify({notebook:window.fixtureReadNotebook(),draft:document.querySelector('#message').value,calls:window.calls})"), beforeCancel);

  // Temporary and malformed/redirect-like revalidation failures lock but retain work.
  await evaluate("window.sessionRevalidation='offline'"); await triggerCheck(a);
  await waitFor("document.body.innerText.includes('Vaše práce zůstává dočasně skrytá')");
  assert.ok(!await evaluate("document.body.innerText.includes('A_PRIVATE_NOTEBOOK')"));
  assert.equal(await evaluate("document.querySelector('.app-shell').getBoundingClientRect().width"), 0);
  assert.equal(await evaluate("window.fixtureReadNotebook().manifestations[0].text"), "A_PRIVATE_NOTEBOOK");
  const lockedTree=await call("Accessibility.getFullAXTree");
  assert.ok(!JSON.stringify(lockedTree.nodes.filter(n=>!n.ignored)).includes("A_PRIVATE_NOTEBOOK"));
  await screenshot("offline-lock");
  await evaluate("window.sessionRevalidation={...window.fixtureIdentity};Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Zkusit ověření znovu').click()");
  await active(a); assert.equal(await evaluate("document.querySelector('#message').value"), "Unsaved draft A");
  await evaluate("window.sessionRevalidation={error:'unexpected HTML/redirect substitute'}"); await triggerCheck(a);
  await waitFor("document.body.innerText.includes('Vaše práce zůstává dočasně skrytá')");
  await evaluate("window.sessionRevalidation={...window.fixtureIdentity}"); await triggerCheck(a); await active(a);

  await evaluate(`document.querySelector('button[aria-label="Spustit diktování"]').click()`);
  await waitFor("window.fixtureRecognition");
  await evaluate(`window.fixtureRecognition.onresult({resultIndex:0,results:[{0:{transcript:'RECOVERABLE_DICTATION'},isFinal:true}]});window.sessionRevalidation='offline'`);
  await triggerCheck(a); await waitFor("document.body.innerText.includes('Vaše práce zůstává dočasně skrytá')");
  await evaluate("window.sessionRevalidation={...window.fixtureIdentity}"); await triggerCheck(a); await active(a);
  assert.ok(await evaluate("document.querySelector('#message').value.includes('RECOVERABLE_DICTATION')"),"transient lock retains dictated draft without sending it");

  // A real second tab shares the origin, but not sessionStorage.
  const { targetId } = await call("Target.createTarget", { url: "about:blank" });
  const targets = await (await fetch("http://127.0.0.1:9228/json/list")).json();
  const socket = new WebSocket(targets.find(t => t.id === targetId).webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener("open", resolve, { once: true }));
  let id = 0; const pending = new Map();
  socket.addEventListener("message", event => { const m = JSON.parse(event.data); if (!pending.has(m.id)) return; const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(Error(JSON.stringify(m.error))) : p.resolve(m.result); });
  const b = { call: (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, {resolve,reject}); socket.send(JSON.stringify({id:key,method,params})); }) };
  b.evaluate = async expression => { const r = await b.call("Runtime.evaluate", {expression,awaitPromise:true,returnByValue:true}); if(r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
  b.waitFor = async expression => { for(let i=0;i<150;i++){if(await b.evaluate(`Boolean(${expression})`))return;await new Promise(r=>setTimeout(r,30));}throw Error("Second-tab timeout: "+expression); };
  await b.call("Page.enable");
  await b.call("Emulation.setDeviceMetricsOverride", {width:1200,height:1000,deviceScaleFactor:1,mobile:false});
  try {
    await navigate(b, "user-a@example.invalid"); await empty(b);
    await add(b, "A_SECOND_TAB");
    // Defer extraction, then logout in another tab. No chat follow-on may occur.
    await evaluate("window.deferUsageUrl='/api/extract'");
    await triggerCheck(a); await active(a);
    await input(a, "#message", "DELAYED_PRIVATE_REQUEST");
    await evaluate("document.querySelector('.send-button').click()");
    await waitFor("window.usageRequests.length===1");
    await b.evaluate("window.confirm=()=>true;document.querySelector('button[aria-label=\"Odhlásit se\"]').click()");
    await b.waitFor("document.querySelector('#mock-logout')");
    assert.equal(await b.evaluate("location.pathname"), "/cdn-cgi/access/logout");
    await ended(a);
    await evaluate("window.finishUsageRequest(0,{})");
    await new Promise(r => setTimeout(r,100));
    assert.deepEqual(await evaluate("window.calls.map(c=>c.url)"), ["/api/extract"]);
    assert.equal(await evaluate(`sessionStorage.getItem(${JSON.stringify(aKey)})`), null);
    await screenshot("cross-tab-logout");

    await navigate(b, "user-b@example.invalid"); await empty(b);
    assert.ok(!await b.evaluate("document.body.innerText.includes('A_PRIVATE_NOTEBOOK')"));
    await navigate(a, "user-b@example.invalid"); await empty(a); await add(a, "B_OWN_DATA");
    await navigate(a, "user-a@example.invalid"); await empty(a); await ended(b);

    // Fallback notification path: actual storage events, no BroadcastChannel.
    await navigate(a, "fallback@example.invalid", false, true); await add(a, "FALLBACK_PRIVATE");
    await navigate(b, "fallback@example.invalid", false, true); await add(b, "FALLBACK_SECOND");
    await b.evaluate("window.confirm=()=>true;document.querySelector('button[aria-label=\"Odhlásit se\"]').click()");
    await b.waitFor("document.querySelector('#mock-logout')"); await ended(a);

    // Missed notifications/old-tab resume must use server identity, not local owner metadata.
    await navigate(a, "resume@example.invalid"); await add(a, "RESUME_PRIVATE");
    await evaluate("window.sessionRevalidation={email:'other@example.invalid',isDeveloper:false}"); await triggerCheck(a); await ended(a);
    await navigate(a, "expired@example.invalid"); await add(a, "EXPIRED_PRIVATE");
    await evaluate("window.sessionRevalidation='unauthorized'"); await triggerCheck(a); await ended(a);

    // A suspended verification cannot reveal work or accept an old response.
    await navigate(a, "pending@example.invalid"); await add(a, "PENDING_PRIVATE");
    await evaluate("window.deferUsageUrl='/api/extract'"); await input(a, "#message", "pending message");
    await evaluate("document.querySelector('.send-button').click()"); await waitFor("window.usageRequests.length===1");
    await evaluate("window.deferSessionCheck=true"); await triggerCheck(a); await waitFor("window.finishSessionCheck");
    await evaluate("window.finishUsageRequest(0,{})");
    assert.equal(await evaluate("document.querySelector('.app-shell').getBoundingClientRect().width"),0);
    await evaluate("window.finishSessionCheck()"); await active(a);
    assert.deepEqual(await evaluate("window.calls.map(c=>c.url)"),["/api/extract"]);
    assert.equal(await evaluate("window.fixtureReadNotebook().manifestations[0].text"),"PENDING_PRIVATE");

    for(const width of [1600,390,320]) for(const developer of [false,true]) {
      console.log(`CHECK: session header developer=${developer} width=${width}`);
      await call("Emulation.setDeviceMetricsOverride",{width,height:1000,deviceScaleFactor:1,mobile:false});
      await navigate(a, `layout-${developer}@example.invalid`,developer); await add(a,"LAYOUT_PRIVATE");
      const tree=await call("Accessibility.getFullAXTree");
      assert.equal(tree.nodes.filter(n=>!n.ignored&&n.role?.value==='button'&&n.name?.value==='Odhlásit se').length,1);
      assert.equal(await evaluate(`(()=>{const b=document.querySelector('button[aria-label="Odhlásit se"]'),r=b.getBoundingClientRect();b.focus();return document.activeElement===b&&r.width>0&&r.left>=0&&r.right<=innerWidth;})()`),true);
      await screenshot(`${developer?'dev':'ordinary'}-${width}`);
      const key=await evaluate("window.fixtureStorageKey");
      assert.equal(await evaluate(`localStorage.getItem(${JSON.stringify(key)})!==null`),developer);
      if(developer) {
        await navigate(a,`layout-${developer}@example.invalid`,developer);
        assert.equal(await evaluate("document.querySelector('.notepad-items textarea').value"),"LAYOUT_PRIVATE");
        assert.ok(await evaluate("Boolean(document.querySelector('.dev-scenario-picker, .session-export-trigger'))"));
      }
      // Native Enter invokes accessible logout; cancellation retains content.
      await evaluate("window.confirm=()=>false;document.querySelector('button[aria-label=\"Odhlásit se\"]').focus()");
      await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
      await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
      assert.ok(await evaluate("Boolean(document.querySelector('.app-header'))"));
      await evaluate("window.confirm=()=>true;document.querySelector('button[aria-label=\"Nový projekt\"]').click()");
      await waitFor("window.fixtureReadNotebook() && Object.values(window.fixtureReadNotebook()).every(items=>items.length===0)");
      await navigate(a,`layout-${developer}@example.invalid`,developer); await empty(a);
      await add(a,"DELETE_ON_LOGOUT");
      await evaluate("window.confirm=()=>true;document.querySelector('button[aria-label=\"Odhlásit se\"]').click()");
      await waitFor("document.querySelector('#mock-logout')");
      assert.equal(await evaluate(`localStorage.getItem(${JSON.stringify(key)})`),null);
      assert.equal(await evaluate(`sessionStorage.getItem(${JSON.stringify(key)})`),null);
    }
    await navigate(a,"dev-a@example.invalid",true); await add(a,"DEV_A_PRIVATE");
    const devAKey=await evaluate("window.fixtureStorageKey");
    await navigate(a,"dev-b@example.invalid",true); await empty(a); await add(a,"DEV_B_PRIVATE");
    const devBKey=await evaluate("window.fixtureStorageKey");
    await navigate(a,"dev-a@example.invalid",true);
    assert.equal(await evaluate("document.querySelector('.notepad-items textarea').value"),"DEV_A_PRIVATE");
    await evaluate("window.sessionRevalidation={...window.fixtureIdentity,isDeveloper:false}"); await triggerCheck(a); await ended(a);
    assert.ok(await evaluate(`localStorage.getItem(${JSON.stringify(devAKey)})!==null`),"role mismatch retains own DEV recovery without displaying it");
    await navigate(a,"dev-a@example.invalid",true);
    await evaluate("window.confirm=()=>true;document.querySelector('button[aria-label=\"Odhlásit se\"]').click()");
    await waitFor("document.querySelector('#mock-logout')");
    assert.equal(await evaluate(`localStorage.getItem(${JSON.stringify(devAKey)})`),null);
    assert.ok(await evaluate(`localStorage.getItem(${JSON.stringify(devBKey)})!==null`),"logout does not delete another developer's copy");
    // Simulate a new server-provided identity in a retained client tree, with an
    // old Notebook event handler still queued from before the ownership change.
    await navigate(a,"props-a@example.invalid"); await add(a,"PROPS_A_PRIVATE");
    await evaluate(`(()=>{const el=document.querySelector('.notepad-items textarea');window.oldNotebookChange=el[Object.keys(el).find(k=>k.startsWith('__reactProps$'))].onChange;window.rerenderFixture({email:'props-b@example.invalid',isDeveloper:false});})()`);
    await waitFor("document.querySelector('.account-email')?.textContent==='props-b@example.invalid' && !document.querySelector('#message').disabled");
    await empty(a);
    await evaluate("window.oldNotebookChange({target:{value:'LATE_OLD_OWNER'}})");
    await empty(a);
    assert.ok(!await evaluate("JSON.stringify([...Array(sessionStorage.length)].map((_,i)=>sessionStorage.getItem(sessionStorage.key(i)))).includes('LATE_OLD_OWNER')"));
    assert.deepEqual(await evaluate("[localStorage.getItem('apu-site:notepad-map:v1'),localStorage.getItem('apu-site:notepad-map:v2')]"),legacy);
    assert.equal(await evaluate("localStorage.getItem('apu.session-test-preference')"),"keep");
  } finally { socket.close(); await call("Target.closeTarget",{targetId}); }
  console.log("PASS: ENV-S2 session ownership: ordinary same-tab reload/account switch, untouched legacy v1/v2, logout/cancel, actual two-tab invalidation with BroadcastChannel and storage fallback, stale resume/401, transient lock/recovery, late extraction/no follow-on, DEV ownership/persistence/logout, New Project, keyboard/AX logout and desktop/390/320px.");
  console.log("Artifacts: "+artifactRoot);
}
