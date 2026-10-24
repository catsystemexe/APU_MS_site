# APU — Customer Foundation: pilot, autentizace, právní připravenost a projekty

**Status:** APPROVED DIRECTION / PLANNED; žádná nová zákaznická autentizace, databáze projektů ani billing nejsou tímto dokumentem implementovány.
**Stav podkladů:** 2026-10-24. **Výchozí source:** `catsystemexe/APU_MS_site`, `dev` HEAD `fc8ac5520b7b49b442bedc47558c73f20ce2bea6`; `public` HEAD `284c108d4ae053335a524bacc773a2af5c3a4779`.
**Rozsah:** výhradně plánování vrstvy přístupu, právního základu a perzistence APU. Nezměňuje pedagogickou architekturu ani její kanonické zdroje.

## 1. Rozhodnutý směr

| Prostředí / fáze | Autentizace | Práce s daty | Komerce | Stav |
|---|---|---|---|---|
| **PUBLIC Pilot** (cílový strop 50 účastníků) | Zachovat Cloudflare Access, Workers Paid + Zero Trust Free | Nynější browser-local Zápisník; priorita právní připravenosti | Bez předplatného | Aktuální směr, neměnit auth během pilotu |
| **DEV Pilot / příprava** | Izolovaně ověřit Clerk Hobby; zatím bez přepnutí DEV ani PUBLIC | Zhodnotit D1 projekty a migraci identity, bez produkční DB | Připravit kontrakt entitlement a AI cost guardrails | Plán / budoucí PoC |
| **Stage 1** (50–1 000 platících učitelů) | Clerk Pro jako primární kandidát | Serverově uložené, izolované APU Projects (D1 kandidát) | Zatím nespecifikované tarify, billing v Kč, omezení AI nákladů | Budoucí produktový cíl |

Clerk je **preferovaná varianta, nikoli potvrzená produkční integrace**. Záložní varianta Supabase Auth se posoudí jen při právním/technickém blockeru; Better Auth + D1 není výchozí směr pro první komerční spuštění.

## 2. Co dokumenty řeší

- [CURRENT_STATE_AND_TARGETS.md](CURRENT_STATE_AND_TARGETS.md) — přesně rozlišuje ověřený source, operator-reported hosting a budoucí plán pro PUBLIC, DEV a Stage 1.
- [LEGAL_GDPR_READINESS.md](LEGAL_GDPR_READINESS.md) — P0 právní/datový workstream pro EXISTUJÍCÍ PUBLIC pilot; kontrolní brány a konkrétní výstupy (bez předstírání právního schválení).
- [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md) — hranice identity/session, projektů, AI entitlement, billing, telemetrie a migrace.
- [ROADMAP.md](ROADMAP.md) — pořadí prací, paralelizace, závislosti, acceptance gates a první krok.

## 3. Rozhodnutí a hranice

1. PUBLIC zůstává na Cloudflare Access; limit **do 50 účastníků pilotu** není důkaz aktuálních 50 vytvořených účtů ani prokazatelná kapacita všech dalších Zero Trust seatů.
2. `dev` = aktivní vývojová větev, `public` = chráněná release větev, `main` = legacy/reference. Starší zmínky o `next` ve starších dokumentech nejsou aktuálním povolením větve použít.
3. DEV auth experiment může běžet v samostatné **feature/spike branch založené z aktuálního `dev`**, bez společného PR s telemetrií nebo projekty. Git branch **není hosting/environment isolation**; pokud PoC vyžaduje skutečný provoz, musí mít vlastní schválený testovací kontext, izolované cookies/secrets/redirect URL/identitní nastavení. Žádná automatická změna stávajícího hosted DEV Workeru.
4. Source telemetrie P0 je v oddělených pracovních větvích/PR, není součástí výchozího `dev` HEAD. Neotvírat její engine jako součást auth/projektového experimentu.
5. Zápisník → Rozbor → Výstup zůstává zachován; ukládání je technická vrstva, nikoliv nová kanonická pedagogická autorita.
6. Jakýkoli přechod na Clerk, založení DB, produkční release, právní publikace nebo změna Access policy vyžaduje samostatnou autorizaci.

## 4. Zdroj pravdy / orientace v repo

- [APU Site Runtime Technical Current](../CURRENT/APU_SITE_RUNTIME_TECHNICAL_CURRENT.md) — současný source/runtime a provenience hosted evidence.
- [APU Site Backlog](../BACKLOG/APU_SITE_BACKLOG.md) — existující **B-02 Durable project Save/Open**; zde nevytvářet duplicitní backlog.
- [APU Site Known Issues](../KNOWN_ISSUES/APU_SITE_KNOWN_ISSUES.md) — KI-01/KI-03 remain independent.
- [APU Product Decisions](../../01_PRODUCT/PRODUCT_DECISIONS/APU_PRODUCT_DECISIONS.md) a [Architecture](../../01_PRODUCT/ARCHITECTURE/APU_ARCHITECTURE.md) — pedagogické invarianty.
- [Project Rules](../../05_WORKFLOW/APU_PROJECT_RULES.md) a [AGENTS.md](../../AGENTS.md) — platná pravidla práce, branch/deployment authorization.

**Tracking této dokumentační dávky:** Documentation Impact = DESIGN/ROADMAP; Changelog = NO (žádná funkce); Backlog = NONE (B-02 již existuje); Known Issues = NONE. **Deployment Authorization: NOT AUTHORIZED.**
