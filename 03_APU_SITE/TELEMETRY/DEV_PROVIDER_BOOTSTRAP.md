# DEV provider bootstrap — příprava, ne autorizace

Source základ PR #91: `41ba9e4642a132331a718cfcad22a70b25af69ba`. Operátor uvedl inventory z `2026-10-30T15:25:06.659Z`: prázdné, oba provider secret counts=0. Příčina rozdílu proti historické evidenci **NOT VERIFIED**. Verze `732bf950-30cf-444a-90fc-8927d9c8b16c` není tímto důkazem provider-ready. Nečíst ani kopírovat credentials z PUBLIC; žádné hodnoty do chatu, Git, cloudového workspace nebo transkriptu.

Tato dávka vykonává pouze source/local testy. Následující hosted příkazy jsou **návrh samostatně autorizované Windows fáze**. Bez samostatného schválení je STOP před preflight reads i PATCH. T5 samotný je BLOCKED. Zachovat původní evidence, configy, inputs a proposal; nic nepřepisovat.

## Mechanismus a hranice

Pinned Wrangler4.150.0, SHA256 cli.js `71da1f9bcf69a9f56c4ff4f68e71315365d03db8ea11207577b47a8e1a0a1064`: `putBulkSecrets` posílá jediný `PATCH /accounts/{account}/workers/scripts/{name}/secrets-bulk`, body `secrets` se dvěma secret_text položkami. Jednotlivé secret put by mohly vytvořit dvě verze a mezistav; nepoužijí se. Standardní secret bulk aktualizuje secrets a aktivní deployment, nejde o pouhý lokální config. Přesné nové version UUID je neznámé do read-backu; nic nevymýšlet. CLI handler může při chybějícím Workeru volat createDraftWorker; proto níže používáme pouze přesný stejný PATCH, bez tohoto fallbacku a bez automatických retry. API10214/10215 nebo latest!=active znamená STOP, nikoli versions secret bulk, nasazení latest nebo nový Worker.

Bootstrap smí začít pouze při active=latest=ověřená předchozí baseline, 100% traffic, přesném účtu/Workeru, prázdné inventory i secret metadata, správných Access/KV/D1/ASSETS, local auth0, developer roli, TTL86400, telemetry/metadata0/0 a žádném trace ON. `provider-bootstrap.mjs` validuje tento **oddělený bootstrap kontrakt** bez předstírání existujících provider bindings. Běžný T5 preparer a BLOCKED_RESOURCE_SUBSTITUTION zůstávají přísné a nezměněné. Odlišné latest může být pro T5 kompatibilní, ale není bezpečné pro tento secret-bulk mechanismus; při jeho zjištění je bootstrap BLOCKED a vyžaduje samostatný reviewovaný source-preserving postup. Automatickou alignment operaci tento handoff neobsahuje.

## Co musí člověk nejprve doložit

- Nový reviewovaný source SHA a čistý source worktree, existující pinned dependencies; oddělený nový restricted adresář mimo Git s ověřenými Windows ACL jen pro operátora. Native opravený postup není Cloudem ověřen.
- Čerstvý správný Cloudflare účet, přesný Worker apu-ms-site-dev, aktivní version/100%, latest identity a dostupná původní rollback verze. Výhradní okno bez dalších writerů. Historická inventory sama nestačí.
- Původní validované strict DEV inputs (Access application/audience, dvě KV, EU telemetry D1 UUID) a target-only config z G1/T5 evidence. Žádné syntetické IDs nebo produkční config. Konkrétní resource IDs zde nejsou známé ani domýšlené.
- Operátorem schválený **DEV** OpenAI project/key a existující vector store, jejich vlastnictví, vzájemná project kompatibilita, oprávnění pro Responses/file_search, stav kreditů/rozpočtu. Tyto údaje zde **NEZNÁMÉ / NOT VERIFIED**. Secrets inventory nepotvrzuje funkčnost provideru. Hodnoty zadává pouze Windows operátor; neposílat je agentovi.
- Zvláštní souhlas s jediným PATCH obou secrets a související novou DEV verzí/deploymentem, zachováním OFF/OFF a read-backem. Žádné AI volání ani aktivace telemetrie není tímto souhlasem zahrnuta. Vlastník incident/restore rozhodnutí je přítomen.

## Windows fáze A — pouze po autorizaci read-only preflight

Použít proměnné z reviewované předávky PR91: `$Repo`, `$Cli`, `$Paths.restoreConfig`, `$Inputs`, `$Reader`; stejné ověřené existující cesty. Hodnoty nepřepisovat a runtime checkout neresetovat. Níže `$Dir` je **nový existující prázdný restricted adresář mimo repo**, jehož ACL operátor ověřil; při existenci libovolného cílového souboru STOP. Node22.23.2 bylo operátorem doloženo pro předchozí přípravu, tento nový bootstrap native NOT VERIFIED.

```powershell
$ErrorActionPreference='Stop'
$ReviewedSha=Read-Host 'Presny plny reviewovany bootstrap source SHA z noveho Draft PR'
if ($ReviewedSha -notmatch '^[a-f0-9]{40}$' -or (git -C $Repo rev-parse HEAD) -ne $ReviewedSha -or (git -C $Repo status --porcelain --untracked-files=no)) { throw 'BLOCKED_REVIEWED_SOURCE' }
$Dir=(Resolve-Path (Read-Host 'Novy prazdny restricted bootstrap adresar mimo Git')).Path
if ((Get-ChildItem -LiteralPath $Dir -Force).Count -ne 0) { throw 'BLOCKED_EVIDENCE_NOT_EMPTY' }
$Tool=Join-Path $Repo 'ops/dev/provider-bootstrap.mjs'
if ((Get-FileHash -LiteralPath $Cli -Algorithm SHA256).Hash.ToLowerInvariant() -ne '71da1f9bcf69a9f56c4ff4f68e71315365d03db8ea11207577b47a8e1a0a1064') { throw 'BLOCKED_PINNED_CLI' }
$BeforeRaw=Join-Path $Dir 'before-raw.json'
node $Reader --execute-authorized-read $Paths.restoreConfig $Inputs $BeforeRaw $Repo $Cli
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_BEFORE_METADATA' }
$Inventory=@(node $Cli secret list --format json --name apu-ms-site-dev --config $Paths.restoreConfig | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_INVENTORY' }
$Before=Join-Path $Dir 'before.json'
$r=Get-Content -Raw -LiteralPath $BeforeRaw | ConvertFrom-Json
$r | Add-Member -NotePropertyName inventory -NotePropertyValue $Inventory
$r | Add-Member -NotePropertyName inventory_read_at -NotePropertyValue ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
[IO.File]::WriteAllText($Before,($r | ConvertTo-Json -Depth 100),[Text.UTF8Encoding]::new($false))
$Plan=node $Tool preflight $Before $Inputs $Repo | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_BOOTSTRAP_PREFLIGHT' }
```

Helper požaduje metadata/inventory do60s a jejich vzájemný odstup do10s. Nestihne-li se, nic nemutovat; zachovat soubory a předat nový konkrétní read-only preflight handoff, ne upravovat timestamps. Raw reader soubor se nemění; obohacený snapshot je další evidence. Source/config/CLI identity musí být ověřena v původním reviewovaném setupu. CLI stderr/logy pouze do protected evidence, nikdy secrets. Žádné skutečné hodnoty se při těchto reads nezískávají.

## Windows fáze B — samostatně autorizovaný jediný PATCH

Bez přerušení mezi fresh preflight a zápisem, žádný jiný writer. Bez transcriptu/debug/verbose/proxy logů request bodies; žádná provider data do clipboardu nebo shell history. Pevný lokální blok používá pouze existující **Cloudflare** auth v paměti, žádný nový login. Žádné klíče v argumentech/filech:

```powershell
# Recheck offline freshness tesne pred sberem lokalnich hodnot:
$Plan=node $Tool preflight $Before $Inputs $Repo | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_STALE_BEFORE' }
$Auth=node $Cli auth token --json --config $Paths.restoreConfig | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $Auth.type -notin @('oauth','api_token')) { throw 'BLOCKED_EXISTING_CF_AUTH' }
$PatchAttempted=$false
$Key=Read-Host 'DEV OPENAI_API_KEY (pouze lokalne)' -AsSecureString
$Store=Read-Host 'DEV APU_VECTOR_STORE_ID (pouze lokalne)' -AsSecureString
try {
  $KeyText=[Net.NetworkCredential]::new('', $Key).Password
  $StoreText=[Net.NetworkCredential]::new('', $Store).Password
  if ([string]::IsNullOrWhiteSpace($KeyText) -or [string]::IsNullOrWhiteSpace($StoreText)) { throw 'BLOCKED_EMPTY_LOCAL_VALUE' }
  # Znovu freshness; pomale zadani hodnot nesmi pouzit stary preflight.
  $Plan=node $Tool preflight $Before $Inputs $Repo | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_STALE_BEFORE_NO_PATCH' }
  $Body=@{secrets=@{OPENAI_API_KEY=@{name='OPENAI_API_KEY';type='secret_text';text=$KeyText};APU_VECTOR_STORE_ID=@{name='APU_VECTOR_STORE_ID';type='secret_text';text=$StoreText}}} | ConvertTo-Json -Depth 5 -Compress
  $PatchAttempted=$true
  $null=Invoke-RestMethod -Method Patch -Uri ('https://api.cloudflare.com/client/v4'+$Plan.path) -Headers @{Authorization=('Bearer '+$Auth.token)} -ContentType 'application/merge-patch+json' -Body ([Text.Encoding]::UTF8.GetBytes($Body)) -TimeoutSec 30 -MaximumRedirection 0
} catch { if (!$PatchAttempted) { throw 'BOOTSTRAP_NOT_ATTEMPTED_STOP' }; throw 'BOOTSTRAP_UNCONFIRMED_NO_RETRY_READBACK_REQUIRED' }
finally { $Body=$null; $KeyText=$null; $StoreText=$null; $Auth=$null; if($Key){$Key.Dispose()}; if($Store){$Store.Dispose()} }
```

.NET řetězce nelze garantovaně vymazat z paměti; zavřít tento vyhrazený PowerShell proces po dokončení. Žádné ukládání values do helperu, chatu nebo cloudového prostředí. Žádné retry při timeout/error; vzdálená operace mohla proběhnout. Neprovádět secret delete jako kompenzaci. Je třeba read-back; HTTP úspěch nestačí. Pokud API vrátí success=false při HTTP200, následující read-back to musí odhalit; neinterpretovat samotný PATCH response jako PASS.

## Windows fáze C — read-back a dva rozdílné restore body

Po PATCH přečíst `deployments list --json` pomocí původního target-only configu; nejnovější skutečný single100% version UUID musí operátor převzít, nikoli vygenerovat. Chybí-li jednoznačný výsledek, STOP/incident, nic nenasazovat naslepo.

```powershell
$NewVersion=Read-Host 'Skutecny novy single100% version UUID z deployment read-backu'
$AfterRaw=Join-Path $Dir 'after-raw.json'
node $Reader --execute-authorized-read $Paths.restoreConfig $Inputs $AfterRaw $Repo $Cli $NewVersion
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_AFTER_READBACK' }
$Inventory=@(node $Cli secret list --format json --name apu-ms-site-dev --config $Paths.restoreConfig | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_AFTER_INVENTORY' }
$r=Get-Content -Raw -LiteralPath $AfterRaw | ConvertFrom-Json
$r | Add-Member -NotePropertyName inventory -NotePropertyValue $Inventory
$r | Add-Member -NotePropertyName inventory_read_at -NotePropertyValue ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
$After=Join-Path $Dir 'after.json'
[IO.File]::WriteAllText($After,($r | ConvertTo-Json -Depth 100),[Text.UTF8Encoding]::new($false))
node $Tool verify $Before $After $Inputs $Repo
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_NON_SECRET_DELTA_OR_INCOMPLETE_BOOTSTRAP' }
```

Verify vyžaduje novou active/latest verzi, přesně dvě provider secret names, žádný plaintext v metadata a nezměněné non-secret bindings/vars/code ETag/runtime/settings/Access/ASSETS/KV/D1/routing. Ignoruje jen nové version id/annotations/metadata timestamps v porovnání verzí; raw snapshots se uchovávají. Neznámá odchylka = STOP, ne ruční edit evidence nebo guardu. Ověřit též běžný `/api/session`200/isDeveloper:true a disabled telemetry context, bez AI/UI opt-in. Neopakovat T3/T4. Provider E2E stále NOT VERIFIED.

- **Pre-bootstrap restore:** původní732bf950… je pouze původní stav; může obnovit chybějící provider secrets. Není bezpečný univerzální rollback po T5. Při chybě bootstrapu zachovat snapshots a rozhodnout s člověkem, zda skutečně obnovit předchozí non-provider stav; přímá kompenzace/delete není automaticky autorizována. Původní verze může vyžadovat secret-change force potvrzení, které není zahrnuto automaticky.
- **Post-bootstrap restore pro T5:** až ověřené nové skutečné UUID s OFF/OFF, zachovanou developer rolí a oběma secrets je nový nominovaný restore bod. Helper vrací jeho ID/hash a oddělený stav, nikoli provider E2E PASS. `rollbackPlan()` generuje pouze explicitní plán na tento bod s fresh exclusive current-version guardem; nesmí mířit automaticky na732bf950….
- **T5 stále BLOCKED:** existující PR91 helpery mají pevný starý baseline. Neměnit ručně T5.baseline ani odstranit BLOCKED_RESOURCE_SUBSTITUTION. Po skutečném bootstrapu je nutný malý samostatně reviewovaný baseline rebase všech T5 preflight/config/restore helperů na konkrétní nový doložený snapshot/UUID. Toto UUID dnes neznáme. Žádný T5 ON deploy nebo provider test před touto integrací a samostatnou autorizací.

## Lokální verifikace a omezení

Source testy používají pouze syntetická metadata a skutečnou vyjmutou pinned putBulkSecrets funkci proti HTTP double. Žádné reálné hodnoty ani síťové/provider volání. Native PowerShell/PATCH/version read-back NOT VERIFIED. Závěr přípravy je podmíněný postup s explicitními STOP stavy, nikoli autorizace či bootstrap PASS. Čerstvé account/active/latest/resource/project skutečnosti a nový post-bootstrap restore UUID zatím chybí.

Lokální příkazy a výsledky (Linux/Node24.19.0, 2026-10-30):

```sh
node --test tests/provider-bootstrap.test.mjs tests/t5-worker-preparation.test.mjs tests/dev-worker-preparation.test.mjs
node --test tests/provider-bootstrap.test.mjs
node_modules/.bin/eslint ops/dev/provider-bootstrap.mjs tests/provider-bootstrap.test.mjs ops/dev/prepare-t5-worker.mjs
git diff --check
```

**246/246 PASS**, poté finální bootstrap/target-config rollback testy **18/18 PASS**, bez SKIP; lint/diff PASS. Pinned HTTP funkce je testována pouze přes double, nikoli skutečný CLI/network executor. Build/typecheck nejsou znovu vykonány: aplikační source, dependencies, SQL a templates beze změny. Jediná změna existujícího prepareru je export jeho původní přísné bindingMap pro sdílené ověření; žádná validace není odstraněna. Native Windows i hosted PATCH/read-back zůstávají NOT VERIFIED.
