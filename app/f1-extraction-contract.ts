import { CATEGORY_IDS, F2_PATHS, locateSourceQuote, type CategoryId, type F2Path } from "./notepad-model.ts";

export const PRODUCTION_EXTRACTION_MODEL = "gpt-5.6-luna";
export const PRODUCTION_EXTRACTION_REASONING = "low" as const;
export const PRODUCTION_GROUNDING_RESCUE_MODEL = "gpt-5.6-luna";
export const PRODUCTION_GROUNDING_RESCUE_REASONING = "low" as const;
export const MAX_EXTRACTION_MESSAGE_LENGTH = 12_000;
export const MAX_EXTRACTION_NOTEBOOK_ITEMS = 80;

const EXTRACTION_RULES = `Jsi přesná a úplná extrakční vrstva Zápisníku pedagogického asistenta APU. Neodpovídáš uživateli ani neposkytuješ rady; mapuješ pouze explicitní obsah newUserMessage.

1. ONTOLOGIE KATEGORIÍ
- manifestations — Projevy: explicitně pozorovatelný stav, chování, výrok nebo reakce; nikoli diagnóza, příčina, vlastnost či odvozený záměr.
- context — Kontext: explicitní situace, prostředí, osoba, předcházející okolnost nebo podmínka. Rozhoduje sémantická role, ne povrchová předložka.
- course — Průběh: vlastnost průběhu projevu, tedy četnost, trvání, intenzita, latence/počátek nebo vývoj v čase. Vnější podmínka či zásah není course.
- goals — Pedagogická potřeba: pedagogem explicitně vyjádřená potřeba, otázka, cíl nebo požadované porozumění; nikdy domnělá potřeba dítěte ani cíl odvozený ze závažnosti problému.
- helps — Zkušenosti: vztahová projekce explicitně pozorované zkušenosti, kde postup, podmínka, změna nebo kontrast A je ve zdroji spojen s pozorovaným účinkem, změnou či rozdílným výsledkem B. B může být příznivý, nepříznivý, neutrální nebo diferenciální; slovo „pomáhá“ není nutné. Pouhá souběžná přítomnost context a manifestation/course vztah helps sama nezakládá.

2. ÚPLNOST A DŮKAZY
- Zapisuj jen význam výslovně podložený newUserMessage. Nevytvářej diagnózy, příčiny, záměry, doporučení, potřeby, projevy, kontext, četnost ani závažnost. Nálepky „líný“, „drzý“, „zlobivý“, „neschopný“ či „manipulativní“ nejsou samy manifestations. Explicitní „je apatický“ manifestations být může, ale nesmíš z něj odvodit další chování.
- Před generováním candidates povinně projdi všech pět kategorií nezávisle. categoryReview.<category>=found právě tehdy, když pro kategorii vracíš alespoň jeden add, duplicate, conflict nebo skip; jinak none. Fakt nevynechávej proto, že jiná kategorie již zachytila část stejné věty.
- sourceQuote je přesný souvislý podřetězec newUserMessage s původním zněním a diakritikou. Každý podstatný predikát a vztah v notebookText musí mít v sourceQuote dostatečný důkaz; překrývající se sourceQuote pro více atomů jsou dovoleny.
- Při rozdělení koordinace zachovej řídící predikát v důkazním úseku: z „odstrkuje věci i lidi kolem sebe“ nesmí atom „Odstrkuje lidi kolem sebe.“ citovat jen „lidi kolem sebe“. Pokud notebookText normalizuje řeč, sdělení či vnímání, zahrň i doložený řídící predikát: „začne křičet, že to neumí“ může podpořit „Křičí, že to neumí.“, samotné „že to neumí“ nepodporuje nově přidané „Říká“.
- notebookText smí jen stručně a beze ztráty normalizovat gramatiku; nesmí přidat fakt, vztah ani míru. U samostatného úplného výroku preferuj zdrojový čas a vid: „obvykle zhorší“ ponech jako „obvykle zhorší“.

3. ATOMIZACE A ROZSAH
- Jeden candidate představuje jeden samostatný sémantický fakt. Jedna věta či sourceQuote může podpořit více faktů i kategorií; významově odlišných explicitních projevů rozděl na samostatné candidates a skutečnou parafrázi téhož projevu vrať jen jednou. „unavený“, „apatický“, „málo komunikuje“, „odmítá úkoly“ a „špatně se soustředí“ jsou odlišné projevy.
- Při atomizaci neměň sémantickou roli ani vztah a neodstraňuj řídící predikát, podmínku nebo materiální kvalifikátor. Zachovej negaci, nejistotu a rozsah výrazů jako „někdy“, „jindy“, „obvykle“, „ne vždy“ či „jen někdy“ u větve, kterou řídí.
- Pouhá koordinace nebo pořadí A a B neznamená A potom B, A kvůli B ani A způsobuje B. Nepřidávej časový, kauzální, podmínkový či následkový vztah, který zdroj výslovně neuvádí.
- Podmínka „když“, „pokud“, „bez“ nebo jiná explicitní podmínka omezuje svůj důsledek. Samostatný context atom podmínky neopravňuje vydat podmíněný důsledek za nepodmíněné manifestations; celý doložený vztah může být helps.

4. HRANICE KATEGORIÍ
- Course může být samostatný kategoriální atom „Občas.“, „Velmi silné.“, „Každé ráno.“ nebo „Po pár minutách.“, pokud newUserMessage jednoznačně uvádí příslušný projev. Latence „Po pár minutách.“ je úplná. Holé „Deset minut.“ je neúplné, když neříká, co trvá; tehdy zachovej predikát „Vydrží deset minut.“.
- „Bez přípravy.“ a „Po krátkém upozornění.“ jsou v konstrukci podmínka–reakce context, ne course. Předmět „řízenou činnost“ ve „zvládne řízenou činnost“ nesmí vzniknout jako context „Při řízené činnosti.“. Skutečné příslovečné určení „jednotlivě“ lze minimálně doplnit na context „Při práci jednotlivě.“.
- Pedagogickou potřebu zapisuj jen tehdy, když pedagog explicitně vyjádří požadavek, otázku či cíl. Samotný popis obtíže, četnosti nebo závažnosti nikdy není pedagogickou potřebou a neznamená „potřebuji poradit“ ani „chci situaci pochopit“.
- Helps vyžaduje explicitně spojenou zkušenost A→pozorovaný výsledek B, nikoli nevyzkoušené návrhy APU ani pouhou kontextovou souběžnost. Platí pro zlepšení, zhoršení, žádnou změnu, rozdíl i explicitní změnu stavu; pozorovaný vztah nezesiluj na kauzalitu.
- Pokud jedna explicitní podmínka řídí více koordinovaných výsledků stejné zkušenosti, vztahový helps candidate zachová všechny materiální výsledky. To neruší samostatné manifestations atomy a nevytváří mezi výsledky pořadí.

5. ZÁPISNÍK, AKCE A SITUACE
- Stejný význam ve stejné kategorii: action=duplicate a relatedEntryId. Duplicita je výhradně kategoriální; existující manifestation neblokuje nový context, course, goal ani helps. Rozpor nebo aktualizace: action=conflict a relatedEntryId; nic tiše nepřepisuj. Pouze interpretační, nerelevantní či jinak nepoužitelný návrh: action=skip.
- currentNotebook používej pro návaznost, jednoznačnou elipsu/koreferenci, deduplikaci a konflikt; unconfirmed položku nepovažuj za nezávislý důkaz pravdivosti. Každý nový podstatný candidate musí dokládat newUserMessage.
- situationRelation: same = stejná aktivní situace a také první použitelná zpráva při prázdném Zápisníku; related = pokračování či relevantní doplnění; different = zjevně jiný žák nebo materiálně jiný problém; uncertain = skutečná nejasnost mezi těmito možnostmi. Samotné vynechání podmětu není důvod pro uncertain ani different. Elipsa jako „děje se to“, „hlavně odpoledne“ či „pomáhá mu“ sama neznamená different/uncertain. „Děje se to ve vyučování, každý den, zejména v odpoledních hodinách“ je related; z „Děje se to každý den“ NEVRACEJ duplicate manifestations. Při different kandidáty vrať, aplikace je bez potvrzení nezapíše.

KANONICKÉ HRANICE
- z explicitního „žák je apatický“ smíš přijmout pouze manifestations „Žák je apatický.“, ne odvozené chování.
- „Někdy tomu předchází konflikt s dítětem, jindy požadavek učitelky nebo velký hluk.“ → druhé dvě context větve zachovají „Jindy“, nikdy „Někdy“.
- „Ve skupině úkol odmítne, jednotlivě ho dokončí a požádá o další.“ → manifestations „Úkol odmítne.“, „Úkol dokončí.“, „Požádá o další.“; context „Ve skupině.“, „Při práci jednotlivě.“; helps „Při práci jednotlivě úkol dokončí a požádá o další.“. Nikdy „Po dokončení úkolu požádá o další.“.
- „Když dostane obrázkový plán, přechod zvládne klidněji.“ → context podmínky a helps vztahu; ne nepodmíněné manifestations „Přechod zvládne klidněji.“.
- „Bez přípravy začne při změně protestovat, ale po krátkém upozornění přejde bez křiku.“ → oba úseky jsou context+explicitní helps (nepříznivý/příznivý), nikoli course; nikdy „Absence přípravy způsobuje protest.“.
- „Po přesazení už nekřičí.“ je explicitní změna vhodná pro helps. „Při samostatné práci vydrží deset minut.“ podporuje context „Při samostatné práci.“ a course „Vydrží deset minut.“, ale bez explicitního účinku, změny či rozdílu samo nevytváří helps.
- „Jindy po pár minutách odbíhá.“ → manifestations „Jindy odbíhá.“ a course „Po pár minutách.“; „Deset minut.“ bez nutného predikátu zůstává neúplné.
- „Napomenutí před třídou situaci obvykle zhorší.“ → source-faithful helps se zachovaným „obvykle zhorší“; žádné kauzální zesílení.`;

const GROUNDING_RULES = `Jsi nezávislá kontrolní brána automatického zápisu do Zápisníku APU. Nemáš přístup k odpovědi asistenta a nesmíš přidávat pedagogické možnosti. Ověřuj kandidáty podle stejné ontologie jako extrakce.

1. SPOLEČNÁ ONTOLOGIE
- manifestations: explicitně pozorovatelný stav, chování, výrok či reakce; ne diagnóza, příčina, trait label ani odvozený záměr.
- context: explicitní situace, prostředí, osoba, předcházející okolnost nebo podmínka; rozhoduje sémantická role.
- course: četnost, trvání, intenzita, latence/počátek nebo vývoj samotného projevu; ne vnější podmínka či zásah.
- goals: pedagogem explicitně vyjádřená potřeba, otázka, cíl či požadované porozumění; ne potřeba odvozená z problému.
- helps: explicitní zkušenostní vztah mezi postupem, podmínkou, změnou či kontrastem a pozorovaným účinkem nebo rozdílným výsledkem. Účinek může být příznivý, nepříznivý, neutrální či diferenciální; samotná kontextová souběžnost nestačí.

2. DŮKAZ, VÝZNAM A ROZSAH
Kandidáta přijmi jen pokud všechny následující podmínky platí:
- notebookText je přímo a jednoznačně podložen newUserMessage a jeho category odpovídá ontologii; nepřidává diagnózu, příčinu, záměr, doporučení, potřebu, okolnost, četnost ani míru.
- sourceQuote je skutečným dostatečným podkladem pro celý notebookText: musí být přesný souvislý podřetězec a dokládat každý podstatný predikát a vztah. Celou zprávu použij pro jednoznačnou elipsu/koreferenci a pro význam samostatného kategoriálního modifikátoru, ne k doplnění chybějícího predikátu. „lidi kolem sebe“ samo nepodporuje „Odstrkuje lidi kolem sebe.“ a „že to neumí“ samo nepodporuje nově přidané „Říká“; širší překrývající se quote s řídícím predikátem je správně.
- Atom zachovává gramatickou roli, negaci, nejistotu a rozsah každého kvalifikátoru či podmínky. „Někdy“ nesmí nahradit branch-local „jindy“; důsledek omezený „když“, „pokud“ či „bez“ nesmí být nepodmíněný. Samostatný context candidate tuto ztrátu rozsahu neopravuje.
- Koordinace ani pořadí samy nepřidávají časový, kauzální či následkový vztah. „dokončí a požádá“ nepodporuje „Po dokončení požádá“.
- Přeformulování pouze gramaticky zpřesňuje doložený význam. U explicitně habituálního výroku mohou „obvykle zhorší“ a „obvykle zhoršuje“ vyjadřovat totéž, jen pokud se nemění frekvenční rozsah, modalita, polarita, podmět, děj ani účinek; neplatí to pro skutečně časový, dokončený, plánovaný či hypotetický význam.

3. KATEGORIÁLNÍ HRANICE
- z „žák je líný“ nelze přijmout konkrétní projevy; hodnotící „líný“, „drzý“ či „manipulativní“ zamítni jako manifestations. Explicitní „je apatický“ přijmi bez odvozování dalších projevů.
- Goals bez výslovného pedagogického požadavku, otázky či cíle zamítni.
- Course „Občas.“, „Velmi silné.“, „Každé ráno.“ a „Po pár minutách.“ přijmi, pokud newUserMessage jednoznačně uvádí příslušný projev; „Po pár minutách.“ je úplná latence. Holé „Deset minut.“ zamítni, když není určeno, co trvá; „Vydrží deset minut.“ je úplné. „Bez přípravy.“ a „Po krátkém upozornění.“ jsou v podmínkové konstrukci context, ne course.
- Předmět „řízenou činnost“ nepodporuje context „Při řízené činnosti.“. Skutečné příslovečné „jednotlivě“ může podporovat minimálně doplněné context „Při práci jednotlivě.“.
- Helps přijmi pouze při explicitním spojení zkušenosti A s výsledkem B. Přijmi zlepšení, zhoršení, neutrální/diferenciální výsledek i explicitní změnu; není nutné slovo „pomáhá“ ani záměrně podpůrný postup. Zamítni nevyzkoušený návrh, samotnou podmínku, pouhou souběžnost a kauzální zesílení, které zdroj netvrdí.

4. KANONICKÁ ROZHODNUTÍ
- „Když dostane obrázkový plán, přechod zvládne klidněji.“: přijmi context a úplný helps vztah; zamítni nepodmíněné manifestations „Přechod zvládne klidněji.“.
- „Bez přípravy začne při změně protestovat“ a „po krátkém upozornění přejde bez křiku“: přijmi jako nepříznivý/příznivý helps a context, ne course; zamítni „Absence přípravy způsobuje protest.“.
- „Po přesazení už nekřičí.“: může být helps jako explicitní změna. „Při samostatné práci vydrží deset minut.“: přijmi context a úplné course, ale bez doložené změny, rozdílu či účinku zamítni helps.
- „jindy po pár minutách odbíhá“: přijmi course „Po pár minutách.“. „při samostatné práci vydrží deset minut“: zamítni course „Deset minut.“, přijmi „Vydrží deset minut.“.
- „Napomenutí před třídou situaci obvykle zhorší.“: přijmi source-faithful helps a nezamítej ekvivalentní habituální „obvykle zhoršuje“ jen kvůli tvaru slovesa.

currentNotebook používej jen pro návaznost, jednoznačnou elipsu/koreferenci, deduplikaci a konflikt. trust=unconfirmed není nezávislý důkaz; každý nový podstatný fakt musí dokládat newUserMessage. Buď konzervativní: při skutečné pochybnosti kandidáta zamítni.`;

export const GROUNDING_RESCUE_REASON_CATEGORIES = [
  "accept_shared_subject",
  "accept_shared_context",
  "accept_shared_predicate",
  "accept_coreference",
  "accept_relational_coordination",
  "accept_context_completion",
  "reject_modifier_only",
  "reject_unsupported_meaning",
  "reject_category_mismatch",
  "reject_semantic_strengthening",
  "reject_ambiguous_coreference",
  "reject_inferred_relation",
  "reject_unsupported_helps",
  "reject_other",
] as const;
export type GroundingRescueReasonCategory = typeof GROUNDING_RESCUE_REASON_CATEGORIES[number];

const GROUNDING_RESCUE_ACCEPT_REASONS = new Set<GroundingRescueReasonCategory>([
  "accept_shared_subject",
  "accept_shared_context",
  "accept_shared_predicate",
  "accept_coreference",
  "accept_relational_coordination",
  "accept_context_completion",
]);

export const GROUNDING_RESCUE_INSTRUCTIONS = `Jsi úzká záchranná kontrola grounding vrstvy automatického zápisu do pedagogického Zápisníku APU. Neměníš primární grounding. Dostáváš výhradně kandidáty, které primární grounding explicitně zamítl.

ÚZKÁ OTÁZKA:
Přijmi kandidáta pouze tehdy, když byl zamítnut výhradně proto, že jeho lokální sourceQuote je užší než jinak explicitní a jednoznačný gramatický vztah ve stejné newUserMessage. Neprováděj obecné nové grounding posouzení. Při pochybnosti zamítni.

POVOLENÉ ZÁCHRANNÉ TŘÍDY:
1. SHARED SUBJECT — sourceQuote už obsahuje substantivní predikát nebo děj a pouze dědí explicitní podmět ze stejné koordinované věty.
2. SHARED PREPOSED CONTEXT — sourceQuote už obsahuje substantivní predikát nebo děj a pouze dědí jednoznačně společný předřazený kontext z koordinace.
3. SHARED GOVERNING PREDICATE — obsahový člen koordinace dědí jeden explicitní řídící predikát ze stejné klauze.
4. UNAMBIGUOUS COREFERENCE — propozice už je v sourceQuote a pouze se rozvine explicitní zájmeno nebo reference s jediným možným referentem ve stejné zprávě.
5. EXPLICIT RELATIONAL COORDINATION — obsahový člen koordinace dědí výslovně uvedený vztah. Zachovej podporované kvalifikátory jednotlivých větví, například někdy nebo jindy.
6. EXPLICIT CONTEXT COMPLETION — sourceQuote obsahuje substantivní vztahový predikát a notebookText pouze doplní jeho jednoznačně explicitní kontext ze stejné klauze.

TVRDÝ ZÁKAZ MODIFIER-ONLY:
Vždy zamítni kandidáta, pokud sourceQuote obsahuje pouze frekvenci, trvání, intenzitu, míru, časové určení, příslovce způsobu nebo podobný modifikátor a notebookText do něj přidává substantivní predikát či děj, který v sourceQuote chybí.
- „přibližně po dvou minutách“ NESMÍ zachránit „Vrací se přibližně po dvou minutách.“
- „někdy“ NESMÍ zachránit „Někdy zvládne celou řízenou činnost.“
- „jindy“ NESMÍ zachránit „Jindy po pár minutách odbíhá.“
- Z „někdy tomu předchází konflikt s dítětem, jindy požadavek učitelky nebo velký hluk“ NESMÍ sourceQuote „požadavek učitelky“ zachránit „Někdy tomu předchází požadavek učitelky.“; kvalifikátor jindy se nesmí změnit na někdy.
- „rychle“ NESMÍ zachránit „Rychle se přestane soustředit.“
- „po pár minutách“ NESMÍ zachránit „Odbíhá po pár minutách.“

ATOMIZACE A KVALIFIKÁTORY:
Jedna source span může legitimně vytvořit více kategoriálně specifických atomických faktů. Z „Žák každé ráno usíná“ může vzniknout manifestations „Žák usíná.“ a course „Každé ráno.“. Nevyžaduj, aby atom manifestations opakoval samostatný course/context údaj. Současně nikdy neodstraň kvalifikátor, který materiálně mění právě reprezentovanou atomickou propozici.

DALŠÍ TVRDÁ ZAMÍTNUTÍ:
- nepodložená diagnóza, příčina, záměr, potřeba, interpretace nebo doporučení;
- změna kategorie;
- nejednoznačná koreference;
- přidaná negace, odstraněná materiální negace nebo nepodložená změna nejistoty;
- kauzální či časový vztah odvozený pouze z pořadí výpovědi;
- helps bez explicitní podmínky nebo změny a jejího pozorovaného účinku.

„jednotlivě ho dokončí a požádá o další“ NESMÍ zachránit „Po dokončení úkolu požádá o další.“

PŘÍKLADY POVOLENÉ ZÁCHRANY:
- „Robin při práci vstane, odloží tužku.“ + sourceQuote „odloží tužku“ → „Robin odloží tužku.“
- „Sára při obědě křičí a bouchá do stolu.“ + sourceQuote „bouchá do stolu“ → „Sára při obědě bouchá do stolu.“
- „Pomohlo až klidnější místo a přítomnost známé učitelky.“ + sourceQuote „přítomnost známé učitelky“ → „Pomohla přítomnost známé učitelky.“
- „... uteče ze třídy; potřebuji ověřit, zda tomu předchází hluk.“ dovoluje jednoznačně rozvinout „tomu“ jako útěk ze třídy.
- „někdy tomu předchází konflikt s dítětem, jindy požadavek učitelky nebo velký hluk“ dovoluje jednotlivé explicitní kontextové větve při zachování někdy/jindy.
- „Častěji se to stává před ostatními dětmi“ dovoluje doplnit explicitní kontext, pokud sourceQuote obsahuje substantivní vztahový predikát, nikoli pouhé „častěji“.

Každému verdiktu přiřaď právě jednu reasonCategory z povoleného enumu. accepted=true smí používat jen accept_* kategorii; accepted=false jen reject_* kategorii. Vrať právě jeden verdikt pro každý vstupní index, bez duplicit a mezer.`;

export function buildExtractionInstructions(intakeCore: string) {
  return `${intakeCore}\n\n${EXTRACTION_RULES}`.trim();
}

export function buildGroundingInstructions(intakeCore: string) {
  return `${intakeCore}\n\n${GROUNDING_RULES}`.trim();
}

export const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["situationRelation", "situationReason", "categoryReview", "candidates"],
  properties: {
    situationRelation: { type: "string", enum: ["same", "related", "different", "uncertain"] },
    situationReason: { type: ["string", "null"] },
    categoryReview: {
      type: "object",
      additionalProperties: false,
      required: CATEGORY_IDS,
      properties: {
        manifestations: { type: "string", enum: ["found", "none"] },
        goals: { type: "string", enum: ["found", "none"] },
        context: { type: "string", enum: ["found", "none"] },
        course: { type: "string", enum: ["found", "none"] },
        helps: { type: "string", enum: ["found", "none"] },
      },
    },
    candidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "sourceQuote", "notebookText", "action", "relatedEntryId", "reason"],
        properties: {
          category: { type: "string", enum: CATEGORY_IDS },
          sourceQuote: { type: "string" },
          notebookText: { type: "string" },
          action: { type: "string", enum: ["add", "duplicate", "conflict", "skip"] },
          relatedEntryId: { type: ["string", "null"] },
          reason: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

export const GROUNDING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdicts"],
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "accepted", "reason"],
        properties: {
          index: { type: "integer", minimum: 0 },
          accepted: { type: "boolean" },
          reason: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

export const GROUNDING_RESCUE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdicts"],
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "accepted", "reasonCategory", "reason"],
        properties: {
          index: { type: "integer", minimum: 0 },
          accepted: { type: "boolean" },
          reasonCategory: { type: "string", enum: GROUNDING_RESCUE_REASON_CATEGORIES },
          reason: { type: "string" },
        },
      },
    },
  },
} as const;

export type ExtractionNotebookInput = {
  category: CategoryId;
  id: string;
  text: string;
  trust: "confirmed" | "unconfirmed";
};

export type ExtractionCandidate = {
  category: CategoryId;
  sourceQuote: string;
  notebookText: string;
  action: "add" | "duplicate" | "conflict" | "skip";
  relatedEntryId: string | null;
  reason: string | null;
  needMapping?: { f2Path: F2Path; f3Target: null };
};

export type RawExtraction = {
  situationRelation: "same" | "related" | "different" | "uncertain";
  situationReason: string | null;
  categoryReview: Record<CategoryId, "found" | "none">;
  candidates: ExtractionCandidate[];
};

export type GroundingVerdict = { index: number; accepted: boolean; reason: string | null };

export type GroundingRescueVerdict = {
  index: number;
  accepted: boolean;
  reasonCategory: GroundingRescueReasonCategory;
  reason: string;
};

export function validateGroundingRescueVerdicts(value: unknown, submittedCount: number) {
  if (!value || typeof value !== "object" || !Array.isArray((value as { verdicts?: unknown }).verdicts)) throw new Error("Grounding rescue response must contain verdicts.");
  const verdicts = (value as { verdicts: unknown[] }).verdicts;
  if (verdicts.length !== submittedCount) throw new Error(`Grounding rescue verdict completeness failed: expected ${submittedCount}, received ${verdicts.length}.`);
  const byIndex = new Map<number, GroundingRescueVerdict>();
  for (const raw of verdicts) {
    if (!raw || typeof raw !== "object") throw new Error("Grounding rescue verdict is not an object.");
    const verdict = raw as Partial<GroundingRescueVerdict>;
    if (!Number.isInteger(verdict.index) || verdict.index! < 0 || verdict.index! >= submittedCount) throw new Error(`Grounding rescue verdict index is out of range: ${String(verdict.index)}.`);
    if (byIndex.has(verdict.index!)) throw new Error(`Grounding rescue verdict index is duplicated: ${verdict.index}.`);
    if (typeof verdict.accepted !== "boolean" || typeof verdict.reason !== "string" || !GROUNDING_RESCUE_REASON_CATEGORIES.includes(verdict.reasonCategory as GroundingRescueReasonCategory)) throw new Error(`Grounding rescue verdict ${verdict.index} has an invalid contract.`);
    if (GROUNDING_RESCUE_ACCEPT_REASONS.has(verdict.reasonCategory as GroundingRescueReasonCategory) !== verdict.accepted) throw new Error(`Grounding rescue verdict ${verdict.index} has an incompatible accepted/reasonCategory pair.`);
    byIndex.set(verdict.index!, verdict as GroundingRescueVerdict);
  }
  for (let index = 0; index < submittedCount; index += 1) if (!byIndex.has(index)) throw new Error(`Grounding rescue verdict completeness failed: missing index ${index}.`);
  return { verdicts: [...byIndex.values()].sort((left, right) => left.index - right.index) };
}

export type MonotonicGroundingResult = {
  acceptedIndexes: Set<number>;
  primaryAcceptedIndexes: Set<number>;
  rescueCandidateOriginalIndexes: number[];
  rescueAttempted: boolean;
  rescueSucceeded: boolean;
};

function primaryGroundingIndexes(value: unknown, candidateCount: number) {
  if (!Array.isArray(value)) return { validApplicationResult: false, acceptedIndexes: new Set<number>(), explicitRejectedIndexes: [] as number[] };
  const acceptedIndexes = new Set<number>();
  const rejectedCounts = new Map<number, number>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const verdict = raw as Partial<GroundingVerdict>;
    if (!Number.isInteger(verdict.index) || verdict.index! < 0 || verdict.index! >= candidateCount || typeof verdict.accepted !== "boolean") continue;
    if (verdict.accepted) acceptedIndexes.add(verdict.index!);
    else rejectedCounts.set(verdict.index!, (rejectedCounts.get(verdict.index!) ?? 0) + 1);
  }
  const explicitRejectedIndexes = [...rejectedCounts.entries()]
    .filter(([index, count]) => count === 1 && !acceptedIndexes.has(index))
    .map(([index]) => index)
    .sort((left, right) => left - right);
  return { validApplicationResult: true, acceptedIndexes, explicitRejectedIndexes };
}

export async function applyMonotonicGroundingRescue<T>(
  candidates: T[],
  primaryVerdicts: unknown,
  callRescue: (rescueCandidates: T[]) => Promise<unknown>,
): Promise<MonotonicGroundingResult> {
  const primary = primaryGroundingIndexes(primaryVerdicts, candidates.length);
  const fallback = (): MonotonicGroundingResult => ({
    acceptedIndexes: new Set(primary.acceptedIndexes),
    primaryAcceptedIndexes: new Set(primary.acceptedIndexes),
    rescueCandidateOriginalIndexes: [...primary.explicitRejectedIndexes],
    rescueAttempted: false,
    rescueSucceeded: false,
  });
  if (!primary.validApplicationResult || primary.explicitRejectedIndexes.length === 0) return fallback();
  const rescueCandidates = primary.explicitRejectedIndexes.map((index) => candidates[index]);
  try {
    const rescue = validateGroundingRescueVerdicts(await callRescue(rescueCandidates), rescueCandidates.length);
    const acceptedIndexes = new Set(primary.acceptedIndexes);
    for (const verdict of rescue.verdicts) if (verdict.accepted) acceptedIndexes.add(primary.explicitRejectedIndexes[verdict.index]);
    return {
      acceptedIndexes,
      primaryAcceptedIndexes: new Set(primary.acceptedIndexes),
      rescueCandidateOriginalIndexes: [...primary.explicitRejectedIndexes],
      rescueAttempted: true,
      rescueSucceeded: true,
    };
  } catch {
    return { ...fallback(), rescueAttempted: true };
  }
}

export type LocatedExtractionCandidate = ExtractionCandidate & { start: number; end: number };

export function normalizeExtractionCandidates(
  message: string,
  notebook: ExtractionNotebookInput[],
  candidates: ExtractionCandidate[],
): LocatedExtractionCandidate[] {
  return candidates.flatMap((rawCandidate) => {
    const candidate = { ...rawCandidate };
    const location = locateSourceQuote(message, candidate.sourceQuote);
    if (!location) return [];
    const relatedExistsInCategory = candidate.relatedEntryId === null || notebook.some(
      (entry) => entry.id === candidate.relatedEntryId && entry.category === candidate.category,
    );
    if (!relatedExistsInCategory) candidate.relatedEntryId = null;
    if ((candidate.action === "duplicate" || candidate.action === "conflict") && !candidate.relatedEntryId) {
      candidate.action = "add";
      candidate.reason = "Vazba na existující řádek nepatřila do stejné kategorie; údaj se posuzuje jako nový.";
    }
    return [{ ...candidate, ...location }];
  });
}

export function extractResponseText(response: Record<string, unknown>) {
  if (typeof response.output_text === "string") return response.output_text;
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown }).content)
      ? (item as { content: unknown[] }).content
      : [];
    for (const part of content) {
      if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
    }
  }
  return null;
}

export function validateExtractionNotebook(value: unknown): ExtractionNotebookInput[] | null {
  if (!Array.isArray(value) || value.length > MAX_EXTRACTION_NOTEBOOK_ITEMS) return null;
  const valid = value.every((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const item = entry as Partial<ExtractionNotebookInput>;
    return typeof item.id === "string" && item.id.length <= 120 &&
      typeof item.text === "string" && item.text.length <= 2_000 &&
      (item.trust === "confirmed" || item.trust === "unconfirmed") &&
      typeof item.category === "string" && CATEGORY_IDS.includes(item.category as CategoryId);
  });
  return valid ? value as ExtractionNotebookInput[] : null;
}

export function isSupportedExtractionPath(value: unknown): value is F2Path {
  return typeof value === "string" && F2_PATHS.includes(value as F2Path);
}
