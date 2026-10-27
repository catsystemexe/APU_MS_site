# APU T4 — první receipt POST → GET → UI → reload

**Připravený postup, nikoli provedený hosted test.** VS agent (Luna Low) pouze vykoná tento dokument v uvedeném pořadí. Nic neopravuje, nevymýšlí příkazy ani náhradní cestu. Při STOP nepokračuje do další větve.

## 1. Pevný kontrakt a rozsah

| Položka | Očekávaná hodnota |
| --- | --- |
| Aplikační source | `d706a55c7ff80b1439079badfda88c9baa5807c4` |
| Převzatá evidence | PR #88, `b6caa1249c6460eb399cf2778c31573fec5beee8` |
| DEV Worker / jediný browser origin | `apu-ms-site-dev` / `https://apu-ms-site-dev.catsystem-exe.workers.dev` |
| Aktivní verze / traffic | `732bf950-30cf-444a-90fc-8927d9c8b16c` / 100 % |
| Collection / metadata / receipt TTL | `0` / `0` / `86400` sekund |
| Účet | Dosavadní developer účet; `/api/session` musí vrátit HTTP 200 a `isDeveloper:true`. Role se nemění. |
| Aktuální top-level verze API | `pilot-rules-2026-10-26-draft-2` / `pilot-information-2026-10-26-draft-2` |

T3 refusal/opt-in/events/D1/SQL/CSV/withdrawal/cleanup jsou podle uvedené evidence dokončené. **Neopakovat je ani nepřecházet na starší T2/T3 runbook jako náhradní postup.** Neprovádět build, instalaci, deployment/rollback, změnu vars/secrets/Access/rolí/TTL, KV list/delete/put, D1 příkazy, AI/provider požadavek, měření ani PUBLIC operaci. Jediný povolený aplikační zápis je **nejvýše jedno výslovné přijetí pravidel přes UI**, pouze ve větvi s chybějícím receiptem. Receipt se nikdy neodstraňuje ani neobnovuje kvůli testu.

## 2. PowerShell — pouze read-only DEV preflight

**Zdroj postupu:** operátor otevře `03_APU_SITE/TELEMETRY/T4_RECEIPT_OPERATOR_HANDOFF.md` na GitHubu přes permalink s plným 40znakovým SHA nového reviewovaného commitu předaného v handoffu PR #89. Z tohoto přesného commitu přečte celý postup a zkopíruje blok beze změn; nepoužije pohyblivý branch odkaz ani lokální kopii runbooku. Chybí-li takový permalink/reviewované SHA, BLOCKED / STOP. Kvůli načtení postupu se lokální checkout nijak neupravuje ani nepřepíná.

Spustit z adresáře uvnitř existujícího repo, s již instalovaným Wranglerem 4.150.0 a již funkčním oprávněním ke čtení DEV. Repo root slouží k nalezení instalovaného Wrangleru a jeho package verze, dále jen k ochraně umístění dočasného souboru mimo repo. Čistota pracovního stromu, lokální HEAD/ancestry ani shoda lokální aplikace se source nejsou podmínkou: lokální aplikace se nebuilduje, nenasazuje ani nevydává za ověřený aplikační source. Aplikační source v §1 označuje převzatou hosted evidenci PR #88, nikoli lokální checkout. Žádné čištění, stash, reset, změny ignore pravidel, instalace ani úpravy checkoutu.

Dřívější target-only `.jsonc` configy T2/T3 byly dočasné a po použití se mazaly; žádný existující config ani cestu od operátora nevyžadujeme. Blok vytvoří vlastní jedinečný dočasný `.json` v systémovém temp adresáři **mimo repo**, pouze s pevným `name`, `account_id` a `send_metrics:false`. Vytvoření pomocí `CreateNew` nepřepíše existující soubor; `finally` odstraní pouze soubor vytvořený tímto spuštěním. Nelze-li bezpečně vytvořit či odstranit tento soubor nebo chybí oprávnění ke čtení DEV, výsledek je BLOCKED. Nepoužívat šablonu `wrangler.dev.json`, produkční config ani generated deployment config; žádné vars, bindings ani secrets do dočasného configu nepřidávat.

Celý blok zkopírovat beze změn. Nevypisuje surové version JSON, developer seznam, Access audience ani secret údaje. CLI chyby jsou záměrně nahrazeny pevnou zprávou; žádný login/install/config repair jako fallback. Dočasné proměnné `CI`/`WRANGLER_SEND_METRICS` patří jen lokálnímu CLI a v `finally` se vracejí, nejsou to Worker vars.

```powershell
$DevConfig = $null
$CreatedDevConfig = $false
$PreflightVerified = $false
$OldCI = $env:CI
$OldMetrics = $env:WRANGLER_SEND_METRICS
try {
    $ExpectedVersion = '732bf950-30cf-444a-90fc-8927d9c8b16c'
    $Repo = (git rev-parse --show-toplevel 2>$null | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or !$Repo) { throw 'BLOCKED: repository unavailable' }
    $Wrangler = Join-Path $Repo 'node_modules\.bin\wrangler.cmd'
    $Package = Get-Content -Raw -LiteralPath (Join-Path $Repo 'node_modules\wrangler\package.json') -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
    if (!(Test-Path -LiteralPath $Wrangler -PathType Leaf) -or $Package.version -cne '4.150.0') { throw 'BLOCKED: existing pinned Wrangler required; do not install' }
    if ($env:CLOUDFLARE_ACCOUNT_ID -and $env:CLOUDFLARE_ACCOUNT_ID -cne '4638092f63fa7fe58bcb9d2d041b7855') { throw 'BLOCKED: conflicting account; do not change credentials' }
    $TempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    $RepoRoot = [IO.Path]::GetFullPath($Repo).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    $DevConfig = Join-Path $TempRoot ('apu-t4-' + [Guid]::NewGuid().ToString('N') + '.json')
    if ($DevConfig.StartsWith($RepoRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'BLOCKED: temporary config must be outside repository' }
    $ConfigStream = [IO.File]::Open($DevConfig, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    $CreatedDevConfig = $true
    try {
        $ConfigBytes = [Text.Encoding]::UTF8.GetBytes('{"name":"apu-ms-site-dev","account_id":"4638092f63fa7fe58bcb9d2d041b7855","send_metrics":false}')
        $ConfigStream.Write($ConfigBytes, 0, $ConfigBytes.Length)
    } finally { $ConfigStream.Dispose() }
    $env:CI = 'true'
    $env:WRANGLER_SEND_METRICS = 'false'
    function Read-T4Json([string[]]$Arguments) {
        $OldPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            $Raw = (& $Wrangler @Arguments 2>$null | Out-String)
            $ExitCode = $LASTEXITCODE
        } finally { $ErrorActionPreference = $OldPreference }
        if ($ExitCode -ne 0) { throw 'BLOCKED: DEV read unavailable; no login/retry/repair' }
        try { return ($Raw | ConvertFrom-Json -ErrorAction Stop) }
        catch { throw 'BLOCKED: unexpected Wrangler JSON; no alternate reader' }
    }
    $Deployments = @(Read-T4Json -Arguments @('deployments','list','--name','apu-ms-site-dev','--config',$DevConfig,'--json'))
    if (!$Deployments.Count -or @($Deployments | Where-Object { !$_.id -or !$_.created_on -or !$_.versions }).Count) { throw 'BLOCKED: deployment shape unavailable' }
    $Latest = $Deployments | Sort-Object { [DateTimeOffset]::Parse($_.created_on) } | Select-Object -Last 1
    if (@($Deployments | Where-Object { [DateTimeOffset]::Parse($_.created_on) -eq [DateTimeOffset]::Parse($Latest.created_on) }).Count -ne 1) { throw 'BLOCKED: latest deployment is ambiguous' }
    $Traffic = @($Latest.versions)
    if ($Traffic.Count -ne 1 -or $Traffic[0].version_id -cne $ExpectedVersion -or $Traffic[0].percentage -ne 100) { throw 'FAIL: active DEV version/traffic mismatch; no rollback' }
    $Version = Read-T4Json -Arguments @('versions','view',$ExpectedVersion,'--name','apu-ms-site-dev','--config',$DevConfig,'--json')
    if ($Version.id -cne $ExpectedVersion -or !$Version.resources.bindings) { throw 'BLOCKED: version/binding evidence unavailable' }
    $Expected = @{ APU_TELEMETRY_ENABLED='0'; APU_TELEMETRY_METADATA_ENABLED='0'; PILOT_RULES_RECEIPT_TTL_SECONDS='86400'; APU_LOCAL_DEV_AUTH='0' }
    foreach ($Name in $Expected.Keys) {
        $Binding = @($Version.resources.bindings | Where-Object { $_.name -ceq $Name })
        if ($Binding.Count -ne 1 -or $Binding[0].type -cne 'plain_text' -or $null -eq $Binding[0].text) { throw 'BLOCKED: required plain-text binding not verifiable' }
        if ($Binding[0].text -cne $Expected[$Name]) { throw 'FAIL: DEV OFF/OFF/TTL/auth contract mismatch; no repair' }
    }
    $PreflightVerified = $true
}
catch {
    if ($_.Exception.Message -match '^(FAIL|BLOCKED):') { throw $_.Exception.Message }
    throw 'BLOCKED: preflight could not be verified; do not print raw error/config/JSON'
}
finally {
    if ($null -eq $OldCI) { Remove-Item Env:CI -ErrorAction SilentlyContinue } else { $env:CI = $OldCI }
    if ($null -eq $OldMetrics) { Remove-Item Env:WRANGLER_SEND_METRICS -ErrorAction SilentlyContinue } else { $env:WRANGLER_SEND_METRICS = $OldMetrics }
    if ($CreatedDevConfig) {
        try { Remove-Item -LiteralPath $DevConfig -ErrorAction Stop }
        catch { throw 'BLOCKED: temporary config cleanup failed; STOP without browser test' }
    }
    if ($PreflightVerified) {
        [pscustomobject]@{ result='PREFLIGHT_PASS'; worker='apu-ms-site-dev'; version=$ExpectedVersion; traffic=100; telemetry='0'; metadata='0'; receipt_ttl_seconds=86400; checked_at_utc=[DateTimeOffset]::UtcNow.ToString('o') } | ConvertTo-Json -Compress
    }
}
```

Bez jediného výstupu `PREFLIGHT_PASS` browser test nezačíná. `versions view` ověřuje chráněnou verzi, `deployments list` samostatně dokládá, že je **aktivní**. Surové odpovědi zůstávají jen v paměti této lokální session; nedávat je do chatu/Git ani zapínat debug/tail. Tento blok neprovádět v Codex Cloud.

## 3. Pevný browser checklist

Použít jeden **nový panel** běžného browser profilu s dosavadním developer účtem. Žádná anonymní/tester session, změna role, mazání cookies/storage ani KV. Nepoužívat starý Access callback URL. Je-li nutné přihlášení, operátor jednou použije běžný Access tok se stejným účtem; nevrátí-li se na přesný DEV origin, **BLOCKED / STOP**, bez diagnostiky či opravy. Vyloučit souběžné přijímání pravidel ve druhém panelu téhož účtu.

1. Přejít na DEV `/api/session`. HTTP **200**, `isDeveloper:true`, stále tentýž účet. Do reportu patří jen status a boolean, **nikoli email**. 401/403, redirect mimo DEV, jiný účet/role nebo nedostupná session = BLOCKED / STOP; roli ani Access neopravovat.
2. V tomto panelu otevřít DevTools → **Network**, zapnout **Preserve log** a **Disable cache** (jen po dobu otevřených DevTools), ponechat filtr **All**. Přejít přímo na DEV `/api/pilot-rules` (GET bez aplikačního UI). Do 15 sekund musí být HTTP 200, aktuální top-level verze z §1 a čitelný JSON. Jiný výsledek = BLOCKED / STOP. Neprovádět POST z konzole, cURL, PowerShellu ani „Replay XHR“.
3. Rozhodnout pouze podle GET:
   - **Platný receipt existuje:** pravidla odpovídají aktuální rulesVersion, informationVersion v receiptu je neprázdný řetězec nejvýše 120 znaků, `acceptedAt <= nyní < expiresAt`, platnost je kladná a nejvýše 86400 sekund (shodně se zdrojovým parserem; starší informationVersion sama nevyžaduje nové přijetí). **Zapsat pouze `expiresAt`, výsledek `BLOCKED_EXISTING_RECEIPT`; STOP.** Nenavigovat do dalšího průchodu, nic neobnovovat/neodstraňovat, nepřijímat znovu. First POST zůstává NOT VERIFIED; pokračování někdy po přirozené expiraci vyžaduje nové spuštění T4/preflight, nikoli čekací smyčku.
   - **`receipt:null`:** pokračovat bodem 4. To zahrnuje serverem odmítnutý expirovaný/obsolete receipt; žádný starý KV klíč nemažeme.
   - **Nenulový neplatný/nečitelný receipt:** `FAIL_INVALID_GET_RECEIPT` / STOP. Neopravovat hodiny, verze ani data.
   - **Nelze spolehlivě rozhodnout kvůli hodinám nebo právě nastávající expiraci:** `BLOCKED_RECEIPT_VALIDITY` / STOP, pouze poznamenat dostupný `expiresAt`; žádný další POST ani čekání na expiraci.
4. Přejít jednou na přesný DEV `/`. Zachytit automatický **GET `/api/pilot-rules`**, HTTP 200 s `receipt:null`, a do 15 sekund dialog **„Než začneš používat APU“**; pracovní composer je skrytý/uzamčený, checkbox nezaškrtnutý a **„Pokračovat do APU“** disabled. Pokud se mezitím objeví platný receipt, přejít do STOP větve `BLOCKED_EXISTING_RECEIPT` (jen expiresAt). Pokud se UI odemkne při `receipt:null`, je to **FAIL_GATE**; pokud chybí síťová evidence nebo nebylo možné stav zjistit, **BLOCKED**.
5. Pouze po splnění bodu 4 ve větvi `receipt:null` jednou zaškrtnout checkbox a **jednou** kliknout **„Pokračovat do APU“**. Tím se provede jediné výslovné potvrzení přes UI povolené tímto zadáním T4; nepřidávat další schvalovací krok ani měnit účet. Žádný dvojklik ani další POST. Network musí pro tento pokus obsahovat nejvýše **jeden POST `/api/pilot-rules`**.
6. Zachytit POST status a sanitizovanou odpověď podle §4. Bezchybný případ: **HTTP 200**, aktuální obě top-level verze, receipt s aktuálními oběma verzemi, konečnou platností přesně **86400 sekund**. Následující automatický GET musí vrátit **HTTP 200** a **tentýž receipt**. Do 15 sekund po platném GET musí zmizet rules dialog a být dostupný/enabled composer. Nic nepsat/neodesílat, nepřepínat fázi, nespouštět diktování, Rozbor ani Výstup. Žádné telemetry/AI API volání ani nabídku měření neaktivovat.
7. Teprve po odemčení jednou stisknout **F5**. Zachytit nový GET 200 se stejným receiptem a znovu dostupné UI do 15 sekund. **Žádný nový POST**; `acceptedAt` a `expiresAt` se reloadem nesmějí změnit. Tím průchod končí.

### Jediná recovery větev — pouze GET

Tato větev platí **jen po jediném kliknutí v bodu 5**; úvodní GET používají STOP pravidla bodů 2–4. Po timeoutu/ztracené/nejasné POST odpovědi, GET timeoutu/503 nebo POST 200 → GET `receipt:null` **už nikdy neklikat „Pokračovat do APU“**. Neoznačovat chybějící odpověď jako prokázané neuložení. UI zůstává zamčené.

- Od konce aktuálního requestu čekat **15 sekund**, jednou kliknout **„Ověřit znovu“** a v Network doložit **jen GET**. Na odpověď čekat nejvýše 15 sekund. Nejvýše **3 takové recovery GETy**, vždy se stejnou pauzou; žádné automatické polling/retry skripty.
- Vrátí-li se platný receipt a odemkne UI, provést bod 7. Byl-li první POST doložen HTTP 200 s platným receiptem a pozdější GET přesně souhlasí, lze dokončit plný PASS. Chybí-li jednoznačná platná POST odpověď, lze uvést **GET_RECOVERY_RELOAD_PASS**, ale **celé T4 = BLOCKED_POST_EVIDENCE**, ne PASS prvního POST.
- Vrátí-li GET po nejasném POST `receipt:null` a UI nabídne nové potvrzení, **STOP / BLOCKED_POST_OUTCOME**; tuto nabídku nepoužít. Po třetím neúspěšném GET je **STOP / BLOCKED_KV_VISIBILITY**. Chybí-li recovery tlačítko, **BLOCKED**, žádná alternativní konzole ani ruční POST.
- 401/403, změna účtu/role/originu nebo 409/obrazovka **„Pravidla se změnila“** znamená okamžitý **BLOCKED / STOP**. Prokazatelně chybný receipt/rozdílný receipt po reloadu, více než jeden POST nebo odemčení bez platného GET je **FAIL / STOP**. Recovery nikdy nemaže takový FAIL.

## 4. Sanitizovaná evidence a konečný výsledek

Z Network ručně přepsat **pouze**: pořadí, UTC čas, HTTP metodu, samotnou cestu `/api/pilot-rules`, HTTP status (nebo `timeout/no response`), top-level `rulesVersion`, `informationVersion` a `receipt:null` nebo čtyři receipt pole `{rulesVersion,informationVersion,acceptedAt,expiresAt}`. Pro chybu lze navíc přepsat známý kód `PILOT_RULES_UNAVAILABLE` / `PILOT_RULES_VERSION_CHANGED`; neznámý body nekopírovat. Nikdy full HAR/Copy as cURL, raw request/response headers, cookies, token/JWT, `/api/session` email, konzolové/config dumpy, obsah chatu/Zápisníku ani celé screenshoty s těmito údaji. Network evidence není nová aplikační telemetrie.

Pro výpočet **nové** platnosti lze beze změny spustit tento lokální blok s přepsanými timestampy (ve větvi existujícího receiptu se nespouští):

```powershell
$AcceptedAt = Read-Host 'acceptedAt z prvni platne odpovedi ve vetvi noveho prijeti'
$ExpiresAt = Read-Host 'expiresAt z teze odpovedi'
try { $Lifetime = ([DateTimeOffset]::Parse($ExpiresAt) - [DateTimeOffset]::Parse($AcceptedAt)).TotalSeconds }
catch { throw 'FAIL: unparseable receipt timestamps' }
if ($Lifetime -ne 86400) { throw 'FAIL: new receipt lifetime differs from 86400 seconds' }
'RECEIPT_TTL_PASS=86400'
```

| Výsledek | Pevná podmínka |
| --- | --- |
| **PASS — FIRST_POST_GET_UI_RELOAD** | Preflight PASS, původně receipt:null, právě jeden doložený platný POST 200, následný GET 200 se stejným receiptem, UI odemčeno, reload GET 200 beze změny receiptu a bez druhého POST; žádný zakázaný request/operace. |
| **BLOCKED** | Chybí přístup/evidence/předpoklad nebo již existuje platný receipt; viz přesné kódy výše. Platný receipt není závada a nesmí se „řešit“ výmazem. Chybějící POST evidence nikdy není plný PASS. |
| **FAIL** | Prokázaný rozpor kontraktu (verze/traffic/OFF/TTL), neplatná úspěšná receipt odpověď, více POST, nesprávný unlock, změněné timestampy po GET/reloadu nebo zakázaná akce. Nesplněný unlock do 15 sekund po doloženém platném GET = FAIL_UI_UNLOCK. Bez doloženého platného GET pouze BLOCKED. |

**STOP postup:** už nic neklikat/neodesílat, žádná oprava, smazání, opakovaný POST, rollback ani automatické pokračování jiného zadání. Zavřít pouze testovací panel; nevypínat cizí práci, nemazat session/storage. Odevzdat výsledek a poslední bezpečně doložený bod, sanitized HTTP posloupnost a UI pozorování. Ve větvi existujícího receiptu pouze `BLOCKED_EXISTING_RECEIPT`, `expiresAt` a odkaz na preflight PASS. Neplánovat automatickou úlohu po expiraci.

Formát reportu: `T4=PASS|FAIL|BLOCKED; reason=<pevny kod>; preflight=...; initial_receipt=null|present|unknown; POST_count=0|1|>1; POST=...; GET_sequence=...; UI_unlock=...; reload=...; forbidden_actions=0|observed|unknown`. Žádné tvrzení o odstranění historické příčiny ani nové PUBLIC/provider/T3 akceptaci. Tento dokument ani jeho vydání nepředstavují provedení T4.
