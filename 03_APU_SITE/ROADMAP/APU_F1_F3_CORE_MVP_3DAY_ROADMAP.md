# APU — F1→F3 Core MVP — 3denní implementační roadmapa
**Status:** APPROVED ROADMAP DRAFT / WORKING EXECUTION SOURCE
**Účel:** řídit autonomní implementaci zbývajícího F2 core a minimální F3 tak, aby Michal a Zdenda během sprintu prováděli pouze pedagogický, vizuální a funkční dohled na předem definovaných gatech.
**Primární cíl:** na konci sprintu existuje stabilní funkční core pipeline F1 → F2 → F3 se třemi F2 cestami POCHOPIT / POZOROVAT / VYTVOŘIT a jedním minimálním F3 strukturovaným textovým Výstupem.
**Stretch cíl:** stylizovaný DOCX export až po úplném CORE PASS a pouze pokud zbývá čas.

## 1. Definice MVP PASS
MVP je považováno za hotové pouze tehdy, když reálný uživatelský průchod splní celý následující kontrakt bez porušení source-of-truth hranic:
- F1 přijme reálnou situaci a vytvoří použitelný Zápisník a pedagogickou potřebu.
- Uživatel může vstoupit do jedné ze tří cest F2: POCHOPIT, POZOROVAT nebo VYTVOŘIT.
- F2 vytvoří aktuální Rozbor odpovídající zvolené cestě.
- F3 přijme snapshot aktuálního Rozboru přímo; explicitní legacy PREVIEW není podmínkou hlavní pipeline.
- F3 vytvoří použitelný strukturovaný textový Výstup.
- Změna upstream zdroje korektně označí závislý downstream stav jako stale; nic se tiše nepřegeneruje.
- Selhání modelového volání nezničí poslední validní Rozbor nebo Výstup a je možné bezpečně retry.
- F3 nepřidává novou pedagogickou interpretaci nebo rozhodnutí, které nebylo provedeno ve F2.
- Všechny tři referenční scénáře projdou finálním human acceptance gatem bez blockeru.

## 2. Scope freeze

### CORE IN
- Regresně zachovat současný nový POCHOPIT.
- Implementovat nový core prototyp POZOROVAT.
- Implementovat nový core prototyp VYTVOŘIT.
- Zavést společný current-Rozbor mechanismus nebo nejmenší bezpečné zobecnění současného POCHOPIT component modelu.
- Zavést přímý F2 → F3 current-Rozbor handoff.
- Zavést minimální F3 Output state, API/rendering a použitelný Output workspace.
- Zachovat explicitní generation/update, fingerprint/staleness, atomicitu a retry.
- Provést automatické testy a tři ruční visual/function acceptance gate.

### CORE OUT
- Durable Save/Open a multi-project persistence.
- Historie verzí pracovních vrstev.
- Attachments a externí integrace.
- Nový explicitní datový model kontextové matice prostředí.
- Rozsáhlý mobilní nebo responsive redesign.
- Redesign F1 mimo lokální blocker/regression repair.
- Rich text editor F3, šablonový engine, více uložených variant Výstupu.
- PDF/Word export před dosažením CORE PASS.
- Obecné refaktory a cleanup nesouvisející přímo s MVP pipeline.

## 3. Neměnné architektonické zásady
- Zápisník je canonical strukturovaný zdroj explicitních faktů a potřeb.
- Rozbor je odvozená pracovní analytická vrstva; nesmí tiše přepisovat Zápisník.
- Výstup je downstream materializace; nesmí se stát druhým nezávislým reasoning enginem.
- F3 smí strukturovat, zkrátit, přeformulovat a materializovat, ale nesmí změnit pedagogickou potřebu, přidat nebo přehodnotit hypotézy ani zvolit novou intervenci.
- POZOROVAT musí pracovat diskriminačně: z hypotéz odvozovat, co by se mezi nimi mělo lišit, v jaké situaci to lze pozorovat a jak výsledek mění podporu jednotlivých hypotéz.
- VYTVOŘIT musí před předáním do F3 obsahovat pracovní/doporučený přístup. F3 nesmí vybírat z pouhého seznamu variant.
- Běžná změna UI konfigurace nesmí automaticky volat model. Modelové akce zůstávají explicitní.
- Změna canonical need, hypotéz nebo relevantní konfigurace musí deterministicky invalidovat pouze závislý obsah.
- Legacy F2/F3 kód se během sprintu nemaže, pokud odstranění není nutné pro bezpečnou hlavní pipeline. Preferuje se izolace/odpojení.
- Kontextová matice prostředí může být využita interně v reasoning promptu, ale bez nového formuláře, nového canonical datového modelu nebo další persistence.

## 4. Execution model
Implementace běží v autonomních blocích. Po úspěšném dokončení bloku, automatických testech a self-review executor pokračuje dalším blokem stejného milestone bez čekání na Michala nebo Zdendu.
Člověk vstupuje pouze na třech human gatech. Gate je pedagogický, vizuální a funkční acceptance test; není to technický code review.

### Autonomní repair policy
- Lokální implementační chyba, test failure nebo UI blocker v rámci schváleného scope: executor opraví autonomně a test opakuje.
- Selhání jedné varianty implementace: executor smí zvolit nejmenší alternativní technické řešení, pokud zachová schválené chování a architekturu.
- Nesmí využít selhání jako důvod k repository-wide refaktoru, nové persistenci nebo změně phase boundaries.

### STOP-THE-LINE podmínky
- Je nutné změnit hranici Zápisník → Rozbor → Výstup.
- Zobecnění by změnilo nebo rozbilo schválené chování POCHOPIT.
- Vznikají dvě konkurenční canonical reprezentace aktuálního Rozboru.
- F3 potřebuje provést věcné pedagogické rozhodnutí, které F2 neumí dodat.
- Řešení vyžaduje nový persistentní datový model nebo zásadní změnu project lifecycle.
- Je nutné změnit auth/security nebo zavést bypass.
- Blocker je ve F1 a nelze jej opravit jako úzkou regresní opravu.
- Aktuální repository state zásadně odporuje roadmapě.
- Bezpečné pokračování by vyžadovalo rozšíření Change Radius o celý další subsystém.
Při STOP-THE-LINE executor vrátí BLOCKED, přesný rozpor, nejmenší doporučenou korekci a zachová pracovní strom bez destruktivních změn mimo dokončený bezpečný rozsah.

## 5. Repository a branch policy
- Canonical repository: catsystemexe/APU_MS_site.
- Stable branch: main.
- Aktivní vývojová větev: next.
- Sprint vychází z aktuálního next; před prvním zápisem musí executor ověřit aktuální HEAD a čistotu/bezpečnost checkoutu.
- Codex Cloud může checkout zobrazovat jako work; správnost se ověřuje očekávaným HEAD/base, nikoli pouze názvem lokální větve.
- Navržené PR skupiny: PR-A F2 Core; PR-B F2→F3 + F3 MVP; PR-C Stabilization / MVP closeout.
- Human PASS milestone autorizuje dokončení dokumentace a merge příslušného milestone PR do next, pokud jsou checks green a branch není nečekaně diverged.
- Production deployment není součástí sprintu a zůstává NOT AUTHORIZED.

## 6. Referenční acceptance scénáře
Použít existující fixtures v app/dev-test-scenarios.ts. Nevytvářet pro sprint nový test corpus.

### Scenario A — level-1 / Základní
**Účel:** nejjednodušší smoke celé pipeline a regrese POCHOPIT. Stručný popis odcházení dítěte z ranního kruhu.

### Scenario B — level-2 / Detailní
**Účel:** primární acceptance pro POZOROVAT. Scénář obsahuje konkrétní rozdíly podmínek — kratší kruh a možnost držet drobný předmět — a musí vést k diskriminačnímu pozorování, nikoli ke generickému checklistu.

### Scenario C — level-3 / Stress test
**Účel:** primární acceptance pro VYTVOŘIT → F3. Obsahuje více kontextových proměnných, odlišné situace a explicitní požadavek na praktické kroky bez předčasného diagnostického závěru.

## 7. Třídenní pořadí práce
- Den 1: Milestone 0 + Milestone 1 F2 Core + HUMAN GATE #1.
- Den 2: Milestone 2 F2→F3 + F3 MVP + HUMAN GATE #2.
- Den 3: Milestone 3 Core stabilization + HUMAN GATE #3 + případný stretch DOCX.
- Časové pořadí je orientační; technická závislost milestone má přednost před kalendářem.

## 8. MILESTONE 0 — Baseline & safety preflight

### Batch 0 — Baseline proof

#### IMPLEMENTATION PROFILE

```text
Mode: Work
Execution environment: Codex Cloud
Recommended model: GPT-5.6 Sol
Reasoning effort: Medium
Change radius: R1
Verification: V2
Reason: Je nutné ověřit skutečný next baseline a současnou F1/F2/F3 regresní plochu před migrací kontraktů; bez důvodu se nic nemění.
```

#### Goal
Prokázat bezpečný výchozí stav a vytvořit technický checkpoint pro sprint.

#### Required work
- Ověřit aktuální next HEAD, base a worktree.
- Spustit minimálně typecheck, relevantní F2/F3 contract tests a build/test cestu přiměřenou aktuálnímu repo kontraktu.
- Potvrdit současný nový POCHOPIT component flow a existenci legacy POZOROVAT/VYTVOŘIT/F3 kontraktů.
- Zmapovat pouze přímo dotčené files/components/API routes; neprovádět obecný audit.
- Zaznamenat přesný baseline SHA pro všechny další sprint bloky.

#### Acceptance criteria
- Baseline lze reprodukovat.
- Není známý blocker znemožňující F2/F3 práci.
- Pokud existuje pre-existing failing test, je jasně oddělen od sprint scope a posouzen, zda blokuje pokračování.
- Žádná produktová změna nebyla provedena.

#### Documentation & Tracking
**Documentation Impact:** NONE
**Changelog:** NO
**Backlog:** NONE
**Known Issues:** NONE, pokud baseline neodhalí nový potvrzený defect.
**Deployment Authorization:** NOT AUTHORIZED

## 9. MILESTONE 1 — Unified F2 Core
Cíl milestone: všechny tři F2 cesty používají jeden konzistentní current-Rozbor princip. POCHOPIT zůstává regresně stabilní; POZOROVAT a VYTVOŘIT přestávají být odkázané na starý five-skill/processed-build model hlavní pipeline.

### Batch 1A — Shared current-Rozbor component core

#### IMPLEMENTATION PROFILE

```text
Mode: Work
Execution environment: Codex Cloud
Recommended model: GPT-5.6 Sol
Reasoning effort: High
Change radius: R3
Verification: V2
Reason: Jde o nejcitlivější generalizaci sprintu: je nutné sjednotit cestovní konfiguraci bez ztráty současných silných vlastností POCHOPIT.
```

#### Goal
Zobecnit současný PochopitBuildState/RozborComponent mechanismus na nejmenší společný current-Rozbor core, který umí path-specific required components.

#### Required changes
- Zavést jasný path-aware component contract pro POCHOPIT / POZOROVAT / VYTVOŘIT.
- Zachovat stable component IDs/fingerprints, selective generation, reconciliation, atomic apply a stale-response discard.
- Zachovat explicitní VYTVOŘIT/AKTUALIZOVAT modelové akce.
- Zachovat baseline need + hypotheses jako autoritativní F2 source.
- Nedovolit, aby path switch nebo toggle sám generoval modelový obsah.
- Neprovádět zbytečný framework refactor; zobecnit pouze to, co následující dvě cesty skutečně potřebují.

#### Acceptance criteria
- Současné POCHOPIT testy a behavior projdou bez věcné regrese.
- Core umí odvodit required component specs pro více paths.
- Reconciliation invaliduje pouze komponenty závislé na změněném source/config.
- Žádná změna nepřepisuje Zápisník nebo baseline hypotheses.

#### Documentation & Tracking
**Documentation Impact:** NONE — dokumentovat až po milestone PASS.
**Changelog:** NO
**Backlog:** NONE
**Known Issues:** NONE
**Deployment Authorization:** NOT AUTHORIZED

### Batch 1B — F2 POZOROVAT core prototype

#### IMPLEMENTATION PROFILE

```text
Mode: Work
Execution environment: Codex Cloud
Recommended model: GPT-5.6 Sol
Reasoning effort: Medium
Change radius: R2
Verification: V2
Reason: Path semantics jsou produktově rozhodnuté; implementace rozšiřuje již připravený shared core.
```

#### Goal
Dodat minimální, ale analyticky kvalitní POZOROVAT, které pomáhá rozlišit pracovní hypotézy pomocí cílené evidence.

#### Path operations
- Rozvinout hypotézy.
- Porovnat a propojit hypotézy.
- Určit klíčové indikátory.
- Stanovit priority pozorování.

#### Required output semantics
- Účel pozorování.
- Konkrétní observable indicators.
- Situace nebo kontrasty, ve kterých má smysl indikátory sledovat.
- Priorita: co sledovat nejdřív a proč.
- Vazba na hypotézy: jaký výsledek podporu hypotézy zvyšuje, snižuje nebo nerozlišuje.
- Relevantní omezení a nejistoty.

#### Special requirement — discriminative observation
POZOROVAT nesmí skončit generickým seznamem typu „pozorujte dítě“. Má přednostně hledat proměnné, jejichž změna rozlišuje mezi plausible hypotheses. Kontextové dimenze prostředí může model interně využít, pokud jsou opřené o Zápisník; nevzniká nový explicitní context UI/model.

#### Acceptance criteria
- Scenario B generuje alespoň jeden smysluplný kontrast podmínek založený na vstupních datech.
- Indikátory jsou pozorovatelné a nejsou diagnostickými závěry.
- Výstup zachovává uncertainty.
- F2 update/staleness funguje stejně jako u POCHOPIT.
- API schema odmítne neúplný nebo nevyžádaný structured result.

#### Documentation & Tracking
**Documentation Impact:** NONE — dokumentovat až po milestone PASS.
**Changelog:** NO
**Backlog:** NONE
**Known Issues:** NONE
**Deployment Authorization:** NOT AUTHORIZED

### Batch 1C — F2 VYTVOŘIT core prototype

#### IMPLEMENTATION PROFILE

```text
Mode: Work
Execution environment: Codex Cloud
Recommended model: GPT-5.6 Sol
Reasoning effort: Medium
Change radius: R2
Verification: V2
Reason: VYTVOŘIT musí dodat rozhodnutou pracovní specifikaci pro F3; nejde ještě o dokumentový nebo šablonový engine.
```

#### Goal
Dodat minimální VYTVOŘIT, které z analýzy přejde k explicitnímu pracovnímu přístupu a předá F3 dostatek věcného materiálu bez dalšího pedagogického rozhodování.

#### Path operations
- Rozvinout hypotézy.
- Navrhnout možné přístupy.
- Zpřesnit cíl.
- Určit podmínky úspěchu.
- Určit, co následně ověřovat.

#### Required output semantics
- Pedagogický/praktický cíl.
- Možné přístupy pouze pokud jsou užitečné.
- Povinný pracovní/doporučený přístup — F3 nesmí volit variantu samo.
- Podmínky úspěšného použití.
- Co následně ověřovat.
- Relevantní vazba na hypotézy a omezení.

#### Acceptance criteria
- Scenario C skončí konkrétním working approach, nikoli pouze brainstormingem variant.
- Doporučený přístup je odůvodněný dostupným Rozborem a nevytváří diagnostický závěr.
- Bez working approach je stav nepřipravený pro F3 VYTVOŘIT.
- Změna upstream source správně invaliduje závislé komponenty.
- POCHOPIT a POZOROVAT zůstávají bez regrese.

#### Documentation & Tracking
**Documentation Impact:** NONE — dokumentovat až po milestone PASS.
**Changelog:** NO
**Backlog:** NONE
**Known Issues:** NONE
**Deployment Authorization:** NOT AUTHORIZED

### HUMAN GATE #1 — F2 acceptance
Gate se spustí až po zelených automated checks všech Batch 1A–1C. Michal + Zdenda pouze vizuálně a funkčně otestují F2.

#### Manual test
- Scenario A → POCHOPIT: rozbor dává smysl a současné chování není regresní.
- Scenario B → POZOROVAT: výstup obsahuje konkrétní diskriminační indikátory/kontrasty, ne generický checklist.
- Scenario C → VYTVOŘIT: vznikne konkrétní working approach, podmínky a následné ověřování.

#### Human scorecard
- F2 obsah: PASS / FAIL.
- F2 UX: PASS / FAIL.
- Blocker: ANO / NE.
- Poznámka: maximálně 2–3 věty.
PASS → automatický milestone closeout, dokumentace a PR-A merge do next. FAIL → targeted repair pouze konkrétního blockeru, automated verification a opakování Gate #1.

### Batch 1D — Milestone 1 closeout after Gate #1 PASS

#### IMPLEMENTATION PROFILE

```text
Mode: Work
Execution environment: Codex Cloud
Recommended model: GPT-5.6 Terra or equivalent low-cost coding profile
Reasoning effort: Low
Change radius: R1
Verification: V1
Reason: Pouze přesné zaznamenání ověřeného stavu a finalizace PR-A.
```

#### Documentation & Tracking
**Documentation Impact:** CURRENT PRODUCT BEHAVIOR
- Update 01_PRODUCT/CURRENT_STATE/APU_CURRENT_STATE.md pouze podle skutečně ověřeného chování.
- Changelog: YES.
- Backlog: aktualizovat pouze položku přímo dotčenou novým F2 stavem; nevyužívat backlog jako work log.
- Known Issues: NONE, pokud Gate neodhalil přetrvávající potvrzený defect.
**Deployment Authorization:** NOT AUTHORIZED

## 10. MILESTONE 2 — Direct F2→F3 contract + Minimal F3

### Batch 2A — Current Rozbor → F3 handoff snapshot

#### IMPLEMENTATION PROFILE

```text
Mode: Work
Execution environment: Codex Cloud
Recommended model: GPT-5.6 Sol
Reasoning effort: High
Change radius: R3
Verification: V2
Reason: Migruje se phase boundary ze starého PREVIEW-bound kontraktu na current-Rozbor source contract; chyba zde by narušila celý F1→F3 tok.
```

#### Goal
Zavést jeden immutable F2→F3 snapshot odvozený z aktuálního Rozboru, nikoli ze starého rendered PREVIEW.

#### Minimum snapshot semantics
- Canonical pedagogical need/reference.
- Active F2 path.
- Baseline hypotheses nebo jejich stabilní source reference potřebná pro zachování významu.
- Aktuální path-specific Rozbor components/content.
- Relevantní uncertainty/limitations.
- F3 target, pokud existuje.
- Source revision/fingerprint umožňující staleness.

#### Acceptance criteria
- Každá ze tří cest dokáže vytvořit snapshot bez legacy PREVIEW.
- Snapshot je immutable handoff a downstream změny jej zpětně nemění.
- Neaktuální F2 stav nelze vydávat za current handoff.
- VYTVOŘIT bez working approach není validní handoff pro materializaci.
- Legacy PREVIEW může dočasně zůstat v repu, ale není podmínkou primární pipeline.

#### Documentation & Tracking
**Documentation Impact:** NONE — dokumentovat až po milestone PASS.
**Changelog:** NO
**Backlog:** NONE
**Known Issues:** NONE
**Deployment Authorization:** NOT AUTHORIZED

### Batch 2B — Minimal F3 Output state, API and workspace

#### IMPLEMENTATION PROFILE

```text
Mode: Work
Execution environment: Codex Cloud
Recommended model: GPT-5.6 Sol
Reasoning effort: Medium
Change radius: R2
Verification: V2
Reason: Existující legacy F3 renderer poskytuje použitelný základ; cílem je změnit source contract a zúžit MVP, ne přepsat celý F3.
```

#### Goal
Z aktuálního F2→F3 snapshotu vytvořit minimální použitelný strukturovaný textový Výstup.

#### MVP Output
- Název.
- Krátký úvod / účel.
- Strukturované sekce odpovídající obsahu.
- Relevantní podmínky nebo omezení použití.
- Volitelná tabulka/karty pouze pokud existující renderer je zachová bez rozšíření scope.

#### Default presentation
- Adresát: učitel.
- Jazyk: běžný/srozumitelný.
- Rozsah: standardní.
- Struktura: auto.
Existující controls pro adresáta/styl/rozsah/strukturu mohou zůstat, pokud migraci nezkomplikují. Nejsou podmínkou MVP.

#### F3 semantic boundaries
- POCHOPIT: materializovat vysvětlení/přehled bez nové intervence.
- POZOROVAT: materializovat již rozhodnutý pozorovací plán/specifikaci.
- VYTVOŘIT: vytvořit praktický text podle již zvoleného working approach.
- Pokud chybí věcné rozhodnutí nutné pro výstup, F3 vrací boundary issue a neposouvá rozhodování samo do sebe.

#### Acceptance criteria
- F3 vytvoří validní Output z každé ze tří cest.
- Structured output schema je validován server-side.
- F3 nemění F2 source ani Zápisník.
- Modelový failure zachová poslední validní Output.
- Retry je funkční.

#### Documentation & Tracking
**Documentation Impact:** NONE — dokumentovat až po milestone PASS.
**Changelog:** NO
**Backlog:** NONE
**Known Issues:** NONE
**Deployment Authorization:** NOT AUTHORIZED

### Batch 2C — Staleness, transitions and legacy decoupling

#### IMPLEMENTATION PROFILE

```text
Mode: Work
Execution environment: Codex Cloud
Recommended model: GPT-5.6 Sol
Reasoning effort: Medium
Change radius: R2
Verification: V2
Reason: Stabilizuje state transitions mezi F2 a F3 a odstraní povinnou závislost hlavní pipeline na legacy PREVIEW bez zbytečného mazání kódu.
```

#### Required behavior
- Změna F2 po vytvoření Outputu označí F3 jako stale.
- Stale Output zůstává viditelný pro referenci; není automaticky přepsán.
- Uživatel explicitně přijme aktuální F2 snapshot / regeneruje Output.
- Return-to-F2 nepoškodí současný Output ani F2 state.
- Primary navigation F2→F3 nepoužívá PREVIEW jako povinný bridge.
- Legacy code je pouze izolován; destruktivní cleanup se odkládá.

#### Acceptance criteria
- Automated test pokrývá změnu source po F3 renderu.
- Automated test pokrývá retry po F3 failure.
- Phase/navigation state se nezacyklí a nelze nepozorovaně použít stale source jako current.

#### Documentation & Tracking
**Documentation Impact:** NONE — dokumentovat až po milestone PASS.
**Changelog:** NO
**Backlog:** NONE
**Known Issues:** NONE
**Deployment Authorization:** NOT AUTHORIZED

### HUMAN GATE #2 — F2→F3 and Output acceptance
Michal + Zdenda testují pouze výsledný user flow od hotového Rozboru do F3.
- Scenario A / POCHOPIT → F3 vysvětlující strukturovaný text.
- Scenario B / POZOROVAT → F3 použitelný pozorovací plán.
- Scenario C / VYTVOŘIT → F3 praktický strukturovaný text podle working approach.
- U jednoho scénáře změnit F2 po vytvoření F3 a ověřit viditelný stale stav a explicitní regeneraci.

#### Human scorecard
- F3 obsah: PASS / FAIL.
- F3 UX: PASS / FAIL.
- F2→F3 návaznost: PASS / FAIL.
- Stale behavior: PASS / FAIL.
- Blocker: ANO / NE.
- Poznámka: maximálně 2–3 věty.
PASS → milestone closeout, dokumentace a PR-B merge do next. FAIL → targeted repair + automated verification + opakování Gate #2.

### Batch 2D — Milestone 2 closeout after Gate #2 PASS

#### IMPLEMENTATION PROFILE

```text
Mode: Work
Execution environment: Codex Cloud
Recommended model: GPT-5.6 Terra or equivalent low-cost coding profile
Reasoning effort: Low
Change radius: R1
Verification: V1
Reason: Dokumentuje se pouze reálně ověřený nový F2→F3 contract a F3 MVP.
```

#### Documentation & Tracking
**Documentation Impact:** PRODUCT FLOW / CURRENT STATE
- Update 01_PRODUCT/CURRENT_STATE/APU_CURRENT_STATE.md.
- Changelog: YES.
- Backlog: UPDATE B-01 Structured F3 Output; RESOLVE pouze pokud implementovaný stav skutečně splňuje definici položky, jinak ponechat zúžený zbytek.
- Known Issues: NONE, pokud není potvrzen nový defect.
**Deployment Authorization:** NOT AUTHORIZED

## 11. MILESTONE 3 — Core stabilization

### Batch 3A — Automated F1→F3 regression matrix

#### IMPLEMENTATION PROFILE

```text
Mode: Work
Execution environment: Codex Cloud
Recommended model: GPT-5.6 Sol
Reasoning effort: Medium
Change radius: R2
Verification: V3
Reason: Nejde o další feature development; cílem je systémově prověřit kritickou pipeline a opravit pouze blockery nebo core regrese.
```

#### Required verification
- Typecheck.
- Lint pouze podle aktuálního repo kontraktu a pokud je relevantní/stabilní.
- Build/artifact validation.
- Relevantní unit tests F2 core/reconciliation.
- F2 API contract tests pro všechny tři paths.
- F3 API contract tests pro nový handoff.
- Staleness/atomicity/retry tests.
- Existující relevantní regression suite.
- Explicitně ověřit, že F1 current behavior nebyl změněn.

#### Repair scope
Autonomně opravovat pouze vady blokující MVP PASS nebo jasné regrese přímo vyvolané sprintem. Cosmetic polish, unrelated tech debt a nové capability odkládat.

#### Documentation & Tracking
**Documentation Impact:** NONE — finální docs až po human Gate #3.
**Changelog:** NO
**Backlog:** NONE
**Known Issues:** ADD pouze pro potvrzený defect, který nelze bezpečně opravit v sprint scope.
**Deployment Authorization:** NOT AUTHORIZED

### Batch 3B — Local real-runtime verification

#### IMPLEMENTATION PROFILE

```text
Mode: Local
Execution environment: Local Windows PowerShell
Recommended model: N/A
Reasoning effort: N/A
Change radius: R0
Verification: V3
Reason: Reálné API/secrets, browser behavior a vizuální interakce musí být ověřeny mimo cloud checkout; lokální runtime je pro tento typ smoke testu autoritativní.
```

#### Automated/local preparation
- Spustit schválený local dev command podle repo dokumentace.
- Použít existující .env.local pouze lokálně; žádné secret values nevypisovat ani nepřenášet.
- Ověřit app startup a základní browser availability.
Samotné pedagogické a vizuální acceptance provádí Michal + Zdenda v HUMAN GATE #3.

### HUMAN GATE #3 — Final Core MVP acceptance
Každý scénář projít od nového projektu přes F1 až do F3. Nehodnotit stylistickou dokonalost formulací; prioritou jsou invariants, použitelnost a konzistence reasoning pipeline.

### Scenario A
- F1: PASS / FAIL.
- POCHOPIT obsah: PASS / FAIL.
- F3 obsah: PASS / FAIL.
- UX/flow: PASS / FAIL.

### Scenario B
- F1: PASS / FAIL.
- POZOROVAT diskriminační kvalita: PASS / FAIL.
- F3 pozorovací plán: PASS / FAIL.
- UX/flow: PASS / FAIL.

### Scenario C
- F1: PASS / FAIL.
- VYTVOŘIT working approach: PASS / FAIL.
- F3 praktický Výstup: PASS / FAIL.
- UX/flow: PASS / FAIL.

#### Cross-cutting invariants
- APU si nevymýšlí canonical fakta.
- F2 odděluje fakta, hypotézy a nejistotu.
- F3 pouze materializuje F2 rozhodnutí.
- Upstream změna správně invaliduje downstream.
- Failure/retry nezničí poslední validní stav.
- Žádný blocker v základní navigaci nebo renderu.
CORE PASS vyžaduje všechny tři scénáře bez blockeru. Drobné wording nebo cosmetic připomínky se zapisují mimo sprint blocker list.

### Batch 3C — Targeted repair loop

#### IMPLEMENTATION PROFILE

```text
Mode: Work
Execution environment: Codex Cloud; Local Windows PowerShell pouze pro reprodukci runtime/visual vady
Recommended model: GPT-5.6 Sol
Reasoning effort: Medium; High pouze při skutečné root-cause nejednoznačnosti
Change radius: R1–R2 podle potvrzeného blockeru
Verification: V2–V3 podle dotčeného flow
Reason: Opravit pouze konkrétní acceptance blocker bez znovuotevření designu nebo rozšíření sprintu.
```

#### Repair protocol
- Každý FAIL převést na reprodukovatelný defect statement.
- Určit nejmenší vlastnící subsystém.
- Implementovat targeted fix.
- Spustit lokální test + související regression set.
- Opakovat pouze příslušnou část human gate a následně kritický happy path.
- Po PASS neprovádět preventivní refaktor.

#### Documentation & Tracking
**Documentation Impact:** pouze pokud fix mění skutečně ověřené chování.
**Changelog:** YES pro user-visible/core behavior fix.
**Backlog:** NONE, pokud nejde o zbylou explicitní práci.
**Known Issues:** RESOLVE pouze pokud oprava zavírá existující potvrzený issue.
**Deployment Authorization:** NOT AUTHORIZED

### Batch 3D — MVP closeout after Gate #3 PASS

#### IMPLEMENTATION PROFILE

```text
Mode: Work
Execution environment: Codex Cloud + GitHub UI/API podle potřeby
Recommended model: GPT-5.6 Terra or equivalent low-cost coding profile
Reasoning effort: Low
Change radius: R1
Verification: V1
Reason: Uzavření dokumentace, tracking stavu a PR-C po již dokončené systémové verifikaci.
```

#### Required closeout
- Aktualizovat APU_CURRENT_STATE pouze na ověřený stav.
- Aktualizovat runtime/technical current pouze pokud se změnil skutečný runtime/contract popis.
- CHANGELOG zaznamená skutečně implementované milestone změny.
- BACKLOG B-01 aktualizovat/resolve podle skutečného rozsahu F3 MVP.
- KNOWN_ISSUES KI-01 resolve pouze pokud byl skutečně proveden požadovaný authenticated hosted smoke; lokální smoke sám nestačí.
- Finalizovat PR-C a po human PASS jej lze merge do next.
- Nevytvářet production deployment.
**Deployment Authorization:** NOT AUTHORIZED

## 12. Stretch only — Styled DOCX export
Tento blok se NESMÍ spustit před CORE PASS. Pokud Gate #3 není PASS nebo zbývá otevřený blocker, DOCX se přeskočí.

### Batch 4 — Single styled DOCX export

#### IMPLEMENTATION PROFILE

```text
Mode: Work
Execution environment: Codex Cloud + vhodný dokumentový/export mechanismus podle aktuální architektury
Recommended model: GPT-5.6 Sol
Reasoning effort: Medium
Change radius: R2
Verification: V2
Reason: Jediný export aktuálního F3 Outputu; žádný obecný template/document engine.
```

#### Scope
- Export jednoho aktuálního F3 material do stylizovaného DOCX.
- Čitelná základní typografie a hierarchie.
- Preserve content semantics z F3; žádné nové pedagogické reasoning.
- Jednoduchý download/export action.

#### Non-scope
- Uživatelské šablony.
- WYSIWYG editor.
- Komplexní branding engine.
- Více typů dokumentových exportů.
- PDF workflow.
**Deployment Authorization:** NOT AUTHORIZED

## 13. PR a checkpoint strategie
- PR-A: Batch 1A–1C + closeout 1D. Gate #1 probíhá nad PR branch. PASS → docs → merge next.
- PR-B: Batch 2A–2C + closeout 2D. Gate #2 probíhá nad PR branch. PASS → docs → merge next.
- PR-C: Batch 3A + targeted repairs + closeout 3D. Gate #3 probíhá nad release-candidate state. PASS → docs → merge next.
- Každý PR musí být technicky koherentní a verifikovatelný; mikro-PR pro každý jednotlivý toggle nejsou žádoucí.
- Atomic commits uvnitř PR jsou vítané, pokud zjednodušují rollback a review.

## 14. Human supervision protocol
Michal a Zdenda nejsou operátoři implementace. Jejich role je acceptance testing.

### Co nedělat během gate
- Neřešit implementační detaily nebo návrhy refaktorů.
- Neopravovat kód ručně.
- Nezapisovat dlouhé bug reporty.
- Neřešit kosmetiku, pokud nebrání pochopení nebo používání flow.
- Nehodnotit hlavně stylistickou krásu textu.

### Co hodnotit
- Je obsah pedagogicky smysluplný?
- Drží systém fakta vs hypotézy vs rozhodnutí?
- Dělá zvolená F2 cesta skutečně svou práci?
- Je F3 věrnou materializací F2?
- Je interakce srozumitelná a bez blockeru?
- Je stale/failure/retry chování pochopitelné?

## 15. Success state po sprintu
Po úspěšném dokončení roadmapy má APU poprvé jeden end-to-end stabilní core mechanismus:
F1 — explicitní fakta a pedagogická potřeba → F2 — path-specific reasoning a aktuální Rozbor → F3 — kontrolovaná materializace do použitelného Výstupu.
MVP neznamená hotový produkt. Znamená stabilní jádro, na které lze následně bezpečně navázat persistence, bohatší F3 outputs, exporty, attachments, integrace a další produktové vrstvy.

## 16. Source-of-truth a práce s touto roadmapou
- Google Drive dokument je human/work reference pro sprint.
- Celou roadmapu NEVKLÁDAT do trvalých ChatGPT Project Instructions. Project Instructions mají zůstat stabilními pravidly role/workflow, ne dočasným sprint backlogem.
- Pro ChatGPT lze dokument případně přidat jako Project Source/reference, nikoli jako governing instruction.
- Pro Codex Cloud vytvořit před startem schválený Markdown mirror v repository na next, protože Codex Cloud Google Drive ani ChatGPT Project Sources standardně nevidí.
- Repo mirror je během implementace executor-visible source. Po změně roadmapy je nutné zabránit divergence mezi Drive working copy a repo mirror.
- Roadmapa neopravňuje production deployment. Každý batch explicitně používá Deployment Authorization: NOT AUTHORIZED.
