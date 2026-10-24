export type TestPanelActivation = "keyboard" | "version-taps" | "dev-button";
export type MethodicalTestEvent = {
  session_id: string;
  test_mode: boolean;
} & (
  | { event: "test_panel_activated"; source: TestPanelActivation }
  | { event: "test_scenario_inserted"; scenario_id: string }
);

// Integration seam only: no collector, network transport, storage or PII.
// A future sink must upsert session attribution and join ALL events by session_id,
// including events preceding the first insertion. Per-event filtering is insufficient.
export function createMethodicalTestSession(sessionId: string, sink?: (event: MethodicalTestEvent) => void) {
  let testMode = false;
  const attribution = () => ({ session_id: sessionId, test_mode: testMode });
  function emit(event: MethodicalTestEvent) {
    try { sink?.(event); } catch { /* Analytics must never interrupt the composer. */ }
  }
  return {
    attribution,
    panelActivated(source: TestPanelActivation) {
      emit({ ...attribution(), event: "test_panel_activated", source });
    },
    scenarioInserted(scenarioId: string) {
      testMode = true;
      emit({ ...attribution(), event: "test_scenario_inserted", scenario_id: scenarioId });
    },
  };
}

export function isTestPanelShortcut(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey" | "repeat">) {
  return event.key.toLowerCase() === "t" && event.ctrlKey && event.altKey && event.shiftKey && !event.metaKey && !event.repeat;
}

export function createVersionTapActivation() {
  let taps: number[] = [];
  return (now: number) => {
    taps = [...taps.filter(time => now - time <= 5000), now];
    if (taps.length < 7) return false;
    taps = [];
    return true;
  };
}
