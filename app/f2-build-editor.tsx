"use client";

import { useState } from "react";
import type { AnalysisState } from "./analysis-model";
import { F2_PATHS } from "./notepad-model";
import { F2_PATH_META, type F2BuildState, type F2PreviewState } from "./f2-build-model";

export function F2BuildEditor({ build, analysis, preview, onPathChange, onSkillToggle, onParameterChange, onContextAdd, onContextRemove, onPreview }: {
  build: F2BuildState; analysis: AnalysisState; preview: F2PreviewState;
  onPathChange: (path: F2BuildState["activePath"]) => void; onSkillToggle: (id: string) => void;
  onParameterChange: (id: string, value: string) => void; onContextAdd: (text: string) => void; onContextRemove: (id: string) => void; onPreview: () => void;
}) {
  const [contextDraft, setContextDraft] = useState("");
  const visibleSkills = build.skills.filter((skill) => skill.path === build.activePath);
  return <div className="f2-editor">
    <section className="f2-situation"><span>Aktuální pedagogická potřeba</span><h2>{build.canonicalNeed.needText || "Bez popisu"}</h2></section>
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
    {analysis.hypotheses.length > 0 && <section className="f2-hypotheses"><h3>Společný analytický obraz</h3>{analysis.hypotheses.map((hypothesis) => <article key={hypothesis.id}><strong>{hypothesis.title}</strong><p>{hypothesis.summary}</p></article>)}</section>}
    {build.uncertainties.length > 0 && <aside className="f2-uncertainty"><strong>Co zatím zůstává nejisté</strong><p>{build.uncertainties[0]}</p></aside>}
    <div className="f2-preview-action">{preview?.status === "stale" && <span>Preview není aktuální</span>}<button type="button" onClick={onPreview}>{preview ? "Aktualizovat preview" : "PREVIEW"}</button></div>
  </div>;
}

export function F2Preview({ preview }: { preview: F2PreviewState }) {
  if (!preview) return <div className="workspace-empty-state"><h2>Preview</h2><p>Nejprve sestavte build v Rozboru a použijte PREVIEW.</p></div>;
  const item = preview.snapshot;
  return <div className="f2-preview"><header><span>Prototyp náhledu · nejde o finální pedagogický výstup</span><h2>{item.canonicalNeed.needText}</h2>{preview.status === "stale" && <strong className="f2-preview-stale">Preview není aktuální</strong>}</header>
    <dl><div><dt>Aktivní směr</dt><dd>{item.activePath}</dd></div>{item.f3Target && <div><dt>Cíl pro Výstup</dt><dd>{item.f3Target}</dd></div>}</dl>
    <section><h3>Aktivní vrstvy</h3>{item.activeSkills.length ? <ul>{item.activeSkills.map((skill) => <li key={skill.id}><strong>{skill.label}</strong>{skill.parameterText && <span>{skill.parameterText}</span>}</li>)}</ul> : <p>Build nemá aktivní odborné vrstvy.</p>}</section>
    {item.addedContext.length > 0 && <section><h3>Doplněný kontext</h3><ul>{item.addedContext.map((context) => <li key={context.id}>{context.text}</li>)}</ul></section>}
    <section><h3>Pracovní hypotézy</h3><ul>{item.hypotheses.map((hypothesis) => <li key={hypothesis.id}>{hypothesis.title}</li>)}</ul></section>
  </div>;
}
