# APU Customer Foundation — ověřený stav a cílové fáze

**Datum zdrojového auditu:** 2026-10-24. **Dokumentační status:** SOURCE-BACKED CURRENT + APPROVED FUTURE PLANS; zdrojové tvrzení není automaticky tvrzením o nasazeném runtime.


## PILOT MINIMUM — rozhodnutý rozsah a otevřené podmínky (2026-10-26)

**Aktuální limit: maximálně 48 učitelů** (nahrazuje historický předběžný limit „≤ 50“ uvedený dále v auditu z 2026-10-24; nejde o ověřené aktuální obsazení ani limit Access licencí). Uživatel výslovně určil **Michala Roupce** jako odpovědnou osobu za zpracování dat v pilotu. APU připravují **dvě fyzické osoby**; druhá osoba a přesná GDPR role obou (samostatný/společný správce versus jiný vztah) zůstávají k určení. Michal je prozatím **určený provozní vlastník/kontaktní osoba**, nikoli automaticky jediný právní správce nebo formální DPO.

**Provozní hranice:** dovolena skutečná pedagogická potřeba a pozorování bez přímo či nepřímo identifikovatelného žáka; zakázány skutečné i modelové diagnózy a zdravotní/poradenské zprávy. Žádné serverově trvale ukládané projekty, telemetry DEV OFF/OFF. Aktuální potvrzení pravidel má v DEV testovací TTL 24 h; PUBLIC retence rozhodnuta není.

**Podklad:** [LEGAL_GDPR_READINESS.md §9 — PILOT MINIMUM](LEGAL_GDPR_READINESS.md#9-pilot-minimum--omezeny-pilot-do-48-ucitelu-navrh-2026-10-26). Obsahuje krátký návrh pravidel pro učitele, šablonu čl. 13 informace, minimální incident/výmazový postup, DPIA screening a jasné rozlišení PILOT vs Stage 1.

**STAV:** schválený produktový rozsah PILOT MINIMUM (potvrzení uživatele 2026-10-26); provozní a právní údaje zbývá doplnit. Externí onboarding zůstává NOT AUTHORIZED. **Externí onboarding do 48 účastníků dosud NENÍ schválen**, protože chybí identita právního správce/společných správců, funkční kontakt, právní tituly, aktuální dodavatelské/DPA/přenosové skutečnosti, publikační retenční údaje, DPIA screening a minimální proces práv/incidentů. Před přizváním osob tyto úzce vymezené body uzavřít; rozsáhlá Stage 1 customer-auth/Projects/billing agenda může zůstat odložená. G2/G4/G5 a PUBLIC deployment jsou samostatně NOT AUTHORIZED.

## LEGAL-P0-R1 — aktuální DEV/LEGAL evidence reconciliation (2026-10-26)

**Tento dodatek aktualizuje stav DEV po auditu z 2026-10-24; historický baseline v částech A–D nepřepisuje. PUBLIC není v této dávce nově ověřen ani změněn.** Approval-ready dokumentační návrh je v [LEGAL_GDPR_READINESS.md, §8](LEGAL_GDPR_READINESS.md#8-legal-p0-r1--podklad-pro-schvaleni-2026-10-26).

| Oblast | Stav doložený přesným zdrojem/evidencí | Nevyvozovat |
|---|---|---|
| Git/source versus hosting | `dev` je stále `fc8ac5520b7b49b442bedc47558c73f20ce2bea6`; aplikace PR #83 `cb48a9de19d5847b0ca68d097f8bb572e4e6992d` byla samostatně nasazena do DEV Workeru dle PR #85 `1729fce641fab5015407acdd5be06fe8941ed58c`, jako Worker version `895e443e-3322-4b2d-91f0-9523220a9bbf` se 100% traffic | Neznamená merge PR #83 ani PUBLIC release |
| DEV KV a pravidla | Receipt KV `PILOT_RULES_ACCEPTANCE`, TTL 86 400 sekund, omezený DEV operátor; Access ochrana PASS | 24 hodin je pouze DEV-test retention, nikoliv PUBLIC politika; samotný receipt není souhlas za žáka |
| První přijetí pravidel | První hosted pokus zobrazil chybu; pozdější GET 200/PRESENT a reload UI PASS, původní POST HTTP evidence neexistuje | Neoznačovat first-acceptance reliability za vyřešenou |
| Statelesness / browser | MAIN request používá `store:false`, aktuální Zápisník/omezený dialogový kontext; `app/notebook-storage.ts` zachovává owner-scoped lokální data (developer `localStorage`, tester `sessionStorage`) | Není doložena nulová retence u poskytovatelů ani úplný výmaz všech kopií pouhým logout/resetem |
| Telemetry | Nasazený DEV má D1 binding, avšak enabled=0 a metadata=0; po kontrolovaném smoke 0 sessions/events/ai_calls, bez pre-smoke snapshotu | Není ověřen aktivní hosted sběr, přesná delta ani G2/G4/G5 |
| PUBLIC / GDPR | PUBLIC zůstává dle posledního ověřeného podkladu beze změny; LEGAL-P0-R1 připravuje texty a approval matrix | Není doložen nový PUBLIC audit, právní schválení nebo povolení reálných žákovských dat |

**Hranice povolených vstupů navržená ke schválení:** učitel může formulovat skutečnou pedagogickou potřebu, pozorované projevy a nezbytný kontext, ale konkrétní žák nesmí být identifikovatelný ani kombinací údajů; nevkládat skutečné ani modelové diagnózy, zprávy či kontakty. Pravidla jsou preventivní kontrolou, ne automatickým důkazem anonymizace.

**Otevřené approval gates:** controller/processor role individuální učitel × škola, správce a kontakt, účely/právní tituly podle domény, DPA/subprocesory/přenosy, retence/výmaz/logy, DPIA screening, PUBLIC informační text a receipt TTL. DEV first-acceptance POST test potřebuje vlastní bezpečně instrumentované schválení. Telemetry G2/G4/G5 a PUBLIC deployment zůstávají NOT AUTHORIZED.

## A. PUBLIC Pilot — současný stav a záměr

**Zdrojové/operátorské podklady**
- `public` HEAD: `284c108d4ae053335a524bacc773a2af5c3a4779`; operátorem doložená PUBLIC doména: `https://apu.catsystem.ai/`, Worker `apu-ms-site`.
- Operátorská evidence k 2026-10-23: Cloudflare Access policy `APU PUBLIC` obsahovala **dvě konkrétně povolené identity**; anonymní požadavek na doménu směrován na Access login a autentizované `/api/session` vrátilo developer identitu. Nejde o nezávislý aktuální Cloudflare read-back ani o 50 aktivních uživatelů.
- Platforma dle zadání: Workers Paid aktivní (orientačně $5/měsíc), Zero Trust Free. Dříve doloženo 2/50 Access seats, **obsazenost a účetní podmínky před dalším onboardingem znovu ověřit**. Pilotní cílový strop `<= 50` není strop pro souběžné sessions ani nahrazení Access seat metriku.
- PUBLIC aplikační session je ověřována Cloudflare Access JWT; UI session boundary a API používají Access identitu. Public pilot není potvrzený plný end-to-end F1→F2→F3 PASS; platí aktuální [runtime evidence](../CURRENT/APU_SITE_RUNTIME_TECHNICAL_CURRENT.md) a KI-01/KI-03.

**Záměr pro PUBLIC pilot**
- Zachovat stávající Access gate a funkční pilot beze změny customer-auth.
- **P0 LEGAL/GDPR** vyjasnit dříve než rozšířit skupinu nebo připustit reálné citlivé pedagogické údaje.
- Minimalizovat zadávané osobní údaje; jasné pravidlo „nevkládat jména/identifikátory“ je opatření, nikoli automatická anonymizace nebo univerzální souhlas.
- Zmapovat skutečnou AI spotřebu a existující serverový usage ledger; návrh budget alert/kill switch prověřit, ale žádná tvrzení o existujících tvrdých limitech bez testu.
- Nespojovat PUBLIC s nehotovou pilotní telemetrií: ta má oddělenou DEV roadmapu a příslušné privacy gates.

## B. DEV Pilot — současný stav a příprava

**Source / runtime**
- `dev` HEAD: `fc8ac5520b7b49b442bedc47558c73f20ce2bea6`; technický stack Worker, TypeScript/React/Vinext `0.0.50`, Drizzle `0.45.2`, Wrangler `4.150.0`.
- Dedikovaný DEV Worker `apu-ms-site-dev` a Access aplikace byly operátorem v dokumentaci z 2026-10-21 doloženy jako připravené a hosted-smoke-testované. Neprokazuje to nové Clerk přihlášení, provider-backed E2E ani aktuální binding read-back.
- `app/access-auth.ts` ověřuje Access JWT a vrací `{email, role: developer|tester}`; `app/api/session/route.ts`, `app/access-session-boundary.tsx`, `app/page.tsx` a AI API jsou závislé na této identitě.
- `app/notebook-storage.ts` používá normalizovaný **e-mail jako owner key**; developer data v localStorage, tester v sessionStorage. `db/schema.ts` je záměrně prázdné. Žádné serverové APU Projects není na této základně implementováno.
- Serverový AI usage ledger existuje; obecný komerční entitlement, billing ani tvrdý zákaznický AI rozpočtový gate nejsou doloženy.
- Samostatné telemetrické soubory (`app/telemetry/*`, `app/api/telemetry/*`) nejsou v base `dev`; jsou ve vývojových PR/větvích a P0 collection zůstává disabled/unprovisioned, není to ověřený PUBLIC deployment.

**Záměr DEV**
- Paralelně a izolovaně připravit **Clerk Hobby PoC**: e-mail OTP, invitation-only, validace serverové session, logout/revokace, SSR/route cookies, ochrana API, Vinext/Worker build. Bez registrace testovacích účtů či změny Access, dokud nebude separátně schváleno.
- Připravit provider-neutral identity contract s neměnným `appUserId`, nikoli spoléhat na e-mail.
- Navrhnout **APU Projects**: D1 jako kandidát, model vlastnictví, Save/Open/delete/export, restart/reload/cross-device recovery, retence, backup; žádná skutečná databáze zatím.
- Vyhodnotit privacy/GDPR requirements společné PUBLIC a budoucímu Stage 1.
- Připravit kontrakt komerčních entitlement a ochrany AI spotřeby; neposouvat billing do pilotu.

## C. Stage 1 — schválený záměr, NE aktuální funkce

**Cílová škála:** 50–1 000 platících učitelů. Nevyžaduje více providerů, školní organizace ani enterprise SSO v první verzi.

| Vrstva | Cíl Stage 1 | Co ještě rozhodnout |
|---|---|---|
| Auth | Clerk Pro + stabilní interní app ID | MFA policy, session expiry, invite/open registration, provider legal gate |
| Projects | D1-backed, tenant/owner isolation; Save/Open/rename/duplicate/delete/export | Schéma, snapshots, limitační kvóty, přílohy mimo scope |
| Monetizace | Minimálně jeden placený tarif, schema připravené pro pozdější více tarifů | Ceny, VAT/daň, fakturační řešení CZK, entitlement grace/suspension |
| AI | Server-side autorizace + per-user budget/concurrency guard | Bezpečné limity podle skutečné pilotní spotřeby |
| Provoz | Support/recovery, audit bez obsahu, incident plan, backups/restore | Retence, správa, SLA a provozní monitoring |
| Soukromí | Privacy notice, DPA/subprocessors/transfers, mazání a export | Zpracování pedagogického obsahu dětí; zda vůbec umožnit identifikovatelné případy |

**V Stage 1 zatím nepředpokládat:** školní SSO, týmové sdílení, real-time kolaboraci, pokročilé revize, multi-plan billing, vlastní auth infrastrukturu. Připravit rozšiřitelnost, neimplementovat neschválené funkce.

## D. Evidence ledger a limity

| Tvrzení | Evidence | Limity |
|---|---|---|
| `dev`/`public` commit | GitHub ref read-back 2026-10-24 | HEAD se může změnit, před realizací zopakovat |
| PUBLIC doména a Access smoke | Canonical Runtime Current, operator report 2026-10-23 | Není nový hosted test ani potvrzení všech testerů |
| DEV Worker/Access | Runtime Current, operator report 2026-10-21 | Není potvrzení Clerk/runtime integration |
| Access email owner, API identity | `app/access-auth.ts`, `app/notebook-storage.ts`, `app/api/session/route.ts` @ dev | Zdrojový kód nedokládá provozní success |
| Chybějící perzistence | `db/schema.ts`, `B-02`, browser storage | Neodvozuje externí cloudové účty mimo repo |
| Pilotní telemetrie | Nezačleněné telemetry PR branches a dokumentace | Neoznačovat za běžící PUBLIC telemetry |

**Při rozporu:** aktualizovat evidence po skutečném ověření, nepřepisovat historii ani nehlásit naplánované funkce jako současný runtime.
