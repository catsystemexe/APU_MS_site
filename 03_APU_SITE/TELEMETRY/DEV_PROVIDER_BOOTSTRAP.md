# DEV provider bootstrap — příprava, ne autorizace

**Aktuální stav: BLOCKED při latest != active.** Operátor doložil lokální Windows setup PASS a skutečný read-before `BLOCKED_LATEST_NOT_ACTIVE`; žádná hosted mutace/provider call. Příčina rozdílu active/latest není ověřena. Nyní neopakovat fázi A ani další Windows diagnostiku; aktuální soběstačná předávka je STOP níže. Původní raw snapshot zůstává historická evidence, nikoli fresh oprávnění k zápisu.

## Latest != active — technická překážka a koncová Windows předávka

Ověření nad source `5bd5327e202153c503d6bec73f8f01cd8849f45a`, pinned Wrangler4.150.0/CLI hash uvedený níže:

- `secret bulk` nemá doložený bezpečný výběr jiné zdrojové verze; dosavadní guard latest=active zůstává. Nesmí se vyřešit deployem neověřené latest.
- `versions secret bulk` skutečně volá `patchLatestWorkerVersionWithSecrets`, jehož endpoint je **natvrdo** `/workers/workers/{worker}/versions/latest`. Nemá CLI source-version selector. Test vykonává tento přesný pinned kód proti HTTP double: i při dodatečném sourceVersionId argumentu směřuje na latest, nikoli na aktivní UUID. To neřeší zachování aktivního kódu/configu.
- Bundled primární Cloudflare SDK5.2.0 popisuje create/get/list/delete verzí; samotná obecná create metoda nedokládá kopii kompletní aktivní verze ani merge-patch konkrétního UUID. Nahradit `/latest` za UUID nebo přidat domnělý `copy_from` / `deploy:false` payload by byla nepodložená implementace.
- Aktuální [primární API dokumentaci verzí](https://developers.cloudflare.com/api/resources/workers/subresources/beta/subresources/workers/subresources/versions/) se v této dávce nepodařilo ověřit: webový nástroj vrátil chybu a přímé čtení veřejné dokumentace bylo blokováno proxy HTTP403. To **není důkaz neexistence API schopnosti**. Je to chybějící nutný kontrakt pro bezpečný nový writer.

Konkrétně chybí doložený podporovaný request, který zvolí přesné aktivní version UUID, zachová všechny module bytes/ASSETS i celý env/config, připustí pouze dva provider secrets a vytvoří novou **neaktivní** verzi bez změny traffic/non-versioned settings. Raw metadata snapshot ani code ETag samy nedodávají kompletní kopii modulů/ASSETS a nemohou nahradit tento kontrakt. Standardní rebuild není důkaz shody s kódem skutečně aktivní verze.

| Oddělená fáze | Požadovaný důkaz / současný stav |
| --- | --- |
| 1. Příprava nové verze | BLOCKED: neověřený exact-source copy/patch kontrakt. Žádný upload/PATCH adapter není implementován. Žádná aktivace latest. |
| 2. Původ a povolené rozdíly | Před aktivací bude třeba nezávisle porovnat novou neaktivní verzi s čerstvou přesnou aktivní source verzí: module/ASSETS identity, runtime, kompletní bindings/vars/settings, Access, developer, OFF/OFF; pouze oba secrets a version bookkeeping navíc. Původní verify pro již aktivní bootstrap není náhrada tohoto staged ověření. |
| 3. Aktivace | Jen zvlášť autorizovaný deployment přesného ověřeného nového UUID. Do té doby původní active/traffic zůstávají, nový UUID není známý a žádný provider request se nepovoluje. |
| 4. Restore body | Původní732bf950… je před-bootstrap stav bez doložené provider readiness; nový post-bootstrap/post-T5 restore bod lze nominovat až po skutečné ověřené aktivaci nové OFF/OFF verze. Nezaměňovat oba body a neprovádět rollback automaticky. |

**Soběstačná Windows předávka nyní — žádný příkaz ke spuštění:**

1. Zachovat již existující raw snapshot, profil a výsledek `BLOCKED_LATEST_NOT_ACTIVE` jako historickou restricted evidence; nic neupravovat ani nemažte.
2. Nespouštět další read-before/secret list, secret put/bulk/versions secret, upload, PATCH, deployment, rollback, telemetry opt-in ani provider request. Není nutná žádná nová Windows diagnostická série ani žádné PowerShell proměnné z předchozího volání.
3. Nepředávat secrets, nečíst PUBLIC credentials a neodvozovat příčinu active/latest rozdílu.
4. Source review musí nejprve dodat přesný primární API kontrakt zachování aktivní verze a její neaktivní derivace. Teprve poté samostatná minimální implementace source-selector/allowed-delta kontroly a soběstačný blok operátora. Před budoucím zápisem bude vždy nutný **nový** fresh preflight; současný snapshot se nepřeznačuje.

Žádný guard nebyl odstraněn nebo změněn. Ověření této feasibility opravy: `node --test tests/provider-bootstrap.test.mjs` **23/23 PASS**, 0 SKIP; focused ESLint testu a diff check PASS. Testy používají výhradně fixtures/HTTP doubles, žádné hosted příkazy nebo credentials. Native Windows mechanismus kopie/aktivace **NOT VERIFIED**. Výsledek je **BLOCKED**, nikoli připravený bezpečný writer nebo bootstrap PASS. Starší fáze níže zůstávají podmíněným kontraktem pro původní latest=active případ a nejsou nyní instrukcí pokračovat.


Source základ PR #91: `41ba9e4642a132331a718cfcad22a70b25af69ba`. Operátor uvedl inventory z `2026-10-30T15:25:06.659Z`: prázdné, oba provider secret counts=0. Příčina rozdílu proti historické evidenci **NOT VERIFIED**. Verze `732bf950-30cf-444a-90fc-8927d9c8b16c` není tímto důkazem provider-ready. Nečíst ani kopírovat credentials z PUBLIC; žádné hodnoty do chatu, Git, cloudového workspace nebo transkriptu.

Tato dávka vykonává pouze source/local testy. Následující hosted příkazy jsou **návrh samostatně autorizované Windows fáze**. Bez samostatného schválení je STOP před preflight reads i PATCH. T5 samotný je BLOCKED. Zachovat původní evidence, configy, inputs a proposal; nic nepřepisovat.

## Mechanismus a hranice

Pinned Wrangler4.150.0, SHA256 cli.js `71da1f9bcf69a9f56c4ff4f68e71315365d03db8ea11207577b47a8e1a0a1064`: `putBulkSecrets` posílá jediný `PATCH /accounts/{account}/workers/scripts/{name}/secrets-bulk`, body `secrets` se dvěma secret_text položkami. Jednotlivé secret put by mohly vytvořit dvě verze a mezistav; nepoužijí se. Standardní secret bulk aktualizuje secrets a aktivní deployment, nejde o pouhý lokální config. Přesné nové version UUID je neznámé do read-backu; nic nevymýšlet. CLI handler může při chybějícím Workeru volat createDraftWorker; budoucí samostatně autorizovaný zápis smí použít pouze tento přesný PATCH bez fallbacku a retry; v aktuální předávce žádný PATCH blok není. API10214/10215 nebo latest!=active znamená STOP, nikoli versions secret bulk, nasazení latest nebo nový Worker.

Bootstrap smí začít pouze při active=latest=ověřená předchozí baseline, 100% traffic, přesném účtu/Workeru, prázdné inventory i secret metadata, správných Access/KV/D1/ASSETS, local auth0, developer roli, TTL86400, telemetry/metadata0/0 a žádném trace ON. `provider-bootstrap.mjs` validuje tento **oddělený bootstrap kontrakt** bez předstírání existujících provider bindings. Běžný T5 preparer a BLOCKED_RESOURCE_SUBSTITUTION zůstávají přísné a nezměněné. Odlišné latest může být pro T5 kompatibilní, ale není bezpečné pro tento secret-bulk mechanismus; při jeho zjištění je bootstrap BLOCKED a vyžaduje samostatný reviewovaný source-preserving postup. Automatickou alignment operaci tento handoff neobsahuje.

## Co musí člověk nejprve doložit

- Nový reviewovaný source SHA a čistý source worktree, existující pinned dependencies; oddělený nový restricted adresář mimo Git s ověřenými Windows ACL jen pro operátora. Native opravený postup není Cloudem ověřen.
- Čerstvý správný Cloudflare účet, přesný Worker apu-ms-site-dev, aktivní version/100%, latest identity a dostupná původní rollback verze. Výhradní okno bez dalších writerů. Historická inventory sama nestačí.
- Původní validované strict DEV inputs (Access application/audience, dvě KV, EU telemetry D1 UUID) a target-only config z G1/T5 evidence. Žádné syntetické IDs nebo produkční config. Konkrétní resource IDs zde nejsou známé ani domýšlené.
- Operátorem schválený **DEV** OpenAI project/key a existující vector store, jejich vlastnictví, vzájemná project kompatibilita, oprávnění pro Responses/file_search, stav kreditů/rozpočtu. Tyto údaje zde **NEZNÁMÉ / NOT VERIFIED**. Secrets inventory nepotvrzuje funkčnost provideru. Hodnoty zadává pouze Windows operátor; neposílat je agentovi.
- Zvláštní souhlas s jediným PATCH obou secrets a související novou DEV verzí/deploymentem, zachováním OFF/OFF a read-backem. Žádné AI volání ani aktivace telemetrie není tímto souhlasem zahrnuta. Vlastník incident/restore rozhodnutí je přítomen.

## Lokální příprava — samostatná fáze, žádné hosted příkazy

Úplné existující Windows cesty nejsou v zadání uvedeny; nevymýšlíme `C:\…` ani nové kořeny. Operátor vybere **skutečné již existující** cesty použité v T5 předávce: source `$Repo`, validované strict DEV inputs, `t5-restore-target.json` a vybraný restricted bootstrap evidence adresář. Chybí-li některá cesta nebo vhodný adresář, STOP; agent jej nesmí odhadnout, založit jako náhradu ani použít produkční config. Původní soubory/evidence se nepřepisují. Adresář musí mít operátorem ověřené ACL jen pro něj a nesmí obsahovat dřívější before/after výstupy ani profil stejného jména.

Tento blok lze spustit v novém PowerShell procesu bez předchozích proměnných. Nepoužívá žádné credentials ani cloudovou síť:

```powershell
$ErrorActionPreference='Stop'
$Repo=(Resolve-Path -LiteralPath (Read-Host 'Existujici reviewovany source worktree z T5')).Path
$ReviewedSha=Read-Host 'Presny plny schvaleny aktualni SHA PR92'
$Inputs=(Resolve-Path -LiteralPath (Read-Host 'Existujici validovane strict DEV inputs JSON z T5')).Path
$Target=(Resolve-Path -LiteralPath (Read-Host 'Existujici t5-restore-target.json z T5')).Path
$EvidenceDir=(Resolve-Path -LiteralPath (Read-Host 'Existujici restricted bootstrap evidence adresar z T5 predavky')).Path
$Operator=Join-Path $Repo 'ops/dev/provider-bootstrap-operator.mjs'
if (!(Test-Path -LiteralPath $Operator -PathType Leaf)) { throw 'BLOCKED_LOCAL_TOOL_MISSING' }
node $Operator setup $Repo $ReviewedSha $Inputs $Target $EvidenceDir
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_LOCAL_SETUP' }
# Vystup obsahuje jen status a skutecnou cestu bootstrap-local-profile.json.
# Zde STOP; zadna autorizace read-only faze ani zapisu tim nevznika.
```

Setup ověřuje HEAD/čistý tracked source, Git root a canonical repository remote, Node executable/verzi, úplné real paths mimo Git bez symlink substitution, strict inputs/OFF/TTL a target-only account/Worker config přes původní guardy, canonical artifact contract a hash pinned Wrangler CLI. Ukládá pouze cesty/hash/source metadata do nového `bootstrap-local-profile.json` (exclusive write), žádné resource hodnoty ani secrets do veřejné evidence. Dependency instalace, build, získávání auth a otázky k cestám patří mimo krátké fresh okno. Existující build manifest se nepřeznačuje a profil neprohlašuje nový build ani hosted PASS.

## Windows fáze A — jeden souvislý read-only blok, až po samostatné autorizaci

**Nejbližší operátorská fáze.** Samostatný nový PowerShell proces / tool call; nepotřebuje žádné proměnné předchozího bloku. Znovu vybere skutečný source a profil vytvořený lokálním setupem. Žádná secrets hodnota, PATCH ani mutační příkaz. Nyní v Codex Cloud se tento blok nevykonává:

```powershell
$ErrorActionPreference='Stop'
$Repo=(Resolve-Path -LiteralPath (Read-Host 'Stejny existujici reviewovany source worktree z T5')).Path
$ReviewedSha=Read-Host 'Presny plny schvaleny aktualni SHA PR92'
$Profile=(Resolve-Path -LiteralPath (Read-Host 'Existujici bootstrap-local-profile.json z dokonceneho lokalniho setupu')).Path
$Operator=Join-Path $Repo 'ops/dev/provider-bootstrap-operator.mjs'
if (!(Test-Path -LiteralPath $Operator -PathType Leaf)) { throw 'BLOCKED_LOCAL_TOOL_MISSING' }
node $Operator read-before $Profile $Repo $ReviewedSha
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_READ_ONLY_PREFLIGHT_NO_PATCH' }
# Zde STOP. Nevkladat key, nespoustet PATCH ani deploy.
```

Node nejprve znovu ověří source a identitu/hash všech cest v profilu, Node runtime, pinned CLI, target/inputs a artifact; až pak začne hosted read. Spustí původní `t5-baseline.mjs --execute-authorized-read` proti přesnému DEV targetu, potom jednou pinned `secret list --format json`. Oba procesy jsou bounded; kompletní stdout/stderr zůstávají v paměti a nejsou přeposílány do terminálu. Inventory se parsuje **jediným JSON.parse celého stdout v Node**, nikoli po řádcích nebo PowerShell array/ConvertFrom-Json pipeline. Empty array a dvoupoložková array zůstávají arrays. Neplatný JSON, banner/trailing JSON, null/object místo array, neznámá pole, secret text/duplicity nebo neznámá jména znamenají bezpečný STOP bez raw výpisu. Platný částečný seznam je stále neúspěšný preflight, nikoli prázdný seznam.

Původní raw baseline se uloží samostatně jako `before-raw.json`; `before.json` přidá pouze Node-validovanou names/types inventory a skutečný okamžik jejího dokončení. Raw inventory stdout se neukládá ani nezveřejňuje. Výstupy jsou výhradně nové private soubory, nikdy overwrite. Při chybě zachovat vzniklou partial evidence a STOP; neautomatizovat druhý běh do stejného adresáře, nemazat outputy. Output metadata a inventory musí být fresh do60s a navzájem do10s podle **nezměněných** původních helperů. Žádné nastavování timestampů na pozdější čas kvůli PASS.

Výsledek této fáze je maximálně `PREFLIGHT_PASS_NOT_AUTHORIZATION`, nikoli povolení PATCH. Neprobíhá s ní souběžně žádný build nebo instalace. Postup neobsahuje čekací smyčku, login ani provider request.

## Windows fáze B — zápis je oddělený a stále NEAUTORIZOVANÝ

Starý vykonatelný fragment PATCH závislý na `$Plan/$Auth/$Paths/...` z předchozího tool callu je vyřazen. **V této předávce není žádný zápisový blok ke spuštění.** Další samostatné schválené zadání musí dodat soběstačný celý krátký preflight → PATCH → read-back blok. Nesmí navazovat na proměnné ani na již zestárlý preflight z fáze A.

V tomto budoucím zadání musí být lokální tool/path příprava dokončena před fresh oknem. Provider hodnoty zadá operátor pouze lokálně, masked, před zahájením krátkého fresh preflight; potom skutečné nové metadata/inventory, původní freshness/active=latest/OFF/OFF guardy, nejvýše jeden přesný PATCH obou secrets bez fallbacku/retry a povinný read-back. Při pomalém zadávání, timeoutu nebo nejasném výsledku žádný retry/delete; hodnoty se nesmějí přenášet přes ChatGPT/Codex ani ukládat do profilu. Zachovat původní ochranu proti redirects/logging a zákaz PUBLIC credentials. Toto není nová autorizace ani oslabení bootstrap podmínek.

## Windows fáze C — soběstačný read-back, až po skutečně autorizovaném bootstrapu

Tento oddělený read-only blok inicializuje všechny vstupy znovu; nyní se **nespouští**. `$NewVersion` je skutečné doložené single100% version UUID z autorizované operace/deployment evidence, nikoli vymyšlená hodnota. Není-li známo, STOP/incident; žádné nasazení nebo rollback naslepo. Profil určuje původní `before.json`; nevybírá se libovolný náhradní snapshot. Node použije stejný úplný stdout parser a původní verify guardy:

```powershell
$ErrorActionPreference='Stop'
$Repo=(Resolve-Path -LiteralPath (Read-Host 'Existujici reviewovany source worktree z T5')).Path
$ReviewedSha=Read-Host 'Presny plny schvaleny aktualni SHA PR92'
$Profile=(Resolve-Path -LiteralPath (Read-Host 'Existujici bootstrap-local-profile.json pouzity pro tuto operaci')).Path
$NewVersion=Read-Host 'Skutecny dolozeny novy single100% Worker version UUID'
$Operator=Join-Path $Repo 'ops/dev/provider-bootstrap-operator.mjs'
if (!(Test-Path -LiteralPath $Operator -PathType Leaf)) { throw 'BLOCKED_LOCAL_TOOL_MISSING' }
node $Operator read-after $Profile $Repo $ReviewedSha $NewVersion
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_AFTER_READBACK_NO_RETRY' }
```

Vzniknou pouze nové `after-raw.json`/`after.json`; předchozí soubory zůstanou zachované. Samostatně spouštěné fáze sdílejí explicitně ověřené soubory, nikoli process memory nebo PowerShell session. Čerstvý budoucí PATCH smí použít jen profil/evidence odpovídající svému novému preflightu; fáze A jej nenahrazuje.

Verify vyžaduje novou active/latest verzi, přesně dvě provider secret names, žádný plaintext v metadata a nezměněné non-secret bindings/vars/code ETag/runtime/settings/Access/ASSETS/KV/D1/routing. Ignoruje jen nové version id/annotations/metadata timestamps v porovnání verzí; raw snapshots se uchovávají. Neznámá odchylka = STOP, ne ruční edit evidence nebo guardu. Ověřit též běžný `/api/session`200/isDeveloper:true a disabled telemetry context, bez AI/UI opt-in. Neopakovat T3/T4. Provider E2E stále NOT VERIFIED.

- **Pre-bootstrap restore:** původní732bf950… je pouze původní stav; může obnovit chybějící provider secrets. Není bezpečný univerzální rollback po T5. Při chybě bootstrapu zachovat snapshots a rozhodnout s člověkem, zda skutečně obnovit předchozí non-provider stav; přímá kompenzace/delete není automaticky autorizována. Původní verze může vyžadovat secret-change force potvrzení, které není zahrnuto automaticky.
- **Post-bootstrap restore pro T5:** až ověřené nové skutečné UUID s OFF/OFF, zachovanou developer rolí a oběma secrets je nový nominovaný restore bod. Helper vrací jeho ID/hash a oddělený stav, nikoli provider E2E PASS. `rollbackPlan()` generuje pouze explicitní plán na tento bod s fresh exclusive current-version guardem; nesmí mířit automaticky na732bf950….
- **T5 stále BLOCKED:** existující PR91 helpery mají pevný starý baseline. Neměnit ručně T5.baseline ani odstranit BLOCKED_RESOURCE_SUBSTITUTION. Po skutečném bootstrapu je nutný malý samostatně reviewovaný baseline rebase všech T5 preflight/config/restore helperů na konkrétní nový doložený snapshot/UUID. Toto UUID dnes neznáme. Žádný T5 ON deploy nebo provider test před touto integrací a samostatnou autorizací.

## Lokální verifikace a omezení

Source testy používají pouze syntetická metadata a skutečnou vyjmutou pinned putBulkSecrets funkci proti HTTP double. Žádné reálné hodnoty ani síťové/provider volání. Native PowerShell/PATCH/version read-back NOT VERIFIED. Závěr přípravy je podmíněný postup s explicitními STOP stavy, nikoli autorizace či bootstrap PASS. Čerstvé account/active/latest/resource/project skutečnosti a nový post-bootstrap restore UUID zatím chybí.

Historická počáteční verifikace na `3a877871ee296d29ea75080d3ca314aeb9b5d193` (Linux/Node24.19.0, 2026-10-30):

```sh
node --test tests/provider-bootstrap.test.mjs tests/t5-worker-preparation.test.mjs tests/dev-worker-preparation.test.mjs
node --test tests/provider-bootstrap.test.mjs
node_modules/.bin/eslint ops/dev/provider-bootstrap.mjs tests/provider-bootstrap.test.mjs ops/dev/prepare-t5-worker.mjs
git diff --check
```

**246/246 PASS**, poté finální bootstrap/target-config rollback testy **18/18 PASS**, bez SKIP; lint/diff PASS. Pinned HTTP funkce je testována pouze přes double, nikoli skutečný CLI/network executor. Build/typecheck nejsou znovu vykonány: aplikační source, dependencies, SQL a templates beze změny. Jediná změna existujícího prepareru je export jeho původní přísné bindingMap pro sdílené ověření; žádná validace není odstraněna. Native Windows i hosted PATCH/read-back zůstávají NOT VERIFIED.

### Oprava vykonatelnosti Windows handoffu — 2026-10-30

Základ `3a877871ee296d29ea75080d3ca314aeb9b5d193`. Přidán lokální setup/profil a read-only Node orchestrátor; žádný writer/PATCH executor. Testy ověřují úplný stdout parser (empty/dvě položky, chybné tvary, extra fields/duplicity), nezávislé načtení cest každé fáze, změnu input hash/source, zákaz overwrite a utajení raw stdout/stderr. Původní freshness/OFF/OFF/target/restore pravidla beze změny.

```sh
node --test --test-concurrency=1 tests/provider-bootstrap.test.mjs tests/t5-worker-preparation.test.mjs tests/dev-worker-preparation.test.mjs
node --test tests/provider-bootstrap.test.mjs
node_modules/.bin/eslint ops/dev/provider-bootstrap.mjs ops/dev/provider-bootstrap-operator.mjs tests/provider-bootstrap.test.mjs
git diff --check
```

**250/250 PASS** sériově, cílená sada **21/21 PASS**, bez SKIP; lint/diff PASS. První paralelní běh měl timeout původní lokální D1 fixture (exit143); sériové opakování prošlo bez změny testu/timeoutů. Hosted procesy jsou v nových testech výhradně doubles. Native PowerShell není v Cloud dostupný: **NOT VERIFIED**. Žádné hosted příkazy, secrets values, deployment, provider calls, merge nebo PUBLIC změna nebyly provedeny.
