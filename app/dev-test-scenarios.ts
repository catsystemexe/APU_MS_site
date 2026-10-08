export const DEV_TEST_SCENARIO_PATHS = ["POCHOPIT", "POZOROVAT", "VYTVOŘIT"] as const;

export type DevTestScenario = {
  id: string;
  path: typeof DEV_TEST_SCENARIO_PATHS[number];
  difficulty: 1 | 2 | 3;
  load: "VLNA" | "BOUŘE" | "TSUNAMI";
  label: string;
  subtitle: string;
  text: string;
};

// Developer test inputs only; path/load metadata never drives application routing.
export const DEV_TEST_SCENARIOS: readonly DevTestScenario[] = [
  {
    id: "pochopit-1",
    path: "POCHOPIT",
    difficulty: 1,
    load: "VLNA",
    label: "Matěj",
    subtitle: "Jednoduchý",
    text: "Matěj při ranním kruhu často vstává, chodí po třídě a pak se zase vrátí. Když je kruh kratší, většinou vydrží sedět. Potřebuji pochopit, co může jeho chování ovlivňovat a jaké pracovní hypotézy dávají smysl.",
  },
  {
    id: "pochopit-2",
    path: "POCHOPIT",
    difficulty: 2,
    load: "BOUŘE",
    label: "Adam",
    subtitle: "Více proměnných",
    text: "Adam při přechodu z volné hry k uklízení začne hlasitě protestovat, lehne si na zem a odmítá spolupracovat. Když ho upozorníme předem, bývá to lepší, ale někdy se rozčílí i tak. Potřebuji pochopit, co může silnou reakci při přechodu ovlivňovat a jaká různá vysvětlení je potřeba zvažovat.",
  },
  {
    id: "pochopit-3",
    path: "POCHOPIT",
    difficulty: 3,
    load: "TSUNAMI",
    label: "David",
    subtitle: "Nejasná / konfliktní data",
    text: "David má občas velmi silné výbuchy. Začne křičet, odstrkuje věci i lidi kolem sebe a snaží se opustit místnost. Někdy tomu předchází konflikt s dítětem, jindy požadavek učitelky nebo velký hluk. Nevíme, jestli jde pokaždé o stejný problém. Potřebuji situaci pochopit bez rychlého závěru, rozlišit možná vysvětlení a zároveň zachovat prioritu bezpečí a stabilizace.",
  },
  {
    id: "pozorovat-1",
    path: "POZOROVAT",
    difficulty: 1,
    load: "BOUŘE",
    label: "Tereza",
    subtitle: "Jednoduchý",
    text: "Tereza se při prohře ve hře rozpláče, odstrčí hru a říká, že už hrát nebude. Za několik minut se většinou uklidní a vrátí se. Potřebuji určit, co konkrétně v těchto situacích sledovat, abychom lépe poznali průběh reakce a podmínky návratu ke hře.",
  },
  {
    id: "pozorovat-2",
    path: "POZOROVAT",
    difficulty: 2,
    load: "TSUNAMI",
    label: "Anička",
    subtitle: "Více proměnných",
    text: "Anička se při velkém hluku v šatně začala výrazně rozrušovat, snažila se rychle odejít a nereagovala na běžné pokyny. Pomohlo až klidnější místo a přítomnost známé učitelky. Potřebuji určit, co bezpečně sledovat před reakcí, během ní a při uklidňování, abychom lépe rozlišili vliv hluku, možnosti odejít do klidu a přítomnosti známé osoby.",
  },
  {
    id: "pozorovat-3",
    path: "POZOROVAT",
    difficulty: 3,
    load: "VLNA",
    label: "Ondra",
    subtitle: "Nejasná / konfliktní data",
    text: "Ondra někdy zvládne celou řízenou činnost bez problému a jindy po pár minutách odbíhá. Nevidím jasný vzorec. Častější je to po víkendu a před obědem, ale ne vždy. Potřebuji vytvořit cílený plán pozorování, který pomůže rozlišit, které podmínky s odbíháním skutečně souvisejí a které jsou jen náhodné.",
  },
  {
    id: "vytvorit-1",
    path: "VYTVOŘIT",
    difficulty: 1,
    load: "TSUNAMI",
    label: "Filip",
    subtitle: "Jednoduchý",
    text: "Filip se po zákazu velmi rozrušil, křičel, shazoval věci ze stolu a nebylo možné s ním chvíli domluvit. Ostatní děti jsme odvedli stranou a po čase se postupně uklidnil. Potřebuji vytvořit jednoduchý praktický postup pro učitele, co v podobné situaci dělat, aby byl prioritou bezpečný průběh a postupná stabilizace.",
  },
  {
    id: "vytvorit-2",
    path: "VYTVOŘIT",
    difficulty: 2,
    load: "VLNA",
    label: "Eliška",
    subtitle: "Více proměnných",
    text: "Eliška se při společném tvoření rychle přestane soustředit. Začne si hrát s pomůckami nebo pozoruje ostatní. Když sedí u kraje stolu a dostane úkol po malých částech, pracuje lépe. Potřebuji navrhnout praktický způsob organizace tvoření, který jí usnadní zapojení a který půjde ve třídě realisticky používat.",
  },
  {
    id: "vytvorit-3",
    path: "VYTVOŘIT",
    difficulty: 3,
    load: "BOUŘE",
    label: "Klárka",
    subtitle: "Nejasná / konfliktní data",
    text: "Klárka reaguje velmi rozdílně na opravu. Někdy ji přijme, jindy začne křičet, že to neumí a nechce pokračovat. Častěji se to stává před ostatními dětmi, ale několikrát se to objevilo i při práci o samotě. Potřebuji navrhnout praktický způsob, jak jí poskytovat opravu a zpětnou vazbu, ale nechci, aby systém předstíral, že už přesně víme, proč reaguje tak rozdílně.",
  },
];
