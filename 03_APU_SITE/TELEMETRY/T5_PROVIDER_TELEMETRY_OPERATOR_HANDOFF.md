# APU T5 — jeden Rozbor, provider a telemetry ledger

**Příprava, nikoli hosted PASS ani autorizace.** VS agent: Luna Low, bez delegování, dalších promptů a náhradních postupů. Aktuálně **BLOCKED před aktivací a provider voláním**: instalovaný CLI neumí potřebný preserving plain-text patch z přesné verze a současná aplikace neposkytuje nezávislý provider trace (§4). Tento dokument nesmí být vykonán celý jako shell skript. Části označené „po autorizaci“ jsou návrh samostatného operátorského zadání; nyní pouze offline příprava.

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
2. **BLOCKED_ACTIVATION_METHOD:** konkrétně chybí v instalovaném Wrangleru 4.150.0 operace „copy/patch přesné baseline verze, změnit plain-text vars a dvě telemetry secrets, ostatní code/assets/bindings/secrets zdědit beze změny“. Není to tvrzení, že takovou operaci neumí celá Cloudflare platforma. Důkaz a oddělený restore jsou níže. Žádný upload z lokálního checkoutu, `keep_vars:false`, plain vars jako secrets nebo ruční rekonstrukce konfigurace.
3. **BLOCKED_PROVIDER_TRACE_REPAIR:** žádný doložený současný povrch nevrací potřebné jednotlivé provider calls/usage nezávisle na telemetry ledgeru. Níže je přesný rozbor a minimální samostatný návrh Repairu, **nyní neimplementovaný**. Dashboardová pole se nepředpokládají.
4. **Autorizace a closure gate:** před aktivací schválit §3, privacy/notice, přesný preserving postup a odstranění dočasných keys, absenci hard financial cap, snapshot a scoped cleanup. Restore musí být připravený **před** aktivací, s výhradním operátorským oknem a konkrétním očekávaným T5 version ID; žádný souběžný writer. Chybí-li přístup k přesné baseline nebo ověřitelná bounded obnova, **BLOCKED_WINDOW_CLOSURE — neaktivovat**. Toto zadání nedává hosted autorizaci.

### 4.1 Offline důkaz schopností a omezení Wrangleru

Zkoumán pouze instalovaný `node_modules/wrangler/wrangler-dist/cli.js`, verze **4.150.0**, SHA256 **`71da1f9bcf69a9f56c4ff4f68e71315365d03db8ea11207577b47a8e1a0a1064`**. Regrese vykonává vyjmuté skutečné funkce s in-memory `fetchResult` double, který pouze zaznamená argumenty; žádná CF autentizace nebo síť. Při jiné verzi/hash STOP, neopakovat výzkum na hosted účtu.

| Operace / source | Doložené chování | Důsledek |
| --- | --- | --- |
| `patchLatestWorkerVersionWithSecrets`, ř. 360662–360703 | PATCH `/workers/workers/<worker>/versions/latest`; každý nenulový klíč převádí na `type:secret_text`. | Nevybírá přesnou baseline, neumí plain vars. Bulk args file/name/message/tag nemají base-version selector. |
| `versions upload` / strict DEV preparer | Upload lokálního artefaktu/configu; preparer nastavuje developer identitu. | Není preserving změna hosted verze a není povolenou náhradou. `--keep-vars` není důkaz zachování ostatních bindings. |
| `createDeployment`, ř. 168171–168190; `handleRollback`, ř. 360561–360648 | Explicitní `version-id` → POST deployments, `{strategy:percentage,versions:[{version_id,percentage:100}]}`. Bez modulů/binding rekonstrukce. | Přesná obnova existující baseline je doložitelná; rollback **nepřepíná „latest uploaded“**. „Rollback a pak secret bulk“ tedy problém neřeší. |
| Rollback error `10220` | CLI umí potvrdit změněné secrets a znovu POSTnout s `force=true`. `--yes` přijímá i toto potvrzení. | Nikdy nepoužít jako obecný force workaround. Budoucí review musí prokázat pouze dvě schválené T5 key změny, žádnou změnu provider secrets; při cizí změně STOP. |

[Oficiální CLI dokumentace](https://developers.cloudflare.com/workers/wrangler/commands/workers/) rozlišuje upload, secret změny a rollback. [Settings PATCH](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/script_and_version_settings/methods/edit/) pracuje se script settings; nedokládá požadovaný CLI baseline selector. [Beta Versions Create](https://developers.cloudflare.com/api/resources/workers/subresources/beta/subresources/workers/subresources/versions/methods/create/) dokumentuje explicitní inheritance jednotlivých bindings, ale není zde implementován/reviewován adaptér pro úplné převzetí code/assets/configu. **Závěr: konkrétní chybějící CLI schopnost doložena; aktivace BLOCKED.** Nejmenší další operátorská dávka: reviewovaný version-copy/patch adaptér s immutable baseline, automatickým zachováním a diff allowlistem, nikoli ruční přepis konfigurace. Nyní žádný takový adaptér nevytváříme.

### 4.2 Provider evidence — skutečné povrchy a samostatný Repair návrh

Veřejná dokumentace, nikoli přístup do provider účtu:

| Povrch | Skutečně doložená data | Proč nestačí nyní |
| --- | --- | --- |
| [Responses HTTP response](https://developers.openai.com/api/reference/resources/responses/methods/create) | `model`, `status`, `service_tier`, nullable `usage` s input/output/total a cached/cache-write/reasoning details; `output` obsahuje i file_search_call items. | Existují na serverové transportní hranici; testerovi se debug ledger neposílá a samostatný sanitizovaný trace nevzniká. |
| [Usage API completions](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/completions) | Časové buckety, `num_model_requests`, input/output/cached/cache-write agregace, volitelné model/project/key/tier grouping. | Ne per-call call_id/status/tool events ani request→session vazba. Admin-key přístup není doložen a nové credentials nejsou povolené. |
| [Dashboard logs / GET Responses](https://developers.openai.com/api/docs/guides/conversation-state) | Dokumentovaná persistence uložených Responses. | `store:false` ji vypíná. Neukládat responses ani neměnit store flag kvůli T5. Žádný slib dostupných dashboardových polí. |
| [X-Client-Request-Id](https://developers.openai.com/api/reference/overview#debugging-requests) | Provider interně loguje dodaný identifikátor; podpora umí dohledat přijetí a čas. | Není dokumentovaný samoobslužný per-call usage export. Žádný support onboarding ani provider ticket v této dávce. |
| Browser Network / developer model_usage_records | API paths/status; developer ledger pochází ze stejného normalizátoru jako D1 projekce. | Tři browser requesty nejsou počet fyzických provider calls. Ledger sám není nezávislý důkaz. |

**Samostatný návrh `T5-PROVIDER-TRACE-REPAIR` (neimplementovat zde):**

1. V `app/openai-responses-instrumentation.ts` u jediného skutečného `fetch` emitovat oddělený allowlisted `response-boundary-trace-v1`: `stage=invoke|response|transport_error`, call UUID z odchozího `X-Client-Request-Id`, UTC čas, operation/attempt, HTTP status, reported model/status/tier, pouze původní číselná usage pole (přítomnost/null/0 zachovat), počet `output[].type=file_search_call`. Bez reuse kanonického ModelUsageRecord/pricing/projekce; body odpovědi se nikdy neloguje. Počet invoke je počet transportních pokusů; provider HTTP response dokládá přijetí. Transport timeout neprokazuje nepřijetí ani nulovou útratu.
2. Pouze explicitně schválené dočasné DEV/tester/cohort/opt-in okno s novým default-OFF diagnostic gate. Žádné nové provider call/retry, store změna, frontend debug exposure ani další persistence. Selhání evidence fail-open pro business, ale T5 evidence NOT VERIFIED.
3. Dostupný navržený transport je existující **Wrangler tail**, nikoli hypotetický dashboard. Před testem spustit omezený capture; sampler/stream není garantovaný bezeztrátový audit. Povinný inline sanitizer propustí **jen** prefixed trace zprávu se striktním numeric/enum/UUID allowlistem. Veškeré Tail request/event metadata, headers, cookies, author/email, provider IDs, prompt/answer a credentials zahodí ještě před uložením/výpisem; nikdy full raw Tail JSON/HAR. Sanitizer a bounded capture budou součástí samostatného Repair review, zde chybí. Chybějící invoke/response/pár nebo přerušený stream = PARTIAL, žádný odhad.
4. Join pouze `trace.call_id = telemetry_ai_calls.call_id`; 3–5 úplných invoke/response párů, každý jednou, stejná usage/model/tool count v raw trace a projekci. Session/workflow/operation ověřit odděleně z D1; provider sám tyto aplikační IDs nevrací. Evidence je **nezávislá na ledgerové projekci**, nikoli nezávislý účetní audit či invoice poskytovatele. Není-li tato úroveň nezávislosti přijatelná, gate zůstává BLOCKED pro samostatné rozhodnutí.
5. Pro deterministický hosted pending→final důkaz lze ve stejném odděleném Repairu přidat dva minimální **write-ack** trace body po skutečně úspěšném pending/final D1 upsertu v `app/telemetry/d1-store.ts`, pouze call_id/state/time. Ne před zápisem a ne z callbacku bez výsledku `.run()`. Ztracený ack není storage FAIL ani pozorovaný lifecycle. Nezávislost provider trace to nenahrazuje. Současný helper přijímá jen skutečná SQL pozorování; případný ack input contract bude reviewován s Repair.

Toto je minimální návrh nové diagnostiky, ne schválení implementace. Před přijetím: syntetické tests transport vs ledger (včetně záměrně chybné projekce), redaction všech vnořených JSON, disabled/no-enrollment bez logů, error/nulls/cancellation, ztracený stream, žádný další provider call, removal a rollback gate. **Současný source T5 není pro provider E2E připravený.**

## 5. Offline příprava — žádný deployment config

Operátor načte tento runbook a helper **z přesného reviewovaného T5 commitu v completion reportu/Draft PR**, nikoli pohyblivého branche. Lokální HEAD a čistota runtime checkoutu nejsou podmínkou. Režimy prepare/paths/sql/snapshot/verify/window/restore-plan pracují pouze offline, bez subprocessu nebo credentials. Jediný nový režim `execute-reviewed-restore` může po samostatné autorizaci spustit pinned Wrangler rollback; nyní se nespouští. Nemá implicitní aktivaci ani provider executor. `restore-plan` pouze vrací argv/timeout. Použít existující Node 22.23.2 nebo podporované novější Node; zde ověřeno Node 24.19.0 na Linuxu. Windows/PowerShell a Node 22 runtime této přípravy **NOT VERIFIED**.

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
$Paths = node $Helper paths $Evidence $Repo | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_ARTIFACT_PATHS' }
# Plan/secrets nevypisovat. Soubor neni Wrangler config a nesmi se predat --config.
```

Helper vytváří výhradně nové soubory, nic nepřepisuje. SQL dotazy mají názvy `t5-query-{before,observe,final,cleanup}.sql`; žádný `t5-export-*.sql` při prepare nevzniká. Navíc vytváří vlastní target-only `t5-restore-target.json` (name/account/send_metrics:false), bez vars/bindings/secrets; použije se pouze k explicitnímu restore, nikdy pro upload/deploy aplikace. Cohort `t5_YYYYMMDD_<8hex>`, dvě různé nové 32byte telemetry keys; enrollment = base64url HMAC-SHA256 **UTF-8 string key**, zpráva `cohort + NUL + normalized-email`, přesně DEV `participantId()` (nikoli PUBLIC domain). Do browseru se pseudonym neposílá. Návrh obsahuje `synthetic=0`, privacy-approved návrh `1` **až po samostatném schválení**, metadata `0`, novou notice/key version `t5-v1`, jediný eligible pseudonym a prázdný `APU_DEVELOPER_EMAILS` pro dočasnou tester roli jediného účtu. Notice text je návrh, ne právní schválení. TTL, Access, provider secrets ani resource ID návrh neobsahuje. HMAC keys/pseudonym/opaque context nesmí do Git či veřejné evidence.

Pokud není uzavřen §4, zde **STOP**. Návrh není návod obejít BLOCKED_ACTIVATION_METHOD. Žádné čtení `.dev.vars`, provider klíčů, kopírování secret hodnot, instalace ani publikace tohoto JSON.

## 6. Podmíněný hosted checklist — až po uzavření gates a autorizaci

1. Znovu preflight §4. Použít existující G1 restricted resource identity; čerstvý read-only D1 inventory/info potvrdí právě jednu očekávanou DB, shodné UUID, účet a `jurisdiction=eu`. Neuvádět UUID veřejně. Čerstvý migration-only config může vytvořit stávající `ops/dev/prepare-telemetry-migration.mjs --prepare --identity <protected-identity> --config <fresh-absolute-json>`; ověřit jeho source z d706 a cílovou identitu. Žádné migrations list/apply — i list může inicializovat bookkeeping. Config není Worker deployment config. Pokud schválený preparer/identity není dostupný, BLOCKED_D1_TARGET, žádný vlastní náhradní config.
2. Před aktivací read-only počty všech tří tabulek musí být **0/0/0**; následně chráněný export těchto tří tabulek jako pre-test SQL snapshot. Pouze config z bodu 1. Jiné rows či souběžné telemetry okno = STOP, ne smazání cizích dat. Export celých tří tabulek je povolen pouze při prokázaném jediném T5 scope.
3. **Před první aktivační mutací jednou** zaznamenat `$ActivatedAtMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()` a spustit `$WindowWatch = [Diagnostics.Stopwatch]::StartNew()`; později je nikdy neresetovat. Vykonat **jen nově dodaný reviewovaný preserving postup §4**, nikoli tento JSON jako deploy config. Read-back musí potvrdit zachované Access/ASSETS/KV/D1/provider secret **names**, metadata 0, TTL 86400, local auth 0, přesný cohort/enrollment, tester role `/api/session` 200 `isDeveloper:false`. Aktivní verzi a její přesný diff chráněně zaznamenat. Nic nerozšiřovat na další účty. Není-li splněno, žádná AI akce.
4. Jediný běžný browser panel na přesném DEV originu, účet stejný. Platný existující receipt pouze použít. Je-li expirovaný/null, jednou výslovně přijmout aktuální rules/information v běžném UI; při nejasném výsledku STOP, žádný druhý POST. Receipt **nikdy nemaž/seeduj** a neopakuj T4 reload test. Zkontrolovat platnost pro celý krátký průchod.
5. Před opt-in ověřit nový prázdný projekt. Pokud by „Nový projekt“ smazal jinou práci, BLOCKED_BROWSER_STATE — bez čištění storage nebo resetu cizí práce. V novém projektu přidat výhradně dvě položky §2 přes „Přidat položku“ příslušných kategorií, bez odesílání do chatu. Network: **žádný AI POST**. Jednou kliknout **„Zapojit měření pro tuto návštěvu“**; `/api/telemetry/context` musí být ready, `metadata_enabled:false`. Zaznamenat jen session_id/tab_id do restricted evidence, nikoli opaque context; přesně jedna tester session, žádná AI row před odesláním. Připravit omezené SQL pending pozorování ještě před odesláním.
6. Před jediným kliknutím Odeslat jednou zaznamenat `$SubmittedAtMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()`; pak jednou odeslat přesnou zprávu §2. Žádný dvojklik, druhý panel, refresh, reset, upřesnění potřeby, retry, změna modelu, Výstup ani další AI tlačítko. Z Network zaznamenat pouze časy/metody/cesty/statusy a skutečný počet tří browser AI POSTů. Nekopírovat HAR, request headers/body, odpovědi ani JWT. Změna účtu/428/403/clarification/conflict/error = neúspěšný pokus; nespouštět znovu. Přijaté F2 hypotézy a dokončený Rozbor musí být viditelné; lidsky potvrdit `ui_accepted`, neukládat jejich obsah do telemetry JSON.
7. Lifecycle a reconciliation jsou **dva různé důkazy**. Nejvýše tři ruční `observe` SQL čtení mohou zachytit jen některé pending rows; nejsou zárukou zachycení každého rychlého call. Zapsat jen skutečné `{call_id,state,observed_at,source:d1-sql}` v časovém pořadí. Žádné doplňování pending z finálního řádku, lokálního testu nebo předpokladu. Nezachycený call = hosted lifecycle **NOT VERIFIED**, nikoli storage FAIL. Lokální test skutečného provider lifecycle a PK upsertu je samostatné **SOURCE PASS**. Jediný pokus neopakovat kvůli chybějícím pending pozorováním.
8. Provider počty/usage porovnat z budoucího reviewovaného trace §4.2. Pro normální dokončení požadovat UI ready, všechny fyzické response páry, nulové pending, 3–5 unikátních final rows, 3 requested/3 accepted resolved events a dvě shodné souhrnné kontroly. Nejvýše tři ruční final read-backy s 15s rozestupem, **vždy uvnitř deadline §8.1**. HTTP200 není ukončený waitUntil. V normální úspěšné větvi nejprve finalizace, potom UI stop, snapshot, restore. Missing lifecycle observation nebrání finální reconciliation, ale plný T5 bude PARTIAL.
9. **Timeout, neúplná evidence, UI/provider chyba nebo deadline = větev §8.1, ne další čekání.** Už žádné AI ani re-opt-in. Pending se uchová, neodstraní a nevydává za nulu. V exceptional failure větvi je povolená a povinná bounded obnova OFF/OFF i s unresolved pending; tato výjimka se nikdy nevydává za finalization PASS. Chybějící finální zápis při úspěšném UI je telemetry problém, ne API acceptance.
10. Úspěch: po doložených finálních zápisech jednou UI „Zastavit měření“, read-back stopped_at, chráněný finální export/SQLite/hash **před cleanupem**, pak přesný restore §8. Failure: snapshot a restore v bounded větvi. Export/import failure nesmí blokovat vypnutí za deadline; zachovat vše dostupné, bez destruktivního cleanupu. Doložení finálního read-backu OFF/OFF a developer session je povinné pro closure PASS.

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

`before` SQL je v souboru `t5-query-before.sql` vytvořeném helperem; v §6.2 jej předat stejnému `d1 execute` přes `--file`, výsledek pouze 0/0/0. Pro pre-test export použít stejný následující export příkaz s **jinou novou** cestou `t5-export-before.sql`; neimportuje se jako finální tester snapshot (je prázdný). Pro všechny nové výstupy předem `Test-Path` a STOP při existenci; nikoli overwrite.

```powershell
$Sql = $Paths.exportFinal
$Snapshot = $Paths.snapshotFinal
if ((Test-Path -LiteralPath $Sql) -or (Test-Path -LiteralPath $Snapshot)) { throw 'BLOCKED_EVIDENCE_EXISTS' }
& $Wrangler d1 export apu-ms-site-dev-telemetry --remote --config $DbConfig --table telemetry_sessions --table telemetry_events --table telemetry_ai_calls --output $Sql
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_SNAPSHOT_EXPORT' }
node $Helper snapshot $Sql $Snapshot $Cohort $Session $Repo
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_SNAPSHOT_IMPORT' }
```

SQL pochází výhradně z právě autorizovaného Wrangler exportu; nezaměňovat/importovat cizí SQL. Helper odmítá přepsání, cesty v repo/symlinky, jiné tabulky/scope a chyby integrity/FK. Hashuje zdrojový SQL a uzavřený SQLite, přidává existující striktní pětifieldový `.target.json` s `mode=operator-snapshot`, `test_class=tester`, jediným cohort. Originální SQL/SQLite/sidecars dále neměnit; chráněná kopie je evidence, ne veřejná příloha PR. Při chybě zachovat částečný soubor jako neověřený, nepřepisovat jej.

V chráněném `t5-provider-evidence.json` naplnit **jen z reviewovaného response-boundary trace §4.2 po jeho samostatné implementaci** následující strukturu (3–5 calls); žádné odhady, kopie samotné DB jako „provider důkaz“, odpověď nebo prompt. `call_id` koreluje X-Client-Request-Id; nikoli provider response ID. `usage` zachová původní přítomnost/null/0 a pouze číselná pole uvedená níže; absent details lze vynechat, nevymýšlet nuly. Pole `operation` je korelační označení podle route/ledgeru, nikoli původní provider pole; nezávisle se ověřují call IDs, úplný počet, model, status, usage a tools. Model může mít skutečný datovaný suffix. `file_search_calls` zahrnuje všechny tool calls daného response. Nezávislá evidence musí pokrýt **všechny** requesty testu v okně, nikoli jen vybrané známé IDs, jinak nepodloží jejich celkový počet.

```json
{"provider_basis":"response-boundary-trace-v1","ui_accepted":true,"browser_paths":["/api/extract","/api/need-route","/api/analysis"],"lifecycle_observations":[{"call_id":"<observed UUID>","state":"pending","observed_at":0,"source":"d1-sql"},{"call_id":"<same UUID>","state":"final","observed_at":1,"source":"d1-sql"}],"calls":[{"call_id":"<client request UUID>","operation":"extraction","model":"gpt-5.6-luna","provider_status":"completed","usage":{"input_tokens":100,"output_tokens":10,"total_tokens":110},"file_search_calls":0}]}
```

Hodnoty 100/10/110 a časy 0/1 jsou **pouze popis formátu**, nikdy testovací evidence. `lifecycle_observations:[]` je legitimní nepřítomnost pozorování, nikoli důkaz pending zápisu. Volitelné původní details: `input_tokens_details.cached_tokens`, `.cache_write_tokens`, `output_tokens_details.reasoning_tokens`. Další calls podle tabulky §2; rescue sdílí extraction ticket, má attempt 1 a fallback reference na primary. Všechny další části provider response vynechat.

```powershell
$ProviderEvidence = Join-Path $Evidence 't5-provider-evidence.json'
node $Helper verify $Snapshot $Cohort $Session $ProviderEvidence $Repo
# exit 0 = reconciliation + vsechny SQL lifecycle pary dolozeny; 2 = reconciliation PASS, lifecycle NOT VERIFIED (PARTIAL); 1 = FAIL/BLOCKED.
if ($LASTEXITCODE -eq 2) { 'T5_PARTIAL_LIFECYCLE_NOT_VERIFIED' }
elseif ($LASTEXITCODE -ne 0) { throw 'FAIL_OR_BLOCKED_TELEMETRY_EVIDENCE' }
```

Kontrola čte všechny tři relevantní JSON struktury **`identity_json`, `projection_json`, `event_json`**, jejich vnořené usage/pricing/owner/payload allowlisty a zakázané klíče/hodnoty. Vyžaduje jeden tester/session/cohort, stejný workflow, request/operation ownership, finální completed/accepted/provider_reported, observed coverage, zachované null tokeny, korektní součty/podmnožiny a jediné účtování call ID, ceny dle snapshotu v nanoUSD a file_search. Žádné prompty, odpovědi, e-mail, JWT, credentials, provider raw IDs ani pedagogický obsah. Neznámé pole = FAIL, ne automatická redakce. Porovná všechny původní provider usage hodnoty; snapshot ceny **není invoice**. Výstup má oddělené `reconciliation` a `lifecycle` stavy: bez SQL pending→final párů všech calls vrátí `PARTIAL_LIFECYCLE_NOT_VERIFIED`, i když final reconciliation PASS. Samotný helper výstup nenahrazuje důkaz původu trace ani hosted restore read-back.

Po skutečném uzavření Europe/Prague dne lze na **lokální pracovní kopii** snapshotu použít existující `scripts/telemetry/report.ts export --database <absolute telemetry-*.sqlite> --mode operator-snapshot --cohort <exact> --test-class tester --operator yes --view summary --linkage unavailable --from <actual Prague test date> --to <next Prague date> --retained-since <actual retained UTC timestamp> --as-of <actual current UTC timestamp> --out <fresh absolute telemetry-*.csv>`. Toto je argumentový kontrakt, **nikoli povolení agentovi vyplňovat data**: při handoffu po uzavření dne musí člověk dodat skutečná data a reviewovaný lokální report tool z d706 (bez změny runtime checkoutu); jinak BLOCKED_CSV_HANDOFF. Není nutné držet hosted sběr aktivní do půlnoci. Žádné budoucí `as-of`, obcházení guards, prázdný cizí den ani blokující smyčka. SQL akceptace ihned a pozdější CSV/reconciliation mají oddělený stav; hlavičky, hodnoty, formula guards a sedmidenní export expiry se kontrolují existujícími B3 pravidly. Snapshot zachovat do této kontroly; retenční termín a konečné smazání chráněných kopií musí být zvlášť schváleny.

## 8. Scoped cleanup a obnova — také vyžaduje uzavřený gate §4

Pouze po chráněném snapshotu/hash kontrole, ukončené session a nulových pending. Před cleanupem zaznamenat přesné očekávané counts a potvrdit, že se nemění. Helper generuje jen **cohort + tester + přesný session UUID**, child-before-parent, stopped/pending guards, bez DDL či jiných tabulek. Není to atomický vzdálený transaction lock; bezpečnost předpokládá ukončenou návštěvu, žádný souběžný test a disabled nové enrollment/sběr podle reviewovaného postupu. Bez těchto předpokladů STOP. Nemaž receipt, nečti/neměň `PILOT_RULES_ACCEPTANCE` KV.

```powershell
# POUZE po samostatnem schvaleni cleanupu a obnove OFF/OFF dle preserving postupu:
$Cleanup = node $Helper sql $Cohort $Session cleanup | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_CLEANUP_SCOPE' }
& $Wrangler d1 execute apu-ms-site-dev-telemetry --remote --config $DbConfig --command $Cleanup --json
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_CLEANUP_READBACK_REQUIRED' }
& $Wrangler d1 execute apu-ms-site-dev-telemetry --remote --config $DbConfig --file (Join-Path $Evidence 't5-query-before.sql') --json
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_CLEANUP_READBACK' }
# Pozadovany vysledek vsech tri tabulek: 0/0/0. Bez automatickeho opakovani DELETE.
```

### 8.1 Bounded failure / restore — bez čekání na nekonečné pending

**Před aktivací:** určit člověka odpovědného za uzavření, připravit read-only baseline metadata a vlastní `$Paths.restoreConfig`, pevný restore argv níže, a schválit výhradní okno bez cizích změn. Chybí-li některý bod, **neaktivovat**. Od startu dočasné verze zaznamenat skutečný UTC `ActivatedAtMs`; při jediném Odeslat skutečný `SubmittedAtMs`. Maximální návrh okna **10 minut od aktivace**. Drain deadline = dřívější z `SubmittedAt+120s` a `ActivatedAt+510s`. Na failure snapshot nejvýše 30s, na restore pokus 60s; žádná z těchto operací nesmí posouvat deadline. Před odesláním musí zbývat dost času, jinak žádný provider call a rovnou restore. Nejde o CSV as-of.

```powershell
# Pouze spotrebovat existujici timestampy a stopky z §6; zde je NIKDY nevytvaret/resetovat:
if (!(Get-Variable ActivatedAtMs -ErrorAction SilentlyContinue) -or !(Get-Variable WindowWatch -ErrorAction SilentlyContinue)) { throw 'BLOCKED_WINDOW_CLOCK' }
$SubmittedArg = '-'
if (Get-Variable SubmittedAtMs -ErrorAction SilentlyContinue) { $SubmittedArg = $SubmittedAtMs }
# Check pri kazdem kontrolnim bodu; Pending pochazi ze skutecneho SQL read-backu:
$Decision = node $Helper window $ActivatedAtMs $SubmittedArg ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) $Pending | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_WINDOW_CLOCK' }
# SNAPSHOT_STOP_RESTORE_NOW: vykonat nasledujici vetev, nikdy dalsi drain/retry.
```

Režim `window` je pouze offline deadline kalkulátor, **není watchdog, nenastavuje Worker TTL a nepotvrzuje hosted closure**. Operátor používá jednou spuštěné nezávislé neblokující stopky z §6; posun systémových hodin nebo zmeškaný deadline znamená failure a okamžitý restore, nikdy prodloužení drainu nebo nové T0. Bounded restore režim níže omezuje běh Node procesu na min(60s, zbývající čas), s vynuceným ukončením přímého Node CLI procesu (`SIGKILL`), ale nezaručuje dokončení vzdálené operace nebo její odvolání po timeoutu. Při již překročeném deadline **restore neodmítne**: dovolí jeden emergency pokus nejvýše 60s a zapíše `deadline_missed:true`; SLA okna tím není PASS. Je lokálně ověřen injektovaným process double; Native Windows/PowerShell NOT VERIFIED. Chybí-li schválení tohoto mechanismu, čerstvý version guard či operátor odpovědný za read-back, `BLOCKED_WINDOW_CLOSURE`, neaktivovat.

Pevné kroky na deadline nebo při chybě:

1. Už žádné UI odeslání, retry, reset ani reload. Nejvýše 30s na protected **failure-before-restore** export (při dosažení budgetu přerušit pouze lokální read/export proces, bez remote cleanupu; pokud to operátor neumí bezpečně zajistit, export přeskočit a uchovat poslední SQL pozorování): stejný přesný `d1 export` §7, ale `--output $Paths.exportFailure`; lokální import do `$Paths.snapshotFailure`, stejný cohort/session. Uchovat skutečné pending IDs/počty/časy a dostupný trace. Je-li export nedostupný nebo timeoutuje, zachovat dostupná SQL pozorování a označit snapshot NOT VERIFIED; **nezdržovat restore a nic nemazat**. Plné telemetry JSON zůstávají jen chráněně.
2. Jednou UI „Zastavit měření“: uzavře lokální consent/queue, pokusí se revokovat session. Nejvýše 5s na odpověď uvnitř restore rozpočtu; failure stop requestu restore neblokuje. Při nedostupném UI zavřít pouze testovací panel a pokračovat přímo rollbackem. Neprohlašovat tím provider call za zrušený ani cenu za nulovou.
3. Bez čekání na pending provést **přímý explicitní rollback** pod schváleným procesovým timeoutem 60s. Před ním čerstvý deployment read-back musí být přesně schválený T5 version ID/100 % (ne jiný writer), nebo již baseline/100 % (pak rollback vynechat a ověřit closure). Pouze target-only restore config, žádný deployment config z runtime checkoutu. Při cizím version ID žádný blind rollback, incident/closure NOT VERIFIED.

```powershell
$Restore = node $Helper restore-plan $Paths.restoreConfig $Repo | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_RESTORE_PLAN' }
# Pevny budouci argv; nespoustet pred uzavrenim activation/authorization/timeout gates:
# wrangler rollback 732bf950-30cf-444a-90fc-8927d9c8b16c --name apu-ms-site-dev --config <fresh t5-restore-target.json> --message "T5 bounded window restore" --yes
# $Restore.args obsahuje prave tento prikaz, $Restore.timeout_ms = 60000.
# --yes zahrnuje i secret-change force retry 10220; musi byt vyslovne reviewovano,
# ze jedine zmeny jsou dve T5 telemetry keys. Neni to povoleni prepsat cizi secrets.
# AZ PO SAMOSTATNE AUTORIZACI a cerstvem skutecnem overeni vyhradniho T5 version ID:
$WranglerCli = (Get-Item -LiteralPath (Join-Path $Repo 'node_modules\wrangler\wrangler-dist\cli.js')).FullName
$RestoreLog = Join-Path $Evidence 't5-restore-result-attempt1.jsonl'
node $Helper execute-reviewed-restore $WranglerCli $Paths.restoreConfig $RestoreLog $Repo $Decision.restore_by T5_PRESERVING_AND_10220_REVIEWED EXCLUSIVE_T5_VERSION_GUARD_VERIFIED
# Presny CLI hash/config/approval/log/deadline se validuji pred subprocess spustenim.
# Exit 0 = COMMAND_COMPLETED_READBACK_REQUIRED; 2 = RESTORE_UNCONFIRMED, nikoli dokaz CF selhani.
# Log obsahuje jen intent/status/casy, zadny raw stdout/stderr. Bez automatickeho druheho pokusu.
```

Oba povinné literal acknowledgement argumenty potvrzují již získaný samostatný souhlas a skutečnou kontrolu výhradní T5 verze; **neudělují autorizaci a nejsou samy důkazem read-backu**. Tento režim se v rámci přípravy nikdy nespouští proti skutečnému Wrangleru.

4. Ihned nezávislý read-back: použít jen §2 přesného T4 preflightu z §4 (čerstvý vlastní target-only config) a běžný `/api/session` GET. Vyžadovat baseline **732bf950… / 100 %, OFF/OFF, TTL86400, local auth0, původní developer config/isDeveloper:true**, zachované původní Access/bindings/provider secret names a neaktivní T5 enrollment. Exit0 rollbacku sám není read-back. Při chybě procesu/timeoutu není outcome rollbacku známý — **žádný automatický druhý deploy/force/secret put/delete**, zavřít lokální test panel, předat člověku jako `RESTORE_UNCONFIRMED`, uchovat pending/evidence. Nevydávat za runtime OFF. Možnost potvrdit omezený návrat musí být předem ověřenou activation gate; pokud je vyžadováno garantované globální OFF i při nedostupném CF control plane, stávající flags nemají expirační cutoff: **BLOCKED_HARD_WINDOW_EXPIRY**, samostatný Repair/operátorské rozhodnutí před aktivací. Žádný nekonečný drain ani tvrzení o automatickém vypnutí.
5. Po potvrzeném OFF/OFF provést nejvýše dva read-only D1 read-backy s 15s rozestupem a nový **failure-after-restore** export/SQLite (`$Paths.exportAfterRestore`, `$Paths.snapshotAfterRestore`), bez přepsání prvního. Starý request-scoped sink může i po stop/rollback finalizovat: `D1TelemetryStore.upsertAi()` ověřuje owner, ne aktuální readiness/stopped_at; jeho zachycené waitUntil promise mohou doběhnout. Toto je důvod ponechat session/rows. Zaznamenat nové skutečné stavy, nic ručně nefinalizovat a nezapočítat pending jako free. Dvě čtení nejsou důkazem, že neexistuje žádný další in-flight callback.
6. Failure/pending větev **nemá DELETE, receipt cleanup, smazání snapshotu ani odstranění secret hodnot manuální rekonstrukcí**. Baseline obnoví efektivní bindings; přítomnost dočasných keys ve starých verzích a jejich pozdější odstranění je samostatný operátorský gate, nikoli automatický `secret delete`. Scoped D1 cleanup z §8 je jen pro separátně schválenou normální/finalizovanou větev. Po failure je vyžadováno nové rozhodnutí o zachovaných datech/retenci a případných late writes; žádný další provider pokus.

**Oddělený minimální návrh `T5-HARD-EXPIRY-REPAIR`, jen pokud je vyžadován nepodmíněný časový cutoff:** explicitní DEV-only schválený `window_end` v readiness/novém enrollment/context/ingest/request-sink admission, default OFF, po cutoff žádný nový sběr nebo kontext. Již zachycené request sinks mohou dokončit vlastní pending→final zápisy. Bez nové DB/schema, změny activity-clock či provider calls. Cutoff nezmění doslovné hosted vars na 0/0 a nezruší zahájené provider účtování; skutečný rollback/read-back stále potřebuje control plane. Vyžaduje samostatné review/gate rozhodnutí a before/at/after-expiry/concurrent/late-final tests; **nyní neimplementováno**. Bez tohoto mechanismu nelze garantovat globální zastavení sběru v pevné sekundě při CF výpadku, proto se takový slib nedává.

Rozlišit `WINDOW_CLOSED_RUNTIME_PASS` (čerstvý OFF/OFF/developer/session read-back), `TELEMETRY_PARTIAL_PENDING_RETAINED` a `RESTORE_UNCONFIRMED`. Uzavření okna může být úspěšné, i když telemetry acceptance selhala. **Nyní žádný z těchto hosted stavů nebyl proveden nebo ověřen.**

## 9. Akceptace a evidence přípravy

| Stav | Kritérium |
| --- | --- |
| PREPARATION SOURCE PASS | Lokální syntetické testy/helpers a source graph prověřené; žádná hosted akce. Neznamená průchod gates §4 ani schopnost automaticky ukončit hosted okno. |
| T5 PROVIDER+SQL PASS | Samostatně autorizované okno, přesný UI graf, přijatý Rozbor, nezávislá shoda všech calls/usage, odděleně doložený hosted lifecycle (nikoli jen finální reconciliation), žádné dvojí účtování, správná session/workflow/operation, pricing/coverage/privacy PASS, snapshot před cleanupem, doložená obnova baseline. CSV stav uvést zvlášť. |
| FAIL | Nesoulad skutečně pozorovaného kontraktu, počtu/usage/ownership/cost/privacy nebo nepřijatý UI výsledek; žádný retry. HTTP200 samo není PASS. |
| BLOCKED / PARTIAL | Chybí autorizace/bezpečný preserving postup, response-boundary trace, hosted lifecycle observation, ochrana evidence, Windows capability nebo restore důkaz. Neoznačovat chybějící důkaz jako úspěch. Při pending žádný cleanup; normal branch čeká jen do deadline, failure branch včas obnoví runtime a uchová pending evidence. |

Lokální výsledky a přesný finální commit jsou v Draft PR/completion reportu; příkazy pro reprodukci v reviewovaném T5 checkoutu: `node tests/t5-handoff.test.mjs`, `node tests/usage-ledger.test.mjs`, `node tests/model-call-instrumentation.test.mjs`, `node tests/telemetry-b2.test.mjs`, `node tests/telemetry-local-tools.test.mjs`, `node tests/dialog-action.test.mjs`, `npm run typecheck`, `node_modules/.bin/eslint scripts/telemetry/t5-evidence.mjs tests/t5-handoff.test.mjs`, `git diff --check`. Syntetické fixtures, žádné provider credentials/network. Nativní Windows/PowerShell a hosted test **NOT VERIFIED**. Žádný aplikační source/config/migration diff, žádný provider request, resource/secret/hosted mutation, merge, PUBLIC zásah ani nové B4/B5 rozšíření. Tento handoff neuzavírá provider E2E ani PUBLIC readiness.

### Historická lokální verifikace facb100 — 2026-10-29

Ověřený základ `019f3caf1150e5c00f5577464c67e021b61fea42`; GitHub read-back PR #88 a #89 potvrdil uvedené head SHA, obě draft/open/unmerged. Aplikační/config/migration stromy jsou totožné s d706. Původní diff facb100 obsahoval tento dokument, offline helper a jeho testy. Následující výsledky jsou historické; oprava má vlastní verifikaci níže.

```sh
node --test --test-concurrency=1 tests/t5-handoff.test.mjs tests/usage-ledger.test.mjs tests/model-call-instrumentation.test.mjs tests/telemetry-b2.test.mjs tests/telemetry-local-tools.test.mjs tests/dialog-action.test.mjs tests/pilot-telemetry-transport.test.mjs tests/project-usage-isolation.test.mjs
npm run typecheck
node_modules/.bin/eslint scripts/telemetry/t5-evidence.mjs tests/t5-handoff.test.mjs
node --check scripts/telemetry/t5-evidence.mjs
node --check tests/t5-handoff.test.mjs
git diff --check
```

Výsledky: provider-free regrese **201/201 PASS**, z toho **25 nových T5 kontrol**; typecheck, focused lint, syntax a diff/scope kontrola **PASS**. Testy vykonaly i skutečný Node CLI, SQLite import/sidecar/hash a původní CSV CLI. Zpočátku Cloud sandbox blokoval Node child processes (`EPERM`); sada byla znovu vykonána s povolením lokálních podprocesů, žádné testy nebyly vynechány. Žádné provider/Cloudflare operace. Build/Worker artifact nebyl znovu generován: aplikační/runtime/config source není měněn. **Native Windows/PowerShell, Node 22 runtime, browser hosted flow a provider usage surface NOT VERIFIED.** Přípravné source PASS neodstraňuje dva blockery §4 ani neuděluje hosted autorizaci.

### T5 Repair nad facb100 — source evidence

Oprava kolize: prepare vytváří pouze query soubory `t5-query-*.sql`; exporty používají `t5-export-*.sql`. Regrese vykonává skutečný CLI prepare → vygenerované paths → syntetický SQLite export do výhradně nové export cesty → skutečný CLI snapshot/strict sidecar/hash, se stejným cohort z připraveného proposal. Query zůstává beze změny. Druhá regrese uchovává stopped session s pending AI rows ve failure snapshotu a ověřuje, že pending cleanup guard nedovolí deletion. Protokolový test skutečných vyjmutých Wrangler funkcí dokládá latest-only secret PATCH a exact-version restore POST; nepřipojuje se k CF.

Nové stavy helperu: finální reconciliation PASS je nezávislá na SQL sampling. Bez všech časově doložených pending→final párů je `result=PARTIAL_LIFECYCLE_NOT_VERIFIED`, `reconciliation=PASS`, `lifecycle.status=NOT_VERIFIED`, CLI exit **2**. Opačný/nekonzistentní lifecycle záznam je FAIL. Chybějící pending není automatický storage FAIL ani plný T5 PASS. Deadline plán výslovně vrací `hosted_closed=NOT_VERIFIED`, nikdy sám nepovolí cleanup.

Výsledky opravy a přesné nové SHA/helper hash jsou v aktualizovaném Draft PR #90 a completion reportu. Native Windows/PowerShell, timeout executor, preserving activation, provider trace a hosted restore **NOT VERIFIED / BLOCKED** podle příslušného gate. Nový explicitní restore executor byl při testech volán výhradně s in-memory process double, nikdy se skutečným Wrangler subprocess voláním. Žádná změna aplikace, provider credentials, hosted konfigurace/resources, reálné AI volání, spending, merge ani PUBLIC zásah.

Finální lokální V2 opravy (Linux, Node 24.19.0, Wrangler 4.150.0): stejná osmifile provider-free sada výše **205/205 PASS**, z toho **29 T5 kontrol**; typecheck, focused lint, syntax, diff/isolation PASS. Žádný SKIP. Restore testy používají pouze process double; schopnosti instalovaného CLI pouze in-memory HTTP double. Nativní Windows/PowerShell/Node22 a skutečné uzavření hosted okna zůstávají NOT VERIFIED. SQL migrace, aplikace, konfigurace a dependency versions jsou proti facb100 beze změny.
