"use client";

import { useState } from "react";
import { ChevronDown, TriangleAlert } from "lucide-react";
import { toggleExpandedHypothesis } from "./analysis-accordion";
import { F2_PATHS } from "./notepad-model";
import { currentF2ProcessedBuild, F2_PATH_META, type F2BuildState, type F2PathResult, type F2PreviewState } from "./f2-build-model";

function PathResult({ result }: { result: F2PathResult }) {
  if (result.kind === "understanding") return <>{result.synthesis && <p>{result.synthesis}</p>}{result.comparisons.length > 0 && <><h4>Porovnání</h4><ul>{result.comparisons.map((item) => <li key={item}>{item}</li>)}</ul></>}{result.relationships.length > 0 && <><h4>Souvislosti</h4><ul>{result.relationships.map((item) => <li key={item}>{item}</li>)}</ul></>}{result.expertFrame.length > 0 && <><h4>Odborný rámec</h4><ul>{result.expertFrame.map((item) => <li key={item}>{item}</li>)}</ul></>}</>;
  if (result.kind === "observation") return <>{result.purpose && <p>{result.purpose}</p>}{result.observableIndicators.length > 0 && <><h4>Pozorovatelné indikátory</h4><ul>{result.observableIndicators.map((item) => <li key={`${item.indicator}-${item.interpretation}`}><b>{item.indicator}</b> — interpretace: {item.interpretation}</li>)}</ul></>}{result.situations.length > 0 && <><h4>Situace</h4><ul>{result.situations.map((item) => <li key={item}>{item}</li>)}</ul></>}{result.comparisonConditions.length > 0 && <><h4>Porovnání podmínek</h4><ul>{result.comparisonConditions.map((item) => <li key={item}>{item}</li>)}</ul></>}{result.scope && <p><b>Rozsah:</b> {result.scope}</p>}{result.evidenceMethod.length > 0 && <><h4>Evidence</h4><ul>{result.evidenceMethod.map((item) => <li key={item}>{item}</li>)}</ul></>}</>;
  return <>{result.pedagogicalObjective && <p><b>Pedagogický cíl:</b> {result.pedagogicalObjective}</p>}{result.candidateApproaches.length > 0 && <><h4>Možné přístupy</h4><ul>{result.candidateApproaches.map((item) => <li key={item}>{item}</li>)}</ul></>}{result.variantComparison.length > 0 && <><h4>Porovnání variant</h4><ul>{result.variantComparison.map((item) => <li key={item}>{item}</li>)}</ul></>}{result.workingApproach && <p><b>Pracovní přístup:</b> {result.workingApproach}</p>}{result.conditions.length > 0 && <><h4>Podmínky</h4><ul>{result.conditions.map((item) => <li key={item}>{item}</li>)}</ul></>}{result.whatToVerify.length > 0 && <><h4>Co ověřovat</h4><ul>{result.whatToVerify.map((item) => <li key={item}>{item}</li>)}</ul></>}</>;
}

export function F2BuildEditor({ build, preview, buildStatus, buildError, previewStatus: renderStatus, previewError, onPathChange, onSkillToggle, onParameterChange, onContextAdd, onContextRemove, onExecute, onPreview }: {
  build: F2BuildState; preview: F2PreviewState; buildStatus: "idle" | "loading" | "error"; buildError: string | null; previewStatus: "idle" | "loading" | "error"; previewError: string | null;
  onPathChange: (path: F2BuildState["activePath"]) => void; onSkillToggle: (id: string) => void;
  onParameterChange: (id: string, value: string) => void; onContextAdd: (text: string) => void; onContextRemove: (id: string) => void; onExecute: () => void; onPreview: () => void;
}) {
  const [contextDraft, setContextDraft] = useState("");
  const [expandedHypotheses, setExpandedHypotheses] = useState(() => new Set<string>());
  const visibleSkills = build.skills.filter((skill) => skill.path === build.activePath);
  const processed = currentF2ProcessedBuild(build);
  return <div className="f2-editor">
    <section className="f2-situation"><span>Aktuální pedagogická potřeba</span><h2>{build.canonicalNeed.needText || "Bez popisu"}</h2></section>
    {build.workingHypotheses.length > 0 && <section className="f2-hypotheses" aria-label="Výchozí pracovní hypotézy"><h3>Výchozí pracovní hypotézy</h3>
      <div className="f2-hypothesis-list">{build.workingHypotheses.map((hypothesis) => {
        const isExpanded = expandedHypotheses.has(hypothesis.id);
        const detailId = `f2-hypothesis-${hypothesis.id}-detail`;
        return <article key={hypothesis.id}>
          <button type="button" aria-expanded={isExpanded} aria-controls={detailId} onClick={() => setExpandedHypotheses((current) => toggleExpandedHypothesis(current, hypothesis.id))}>
            <span className="analysis-rank">{hypothesis.rank}</span><ChevronDown aria-hidden="true" /><span><strong>{hypothesis.title}</strong><small>{hypothesis.summary}</small></span>
          </button>
          {isExpanded && <div id={detailId} className="f2-hypothesis-detail">
            {hypothesis.supportingInformation.length > 0 && <><h4>Opora v Zápisníku</h4><ul>{hypothesis.supportingInformation.map((item) => <li key={item}>{item}</li>)}</ul></>}
            {hypothesis.limitations.length > 0 && <><h4><TriangleAlert aria-hidden="true" /> Limity a nejistoty</h4><ul>{hypothesis.limitations.map((item) => <li key={item}>{item}</li>)}</ul></>}
            {hypothesis.unknowns.length > 0 && <><h4>Neznámé informace</h4><ul>{hypothesis.unknowns.map((item) => <li key={item}>{item}</li>)}</ul></>}
          </div>}
        </article>;
      })}</div>
    </section>}
    <section><h3>Směr rozboru</h3><div className="f2-paths" role="radiogroup" aria-label="Směr rozboru">
      {F2_PATHS.map((path) => <button key={path} type="button" role="radio" aria-checked={path === build.activePath} className={path === build.activePath ? "is-active" : ""} onClick={() => onPathChange(path)}><strong>{path}</strong><small>{F2_PATH_META[path].description}</small></button>)}
    </div></section>
    <section><div className="f2-section-heading"><div><h3>Vrstvy buildu</h3><p>Zapněte libovolnou kombinaci. Pořadí nevyjadřuje povinný postup.</p></div></div>
      <div className="f2-skill-track">{visibleSkills.map((skill, index) => <div className="f2-skill-wrap" key={skill.id}>
        <button type="button" aria-pressed={skill.active} className={`f2-skill${skill.active ? " is-active" : ""}${skill.parameterText.trim() ? " is-parameterized" : ""}`} onClick={() => onSkillToggle(skill.id)}><span>{skill.label}</span><small>{skill.active ? "Aktivní" : "Volitelná vrstva"}</small></button>
        {index < visibleSkills.length - 1 && <span className="f2-connector" aria-hidden="true">→</span>}
        {skill.active && <label className="f2-parameter"><span>Upřesnit vrstvu (volitelné)</span><input maxLength={240} value={skill.parameterText} onChange={(event) => onParameterChange(skill.id, event.target.value)} placeholder="Krátké zaměření…" /></label>}
      </div>)}</div>
    </section>
    <section className="f2-context"><h3>Pracovní kontext</h3>{build.addedContext.length > 0 && <ul>{build.addedContext.map((item) => <li key={item.id}><span>{item.text}</span><button type="button" onClick={() => onContextRemove(item.id)} aria-label={`Odebrat informaci: ${item.text}`}>Odebrat</button></li>)}</ul>}
      <form onSubmit={(event) => { event.preventDefault(); const text = contextDraft.trim(); if (text) { onContextAdd(text); setContextDraft(""); } }}><input maxLength={240} value={contextDraft} onChange={(event) => setContextDraft(event.target.value)} placeholder="Krátká doplňující informace" /><button type="submit">+ Doplnit informaci</button></form>
    </section>
    <section className="f2-execute"><div><h3>Modelové rozpracování · {build.activePath}</h3><p>Aktivní vrstvy se použijí společně na celou situaci.</p>{processed && processed.processedRevision !== build.buildRevision && <strong>Build obsahuje dosud nepoužité změny.</strong>}{buildError && <strong role="alert">{buildError}</strong>}</div><button type="button" disabled={buildStatus === "loading"} onClick={onExecute}>{buildStatus === "loading" ? "Rozpracovávám…" : "Rozpracovat build"}</button></section>
    {processed && <section className="f2-structured"><h3>Aktuální zpracovaný build · {processed.path}</h3><PathResult result={processed.pathResult} /></section>}
    {processed && processed.uncertainties.length > 0 && <aside className="f2-uncertainty"><strong>Co zatím zůstává nejisté</strong><ul>{processed.uncertainties.map((item) => <li key={`${item.description}-${item.relatedDecisionOrArea}`}><b>{item.description}</b><span>Proč na tom záleží: {item.whyRelevant}</span><span>Co to omezuje: {item.limits}</span><span>Dotčená oblast: {item.relatedDecisionOrArea}</span></li>)}</ul></aside>}
    <div className="f2-preview-action">{preview?.status === "stale" && <span>Preview není aktuální</span>}{previewError && <span role="alert">{previewError}</span>}<button type="button" disabled={!processed || processed.processedRevision !== build.buildRevision || renderStatus === "loading"} onClick={onPreview}>{renderStatus === "loading" ? "Vytvářím preview…" : preview ? "Aktualizovat preview" : "PREVIEW"}</button></div>
  </div>;
}

export function F2Preview({ preview }: { preview: F2PreviewState }) {
  if (!preview) return <div className="workspace-empty-state"><h2>Preview</h2><p>Nejprve sestavte build v Rozboru a použijte PREVIEW.</p></div>;
  const item = preview.snapshot;
  return <div className="f2-preview"><header><span>Modelový náhled F2 · nejde o finální pedagogický výstup</span><h2>{preview.render.title}</h2>{preview.status === "stale" && <strong className="f2-preview-stale">Preview není aktuální</strong>}</header>
    <p>{preview.render.introduction}</p><dl><div><dt>Cesta F2</dt><dd>{item.activePath}</dd></div><div><dt>Snapshot</dt><dd>revize {item.buildRevision}</dd></div>{item.f3Target && <div><dt>Cíl pro Výstup</dt><dd>{item.f3Target}</dd></div>}</dl>
    {preview.render.sections.map((section) => <section key={section.heading}><h3>{section.heading}</h3><p>{section.content}</p></section>)}
  </div>;
}
