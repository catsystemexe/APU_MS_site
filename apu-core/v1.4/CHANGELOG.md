# APU Core v1.4 — CHANGELOG

Status: STABLE/FROZEN

APU Core v1.4 vychází z ověřeného Frozen Core v1.3. Starší releasy zůstávají samostatné historické stable/frozen verze a nebyly zpětně změněny.

## Zamýšlená pedagogická změna

Změny v1.4:

- po splnění minima se SIDE zobrazuje před NAV; navigační nabídka přechodu je poslední;
- SIDE se nepokládá znovu, pokud už odpověď obsahuje odpovídající kategorie kanonického Zápisníku;
- přechod do FÁZE 2 probíhá po explicitním potvrzení uživatelem přes NAV nebo rovnocenný jednoznačný pokyn v chatu.

Kanonickým vlastníkem otázkové a přechodové politiky je `00_INSTRUCTIONS_v1.4.md`. Kanonickým vlastníkem sémantické extrakce Pedagogické potřeby zůstává `02_OBSERVATION_AND_INTAKE.md`. Ostatní Core/Knowledge Base soubory zůstávají obsahově shodné s v1.3.

## Technická hranice

Technická pravidla APU Site zůstávají mimo Core v `app/runtime-instructions.ts`. Runtime wrapper neobsahuje kopii pedagogické politiky. Knowledge Base nebyla změněna.
