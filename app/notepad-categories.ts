import type { LucideIcon } from "lucide-react";
import { Clock3, Eye, Network, Sparkles, Target } from "lucide-react";
import type { CategoryId } from "./notepad-model";

type NotepadCategoryMeta = {
  id: CategoryId;
  label: string;
  icon: LucideIcon;
  help: string;
};

export const NOTEPAD_CATEGORY_META = {
  manifestations: {
    id: "manifestations",
    label: "Pozorovaný projev",
    icon: Eye,
    help: "Co pedagog přímo vidí nebo slyší. Patří sem konkrétní jednání nebo reakce, ne hodnocení dítěte.",
  },
  goals: {
    id: "goals",
    label: "Pedagogická potřeba",
    icon: Target,
    help: "Co pedagog potřebuje v dané situaci vyřešit, změnit, podpořit nebo lépe pochopit. Nejde o domnělou potřebu dítěte.",
  },
  context: {
    id: "context",
    label: "Kontext",
    icon: Network,
    help: "Kdy, kde, při čem a s kým se pozorovaný projev objevuje.",
  },
  course: {
    id: "course",
    label: "Intenzita / trend",
    icon: Clock3,
    help: "Jak často, jak dlouho a jak silně se projev objevuje, od kdy trvá a zda se zlepšuje nebo zhoršuje.",
  },
  helps: {
    id: "helps",
    label: "Zkušenosti",
    icon: Sparkles,
    help: "Co už bylo v této situaci vyzkoušeno nebo pozorováno a jaký to mělo účinek. Patří sem to, co pomáhá, nepomáhá, škodí nebo funguje jen za určitých podmínek. Nezapisují se sem nevyzkoušené návrhy APU.",
  },
} satisfies Record<CategoryId, NotepadCategoryMeta>;

export const NOTEPAD_CATEGORIES = Object.values(NOTEPAD_CATEGORY_META);
