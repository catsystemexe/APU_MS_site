# APU Core v1.2 — CHANGELOG

Status: STABLE/FROZEN

APU Core v1.2 vychází z ověřeného Frozen Core v1.1. Frozen Core v1.1 zůstává samostatný historický stable/frozen release a nebyl zpětně změněn.

## Zamýšlená pedagogická změna

Jedinou pedagogickou změnou je uzavřená politika MAIN/NAV/SIDE pro relevantní intake tahy:

- právě jedna prioritní MAIN nebo NAV;
- MAIN a NAV jsou vzájemně výlučné;
- nejvýše jedna skutečně užitečná SIDE;
- nejvýše dvě samostatně zodpověditelné otázky celkem;
- žádná výplňová SIDE;
- komunikační profily nemění typ ani počet otázek;
- politika se nevynucuje mimo relevantní intake tahy.

Kanonickým vlastníkem politiky je `00_INSTRUCTIONS_v1.2.md`. Ostatní Core/Knowledge Base soubory zůstávají obsahově shodné s v1.1.

## Technická hranice

Technická pravidla APU Site zůstávají mimo Core v `app/runtime-instructions.ts`. Runtime wrapper neobsahuje kopii pedagogické politiky. Knowledge Base nebyla změněna.
