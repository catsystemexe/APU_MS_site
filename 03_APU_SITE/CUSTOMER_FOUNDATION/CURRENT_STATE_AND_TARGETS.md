# APU Customer Foundation — ověřený stav a cílové fáze

**Datum zdrojového auditu:** 2026-10-24. **Dokumentační status:** SOURCE-BACKED CURRENT + APPROVED FUTURE PLANS; zdrojové tvrzení není automaticky tvrzením o nasazeném runtime.

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
