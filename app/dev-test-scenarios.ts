export type DevTestScenario = {
  id: "level-1" | "level-2" | "level-3";
  label: string;
  subtitle: string;
  text: string;
};

export const DEV_TEST_SCENARIOS: readonly DevTestScenario[] = [
  {
    id: "level-1",
    label: "1 · Základní",
    subtitle: "Stručný popis situace",
    text: "Při ranním kruhu často vstává, odchází od ostatních a při návratu se obtížně znovu zapojuje do společné činnosti.",
  },
  {
    id: "level-2",
    label: "2 · Detailní",
    subtitle: "Situace s bližším kontextem",
    text: "Čtyřleté dítě při ranním kruhu často po několika minutách vstane a odejde ke hračkám. Když ho vyzveme k návratu, někdy se vrátí, ale obtížně se znovu zapojuje a vyrušuje ostatní. Při kratším kruhu a možnosti držet drobný předmět vydrží déle. Potřebuji porozumět, co může jeho chování ovlivňovat a jak mu účast usnadnit.",
  },
  {
    id: "level-3",
    label: "3 · Stress test",
    subtitle: "Rozsáhlý popis s více okolnostmi",
    text: "Ve třídě máme čtyřleté dítě, které při ranním kruhu obvykle po dvou až pěti minutách vstane, obchází třídu nebo si jde pro hračku. Po slovní výzvě se někdy vrátí, jindy protestuje; po návratu mluví do výkladu, dotýká se ostatních dětí a obtížně navazuje na probíhající činnost. Situace je výraznější po pozdním příchodu, o rušnějších dnech a při delším povídání. Lépe se zapojuje, když předem ví, co bude následovat, sedí blízko učitelky, může držet drobný předmět nebo dostane aktivní roli. Podobné odcházení občas pozorujeme i u společného stolování, při volné hře ale u oblíbené činnosti vydrží dlouho. Rodina uvádí, že doma je pro něj také těžké čekat a dokončit činnost, žádné odborné vyšetření zatím neproběhlo. Potřebuji rozlišit možné souvislosti, určit pedagogické potřeby a navrhnout praktické kroky pro třídu bez předčasného diagnostického závěru.",
  },
];
