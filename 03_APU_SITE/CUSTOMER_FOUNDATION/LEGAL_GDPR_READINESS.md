# LEGAL-01 — GDPR a datová připravenost PUBLIC Pilot / budoucí Stage 1

**Priorita:** P0 pro **existující PUBLIC pilot**; zároveň design input do Clerk a APU Projects.
**Status:** LEGAL-P0-R1 DOCUMENTATION DRAFT READY / CONTROLLER + LEGAL APPROVAL PENDING. Původní discovery checklist níže zůstává otevřen tam, kde nejsou důkazy. Tento dokument není právním stanoviskem, DPA ani potvrzením GDPR compliance.

## 1. Zásadní rozlišení

APU má minimálně oddělené datové domény:
1. **Auth učitele:** e-mail, provider subject, session, autentizační/IP metadata. Nyní Cloudflare Access; Clerk je pouze budoucí kandidát.
2. **Pedagogický obsah:** Zápisník, Rozbor, Výstup, potenciálně skuteční žáci/děti a zvláštní kategorie údajů; může být zpracováván APU a externím AI API. Nesmí se ukládat do Clerk profilu, auth claims ani telemetry logů.
3. **Serverové AI usage a pilotní telemetrie:** servisní/účtovací data a případné pseudonymy; vlastní účel, přístup, retention a privacy review. Pseudonymizace sama neznamená anonymitu.
4. **Budoucí projekty/billing:** account-owner mapping, uložený pedagogický obsah, plán a platby; oddělené právní účely a retenční pravidla.

## 2. Zákaz identifikačních vstupů — co řeší a neřeší

Předběžná pilotní zásada: uživatel nepotřebuje vkládat jméno dítěte, datum narození, kontakty, adresu, školu/třídu v kombinaci s dalšími identifikátory ani údaje umožňující konkrétní osobu rekonstruovat. Zobrazit jasné příklady bezpečnějšího popisu.

Povinné seznámení s pravidly používání je užitečná **preventivní kontrola**, ale **není automaticky platným GDPR souhlasem** žáků/rodičů. Výčet zakázaných polí nezaručuje anonymitu volného textu; nepřímo identifikovatelné dítě a diagnóza mohou i bez jména představovat osobní/zvláštní kategorii údajů.

Nezaměňovat souhlas s pravidly používání, právní titul pro auth/telemetry a právní titul pro školní/pedagogické údaje. Pokud skutečný use-case zahrnuje identifikovatelné žáky, určit právní role školy/učitele/APU a připravit odpovídající smluvní a technická opatření ještě před povolením takového zpracování.

## 3. P0 discovery (fakta, nikoli předpoklady)

- [ ] Evidovat, kdo je správce/zpracovatel pro individuálního učitele a pro učitele jednajícího za školu; zda se použití liší.
- [ ] Zmapovat skutečné datové toky: PUBLIC Access → Worker → OpenAI/vektorový store; browser/session storage; usage/session export; provozní logy; případné další providery. Žádný pedagogický obsah do telemetry/auth metadat.
- [ ] Určit účely, kategorie, právní tituly a minimalizaci pro každou datovou doménu; osobní údaje mohou vznikat i bez explicitních identifikátorů.
- [ ] Inventarizovat dodavatele, DPA, sub-processors, lokalitu a mezinárodní přenosy; včetně Cloudflare, AI poskytovatele a budoucího Clerk/D1/billing.
- [ ] Stanovit omezení/retenci auth logů, IP, diagnostických exportů, AI requestů, browser storage, případných záloh a pseudonymizované telemetrie.
- [ ] Posoudit potřebu DPIA a zvláštní opatření pro data dětí/zvláštní kategorie; neoznačovat pilot za anonymní bez technického důkazu.
- [ ] Ověřit, co je skutečně logováno/nahráváno ve Worker observability a model instrumentation; zkontrolovat ochranu před únikem promptů, tokenů a obsahu.
- [ ] Ověřit privacy notice, cookies/auth necessity, případné consent/opt-in mechanismy, dokumentaci práv subjektů údajů a incident-reporting postupy.

## 4. Krátkodobá opatření pro PUBLIC pilot (před rozšířením kohorty)

1. Připravit **pilotní pravidla vstupů** s krátkým explicitním upozorněním ještě před vložením pedagogického obsahu. Srozumitelně vymezit zakázané identifikátory, příklady nepřímé identifikace a omezení automatické anonymizace.
2. Připravit **privacy information**: provozovatel, účely, druhy dat, příjemci, doba uchování, práva, kontakt, eventual transfer. Neprohlašovat „GDPR souhlas“ za řešení všech účelů.
3. Rozhodnout a vynutit **povolený obsah pilotu**: pouze modelové/neidentifikující situace vs. skutečné údaje žáků; při nejistotě nepovolovat nové identifikovatelné případy.
4. Připravit schválenou retenční a mazací proceduru pro dosavadní browser/session/diagnostic data, zejména při odhlášení, ztrátě zařízení a ukončení pilotu.
5. Prověřit, že účastníci rozumí pravidlům a že existuje kontakt pro požadavky na výmaz či incident.

**Gate LEGAL-PUBLIC:** před rozšířením PUBLIC pilotu je schválená dokumentace/datové procesy, konkrétní hranice povoleného obsahu a review skutečných logs/AI data flow. Pokud blocker trvá, nepřidávat identifikovatelná žákovská data a neprezentovat pilot jako právně prověřený.

## 5. Návrh výstupů a vlastníků

| Výstup | Vlastník / reviewer | Completion evidence |
|---|---|---|
| Data-flow inventory + kategorie | APU technický vlastník | Diagram a odkazy na konkrétní flow |
| Controller/processor matrix | Provozovatel + právní/GDPR reviewer | Schválené role a právní tituly |
| Processor/DPA/SCC/residency register | Provozovatel | Aktuální dokumenty dodavatelů a výsledek review |
| Pilot privacy notice + data entry rules | Provozovatel + právní reviewer | Schválená verze a instrukce k publikaci |
| Retention, erasure, breach/recovery SOP | Provozovatel + technický vlastník | Reálný postup/test výmazu |
| DPIA screening | GDPR odpovědná osoba / reviewer | Závěr a případný follow-up |

Tento checklist sám **neautorizuje** změnu PUBLIC textů/UI, Cloudflare konfigurace ani deployment. Přenos dokumentů/UI na PUBLIC musí být samostatný malý schválený batch a prod release gate.

## 6. Stage 1 GDPR doplnění

- U Clerk ověřit DPA, subprocessor list, reálný rozsah EU residency, auth cookies a session/IP retenci pro konkrétní tarif; podpis a právní schválení před používáním komerčních účtů.
- Pro projekty: ověřit EU jurisdiction D1 dle požadavků, encryption/access policy, backup/time travel retenci a delete-on-request včetně obnov ze zálohy.
- Pro billing: fakturační osobní údaje, smluvní role, účetní retence oddělená od výmazu aplikačních projektů.
- Zvlášť schválit, zda komerční APU může obsahovat identifikovatelné údaje žáků; modelové pravidlo pilotu není samo licencí pro širší zpracování.

## 7. Vstupní referenční dokumenty

- GDPR text a oficiální guidance: https://eur-lex.europa.eu/eli/reg/2016/679/oj
- ÚOOÚ: https://uoou.gov.cz/
- Clerk legal/DPA: https://clerk.com/legal/dpa
- Cloudflare DPA: https://www.cloudflare.com/cloudflare-customer-dpa/
- Návaznost na skutečné APU runtime zdroje: [CURRENT_STATE_AND_TARGETS.md](CURRENT_STATE_AND_TARGETS.md)

**Otevřená zásadní produktová volba:** `pedagogical_data_policy = de-identified/pseudonymous-only pilot` versus explicitně schválené zpracování identifikovatelných žákovských případů; zatím nerozhodnuto. Vynucení pravidel vstupu je samostatné UX/technické zadání po právním review.

---

## 8. LEGAL-P0-R1 — podklad pro schválení (2026-10-26)

**Stav této sekce: DRAFT READY FOR CONTROLLER / LEGAL REVIEW; NOT APPROVED.** Jde o návrhy pravidel, informačních textů a rozhodovací matici. Nejde o potvrzení souladu s GDPR ani o povolení změnit DEV/PUBLIC UI, aktivovat sběr či rozšířit pilot. Starší části 1–7 zachovávají historický discovery stav; následující evidence je aktuálnější pro uvedený DEV kandidát. Žádné skutečné žákovské případy, externí provider requests ani nové hostované kontroly nebyly v této dávce provedeny.

### 8.1 Aktuální zdrojová a provozní evidence

- **Zdrojový kandidát:** PR #83, aplikace `cb48a9de19d5847b0ca68d097f8bb572e4e6992d` (stateless Chat, pilotní pravidla, telemetry).
- **Dokumentační evidence:** PR #84 (lokální Windows V3) a PR #85, `1729fce641fab5015407acdd5be06fe8941ed58c` (nasazený DEV).
- **Hosted DEV:** dedikovaný `apu-ms-site-dev`, Worker verze `895e443e-3322-4b2d-91f0-9523220a9bbf`, 100 % traffic dle operátorské evidence; Access operator-only PASS, `APU_LOCAL_DEV_AUTH=0`. Není to merge do `dev` ani nasazení do `public`.
- **Pilot receipt:** dedikovaná DEV KV s EU jurisdiction, pseudonymním key odvozeným SHA-256 z normalizovaného e-mailu, verzí pravidel a informací, časem přijetí a expirací; DEV-test TTL přesně 86 400 sekund. Hash e-mailu je **pseudonym**, nikoli důkaz anonymizace. Logout neznamená automatický výmaz serverového receipt. PUBLIC retenční doba **nerozhodnuta**.
- **První potvrzení:** při prvním hosted pokusu UI zobrazilo chybu, ale následný autentizovaný GET vrátil validní receipt a reload odemkl UI. Původní status POST a root cause jsou **NOT VERIFIED**. Další POST/test musí mít vlastní úzkou autorizaci a bezpečné HTTP evidence.
- **Telemetrie:** na nasazeném DEV jsou `APU_TELEMETRY_ENABLED=0` a `APU_TELEMETRY_METADATA_ENABLED=0`. Databáze `TELEMETRY_DB` je připojena, ale aktivní hosted sběr nebyl ověřen ani schválen. Po původním smoke bylo ve třech telemetry tabulkách nula řádků; bez předchozího snapshotu netvrdit přesnou deltu. Návrh 30denní raw retence a režim pseudonymizace/opt-in čekají na G2/G4/G5.
- **Status pravidel:** `PILOT_RULES_VERSION` a `PILOT_INFORMATION_VERSION` jsou ve zdroji dosud označeny `draft-1`. Současné UI výslovně uvádí DRAFT a neúplné údaje o správci, kontaktu a retenci. Nesmí být označeno jako právně schválené.

### 8.2 Inventář datových toků a důkazů

| Datová doména a účel | Zdrojově/operátorsky podloženo | Co není ověřeno / rozhodnuto |
|---|---|---|
| Přihlášení učitele | Cloudflare Access JWT, serverová validace audience/issuer/podpisu; role `developer/tester`, e-mail; DEV Access jen operátor | Právní role/titul, úplné edge/Access/IP logy a jejich retence, všechny aktuální DPA/subprocesory |
| Pracovní pedagogický obsah | Uživatel zadává skutečnou potřebu, pozorované projevy a kontext. Zápisník je kanonický; Rozbor a Výstup jsou odvozené. Owner-scoped Zápisník v browser `localStorage` pro developera, `sessionStorage` pro testera, nikoli současné serverové APU Projects | Skutečný obsah všech browser/diagnostických kopií, exportů, uživatelských zařízení a jejich výmaz; žádné automatické tvrzení „nic se neukládá“ |
| Serverové AI operace | Aktuální vstup, nutný Zápisník a omezený `dialogContext` mohou být předány Workerem OpenAI API; MAIN používá `store:false`, bez `previous_response_id`; MAIN/file search odkazuje na configured vector store | Skutečná konfigurace a obsah vector store, všechny dodavatelské logy/retence/přenosy; `store:false` **není** garance nulové retence u poskytovatele |
| Potvrzení pravidel | Autentizovaný `GET/POST /api/pilot-rules`, samostatná DEV KV, čas/verze/expirace; žádný pedagogický text v receipt | Právní titul, PUBLIC TTL, přístup/výmaz/obnova, dlouhodobé chování při revizi informačního textu |
| Pilotní telemetrie a AI usage | Samostatná D1, request-scoped adapter; ve skutečném DEV OFF/OFF; navržen pseudonymní identifier, opt-in a pouze allowlisted metriky | G2 účel/titul/notice, G4 retention/mazání/logy, G5 aktivace a reálné měření; metadata i povolení sběru jsou vypnuté |
| Diagnostika, soubory, exporty a zařízení | Existují developer diagnostiky a klientské export/print/download cesty; vybrané usage informace jsou serverově projektovány | Inventář všech skutečně zapnutých logů, délky retence/exportů, záloh, provozní incident a DSR postup; nestavět právní text na předpokladu nulových kopií |

**Zdrojové body:** `app/access-auth.ts`, `app/notebook-storage.ts`, `app/access-session-boundary.tsx`, `app/api/chat/route.ts`, `app/api/pilot-rules/route.ts`, `app/pilot-rules-server.ts`, `app/pilot-rules.ts`, `app/telemetry/server.ts`, `03_APU_SITE/CURRENT/APU_SITE_RUNTIME_TECHNICAL_CURRENT.md` v PR #85. Stav PUBLIC aplikace se z tohoto DEV auditu neodvozuje.

### 8.3 Návrh povolených pedagogických údajů (ke schválení)

**Navržená provozní hranice:** učitel smí popsat **skutečnou pedagogickou potřebu, pozorované projevy a relevantní kontext z praxe**, ale žádné konkrétní dítě/žák nesmí být identifikovatelný přímo ani kombinací nepřímých znaků. APU nemá pracovat se skutečnými **ani modelovými diagnózami**, odvozovat je nebo přijímat zdravotnické/poradenské zprávy.

Nepřijímat zejména: jména, iniciály použitelné k určení osoby, kontakty, přesnou školu/třídu, adresy, přesná data a vzácné kombinace věku/událostí, fotografii či přepis umožňující identifikaci. Pseudonym nebo přezdívka sama o sobě bezpečnou neidentifikovatelnost nezaručuje.

**Příklad vhodnějšího popisu:** „Při skupinových činnostech jeden žák často odchází od úkolu. Potřebuji navrhnout strukturu instrukcí a zjistit, co mu pomáhá udržet pozornost.“ Neuvádět individuální historii, identifikační školní kontext ani diagnózu.

**Při omylu:** nezvyšovat množství údajů další konverzací; ukončit zadávání, využít existující reset/výmaz pracovního stavu tam, kde je doložen, a kontaktovat určený provozní kanál **bez opětovného zaslání případu**. Proces požadavků na výmaz a incidentní kontakt ještě vyžaduje schválení. Pokyny nejsou technickou automatickou anonymizací, a proto zůstává potřeba posoudit reálná rizika identifikace.

### 8.4 Návrh textu — první seznámení před prací s APU (DRAFT)

> **Než začneš používat APU**
>
> APU pomáhá učiteli formulovat skutečnou pedagogickou potřebu, uspořádat pozorované projevy do Zápisníku a připravit pracovní Rozbor a Výstup. Nepopisuj údaje, podle nichž lze poznat konkrétní dítě, a to ani jejich kombinací. Neuváděj jména, školu či třídu, kontakty, přesná data, diagnózy (ani modelové), zdravotní ani poradenské zprávy.
>
> Ke zpracování některých požadavků APU předává zadaný text a potřebný pracovní kontext prostřednictvím serveru poskytovateli AI. Pracovní stav a exporty mohou zanechávat kopie v prohlížeči nebo na zařízení. Další podrobnosti o správci, účelu, příjemcích, retenci a právech musí být uvedeny ve schválených Informacích o zpracování údajů.
>
> Zaškrtávací pole: **„Seznámil/a jsem se s pravidly používání APU a přijímám je.“**
>
> Přijetí pravidel používání **není souhlasem za dítě/rodiče ani samo o sobě právním titulem pro zpracování osobních údajů**. Nevyhovující vstupy do APU nevkládej.

Tento text **není ke zveřejnění**, dokud chybí schválená privacy information a identita/kontakt správce. Není zamýšlen jako univerzální GDPR consent checkbox.

### 8.5 Návrh textu — sekce „Informace a pravidla“ v aplikaci (DRAFT)

> **Jak používat APU a chránit údaje**
>
> Popisuj pedagogickou potřebu, skutečně pozorované jednání a relevantní okolnosti, nikoli identitu žáka. Zápisník obsahuje ověřená sdělení uživatele; Rozbor jsou pracovní interpretace a Výstup je návrh, který musí učitel posoudit. AI nenahrazuje odborné nebo právní rozhodování.
>
> Nepřidávej skutečné ani smyšlené diagnózy, lékařské zprávy, osobní kontakty ani kombinace identifikačních údajů. Pokud taková data omylem uvedeš, nepokračuj v jejich rozpracování a použij schválený postup nápravy.
>
> Přístup do pilotu zajišťuje Cloudflare Access; AI funkce mohou odesílat text poskytovateli OpenAI API. Pracovní data mohou být dočasně nebo podle uživatelské role trvaleji uložena **v tomto prohlížeči**; smazání lokální session nemusí smazat u poskytovatelů nebo stažené exporty. Pilotní telemetrie je ve stávajícím DEV vypnutá.
>
> **Úplné informace o zpracování osobních údajů:** [PŘIDAT SCHVÁLENÝ ODKAZ]. **Kontakt pro práva a incidenty:** [SCHVÁLENÝ KONTAKT]. Texty a případné lhůty se zveřejní až po schválení.

Pro budoucí UI implementaci zachovat oddělení souhlasu s volitelnou telemetrií od přijetí povinných pravidel. Ověřit také, zda změna `informationVersion` má vyžadovat nové potvrzení: aktuální `parsePilotRulesReceipt()` vynucuje přesnou `rulesVersion`, nikoli rovnost `informationVersion`. Nerozhodovat to pouhou změnou textu.

### 8.6 Návrh úplné privacy information (publikační šablona; NEPUBLIKOVAT)

| Povinná informace | Návrh / potřebné doplnění |
|---|---|
| Správce a kontakty | **[DOPLNIT: skutečný právní subjekt, adresa, e-mail, případný pověřenec]** |
| Kdo používá službu a role školy/učitele | **[ROZHODNOUT: individuální učitel × učitel jednající za školu; controller/processor matrix]** |
| Účely a právní tituly | **[SCHVÁLIT ZVLÁŠŤ: autentizace a provoz, poskytování AI funkcí, potvrzení pravidel, bezpečnost/logy, případná volitelná telemetrie]**; neodvozovat automaticky „souhlas“ z checkboxu |
| Kategorie údajů | Identita učitele a technická auth metadata; pedagogické vstupy pouze v dovoleném režimu; lokální pracovní stav; verzovaný receipt; volitelná pseudonymní telemetrie **jen po aktivaci** |
| Příjemci/zpracovatelé | Cloudflare a OpenAI API dle skutečné konfigurace; **[DOPLNIT ověřený processor/subprocessor register a případné další služby]** |
| Předání mimo EU / právní záruky | **[DOPLNIT aktuální smlouvy, místa zpracování a relevantní přenosové mechanismy]**; EU jurisdikce D1/KV sama o sobě negarantuje veškeré zpracování v EU |
| Retence a výmaz | **[DOPLNIT po doménách a zálohách]**; DEV receipt 24 h není PUBLIC pravidlo |
| Práva a jejich uplatnění | **[DOPLNIT kontaktní cestu a identity verification]**; přístup, oprava, výmaz, omezení, námitka, přenositelnost a odvolání souhlasu tam, kde náleží |
| Stížnost a automatizované rozhodování | **[DOPLNIT a právně posoudit]**; možnost obrátit se na ÚOOÚ a vyjasnit, zda jde o rozhodování ve smyslu čl. 22 GDPR |
| Povinné/volitelné poskytnutí dat | **[DOPLNIT]** nezbytnost identity pro pilot, pravidla pro pedagogický vstup a samostatná dobrovolnost telemetrie |
| Verze dokumentu a dostupnost | **[DOPLNIT]** schválené `rulesVersion` / `informationVersion`, datum účinnosti, dostupná URL a způsob re-acknowledgement |

Tato šablona nesmí být zaměněna za dokončenou informační povinnost podle čl. 12–14 GDPR.

### 8.7 Retention a provozní rozhodnutí

| Doména | Nynější fakt / návrh | Stav schválení |
|---|---|---|
| DEV receipt v KV | TTL **86 400 s** od potvrzení, podle DEV operátorského approval; expirační validace v serveru; logout jej automaticky nemaže | **APPROVED DEV TEST ONLY** |
| PUBLIC receipt | Doba, účel, doba po změně pravidel, výmaz a auditní potřeba | **PENDING LEGAL/CONTROLLER** |
| Telemetry raw D1 | **30 dní navržená** raw retention; metadata OFF, hosted sběr OFF | **PENDING G2/G4/G5**, nikoli aktivní opatření |
| Browser Zápisník | Developer `localStorage`, tester `sessionStorage`, owner isolation/logout reset best effort | Zdrojový kontrakt ověřen; reálná retenční a výmazová procedura **PENDING** |
| OpenAI API / vector store | MAIN `store:false` neimplikuje nulové vendor monitoring logs; skutečné residual processing a případný vector store data lifecycle mají vlastní podmínky | **DEFERRED / NOT VERIFIED** podle dřívějšího rozsahu; neprezentovat nulovou retenci |
| Cloudflare Access/edge/Worker logs | Detailní aktuální nastavení a retence v konkrétním účtu | **NOT VERIFIED**, provozní gate G4 |
| Exports, diagnostic files, backups | Není doložen jednotný úplný postup výmazu všech lokálních/externích kopií | **PENDING OWNER / SOP** |

Konkrétní procesy odpovědí na žádosti subjektů údajů, řešení chybného vložení obsahu, hlášení incidentu, postup výmazu v zálohách a obnova/retence logů vyžadují vlastníka a testovanou SOP. Není přípustné slibovat automatický úplný výmaz pouhým resetem session.

### 8.8 Schvalovací matice (žádné implicitní approval)

| Rozhodnutí | Vlastník | Důkaz pro PASS | Co blokuje |
|---|---|---|---|
| L-01 Právní role učitele/školy/APU | Provozovatel + právní/GDPR reviewer | Controller/processor matrix pro oba vstupní režimy | Rozšíření PUBLIC |
| L-02 Povolený pedagogický obsah | Product owner + právní reviewer | Schválené pravidlo reálné potřeby bez identifikovatelného žáka/diagnóz | PUBLIC pravidla |
| L-03 Informační povinnost a právní tituly po účelech | Správce + právní reviewer | Identita, kontakt, účely, tituly, příjemci, práva, publikovatelná verze | PUBLIC |
| L-04 Dodavatelé, DPA, případné transfery | Provozovatel + reviewer | Aktuální smlouvy, procesor/subprocessor register, transfer assessment | PUBLIC a případně aktivaci telemetrie |
| L-05 Retence, výmaz, incidenty a DPIA screening | Provozovatel + GDPR reviewer | Konkrétní politiky/SOP, vlastníci, proces testu a DPIA screening | PUBLIC a reálný sběr |
| L-06 DEV první potvrzení | Technický vlastník | Samostatně autorizovaný kontrolovaný POST s bezpečně redigovaným HTTP status/error + účetní receipt re-read, bez AI calls | Bezvýhradný DEV onboarding PASS |
| L-07 Consent/opt-in telemetrie a pseudonymizace | Controller/Product + operator | Účel/titul/notice, oddělené přijetí, účastníci, retention 30d případně změna, DSR | G2/G4/G5 — aktivní měření |
| L-08 Finální publikace | Provozovatel / release owner | Reviewer approval, verze textů, DEV acceptance, oddělená produkční autorizace | PUBLIC deployment |

### 8.9 Exit criteria a navazující implementace

- **LEGAL-P0-R1 = DRAFT READY**, pokud jsou zdrojové nároky a veškeré neschválené položky výše jednoznačné; **LEGAL-PUBLIC APPROVED = NO**.
- Žádné změny `app/pilot-rules-*`, `app/worker-bindings.ts`, version constants, Cloudflare/kv, telemetry flags, loginu, aplikace nebo release větví v této dávce.
- Následný LEGAL-P0-R2 až **po rozhodnutí L-01 až L-05** připraví přesné schválené UI texty, version/acceptance chování a řízenou DEV akceptaci; původní první POST selhání se smí diagnostikovat novým requestem pouze po samostatném schválení.
- G2/G4/G5 zůstávají samostatné podmínky **aktivace** měření; publikace pravidel neznamená povolení reálné telemetrie. PUBLIC release/merge/deployment není autorizován.

**Externí orientační normativní podklady (ne potvrzení konkrétního souladu):** [GDPR, čl. 5–6, 9, 12–14, 28, 32, 35](https://eur-lex.europa.eu/legal-content/cs/TXT/?uri=CELEX%3A32016R0679); [ÚOOÚ — informační povinnost a odlišení právních titulů](https://uoou.gov.cz/profesional/metodiky-a-doporuceni-pro-spravce/metodika-k-plneni-informacni-povinnosti-a-k-souvisejicim-ujednanim-vuci-zakaznikum); [EDPB — controller/processor](https://www.edpb.europa.eu/documents/guideline/guidelines-072020-on-the-concepts-of-controller-and-processor-in-the-gdpr_en); [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data); [Cloudflare KV jurisdikce](https://developers.cloudflare.com/kv/reference/data-location/).

**Documentation & Tracking (LEGAL-P0-R1):** Documentation Impact: LEGAL/PRIVACY DRAFT; Changelog NO; Backlog NONE; Known Issues NONE. Deployment Authorization: **NOT AUTHORIZED**.
