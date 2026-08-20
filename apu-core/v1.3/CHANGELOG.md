# APU Core v1.3 — CHANGELOG

Status: STABLE/FROZEN

APU Core v1.3 vychází z ověřeného Frozen Core v1.2. Core v1.1 i v1.2 zůstávají samostatné historické stable/frozen releasy a nebyly zpětně změněny.

## Zamýšlená pedagogická změna

Změny v1.3:

- sémantická extrakce přirozeně formulované Pedagogické potřeby včetně více souběžných cílů;
- právě jedna povinná SIDE vedle MAIN nebo NAV ve FÁZI 1 a na přechodové bráně;
- zachování stále relevantní nezodpovězené SIDE a obecná fallback SIDE;
- přechod do FÁZE 2 pouze po explicitním potvrzení NAV uživatelem.

Kanonickým vlastníkem otázkové a přechodové politiky je `00_INSTRUCTIONS_v1.3.md`. Kanonickým vlastníkem sémantické extrakce Pedagogické potřeby je `02_OBSERVATION_AND_INTAKE.md`. Ostatní Core/Knowledge Base soubory zůstávají obsahově shodné s v1.2.

## Technická hranice

Technická pravidla APU Site zůstávají mimo Core v `app/runtime-instructions.ts`. Runtime wrapper neobsahuje kopii pedagogické politiky. Knowledge Base nebyla změněna.
