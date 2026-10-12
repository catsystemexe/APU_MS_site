"use client";

import type { Dispatch, SetStateAction } from "react";
import type { F2Path } from "./notepad-model";
import { updateCurrentRozborConfig, type CurrentRozborState } from "./f2-build-model";

// Both account modes use these same existing operations for the assigned strategy.
export function F2BuildOperations({ activeF2Path, currentRozbor, setCurrentRozbor }: {
  activeF2Path: F2Path;
  currentRozbor: CurrentRozborState;
  setCurrentRozbor: Dispatch<SetStateAction<CurrentRozborState>>;
}) {
  const activeRozbor = currentRozbor[activeF2Path];
  return <>
  <section className={`f2-operation-card${activeRozbor.config.expansionDepth > 0 ? " is-active" : ""}`} aria-labelledby="f2-expansion-title">
    <div className="f2-operation-copy"><h3 id="f2-expansion-title">Rozvinout hypotézy</h3></div>
    <div className="f2-depth-options">
      {([
        [1, "Základně", "Jak hypotéza může vysvětlovat situaci."],
        [2, "Podrobně", "Mechanismy, podmínky a co hypotézu podporuje či oslabuje."],
        [3, "Do hloubky", "Kritická interpretace, alternativy, limity a komplikující faktory."],
      ] as const).map(([depth, label, description]) => {
        const selected = activeRozbor.config.expansionDepth === depth;
        return <button key={depth} type="button" aria-pressed={selected} onClick={() => setCurrentRozbor((current) => updateCurrentRozborConfig(current, activeF2Path, { expansionDepth: selected ? 0 : depth }))}>
          <strong>{label}</strong><span>{description}</span>
        </button>;
      })}
    </div>
  </section>
  {activeF2Path === "POCHOPIT" && <>
    <button type="button" className={`f2-operation-card f2-operation-toggle${currentRozbor.POCHOPIT.config.compareHypotheses ? " is-active" : ""}`} aria-pressed={currentRozbor.POCHOPIT.config.compareHypotheses} onClick={() => setCurrentRozbor((current) => updateCurrentRozborConfig(current, "POCHOPIT", { compareHypotheses: !current.POCHOPIT.config.compareHypotheses }))}>
      <span className="f2-operation-copy"><strong>Porovnat a propojit hypotézy</strong><span>Rozdíly, průniky, vztahy a možné souběžné působení hypotéz.</span></span>
    </button>
    <button type="button" className={`f2-operation-card f2-operation-toggle${currentRozbor.POCHOPIT.config.expertFrame ? " is-active" : ""}`} aria-pressed={currentRozbor.POCHOPIT.config.expertFrame} onClick={() => setCurrentRozbor((current) => updateCurrentRozborConfig(current, "POCHOPIT", { expertFrame: !current.POCHOPIT.config.expertFrame }))}>
      <span className="f2-operation-copy"><strong>Doplnit odborný rámec</strong><span>Propojí rozbor s relevantními teoriemi, odbornými koncepty a evidencí.</span></span>
    </button>
  </>}
  {activeF2Path === "POZOROVAT" && <>
    <button type="button" className={`f2-operation-card f2-operation-toggle${currentRozbor.POZOROVAT.config.compareHypotheses ? " is-active" : ""}`} aria-pressed={currentRozbor.POZOROVAT.config.compareHypotheses} onClick={() => setCurrentRozbor((current) => updateCurrentRozborConfig(current, "POZOROVAT", { compareHypotheses: !current.POZOROVAT.config.compareHypotheses }))}><span className="f2-operation-copy"><strong>Porovnat a propojit hypotézy</strong><span>Odvodí konkrétní kontrasty podmínek, které mohou hypotézy rozlišit.</span></span></button>
    <button type="button" className={`f2-operation-card f2-operation-toggle${currentRozbor.POZOROVAT.config.keyIndicators ? " is-active" : ""}`} aria-pressed={currentRozbor.POZOROVAT.config.keyIndicators} onClick={() => setCurrentRozbor((current) => updateCurrentRozborConfig(current, "POZOROVAT", { keyIndicators: !current.POZOROVAT.config.keyIndicators }))}><span className="f2-operation-copy"><strong>Určit klíčové indikátory</strong><span>Co je přímo pozorovatelné, kde to sledovat a jak to souvisí s hypotézami.</span></span></button>
    <button type="button" className={`f2-operation-card f2-operation-toggle${currentRozbor.POZOROVAT.config.observationPriorities ? " is-active" : ""}`} aria-pressed={currentRozbor.POZOROVAT.config.observationPriorities} onClick={() => setCurrentRozbor((current) => updateCurrentRozborConfig(current, "POZOROVAT", { observationPriorities: !current.POZOROVAT.config.observationPriorities }))}><span className="f2-operation-copy"><strong>Stanovit priority pozorování</strong><span>Co sledovat nejdříve a proč je to nejvíce informativní.</span></span></button>
  </>}
  {activeF2Path === "VYTVOŘIT" && <>
    <button type="button" className={`f2-operation-card f2-operation-toggle${currentRozbor.VYTVOŘIT.config.candidateApproaches ? " is-active" : ""}`} aria-pressed={currentRozbor.VYTVOŘIT.config.candidateApproaches} onClick={() => setCurrentRozbor((current) => updateCurrentRozborConfig(current, "VYTVOŘIT", { candidateApproaches: !current.VYTVOŘIT.config.candidateApproaches }))}><span className="f2-operation-copy"><strong>Navrhnout možné přístupy</strong><span>Porovná možnosti a zvolí jeden explicitní pracovní přístup.</span></span></button>
    <button type="button" className={`f2-operation-card f2-operation-toggle${currentRozbor.VYTVOŘIT.config.refineObjective ? " is-active" : ""}`} aria-pressed={currentRozbor.VYTVOŘIT.config.refineObjective} onClick={() => setCurrentRozbor((current) => updateCurrentRozborConfig(current, "VYTVOŘIT", { refineObjective: !current.VYTVOŘIT.config.refineObjective }))}><span className="f2-operation-copy"><strong>Zpřesnit cíl</strong><span>Vymezí praktický pedagogický cíl odděleně od formátu Výstupu.</span></span></button>
    <button type="button" className={`f2-operation-card f2-operation-toggle${currentRozbor.VYTVOŘIT.config.successConditions ? " is-active" : ""}`} aria-pressed={currentRozbor.VYTVOŘIT.config.successConditions} onClick={() => setCurrentRozbor((current) => updateCurrentRozborConfig(current, "VYTVOŘIT", { successConditions: !current.VYTVOŘIT.config.successConditions }))}><span className="f2-operation-copy"><strong>Určit podmínky úspěchu</strong><span>Podmínky použití, podpory a přizpůsobení.</span></span></button>
    <button type="button" className={`f2-operation-card f2-operation-toggle${currentRozbor.VYTVOŘIT.config.followUpVerification ? " is-active" : ""}`} aria-pressed={currentRozbor.VYTVOŘIT.config.followUpVerification} onClick={() => setCurrentRozbor((current) => updateCurrentRozborConfig(current, "VYTVOŘIT", { followUpVerification: !current.VYTVOŘIT.config.followUpVerification }))}><span className="f2-operation-copy"><strong>Určit, co následně ověřovat</strong><span>Signály úspěchu i potřeby přístup upravit.</span></span></button>
  </>}
  </>;
}
