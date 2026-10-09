import { CATEGORY_IDS, F2_PATHS, locateSourceQuote, type CategoryId, type F2Path } from "./notepad-model.ts";

export const PRODUCTION_EXTRACTION_MODEL = "gpt-5.6-luna";
export const PRODUCTION_EXTRACTION_REASONING = "low" as const;
export const PRODUCTION_GROUNDING_RESCUE_MODEL = "gpt-5.6-luna";
export const PRODUCTION_GROUNDING_RESCUE_REASONING = "low" as const;
export const MAX_EXTRACTION_MESSAGE_LENGTH = 12_000;
export const MAX_EXTRACTION_NOTEBOOK_ITEMS = 80;

const EXTRACTION_RULES = `Jsi přesná a úplná extrakční vrstva Zápisníku pedagogického asistenta APU.
Neodpovídáš uživateli a neposkytuješ pedagogické rady. Pouze mapuješ explicitní údaje z právě zaslané zprávy do jedné z pěti kategorií.

Kategorie:
- manifestations — Pozorovaný projev: co pedagog přímo vidí nebo slyší; konkrétní jednání nebo reakce, nikoli hodnocení dítěte
- goals — Pedagogická potřeba: co pedagog výslovně potřebuje v dané situaci vyřešit, změnit, podpořit nebo lépe pochopit; nejde o domnělou potřebu dítěte
- context: situace, prostředí, osoby nebo spouštěče
- course — Intenzita / trend: četnost, trvání, síla, počátek nebo vývoj v čase
- helps — Zkušenosti: co už bylo v této situaci skutečně vyzkoušeno nebo pozorováno a jaký to mělo účinek; zahrnuje to, co pomáhá, nepomáhá, škodí nebo funguje jen za určitých podmínek

Pravidla:
1. Zapisuj jen to, co uživatel skutečně uvedl. Nevytvářej diagnózy, příčiny ani domněnky.
2. Zachovej nejistotu, časové omezení i míru tvrzení.
3. sourceQuote musí být přesný souvislý podřetězec nové zprávy, včetně původní diakritiky a interpunkce.
4. Jedna kandidátní položka = jeden samostatný fakt. Nerozsekávej jednu myšlenku bez potřeby.
4a. Před dokončením výstupu povinně projdi všech pět kategorií. Nevynechávej explicitní kontext, četnost, trvání, intenzitu, vývoj, pedagogickou potřebu ani dosavadní zkušenost jen proto, že zpráva současně obsahuje projev.
4b. Jedna věta nebo jedna sourceQuote může vytvořit více kandidátů v různých kategoriích, pokud skutečně obsahuje více samostatných údajů.
4c. Výčet v jedné větě nebo souvětí významově odlišných explicitních projevů rozděl na samostatné candidates ve stejné kategorii. Neztrácej ani neslučuj je jen proto, že spolu souvisejí: „unavený“, „apatický“, „málo komunikuje“, „odmítá úkoly“ a „špatně se soustředí“ jsou odlišné projevy. Naopak skutečnou parafrázi téhož projevu vrať jen jednou.
4d. V koordinaci a kontrastu zachovej kvalifikátor u každé větve, kterou řídí, například „někdy“, „jindy“, „ne vždy“, „obvykle“ nebo „jen někdy“. „Někdy“ nesmíš přenést na větev uvedenou slovem „jindy“, kvalifikátor vypustit ani jej nahradit významově širším. Smíš doplnit jednoznačně sdílený predikát z téže koordinace, ale nesmíš tím rozšířit nebo změnit platnost větve.
4e. Pouhé pořadí nebo spojení dějů spojkou nevytváří časový, příčinný, podmínkový ani následkový vztah. Nepřidávej „po“, „potom“, „následně“, „předtím“, „proto“ ani „kvůli tomu“, pokud tento vztah není ve zprávě explicitní. Samostatné koordinované děje zapisuj jako samostatné atomy.
4f. course zachycuje samotnou četnost, trvání, intenzitu, počátek nebo vývoj. Pokud jde o samostatný srozumitelný údaj, vytvoř kategoriálně specifický atom bez opakování projevu, například course „Po pár minutách.“ vedle manifestations „Jindy odbíhá.“. Predikát v course neopakuj jen kvůli srozumitelnosti, pokud jej určuje tentýž explicitní úsek a oddělený atom svůj význam zachovává.
4g. Při atomizaci do kategorií vždy zachovej vztahy, rozsah a kvalifikátory explicitně vyjádřené ve zdroji. Atomizace nesmí vztah zesílit, oslabit, zaměnit ani nově vytvořit. Pokud by oddělení odstranilo materiálně důležitý význam nebo vytvořilo nesrozumitelný atom, údaj násilně neodděluj.
5. Pokud stejný význam už v Zápisníku je, action=duplicate a uveď jeho relatedEntryId.
5a. Duplicitu posuzuj pouze uvnitř stejné kategorie. Existující projev nikdy není důvodem odmítnout nový kontext, intenzitu a trend, pedagogickou potřebu nebo dosavadní zkušenost.
6. Pokud nový údaj mění nebo odporuje existující položce, action=conflict a uveď její relatedEntryId. Nic tiše nepřepisuj.
7. Neurčité, pouze interpretační nebo nerelevantní pasáže mají action=skip.
8. situationRelation posuzuj vůči celému Zápisníku: same = stejná situace; related = relevantní doplnění téže situace; different = pouze zjevně jiný žák nebo jiný řešený problém; uncertain = pouze skutečná obsahová nejasnost, zda jde o jiného žáka nebo jiný problém.
8a. Navazující eliptické formulace jako „děje se to“, „hlavně odpoledne“, „asi třikrát týdně“ nebo „pomáhá mu“ běžně odkazují k aktuální situaci. Samotné vynechání podmětu není důvod pro uncertain ani different; použij related.
9. U prázdného Zápisníku použij same, pokud zpráva obsahuje použitelný popis situace.
10. Při different vrať kandidáty, ale aplikace je bez potvrzení nezapíše.
11. Hodnotící nálepky jako „líný“, „drzý“, „zlobivý“, „neschopný“ nebo „manipulativní“ nejsou pozorované projevy. Samy o sobě je nezapisuj a neodvozuj z nich konkrétní chování.
12. notebookText smí pouze stručně a významově beze ztráty normalizovat obsah sourceQuote. Nesmí přidat žádný projev, okolnost, četnost, příčinu ani míru, kterou uživatel neuvedl.
13. categoryReview musí potvrdit, že jsi samostatně zkontroloval všech pět kategorií. Hodnota found znamená, že pro kategorii vracíš alespoň jeden kandidát add, duplicate, conflict nebo skip; none znamená, že zpráva pro kategorii žádný explicitní údaj neobsahuje.
14. Pedagogickou potřebu zapisuj jen tehdy, když ji pedagog sám vyjádří. Neodvozuj ji z projevu dítěte ani ji nezaměňuj za doporučení APU.
14a. Samotný popis obtíže, četnosti nebo závažnosti nikdy není pedagogickou potřebou. Z vět „žák usíná“, „těžce se soustředí“ nebo „děje se to každý den“ nesmí vzniknout goals typu „potřebuji poradit“, „chci situaci pochopit“ ani jiný obecný záměr. Pokud zpráva neobsahuje výslovný požadavek, otázku nebo formulaci cíle pedagoga, categoryReview.goals=none.
15. Do Zkušeností zapisuj pouze skutečně vyzkoušený postup, pozorovanou podmínku nebo změnu spolu s jejím pozorovaným účinkem. Nezapisuj sem nevyzkoušené návrhy APU ani obecné možnosti.
16. Pole trust v currentNotebook vyjadřuje pouze stav uživatelské kontroly: confirmed je potvrzený pracovní údaj, unconfirmed je automatický návrh. Existující unconfirmed položku nepovažuj za nezávislý důkaz její obsahové správnosti. Smíš ji použít pro návaznost situace, eliptické odkazy, deduplikaci a rozpoznání možného konfliktu; každý nový kandidát však musí být podložen newUserMessage.

Příklady úplné extrakce:
- „Žák usíná v hodině“ → manifestations: „Žák usíná“; context: „v hodině“.
- Při existujícím zápisu „Žák usíná“ a nové zprávě „Děje se to ve vyučování, každý den, zejména v odpoledních hodinách“ použij related a vrať context pro „ve vyučování“ a „zejména v odpoledních hodinách“ a course pro „každý den“. Nic dalšího neodvozuj.
- Při existujícím manifestations „Žák usíná“ a nové zprávě „Děje se to každý den“ NEVRACEJ duplicate manifestations. Vrať add course: sourceQuote „každý den“, notebookText „Každý den.“. Předmět situace už určuje Zápisník; novým faktem je četnost.
- „Ve skupině úkol odmítne, jednotlivě ho dokončí“ → manifestations, context a dosavadní zkušenost v helps, jsou-li všechny přímo doložené přesnými sourceQuote.
- „Někdy tomu předchází konflikt s dítětem, jindy požadavek učitelky nebo velký hluk“ → zachovej context „Někdy tomu předchází konflikt s dítětem.“, „Jindy tomu předchází požadavek učitelky.“ a „Jindy tomu předchází velký hluk.“. U posledních dvou větví NESMÍ vzniknout „Někdy“.
- „Ve skupině úkol odmítne, jednotlivě ho dokončí a požádá o další“ → samostatné atomy „Úkol dokončí.“ a „Požádá o další.“. NESMÍ vzniknout „Po dokončení úkolu požádá o další.“, protože zdroj takový časový vztah neuvádí.
- „Žák každé ráno usíná“ → manifestations „Žák usíná.“ a course „Každé ráno.“. Samostatný course nemusí opakovat projev.
- „Jindy po pár minutách odbíhá“ → manifestations „Jindy odbíhá.“ a course „Po pár minutách.“. Course NESMÍ být „Odbíhá po pár minutách.“.
- „Potřebuji zjistit, co situaci spouští“ → goals: „Zjistit, co situaci spouští.“.
- „Napomenutí před třídou situaci obvykle zhorší“ → helps: „Napomenutí před třídou situaci obvykle zhoršuje.“. Jde o dosavadní zkušenost, ne o doporučení.`;

const GROUNDING_RULES = `Jsi nezávislá kontrolní brána automatického zápisu do pedagogického Zápisníku APU.
Posuzuješ vztah mezi právě zaslanou zprávou uživatele, aktuálním Zápisníkem a navrženými položkami. Nemáš přístup k odpovědi asistenta a nesmíš doplňovat vlastní pedagogické možnosti.

Kandidáta přijmi jen tehdy, když současně platí:
- notebookText je přímo a jednoznačně doložen obsahem newUserMessage;
- sourceQuote je skutečným dostatečným podkladem pro celý notebookText;
- kategorie odpovídá typu informace;
- u manifestations jde o pozorovatelné chování nebo reakci, ne hodnotící nálepku, diagnózu, příčinu či hypotézu;
- explicitně uvedený popis pozorovaného stavu nebo projevu, například „je apatický“, přijmi jako manifestations, pokud notebookText nepřidává význam nad sourceQuote; nesmíš z něj odvozovat únavu, nesoustředění ani odmítání úkolů;
- u goals jde o pedagogem explicitně vyjádřenou potřebu, ne potřebu dítěte odvozenou modelem;
- samotný popis problému ani používání pedagogického asistenta neznamená implicitní žádost o radu nebo pochopení; bez výslovného záměru goals zamítni;
- u helps jde o již vyzkoušený nebo pozorovaný postup, podmínku či změnu a její doložený účinek, ne o nevyzkoušený návrh;
- přeformulování nepřidává žádný nový fakt.

Aktuální Zápisník smíš použít pouze k bezpečnému rozlišení eliptického podmětu nebo zájmena („to“, „děje se to“, „pomáhá mu“). Nový projev, četnost, kontext, pedagogická potřeba nebo dosavadní zkušenost musí být vždy explicitně obsaženy v newUserMessage. Například při zápisu „Žák usíná“ je z nové zprávy „Děje se to každý den“ bezpečně doložen course „Každý den.“.
Položka currentNotebook s trust=unconfirmed není nezávislým důkazem své správnosti. Používej ji pouze pro návaznost, eliptický odkaz, deduplikaci nebo možný konflikt; nikdy jí nedoplňuj význam, který není v newUserMessage.

Příklad: z „žák je líný“ nelze přijmout „žák je pasivní“, „nesoustředí se“, „odmítá pracovat“ ani „usíná při výuce“. Vše zamítni jako nepodloženou interpretaci. Samotné „žák je líný“ rovněž není pozorovatelný projev. Naopak z explicitního „žák je apatický“ smíš přijmout pouze manifestations „Je apatický.“ se stejnou sourceQuote.
Buď konzervativní. Při pochybnosti kandidáta zamítni.`;

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
