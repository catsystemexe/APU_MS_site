# Customer Foundation — architektonická rozhodnutí a technické kontrakty

**Status:** APPROVED DIRECTION / UNIMPLEMENTED FUTURE DESIGN. Nejde o API specification ani autorizaci měnit současnou aplikaci.
**Base evidence:** GitHub `dev` `fc8ac5520b7b49b442bedc47558c73f20ce2bea6`, 2026-10-24. Historické nepřesnosti mimo tento scope neopravovat.

## 1. Rozdělení odpovědností

| Vrstva | Dnes | Budoucí owner | Explicitní hranice |
|---|---|---|---|
| Interní DEV / PUBLIC pilot auth | Cloudflare Access JWT | Access zůstává pro interní DEV/admin | Nevyužívat Zero Trust customer seats jako komerční architekturu |
| Customer auth | Neimplementováno | Clerk Pro (PoC Hobby) | Jen ověřování identity/session, ne pedagogické úložiště |
| APU identity/roles | E-mail + developer/tester | Stable `appUserId` a serverové role | E-mail není vlastnický klíč |
| Projects | Browser local/session Zápisník | Serverově izolovaný project store (D1 kandidát) | Nezaměňovat s APU Session JSON nebo telemetrií |
| Entitlement/AI spend | Login + developer/tester capabilities, usage ledger | Server-side plan/permission/budget gate | Login není aktivní předplatné |
| Billing | Neimplementováno | Oddělený CZK billing provider | Klientský success callback není důkaz zaplacení |
| Telemetry | P0 vyvíjeno odděleně, collection disabled | Samostatná telemetry DB/účel | Nemíchat auth/project PII s pseudonymy |

## 2. Auth/session/authorization boundary

**Aktuální source body:**
- `app/access-auth.ts`: JWT signature/JWKS issuer + audience → `email`, `developer|tester`.
- `app/page.tsx`: server-auth bootstrap;
- `app/api/session/route.ts`: no-store identity revalidation;
- `app/access-session-boundary.tsx`: focus/pageshow/visibility/reload/logout, state invalidation + broadcast;
- `app/notebook-storage.ts`: email-keyed browser state;
- AI routes: `app/api/chat/route.ts`, `extract`, `analysis`, `need-route`, `f2`, `f3`: Access authorization před provider call, bez zákaznické subscription gate;
- `app/server-capabilities.ts`: developer-only diagnostika a model override.

**Budoucí provider-neutral identity (konceptuální, neaktuální typ):**
- `appUserId`: stabilní, náhodný/neprůhledný APU primary key;
- `provider + providerSubject`: ověřená unikátní external identity map;
- `email`: volitelný zobrazovací/kontaktní údaj, ne owner ID;
- `sessionId`, `role`: request-scoped, serverově ověřované;
- `entitlement`: samostatně načtené/vynucované placené oprávnění, nesměšovat se session identity;
- `provider`: interní Access nebo customer Clerk, explicitně podle domény/runtime trust boundary.

**Security invariants:**
1. Authn ≠ app role ≠ subscription entitlement; žádné client-claimed price/role/plan.
2. Všechny placené API routes kontrolují **server-side** identitu, entitlement, per-user limit, souběžnost; fail closed před externím AI API.
3. Při změně účtu, e-mailu, role, logout, revokaci nebo offline uncertainty se starý projekt a browser cache nesmí objevit pod jiným uživatelem; existující session boundary semantics zachovat.
4. Cookie attributes `HttpOnly`, `Secure`, vhodné `SameSite`, CSRF origin checks, session revocation/no-store; konkrétně ověřit v připnuté verzi Clerk SDK a Vinext Worker.
5. `APU_LOCAL_DEV_AUTH` nemá být nikdy cesta do hosted customer API; interní JWT nepřiděluje customer entitlement.
6. Přemapování/převedení účtu pouze s doloženým ověřením vlastnictví původní i nové identity. **Nikdy neslučovat podle shodného e-mailu automaticky.**

## 3. Dedicated branch ≠ izolovaný Worker

**PoC realizace:**
- Samostatná `spike/clerk-hobby-vinext` z aktuálního `dev`; samostatný PR do `dev` jako draft; bez merge auth do pilotu po neúspěšném PoC.
- Preferovat local/mock build/route tests. Pokud je nutné hosted OAuth/login: předem schválit testovací Clerk app/keys, callback origin a izolovaný preview/Worker mechanismus. Stávající `apu-ms-site-dev` a jeho Cloudflare Access nejsou automaticky PoC playground.
- Nenasazovat CUSTOMER auth na PUBLIC; nepoužívat PUBLIC cookie domain, secrets nebo D1 bindings pro PoC; Clerk redirect/webhook domain a test data musí být oddělené.
- Projekty řešit paralelně nejprve dokumentačně (např. `design/projects-d1` z `dev`), bez editace auth/runtime source. Následná integrace identity + persistence musí být uspořádaná do jedné vědomě koordinované sekvence.

## 4. APU Projects — MVP hranice

**Vlastní obsah:** kanonický Zápisník, jeho odvozené/stale Rozbor a Výstup + explicitní formát/verze. Databáze ukládá a obnovuje platný stav, nikdy sama nevytváří pedagogické interpretace.

**První vynutitelný kontrakt:**
- Oddělené `users`/`provider_identity_links` (pokud je APU mapping DB), `projects` + jednoznačný `owner_user_id`; unikátní ID, created/updated timestamps, revision/schema version.
- Save / Open / List / Rename / Duplicate / Delete / Export; server ověří ownera u každé operace. Mezi účty a zařízeními se nesmí přenést neautorizovaný obsah.
- Při souběžných zápisech optimistic revision/ETag konflikt místo tichého last-writer-wins přepsání; safe recovery při timeout/reload, browser offline.
- Minimální zálohy, restore test, retenční a výmazová strategie včetně time travel/backups. EU jurisdiction D1 posoudit před vytvořením; oddělená `PROJECTS_DB` od `TELEMETRY_DB` a případné `AUTH_DB`.
- Nepoužívat AI usage ledger nebo diagnostic `Session JSON` jako uložené projekty. Neplánovat obousměrnou sync bez specifikace konfliktů.
- Nynější `db/schema.ts` je prázdné; schéma ani D1 projekt není implementován. Pilotní localStorage/sessionStorage nemigrovat bez samostatného návrhu, ownership proof a rollback.

**Not in Stage 1 MVP by default:** sdílení, instituční multi-tenancy, přílohy, velké soubory, verzování s audit historií, real-time kolaborace. Možné následné B-03/B-04.

## 5. Tarif, billing, AI cost protection

Stage 1 je schválena pro zákaznické tarify, ale počet/ceny/plány **nejsou specifikovány**. Zavést nejprve jeden explicitní základní plan / entitlement contract tak, aby pozdější rozšíření nevyžadovalo změnu autentizace. Zákaznické billing identity a platební metadata jsou oddělené od projektu a pedagogických dat.

Předplacený status z vlastní authoritative serverové evidence; signed/idempotent webhook updates, stav pro nezaplacení/cancel/refund/grace. CZK/VAT/invoicing vyřešit samostatnou právně/provozně schválenou službou; Clerk Billing nesmí být automaticky vybrán bez ověření CZK/taxes.

Každé placené AI volání musí provést autorizaci/kvótovou rezervaci před provider requestem; usage ledger zachycuje skutečnost, ne samotnou preventivní autorizaci. Ošetřit retry/fallback/streaming/concurrency. Pro PUBLIC pilot nejprve technicky ověřit pozorovatelnost a volit bezpečný limiter/kill switch, ne tvrdit, že je již implementován.

## 6. Telemetry privacy boundary

Pilotní `participant_id` je ve vyvíjeném P0 odvozen z Access e-mailu pomocí HMAC s oddělenou cohort/key; v source `dev` P0 chybí (work branches). Přechod na `appUserId` v budoucím pilotu znamená jinou identitní epochu nebo výslovně ověřený migration policy. Historické HMAC pseudonymy se nesmějí automaticky spojovat s komerční identitou.

Auth/database/billing integrace **nesmí měnit P0 telemetry engine** bez samostatně schváleného designu a specifického batch/evidence.

## 7. Povinné průchody ke schválení

- Clerk PoC: skutečně provedené Worker/Vinext auth/session/logout/SSR/cookie/401 testy; typecheck samotný nestačí.
- Projects: izolace projektu, nekřížení uživatelů, concurrency, schema migration, data deletion+restore test.
- Entitlement: nepřihlášený/expired/cancelled/over-limit klient žádnou externí AI spotřebu nevyvolá; dev diagnostic neuniká.
- Legal: schválený režim pedagogických údajů a konkrétní DPA/subprocessor/residency/retention map.
- Production: samostatná release authorization + hosted test; PR merge/CI PASS samo deployment neopravňuje.
