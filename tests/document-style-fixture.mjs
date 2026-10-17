// Realistic synthetic accepted text; shared by renderer and actual-client smoke.
const paragraph = "Při společném ranním kruhu dítě po několika minutách vstává a hledá jinou činnost. V kratších skupinových aktivitách se obvykle zapojuje snáze, zejména když předem ví, co bude následovat. Dostupné záznamy zatím neumožňují oddělit délku čekání, změny prostředí a způsob nabídky podpory. Toto vysvětlení zůstává pracovní možností: podobný projev může mít v různých situacích odlišné souvislosti. Při dalším ověřování je třeba zaznamenávat i situace, ve kterých se obtíž neobjevuje, a zachovat popis podmínek bez přisuzování neověřených příčin.";

export const longHypotheses = ["Délka společné činnosti", "Předvídatelnost přechodů", "Dostupnost podpory"].map((title, index) => ({
  id: `h${index + 1}`, rank: index + 1, title,
  summary: [paragraph, paragraph, `${paragraph} Souhrn hypotézy ${index + 1} končí touto větou.`].join("\n\n"),
  relevantNeeds: ["n1"],
  supportingInformation: ["V kratším kruhu dítě zůstalo s ostatními.", "Předem oznámený přechod proběhl klidněji."],
  limitations: ["Pozorování pocházejí jen z několika dnů.", "Podmínky ani nabídka podpory nebyly ve všech situacích stejné."],
  unknowns: ["Vliv únavy a denní doby není známý.", "Zatím nemáme srovnání se situací mimo ranní kruh."],
  question: { id: `q${index + 1}`, text: "Co se mění mezi krátkou a dlouhou činností při stejné nabídce podpory?", target: "context", status: "active" },
  questions: [{ id: `follow-${index + 1}`, text: `Jaké konkrétní podmínky provázely situaci, v níž bylo zapojení snazší? Otázka k hypotéze ${index + 1}.`, target: "context", status: "active" }],
}));

export const longContext = {
  mainUncertainty: "Dosavadní informace neumožňují potvrdit jednu příčinu; pracovní hypotézy mohou působit současně.",
  summary: "Zápisník zachycuje rozdílné zapojení při společné činnosti a přechodech. Rozbor pracuje s několika možnými souvislostmi a zachovává nejistotu.",
  notebookContext: [
    { category: "manifestations", text: "Při dlouhém kruhu dítě vstává a vzdaluje se od skupiny." },
    { category: "context", text: "Aktivita probíhá dopoledne ve třídě; délka a počet přechodů se mezi dny liší." },
    { category: "helps", text: "Ve dvou zaznamenaných situacích pomohlo předem popsat následující krok." },
  ],
  needAnalysis: {
    needId: "n1", title: "Porozumět podmínkám zapojení", sourceText: "Potřebuji pochopit podmínky zapojení.", relevantHypotheses: ["h1", "h2", "h3"],
    direction: "Porovnat dostupné informace o zapojení v odlišných podmínkách.", distinctions: ["Krátká a dlouhá činnost", "Oznámený a neočekávaný přechod"],
    parameters: ["Délka čekání", "Nabídka podpory"], limitations: ["Podmínky nebyly systematicky zaznamenány."],
    question: null, questions: [{ id: "need-q", text: "Které podmínky jsou v jednotlivých situacích doložené?", target: "context", status: "active" }],
    intendedOutput: "Pracovní orientace v možných souvislostech, nikoli potvrzený závěr.",
  },
};

export const longComponentText = "Přijaté rozvinutí pracovní hypotézy.\n\n" + paragraph + "\n\nSrovnávané podmínky:\n• Délka společné činnosti\n• Způsob oznámení přechodu\n\n" + paragraph + "\n\nRozvinutí končí zachováním původní nejistoty.";
