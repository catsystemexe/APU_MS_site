APU – prototypální hosting, přístupy a Shared Feedback – roadmapa

Status: návrh realizačního plánu  
Účel: vytvořit jednoduchý sdílený prototyp APU dostupný přes URL pro interní vývoj a následně pro omezenou skupinu testerů, bez zbytečného budování produkční uživatelské infrastruktury.

1\. CÍLOVÝ STAV

APU bude nasazené na Cloudflare a dostupné přes stabilní URL. Přístup bude chráněn Cloudflare Access, aby veřejnost nemohla spotřebovávat OpenAI API prostředky.

Budou existovat dva logické režimy přístupu v jedné aplikaci:  
\- Developer: Michal \+ Zdena. Navíc vidí interní diagnostiku a Shared Feedback.  
\- Tester: běžní pilotní uživatelé. Vidí pouze standardní produktové UI.

Nebude se zatím zavádět vlastní databáze uživatelů, vlastní systém hesel, billing, role management ani per-user historie.

2\. DEVELOPER FUNKCE V PROTOTYPU

Developer režim obsahuje pouze:  
\- diagnostické informace u chatových výstupů (např. použitý model, mapování/profil, tokeny/nákladové údaje podle aktuální implementace);  
\- Shared Feedback panel;  
\- současné nastavovací menu modelů se nepovažuje za cílovou developer funkci a může být později odstraněno podle vývoje routingu/model-selection logiky.

Developer režim není samostatná verze aplikace. Jde o stejný deployment se skrytými/podmíněně zobrazenými developer prvky.

3\. SHARED FEEDBACK – PRODUKTOVÝ NÁVRH

Vstup do Shared Feedback:  
\- výrazná samostatná ikona mimo standardní produktové UI, preferovaně žlutý výstražný trojúhelník;  
\- po kliknutí se otevře fullscreen panel.

Obsah panelu:  
\- jedna hlavní karta/seznam;  
\- jednotlivé záznamy jako accordion;  
\- ve sbaleném stavu pouze typ/ikona \+ nadpis \+ stav;  
\- po rozbalení se zobrazí strukturovaný obsah výstupního protokolu;  
\- jednoduchá změna stavu;  
\- krátká textová poznámka/reaction;  
\- bez komentářových vláken, chatu, assignmentu, priority systému nebo komplexního issue managementu.

Předběžné stavy:  
\- NOVÉ  
\- ŘEŠÍME  
\- PROBRAT  
\- HOTOVO  
\- ZAMÍTNUTO

Předběžné typy:  
\- BUG  
\- ÚPRAVA  
\- NEJASNOST  
\- NÁVRH

4\. ZDROJ PODNĚTŮ

AppuShare zachová současný workflow:  
Zdena ↔ ChatGPT v AppuShare → společné vytříbení podnětu → strukturovaný výstupní protokol.

Namísto nebo vedle současného zápisu na Google Drive má AppuShare zapisovat strojově čitelný záznam do GitHub repozitáře APU\_MS\_site.

Preferovaný V1 datový formát:  
\- jeden strukturovaný soubor (např. shared-feedback.json), nikoli samostatný soubor pro každou zprávu;  
\- každý záznam má stabilní ID;  
\- minimálně: id, type, title, createdAt, content, status, note;  
\- přesné umístění v repu se určí až při implementaci podle skutečné struktury projektu.

5\. DŮLEŽITÝ TECHNICKÝ BOD – PERSISTENCE REAKCÍ

Pouhé načítání JSON souboru z repa je jednoduché pro čtení, ale hosted aplikace nemůže spoléhat na lokální soubor jako trvalé úložiště změn stavu a poznámek.

Před implementací Shared Feedback proto musí proběhnout krátké technické rozhodnutí o nejjednodušší persistenci reakcí Michal/Zdena.

Preferované pořadí k posouzení:  
1\. velmi malá Cloudflare persistence vrstva vhodná pro status \+ note;  
2\. server-side zápis zpět do GitHub souboru;  
3\. jiné řešení pouze pokud první dvě varianty vytvoří nepřiměřenou složitost.

Kritérium: nejnižší implementační a provozní složitost, nikoli maximální obecnost.

6\. ROADMAPA IMPLEMENTACE

FÁZE A – HOSTING BASELINE  
Cíl: dostat aktuální APU na stabilní vzdálenou URL bez změny produktové logiky.

Kroky:  
1\. Ověřit současnou Cloudflare/Wrangler konfiguraci v APU\_MS\_site.  
2\. Zvolit deployment branch pro prototyp.  
3\. Založit Cloudflare projekt a propojit jej s repozitářem.  
4\. Nastavit potřebné server-side secrets pro APU bez jejich vložení do repa.  
5\. Nasadit aktuální aplikaci.  
6\. Ověřit běh chatového flow a OpenAI API přes vzdálenou URL.

Výstup: funkční vzdálená APU URL.

FÁZE B – ACCESS CONTROL  
Cíl: zabránit anonymnímu používání APU a nekontrolované spotřebě API.

Kroky:  
1\. Zapnout Cloudflare Access před APU.  
2\. Nastavit jednoduchou identity policy, preferovaně e-mail/OTP nebo jiný nízkoúdržbový mechanismus.  
3\. Povolit Michala a Zdenu jako interní uživatele.  
4\. Připravit tester access group pro pilotní uživatele.  
5\. Ověřit, že nepřihlášený uživatel se k APU ani API flow nedostane.

Výstup: APU dostupné pouze autorizovaným uživatelům.

FÁZE C – DEVELOPER VS TESTER REŽIM  
Cíl: jedna aplikace, dva pohledy podle identity.

Kroky:  
1\. Ověřit, jakou identity informaci Cloudflare Access předává aplikaci.  
2\. Definovat jednoduché pravidlo developer identity pro Michala a Zdenu.  
3\. Podmíněně zobrazit stávající diagnostické prvky pouze developerům.  
4\. Nezavádět obecný role-management systém.  
5\. Ověřit, že tester nevidí developer UI.

Výstup: developer/tester režim bez samostatných deploymentů.

FÁZE D – APPUSHARE → GITHUB FEEDBACK EXPORT  
Cíl: vytvořit strojově čitelný zdroj Shared Feedback.

Kroky:  
1\. Definovat stabilní schema feedback záznamu.  
2\. Upravit AppuShare instrukce tak, aby při potvrzení/exportu aktualizovaly GitHub zdroj.  
3\. Zajistit stabilní ID a bezpečný update existujícího seznamu.  
4\. Ověřit ručně alespoň několik reálných exportů ze Zdenova workflow.  
5\. Oddělit feedback data od aplikace tak, aby jejich změna nevyžadovala redesign core logiky.

Výstup: GitHub obsahuje aktuální Shared Feedback data.

FÁZE E – SHARED FEEDBACK READ-ONLY UI  
Cíl: developerům zobrazit podněty přímo v APU.

Kroky:  
1\. Načíst feedback data server-side/build-time vhodným způsobem z repa.  
2\. Přidat developer-only ikonku.  
3\. Přidat fullscreen panel.  
4\. Implementovat accordion seznam a render jednotlivých polí.  
5\. Přidat základní filtry nebo řazení jen pokud to bude potřeba pro použitelnost.

Výstup: developer vidí AppuShare feedback přímo v aplikaci.

FÁZE F – STAV \+ POZNÁMKA  
Cíl: Michal a Zdena mohou feedback lehce zpracovávat.

Kroky:  
1\. Vybrat persistence mechanismus pro status/note.  
2\. Přidat změnu stavu.  
3\. Přidat krátkou poznámku.  
4\. Ověřit, že změna přežije reload a redeploy podle zvolené architektury.  
5\. Neimplementovat diskusní vlákna ani plný issue tracker.

Výstup: Shared Feedback funguje jako lehký pracovní inbox.

FÁZE G – PILOT TESTERS  
Cíl: zpřístupnit APU omezené skupině učitelů.

Kroky:  
1\. Přidat pilotní uživatele do Cloudflare Access tester policy.  
2\. Ověřit jejich reálný login flow.  
3\. Ověřit, že nevidí developer prvky.  
4\. Sledovat OpenAI API spotřebu na úrovni celé aplikace.  
5\. Teprve podle reálného pilotu rozhodovat o složitější správě uživatelů.

Výstup: uzavřený pilot bez budování plného SaaS auth systému.

7\. CO SE V TÉTO ROADMAPĚ ZÁMĚRNĚ NEŘEŠÍ

Neimplementovat bez nového rozhodnutí:  
\- vlastní registrace/login/password reset;  
\- per-user API billing nebo quota enforcement;  
\- vlastní databáze účtů;  
\- organizace/školy/týmy;  
\- komentářová vlákna ve Shared Feedback;  
\- komplexní issue tracker;  
\- dlouhodobé ukládání APU projektů uživatelů;  
\- administrační konzole;  
\- více deploymentů jen kvůli developer/tester UI.

8\. DOPORUČENÉ POŘADÍ REALIZACE

1\. Hosting baseline.  
2\. Cloudflare Access.  
3\. Developer/tester rozlišení.  
4\. AppuShare → GitHub export.  
5\. Shared Feedback read-only.  
6\. Persistence status/note.  
7\. Pilot testers.

Každá fáze má být samostatně ověřitelná a nemá preventivně implementovat funkce z pozdějších fází.

