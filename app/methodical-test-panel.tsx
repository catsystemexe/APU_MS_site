"use client";

import { useEffect, useRef } from "react";
import { DEV_TEST_SCENARIOS, type DevTestScenario } from "./dev-test-scenarios";

export function MethodicalTestPanel({ onClose, onSelectScenario }: {
  onClose: () => void;
  onSelectScenario: (scenario: DevTestScenario) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return <dialog ref={dialog} className="methodical-test-panel" aria-labelledby="test-panel-title" onCancel={onClose}>
    <div className="methodical-test-heading">
      <h2 id="test-panel-title">Testovací scénáře</h2>
      <button type="button" onClick={onClose} aria-label="Zavřít testovací panel">Zavřít</button>
    </div>
    <div id="dev-scenario-menu" className="dev-scenario-menu" aria-label="Testovací scénáře">
      {([1, 2, 3] as const).map(difficulty => <div key={difficulty} className="dev-scenario-column" role="group" aria-label={`Obtížnost ${difficulty}`}>
        <strong className="dev-scenario-path">Obtížnost {difficulty}</strong>
        {DEV_TEST_SCENARIOS.filter(scenario => scenario.difficulty === difficulty).map(scenario => <button
          key={scenario.id} type="button" data-scenario-id={scenario.id}
          onClick={() => { onSelectScenario(scenario); onClose(); }}
        >
          <strong>{scenario.difficulty} · {scenario.load}</strong>
          <span>{scenario.subtitle}</span>
          <span>{scenario.label}</span>
        </button>)}
      </div>)}
    </div>
  </dialog>;
}
