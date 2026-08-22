"use client";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { Bug, ChevronDown, Eye, MessageCircle, PackagePlus, Sparkles, X } from "lucide-react";
import { SHARED_FEEDBACK_STATUS_LABELS, sortSharedFeedback, type SharedFeedbackItem, type SharedFeedbackResult, type SharedFeedbackType } from "./shared-feedback";

const TYPE_META: Record<SharedFeedbackType, { label: string; Icon: ComponentType<{ "aria-hidden"?: boolean }> }> = {
  bug: { label: "Chyba", Icon: Bug }, improvement: { label: "Zlepšení", Icon: Sparkles }, feature: { label: "Funkce", Icon: PackagePlus },
  discussion: { label: "Diskuse", Icon: MessageCircle }, observation: { label: "Pozorování", Icon: Eye },
};
function FeedbackItem({ item }: { item: SharedFeedbackItem }) {
  const [open, setOpen] = useState(false);
  const { Icon, label } = TYPE_META[item.type];
  const contentId = `dev-log-item-${item.id}`;
  return <article className={`dev-log-item${open ? " is-open" : ""}`}>
    <button className="dev-log-item-toggle" type="button" aria-expanded={open} aria-controls={contentId} onClick={() => setOpen((value) => !value)}>
      <span className="dev-log-type"><Icon aria-hidden={true} /><span>{label}</span></span><strong>{item.title}</strong>
      <span className={`dev-log-status status-${item.status}`}>{SHARED_FEEDBACK_STATUS_LABELS[item.status]}</span><ChevronDown className="dev-log-chevron" aria-hidden="true" />
    </button>
    {open && <div className="dev-log-item-content" id={contentId}>
      <dl className="dev-log-meta"><div><dt>Typ</dt><dd>{label}</dd></div><div><dt>Stav</dt><dd>{SHARED_FEEDBACK_STATUS_LABELS[item.status]}</dd></div>
        <div><dt>Vytvořeno</dt><dd><time dateTime={item.createdAt}>{new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(item.createdAt))} UTC</time></dd></div><div><dt>Zdroj</dt><dd>{item.source}</dd></div></dl>
      <section><h4>Shrnutí</h4><p>{item.summary}</p></section>
      {item.details.map((detail, index) => <section key={`${detail.label}-${index}`}><h4>{detail.label}</h4><p>{detail.text}</p></section>)}
      {item.note.trim() && <section className="dev-log-note"><h4>Poznámka</h4><p>{item.note}</p></section>}
    </div>}
  </article>;
}
export function DevLogPanel({ result, onClose }: { result: SharedFeedbackResult; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const items = result.data ? sortSharedFeedback(result.data.items) : [];
  useEffect(() => { closeRef.current?.focus(); const listener = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", listener); return () => window.removeEventListener("keydown", listener); }, [onClose]);
  return <div className="dev-log-overlay" role="dialog" aria-modal="true" aria-labelledby="dev-log-title" id="dev-log-panel"><div className="dev-log-panel">
    <header className="dev-log-header"><div><span className="dev-log-kicker">Developer-only · read-only</span><h2 id="dev-log-title">DEV LOG</h2></div><span className="dev-log-count">{items.length} {items.length === 1 ? "položka" : "položek"}</span><button ref={closeRef} type="button" className="dev-log-close" onClick={onClose} aria-label="Zavřít DEV LOG"><X aria-hidden="true" /></button></header>
    <div className="dev-log-body"><section className="dev-log-card" aria-label="Shared Feedback">{result.error ? <p className="dev-log-error" role="alert">{result.error}</p> : items.length ? items.map((item) => <FeedbackItem item={item} key={item.id} />) : <p className="dev-log-empty">Žádné položky Shared Feedback.</p>}</section></div>
  </div></div>;
}
