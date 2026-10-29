# APU T5 — jeden Rozbor, provider a telemetry ledger

**Příprava, nikoli hosted PASS ani autorizace.** VS agent: Luna Low, bez delegování, dalších promptů a náhradních postupů. Aktuálně **BLOCKED před aktivací a provider voláním**: chybí reviewovaný způsob dočasné konfigurace nad přesnou aktivní verzí a nezávislá provider evidence (§4). Tento dokument nesmí být vykonán celý jako shell skript. Části označené „po autorizaci“ jsou návrh samostatného operátorského zadání; nyní pouze offline příprava.

## 1. Neměnné body a zdroj kontroly

| Bod | Přesná hodnota |
| --- | --- |
| Aplikační source | `d706a55c7ff80b1439079badfda88c9baa5807c4` |
| Evidence / základ tohoto PR | PR #88, `019f3caf1150e5c00f5577464c67e021b61fea42`, `docs/pilot-tech-t2-hosted-evidence` |
| T4 postup | PR #89, `1cfef6a8eed8b421c6584b97b9e56761e92a52db` |
| Worker / jediný origin | `apu-ms-site-dev` / `https://apu-ms-site-dev.catsystem-exe.workers.dev` |
| Výchozí a rollback verze | `732bf950-30cf-444a-90fc-8927d9c8b16c`, 100 % traffic |
| Výchozí runtime | telemetry/metadata `0/0`, receipt TTL `86400`, local auth `0`, původní developer role |
| Jediná identita | `catsystem.exe@gmail.com`; email nepatří do telemetry evidence |
| Existující resources | `TELEMETRY_DB` → dedikovaná EU `apu-ms-site-dev-telemetry`; stávající Access, KV, ASSETS a provider secrets beze změny |

T3 a T4 jsou převzaté operátorské **PASS**. Neopakovat refusal test, první receipt POST/GET/reload ani jejich historickou diagnostiku. Historická příčina incidentu zůstává NOT VERIFIED. PUBLIC readiness je otevřená.

Kontrola source proběhla nad uvedeným aplikačním commitem. Relevantní soubory: [klient](../../app/apu-client.tsx), [textová navigace](../../app/dialog-action.ts), [desktop gating](../../app/desktop-workspace.ts), [router cache](../../app/f2-need-routing.ts), [extract](../../app/api/extract/route.ts), [need-route](../../app/api/need-route/route.ts), [analysis](../../app/api/analysis/route.ts), [provider wrapper](../../app/openai-responses-instrumentation.ts), [lifecycle](../../app/model-call-instrumentation.ts), [projekce/sink](../../app/telemetry/model-usage-adapter.ts), [ceník](../../app/usage-ledger.ts). Helper používá stávající tři tabulky, nikoli nové schéma.

## 2. Nejmenší doložený běžný UI průchod

Nový projekt je ve F1; úvodní zpráva nemá NAV kartu a desktop „Obsah“ je ve F1 disabled i po ručním vyplnění. Nelze tedy slíbit samotné dvě serverové operace routing + Rozbor. **Zvolena jedna běžná odeslaná zpráva `Přejít do fáze 2` nad ručně vyplněným Zápisníkem.** `sendMessage()` před rozpoznáním textové navigace spouští extrakci; teprve `requestAssistant()` provede F1→F2. Interní `dialogEvent`, pilot metody, seed React state ani přímé API POST se nepoužijí.

Pevný obsah; nic dalšího nedoplňovat:

- **Pozorovaný projev / manifestations:** „Ve smyšlené skupině při společném stavění po dlouhém slovním zadání několik účastníků nezačne pracovat; po krátké ukázce se zapojí.“
- **Pedagogická potřeba / goals:** „Potřebuji porozumět tomu, jak délka a podoba zadání souvisí se zapojením do společné činnosti.“
- Ostatní kategorie prázdné; jedna potřeba, žádný attachment, diktování, diagnóza, identifikátor ani zdravotní údaj.
- **Jediná zpráva do composeru:** `Přejít do fáze 2` (nikoli „Přejít do Rozboru“, které textový resolver nerozpoznává stejně).

| Pořadí a fyzický POST `/v1/responses` | Model / reasoning / tier | Automatické chování |
| --- | --- | --- |
| `/api/extract`: extraction F1 | `gpt-5.6-luna` / low / default | Vždy jeden pokus, output cap 2000. Při nulových kandidátech bez groundingu. |
| Stejný extract: primary grounding F1 | Luna / low / default | Jen při kandidátech, nejvýše jeden, output cap 1200. |
| Stejný extract: rescue grounding F1 | Luna / low / default | Jen při explicitních zamítnutích úspěšného primary; nejvýše jeden, attempt 1, fallback na primary call ID, output cap 1200–4000. Není to HTTP retry. |
| `/api/need-route`: need_routing F2 | `gpt-5.6-terra` / low / default | Jeden úspěšný routing; effect a explicitní analysis sdílejí promise/cache stejné potřeby. Nejasný routing = STOP, žádné upřesnění. |
| `/api/analysis`: analysis F2 | Terra / low / default | Jedna analýza, `file_search` nad existujícím vector store; počet tool calls není explicitně omezen. |

Očekávání **3 fyzické Responses requesty**, podmíněně **4–5** s groundingem. Tři browser AI POSTy: extract → need-route → analysis. Grounding není další browser POST a sdílí extraction operation ticket; rescue má vlastní call ID. Žádný MAIN/chat, Controller, F2 Build, F3 generation, retry ani regenerace. Přijatý Rozbor vytvoří lokální výchozí F3 snapshot **bez dalšího AI volání**. Samostatně neotvírat Výstup.

Všechny uvedené provider payloady mají `store:false`. Wrapper používá jeden `fetch`, nikoli SDK s implicitními retries. Chyba extrakce může přesto dovolit pokračování původní aplikace; to není T5 PASS. Již rozběhlé automatické operace nepřerušovat kvůli dorovnání očekávaného počtu. Žádné opakování po chybě. Odlišný browser/provider graf = FAIL_SCOPE, zachovat evidence a uzavřít okno.

Deterministický je vstup a počet uživatelských odeslání, **nikoli odpověď modelu**: clarification, conflict nebo rejected output znamenají neúspěšný jediný pokus, ne povolení další otázky.

## 3. Návrh rozsahu a rozpočtu pro samostatné schválení

Navržen jeden účet, jeden panel, jeden cohort, jedna návštěva/session, jeden workflow, **jedno kliknutí Odeslat**, žádné retry. Přípravné UI akce: nejvýše jeden „Nový projekt“ před opt-in, dvě ručně přidané položky, jeden opt-in, jedno odeslání a jedno „Zastavit měření“. Případné jediné běžné výslovné přijetí expirovaných pravidel je předpoklad; nepočítá se jako AI akce ani opakování T4.

- Navržený scope strop: **5 fyzických Responses requestů** (3 základní + 2 podmíněné grounding). Vynutitelné operátorským checklistem je jediné odeslání a zákaz retry. Aplikace nemá globální hosted request/budget limiter; pět není nově vynucený produkční limit. Při dalším requestu FAIL_SCOPE, žádné další klikání; již zahájené requesty mohou doběhnout.
- **USD 1.00 celkem** jako navržený měkký autorizační rozpočet/STOP práh, ne garantovaný hard spending cap. `analysis` ani `need-route` nemají explicitní `max_output_tokens`; analysis nemá `max_tool_calls`. `file_search` může proběhnout vícekrát uvnitř jednoho Responses requestu. Konečný absolutní finanční strop source nezaručuje. Pokud schvalovatel vyžaduje technicky vynutitelný USD cap před utracením, **BLOCKED_BUDGET_GUARANTEE**; samostatný Repair návrh output/tool/request limitů, žádná oprava v T5.
- Reprodukovatelný orientační scénář: dohromady Terra 40 000 input + 10 000 output = USD 0.20; tři Luna calls dohromady 30 000 input + 7200 output = USD 0.01464; dvě file_search calls = USD 0.005; součet **USD 0.21964**. To jsou předpoklady, nikoli predikce tokenů, počet garantovaných tools ani vyúčtování.
- Použitý aplikační snapshot `openai-standard-2026-08-25`: short input ≤272000, Terra 2/0.2/2.5/12, Luna 0.2/0.02/0.25/1.2 USD/milion input/cached/cache-write/output; long Terra 4/0.4/5/18 a Luna 0.4/0.04/0.5/1.8. File search USD 2.5/1000 calls. Reasoning tokens jsou podmnožina output, nepřičítat znovu; cached/cache-write jsou podmnožiny input. Existující vector-store storage náklady nejsou nový testovací resource ani zahrnuté vyúčtování tohoto průchodu.
- Chybějící usage/cost je **null / incomplete**, nikoli nula. Úspěšný API status nestačí. Při známém nákladu >USD 1 FAIL_SOFT_BUDGET_EXCEEDED; měření uzavřít až po vyřešení pending zápisů. Nikdy automaticky neopakovat pokus kvůli neúspěšné evidenci.

## 4. Gates — před provider testem musí být všechny uzavřené

1. **Read-only preflight + exact rollback availability:** z [T4 přesného commitu](https://github.com/catsystemexe/APU_MS_site/blob/1cfef6a8eed8b421c6584b97b9e56761e92a52db/03_APU_SITE/TELEMETRY/T4_RECEIPT_OPERATOR_HANDOFF.md#2-powershell--pouze-read-only-dev-preflight) vykonat **jen celý PowerShell blok §2**, nikoli T4 browser scénář. Pokaždé vytvoří a odstraní vlastní target-only config; nepotřebuje starý temp config, čistý checkout ani baseline build. Ověří Wrangler 4.150.0, přesný účet/Worker/verzi, 100 %, dostupnost verze, OFF/OFF, TTL 86400, local auth 0. Žádný login/install fallback. `/api/session` v běžném browseru musí mít 200 a `isDeveloper:true`; zaznamenat jen status/boolean. Z chráněných version metadata ověřit identitu D1/bindings/Access/ASSETS a **pouze jména** provider secrets `OPENAI_API_KEY`, `APU_VECTOR_STORE_ID`; hodnoty nikdy nečíst. Změna baseline = STOP a nové review, ne automatický rollback cizího deploymentu.
2. **BLOCKED_ACTIVATION_METHOD:** chybí předem reviewovaný vykonatelný postup, který nad **touto přesnou aktivní verzí** dočasně nastaví telemetry vars, dvě nové telemetry keys a tester roli a zachová celý zbytek runtime. Strict DEV preparer ponechat; vždy nastavuje operator developer identity a není samostatným nástrojem změny role na tester. `wrangler deploy --keep-vars` s neúplným configem nezaručuje zachování bindings; `secret put` může ihned deployovat. Instalovaný `versions secret bulk` patchuje `/versions/latest`, ne doloženou aktivní baseline, a není náhradou plain-text config contractu. **Nepoužít** nový upload aplikace, `keep_vars:false`, převod plain vars na secrets, ruční rekonstrukci baseline, úpravu Access či improvizovaný HTTP patch. Historický T3 PASS není vykonatelný aktivační skript. Luna zde skončí, dokud samostatný review nepředá přesný preserving activation/secret-removal/rollback postup. Nejde o doložený aplikační defekt; aplikaci v této dávce neopravovat.
3. **BLOCKED_PROVIDER_EVIDENCE:** musí existovat autorizované nezávislé provider request metadata umožňující napojení `X-Client-Request-Id` (= call_id), model/status, původní usage včetně chybějících polí a počet file_search calls. Tester API odpovědi záměrně nemají `model_usage_records`/diagnostics; browser Network proto prokáže tři API požadavky, nikoli nezávislý počet všech provider calls. Pouhý ledger porovnaný sám se sebou ani účetní denní agregace nestačí. V této dávce nebyla dostupnost takového povrchu doložena. Žádné nové externí onboarding, provider credential inspection ani rozšíření logování promptů. Bez zdroje STOP před spendingem; případná potřeba aplikačního rozšíření = samostatný Repair, ne tento PR.
4. **Samostatná explicitní autorizace** musí pokrýt §3 a přesnou dočasnou konfiguraci, privacy/notice, chráněný snapshot, D1 čtení a přesně scoped deletion, obnovu role a runtime, případné běžné UI přijetí pravidel. Zvlášť přijmout absenci hard financial cap. Nynější zadání neopravňuje tyto hosted akce. Není-li prokazatelný bezpečný rollback i úklid dočasných keys bez změny provider secrets, STOP.

## 5. Offline příprava — žádný deployment config

Operátor načte tento runbook a helper **z přesného reviewovaného T5 commitu v completion reportu/Draft PR**, nikoli pohyblivého branche. Lokální HEAD a čistota runtime checkoutu nejsou podmínkou. Helper má pouze built-in Node moduly, žádný subprocess, síťový kód ani načítání credentials. Použít existující Node 22.23.2 nebo podporované novější Node; zde ověřeno Node 24.19.0 na Linuxu. Windows/PowerShell a Node 22 runtime této přípravy **NOT VERIFIED**.

V existujícím checkoutu nainstalované závislosti neměnit. `$Repo` je jen absolutní repo root pro ochranu evidence a vyhledání existujícího Wrangleru; `$Helper` je stažený reviewovaný `scripts/telemetry/t5-evidence.mjs` mimo repo. `$Evidence` je **nový již existující chráněný lokální adresář mimo repo**. Cesty vybere člověk, agent je neodhaduje. Zkontrolovat Windows ACL, žádné široké Users/Everyone/cloud-sync sdílení. Bez ověřené ochrany STOP; POSIX 0600 nenahrazuje Windows ACL. Transcript a záznam plného terminálu při práci s privátními soubory vypnout podle existujících operátorských pravidel, nikoli měnit bezpečnostní politiku stroje.

```powershell
$Repo = (git rev-parse --show-toplevel | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or !$Repo) { throw 'BLOCKED_REPOSITORY' }
$Helper = Read-Host 'Absolutni cesta k helperu z reviewovaneho T5 commitu'
$Evidence = Read-Host 'Absolutni cesta k existujicimu chranenemu T5 adresari mimo repo'
node $Helper prepare $Evidence $Repo
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_LOCAL_PREPARATION' }
$PlanPath = Join-Path $Evidence 't5-overlay-proposal.json'
$Plan = Get-Content -LiteralPath $PlanPath -Raw | ConvertFrom-Json
$Cohort = $Plan.cohort
# Plan/secrets nevypisovat. Soubor neni Wrangler config a nesmi se predat --config.
```

Helper vytváří výhradně nové soubory, nic nepřepisuje. Cohort `t5_YYYYMMDD_<8hex>`, dvě různé nové 32byte telemetry keys; enrollment = base64url HMAC-SHA256 **UTF-8 string key**, zpráva `cohort + NUL + normalized-email`, přesně DEV `participantId()` (nikoli PUBLIC domain). Do browseru se pseudonym neposílá. Návrh obsahuje `synthetic=0`, privacy-approved návrh `1` **až po samostatném schválení**, metadata `0`, novou notice/key version `t5-v1`, jediný eligible pseudonym a prázdný `APU_DEVELOPER_EMAILS` pro dočasnou tester roli jediného účtu. Notice text je návrh, ne právní schválení. TTL, Access, provider secrets ani resource ID návrh neobsahuje. HMAC keys/pseudonym/opaque context nesmí do Git či veřejné evidence.

Pokud není uzavřen §4, zde **STOP**. Návrh není návod obejít BLOCKED_ACTIVATION_METHOD. Žádné čtení `.dev.vars`, provider klíčů, kopírování secret hodnot, instalace ani publikace tohoto JSON.

## 6. Podmíněný hosted checklist — až po uzavření gates a autorizaci

1. Znovu preflight §4. Použít existující G1 restricted resource identity; čerstvý read-only D1 inventory/info potvrdí právě jednu očekávanou DB, shodné UUID, účet a `jurisdiction=eu`. Neuvádět UUID veřejně. Čerstvý migration-only config může vytvořit stávající `ops/dev/prepare-telemetry-migration.mjs --prepare --identity <protected-identity> --config <fresh-absolute-json>`; ověřit jeho source z d706 a cílovou identitu. Žádné migrations list/apply — i list může inicializovat bookkeeping. Config není Worker deployment config. Pokud schválený preparer/identity není dostupný, BLOCKED_D1_TARGET, žádný vlastní náhradní config.
2. Před aktivací read-only počty všech tří tabulek musí být **0/0/0**; následně chráněný export těchto tří tabulek jako pre-test SQL snapshot. Pouze config z bodu 1. Jiné rows či souběžné telemetry okno = STOP, ne smazání cizích dat. Export celých tří tabulek je povolen pouze při prokázaném jediném T5 scope.
3. Vykonat **jen nově dodaný reviewovaný preserving postup §4**, nikoli tento JSON jako deploy config. Read-back musí potvrdit zachované Access/ASSETS/KV/D1/provider secret **names**, metadata 0, TTL 86400, local auth 0, přesný cohort/enrollment, tester role `/api/session` 200 `isDeveloper:false`. Aktivní verzi a její přesný diff chráněně zaznamenat. Nic nerozšiřovat na další účty. Není-li splněno, žádná AI akce.
4. Jediný běžný browser panel na přesném DEV originu, účet stejný. Platný existující receipt pouze použít. Je-li expirovaný/null, jednou výslovně přijmout aktuální rules/information v běžném UI; při nejasném výsledku STOP, žádný druhý POST. Receipt **nikdy nemaž/seeduj** a neopakuj T4 reload test. Zkontrolovat platnost pro celý krátký průchod.
5. Před opt-in ověřit nový prázdný projekt. Pokud by „Nový projekt“ smazal jinou práci, BLOCKED_BROWSER_STATE — bez čištění storage nebo resetu cizí práce. V novém projektu přidat výhradně dvě položky §2 přes „Přidat položku“ příslušných kategorií, bez odesílání do chatu. Network: **žádný AI POST**. Jednou kliknout **„Zapojit měření pro tuto návštěvu“**; `/api/telemetry/context` musí být ready, `metadata_enabled:false`. Zaznamenat jen session_id/tab_id do restricted evidence, nikoli opaque context; přesně jedna tester session, žádná AI row před odesláním. Připravit omezené SQL pending pozorování ještě před odesláním.
6. Jednou napsat/odeslat přesnou zprávu §2. Žádný dvojklik, druhý panel, refresh, reset, upřesnění potřeby, retry, změna modelu, Výstup ani další AI tlačítko. Z Network zaznamenat pouze časy/metody/cesty/statusy a skutečný počet tří browser AI POSTů. Nekopírovat HAR, request headers/body, odpovědi ani JWT. Změna účtu/428/403/clarification/conflict/error = neúspěšný pokus; nespouštět znovu. Přijaté F2 hypotézy a dokončený Rozbor musí být viditelné; lidsky potvrdit `ui_accepted`, neukládat jejich obsah do telemetry JSON.
7. Po dobu requestu ručně provést nejvýše **tři** připravená `observe` SQL čtení (bez AI retry). Zapsat skutečně pozorovaná pending call IDs a pak final stejného call ID. Rychlé nepozorované pending nesmí být vydáváno za pozorované; helper požaduje pending evidence všech calls, jinak **BLOCKED_PENDING_NOT_OBSERVED**, nikoli falešný plný PASS. Lokální upsert regresní test je samostatný důkaz kontraktu, nikoli hosted časová stopa.
8. Provider počty/usage porovnat z nezávislého povrchu §4. Posbírat jen allowlisted strukturu §7, ne provider prompt/output ani credential data. V UI počkat na dokončení všech souvisejících API akcí; poté nejvýše tři ruční `final` read-backy, mezi nimi 15 sekund. Žádná čekací smyčka. Vyžadovat nulové pending, 3–5 unikátních final calls, tři requested a tři accepted operation_resolved events a dvě stejné po sobě jdoucí souhrnné kontroly calls/counts; plné projekce se ověří offline ze snapshotu. Neodvozovat dokončení `waitUntil` pouze z HTTP 200. **Nevypínat sběr, nerollbackovat ani nemačkat Zastavit měření před doloženým finálním AI zápisem.**
9. Při unresolved pending po limitu **BLOCKED_PENDING_DRAIN**: žádná další AI, žádné deletion/activation toggles ani automatické recovery; operátor předá incident člověku. Nesmí tvrdit, že výchozí runtime je obnoven. Chybějící final zápis při úspěšném UI je telemetry FAIL, ne API PASS. Když jsou zápisy ukončené, jednou UI **„Zastavit měření“**, ověřit stop context odpověď a `stopped_at`. Žádný re-opt-in.
10. Ihned vytvořit chráněný finální SQL snapshot, offline SQLite, sidecar a hashes §7 **před cleanupem**. Také při neúspěšné akceptaci uchovat dostupnou evidence, nesmazat ji kvůli zelenému výsledku. Pokud export/import/protection selže, žádný cleanup; eskalovat. Obnova runtime musí proběhnout schváleným preserving rollback postupem nezávisle na tom, zda telemetry akceptace uspěla.

### Přesná příprava D1 read configu pro §6.1

Tento blok je až pro autorizovaného operátora. Nevyžaduje čistý checkout ani změnu HEAD; kontroluje jen tři skutečně vykonávané závislosti existujícího prepareru proti aplikačnímu source. Liší-li se, STOP, nikoli checkout/reset nebo stažení náhradní aplikace. Restricted identity je původní G1 evidence se čtyřmi poli accountId/databaseId/databaseName/jurisdiction, ne hodnota odhadnutá z inventory. Již existující starý config se nepoužije.

```powershell
git -C $Repo diff --quiet d706a55c7ff80b1439079badfda88c9baa5807c4 -- ops/dev/prepare-telemetry-migration.mjs ops/dev/prepare-worker.mjs telemetry/migrations/0001_pilot_v1.sql
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_REVIEWED_D1_TOOL_UNAVAILABLE' }
$Identity = Read-Host 'Absolutni cesta k puvodni restricted G1 identity evidence'
$DbConfig = Join-Path $Evidence 't5-d1-read.json'
node (Join-Path $Repo 'ops/dev/prepare-telemetry-migration.mjs') --prepare --identity $Identity --config $DbConfig
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_D1_TARGET' }
# Jen overeni uctu/inventory/info, nikoli migracni prikazy:
$Wrangler = Join-Path $Repo 'node_modules\.bin\wrangler.cmd'
& $Wrangler whoami --config $DbConfig
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_ACCOUNT' }
& $Wrangler d1 list --config $DbConfig --json
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_D1_INVENTORY' }
& $Wrangler d1 info apu-ms-site-dev-telemetry --config $DbConfig --json
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_D1_INFO' }
```

Výstup jen do chráněné operátorské evidence, ne ChatGPT/Git/veřejný log. Zkontrolovat účet shodný s identity/configem, právě jednu shodu jména **nebo** UUID a obě hodnoty téže DB, jurisdiction výslovně eu. UUID/účet/jurisdiction nečitelné či rozdílné = STOP před SQL/exportem. Seznam resources nepovažovat za povolení měnit ostatní DB. Automatické opravy, provisioning a migrations zůstávají zakázané.

## 7. Pevné SQL a chráněná evidence

Následující příkazy jsou **budoucí autorizované D1 čtení/export**, nyní se nevykonávají. `$DbConfig` = nový validovaný migration-only config z §6.1, `$Wrangler` = existující `node_modules\.bin\wrangler.cmd` 4.150.0, `$Session` = jediný skutečný session UUID z §6.5. Žádné SQL sestavování operátorem. Všechny CLI výstupy s technickými identifikátory pouze do chráněného adresáře. Zakázán broad KV/receipt cleanup.

```powershell
$Wrangler = Join-Path $Repo 'node_modules\.bin\wrangler.cmd'
$Session = Read-Host 'Jediny skutecny T5 session UUID'
$DbConfig = Read-Host 'Absolutni cesta k novemu validovanemu D1-only configu'
$Observe = node $Helper sql $Cohort $Session observe | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_SQL_SCOPE' }
$Final = node $Helper sql $Cohort $Session final | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_SQL_SCOPE' }
& $Wrangler d1 execute apu-ms-site-dev-telemetry --remote --config $DbConfig --command $Observe --json
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_D1_OBSERVE' }
# Volat Final pouze v bodech 6.8/6.9, ne smyckou:
& $Wrangler d1 execute apu-ms-site-dev-telemetry --remote --config $DbConfig --command $Final --json
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_D1_FINAL' }
```

`before` SQL je v souboru `t5-before.sql` vytvořeném helperem; v §6.2 jej předat stejnému `d1 execute` přes `--file`, výsledek pouze 0/0/0. Pro pre-test export použít stejný následující export příkaz s **jinou novou** cestou `t5-before.sql-export`; neimportuje se jako finální tester snapshot (je prázdný). Pro všechny nové výstupy předem `Test-Path` a STOP při existenci; nikoli overwrite.

```powershell
$Sql = Join-Path $Evidence 't5-final.sql'
$Snapshot = Join-Path $Evidence 'telemetry-t5.sqlite'
if ((Test-Path -LiteralPath $Sql) -or (Test-Path -LiteralPath $Snapshot)) { throw 'BLOCKED_EVIDENCE_EXISTS' }
& $Wrangler d1 export apu-ms-site-dev-telemetry --remote --config $DbConfig --table telemetry_sessions --table telemetry_events --table telemetry_ai_calls --output $Sql
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_SNAPSHOT_EXPORT' }
node $Helper snapshot $Sql $Snapshot $Cohort $Session $Repo
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_SNAPSHOT_IMPORT' }
```

SQL pochází výhradně z právě autorizovaného Wrangler exportu; nezaměňovat/importovat cizí SQL. Helper odmítá přepsání, cesty v repo/symlinky, jiné tabulky/scope a chyby integrity/FK. Hashuje zdrojový SQL a uzavřený SQLite, přidává existující striktní pětifieldový `.target.json` s `mode=operator-snapshot`, `test_class=tester`, jediným cohort. Originální SQL/SQLite/sidecars dále neměnit; chráněná kopie je evidence, ne veřejná příloha PR. Při chybě zachovat částečný soubor jako neověřený, nepřepisovat jej.

V chráněném `t5-provider-evidence.json` ručně přepsat **jen z nezávislé provider evidence** následující strukturu (3–5 calls); žádné odhady, kopie samotné DB jako „provider důkaz“, odpověď nebo prompt. `call_id` koreluje X-Client-Request-Id; nikoli provider response ID. `usage` zachová původní přítomnost/null/0 a pouze číselná pole uvedená níže; absent details lze vynechat, nevymýšlet nuly. Pole `operation` je korelační označení podle route/ledgeru, nikoli původní provider pole; nezávisle se ověřují call IDs, úplný počet, model, status, usage a tools. Model může mít skutečný datovaný suffix. `file_search_calls` zahrnuje všechny tool calls daného response. Nezávislá evidence musí pokrýt **všechny** requesty testu v okně, nikoli jen vybrané známé IDs, jinak nepodloží jejich celkový počet.

```json
{"provider_basis":"independent-provider-request-metadata","ui_accepted":true,"browser_paths":["/api/extract","/api/need-route","/api/analysis"],"pending_call_ids":["<observed UUIDs>"],"calls":[{"call_id":"<client request UUID>","operation":"extraction","model":"gpt-5.6-luna","provider_status":"completed","usage":{"input_tokens":100,"output_tokens":10,"total_tokens":110},"file_search_calls":0}]}
```

Hodnoty 100/10/110 jsou **pouze popis formátu**, nikdy testovací evidence. Volitelné původní details: `input_tokens_details.cached_tokens`, `.cache_write_tokens`, `output_tokens_details.reasoning_tokens`. Další calls podle tabulky §2; rescue sdílí extraction ticket, má attempt 1 a fallback reference na primary. Všechny další části provider response vynechat.

```powershell
$ProviderEvidence = Join-Path $Evidence 't5-provider-evidence.json'
node $Helper verify $Snapshot $Cohort $Session $ProviderEvidence $Repo
if ($LASTEXITCODE -ne 0) { throw 'FAIL_OR_BLOCKED_TELEMETRY_EVIDENCE' }
```

Kontrola čte všechny tři relevantní JSON struktury **`identity_json`, `projection_json`, `event_json`**, jejich vnořené usage/pricing/owner/payload allowlisty a zakázané klíče/hodnoty. Vyžaduje jeden tester/session/cohort, stejný workflow, request/operation ownership, finální completed/accepted/provider_reported, observed coverage, zachované null tokeny, korektní součty/podmnožiny a jediné účtování call ID, ceny dle snapshotu v nanoUSD a file_search. Žádné prompty, odpovědi, e-mail, JWT, credentials, provider raw IDs ani pedagogický obsah. Neznámé pole = FAIL, ne automatická redakce. Porovná všechny původní provider usage hodnoty; snapshot ceny **není invoice**.

Po skutečném uzavření Europe/Prague dne lze na **lokální pracovní kopii** snapshotu použít existující `scripts/telemetry/report.ts export --database <absolute telemetry-*.sqlite> --mode operator-snapshot --cohort <exact> --test-class tester --operator yes --view summary --linkage unavailable --from <actual Prague test date> --to <next Prague date> --retained-since <actual retained UTC timestamp> --as-of <actual current UTC timestamp> --out <fresh absolute telemetry-*.csv>`. Toto je argumentový kontrakt, **nikoli povolení agentovi vyplňovat data**: při handoffu po uzavření dne musí člověk dodat skutečná data a reviewovaný lokální report tool z d706 (bez změny runtime checkoutu); jinak BLOCKED_CSV_HANDOFF. Není nutné držet hosted sběr aktivní do půlnoci. Žádné budoucí `as-of`, obcházení guards, prázdný cizí den ani blokující smyčka. SQL akceptace ihned a pozdější CSV/reconciliation mají oddělený stav; hlavičky, hodnoty, formula guards a sedmidenní export expiry se kontrolují existujícími B3 pravidly. Snapshot zachovat do této kontroly; retenční termín a konečné smazání chráněných kopií musí být zvlášť schváleny.

## 8. Scoped cleanup a obnova — také vyžaduje uzavřený gate §4

Pouze po chráněném snapshotu/hash kontrole, ukončené session a nulových pending. Před cleanupem zaznamenat přesné očekávané counts a potvrdit, že se nemění. Helper generuje jen **cohort + tester + přesný session UUID**, child-before-parent, stopped/pending guards, bez DDL či jiných tabulek. Není to atomický vzdálený transaction lock; bezpečnost předpokládá ukončenou návštěvu, žádný souběžný test a disabled nové enrollment/sběr podle reviewovaného postupu. Bez těchto předpokladů STOP. Nemaž receipt, nečti/neměň `PILOT_RULES_ACCEPTANCE` KV.

```powershell
# POUZE po samostatnem schvaleni cleanupu a obnove OFF/OFF dle preserving postupu:
$Cleanup = node $Helper sql $Cohort $Session cleanup | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_CLEANUP_SCOPE' }
& $Wrangler d1 execute apu-ms-site-dev-telemetry --remote --config $DbConfig --command $Cleanup --json
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_CLEANUP_READBACK_REQUIRED' }
& $Wrangler d1 execute apu-ms-site-dev-telemetry --remote --config $DbConfig --file (Join-Path $Evidence 't5-before.sql') --json
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_CLEANUP_READBACK' }
# Pozadovany vysledek vsech tri tabulek: 0/0/0. Bez automatickeho opakovani DELETE.
```

Obnova má vrátit **přímo existující přesnou verzi `732bf950-30cf-444a-90fc-8927d9c8b16c`**, nikoli build baseline nebo „latest“. Dostupnost read-only metadata nestačí jako nový aktivační/secret lifecycle postup: přesný vykonatelný restore + odstranění dvou dočasných telemetry keys musí dodat stejný samostatný review §4. T3 doložil přímý rollback, ne bezpečnost libovolného nového secret/config kroku. Žádné automatické `secret delete/put` (mohou měnit deployment), žádné smazání provider secrets. Při selhání rollbacku/secret odstranění STOP incident, žádná rekonstrukce nebo druhý deployment; evidence PARTIAL/BLOCKED.

Konečný povinný read-back: stejná baseline verze 100 %, collection/metadata **0/0**, TTL86400, local auth0, původní developer config, provider secret names a všechna původní bindings/Access zachované; `/api/session` HTTP200 **isDeveloper:true** pro tentýž účet; žádný aktivní T5 context/session, žádné T5 D1 rows, enrollment shodný s baseline a neaktivní T5 enrollment, dočasné telemetry keys odstraněné. Nevytvářet test novou opt-in session k ověření vypnutí. Ponechat receipt a uživatelskou Access session. Chráněný snapshot neničit zároveň s D1 cleanupem.

## 9. Akceptace a evidence přípravy

| Stav | Kritérium |
| --- | --- |
| PREPARATION SOURCE PASS | Lokální syntetické testy/helpers a source graph prověřené; žádná hosted akce. Neznamená průchod gates §4. |
| T5 PROVIDER+SQL PASS | Samostatně autorizované okno, přesný UI graf, přijatý Rozbor, nezávislá shoda všech calls/usage, pozorované pending→final, žádné dvojí účtování, správná session/workflow/operation, pricing/coverage/privacy PASS, snapshot před cleanupem, doložená obnova baseline. CSV stav uvést zvlášť. |
| FAIL | Nesoulad skutečně pozorovaného kontraktu, počtu/usage/ownership/cost/privacy nebo nepřijatý UI výsledek; žádný retry. HTTP200 samo není PASS. |
| BLOCKED / PARTIAL | Chybí autorizace/bezpečný preserving postup, metadata zdroj, pending observation, ochrana evidence, Windows capability nebo restore důkaz. Neoznačovat chybějící důkaz jako úspěch. Při pending neprovádět předčasný cleanup/off. |

Lokální výsledky a přesný finální commit jsou v Draft PR/completion reportu; příkazy pro reprodukci v reviewovaném T5 checkoutu: `node tests/t5-handoff.test.mjs`, `node tests/usage-ledger.test.mjs`, `node tests/model-call-instrumentation.test.mjs`, `node tests/telemetry-b2.test.mjs`, `node tests/telemetry-local-tools.test.mjs`, `node tests/dialog-action.test.mjs`, `npm run typecheck`, `node_modules/.bin/eslint scripts/telemetry/t5-evidence.mjs tests/t5-handoff.test.mjs`, `git diff --check`. Syntetické fixtures, žádné provider credentials/network. Nativní Windows/PowerShell a hosted test **NOT VERIFIED**. Žádný aplikační source/config/migration diff, žádný provider request, resource/secret/hosted mutation, merge, PUBLIC zásah ani nové B4/B5 rozšíření. Tento handoff neuzavírá provider E2E ani PUBLIC readiness.

### Lokální verifikace přípravy — 2026-10-29

Ověřený základ `019f3caf1150e5c00f5577464c67e021b61fea42`; GitHub read-back PR #88 a #89 potvrdil uvedené head SHA, obě draft/open/unmerged. Aplikační/config/migration stromy jsou totožné s d706. Nový diff obsahuje pouze tento dokument, offline helper a jeho testy.

```sh
node --test --test-concurrency=1 tests/t5-handoff.test.mjs tests/usage-ledger.test.mjs tests/model-call-instrumentation.test.mjs tests/telemetry-b2.test.mjs tests/telemetry-local-tools.test.mjs tests/dialog-action.test.mjs tests/pilot-telemetry-transport.test.mjs tests/project-usage-isolation.test.mjs
npm run typecheck
node_modules/.bin/eslint scripts/telemetry/t5-evidence.mjs tests/t5-handoff.test.mjs
node --check scripts/telemetry/t5-evidence.mjs
node --check tests/t5-handoff.test.mjs
git diff --check
```

Výsledky: provider-free regrese **201/201 PASS**, z toho **25 nových T5 kontrol**; typecheck, focused lint, syntax a diff/scope kontrola **PASS**. Testy vykonaly i skutečný Node CLI, SQLite import/sidecar/hash a původní CSV CLI. Zpočátku Cloud sandbox blokoval Node child processes (`EPERM`); sada byla znovu vykonána s povolením lokálních podprocesů, žádné testy nebyly vynechány. Žádné provider/Cloudflare operace. Build/Worker artifact nebyl znovu generován: aplikační/runtime/config source není měněn. **Native Windows/PowerShell, Node 22 runtime, browser hosted flow a provider usage surface NOT VERIFIED.** Přípravné source PASS neodstraňuje dva blockery §4 ani neuděluje hosted autorizaci.
