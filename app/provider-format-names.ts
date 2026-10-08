import type { F2Path } from "./notepad-model.ts";

export const F2_PROVIDER_FORMAT_NAMES: Record<F2Path, { build: string; preview: string; components: string }> = {
  POCHOPIT: { build: "f2_pochopit_build", preview: "f2_pochopit_preview", components: "f2_pochopit_components" },
  POZOROVAT: { build: "f2_pozorovat_build", preview: "f2_pozorovat_preview", components: "f2_pozorovat_components" },
  VYTVOŘIT: { build: "f2_vytvorit_build", preview: "f2_vytvorit_preview", components: "f2_vytvorit_components" },
};

export const F3_PROVIDER_FORMAT_NAMES: Record<F2Path, string> = {
  POCHOPIT: "f3_pochopit_final_render",
  POZOROVAT: "f3_pozorovat_final_render",
  VYTVOŘIT: "f3_vytvorit_final_render",
};
