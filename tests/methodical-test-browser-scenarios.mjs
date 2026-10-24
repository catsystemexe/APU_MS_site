import assert from "node:assert/strict";
import { DEV_TEST_SCENARIOS } from "../app/dev-test-scenarios.ts";

// Uses the existing actual React client + synthetic API fixture. Server runtime
// mode and authorization are checked separately against real route handlers.
export async function runMethodicalTestScenarios({ call, evaluate, waitFor, capture }) {
  const open = () => call("Input.dispatchKeyEvent", { type: "keyDown", key: "T", code: "KeyT", windowsVirtualKeyCode: 84, modifiers: 11 });
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const close = () => click('button[aria-label="Zavřít testovací panel"]');
  const setInput = value => evaluate(`(() => { const el=document.querySelector('#message'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  const navigate = async (developer, width, mobile = false) => {
    const mount = await evaluate("window.fixtureMountId");
    await call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile });
    await call("Emulation.setTouchEmulationEnabled", { enabled: mobile });
    await call("Page.navigate", { url: "http://127.0.0.1:4333/" + (developer ? "?developer=1" : "") });
    await waitFor(`window.fixtureMountId!==${JSON.stringify(mount)} && document.querySelector('#message') && !document.querySelector('#message').disabled`);
  };
  const assertBounds = async () => assert.equal(await evaluate(`(() => { const r=document.querySelector('dialog').getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight; })()`), true);
  for (const developer of [false, true]) {
    await navigate(developer, 1440);
    assert.equal(await evaluate("Boolean(document.querySelector('dialog'))"), false);
    assert.equal(await evaluate("Boolean(document.querySelector('.developer-controls'))"), developer);
    assert.equal(await evaluate("Boolean(document.querySelector('button[aria-label=\"Testovací scénáře\"]'))"), developer);
    await call("Input.dispatchKeyEvent", { type: "keyDown", key: "T", modifiers: 3 });
    assert.equal(await evaluate("Boolean(document.querySelector('dialog'))"), false, "incomplete shortcut ignored");
    await open();
    await waitFor("document.querySelector('dialog')?.open");
    assert.equal(await evaluate("document.querySelectorAll('[data-scenario-id]').length"), 9);
    assert.equal(await evaluate("Boolean(document.querySelector('dialog #model-select, dialog .conversation-diagnostics, dialog .header-session-export'))"), false);
    await assertBounds();
    await capture(developer ? "methodical-dev-desktop" : "methodical-public-desktop");
    await close();
    await waitFor("!document.querySelector('dialog')");

    for (const scenario of DEV_TEST_SCENARIOS) {
      await setInput("");
      await open();
      await waitFor("document.querySelector('dialog')?.open");
      await click(`[data-scenario-id="${scenario.id}"]`);
      await waitFor(`!document.querySelector('dialog') && document.querySelector('#message').value===${JSON.stringify(scenario.text)}`);
      await waitFor("document.activeElement.id==='message'");
      assert.equal(await evaluate("window.calls.length"), 0, "insertion never sends or invokes APIs");
    }
    await setInput("Keep this draft exactly.");
    await evaluate("window.confirm=()=>false");
    await open(); await waitFor("document.querySelector('dialog')?.open");
    await click('[data-scenario-id="pochopit-1"]');
    assert.equal(await evaluate("document.querySelector('#message').value"), "Keep this draft exactly.");
    await evaluate("window.confirm=()=>true");
    await open(); await waitFor("document.querySelector('dialog')?.open");
    await click('[data-scenario-id="pochopit-1"]');
    assert.equal(await evaluate("document.querySelector('#message').value"), DEV_TEST_SCENARIOS[0].text);
    await open(); await waitFor("document.querySelector('dialog')?.open");
    await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await waitFor("!document.querySelector('dialog')");
    if (developer) {
      await click('button[aria-label="Testovací scénáře"]');
      await waitFor("document.querySelector('dialog')?.open");
      await close();
    }
    await open(); await waitFor("document.querySelector('dialog')?.open");
    await navigate(developer, 390, true);
    assert.equal(await evaluate("Boolean(document.querySelector('dialog'))"), false, "reload hides panel");
    await click('button[aria-label="Otevřít nastavení"]');
    await waitFor("document.querySelector('#diagnostics-drawer.is-open')");
    const tapVersion = async () => {
      const point = await evaluate("(() => { const el=document.querySelector('.apu-version'); el.scrollIntoView(); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()");
      await call("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...point, radiusX: 2, radiusY: 2 }] });
      await call("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    for (let i = 0; i < 6; i++) await tapVersion();
    assert.equal(await evaluate("Boolean(document.querySelector('dialog'))"), false);
    await tapVersion();
    await waitFor("document.querySelector('dialog')?.open");
    await assertBounds();
    assert.equal(await evaluate("document.querySelectorAll('[data-scenario-id]').length"), 9);
    await capture(developer ? "methodical-dev-mobile" : "methodical-public-mobile");
    await close();
    await waitFor("!document.querySelector('dialog')");
    assert.equal(await evaluate("window.calls.length"), 0);
    await navigate(developer, 1440);
    await setInput("Ordinary chat regression.");
    await click(".send-button");
    await waitFor("window.calls.some(c=>c.url==='/api/chat') && !document.querySelector('#message').disabled");
    assert.equal(await evaluate("Array.from(document.querySelectorAll('.message--user')).some(el=>el.textContent.includes('Ordinary chat regression.'))"), true);
  }
  console.log("PASS: actual client DEV/PUBLIC roles; shortcut, close/Escape, reload, all 9 exact insertions, replacement confirmation, zero insertion requests, native mobile seven-tap activation, panel bounds, ordinary chat (mock provider).");
}
