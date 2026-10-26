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

---

## 9. PILOT MINIMUM — omezený pilot do 48 učitelů (návrh 2026-10-26)

**Status: PRODUCT SCOPE APPROVED BY PROJECT OWNER (2026-10-26) / LEGAL AND OPERATIONS PENDING / EXTERNAL ONBOARDING NOT YET APPROVED.** Tato sekce zužuje schvalovací rozsah §8 pro aktuální neveřejně nabízený, pozvánkový pilot; nenahrazuje minimální GDPR povinnosti a nepřenáší je do Stage 1. Údaj „48“ znamená **nejvýše 48 učitelů v pilotní skupině**, nikoli ověřenou kapacitu Cloudflare Access, počet již pozvaných lidí nebo výjimku z GDPR.

### 9.1 Rozhodnuté parametry a role

| Prvek | Rozhodnutí / stav |
|---|---|
| Typ služby | **Omezený experimentální pilot**; komerční Stage 1 je oddělená. Platební režim pilotu ani tarify nebyly v tomto rozhodnutí specifikovány. |
| Účastníci | **Maximálně 48 učitelů**. Doporučen pozvánkový/omezený přístup; před onboardingem ověřit skutečné Access seat limity a náklady. |
| Odpovědná osoba za práci s daty | **Michal Roupec** — určený interní vlastník a kontaktní osoba pro pilotní privacy/incident agendu. |
| Provozovatelé | Podle uživatele **dvě fyzické osoby**, nikoli založená společnost. Právnická osoba pro pilot není nutnou podmínkou. |
| Právní správce GDPR | **PENDING ROLE DETERMINATION:** Michal jako odpovědný kontakt neznamená automaticky, že je jediným správcem nebo jmenovaným DPO. Zjistit, zda druhá osoba samostatně/společně určuje účely a podstatné prostředky. Při společném správcovství stručně písemně rozdělit odpovědnosti a sdělit podstatu ujednání účastníkům (čl. 26). |
| Data žáků | Pouze **skutečné pedagogické potřeby/pozorování v neidentifikující podobě**; nelze rozpoznat dítě ani kombinací detailů. **Nezadávat skutečné ani modelové diagnózy** ani zdravotnické/poradenské zprávy. Preventivní pravidlo nezaručuje anonymitu volného textu. |
| Serverové projekty/konverzace | Současný pilot nemá perzistentní serverové APU Projects; kanonický Zápisník je v browseru podle role, Chat je přenosový/odvozovací prostředek. \`store:false\` na AI requestu nevylučuje veškeré dodavatelské logy/retenci. |
| Telemetrie | **OFF/OFF** na DEV. Reálné měření není součástí tohoto pilotního minima; samostatné gates G2/G4/G5 před aktivací. |
| DEV rules receipt | Testovací TTL **24 h**, pouze DEV. Doba receipt pro externí pilot/PUBLIC zatím **PENDING**. |

### 9.2 Krátké pilotní pravidlo — text pro uživatele (DRAFT)

> **APU — pravidla omezeného pilotu**
>
> APU je experimentální pomůcka pro učitele. Můžete popsat skutečnou pedagogickou potřebu, pozorované projevy a kontext nezbytný pro návrh podpory. Neuvádějte identitu žáka: jména, kontakty, přesnou školu/třídu, data událostí ani kombinace okolností, podle nichž lze konkrétní dítě určit. Nepoužívejte ani skutečné, ani modelové diagnózy; nevkládejte zdravotní a poradenské zprávy.
>
> Zápisník zachycuje pracovní informace; Rozbor a Výstup jsou návrhy k odbornému posouzení učitelem. Vybrané požadavky jsou zpracovávány přes server APU a OpenAI API. Obsah může mít kopie v prohlížeči, exportech a podle dodavatelských pravidel; odhlášení proto samo nezaručuje výmaz všech kopií.
>
> Pokud omylem vložíte osobní údaje o dítěti, nepokračujte v jejich rozpracování a kontaktujte osobu uvedenou v informacích o zpracování, aniž byste celý případ znovu posílali. Odkaz na úplné pilotní informace: **[SCHVÁLENÁ URL]**.
>
> Checkbox: **„Seznámil/a jsem se s pravidly používání APU a přijímám je.“** Toto potvrzení **není souhlasem za žáka nebo rodiče ani náhradou právního titulu podle GDPR**.

Tento text je věcně připravený, nikoli právně/provozně schválený pro publikaci. Povinný text pravidel a případný samostatný souhlas/opt-in s budoucí telemetrií musí zůstat oddělené.

### 9.3 Stručná informace o osobních údajích účastníků (šablona k doplnění před pozváním)

> **Ochrana osobních údajů — omezený pilot APU (max. 48 učitelů)**
>
> **Kdo odpovídá:** Michal Roupec je určenou kontaktní a odpovědnou osobou pilotu. **[PŘED PUBLIKACÍ: označit právního správce/správce společné, případně obě fyzické osoby a podstatu ujednání, uvést funkční kontakt]**.
>
> **Jaké údaje:** přihlašovací identita učitele, technické/bezpečnostní údaje související s Cloudflare Access, verze a čas potvrzení pravidel; podle používání také obsah pracovního Zápisníku v browseru a text potřebný pro konkrétní AI požadavek. Nevkládejte identifikovatelné údaje o žácích ani diagnózy.
>
> **Proč a na jakém právním základě:** umožnění vstupu do omezeného pilotu, poskytnutí zvolených funkcí, doložení přijetí pravidel a bezpečné provozování služby. **[PŘED PUBLIKACÍ: doplnit konkrétní čl. 6 titul u každého účelu; při oprávněném zájmu zdokumentovat test nezbytnosti/převážení práv; souhlas pro některé samostatné účely nenahrazovat checkboxem pravidel]**.
>
> **Kdo data zpracovává:** při přihlášení/hostingu Cloudflare, při vyvolaných AI úlohách OpenAI API; **[PŘED PUBLIKACÍ: ověřené smluvní role, aktuální dodavatelská dokumentace, případní další příjemci/subzpracovatelé, mezinárodní přenosy a záruky]**.
>
> **Jak dlouho a kde:** Zápisník se ukládá v tomto prohlížeči podle role a lokálního životního cyklu; exporty zůstávají tam, kam si je uložíte. Verzované potvrzení pravidel může být uchováno v serverovém KV; **24 h platí nyní jen pro DEV test a není schválenou PUBLIC lhůtou**. **[PŘED PUBLIKACÍ: skutečná doba/objektivní kritéria pro pilotní receipt, Access/edge logy, diagnostiku, dodavatelská AI data a postup výmazu; neuvádět neověřenou nulovou retenci]**.
>
> **Vaše práva:** podle okolností můžete požadovat přístup, opravu, výmaz, omezení zpracování, vznést námitku a případně využít přenositelnost nebo odvolat skutečně udělený souhlas; můžete podat stížnost u ÚOOÚ. **[PŘED PUBLIKACÍ: funkční kontaktní kanál a způsob ověření žadatele]**.
>
> **Dobrovolnost:** účast v pilotu je dobrovolná, pro přístup však potřebujete určenou autentizační identitu a seznámení s pravidly. **[PŘED PUBLIKACÍ: doplnit důsledky neposkytnutí a informaci o případném automatizovaném rozhodování, pokud se vyskytuje]**.
>
> **Datum a verze:** **[DOPLNIT SCHVÁLENÉ RULES/INFORMATION VERSION, DATUM ÚČINNOSTI A ADRESU]**.

Bez doplnění hranatých polí **nejde o úplnou informaci podle čl. 13 GDPR a nesmí být předložena externím učitelům jako schválená**. Právní kvalifikace účelů a dodavatelských vztahů musí odpovídat skutečnému provozu, nikoli jen zamýšlenému použití.

### 9.4 Minimální provozní postup — jeden vlastník, žádná nová infrastruktura

**Kontaktní osoba:** Michal Roupec, konkrétní dostupný pilotní kanál **[DOPLNIT A OTESTOVAT]**. Nepotvrzovat automaticky roli formálního DPO.

1. **Žádost učitele / výmaz:** zaregistrovat datum a rozsah žádosti bez vkládání pedagogického případu do ticketu. Ověřit totožnost přiměřeným způsobem; odděleně posoudit browser kopie, Access identitu, receipt KV, provozní logy, data u dodavatelů a exporty, které APU nemůže smazat. Odpověď v zákonné lhůtě, není-li relevantní výjimka.
2. **Chybné vložení údaje o žákovi:** zastavit další AI operace s obsahem, vymezit dotčená místa/kopie, provést jen doložitelný lokální reset a případný vyžádaný provider postup; neslibovat úplný výmaz bez potvrzení.
3. **Bezpečnostní incident:** zaznamenat čas zjištění, domény a dopady bez kopie pedagogického obsahu; zajistit přístup, posoudit riziko a případnou notifikaci ÚOOÚ bez zbytečného odkladu, je-li vyžadována zpravidla do 72 h od zjištění, a informování dotčených osob při vysokém riziku. Evidovat rozhodnutí i když notifikace není potřebná.
4. **Přístup a retenční minimum:** pouze pozvaní učitelé, žádné sdílené testovací účty; před zahájením ověřit Access allowlist/seat limit a skutečné provider/log retention. Když provozní lhůta není doložená, označit NOT VERIFIED, nevybírat ji náhodně.
5. **DPIA screening:** do jedné stránky zaznamenat povahu/účely/kategorie/datové subjekty/poskytovatele, riziko neúmyslného vložení dat dítěte, generativní AI, ochranné kontroly a rozhodnutí **DPIA REQUIRED / NOT REQUIRED + zdůvodnění**. Při vysokém riziku plné DPIA před odpovídajícím zpracováním; absence plného DPIA není automaticky protiprávní.

### 9.5 Co uzavřít nyní a co zakonzervovat pro Stage 1

| Povinnost/rozhodnutí | PILOT max. 48 — před přizváním externích učitelů | STAGE 1 |
|---|---|---|
| Určení skutečného správce a druhé osoby | **REQUIRED** — stručná dokumentovaná role, Michal kontakt | Nová právnická osoba / komerční organizační struktura, pokud vznikne |
| Funkční e-mail/kontakt a informace dle čl. 13 | **REQUIRED** — stručná úplná verze pro současné účely | Plná zákaznická dokumentace/obchodní podmínky pro nové účely |
| Právní titul pro Access, pilotní AI a receipt | **REQUIRED** u skutečných operací | Nové účely: customer auth, Projects, billing |
| Cloudflare/OpenAI současný DPA/role/přenosy | **REQUIRED** ověřit přiměřený podklad pro skutečně používané služby | Širší supplier register/nové providery a komplexní governance |
| Retence receipt/logů/AI a výmaz/incident | **REQUIRED** minimum dle skutečného provozu; PUBLIC TTL se musí určit před publikací receipt gate | Plán záloh, uložených projektů, billingových a komerčních dat |
| Jednostránkový DPIA screening | **REQUIRED** před rozšířením, závěr musí být odůvodněn | Nový screening při rozšíření účelů/rizik |
| Active telemetry G2/G4/G5 | **NOT IN PILOT MINIMUM** — ponechat OFF/OFF | Zvláštní schválená etapa, nemusí čekat na komerční Stage 1 |
| Spolehlivost prvního potvrzení | **TECHNICAL FOLLOW-UP** před deklarací hladkého onboardingu; nyní R1/R2 read/rehydration PASS, původní POST příčina NOT VERIFIED | — |
| Clerk, serverové projekty, ukládání chat historie, placené tarify | **OUT OF SCOPE** | Samostatný Stage 1 design + legal/technical gates |

**STOP condition pro pozvání externích učitelů:** chybí-li identita správce nebo kontakt, správný účel/titul, faktický aktuální dodavatelský/retention základ, úplná privacy information, vyhodnocení DPIA anebo minimální incident/DSR proces, status zůstává **PILOT MINIMUM — DRAFT / ONBOARDING BLOCKED**. Limit 48 a zákaz identifikace žáků tyto povinnosti neruší. Pro interní vývoj se syntetickými nebo neidentifikujícími daty tímto dokumentem nevyhlašujeme zákaz práce.

**Dokumentační výsledek:** product owner schválil minimalistický pilotní rámec (max. 48 učitelů, Michal Roupec jako odpovědná kontaktní osoba a navržená pravidla neidentifikujících vstupů). To **neprokazuje doplnění** údajů podle čl. 13 GDPR, finální určení správce, audit dodavatelů, rozhodnutí o retenci ani právní review; externí onboarding zůstává blokován. LEGAL-P0-MIN legal approval / PUBLIC deployment / telemetry activation = **NOT AUTHORIZED**.

---

## 10. LEGAL-P0-MIN-CLOSE — ověření minimálních podmínek pilotu (2026-10-26)

**Verdikt: PILOT MINIMUM DOCUMENTATION READY / EXTERNAL ONBOARDING BLOCKED.** Produktový rozsah (nejvýše 48 učitelů, Michal Roupec jako odpovědná kontaktní osoba, neidentifikující pedagogické situace, zákaz skutečných i modelových diagnóz, telemetry OFF/OFF) je **PRODUCT APPROVED**. Schválení **není** důkazem faktického obsazení skupiny, finální právní role, zvoleného zákonného titulu, vyřešeného smluvního režimu dodavatelů ani povolením nasazení/pozvánek. Tento zápis uzavírá jen dokumentační průchod, nikoli právní povinnosti.

### 10.1 Právní role: minimum bez právnické osoby

- **OWNER-REPORTED — doplnění 2026-10-26:** APU připravují **Michal Roupec** a **Zdeněk Vilímek — metodik APU**. Michal Roupec je určenou odpovědnou kontaktní osobou pro pilot; podle jeho sdělení jsou Cloudflare/OpenAI účty a administrátorské přístupy vedeny u něj. Nejde o nový autentizovaný read-back účtů ani o ověření smluvní protistrany.
- **OWNER-PROVIDED CONTACT:** `catsytem.exe@gmail.com`, přesně podle zadání. Správnost zápisu a funkční doručování **NOT VERIFIED**; žádná testovací zpráva nebyla odeslána. Před publikací notice potvrdit přesný zápis a funkčnost kanálu.
- **P-MIN-01 REMAINS OPEN:** metodická role Zdeňka ani držení účtů Michalem samy neuzavírají právní role. Zbývá doložit, kdo skutečně rozhoduje o účelech a podstatných prostředcích zpracování a zda se na nich Zdeněk podílí.
- **OWNER DECISION REQUIRED:** osoba, která určuje účely a podstatné prostředky každého zpracování (registrace učitele/Access, AI požadavky, rules receipt, bezpečnostní metadata), je skutečným správcem; fyzická osoba jím být může (GDPR čl. 4 odst. 7). Pouhý interní název „odpovědná osoba“ roli jediného správce nedokazuje.
- **OWNER DECISION REQUIRED:** pokud oba nezávisle společně určují účely a podstatné prostředky, jde o potenciální **společné správce**. Pro tento případ písemně rozdělit odpovědnost za čl. 13 informování, práva subjektů, incidenty a kontakt; podstatu ujednání zpřístupnit učitelům (čl. 26). Případný jiný skutečný vztah zdůvodnit. Neoznačovat Michala za formální DPO bez samostatného posouzení.
- **PILOT MINIMUM:** správce či společní správci uvedení jménem/jmény a funkčním kontaktem v dokumentu pro učitele; obchodní společnost a komerční smluvní schéma patří do Stage 1, **nikoliv** určení aktuálního správce.

### 10.2 Ověřená veřejná dodavatelská dokumentace vs. stav účtů APU

| Kontrola | Zjištění z aktuální dokumentace dodavatele | APU-specific stav |
|---|---|---|
| **Cloudflare DPA** | Veřejně dostupné **Cloudflare DPA v6.4, effective 2026-04-03** uvádí smluvní vazbu na Main Agreement a účinnost při podpisu/odsouhlasení. [Dokument](https://www.cloudflare.com/cloudflare-customer-dpa/). | **NOT VERIFIED:** konkrétní strana smlouvy, přijetí/účinnost pro účet APU, použitelný rozsah služeb a případné transfery |
| **Cloudflare subprocesory** | [Veřejný seznam pro Cloudflare services](https://www.cloudflare.com/gdpr/subprocessors/cloudflare-services/) uvádí relevantní dodavatele a umístění; seznam není potvrzením konkrétní konfigurace účtu. | **NOT VERIFIED:** konkrétní využívané služby / přenosy / případné logpush/export cesty |
| **Cloudflare Access logy** | [Zero Trust log retention](https://developers.cloudflare.com/cloudflare-one/insights/logs/) uvádí pro **Free** Access authentication logs **24 hodin** a admin logs **18 měsíců**; jiné plány/datové typy se liší. [Access auth logy](https://developers.cloudflare.com/cloudflare-one/insights/logs/dashboard-logs/access-authentication-logs/) zahrnují identity a pokusy přihlášení. | **NOT VERIFIED:** definitivní Zero Trust tarif konkrétního účtu, nastavení exportů a dalších logů, retention pro Workers analytics/observability; žádný nový Dashboard audit v této dávce |
| **Cloudflare EU Workers KV** | [Jurisdiction KV](https://developers.cloudflare.com/kv/reference/data-location/) omezuje **durable storage** na EU, ale KV může být globálně přístupné a cache může existovat mimo EU. | **VERIFIED podle předchozí operátorské evidence:** DEV receipt KV má EU jurisdiction a 24h TTL; **NEVYVOZOVAT** tím globální rezidenci celé služby, PUBLIC retenci ani přístupovou politiku všech kopií |
| **OpenAI API DPA** | [OpenAI DPA](https://openai.com/en-GB/policies/data-processing-addendum/) uvádí pro zákazníky z EHP smluvní protistranu OpenAI Ireland Ltd. a rámec zpracování a přenosů dle podmínek. | **NOT VERIFIED:** konkrétní account contracting entity, účinnost smluvního režimu APU, detail subprocesorů/transferů a datových kontrol |
| **OpenAI API retence** | [API Data controls](https://developers.openai.com/api/docs/guides/your-data) uvádějí, že API data se standardně nepoužívají k trénování bez opt-in, ale **abuse-monitoring logy mohou zahrnovat prompty/odpovědi a standardně jsou uchovávány až 30 dní**, s uvedenými výjimkami. Responses API `store:false` omezuje application-state storage, nikoli automaticky abuse-monitoring logy. Vector-store/files mají samostatný životní cyklus. | **VERIFIED ve zdroji**: MAIN a další instrumentované AI trasy pracují s `store:false` podle kontrolovaných implementací. **NOT VERIFIED**: konkrétní datové kontroly, vektorové úložiště, logy a skutečná retence účtu. Zbytková OpenAI retence dříve vědomě odložená pro technické práce; před externím pilotem ji **pravdivě popsat jako výchozí podmínku a nepotvrzenou konfiguraci**, nikoli tvrdit „bez uložení“ nebo „Zero Data Retention“ |

**PILOT MINIMUM decision:** stačí **jednou** ověřit a zapsat účetně použitelné smluvní podmínky Cloudflare/OpenAI, povahu aktuálně používaných služeb, relevantní přenosy a odpovídající informační formulaci. Nepřipravovat plošný procurement audit a nepožadovat nasazení zero-retention produktu, pokud není potřebné pro konkrétně schválený právní/rizikový režim. Nevyřešená fakta o skutečných službách však nezamlčovat.

### 10.3 Minimální retenční a výmazová rozhodnutí (rozdělit podle datové domény)

| Údaj | Aktuální důkaz / výchozí podklad | Minimální rozhodnutí před onboardingem |
|---|---|---|
| Učitelská identita a Cloudflare Access | Access používá e-mail/JWT; vendor default **Free Access logy 24 h**, jiné audity/provozní logy déle; účetně NOT VERIFIED | Uvést účel, přístup, typy záznamů, skutečný tarif/exporty, retenci či kritéria a postup zrušení přístupu |
| Pracovní Zápisník / session | V DEV kontraktu developer `localStorage`, tester `sessionStorage`, vlastník podle účtu; logout invalidace a mazání jsou best-effort; není serverové Projects | Popsat lokální uložení podle role, kdy se pracovní data resetují a že exporty/kopie a dodavatelská data se nevymažou automaticky; posoudit data na sdílených zařízeních |
| Pilot rules receipt | Server KV ukládá pseudonymizovaný identifikátor/verzi a `acceptedAt/expiresAt`; **DEV TEST 86 400 s** | **OWNER DECISION REQUIRED:** explicitní PUBLIC/pilot TTL podle účelu, postup výmazu na žádost, změna verze pravidel a případná nutnost re-acknowledgement. Testovací TTL automaticky nepřenášet |
| OpenAI AI input/response a dokumentové zdroje | `store:false` není ZDR; veřejné abuse-monitoring default až 30 dnů plus výjimky, vector-store lifecycle odděleně | Přesný ověřený popis příjemců a omezení zpracování. Nepředstírat nulové logy, neuvádět ničím nedoloženou přesnou account retenci |
| App/edge/diagnostické logy | Skutečná Cloudflare observability a logpush nastavení nejsou revidována; telemetry D1 OFF/OFF | Krátký read-only log/retention inventory, zda neobsahují pedagogické prompty nebo tokeny; určit oprávněné osoby a rozumnou dobu/objektivní kritéria |
| Telemetry D1 | V hosted DEV OFF/OFF, post-smoke 0 řádků; aktivní sběr neověřen | **NONE pro PILOT MINIMUM**, ponechat OFF; 30denní raw retention pouze neschválený plán pro G2/G4/G5 |
| Exporty, incident evidence, backup | Žádný univerzální výmaz všech kopií neověřen | Krátký DSR/erasure SOP: správcem ovladatelné kopie, účty, KV, případné dodavatelské žádosti, předání a ověření provedení; auditní záznam bez detailního případu |

Retenční lhůty **nebyly nově vymyšleny ani schváleny**; seznam výše je přímá podmínka pro doplnění čl. 13 informace. Odhlášení ani konec chat session nezaručuje smazání všech kopií.

### 10.4 Minimum rights / incident SOP — interní pracovní karta

**Vlastník operativy:** Michal Roupec; vlastníkem sdělený pilotní kontakt `catsytem.exe@gmail.com` (2026-10-26). Přesný zápis a funkčnost doručování **NOT VERIFIED**; nejde o provedený test kontaktní cesty. Není automaticky DPO.

1. **Příjem žádosti:** uchovat minimálně datum přijetí, typ žádosti, ověřenou identitu tazatele a rozhodnutí; žádný přepis pedagogického obsahu do incident/DSR evidence. Při žádosti o přístup/výmaz rozlišit údaje ovládané APU a lokální soubory/exporty účastníka. Standardní lhůty a případná prodloužení posoudit podle čl. 12 GDPR, nikoli automaticky slíbit okamžitý výmaz.
2. **Omylem zadané žákovské údaje:** ihned přestat daný obsah rozpracovávat. Vyhodnotit, zda vznikla kopie v Zápisníku, prohlížeči, externím API či exportu; u každé doložit možný postup výmazu/omezení. Neodesílat obsah podruhé při hlášení. Přenos nepovažovat automaticky za „incident ohlašovaný ÚOOÚ“; nejprve posoudit narušení bezpečnosti a riziko.
3. **Security/privacy incident:** zaznamenat čas zjištění, kategorii, rozsah a opatření bez zachycení citlivého obsahu. U skutečného porušení zabezpečení vyhodnotit čl. 33 GDPR: oznamovat ÚOOÚ bez zbytečného odkladu, pokud riziko pro práva a svobody **není nepravděpodobné**, a pokud možno do 72 hodin. Při vysokém riziku posoudit informování dotčených osob podle čl. 34. Uchovat záznam a zdůvodnění i v případě bez hlášení.
4. **Pilot offboarding:** deaktivovat Access účet podle skutečného provozního postupu, podle doloženého retention policy ukončit nebo odstranit KV receipt a vlastní exporty/diagnostiku; informovat učitele o tom, co si musí sám odstranit ze zařízení.
5. **Minimální kontrola:** funkční kontakt ověřený testovací zprávou; vlastník má přístup k procesům, kde lze údaje vyhledat, omezit a odstranit. Není třeba komerční SLA/ticketing Stage 1.

### 10.5 DPIA / risk screening — předběžný pracovní výsledek, nikoli konečný verdikt

**Plná DPIA nyní není automaticky prokázána jako povinná ani jako zbytečná.** Čl. 35 GDPR a [ÚOOÚ metodika](https://uoou.gov.cz/profesional/posouzeni-vlivu-na-ochranu-osobnich-udaju-dpia) vyžadují doložit závěr podle skutečného rizika.

| Kritérium | Hodnocení v zamýšleném pilotu | Riziko / kontrola |
|---|---|---|
| Nová/AI technologie | **ANO** — textové generativní AI API | Posoudit nespolehlivý výstup, vendor přenosy, neúmyslně citlivé vstupy; uživatel posuzuje Rozbor/Výstup |
| Děti a potenciálně zranitelní lidé | **RIZIKO NEPŘÍMÉ IDENTIFIKACE** — APU se týká pedagogických situací | Zakázat identifikující kontext, diagnózy, zdravotní zprávy; pravidla a první-gate; absence technického automatického anonymizéru |
| Zvláštní kategorie | **NENÍ ZAMÝŠLENO**, ale volný text může rizikově obsahovat | Instrukce, omezení vstupů, možnost zastavit zpracování; popsat risk of accidental inclusion |
| Škálování / systematické monitorování | **NEPROKÁZÁNO** — uzavřený limit max. 48, telemetry OFF/OFF | Udržet pozvánkový režim a bez dalšího schválení neměnit telemetry scope |
| Automatizovaná rozhodnutí s významným právním účinkem | **NEPLÁNOVÁNA** — výsledky jsou návrhy pro učitele | Nepoužívat APU jako automatické rozhodování o dítěti bez dalšího samostatného review |
| Únik, neoprávněný přístup, kopie | **REÁLNÁ HROZBA** u autentizace, browser storage, exportu a dodavatelských dat | Access/owner isolation, neidentifikující vstupy, výmaz SOP, omezení přístupu, transparentní vendor notice |

**Preliminary: SCREENING DOCUMENTED; FINAL DECISION PENDING OWNER/LEGAL REVIEW.** Riziko lze snížit hlavně vyloučením identifikovatelných žákovských údajů, diagnóz a aktivní telemetrie, ale textový zákaz sám není důkazem anonymizace. Před onboardingem odpovědná osoba písemně rozhodne **DPIA REQUIRED / NOT REQUIRED + proč** a doloží vhodnost kontrol. Pokud zhodnocení ukáže pravděpodobné vysoké riziko, plnou DPIA provést před příslušným zpracováním; jinak založit krátký risk-screening a revidovat při změně účelu, dat nebo poskytovatelů.

### 10.6 Jednostránkový release blocker matrix (pouze aktuální pilot)

| ID | Gate / příslušná osoba | Stav 2026-10-26 | Nejmenší důkaz pro uzavření |
|---|---|---|---|
| P-MIN-01 | Právní role: Michal Roupec + Zdeněk Vilímek (metodik APU) | **PARTIAL — PERSONS / ACCOUNT HOLDER OWNER-REPORTED; LEGAL ROLES OPEN** | Zbývá popis skutečného rozhodování o účelech a podstatných prostředcích; podle výsledku určit právní role a případně čl. 26 ujednání |
| P-MIN-02 | Kontaktní kanál a čl. 13 notice | **PARTIAL — CONTACT PROVIDED; SPELLING / DELIVERY NOT VERIFIED; NOTICE OPEN** | Potvrdit přesný zápis a funkčnost `catsytem.exe@gmail.com`; doplnit právního správce, účely a čl. 6 tituly, publikovatelný notice bez placeholderů |
| P-MIN-03 | Cloudflare/OpenAI dokumenty a účetní podmínky | **PUBLIC VENDOR DOCS VERIFIED; APU ACCOUNT NOT VERIFIED** | Průkazná krátká mapa skutečných provider/contracting terms, přenosů, hlavních log/retention nastavení, žádné raw secrets |
| P-MIN-04 | PUBLIC/pilot receipt TTL + mazání | **OWNER DECISION REQUIRED** | Výslovná lhůta a odůvodnění, version/re-acceptance policy, přístup a DSR výmaz SOP |
| P-MIN-05 | Logy, DSR, incident a DPIA screening | **SOP DRAFT; ACCOUNT SETTINGS / FINAL DPIA NOT VERIFIED** | Krátká operátorská evidence, funkční kontaktní cesta, podpis/rozhodnutí o DPIA |
| P-MIN-06 | Technické první potvrzení po změně pravidel | **PARTIAL** | Odděleně schválený kontrolovaný DEV acceptance test se zachycením HTTP odpovědi (bez reálné AI) |
| P-MIN-07 | Externí onboarding max. 48 / PUBLIC release | **NOT AUTHORIZED** | P-MIN-01 až 05 PASS, nutné UI/DEV ověření + oddělené provozní a deployment schválení |
| Stage 1 | Clerk/Projects/billing/rozšířené kontrakty | **DEFERRED** | Není podmínkou aktuálního omezeného pilotu; nové účely budou mít vlastní privacy gate |
| Telemetry G2/G4/G5 | Aktivní pilotní metriky | **OFF/OFF — NOT AUTHORIZED** | Samostatné účel/titul, notice, retenční/operátorské rozhodnutí a hostované testy |

**Výsledek LEGAL-P0-MIN-CLOSE:** **DOCUMENTATION V1 PASS / EXTERNAL ONBOARDING BLOCKED**. Důvody jsou konkrétní P-MIN-01–05; ne kvůli absenci budoucí společnosti nebo Stage 1 komerčních funkcí. Ani tento zápis nezakládá schválení PUBLIC UI, přidání uživatelů, aktivace telemetrie nebo deploymentu.

**Sources:** [GDPR v českém znění](https://eur-lex.europa.eu/legal-content/cs/TXT/?uri=CELEX%3A32016R0679), [ÚOOÚ DPIA](https://uoou.gov.cz/profesional/posouzeni-vlivu-na-ochranu-osobnich-udaju-dpia), [Cloudflare DPA](https://www.cloudflare.com/cloudflare-customer-dpa/), [Cloudflare Access logs](https://developers.cloudflare.com/cloudflare-one/insights/logs/), [Cloudflare KV data location](https://developers.cloudflare.com/kv/reference/data-location/), [Cloudflare subprocessors](https://www.cloudflare.com/gdpr/subprocessors/cloudflare-services/), [OpenAI DPA](https://openai.com/en-GB/policies/data-processing-addendum/), [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data).

**Documentation & Tracking:** Documentation Impact: LEGAL/PILOT OPERATIONS (this file only); Changelog **NO**; Backlog **NONE**; Known Issues **NONE**. Deployment Authorization: **NOT AUTHORIZED**.

