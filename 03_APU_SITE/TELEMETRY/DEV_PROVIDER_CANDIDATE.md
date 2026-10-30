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
| Compatibility/settings/routing | Zachovat compatibility date/flags a active observability/logpush/placement/tail/limits/cache; stejné workers.dev, preview false, žádné public routes/domains/schedules. Unknown fields/identity mismatch = STOP. |
| Upload instrukce | **keep_vars:false s úplným explicitním configem**; nepoužít --keep-vars. To není starý neúplný preserving patch: všechny aktivní vars jsou dodané a z latest se žádné plain vars nedědí. Nový source tag/version UUID jsou nové deployment bookkeeping. |

Latest se nenasazuje ani nekopíruje. Jeho known bindings/identity se validují a whole metadata/hash se reviewuje; **active secret set a aktuální inventory musí být prázdné; latest smí mít nejvýše dvě provider položky, které se obě povinně explicitně přepíšou**. Důvod: pinned Wrangler deploy vždy používá keepSecrets:true. Jakýkoli nedodaný/ostatní secret v latest proto STOP; neprovádět delete nebo přepsání guardu. Neznámé plain vars latest také STOP. Latest může mít jiný kód nebo známý trace flag1: úplný config keep_vars:false ho nepřevezme. Jeho source není kandidátní artifact. Původní provider hodnoty latest se nezískávají ani nekopírují; obě dodané hodnoty musí pocházet od operátora ze schváleného DEV projektu.

Pinned Wrangler4.150.0/CLI hash `71da1f9bcf69a9f56c4ff4f68e71315365d03db8ea11207577b47a8e1a0a1064`: standardní `deploy --secrets-file` převádí dodané hodnoty na explicitní secret_text před required/inherit krokem. Obě required provider položky jsou dodané, takže žádná z nich není inherit. Actual upload form test ověřuje keep_bindings pouze pro secret typy (žádné plain/json), přesně dvě explicitní provider položky, beze změny všech aktivních vars. Standardní deploy **uploaduje a aktivuje**, není to oddělený neaktivní hosted staging. Oddělujeme lokální přípravu/review od budoucí explicitně autorizované aktivace; nevymýšlíme exact-copy API.

## A. Soběstačná lokální příprava — nyní dovolený typ práce

Úplné Windows cesty v zadání nejsou. Vybrat skutečné **existující** cesty z dosavadního T5 handoffu; nevymýšlet nový kořen, nesahat na runtime checkout. `$Dir` je již existující nový prázdný restricted adresář mimo Git, ACL jen operátor. Původní snapshot/inputs/proposal i partial outputs zachovat. Historický **before.json** z dokončeného read-before obsahuje raw metadata + Node inventory i když následný guard skončil BLOCKED_LATEST_NOT_ACTIVE. Nepoužívat místo něj ručně doplněný raw snapshot bez inventory.

```powershell
$ErrorActionPreference='Stop'
$Repo=(Resolve-Path -LiteralPath (Read-Host 'Existujici aktualizovany reviewovany source worktree')).Path
$Sha=Read-Host 'Presny plny schvaleny SHA noveho candidate Draft PR'
$Inputs=(Resolve-Path -LiteralPath (Read-Host 'Puvodni validovane strict DEV inputs')).Path
$Target=(Resolve-Path -LiteralPath (Read-Host 'Puvodni t5-restore-target.json')).Path
$Historical=(Resolve-Path -LiteralPath (Read-Host 'Existujici historicky before.json s Node inventory')).Path
$Dir=(Resolve-Path -LiteralPath (Read-Host 'Existujici prazdny restricted adresar pro novy candidate')).Path
if ((Get-ChildItem -LiteralPath $Dir -Force).Count -ne 0) { throw 'BLOCKED_OUTPUT_EXISTS' }
$Build=Join-Path $Repo 'ops/dev/prepare-t5-worker.mjs'
$Setup=Join-Path $Repo 'ops/dev/provider-bootstrap-operator.mjs'
$Candidate=Join-Path $Repo 'ops/dev/prepare-provider-candidate.mjs'
# Pred buildem uchovat drivejsi dist/manifest mimo repo, zadne preznaceni stareho source_sha:
if (Test-Path -LiteralPath (Join-Path $Repo 'dist')) { Copy-Item -LiteralPath (Join-Path $Repo 'dist') -Destination (Join-Path $Dir 'previous-dist') -Recurse }
node $Build --build $Repo $Sha
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_CANONICAL_BUILD' }
node $Setup setup $Repo $Sha $Inputs $Target $Dir
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_LOCAL_PROFILE' }
$Profile=Join-Path $Dir 'bootstrap-local-profile.json'
node $Candidate prepare $Profile $Repo $Sha $Historical
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
