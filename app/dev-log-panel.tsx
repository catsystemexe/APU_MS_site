"use client";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { Bug, ChevronDown, MessageCircle, Sparkles, X } from "lucide-react";
import { canTransitionDevLogStatus, DEV_LOG_STATUSES, DEV_LOG_TYPES, mergeDevLogState, parseDevLogStateOverride, SHARED_FEEDBACK_STATUS_LABELS, sortSharedFeedback, type DevLogStatus, type DevLogType, type SharedFeedbackItem, type SharedFeedbackResult } from "./shared-feedback";

const TYPE_META: Record<DevLogType, { label: string; Icon: ComponentType<{ "aria-hidden"?: boolean }> }> = {
  bug: { label: "Chyba", Icon: Bug }, improvement: { label: "Zlepšení", Icon: Sparkles }, discussion: { label: "Diskuze", Icon: MessageCircle },
};
const dateFormatter = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function FeedbackItem({ item, pending, onStatusChange }: { item: SharedFeedbackItem; pending: boolean; onStatusChange: (status: DevLogStatus) => void }) {
  const [open, setOpen] = useState(false);
  const contentId = `dev-log-item-${item.id}`;
  return <article className={`dev-log-item status-${item.status}${open ? " is-open" : ""}`}>
    <div className="dev-log-item-row">
      <button className="dev-log-item-toggle" type="button" aria-expanded={open} aria-controls={contentId} onClick={() => setOpen((value) => !value)}>
        <time dateTime={item.createdAt}>{dateFormatter.format(new Date(item.createdAt))}</time><strong>{item.title}</strong><ChevronDown className="dev-log-chevron" aria-hidden="true" />
      </button>
      <div className="dev-log-statuses" aria-label={`Stav položky ${item.title}`}>
        {DEV_LOG_STATUSES.map((status) => {
          const active = item.status === status;
          const allowed = canTransitionDevLogStatus(item.status, status);
          return <button key={status} type="button" className={`dev-log-status status-${status}${active ? " is-active" : ""}`} aria-pressed={active} disabled={pending || !allowed} title={!allowed && item.status === "done" && status === "new" ? "Hotovou položku lze vrátit pouze do stavu ŘEŠÍME" : undefined} onClick={() => onStatusChange(status)}>{SHARED_FEEDBACK_STATUS_LABELS[status]}</button>;
        })}
      </div>
    </div>
    {open && <div className="dev-log-item-content" id={contentId}>
      {item.details.map((detail, index) => <section key={`${detail.label}-${index}`}><h4>{detail.label}</h4><p>{detail.text}</p></section>)}
      {item.note.trim() && <section className="dev-log-note"><h4>Poznámka</h4><p>{item.note}</p></section>}
    </div>}
  </article>;
}

export function DevLogPanel({ result, open, onClose }: { result: SharedFeedbackResult; open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [items, setItems] = useState(() => result.data?.items ?? []);
  const [activeType, setActiveType] = useState<DevLogType>("bug");
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const visibleItems = items.filter((item): item is SharedFeedbackItem & { type: DevLogType } => DEV_LOG_TYPES.includes(item.type as DevLogType) && DEV_LOG_STATUSES.includes(item.status as DevLogStatus));
  const unsupportedCount = items.length - visibleItems.length;
  const changeStatus = async (id: string, status: DevLogStatus) => {
    const previous = items.find((item) => item.id === id);
    if (!previous || pendingIds.has(id) || !canTransitionDevLogStatus(previous.status, status)) return;
    setPersistenceError(null);
    setPendingIds((current) => new Set(current).add(id));
    setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item));
    try {
      const response = await fetch("/api/devlog-state", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
      const body = await response.json() as unknown;
      const stored = response.ok ? parseDevLogStateOverride(body) : null;
      if (!stored) throw new Error("persistence_failed");
      setItems((current) => current.map((item) => item.id === id ? mergeDevLogState(item, stored) : item));
    } catch {
      setItems((current) => current.map((item) => item.id === id ? previous : item));
      setPersistenceError("Změnu statusu se nepodařilo uložit. Původní stav byl obnoven.");
    } finally {
      setPendingIds((current) => { const next = new Set(current); next.delete(id); return next; });
    }
  };
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/devlog-state", { cache: "no-store" }).then(async (response) => {
      const body = await response.json() as { items?: Record<string, unknown> };
      if (!response.ok || !body.items || typeof body.items !== "object") throw new Error("persistence_unavailable");
      if (cancelled) return;
      setItems((current) => current.map((item) => mergeDevLogState(item, parseDevLogStateOverride(body.items?.[item.id]))));
      setPersistenceError(null);
    }).catch(() => { if (!cancelled) setPersistenceError("Persistentní stav DEV LOGu se nepodařilo načíst."); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!open) {
      const resetTimer = window.setTimeout(() => setActiveType("bug"), 0);
      return () => window.clearTimeout(resetTimer);
    }
    if (!window.matchMedia("(max-width: 767px), (min-width: 768px) and (orientation: portrait)").matches) closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const listener = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", listener);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", listener); };
  }, [open, onClose]);
  const activeItems = sortSharedFeedback(visibleItems.filter((item) => item.type === activeType));
  const ActiveIcon = TYPE_META[activeType].Icon;
  return <div className={`dev-log-overlay${open ? " is-open" : " is-closed"}`} role="dialog" aria-modal="true" aria-hidden={!open} aria-labelledby="dev-log-title" id="dev-log-panel"><div className="dev-log-panel">
    <header className="dev-log-header"><div className="dev-log-heading"><h2 id="dev-log-title">DEV LOG</h2><span className="dev-log-kicker">developer-only · obsah jen pro čtení</span></div><span className="dev-log-count">{visibleItems.length} {visibleItems.length === 1 ? "položka" : "položek"}</span><button ref={closeRef} type="button" className="dev-log-close" onClick={onClose} aria-label="Zavřít DEV LOG"><X aria-hidden="true" /></button></header>
    <div className="dev-log-body">{result.error ? <p className="dev-log-error" role="alert">{result.error}</p> : <>{persistenceError && <p className="dev-log-error" role="alert">{persistenceError}</p>}{unsupportedCount > 0 && <p className="dev-log-warning" role="status">{unsupportedCount} legacy {unsupportedCount === 1 ? "položka není" : "položky nejsou"} v tomto přehledu podporováno.</p>}<div className="dev-log-columns">{DEV_LOG_TYPES.map((type) => { const columnItems = sortSharedFeedback(visibleItems.filter((item) => item.type === type)); const { Icon, label } = TYPE_META[type]; return <section className="dev-log-column" aria-labelledby={`dev-log-column-${type}`} key={type}><header className="dev-log-column-header"><span><Icon aria-hidden={true} /><h3 id={`dev-log-column-${type}`}>{label}</h3></span><span>{columnItems.length}</span></header><div className="dev-log-list">{columnItems.length ? columnItems.map((item) => <FeedbackItem item={item} pending={pendingIds.has(item.id)} onStatusChange={(status) => void changeStatus(item.id, status)} key={item.id} />) : <p className="dev-log-empty">Žádné položky.</p>}</div></section>; })}</div><section className="dev-log-mobile-category" aria-labelledby="dev-log-mobile-category-title"><header className="dev-log-column-header"><span><ActiveIcon aria-hidden={true} /><h3 id="dev-log-mobile-category-title">{TYPE_META[activeType].label}</h3></span><span>{activeItems.length}</span></header><div className="dev-log-list">{activeItems.length ? activeItems.map((item) => <FeedbackItem item={item} pending={pendingIds.has(item.id)} onStatusChange={(status) => void changeStatus(item.id, status)} key={item.id} />) : <p className="dev-log-empty">Žádné položky.</p>}</div></section></>}</div>
    <nav className="dev-log-rail" aria-label="Kategorie DEV LOGu">{DEV_LOG_TYPES.map((type) => { const { Icon, label } = TYPE_META[type]; return <button type="button" key={type} className={`dev-log-rail-button${activeType === type ? " is-active" : ""}`} aria-label={label} aria-pressed={activeType === type} title={label} onClick={() => setActiveType(type)}><Icon aria-hidden={true} /></button>; })}</nav>
  </div></div>;
}
