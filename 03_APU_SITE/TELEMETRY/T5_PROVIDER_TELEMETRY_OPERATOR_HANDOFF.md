# APU T5 — jeden Rozbor, provider a telemetry ledger

**Aktuální provider gate:** operátor doložil prázdnou DEV secret inventory `2026-10-30T15:25:06.659Z`, oba provider counts=0; příčina historického rozdílu NOT VERIFIED. Tento T5 postup se nyní nevykonává. Viz [oddělená příprava DEV provider bootstrapu](DEV_PROVIDER_BOOTSTRAP.md). Původní732bf950… není automaticky provider-ready ani správný post-T5 restore bod; po bootstrapu je nutný review skutečného nového baseline UUID a aktualizace T5 helperů. Žádný guard neobcházet.


**T5-R2: source příprava, nikoli hosted PASS ani autorizace.** VS agent Luna Low: bez delegování, dalších promptů, úprav skriptů a náhradních postupů. Nyní se nesmí provést žádný hosted příkaz. Níže uvedené příkazy jsou pevný návrh následného samostatně autorizovaného Windows zadání; dokument se nespouští celý jako skript. Při chybě STOP; po aktivaci vždy přejít do bounded restore větve.

## 1. Neměnné body a zdroj kontroly

| Bod | Přesná hodnota |
| --- | --- |
| Historický aplikační source | `d706a55c7ff80b1439079badfda88c9baa5807c4`; nový T5-R2 kandidát jej mění, přesný SHA je v odvozeném Draft PR |
| Přesný základ T5-R2 | PR #90 `d796994829565208f503d3493b07b1d1a3b726e1`, `docs/t5-provider-telemetry-handoff` |
| Evidence / základ tohoto PR | PR #88, `019f3caf1150e5c00f5577464c67e021b61fea42`, `docs/pilot-tech-t2-hosted-evidence` |
| T4 postup | PR #89, `1cfef6a8eed8b421c6584b97b9e56761e92a52db` |
| Worker / jediný origin | `apu-ms-site-dev` / `https://apu-ms-site-dev.catsystem-exe.workers.dev` |
| Výchozí a rollback verze | `732bf950-30cf-444a-90fc-8927d9c8b16c`, 100 % traffic |
| Výchozí runtime | telemetry/metadata `0/0`, receipt TTL `86400`, local auth `0`, původní developer role |
| Jediná identita | `catsystem.exe@gmail.com`; email nepatří do telemetry evidence |
| Existující resources | `TELEMETRY_DB` → dedikovaná EU `apu-ms-site-dev-telemetry`; stávající Access, KV, ASSETS a provider secrets beze změny |

T3 a T4 jsou převzaté operátorské **PASS**. Neopakovat refusal test, první receipt POST/GET/reload ani jejich historickou diagnostiku. Historická příčina incidentu zůstává NOT VERIFIED. PUBLIC readiness je otevřená.

Původní kontrola UI cesty proběhla nad d706; T5-R2 nemění klientskou cestu, payloady, počty volání ani retry pravidla. Relevantní soubory: [klient](../../../app/apu-client.tsx), [textová navigace](../../../app/dialog-action.ts), [desktop gating](../../../app/desktop-workspace.ts), [router cache](../../../app/f2-need-routing.ts), [extract](../../../app/api/extract/route.ts), [need-route](../../../app/api/need-route/route.ts), [analysis](../../../app/api/analysis/route.ts), [provider wrapper](../../../app/openai-responses-instrumentation.ts), [lifecycle](../../../app/model-call-instrumentation.ts), [projekce/sink](../../../app/telemetry/model-usage-adapter.ts), [ceník](../../../app/usage-ledger.ts). Helper používá stávající tři tabulky, nikoli nové schéma.

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
- Chybějící usage/cost je **null / incomplete**, nikoli nula. Úspěšný API status nestačí. Při známém nákladu >USD 1 FAIL_SOFT_BUDGET_EXCEEDED; normálně uzavřít po finalizaci, při failure nejpozději v bounded restore větvi i s uchovanými pending. Nikdy automaticky neopakovat pokus kvůli neúspěšné evidenci.

## 4. Nový technický kontrakt a gates

T5-R2 přidává skutečný raw response-boundary trace do společného Responses wrapperu a MAIN SSE pumpy. Je nezávislý na `ModelUsageRecord`, cenové projekci i D1. Výchozí gate je vypnutý; `APU_T5_TRACE_ENABLED=1` funguje pouze na přesném DEV originu, policy env=dev, synthetic=0, metadata=0, matching cohort, tester identitě a platném explicitním opt-in kontextu s UUID workflow/operation. Access/rules odmítnutí jsou před collector. Žádné nové requesty, retries, response chaining ani změny `store:false`.

Trace obsahuje jen verzi, cohort, call UUID (stejný X-Client-Request-Id), operation/attempt, čas, stage invoke/response/transport_error, HTTP/provider status, model/tier, číselnou usage s rozdílem absent/null/0 a počet file_search z původního output typu. Žádný prompt, odpověď, body, headers, e-mail, JWT, credentials nebo provider raw IDs. Neznámá/nečíselná usage = invalid, nikoli úspěšná nula. Chybějící output = neznámý tool count. Logger selhává fail-open. Zvláštní `write_ack` obsahuje pouze technickou obálku cohort/version + call_id/state/time a vzniká až po skutečně úspěšném D1 upsertu s changes=1; není provider evidence.

Tail je best-effort diagnostika transportní hranice aplikace, **nikoli nezávislé provider vyúčtování/dashboard audit**. Nevyžaduje přístup k provider účtu. Raw Tail je pouze omezeně v paměti inline sanitizeru: max frame 1 MiB, celkem 8 MiB, trace zpráva 8192 znaků, nejvýše 10 min. Disk/terminál dostanou jen přísný trace allowlist a status. Stderr (včetně reconnect) se nikdy nevypisuje/ukládá a zneplatní capture. Ztráta streamu, neúplný/duplicitní invoke/response pár nebo nesoulad s DB = NOT VERIFIED/FAIL, nikdy odhad. I zdravý Tail není garantovaný audit všech operací na provider účtu.

### 4.1 Úplná konfigurace a zachování secrets

Explicitní T5 varianta `ops/dev/prepare-t5-worker.mjs` nejprve volá původní striktní `buildDevConfig()`; `prepare-worker.mjs` se nemění. Baseline metadata získává `ops/dev/t5-baseline.mjs` pouze pevnými GET endpoints přes existující **Cloudflare** auth instalovaného Wrangleru. Auth je jen v paměti, stdout auth commandu se nikam nepropouští; provider secrets se nikdy nečtou. Není to beta version-copy adaptér: jediný read moderního version metadata endpointu slouží k ASSETS config read-backu. Neznámý tvar metadata, chybějící settings nebo nepodporované script tags/migration_tag = STOP, bez odhadování. Service/settings/routing GET cesty odpovídají `fetchWorkerConfig()`/`downloadWorkerConfig()` skutečného instalovaného CLI.

Config explicitně obsahuje původní Access plain vars, local auth 0, receipt TTL 86400, obě dedikované KV, EU D1, ASSETS binding a původní asset chování, compatibility a relevantní settings (observability/logpush/placement/tail consumers/streaming tail consumers/limits/cache, pokud je baseline vrací). Obsah kódu/ASSETS je nový reprodukovatelný build kandidáta; netvrdíme shodu s d706. Zakázané/neočekávané bindings, cizí worker/účet/D1, resource reuse nebo settings mimo podporovaný kontrakt = STOP. Režimy:

| Režim | Telemetry / metadata / trace | Role a secrets |
| --- | --- | --- |
| staged | 0 / 0 / 0 | původní jediný developer; pouze provider secrets required/inherit |
| enabled | 1 / 0 / 1 | jediný enrolled účet jako tester; dvě nové telemetry keys, provider secrets inherit |
| rollback původní 732bf950… | původní 0 / 0; starý source bez trace | původní developer a bindings; receipt data/TTL beze změny |

Povolený overlay: jen vyjmenované telemetry policy/cohort/enrollment/notice vars, developer role a dvě T5 diagnostic vars, dvě nové telemetry keys. Sanitizovaný review uvádí jména změněných vars, hashe zachovaných hodnot/resource identities/settings a samostatný Worker version ID/hash posledního uploadu; ne úplná resource UUID, audience, e-mail, enrollment ani klíče. Private configs/evidence nesmějí do Git ani veřejného logu.

**Důkaz instalovaného Wrangleru 4.150.0** (`cli.js` SHA256 `71da1f9bcf69a9f56c4ff4f68e71315365d03db8ea11207577b47a8e1a0a1064`): standardní deploy přijímá `--secrets-file`; `addRequiredSecretsInheritBindings` převádí neposkytnuté required secrets na `{type:inherit}`; deploy nastavuje `keepSecrets:true`; skutečný upload form zahrnuje keep_bindings secret_text/secret_key a explicitní provider inherit bindings **bez `version_id`**. Skutečná standardní deploy větev posílá tento form přes `POST /accounts/{account}/workers/scripts/{worker}/versions?bindings_inherit=strict`; nevybírá aktivní version UUID jako zdroj secrets. Podle [Upload Version API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/create/) `keep_bindings` zachovává předchozí upload; [inherit binding kontrakt](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/methods/update/) bez `version_id` používá poslední upload (`latest`), který nemusí být nasazený. Provider hodnoty se vůbec nedodávají, dvě telemetry hodnoty jsou jen v private secrets-file. In-memory test skutečných vyjmutých funkcí i standardní upload větve pinned CLI ověřuje form, endpoint a strict query přes HTTP double; žádný hosted request. Samotný CLI neurčuje plaintext hodnotu secrets; default zdroje doplňuje uvedený API kontrakt. Neužívá se secret bulk/put, versions/latest patch, keep_vars:false ani ruční rekonstrukce baseline. Plain vars zůstávají plain vars. `keep_vars:true` je doplněno úplným explicitním allowlistem včetně resetu známých chybějících T5 flags. Byte equality provider secret plaintextu záměrně nelze ověřit; zachování je doloženo inherit kontraktem a metadata bindings. Aktivní baseline i poslední upload musí mít před začátkem pouze původní dva provider secrets; jinak STOP. Jejich hodnoty se dědí z posledního uploadu, nikoli automaticky z aktivní baseline. Metadata kontrola neprokazuje byte equality hodnot mezi těmito dvěma verzemi.

**Aktivní baseline a poslední upload jsou dvě nezávislé identity.** Po rollbacku smí zůstat přesná aktivní `732bf950…`/100 % a jiný kompatibilní poslední upload. Příprava jejich úplnou totožnost nevyžaduje: poslední upload musí mít platný version UUID, správné dedikované KV/D1/ASSETS a oba provider secret bindings, žádné neznámé bindings/secrets ani stale telemetry secrets a kompatibilní date/flags. Jeho kód, ETag a annotations se smějí lišit; kód/config/ASSETS nového kandidáta pocházejí z reviewovaného buildu a přesné aktivní baseline, nikoli z posledního uploadu. Plain vars posledního uploadu nepřepisují úplný explicitní config.

Review zaznamená `latest_upload.version_id`, hash celých metadata a `differs_from_active`. Během preflight musí zůstat stejné deploymenty, katalog/latest ID, metadata posledního uploadu i aktivní service settings/ETag; změna = STOP. Fresh guard před stage dál porovnává přesnou aktivní baseline, bindings/settings/ASSETS/D1 a celý schválený poslední upload s reviewovaným snapshotem. Odlišnost baseline vs latest je přípustná; změna latest od review přípustná není. Následný read-back vlastní nově nasazené stage/ON verze nadále kontroluje, že během výhradního okna nepřibyl další upload.

**D1 metadata aliasy:** [API kontrakt D1 bindingu](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/create/) uvádí `database_id` a starší `id`. Pinned Wrangler 4.150.0 (`convertBinding`, `mapWorkerMetadataBindings`, `createWorkerUploadForm`) čte `database_id ?? id`, převádí starší metadata `id` do config `database_id` a ve standardním upload formu používá `id`. T5 podporuje pouze tyto doložené reprezentace: každé přítomné pole musí být platný UUID ve stejném kanonickém formátu jako strict inputs; při obou polích musí být hodnoty přesně shodné. Příprava kontroluje identitu vůči schválenému `inputs.telemetry.databaseId`; candidate read-back vůči `database_id` v configu odvozeném tímto strict preparerem. Další pole zůstávají zakázaná. Chyby bez hodnot: `BLOCKED_D1_BINDING_SCHEMA` (extra pole), `BLOCKED_D1_BINDING_ID` (chybějící/neplatný UUID nebo typ), `BLOCKED_D1_BINDING_CONFLICT` (rozdílné aliasy), `BLOCKED_D1_BINDING_TARGET` (jiný cílový UUID). Normalizuje se pouze porovnávací pohled; původní raw metadata, jejich hashe včetně `preserved_bindings` a raw freshness porovnání zůstávají zachované.

### 4.2 Co ještě vyžaduje samostatnou autorizaci

Schválit nový přesný source SHA a config review; standardní nový DEV build/deploy nejprve OFF staged a potom dočasný tester overlay, dvě nové telemetry keys, explicitní notice/privacy a UI opt-in, bounded Tail subscription, D1 SELECT/export a případně samostatně scoped cleanup, jeden UI send/3–5 Responses requests/USD1 soft budget, stop a přesný rollback včetně Wrangler 10220 secret-change force retry. Žádné provider credentials work, nové resources, receipt seed/delete, Access policy, PUBLIC nebo onboarding. Pokud tyto podmínky nejsou výslovně schváleny, **BLOCKED před hosted příkazy**.

Aktuální operátorský dílčí Windows výsledek je uveden v §5.1; nový D1 repair, native deploy/rollback a capture jsou **NOT VERIFIED**. Dokončení readeru samo neověřilo shodu D1 UUID ve všech bindings. Při neodpovídající metadata shape žádný deployment ani improvizovaný fallback; samostatný minimální Repair. Výpadek Cloudflare control plane může znemožnit potvrzení obnovy; časový plán ani kill lokálního procesu nejsou hard expiry nebo záruka hosted closure. Pokud je požadována tato garance, neaktivovat.

## 5. Pevná Windows příprava a read-only preflight — budoucí autorizovaná fáze

Použít schválený T5-R2 source worktree a jeho existující dependencies. **Neresetovat runtime checkout**, nepožadovat jeho čistotu ani starý dočasný config. Build worktree musí mít přesný reviewovaný SHA a žádné změněné/untracked source; ignorované build výstupy a vlastní tsbuildinfo nevadí. Git Bash a GNU timeout vyžaduje stávající canonical build; chybí-li, STOP před aktivací, žádné instalování náhradního toolchainu agentem. Podporovaný projektový Node >=22.13.0, pro operátora Node22.23.2; lokální Cloud verifikace Node24.19.0. Operátor následně doložil na Windows Node22.23.2, Git Bash/GNU timeout, canonical build/artifact a reader PASS před opravou D1 aliasů (§5.1); opravená normalizace na Windows dosud NOT VERIFIED.

Všechny `Read-Host` níže jsou pevné identity/cesty z již schválené evidence nebo skutečného CLI outputu, nikoli pokyn doplnit novou konfiguraci. Restricted adresář mimo Git se schválenými ACL (jen operátor) je předpoklad; bez nich STOP. Nikdy nezobrazovat návrh keys/configs ani ukládat HAR.

```powershell
$ErrorActionPreference = 'Stop'
$Repo = (Resolve-Path (Read-Host 'Absolutni cesta ke schvalenemu T5-R2 source worktree')).Path
$SourceSha = Read-Host 'Presny plny schvaleny T5-R2 SHA z Draft PR'
if ($SourceSha -notmatch '^[a-f0-9]{40}$' -or (git -C $Repo rev-parse HEAD) -ne $SourceSha) { throw 'BLOCKED_SOURCE' }
$Evidence = (Resolve-Path (Read-Host 'Existujici novy restricted adresar mimo Git, s overenymi ACL')).Path
$Inputs = (Resolve-Path (Read-Host 'Restricted schvalene strict DEV inputs G1, staged D1 + receipt KV + TTL86400')).Path
$Identity = (Resolve-Path (Read-Host 'Restricted puvodni G1 identity JSON accountId/databaseId/databaseName/jurisdiction')).Path
$Helper = Join-Path $Repo 'scripts/telemetry/t5-evidence.mjs'
$Ops = Join-Path $Repo 'ops/dev/prepare-t5-worker.mjs'
$Reader = Join-Path $Repo 'ops/dev/t5-baseline.mjs'
$Capture = Join-Path $Repo 'scripts/telemetry/t5-tail-capture.mjs'
$Cli = (Get-Item -LiteralPath (Join-Path $Repo 'node_modules/wrangler/wrangler-dist/cli.js')).FullName
$env:CI='true'; $env:WRANGLER_WRITE_LOGS='false'; $env:WRANGLER_SEND_METRICS='false'
function Invoke-T5Command([string[]]$CommandArgs,[string]$Stem,[int]$Ms) {
  $out = Join-Path $Evidence ($Stem+'.json')
  $err = Join-Path $Evidence ($Stem+'.stderr.txt')
  if ((Test-Path -LiteralPath $out) -or (Test-Path -LiteralPath $err)) { throw 'BLOCKED_READ_EVIDENCE_EXISTS' }
  # Pouze presny plan deploy nebo pevne read/export argv tohoto runbooku; zadne user SQL.
  $quoted = @($Cli) + $CommandArgs | ForEach-Object { if ($_ -match '["\r\n]') { throw 'BLOCKED_ARGUMENT_QUOTE' }; '"'+$_+'"' }
  $p = Start-Process -FilePath (Get-Command node).Source -ArgumentList $quoted -PassThru -NoNewWindow -RedirectStandardOutput $out -RedirectStandardError $err
  if (!$p.WaitForExit($Ms)) { $p.Kill(); if (!$p.WaitForExit(1000)) { throw 'PROCESS_KILL_UNCONFIRMED_RESTORE_NOW' }; throw 'READ_TIMEOUT_PRESERVE_RESTORE_NOW' }
  $p.Refresh()
  if ($p.ExitCode -ne 0) { throw 'READ_FAILED_PRESERVE_RESTORE_NOW' }
}
node --version
node $Ops --build $Repo $SourceSha
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_CANONICAL_BUILD' }
node $Helper prepare $Evidence $Repo
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_OFFLINE_PROPOSAL' }
$Paths = node $Helper paths $Evidence $Repo | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_PATHS' }
$Proposal = Join-Path $Evidence 't5-overlay-proposal.json'
$Cohort = (Get-Content -Raw -LiteralPath $Proposal | ConvertFrom-Json).cohort
$DbConfig = Join-Path $Evidence 't5-d1-read.json'
node (Join-Path $Repo 'ops/dev/prepare-telemetry-migration.mjs') --prepare --identity $Identity --config $DbConfig
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_D1_TARGET' }
# Od tohoto bodu jen po samostatne autorizaci hosted read-only preflight:
node $Cli whoami --config $Paths.restoreConfig *> (Join-Path $Evidence 't5-whoami.txt')
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_ACCOUNT' }
$Baseline = Join-Path $Evidence 't5-baseline.json'
node $Reader --execute-authorized-read $Paths.restoreConfig $Inputs $Baseline $Repo $Cli
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_BASELINE_METADATA' }
$Configs = Join-Path $Evidence 'configs'
if (Test-Path -LiteralPath $Configs) { throw 'BLOCKED_CONFIG_DIR_EXISTS' }
New-Item -ItemType Directory -Path $Configs | Out-Null
node $Ops --prepare $Baseline $Inputs $Proposal $Configs $SourceSha $Repo
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_COMPLETE_CONFIG' }
$Staged = Join-Path $Configs 't5-staged.wrangler.json'
$Enabled = Join-Path $Configs 't5-enabled.wrangler.json'
# Pred dalsim krokem clovek reviewuje t5-config-review.json a private binding identities.
```

Preflight člověk ověří správný účet, přesný původní DEV version ID/100 %, rollback verzi čitelnou, EU D1 a správné dvě KV, Access audience/issuer, ASSETS/settings, metadata0/telemetry0/developer/TTL86400. Reader obsahuje before/after deployment, latest catalog/metadata i active service settings/ETag guard; odlišné kompatibilní latest samo o sobě není chyba. Neshoda = STOP. Restricted inputs nejsou získávány z produkce ani odhadovány. Sanitizovaný review sám nenahrazuje kontrolu identit.

### 5.1 Pokračování po Windows BLOCKED_UNEXPECTED_FIELDS — pouze offline příprava

**Operátorská evidence, nikoli Cloud native test:** na výchozím `ffb1092c56f226ae841328a775cb656b96187a87` byly dostupné Node22.23.2/Git Bash/GNU timeout, canonical build a Worker artifact PASS, offline proposal/D1 config a read-only baseline reader dokončeny. Config preparation skončila `BLOCKED_UNEXPECTED_FIELDS`. Diagnostika našla `database_id` typu String v raw baseline a latest bindings; hodnoty nebyly zveřejněny ani diagnostikou porovnány. Hosted mutations=0/provider calls=0. To nedokládá správnost konkrétních UUID; nová příprava je striktně porovná. Opravený source na native Windows zatím NOT VERIFIED.

Po review opravného SHA zachovat celý původní restricted evidence adresář, inputs, raw baseline, proposal i případné částečné config výstupy. **Nespouštět znovu `t5-evidence prepare`, negenerovat nový cohort/keys a nepřepisovat původní configs.** Aktualizaci reviewovaného source worktree provést běžným fast-forwardem bez resetu; runtime checkout zůstává nedotčený. Pro nový SHA musí vzniknout nový skutečný canonical build a nový manifest vytvořený `--build`; starý manifest se ručně nepřepisuje ani nepřeznačuje na nový SHA, i když aplikační soubory zůstaly stejné.

Pevné offline pokračování, bez `--execute-authorized-read`, deploy, D1 příkazu nebo provider volání:

```powershell
$ErrorActionPreference = 'Stop'
$Repo = (Resolve-Path (Read-Host 'Absolutni cesta k aktualizovanemu reviewovanemu source worktree')).Path
$SourceSha = Read-Host 'Presny plny novy schvaleny opravny SHA z PR91'
if ($SourceSha -notmatch '^[a-f0-9]{40}$' -or (git -C $Repo rev-parse HEAD) -ne $SourceSha) { throw 'BLOCKED_REVIEWED_SOURCE' }
$Evidence = (Resolve-Path (Read-Host 'Puvodni restricted evidence adresar mimo Git, zachovat beze zmeny')).Path
$Inputs = (Resolve-Path (Read-Host 'Puvodni validovane strict DEV inputs JSON')).Path
$Baseline = (Resolve-Path (Read-Host 'Puvodni raw t5-baseline.json z dokonceneho readeru')).Path
$Proposal = (Resolve-Path (Read-Host 'Puvodni t5-overlay-proposal.json, NEGENEROVAT ZNOVU')).Path
$Ops = Join-Path $Repo 'ops/dev/prepare-t5-worker.mjs'
$Resume = Join-Path $Evidence ('resume-d1-'+$SourceSha)
if (Test-Path -LiteralPath $Resume) { throw 'BLOCKED_RESUME_EXISTS_NO_OVERWRITE' }
New-Item -ItemType Directory -Path $Resume | Out-Null
# Resume musi zdedit puvodni schvalene restricted ACL; pri nejasnosti STOP.
$OldDist = Join-Path $Repo 'dist'
$OldManifest = Join-Path $OldDist 't5-build.json'
if (!(Test-Path -LiteralPath $OldManifest)) { throw 'BLOCKED_ORIGINAL_BUILD_MANIFEST_MISSING' }
$OldManifestHash = (Get-FileHash -LiteralPath $OldManifest -Algorithm SHA256).Hash
$PreviousDist = Join-Path $Resume 'previous-dist'
Copy-Item -LiteralPath $OldDist -Destination $PreviousDist -Recurse
if ((Get-FileHash -LiteralPath (Join-Path $PreviousDist 't5-build.json') -Algorithm SHA256).Hash -ne $OldManifestHash) { throw 'BLOCKED_BUILD_EVIDENCE_COPY' }
# Puvodni artifacty i jejich skutecny manifest/source_sha jsou ted zachovany v previous-dist.
node $Ops --build $Repo $SourceSha
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_NEW_CANONICAL_BUILD' }
$Built = Get-Content -Raw -LiteralPath (Join-Path $Repo 'dist/t5-build.json') | ConvertFrom-Json
if ($Built.kind -ne 'apu-t5-build' -or $Built.source_sha -ne $SourceSha) { throw 'BLOCKED_NEW_BUILD_PROVENANCE' }
$Configs = Join-Path $Resume 'configs'
New-Item -ItemType Directory -Path $Configs | Out-Null
node $Ops --prepare $Baseline $Inputs $Proposal $Configs $SourceSha $Repo
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_CONFIG_PREPARATION_PRESERVE_OUTPUTS' }
$Staged = Join-Path $Configs 't5-staged.wrangler.json'
$Enabled = Join-Path $Configs 't5-enabled.wrangler.json'
# Review noveho t5-config-review.json; nevypsat private configs, inputs, keys nebo UUID.
# Zde STOP. Nevykonavat ani stage/ON plan, natoz deploy nebo hosted read-back.
```

`--build` kontroluje čistý přesný source a vytvoří vlastní manifest s reálnými artifact hashes; `--prepare` tyto hashe znovu ověří. Původní proposal/inputs/raw baseline se pouze čtou a jejich hodnoty se nedoplňují ani nepřevádějí ručně. Existující neúspěšné outputy se nikdy nemažou. Selže-li pokračování, uchovat i nový partial output a STOP; žádné automatické opakování do stejného adresáře. Raw baseline je zachovaný historický snapshot pro offline review, **nikoli čerstvý preflight pro deployment**. Případná další hosted fáze vyžaduje samostatnou autorizaci a nový čerstvý guard dle §6 do nové evidence cesty; nyní se nepouští. Native výsledky tohoto pokračování musí zaznamenat operátor po skutečném běhu, ne převzít z Cloud testů.

## 6. Budoucí aktivace a browser checklist

**Provést až po schválení §4.2.** Výhradní DEV okno bez jiných writerů je podmínka; fresh guard není atomický zámek. Neodstraňovat `--strict` při Wrangler conflict. Nepoužívat npm deploy nebo produkční config.

```powershell
$Guard = Join-Path $Evidence 't5-original-guard.json'
node $Reader --execute-authorized-read $Paths.restoreConfig $Inputs $Guard $Repo $Cli
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_FRESH_BASELINE' }
node $Ops --guard-baseline $Guard $Baseline $Repo
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_BASELINE_CHANGED' }
$StageArgs = @(node $Ops --plan staged $Configs $Repo | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_STAGE_PLAN' }
Invoke-T5Command $StageArgs 't5-stage-deploy' 60000
# Pri timeout/failure uz zadny deploy retry; overit skutecny deployment a prejit do §8.
$StagedVersion = Read-Host 'Presny skutecny version UUID z stage deploy outputu'
$StageRead = Join-Path $Evidence 't5-stage-readback.json'
node $Reader --execute-authorized-read $Paths.restoreConfig $Inputs $StageRead $Repo $Cli $StagedVersion
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_STAGE_READBACK_RESTORE' }
node $Ops --verify $StageRead $Staged $SourceSha $StagedVersion $Repo
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_STAGE_CONTRACT_RESTORE' }
```

Staged verze má nový source, ale collection/metadata/trace0/0/0. Zde `/api/session` musí být 200/isDeveloper:true, browser správný účet. Žádné AI requesty. Baseline source zůstává přesný rollback target. **Selhání po stage není povolení pokus opakovat**: použít restore větev s právě doloženým stage version ID; neaktivovat ON.

### 6.1 Capture před jakýmkoli provider voláním

Spustit v **druhém PowerShell terminálu**, stejný reviewovaný `$Repo/$Cli/$Evidence/$Cohort`; přesné hodnoty převzít z prvního terminálu, žádné nové paths/cohort. Vykonává přímo stávající Wrangler Tail. Neukládat/samostatně nespouštět raw `wrangler tail`.

```powershell
node $Capture --execute-authorized $Cli $Paths.restoreConfig $Evidence $Repo $Cohort 600000
# Bezi bounded 10 min; ukoncit Ctrl+C az po dolozeni final zapisu/restore, nikoli Stop-Job.
# Raw stdout/stderr child procesu jsou pipe -> sanitizer/discard, nikdy terminal nebo soubor.
```

V browser console jediného DEV panelu provést pouze tento předem připravený ne-AI GET (bez tisku response body/identity/headers):

```javascript
await fetch('/api/session', {cache:'no-store'}).then(r => r.status)
```

Po 200, v prvním terminálu:

```powershell
$CaptureManifest = Join-Path $Evidence 't5-provider-trace.capture.json'
node $Capture --ready $CaptureManifest $Cohort $Repo
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_TAIL_NOT_READY_NO_ACTIVATION' }
```

Readiness vyžaduje skutečně přijatý Tail event přesného DEV GET/session200, žádné parse/reconnect faults, capture ještě běží a zbývají ≥3min. JSON režim Wrangleru sám connection marker neemitoval; živý proces nestačí. Žádné AI keep-alive/probe. Nedorazí marker do 30s (ruční stopky), žádná aktivace; ukončit capture a obnovit baseline. Žádná poll smyčka, nový test, fallback nebo čtení raw Tail. Před odesláním znovu `--ready` a fresh enabled read-back.

### 6.2 ON overlay a přesné jedno UI odeslání

```powershell
# Znovu fresh staged read-back pred ON; verejne pouze status, nikoli config.
$BeforeOn = Join-Path $Evidence 't5-before-on.json'
node $Reader --execute-authorized-read $Paths.restoreConfig $Inputs $BeforeOn $Repo $Cli $StagedVersion
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_BEFORE_ON' }
node $Ops --verify $BeforeOn $Staged $SourceSha $StagedVersion $Repo
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_BEFORE_ON_CONTRACT' }
$OnArgs = @(node $Ops --plan enabled $Configs $Repo | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_ON_PLAN' }
$ActivatedAtMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$WindowWatch = [Diagnostics.Stopwatch]::StartNew()
Invoke-T5Command $OnArgs 't5-on-deploy' 60000
# Pri timeout/failure okamzite do §8; timeout nepotvrzuje zruseni remote deploy.
$T5Version = Read-Host 'Presny skutecny version UUID z ON deploy outputu'
$OnRead = Join-Path $Evidence 't5-on-readback.json'
node $Reader --execute-authorized-read $Paths.restoreConfig $Inputs $OnRead $Repo $Cli $T5Version
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_ON_READBACK_RESTORE' }
node $Ops --verify $OnRead $Enabled $SourceSha $T5Version $Repo
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_ON_CONTRACT_RESTORE' }
```

Čas začíná konzervativně **před ON deploy**, ne až po jeho doběhu. Celé okno nejvýše10min; před každým krokem sledovat jediné monotonic stopky, nikoli je restartovat. Další kontroly jen uvnitř deadline §8. Před UI send musí být dostatek času na 120s drain +30s evidence +60s restore a capture readiness ≥3min; při nedostatku žádný send, restore. ON config může být zveřejněn jen se dvěma novými telemetry keys v private secrets-file; provider jména jsou pouze inherit/required, žádné `secret put/bulk`.

Pevný browser checklist:

1. Jediný panel/přesný origin/stejný účet. `/api/session`200/isDeveloper:false. Platný receipt použít; je-li expirovaný, pouze jedno běžné výslovné UI přijetí aktuálních rules/information, žádný seed/delete nebo T4 replay. Nejasný výsledek = STOP/restore.
2. Nový prázdný projekt pouze pokud neohrozí jinou práci; žádné storage čištění. Dvě přesné položky §2, ostatní prázdné, žádný AI POST. Před send D1 before query musí být0/0/0 (§7). Jiná data = STOP, ne cleanup.
3. Jednou „Zapojit měření pro tuto návštěvu“. Context ready/metadata_enabled:false; uchovat jen skutečný session/tab UUID mimo Git, nikdy opaque context. Přesně jedna tester session, žádné AI rows. Znovu `--ready`, ověřit ON0metadata/trace1 read-back a dostatek času.
4. `$SubmittedAtMs` zapsat těsně před jediným sendem. Jednou odeslat `Přejít do fáze 2`. Síť jen `/api/extract`→`/api/need-route`→`/api/analysis`, fyzicky3–5 Responses. Bez dvojkliku, retry, druhého panelu, reset/reload, upřesňujícího promptu či dalšího AI tlačítka. MAIN/controller nemají být volány. Přijatý Rozbor musí být viditelný; obsah se neeviduje.
5. 428/403/error/clarification/conflict, extra route/call, změna účtu = neúspěšný jediný pokus, žádný další provider request z vůle operátora. Původní automatické subcalls mohou doběhnout. Při chybě bounded restore, ne nový pokus.
6. Normální větev: všechny raw response páry, UI accepted,3–5final/0pending,3requested/3accepted resolved, dvě shodná finální SQL čtení s15s odstupem a uvnitř deadline. Potom jednou UI stop, stopped_at, protected snapshot a rollback. Stop flags nesmí předběhnout čekající AI writes. Failure deadline má výjimku: zachovat pending a obnovit runtime, nikoli neomezeně čekat.

## 7. SQL, snapshot a nezávislá reconciliation

Příkazy jsou budoucí autorizované D1 reads/export, ne migrace. Účet/D1 EU ověřuje §5 reader i původní striktní D1 preparer. SQL se generuje výhradně helperem; query a export názvy jsou oddělené. D1 export zahrnuje jen tři telemetry tabulky; při nečekaných cizích rows snapshot/verify selže, žádná automatická oprava. Chráněné evidence adresáře nesdílet do PR.

Pevná PowerShell funkce `Invoke-T5Command` z §5 omezuje každý deploy/read/export lokálního CLI procesem s timeoutem; SQL v tomto oddílu obsahuje pouze čtení/export. Native process kill neodvolá již odeslaný deploy/GET/export; nesmí blokovat restore. Výstupy do nových private souborů, žádný overwrite. Neprovádí automatický retry.

```powershell
# Pred opt-in (before SQL je pripraveny prepare helperem):
Invoke-T5Command @('d1','execute','apu-ms-site-dev-telemetry','--remote','--config',$DbConfig,'--file',$Paths.before,'--json') 't5-before' 10000
# Po opt-in: pouze jediny skutecny UUID, ne odhad nebo vygenerovana hodnota.
$Session = Read-Host 'Skutecny jediny T5 session UUID'
$Observe = node $Helper sql $Cohort $Session observe | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_SQL_SCOPE' }
$Final = node $Helper sql $Cohort $Session final | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_SQL_SCOPE' }
$SubmittedAtMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() # tesne pred jedinym UI send
# Nize jen po skutecnem send; nejvyse tri manualni final reads uvnitr drain deadline.
Invoke-T5Command @('d1','execute','apu-ms-site-dev-telemetry','--remote','--config',$DbConfig,'--command',$Final,'--json') 't5-final-read-1' 10000
# Po 15s manualni neblokujici kontrole casu, pouze pokud to deadline dovoli:
Invoke-T5Command @('d1','execute','apu-ms-site-dev-telemetry','--remote','--config',$DbConfig,'--command',$Final,'--json') 't5-final-read-2' 10000
```

Nejvýše třetí read je stejný pevný příkaz s novým stem `t5-final-read-3`. Pending SQL sampling není záruka lifecycle. `observe` je volitelné, nesmí nahrazovat raw trace ani vést k domyšleným pending záznamům. Lifecycle PASS vyžaduje pro každý call skutečný úspěšný pending→final write_ack (nebo skutečný časový SQL pár). Chybějící ack/SQL observation = lifecycle NOT VERIFIED i při final reconciliation PASS. D1 PK upsert znamená jeden účetní řádek na call; ACK není další účetní záznam.

Po úspěšné finalizaci + UI stop; `stopped_at` ověřit session read-backem. Export/import **před jakýmkoli cleanupem**:

```powershell
if ((Test-Path -LiteralPath $Paths.exportFinal) -or (Test-Path -LiteralPath $Paths.snapshotFinal)) { throw 'BLOCKED_EVIDENCE_EXISTS' }
Invoke-T5Command @('d1','export','apu-ms-site-dev-telemetry','--remote','--config',$DbConfig,'--table','telemetry_sessions','--table','telemetry_events','--table','telemetry_ai_calls','--output',$Paths.exportFinal) 't5-export-final-result' 15000
node $Helper snapshot $Paths.exportFinal $Paths.snapshotFinal $Cohort $Session $Repo
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_SNAPSHOT_PRESERVE_RESTORE' }
```

Helper provádí skutečný SQLite import, schema/scope/FK/integrity kontroly, SHA256 SQL/SQLite, striktní report target sidecar, exclusive paths; žádné nové schéma. Importovat jen právě autorizovaný export. Při neúplném exportu soubor zachovat jako NOT VERIFIED, nepřepsat. Nezdržovat restore importem, pokud nezbývá čas.

Po finalizaci/restore ukončit capture v druhém terminálu jedním Ctrl+C; počkat na sanitizovaný summary. V prvním terminálu vytvořit pouze pevný UI evidence soubor (obsah odpovědi neukládat):

```powershell
$Ui = Join-Path $Evidence 't5-ui.json'
if (Test-Path -LiteralPath $Ui) { throw 'BLOCKED_UI_EVIDENCE_EXISTS' }
# Tento true pouze pokud clovek skutecne videl prijaty Rozbor a tri presne browser cesty.
[IO.File]::WriteAllText($Ui,'{"ui_accepted":true,"browser_paths":["/api/extract","/api/need-route","/api/analysis"]}',[Text.UTF8Encoding]::new($false))
$ProviderEvidence = Join-Path $Evidence 't5-provider-evidence.json'
node $Capture --evidence (Join-Path $Evidence 't5-provider-trace.jsonl') $CaptureManifest $Ui $ProviderEvidence $Repo
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_CAPTURE_NO_T5_PASS' }
node $Helper verify $Paths.snapshotFinal $Cohort $Session $ProviderEvidence $Repo
# 0 reconciliation+lifecycle PASS; 2 reconciliation PASS/lifecycle NOT VERIFIED; 1 FAIL/BLOCKED.
if ($LASTEXITCODE -eq 2) { 'PARTIAL_LIFECYCLE_NOT_VERIFIED' }
elseif ($LASTEXITCODE -ne 0) { throw 'FAIL_OR_BLOCKED_RECONCILIATION' }
```

Evidence není ručně doplňovaná usage tabulka: capture helper ji odvodí pouze z hashově ověřených sanitizovaných raw boundary zpráv. Vyžaduje3–5unikátních ID a přesně jeden invoke+response pár, bez transporterror; uchová model/tier/attempt/raw numeric usage/tools. Final helper porovná kompletní ID množinu a počet s DB, provider_status/application_status/usage_source, nullable tokeny/součty/podmnožiny, session/tab/cohort/workflow/operation ownership, request/fallback vazby, snapshot ceny/cost/usage_coverage a všechny identity_json/projection_json/event_json allowlisty. Neobsahuje prompt/odpověď/e-mail/secrets/provider IDs. Úmyslně chybná ledger usage v lokálním testu nemění trace; při skutečném nesouladu je FAIL. Chybějící capture/lifecycle není falešný PASS.

CSV až po skutečně uzavřeném Europe/Prague dni, na chráněné pracovní kopii snapshotu, existujícím `scripts/telemetry/report.ts export` s `mode=operator-snapshot`, `test-class=tester`, skutečným cohort/date/as-of a linkage unavailable. Je to samostatný pozdější reviewovaný krok, ne podmínka držet hosted sběr ON. Nevymýšlet budoucí as-of, neobcházet guardy, nečekat blokující smyčkou. SQL lze ověřit ihned. Retenci snapshotů a jejich konečné smazání musí zvlášť schválit člověk.

## 8. Bounded stop/restore, pending retention a cleanup

Člověk odpovědný za closure musí být přítomen už před ON. Limit okna10min od `$ActivatedAtMs`; drain deadline=min(send+120s,activation+510s). Evidence nejvýše30s, restore nejvýše60s. Žádný hard expiry/watchdog/spending cap se nezavádí. Posun hodin nebo zmeškané monotonic stopky = failure, emergency restore bez čekání. Při dlouhém ON deploy je čas už spotřebován, neobnovovat T0.

```powershell
$SubmittedArg = '-'
if (Get-Variable SubmittedAtMs -ErrorAction SilentlyContinue) { $SubmittedArg = $SubmittedAtMs }
# Pending musi byt skutecny SQL pocet; neznamy stav je failure, nikoli nula.
$Decision = node $Helper window $ActivatedAtMs $SubmittedArg ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) $Pending | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_CLOCK_EMERGENCY_RESTORE' }
# action SNAPSHOT_STOP_RESTORE_NOW => zadne dalsi drain/AI/retry.
```

Při stage-only failure není sběr ON: nepoužít `window` bez activation timestampu; pokračovat přímo guarded rollbackem s60s stage-only rozpočtem. Při timeoutu deploy bez doloženého nového version ID je closure **BLOCKED_UNKNOWN_DEPLOYMENT**; žádný blind rollback. Zachovat výhradní okno, žádný provider send; člověk musí zvlášť ověřit aktuální immutable version/config. To je control-plane failure, nikoli povolení agentovi vymýšlet opravu.

**Failure/pending větev:** žádná další AI akce/re-opt-in. Pokud zbývá evidence budget, jednou bounded D1 export přes `Invoke-T5Command`15s do `$Paths.exportFailure` (stejný pevný export argv §7, jiný output a stem `t5-export-failure-result`). Import do `$Paths.snapshotFailure` jen uvnitř zbývajícího30s budgetu. Uchovat pending IDs/počty/časy/trace; při export failure zachovat poslední SQL a DB data bez cleanupu. Export ani import nesmějí odložit restore. UI stop jednou (nejvýše5s, failure neblokuje restore); není-li UI dostupné, zavřít testovací panel. Neprohlašovat tím zrušení provider volání nebo nulový náklad.

Před rollbackem fresh read-only deployment guard: právě schválený aktuální T5Version/100% (nebo StagedVersion, pokud ON nikdy nenastal); již baseline100% znamená rollback přeskočit a udělat finální read-back. Cizí verze/traffic = žádný blind rollback, closure BLOCKED/incident. Nepřečítat celý metadata balík na úkor deadline: pevný Wrangler read, bounded10s, výsledek jen v restricted souboru:

```powershell
$GuardOut = Join-Path $Evidence 't5-restore-deployments.json'
$CurrentTestVersion = $StagedVersion
if (Get-Variable T5Version -ErrorAction SilentlyContinue) { $CurrentTestVersion = $T5Version }
# Pevny read-only prikaz; obdobne jako Invoke-T5Command, ale vlastni presny target-only config:
Invoke-T5Command @('deployments','list','--name','apu-ms-site-dev','--config',$Paths.restoreConfig,'--json') 't5-restore-deployments' 10000
# Instalovany deployments list --json vraci pole; guard zvoli nejcerstvejsi created_on, nikoli prvni radek.
$RestoreGuard = node $Ops --guard-deployment $GuardOut $CurrentTestVersion $Repo | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_FOREIGN_OR_UNKNOWN_VERSION_NO_BLIND_ROLLBACK' }
# Pri ALREADY_BASELINE_READBACK_REQUIRED preskocit rollback a prejit na nezavisly read-back nize.
# Pri EXCLUSIVE_T5_VERSION_GUARD_VERIFIED provest prave jeden nasledujici rollback.
$CloseBy = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + 60000 # stage-only OFF restore
if (Get-Variable ActivatedAtMs -ErrorAction SilentlyContinue) { $CloseBy = $ActivatedAtMs + 600000 }
$RestoreLog = Join-Path $Evidence 't5-restore-result-attempt1.jsonl'
if ($RestoreGuard.status -eq 'EXCLUSIVE_T5_VERSION_GUARD_VERIFIED') {
  node $Helper execute-reviewed-restore $Cli $Paths.restoreConfig $RestoreLog $Repo $CloseBy T5_PRESERVING_AND_10220_REVIEWED EXCLUSIVE_T5_VERSION_GUARD_VERIFIED
  if ($LASTEXITCODE -ne 0) { 'RESTORE_UNCONFIRMED_NO_CLEANUP_NO_CLOSURE_PASS' }
}
```

`execute-reviewed-restore` je pouze explicitní budoucí autorizovaný executor, pinned CLI, pevný rollback732bf950…/100%, target-only config, min(60s,zbývajícíčas), přímý Node kill bez raw stdout/stderr. Při již překročeném deadline povolí jeden emergency60s pokus a zaznamená deadline_missed; to není SLA PASS. `--yes` zahrnuje10220 force retry pouze po review, že secret delta je výhradně dvě T5 keys. Žádný automatický druhý deployment/provider pokus. Command success stále **není hosted closure PASS**.

Nezávislý finální read-back:

```powershell
$Restored = Join-Path $Evidence 't5-restored-readback.json'
node $Reader --execute-authorized-read $Paths.restoreConfig $Inputs $Restored $Repo $Cli
if ($LASTEXITCODE -ne 0) { throw 'RESTORE_NOT_VERIFIED_NO_CLEANUP' }
node $Ops --verify-restore $Restored $Baseline $Repo
if ($LASTEXITCODE -ne 0) { throw 'RESTORE_CONTRACT_NOT_VERIFIED_NO_CLEANUP' }
```

Po návratu původní verze ověřit v normálním DEV browseru `/api/session`200/isDeveloper:true, telemetry/metadata0/0, žádný nový opt-in a původní TTL86400. Baseline code neobsahuje nový trace. API context musí být disabled; browser session/consent lokálně stopped nebo testovací panel zavřený. Při nedostupném control plane/outputu potvrzení chybí: **runtime closure NOT VERIFIED**, žádné další provider akce/cleanup, eskalovat člověku s chráněnými evidence; nelze slíbit technicky vynucené OFF při výpadku. Vyžaduje-li schvalovatel takovou garanci, neaktivovat.

Pending data z failure snapshotu nikdy nemazat. Po restore lze samostatně autorizovaným bounded D1 čtením/exportem do `$Paths.exportAfterRestore`/`$Paths.snapshotAfterRestore` uchovat pozdní finalizace; původní failure snapshot nepřepisovat. Starý waitUntil může doběhnout po změně traffic/stop, proto pozdější stav nefalšuje původní observation. Obnova runtime, final reconciliation, lifecycle evidence a retained pending mají čtyři samostatné stavy.

**Cleanup není součást autorizace přípravy:** až po úspěšném chráněném snapshotu,0pending, stopped_at, runtimeOFF a zvláštním schválení. `node $Helper sql $Cohort $Session cleanup` generuje přesný cohort+tester+session scope, child-before-parent, stopped/pending guardy. Nikdy broad delete, receipt/KV write, DDL nebo automatický retry DELETE. Při retained pending žádný cleanup. D1 schema i migrace zůstávají beze změny.

## 9. PASS / FAIL / BLOCKED a lokální důkazy

| Stav | Podmínka |
| --- | --- |
| SOURCE PASS | Provider-free tests, raw trace independence/privacy/gates, successful-write ACK, pinned Wrangler inherit proof, strict config/readback a normal/failure restore doubles, typecheck/lint/canonical build/artifact/isolation. Nepotvrzuje hosted. |
| Hosted T5 PASS | Jediný přijatý UI průchod, všechny raw call páry a DB rows3–5shodné, completed/accepted/provider_reported a observed usage/cena/privacy/ownership, každý skutečný pending→final důkaz, snapshot před cleanupem a nezávislá baselineOFF/OFF/developer closure. |
| PARTIAL / NOT VERIFIED | Reconciliation může být PASS, ale chybí Tail/lifecycle nebo finální closure; žádné domyšlené údaje. Native Windows/Node22/hosted nebyly touto dávkou provedeny. |
| FAIL / BLOCKED | Skutečný nesoulad kontraktu, nepřijatý výsledek, neznámá config/metadata shape, cizí target/writer, chybějící autorizace/capability nebo nedoložené rollback okno. Žádný retry/improvizace. |

Přesný nový source SHA, příkazy a výsledky aktuální source verifikace jsou v odvozeném Draft PR. T3/T4 se nepřetestovaly. Žádná hosted/provider/Cloudflare/D1/KV operace nebyla vykonána; žádné credentials, resources, deployment, merge ani PUBLIC změna. Provider E2E a PUBLIC readiness zůstávají otevřené.

### T5-R2 lokální source ověření — 2026-10-29

Základ je přesný PR #90 HEAD `d796994829565208f503d3493b07b1d1a3b726e1`; nová odvozená větev `codex/t5-r2-provider-trace`, žádná změna původní větve. Linux/Node24.19.0/Wrangler4.150.0. Provedeno:

```sh
node --test --test-concurrency=1 tests/*.test.mjs
node --test tests/t5-worker-preparation.test.mjs tests/t5-tail-capture.test.mjs tests/t5-provider-trace.test.mjs tests/t5-handoff.test.mjs
npm run typecheck
# Cileny eslint: zmenene app/API/telemetry soubory, oba ops nastroje,
# t5-evidence/t5-tail-capture a pet zmenenych T5/stream test souboru.
npm run build
npm run validate:artifact
node tests/browser/telemetry/check-isolation.mjs
git diff --check
```

Celá provider-free Node sada **1580/1580 PASS**, bez SKIP. Po následném zpřesnění restore guardu cílená T5 sada **71/71 PASS**; po doplnění guardu nepodporovaných script settings ještě config sada **25/25 PASS**. Typecheck a focused lint PASS. Canonical build/standalone artifact PASS; source/artifact isolation se ověřuje také pro finální commit, výsledky a SHA v Draft PR. Build a runtime-sensitive testy běží odděleně. Testy skutečně používají emulovanou SQL DB, raw provider fixtures, pinned Wrangler form functions a process/GET doubles. Žádný reálný provider/Cloudflare executor nebyl spuštěn.

Původní strict DEV preparer, produkční/DEV templates, SQL migrace, dependency versions, Access/pilot rules a klientská business cesta jsou proti PR #90 beze změny. Aplikační delta je pouze gated raw transport trace, jeho request-scoped předání a post-commit diagnostic ACK; jde o **nový source**, nikoli shodu s d706. Native Windows/PowerShell/Node22, skutečné baseline metadata/read-back, Tail/provider T5 a hosted restore **NOT VERIFIED**. SOURCE PASS nedává hosted autorizaci ani neuzavírá T5/PUBLIC readiness.

### Oprava PR #91 — oddělení aktivní baseline a posledního uploadu, 2026-10-30

Přesný výchozí SHA `e07564553e403f776399c872830f40209857a409`. Změna je omezena na T5 preparer, read-only preflight, jejich testy a tento runbook; aplikační/runtime/SQL source se nemění. Nová regrese skutečně projde reader → prepare → fresh guard pro aktivní baseline po rollbacku a odlišné kompatibilní latest. Nepovolené resource/secret bindings, runtime nekompatibilita, změna schváleného latest a souběžné změny preflight katalogu/metadata/deploymentu/settings znamenají STOP. Pinned CLI test provádí skutečnou vyjmutou standardní upload větev pouze proti HTTP double a dokládá inherit bez explicitní zdrojové verze. Lokální provider-free regrese `node --test tests/t5-worker-preparation.test.mjs tests/t5-handoff.test.mjs tests/dev-worker-preparation.test.mjs`: **243/243 PASS**, bez SKIP; `npm run typecheck`, focused ESLint obou ops souborů a jejich testu, `git diff --check`: **PASS**. Přesný opravný commit je v PR #91. Historických 1580 regresí ani canonical build/artifact z e075 se tato lokální ops oprava nedovolává jako nového běhu; aplikační source je beze změny. Native Windows a hosted kroky zůstávají NOT VERIFIED, žádná nová autorizace.

### Oprava PR #91 — D1 metadata database_id, 2026-10-30

Výchozí SHA `ffb1092c56f226ae841328a775cb656b96187a87`. Syntetický `database_id` scénář před opravou skutečně reprodukoval `BLOCKED_UNEXPECTED_FIELDS`; po opravě příprava/read-back přijímají `id`, `database_id` a obě shodná pole, včetně rozdílných reprezentací baseline/latest. Konfliktní/nesprávná/neplatná/chybějící identita a neznámé pole znamenají bezpečný STOP. Testy ověřují nezměněné raw metadata/hash i odmítnutí raw freshness změny se stejným normalizovaným UUID; skutečný lokální CLI vypíše pouze D1 error code bez hodnot.

```sh
node --test tests/t5-worker-preparation.test.mjs tests/t5-handoff.test.mjs tests/dev-worker-preparation.test.mjs
node --test tests/t5-worker-preparation.test.mjs
node_modules/.bin/eslint ops/dev/prepare-t5-worker.mjs tests/t5-worker-preparation.test.mjs
node --check ops/dev/prepare-t5-worker.mjs
git diff --check
```

Cloud Linux/Node24.19.0/pinned Wrangler4.150.0: **258/258 kombinovaných regresí PASS**, poté finální cílená sada s doplněnými smíšenými aliasy **53/53 PASS**, bez SKIP; focused lint/syntax/diff PASS. Pinned `convertBinding` byl skutečně vyjmut a vykonán lokálně, bez Wrangler executor/API volání. Aplikační source/SQL/dependencies/templates se nezměnily; canonical build ani typecheck se v této ops opravě znovu nevykonávaly. Operátorský Windows build/reader výsledek je samostatná převzatá evidence §5.1, nikoli Cloud ověření nového SHA. Opravené Windows pokračování je **NOT VERIFIED**; žádné hosted operace, provider calls, deployment, merge nebo PUBLIC změna.

## 10. Historická evidence — nepřebírat jako nový T5-R2 PASS

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
