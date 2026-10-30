# Nový DEV provider kandidát — příprava, ne deployment

Změna strategie nad PR92 `030cbe530bb85f168623bddc8d68558f3238eb20`. Hledání exact-copy staré aktivní verze je ukončeno. Vzniká **nový canonical server/client artifact ze schváleného T5 source**; žádná binární shoda se starým Workerem se netvrdí. Původní Windows raw snapshot/read-before BLOCKED_LATEST_NOT_ACTIVE a prázdná inventory jsou historická evidence. Neodvozujeme příčinu active/latest rozdílu a neopakujeme T3/T4 ani obecný audit.

Tato dávka dovoluje pouze source/local přípravu. Nyní žádný hosted read, secrets write, upload, deploy, provider request, telemetry ON nebo rollback. Hodnoty provider secrets zůstanou jen u Windows operátora a po budoucím výslovně autorizovaném deployi v určeném DEV secret storage; nikdy v chatu, Git nebo Codex Cloud, nikdy z PUBLIC.

## Přesný kontrakt a zamýšlený diff

Samostatný `prepare-provider-candidate.mjs`, bez oslabení původního `preflight()`/T5 guardů:

| Proti přesné aktivní baseline732bf950… | Výsledek |
| --- | --- |
| Aplikační kód a ASSETS obsah | Nový server/client z canonical build na reviewovaném source SHA, manifest s hashes. ASSETS obsah se může změnit; neprohlašovat byte equality se starým deployem. |
| Provider secret bindings | Přesně dva nové: OPENAI_API_KEY a APU_VECTOR_STORE_ID. Hodnoty nejsou součástí configu/review. |
| Plain vars | Přesně úplný map z aktivní baseline, `vars_changed:[]`; žádné převzetí vars latest. Access audience/issuer, developer role, local auth0, TTL86400 i telemetry/metadata0/0 se musí shodovat s původními validovanými inputs. Trace musí být0 nebo absent (v novém source default OFF); review rozlišení výslovně uvádí. Žádné doplnění enrollment/notice/privacy override nebo telemetry keys. |
| KV/D1/ASSETS identity a chování | Stejné schválené dvě KV, EU telemetry D1 a ASSETS binding/config; migrace beze změny. Nepovoluje se provisioning ani remote migrations. |
| Compatibility/settings/routing | Zachovat compatibility date/flags a active observability/logpush/placement/tail/limits/cache; stejné workers.dev enabled:true a explicitní preview_urls podle reviewované aktivní baseline (true i false), žádné public routes/domains/schedules. Unknown fields/identity mismatch = STOP. |
| Upload instrukce | **keep_vars:false s úplným explicitním configem**; nepoužít --keep-vars. To není starý neúplný preserving patch: všechny aktivní vars jsou dodané a z latest se žádné plain vars nedědí. Nový source tag/version UUID jsou nové deployment bookkeeping. |

Latest se nenasazuje ani nekopíruje. Jeho known bindings/identity se validují a whole metadata/hash se reviewuje; **active secret set a aktuální inventory musí být prázdné; latest smí mít nejvýše dvě provider položky, které se obě povinně explicitně přepíšou**. Důvod: pinned Wrangler deploy vždy používá keepSecrets:true. Jakýkoli nedodaný/ostatní secret v latest proto STOP; neprovádět delete nebo přepsání guardu. Neznámé plain vars latest také STOP. Latest může mít jiný kód nebo známý trace flag1: úplný config keep_vars:false ho nepřevezme. Jeho source není kandidátní artifact. Původní provider hodnoty latest se nezískávají ani nekopírují; obě dodané hodnoty musí pocházet od operátora ze schváleného DEV projektu.

Pinned Wrangler4.150.0/CLI hash `71da1f9bcf69a9f56c4ff4f68e71315365d03db8ea11207577b47a8e1a0a1064`: standardní `deploy --secrets-file` převádí dodané hodnoty na explicitní secret_text před required/inherit krokem. Obě required provider položky jsou dodané, takže žádná z nich není inherit. Actual upload form test ověřuje keep_bindings pouze pro secret typy (žádné plain/json), přesně dvě explicitní provider položky, beze změny všech aktivních vars. Standardní deploy **uploaduje a aktivuje**, není to oddělený neaktivní hosted staging. Oddělujeme lokální přípravu/review od budoucí explicitně autorizované aktivace; nevymýšlíme exact-copy API.

## Cílený script-settings důkaz — nový reader a oddělený zdroj

Operátor nad `10d2a28d3562258f5484691b92d4ce4cb0071ac6` doložil **32 PASS a jedinou chybu settings.observability/BLOCKED_OBSERVABILITY_EVIDENCE_REQUIRED**; existující artifact má source SHA `a7293a21e255b1049e244a4c27f09aff450aa772`. Neprovádíme nový build, inventuru, T3/T4 ani obecnou diagnostiku. Níže je připravené budoucí cílené čtení; v této source/local dávce se skutečný GET **nespouští** a jeho výsledek není známý.

Nový `ops/dev/read-provider-script-settings.mjs` má právě jeden pevný HTTP cíl:

`GET https://api.cloudflare.com/client/v4/accounts/4638092f63fa7fe58bcb9d2d041b7855/workers/scripts/apu-ms-site-dev/script-settings`

Používá stejný zavedený mechanismus jako baseline reader: pinned Wrangler `auth token --json --config <původní exact DEV target>` jako omezený child process (10s, stdout jen v Node paměti, stderr ignorovaný). Žádný login, whoami, inventory, provider secrets, retry, alternativní endpoint ani redirect. Samotný GET má timeout10s, redirect:error; token neopouští paměť ani se neukládá do evidence. stdout/stderr autentizačního příkazu se do terminálu nepřeposílá.

Reader před autentizací rezervuje **nový** restricted soubor pomocí wx/0600; existující soubor/symlink = STOP bez GET, nic nepřepisuje. Uloží obal `apu-dev-script-settings-read` s pevným účtem/Workerem/endpointem/GET, source SHA readeru, pinned CLI hash, původním read_started_at/read_at, HTTP status a **nezměněným response textem v raw_body**. Žádná vazba na staré Worker UUID: observability je non-versioned script-level stav. Původní before.json, jeho timestamp ani starý build manifest se nemění. API chyba/missing/null zachová raw odpověď; auth/network failure může zanechat neúplný rezervovaný soubor, který je pouze evidence chyby, nikoli platný sidecar. Žádný automatický retry/overwrite/cleanup.

Terminál obsahuje pouze bezpečný status, checked_at, cestu evidence a `explicit_observability_enabled_boolean` (existence boolean pole, **nikoli jeho hodnota**). Při chybě nevypisuje API messages, raw metadata, token ani stack. Boolean true sám není schema/contract PASS; např. nepovolené pole může stále způsobit STOP.

### Jeden soběstačný Windows blok — pouze cílený GET, až po autorizaci tohoto readu

Použije **existující** bootstrap-local-profile.json z dokončeného Windows setupu: původní uložené repo, target a evidence adresář se převezmou z něj, žádný nový setup/build ani vymyšlené C:\ cesty. Starý profil se zde používá jen pro ověřené cesty, ne pro tvrzení o novém artifactu: jeho historické sha/node/artifact se nepřeznačuje. Reader ověří přesný aktuální reviewovaný source/root/remote, profil identity, target hash/exact DEV config a pinned CLI. Windows ACL existujícího evidence adresáře musí zůstávat pouze pro operátora; mode0600 nenahrazuje kontrolu Windows ACL.

```powershell
$ErrorActionPreference='Stop'
$Profile=(Resolve-Path -LiteralPath (Read-Host 'Existujici bootstrap-local-profile.json z dokonceneho T5 setupu')).Path
$OldProfile=Get-Content -LiteralPath $Profile -Raw | ConvertFrom-Json
if ($OldProfile.kind -ne 'apu-provider-bootstrap-local-profile') { throw 'BLOCKED_PROFILE_IDENTITY' }
$Repo=(Resolve-Path -LiteralPath $OldProfile.repo).Path
$Sha=Read-Host 'Presny plny reviewovany SHA noveho readeru v PR93'
$Reader=Join-Path $Repo 'ops/dev/read-provider-script-settings.mjs'
node $Reader --execute-profile-read $Repo $Sha $Profile
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_SCRIPT_SETTINGS_REVIEW_PRESERVE_EVIDENCE_NO_RETRY' }
# STOP. Zadny dalsi read, build, setup, secrets, upload ani deployment.
```

Jde o jeden JSON objekt profilu, nikoli problémový PowerShell inventory array postup. Reader sám odvodí nový výstup `<původní profile.dir>/script-settings-review.json`; celé původní profily/inputs/proposal/evidence zůstanou. Existuje-li výstup již nyní, STOP před autentizací; nezadávat další diagnostické kolo nebo jej přepsat. Případnou chybu řešit odděleně nad chráněnou evidencí, ne retry smyčkou.

### Zapojení do offline review, fresh preflight a read-backu

- Offline kontrola přijímá sidecar jako poslední argument: `offline-check <repo> <reviewovaný-source-SHA> <before.json> <inputs> <existující-dist/server/wrangler.json> <script-settings-review.json>`. Žádný nový build/profil. Explicitní observability se bere **povinně z tohoto endpointu**, nikoli ze starého version UUID nebo template; source absent/null/bez boolean enabled zůstává BLOCKED. Schema/unknown fields se dál validují. Logpush/tail metadata, která historický snapshot obsahuje, musejí se zdrojem souhlasit; žádné rozšíření ostatních nastavení.
- Raw snapshot se nespojuje ručním přepisem. Offline report i candidate review mají dva odlišné původy: původní snapshot hash/read_at a script_settings_source endpoint/method/source_sha/read_started_at/read_at/hash. Pro projekci se použije kopie se zdrojově doloženým observability; raw objekty/timestamps se nemutují. Explicitní dřívější observability musí souhlasit, neznámé obs pole se nikdy neodhaduje false. Historický sidecar není fresh oprávnění k zápisu.
- Budoucí `prepare` vyžaduje `<historical-before.json> <script-settings-review.json>`. Do review uloží i původní restricted cestu a hash sidecaru. Změněný sidecar po review = STOP.
- Budoucí autorizovaný `fresh-read` zachová všechny původní read-only baseline/inventory guardy a **navíc** jednou spustí stejný cílený reader do nového `candidate-fresh-script-settings.json`. Raw baseline/inventory i raw script-settings zůstanou samostatné. Výsledek endpointu se musí přesně shodovat s reviewovaným script-settings result; původní raw baseline se musí také shodovat. Žádné převzetí neověřené latest.
- Fresh settings GET musí začít až po baseline/inventory čtení; zachovává60s freshness a maximálně10s odstup timestampů. Zastaralý/předchozí sidecar nepoužít. `future-plan` ověří znovu obě evidence, neměnnost reviewovaného sidecaru i regeneraci celého configu. Každá změna/missing/null = STOP.
- Budoucí autorizovaný `hosted-readback` zachová metadata kontroly a načte **tentýž script-settings endpoint čerstvě znovu** do `candidate-after-script-settings.json`, až po novém deployment metadata/inventory čtení. Porovná explicitní projekci s reviewovaným configem; předdeployový sidecar jej nenahradí. Offline readback signature je `<snapshot> <actual-version-UUID> <candidate-after-script-settings.json>`.

Tato dávka pouze implementuje a lokálně testuje postup. **Žádný GET ani nový build nyní nebyl proveden.** Po skutečném operátorském cíleném readu musí nejprve celý offline kontrakt PASS; teprve samostatný navazující krok smí provést nový canonical build na skutečném novém SHA, nový profile a prepare do nových výstupů. Dosavadní artifact/manifest zůstává pravdivě historický. OFF/OFF/trace OFF, Access, developer, KV/D1/ASSETS a původní bootstrap/T5 guardy se nemění. Preview Access a hosted kandidát nadále NOT VERIFIED.

## Historická settings correction — diagnóza zůstává platná; sidecar integrace je výše

Operátor doložil Windows build/setup na `a7293a21e255b1049e244a4c27f09aff450aa772` PASS a prepare BLOCKED_SETTINGS. Historické settings obsahuje pouze boolean logpush (hodnota není publikována) a tail_consumers:null, **observability chybí**. Raw before.json ani jeho hash se nepřepisují. Následující stav nahrazuje dřívější pokyn rovnou opakovat fázi A: **nejprve offline-check, při BLOCKED žádný nový build/setup/prepare**.

Primární kontrakty a skutečné pinned chování:

- [Cloudflare SDK5.2.0 ScriptSetting (OpenAPI-generated)](https://github.com/cloudflare/cloudflare-typescript/blob/v5.2.0/src/resources/workers/scripts/scripts.ts): logpush je optional boolean; observability a tail_consumers jsou optional/nullable. Optional/null nejsou důkazem konkrétního efektivního observability.enabled. Žádná rovnost absence = false se nepředpokládá.
- [SDK script-settings GET/PATCH](https://github.com/cloudflare/cloudflare-typescript/blob/v5.2.0/src/resources/workers/scripts/settings.ts): script-level settings jsou non-versioned. Verze ani rollback samy tento kontrakt nenahrazují.
- Pinned Wrangler4.150.0, CLI SHA256 výše: createWorkerUploadForm vynechává undefined settings a null tail; explicitní logpush true i false zachovává. deployWorker následně volá patchNonVersionedScriptSettings s `observability:worker.observability ?? {enabled:false}`. Proto **vynechání observability v configu není preserving mechanismus** a template observability:false nesmí nahradit chybějící důkaz.
- Pinned normalizace configu nemá tail_consumers ani logpush fallback (notInheritable/inheritable s undefined). Při vynechaném tail_consumers upload i JSON PATCH pole vynechají; nemění se jeho hodnota. `null` proto projektujeme **jen pro tail_consumers** vynecháním config pole, nikoli vymyšleným [] nebo tvrzením, že null je potvrzený prázdný seznam. Chybějící raw tail také zůstává vynechaný; explicitní podporované pole se přenáší přesně. Žádné obecné odstranění null hodnot.

| Raw settings | Konfigurační projekce / výsledek |
| --- | --- |
| explicitní podporované observability s boolean enabled | přesná kopie, žádné doplnění defaultů |
| observability absent/null/bez boolean enabled | BLOCKED_OBSERVABILITY_EVIDENCE_REQUIRED |
| boolean logpush | přesně true/false; skutečná hodnota pouze v private evidence |
| tail_consumers:null nebo absent | konfigurační pole vynechat; upload/PATCH jej nepřenáší |
| explicitní podporovaný tail seznam / ostatní podporované settings | přesná kopie, validace pinned config-schema |
| unknown fields / nepodporovaný tvar, včetně jiných null | STOP, neodhadovat převod |

Nový helper odděluje nezměněný raw settings_sha256 od settings_projection v review. Před projekcí odstraní všechna settings pole template, aby nevniklo observability:false z template. Fresh preflight stále porovnává **raw** settings přesně včetně presence/null. Read-back validuje stejnou striktní projekci; přepnutí boolean, změněný tail seznam nebo neznámé pole STOP. Neodhadnuté optional defaulty se do configu nedoplňují. Skutečné pinned upload/PATCH funkce byly spuštěny jen lokálně s doubles; žádná API operace.

### Právě jeden chybějící read-only údaj

Chybí **úplný explicitní efektivní objekt result.observability** pro přesný DEV Worker ze zdroje:

`GET /accounts/<ověřený DEV account>/workers/scripts/apu-ms-site-dev/script-settings`

To je jeden cílený script-settings údaj, ne nový obecný audit a ne další build. Reader původního before.json promítal environment.script, který jej neposkytl; historický snapshot se nepovažuje za důkaz disabled. Žádné čtení se nyní neprovádí. Případné získání vyžaduje samostatně autorizovaný read-only krok a chráněný raw sidecar; původní before.json zůstane nedotčený. Jestli i tento zdroj vrátí absent/null, efektivní nastavení zůstává **NOT VERIFIED / BLOCKED**, nikoli false. Bez review důkazu prepare dál odmítá postup; aktuální implementované zapojení samostatného sidecaru je popsáno výše, bez override či ručního editování snapshotu. Nebyl prokázán efektivní observability stav reálného Workeru.

### Soběstačný Windows blok — jen existující soubory, žádný build

Po review opraveného SHA aktualizovat existující source worktree běžným schváleným source postupem. Zachovat staré dist/manifest, inputs, target, proposal, všechny profily a before.json. Tento blok **nevyžaduje nový setup ani profil navázaný na nové SHA**, nevolá Wrangler CLI/API, nic nezapisuje. Výstup obsahuje pouze pevná jména kontrol, status/kódy a source SHA historického buildu, nikoli resource hodnoty či celé JSON struktury. `$Artifact` musí být existující canonical dist/server/wrangler.json v tomto worktree.

```powershell
$ErrorActionPreference='Stop'
$Repo=(Resolve-Path -LiteralPath (Read-Host 'Existujici aktualizovany reviewovany source worktree')).Path
$Sha=Read-Host 'Presny plny reviewovany SHA settings correction v PR93'
$Historical=(Resolve-Path -LiteralPath (Read-Host 'Puvodni existujici before.json s Node inventory')).Path
$Inputs=(Resolve-Path -LiteralPath (Read-Host 'Puvodni existujici validovane DEV inputs')).Path
$Artifact=(Resolve-Path -LiteralPath (Join-Path $Repo 'dist/server/wrangler.json')).Path
$Settings=(Resolve-Path -LiteralPath (Read-Host 'Existujici chráněný script-settings-review.json z cíleneho readu')).Path
$Candidate=Join-Path $Repo 'ops/dev/prepare-provider-candidate.mjs'
node $Candidate offline-check $Repo $Sha $Historical $Inputs $Artifact $Settings
if ($LASTEXITCODE -ne 0) { throw 'OFFLINE_CONTRACT_BLOCKED_NO_BUILD_NO_HOSTED_ACTION' }
# I OFFLINE_CONTRACT_PASS_NOT_PREPARED znamena STOP pred novym buildem/prepare.
# Nejprve review celeho souhrnu a teprve potom samostatne povolit lokalni fazi A.
```

`offline-check` vyhodnocuje stejné fáze jako strict prepare: active/latest, routing, inventory, OFF inputs/DEV preparer, active/latest bindings a isolation, D1 EU, Access/plain vars/developer/trace/TTL, runtime, jednotlivá settings, ASSETS, source/artifact path a dostupnou konfigurační schema projekci. Nálezy vrací souhrnně (`issues`, exit1). Poškozený JSON a neočekávané chyby vracejí bezpečné kódy bez hodnot. Nelze-li odvozenou kontrolu provést kvůli předchozí chybě, je **NOT_CHECKED/BLOCKED_DEPENDENCY**, nikdy falešný PASS. Strukturální schema projekce může projít i bez unresolved setting, jeho samostatná chyba ale blokuje celkový PASS i prepare. Source/root/remote, private paths a pinned Wrangler jsou ověřované; trust/path chyba může ukončit zpracování před načtením dat.

Historický build je pouze vstup pro offline kontrakt, ne nový kandidát. Report odděleně uvede artifact_provenance; OFFLINE_CONTRACT_PASS_NOT_PREPARED není artifact provenance/hosted PASS ani autorizace zápisu. Finální prepare stále vyžaduje nový skutečný canonical build na finálním SHA, odpovídající artifact hashes a nový profil/adresář. **Žádný nový Windows build nyní nezadáváme**, protože explicitní observability důkaz chybí. Starý manifest nepřeznačovat. T3/T4 ani obecnou Windows diagnostiku neopakovat.

## Routing correction a lokální resume po BLOCKED_ROUTING

Windows canonical build a setup nad `55a86530edd85652aa50ea84105eaf8786305201` operátor doložil jako PASS; prepare skončil BLOCKED_ROUTING. Lokální diagnostika historického before.json doložila přesně `subdomain={enabled:true,previews_enabled:true}`, routes/domains/schedules prázdné, bez dalších subdomain polí. Žádné hosted mutace; tato dávka další hosted čtení neprováděla. Příčina: nový candidate helper svévolně vyžadoval preview false. Původní T5/bootstrap guardy zůstávají beze změny.

Nový candidate připouští pouze enabled:true a explicitní boolean previews_enabled, žádná další subdomain pole a stále pouze prázdné routes/domains/schedules. Review zaznamenává celý routing. Config explicitně nastaví `workers_dev:true` a **`preview_urls` přesně podle historické baseline**, nikoli libovolnou operátorskou volbu. Fresh preflight vyžaduje přesnou shodu s reviewovaným snapshotem, budoucí plán znovu regeneruje celý config; read-back vyžaduje stejnou hodnotu jako config. Přepnutí true↔false v kterékoli následné fázi = STOP.

Pinned Wrangler4.150.0 (CLI hash výše), config-schema.json definuje boolean `preview_urls`. `getSubdomainValues()` převádí config.preview_urls na wantPreviews; `subdomainDeploy()` posílá `POST .../subdomain` s `{enabled:wantWorkersDev,previews_enabled:wantPreviews}`. Deploy tedy tuto vlastnost **řídí**; nespoléháme na implicitní default ani nevymýšlíme config.previews_enabled. Lokální test spouští skutečné extrahované pinned funkce s API doubles pro obě hodnoty a kontroluje přesné tělo requestu; žádné HTTP se neprovádí.

**Zachování preview nastavení není ověření Access ochrany preview URL. Preview URL Access protection je NOT VERIFIED a zůstává samostatnou hosted bezpečnostní podmínkou před případnou autorizací aktivace.** Zachování Access vars a ochrany hlavní DEV URL tento důkaz nenahrazuje. Tato oprava preview URLs nezapíná ani nevypíná.

Následující routing resume platí až po celkovém offline-check PASS a vyřešení settings důkazu výše. Resume je pouze lokální fáze A níže: po review nového přesného SHA použít tentýž existující source worktree, původní validované inputs/target a nezměněný historický before.json. Vybrat jiný již existující prázdný restricted adresář; starý profil, review, proposal, logs i případné partial outputs zachovat. Žádný další diagnostický read-before. Blok A před canonical buildem kopíruje dosavadní dist včetně manifestu do nového evidence adresáře, poté provede **nový canonical build na novém SHA**, nový setup/profile a prepare do nového adresáře. Starý build manifest se nepřepisuje ručně ani nepřeznačuje na nový SHA. Nepoužívat starý profil s novým SHA nebo staré artifacts s novým profilem. Žádný blok B/C/D se nyní nespouští.

## A. Soběstačná lokální příprava — až po úplném offline PASS

Úplné Windows cesty v zadání nejsou. Vybrat skutečné **existující** cesty z dosavadního T5 handoffu; nevymýšlet nový kořen, nesahat na runtime checkout. `$Dir` je již existující nový prázdný restricted adresář mimo Git, ACL jen operátor. Původní snapshot/inputs/proposal i partial outputs zachovat. Historický **before.json** z dokončeného read-before obsahuje raw metadata + Node inventory i když následný guard skončil BLOCKED_LATEST_NOT_ACTIVE. Nepoužívat místo něj ručně doplněný raw snapshot bez inventory.

```powershell
$ErrorActionPreference='Stop'
$Repo=(Resolve-Path -LiteralPath (Read-Host 'Existujici aktualizovany reviewovany source worktree')).Path
$Sha=Read-Host 'Presny plny schvaleny SHA noveho candidate Draft PR'
$Inputs=(Resolve-Path -LiteralPath (Read-Host 'Puvodni validovane strict DEV inputs')).Path
$Target=(Resolve-Path -LiteralPath (Read-Host 'Puvodni t5-restore-target.json')).Path
$Historical=(Resolve-Path -LiteralPath (Read-Host 'Existujici historicky before.json s Node inventory')).Path
$Settings=(Resolve-Path -LiteralPath (Read-Host 'Existujici chráněný script-settings-review.json z cíleneho readu')).Path
$Dir=(Resolve-Path -LiteralPath (Read-Host 'Existujici prazdny restricted adresar pro novy candidate')).Path
if ((Get-ChildItem -LiteralPath $Dir -Force).Count -ne 0) { throw 'BLOCKED_OUTPUT_EXISTS' }
$Build=Join-Path $Repo 'ops/dev/prepare-t5-worker.mjs'
$Setup=Join-Path $Repo 'ops/dev/provider-bootstrap-operator.mjs'
$Candidate=Join-Path $Repo 'ops/dev/prepare-provider-candidate.mjs'
# Povinna offline brana PRED jakymkoli novym buildem, historicky artifact zachovat:
$Artifact=(Resolve-Path -LiteralPath (Join-Path $Repo 'dist/server/wrangler.json')).Path
node $Candidate offline-check $Repo $Sha $Historical $Inputs $Artifact $Settings
if ($LASTEXITCODE -ne 0) { throw 'OFFLINE_CONTRACT_BLOCKED_NO_BUILD' }
# Pred buildem uchovat drivejsi dist/manifest mimo repo, zadne preznaceni stareho source_sha:
if (Test-Path -LiteralPath (Join-Path $Repo 'dist')) { Copy-Item -LiteralPath (Join-Path $Repo 'dist') -Destination (Join-Path $Dir 'previous-dist') -Recurse }
node $Build --build $Repo $Sha
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_CANONICAL_BUILD' }
node $Setup setup $Repo $Sha $Inputs $Target $Dir
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_LOCAL_PROFILE' }
$Profile=Join-Path $Dir 'bootstrap-local-profile.json'
node $Candidate prepare $Profile $Repo $Sha $Historical $Settings
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_CANDIDATE_PREPARATION' }
# STOP. Review provider-candidate.review.json a private kompletni config, zadny hosted prikaz.
```

Node ověří přesný čistý source, root/remote, pinned CLI/Node, input/target/artifact paths/hashes, canonical build manifest/source SHA a celý artifact tree. Výstupy `provider-candidate.wrangler.json` a `.review.json` jsou exclusive, bez secret values. Review obsahuje intended_changes, vars_changed, flag stavy, raw active/latest hashes, resource hashes a manifest artifact hashes. Neznámé resource údaje se nenahrazují syntetickými. Žádný skutečný provider file se při Cloud testech nečte.

## B. Lokální předání hodnot — pouze budoucí Windows operátor

Nejmenší podporované předání: jeden UTF-8 JSON **mimo Git**, v předem schváleném restricted adresáři, obsahující přesně OPENAI_API_KEY a APU_VECTOR_STORE_ID, dvě nonempty strings, žádné null/delete/extra vars/nové řádky v hodnotě. Vytvoří ho pouze operátor lokálně; nic neposílá agentovi. Žádný secret put/bulk, PUBLIC key, environment dump nebo credentials v CLI args. Hodnoty neuvádět do transkriptu ani shell history. Oprávněný DEV project/key, jeho scope, vector-store project ownership/permissions a rozpočet jsou nyní **NEZNÁMÉ / NOT VERIFIED**.

Soubor připravit před fresh oknem a po samostatném schválení této práce s hodnotami. Lokální validace přes Candidate `validate-provider-file` vypíše jen status, nikdy values. Příprava souboru není secret publication ani povolení deploye. Jeho pozdější smazání/retenci určí operátor; žádný neověřený cleanup cest.

Budoucí samostatně schválený lokální Windows blok (v této úloze se nespouští), nezávislý na proměnných A:

```powershell
$ErrorActionPreference='Stop'
$Repo=(Resolve-Path -LiteralPath (Read-Host 'Existujici reviewovany candidate source worktree')).Path
$Sha=Read-Host 'Presny plny schvaleny candidate SHA'
$Profile=(Resolve-Path -LiteralPath (Read-Host 'Existujici profil faze A v restricted adresari')).Path
$Candidate=Join-Path $Repo 'ops/dev/prepare-provider-candidate.mjs'
$Destination=node $Candidate provider-file-path $Profile $Repo $Sha | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_LOCAL_SECRET_DESTINATION' }
# ACL restricted rodice musi byt overeny operatorem, hodnoty nikdy do transkriptu:
$Key=Read-Host 'Schvaleny DEV OPENAI_API_KEY (jen lokalne)' -AsSecureString
$Store=Read-Host 'Odpovidajici DEV APU_VECTOR_STORE_ID (jen lokalne)' -AsSecureString
$Stream=$null
try {
  $KeyText=[Net.NetworkCredential]::new('', $Key).Password
  $StoreText=[Net.NetworkCredential]::new('', $Store).Password
  $Json=@{OPENAI_API_KEY=$KeyText;APU_VECTOR_STORE_ID=$StoreText} | ConvertTo-Json -Compress
  $Bytes=[Text.UTF8Encoding]::new($false).GetBytes($Json)
  $Stream=[IO.File]::Open($Destination.path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  $Stream.Write($Bytes,0,$Bytes.Length);$Stream.Dispose();$Stream=$null
  node $Candidate validate-provider-file $Profile $Repo $Sha $Destination.path
  if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_LOCAL_PROVIDER_FILE' }
} catch { throw 'BLOCKED_LOCAL_PROVIDER_FILE_PRESERVE_NO_RETRY' }
finally { if($Stream){$Stream.Dispose()};$Json=$null;$Bytes=$null;$KeyText=$null;$StoreText=$null;if($Key){$Key.Dispose()};if($Store){$Store.Dispose()} }
# Zde STOP. Zadny hosted prikaz; chraneny soubor je jen lokalni predani.
```

.NET stringy nelze garantovaně vymazat; po dokončení lokální fáze zavřít vyhrazený PowerShell proces. Soubor zůstává pouze v chráněném adresáři operátora pro autorizovanou aktivaci. Invalid/partial soubor zachovat neveřejně, nepřepisovat automaticky; žádná hodnota se neodesílá v tomto bloku. Transkript/debug request-body logging zakázán.

## C. Budoucí aktivace — samostatná autorizace; nyní NESPOUŠTĚT

V jednom novém PowerShell procesu znovu explicitně inicializovat existující cesty, nic nepřebírat z paměti fáze A. Výhradní DEV writer okno a odpovědný operátor jsou podmínka. Historický snapshot není fresh preflight. Níže je reviewovatelný návrh **budoucího** souvislého preflight→plan→standard deploy bloku, ne povolení jej nyní provést:

```powershell
$ErrorActionPreference='Stop'
$Repo=(Resolve-Path -LiteralPath (Read-Host 'Existujici reviewovany candidate source worktree')).Path
$Sha=Read-Host 'Presny plny schvaleny candidate SHA'
$Profile=(Resolve-Path -LiteralPath (Read-Host 'Existujici bootstrap-local-profile.json z faze A')).Path
$Historical=(Resolve-Path -LiteralPath (Read-Host 'Stejny historicky before.json pouzity pro review')).Path
$SecretFile=(Resolve-Path -LiteralPath (Read-Host 'Schvaleny operator-only JSON se dvema provider hodnotami')).Path
$Candidate=Join-Path $Repo 'ops/dev/prepare-provider-candidate.mjs'
$Cli=(Get-Item -LiteralPath (Join-Path $Repo 'node_modules/wrangler/wrangler-dist/cli.js')).FullName
# Lokalni validace a vsechny dotazy na cesty pred fresh oknem:
node $Candidate validate-provider-file $Profile $Repo $Sha $SecretFile
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_LOCAL_PROVIDER_FILE' }
node $Candidate fresh-read $Profile $Repo $Sha $Historical
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_FRESH_REVIEW_NO_DEPLOY' }
$Dir=[IO.Path]::GetDirectoryName($Profile)
$Fresh=Join-Path $Dir 'candidate-fresh.json'
$DeployArgv=@(node $Candidate future-plan $Profile $Repo $Sha $Historical $Fresh $SecretFile | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_DEPLOY_PLAN' }
$Out=Join-Path $Dir 'candidate-deploy.stdout.txt'
$Err=Join-Path $Dir 'candidate-deploy.stderr.txt'
if ((Test-Path -LiteralPath $Out) -or (Test-Path -LiteralPath $Err)) { throw 'BLOCKED_OUTPUT_EXISTS' }
$Quoted=@($Cli)+$DeployArgv | ForEach-Object { if ($_ -match '["\r\n]') { throw 'BLOCKED_ARGUMENT' }; '"'+$_+'"' }
$p=Start-Process -FilePath (Get-Command node).Source -ArgumentList $Quoted -PassThru -NoNewWindow -RedirectStandardOutput $Out -RedirectStandardError $Err
if (!$p.WaitForExit(60000)) { $p.Kill(); if (!$p.WaitForExit(1000)) { throw 'PROCESS_UNCONFIRMED_NO_RETRY' }; throw 'DEPLOY_UNCONFIRMED_READBACK_REQUIRED' }
$p.Refresh()
if ($p.ExitCode -ne 0) { throw 'DEPLOY_FAILED_NO_RETRY_READBACK_REQUIRED' }
# I command success stale vyzaduje nezavisly read-back; zadny provider test.
```

Fresh collector používá jen původní read-only reader a Node parsing kompletního secret-list stdout, nic nepublikuje. Kontroluje unchanged reviewed active/latest/config/resources a původní freshness60s / odstup10s; jakákoli změna = STOP. Původní latest=active bootstrap helper se nevolá ani nemění. `future-plan` znovu ověří source/config/artifact hashes a exact secret-file schema a vrátí jen argv, bez hodnot. Profil inputs/target se používají ověřené, žádný default production deploy.

ARGV: `deploy --config <complete private config> --name apu-ms-site-dev --strict --tag dev-provider-<SHA> --experimental-provision=false --experimental-auto-create=false --secrets-file <operator-only JSON>`. **Žádné --keep-vars.** Pinned deploy má keepSecrets:true; proto je active secret set prázdný a latest smí obsahovat jen stejné dvě povinně dodané/přepsané provider položky; žádné jiné secrets se nesmějí zdědit. Pokud Worker zmizí nebo existuje jiný writer, proces nemá atomický lock; žádný blind retry či ruční obcházení strict conflict. Timeout lokálního procesu neodvolá již odeslaný remote upload/deploy. Read-back je povinný, žádný automatický rollback/delete nebo druhý pokus.

## D. Read-back a restore body

Samostatný autorizovaný read-back musí doložit skutečný nový single100% version UUID, source tag, přesně dvě provider secret names a celý očekávaný config/flags/resources/settings. Nezávisle ověřit původní API/ASSETS dostupnost a `/api/session`200/developer:true bez opakování T3/T4, bez provider/UI AI akce nebo telemetry opt-in. Zkontrolovat přímo JSON endpoint a statický asset určený build manifestem; neobnovovat starý UI workflow, který by mohl spustit automatickou AI operaci. Pinned deploy log + lokální manifest/plan hashes musí svázat upload s novým artifactem; samotný tag není kryptografický důkaz bytes. Secret inventory není důkaz funkčního OpenAI oprávnění ani provider E2E.

Samostatný read-only blok až po autorizované aktivaci; všechny cesty inicializuje znovu. Žádné vypisování secret-list raw stdout nebo PowerShell inventory array pipeline. Skutečný nový version UUID převzít z protected deploy output/deployment evidence, nikoli vygenerovat. Chybí-li nebo je deployment nejednoznačný, STOP/incident, žádný blind rollback. V této přípravné dávce se blok nespouští:

```powershell
$ErrorActionPreference='Stop'
$Repo=(Resolve-Path -LiteralPath (Read-Host 'Existujici reviewovany candidate source worktree')).Path
$Sha=Read-Host 'Presny plny schvaleny candidate SHA'
$Profile=(Resolve-Path -LiteralPath (Read-Host 'Existujici profil pouzity pro tento candidate deploy')).Path
$Version=Read-Host 'Skutecny novy single100% Worker version UUID z evidence'
$Candidate=Join-Path $Repo 'ops/dev/prepare-provider-candidate.mjs'
node $Candidate hosted-readback $Profile $Repo $Sha $Version
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_CANDIDATE_READBACK_NO_RETRY' }
# STOP pred T5/provider testem; metadata proof sam neni cele hosted overeni.
```

Collector používá původní reader s přesným expectedVersion a stejný Node parser inventory; vytváří pouze nové `candidate-after-raw.json`/`candidate-after.json`. Fresh timestamps se nepřeznačují. Helper vrací pouze **DEPLOYMENT_METADATA_VERIFIED_NOT_PROVIDER_E2E**, `new_t5_restore_version:null`. Lokální režim `readback` může stejnou validaci provést nad skutečným chráněným snapshotem. Žádný takový hosted snapshot nyní nemáme ani nevyžadujeme.

- Pre-change restore zůstává732bf950…: obnovuje původní stav s nedoloženou/chybějící provider konfigurací, nikoli provider-ready univerzální rollback. Secret-change force i rollback vyžadují zvláštní rozhodnutí/authorization.
- Nový T5 restore bod lze nominovat až po úspěšném hosted ověření artifact/config/session/OFF výše. Skutečný UUID dnes neznáme. Poté samostatný review baseline snapshotu a integrace T5 helperů; žádné ruční přepsání konstant ani uvolnění starých guards. T5 ON a provider calls nadále nejsou autorizované.

## Ověření a limity

Cloud testy jen syntetické snapshots/provider strings, lokální SQLite/pinned Wrangler form functions a read-process doubles. Žádné skutečné hodnoty ani hosted režimy se nyní nespouštějí. Native Windows/candidate deployment a provider E2E **NOT VERIFIED**. Staré exact-copy hledání je ukončeno; jeho historický blocker neblokuje nový explicitně schválený artifact, ale neuděluje hosted autorizaci.

Lokální source verifikace (Linux/Node24.19.0, pinned Wrangler4.150.0):

```sh
node --test --test-concurrency=1 tests/provider-candidate.test.mjs tests/provider-bootstrap.test.mjs tests/t5-worker-preparation.test.mjs tests/dev-worker-preparation.test.mjs
node_modules/.bin/eslint ops/dev/prepare-provider-candidate.mjs tests/provider-candidate.test.mjs ops/dev/prepare-t5-worker.mjs
git diff --check
```

**270/270 PASS**, bez SKIP, včetně18 nových candidate kontrol; lint/diff PASS. Pinned form test dokládá complete keep_vars:false a dvě explicitně dodané provider položky, ne inherit. Původní bootstrap/T5 guardy prošly beze změny. Canonical build/provenance a skutečný offline prepare/plan CLI pro finální SHA jsou doloženy v Draft PR; tyto lokální kroky neudělují hosted autorizaci. T3/T4 nebyly opakovány. Build artifact/template/SQL ani aplikace nejsou ručně rekonstruované z hosted verze. Jediná změna starého T5 prepareru je export již existující artifactHashes, žádná úprava validace.

Routing repair — lokální regrese nad novým source: navíc baseline preview true/false, jejich přesné mapování do Wrangler API, změna mezi review/fresh/read-back a odmítnutí neznámých či změněných routovacích polí. Výsledky této opravy jsou uvedeny v PR #93; předchozí canonical build PASS výše platí pouze pro svůj původní SHA. Native Windows resume i hosted preservation/preview Access zůstávají NOT VERIFIED.

Settings repair — Linux/Node24.19.0/pinned Wrangler4.150.0: **288/288 provider-free serial regressions PASS, 0 SKIP**, včetně8 nových settings/offline kontrol; původní T5/bootstrap/DEV guardy PASS beze změny. Spuštěno `node --test --test-concurrency=1 --test-reporter=tap tests/provider-candidate.test.mjs tests/provider-bootstrap.test.mjs tests/t5-worker-preparation.test.mjs tests/dev-worker-preparation.test.mjs`; focused eslint obou změněných .mjs, `node --check` a `git diff --check` PASS. Žádný nový build, hosted read či mutace. Skutečný Windows snapshot v Cloud není dostupný: jeho celkový offline výsledek není předstírán, z doložené shape plyne unresolved observability. Native Windows offline-check NOT VERIFIED; candidate readiness BLOCKED do vyřešení důkazu.

Authoritative script-settings source — lokálně **308/308 provider-free serial regressions PASS, 0 SKIP**: `node --test --test-concurrency=1 --test-reporter=tap tests/provider-script-settings.test.mjs tests/provider-candidate.test.mjs tests/provider-bootstrap.test.mjs tests/t5-worker-preparation.test.mjs tests/dev-worker-preparation.test.mjs`. Finální targeted reader/candidate recheck **56/56 PASS**; focused eslint všech čtyř dotčených .mjs, syntax a diff PASS. API/auth procesy jsou pouze doubles se syntetickými tokeny. Ověřeno raw uchování/žádný overwrite, pevný GET/redirect:error/no retry, safe output, old-profile paths bez buildu, separate-source provenance, absent/null/identity mismatch/changed/stale/cached evidence STOP a původní guards. Native Windows/cílený skutečný GET a hosted preservation **NOT VERIFIED**. Předchozí operátorova 32 PASS evidence se nepřeznačuje na výsledek nového readeru.
