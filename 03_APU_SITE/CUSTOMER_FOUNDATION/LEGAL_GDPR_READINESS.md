# LEGAL-01 — GDPR a datová připravenost PUBLIC Pilot / budoucí Stage 1

**Priorita:** P0 pro **existující PUBLIC pilot**; zároveň design input do Clerk a APU Projects.
**Status:** NEEDS FACTUAL AUDIT + CONTROLLER / LEGAL APPROVAL. Tento dokument není právním stanoviskem, DPA ani potvrzením GDPR compliance.

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
