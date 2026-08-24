"use client";

import { useState } from "react";
import { F2_PATHS } from "./notepad-model";
import { F2_PATH_META, type F2BuildState, type F2PreviewState } from "./f2-build-model";

export function F2BuildEditor({ build, preview, buildStatus, buildError, previewStatus: renderStatus, previewError, onPathChange, onSkillToggle, onParameterChange, onContextAdd, onContextRemove, onExecute, onPreview }: {
  build: F2BuildState; preview: F2PreviewState; buildStatus: "idle" | "loading" | "error"; buildError: string | null; previewStatus: "idle" | "loading" | "error"; previewError: string | null;
  onPathChange: (path: F2BuildState["activePath"]) => void; onSkillToggle: (id: string) => void;
  onParameterChange: (id: string, value: string) => void; onContextAdd: (text: string) => void; onContextRemove: (id: string) => void; onExecute: () => void; onPreview: () => void;
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
    {build.activePath === "POCHOPIT" ? <section className="f2-execute"><div><h3>Modelové rozpracování</h3><p>Aktivní vrstvy se použijí společně na celou situaci.</p>{build.processedRevision !== build.buildRevision && build.processedRevision !== null && <strong>Build obsahuje dosud nepoužité změny.</strong>}{buildError && <strong role="alert">{buildError}</strong>}</div><button type="button" disabled={buildStatus === "loading"} onClick={onExecute}>{buildStatus === "loading" ? "Rozpracovávám…" : "Rozpracovat build"}</button></section> : <aside className="f2-prototype"><strong>Interakční prototyp</strong><p>Modelové rozpracování této cesty zatím není součástí aktuální verze.</p></aside>}
    {build.workingHypotheses.length > 0 && <section className="f2-hypotheses"><h3>Společný analytický obraz</h3>{build.workingHypotheses.map((hypothesis) => <article key={hypothesis.id}><strong>{hypothesis.title}</strong><p>{hypothesis.summary}</p></article>)}</section>}
    {(build.analytical.relationships.length > 0 || build.analytical.comparisons.length > 0 || build.analytical.expertFrame.length > 0 || build.analytical.synthesis) && <section className="f2-structured"><h3>Aktuální analytický stav</h3>{build.analytical.synthesis && <p>{build.analytical.synthesis}</p>}{build.analytical.comparisons.length > 0 && <><h4>Porovnání</h4><ul>{build.analytical.comparisons.map((item) => <li key={item}>{item}</li>)}</ul></>}{build.analytical.relationships.length > 0 && <><h4>Souvislosti</h4><ul>{build.analytical.relationships.map((item) => <li key={item}>{item}</li>)}</ul></>}{build.analytical.expertFrame.length > 0 && <><h4>Odborný rámec</h4><ul>{build.analytical.expertFrame.map((item) => <li key={item}>{item}</li>)}</ul></>}</section>}
    {build.analytical.uncertainties.length > 0 && <aside className="f2-uncertainty"><strong>Co zatím zůstává nejisté</strong><ul>{build.analytical.uncertainties.map((item) => <li key={`${item.missing}-${item.limitation}`}><b>{item.missing}</b><span>Proč na tom záleží: {item.importance}</span><span>Co to omezuje: {item.limitation}</span></li>)}</ul></aside>}
    <div className="f2-preview-action">{preview?.status === "stale" && <span>Preview není aktuální</span>}{previewError && <span role="alert">{previewError}</span>}<button type="button" disabled={build.activePath !== "POCHOPIT" || build.processedRevision !== build.buildRevision || renderStatus === "loading"} onClick={onPreview}>{renderStatus === "loading" ? "Vytvářím preview…" : preview ? "Aktualizovat preview" : "PREVIEW"}</button></div>
  </div>;
}

export function F2Preview({ preview }: { preview: F2PreviewState }) {
  if (!preview) return <div className="workspace-empty-state"><h2>Preview</h2><p>Nejprve sestavte build v Rozboru a použijte PREVIEW.</p></div>;
  const item = preview.snapshot;
  return <div className="f2-preview"><header><span>Modelový náhled F2 · nejde o finální pedagogický výstup</span><h2>{preview.render.title}</h2>{preview.status === "stale" && <strong className="f2-preview-stale">Preview není aktuální</strong>}</header>
    <p>{preview.render.introduction}</p><dl><div><dt>Snapshot</dt><dd>revize {item.buildRevision}</dd></div>{item.f3Target && <div><dt>Cíl pro Výstup</dt><dd>{item.f3Target}</dd></div>}</dl>
    {preview.render.sections.map((section) => <section key={section.heading}><h3>{section.heading}</h3><p>{section.content}</p></section>)}
  </div>;
}
