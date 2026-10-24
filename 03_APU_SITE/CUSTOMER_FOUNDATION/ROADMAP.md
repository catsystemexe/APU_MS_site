# Customer Foundation — roadmap, priority a logické pracovní bloky

**Status:** PLANNING; žádný workstream níže není považován za implementovaný jen díky této dokumentaci.
**Výchozí strategie:** PUBLIC pilot nerušit, LEGAL-P0 vyřešit hned; v DEV mohou samostatně paralelně běžet Clerk PoC a návrh Projects. Stage 1 až na základě výsledků pilotu a schválených gates.

## 1. Priority / pořadí

| ID | Priorita | Pracovní blok | Prostředí | Závislosti | Minimum přijatelného výsledku |
|---|---|---|---|---|---|
| **L0** | **P0, okamžitě** | PUBLIC pilot GDPR/legal discovery a risk containment | Chat + read-only code/ops audit | Aktuální flow, provozovatel/legal reviewer | Inventář dat/procesorů, pravidla vstupů, privacy dokumentace, jasná povolená data a schvalovací gate |
| **C0** | **P0, paralelně** | Evidence pilot Access seats/AI cost/safe operating limits | Read-only GitHub + operator Cloudflare evidence | L0 jen pro zveřejnění postupů | Aktuální kapacita Access; usage observability; rozhodnutí o účelném budget alert/kill switch |
| **A1** | **P1, paralelně s P1 Projects** | Clerk Hobby compatibility PoC | Dedicated spike branch z `dev`, Codex Cloud + local/approved hosted smoke | Auth config approval pro reálný login | E-mail OTP/invite/session/logout/revocation/SSR, guarded APIs, Vinext/Workers PASS/BLOCKED |
| **P1** | **P1, paralelně s A1** | APU Projects design | Chat/GitHub docs-only větev | B-02, současný Zápisník/F2/F3 lifecycle | Data schema, owner policy, Save/Open, concurrency/recovery, retention/backup a effort estimate |
| **I1** | P2, po A1 + P1 | Provider-neutral identity + storage migration design | Chat → Codex Cloud při schválení | A1, L0, P1 | Stabilní `appUserId`, owner mapping, auth/customer role, bezpečné account/linking, test plan |
| **P2** | P2, po I1 | Projects MVP implementace | Codex Cloud izolovaně od telemetry P0 | I1, P1, legal approval | Serverově vlastní projekty, CRUD/export, bezpečnostní/restore verifikace |
| **E1** | P2, Stage 1 decision | Commercial entitlement/AI limits + billing design | Chat/design | C0 pilot usage, L0, I1 | 1 základní tarif, CZK billing requirements, bezpečné serverové authorization gates |
| **E2** | P3, Stage 1 build | Billing+entitlement+AI guard implementation | Codex Cloud | E1, I1, finance/legal rozhodnutí | Nepovolené placené AI volání nemůže vytvořit upstream náklad, verifikovaný webhook lifecycle |
| **R1** | Release gate | Komerční acceptance/security/GDPR/recovery | Local + hosted controlled smoke | P2, E2, legal | Explicitní PASS rozhodnutí; samostatné approval pro `public` + deployment |

**P0 = urgentní práce pro existující PUBLIC pilot; P1 = předvývojová validace bez produkční změny; P2 = budoucí integrace; P3 = komerční dokončení a release.** Toto pořadí není změna současné product roadmap F1/F2/F3.

## 2. Paralelní DEV pracovní proudy

```text
PUBLIC Pilot (Cloudflare Access; no auth migration)
  ├─ L0 GDPR/legal audit ──┐
  └─ C0 seat + AI costs ───┼──> PUBLIC pilot policy/release decision
                          │
DEV from verified dev HEAD │
  ├─ spike/clerk-hobby-vinext ── A1 ─┐
  └─ design/projects-d1 ─────── P1 ─┼──> I1 identity/storage design
                                    ├──> P2 Projects MVP
                                    └──> E1 entitlement/billing plan
                                             ↓
                                        E2 commercial build
                                             ↓
                                        R1 Stage 1 gates
```

**Technické pravidlo:** každá feature/spike větev vznikne z čerstvého `dev` ref po ověření HEAD, má vlastní PR a vlastní Verification Report. Nevětvit A1 od neintegrovaných telemetry PR; neslučovat A1 a P1 kód před ukončením experimentů. Paralelní Git větve samy **neizolují Cloudflare Worker**, secrets ani databázi. Testovací Clerk účet/projekt/callback origin se připravuje až po operátorském schválení. Nenahrávat reálné žákovské údaje jako fixtures.

## 3. Kde začít (první praktická sekvence)

**První krok = L0/PUBLIC privacy intake**, nikoli okamžitá instalace Clerk.

1. Získat aktuální, věrohodnou mapu dat (login, browser storage, AI request/response, logs, vector store, export, pilot telemetry) a seznam zpracovatelů; vyznačit neověřené body.
2. Stanovit pro PUBLIC pilot hranici povolených údajů: modelové/neidentifikující vs skutečné žákovské případy; určit vlastníka právního rozhodnutí. Připravit text pravidel a informační povinnost, nikoli je bez approval nasadit.
3. Spolu s provozovatelem ověřit Access seat kapacitu/allowed identities, Data Protection a skutečné AI náklady; současná evidence 2/50 není příslib 50 aktivních seatů kdykoli.
4. Paralelně připravit **A1 PoC test matrix** a **P1 Projects design brief**, ještě bez auth provider provisioning nebo D1 vytvoření.
5. Po úspěšném právním review začít schvalovat malé, izolované implementační příkazy podle `05_WORKFLOW/INSTRUCTIONS_ROLE.md`.

## 4. Rámcové execution/verification profily pro následnou roli INSTRUCTIONS

| Pracovní blok | Minimum sufficient executor | Change Radius | Verification | Poznámka |
|---|---|---|---|---|
| L0 právní/datový audit a dokumentace | Chat + repo connector; případně Work pouze když nutno kontrolovat host/runtime | R0 | V1 | Výstupy musí schválit osoba odpovědná za GDPR |
| C0 resource/cost read-only evidence | GitHub/API + operator Cloudflare local/dashboard | R0 | V1 | Nezaměňovat source a runtime |
| A1 Clerk PoC | Codex Cloud + lokální/oddělený hosted smoke | R2 | V2 | Upřednostnit medium; High pouze při runtime rozporu |
| P1 Project architecture docs | Chat + GitHub docs | R0 | V1 | Neimplementovat databázi |
| I1 identita + session/storage | Codex Cloud | R3 | V3 | High; identity switch je security-critical |
| P2 Projects persistence | Codex Cloud + local smoke | R3 | V3 | Vyžaduje právně schválenou retenci |
| E1 tariffs/billing design | Chat | R0 | V1 | Žádný platební provider není schválen |
| E2 entitlement / spend guard | Codex Cloud | R3 | V3 | High; upstream AI náklady |
| R1 production release | Samostatný autorizovaný release batch | R4 | V3 | Bez výslovného schválení NENAHRÁVAT |

Jde o **planning estimates**, nikoli hotové Codex executor prompty; finální INSTRUCTIONS musí pro schválenou dávku doplnit její vlastní Implementation Profile, Goal/Scope/Non-scope, changes, acceptance, verification, Documentation & Tracking a Deployment Authorization.

## 5. Akceptační a stop-gates

**L0:** GDPR práva a role nejsou odhadována podle pouhé podmínky „nevkládej jména“; je schválen allowed-data policy, privacy notice, processor inventory, retention, incident handling. Do té doby žádný rozšířený pilot s identifikovatelnými žáky bez samostatného posouzení.

**A1:** bez provedeného reálného session/route/login + logout testu v relevantním runtime není Clerk označen jako „compatible“. Při blockeru STOP bez úpravy PUBLIC Access.

**P1/P2:** uložení a načtení dat jiného uživatele nemožné; project owner není e-mail; server kontroluje vlastníka u každé operace; ošetřeny souběžné revize a obnovitelnost.

**E1/E2:** subscription neplyne z přihlášení; server validuje entitlement a rozpočtové limity před každým potenciálně placeným AI voláním, včetně retry/fallback/streamingu.

**R1:** samotná success CI, GitHub PR nebo lokální test nikdy neznamenají produkční autorizaci. Release na chráněný `public` jen schváleným omezeným PR, separátní explicitní deployment approval a hosted read-back.

## 6. Priority, které záměrně odkládáme

Organizace/školy, institucionální SSO, sdílení, real-time collaboration, složitější historie, attachment storage, několik plánů, self-hosted auth stack. Dokumentované jako possible evolution, ne Stage 1 acceptance.

## 7. Dokumentace a tracking

- Tato roadmapa **navazuje** na existující [B-02 Durable project Save/Open](../BACKLOG/APU_SITE_BACKLOG.md), nevytváří B-02 podruhé.
- Neuvádět source telemetry B1–B4 jako sloučenou a aktivovanou.
- Pro skutečně realizované a ověřené následné batch pak podle jejich profilů aktualizovat příslušné canonical CURRENT, BACKLOG, CHANGELOG; změny Known Issues jen při potvrzeném blockeru/chybě.
- Tato dokumentační větev: Documentation Impact = DESIGN/ROADMAP, `Changelog: NO`, `Backlog: NONE`, `Known Issues: NONE`, `Deployment Authorization: NOT AUTHORIZED`.
