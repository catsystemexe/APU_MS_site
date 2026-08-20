"use client";

import { useEffect, useState } from "react";

export const COLOR_THEMES = [
  { id: "default", label: "APU Default" },
  { id: "cool", label: "APU Cool" },
  { id: "soft", label: "APU Soft" },
  { id: "minimal", label: "APU Minimal" },
] as const;

export const TYPOGRAPHY_PRESETS = [
  { id: "default", label: "Manrope + Source Sans 3" },
  { id: "soft", label: "DM Sans + Source Sans 3" },
  { id: "minimal", label: "Inter" },
] as const;

export const FONT_SIZE_OPTIONS = [
  { id: "system", label: "Systémová" },
  { id: "smaller", label: "Menší" },
  { id: "larger", label: "Větší" },
] as const;

export type ColorThemeId = (typeof COLOR_THEMES)[number]["id"];
export type TypographyPresetId = (typeof TYPOGRAPHY_PRESETS)[number]["id"];
export type FontSizeId = (typeof FONT_SIZE_OPTIONS)[number]["id"];

export const DESIGN_PREFERENCES_STORAGE_KEY = "apu-site:design-preferences:v1";

type DesignPreferences = {
  colorTheme: ColorThemeId;
  typography: TypographyPresetId;
  fontSize: FontSizeId;
};

const DEFAULT_PREFERENCES: DesignPreferences = {
  colorTheme: "default",
  typography: "default",
  fontSize: "system",
};

function isColorTheme(value: unknown): value is ColorThemeId {
  return COLOR_THEMES.some((theme) => theme.id === value);
}

function isTypographyPreset(value: unknown): value is TypographyPresetId {
  return TYPOGRAPHY_PRESETS.some((preset) => preset.id === value);
}

function isFontSize(value: unknown): value is FontSizeId {
  return FONT_SIZE_OPTIONS.some((option) => option.id === value);
}

function readPreferences(): DesignPreferences {
  try {
    const raw = window.localStorage.getItem(DESIGN_PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const stored = JSON.parse(raw) as Partial<DesignPreferences>;
    return {
      colorTheme: isColorTheme(stored.colorTheme) ? stored.colorTheme : "default",
      typography: isTypographyPreset(stored.typography) ? stored.typography : "default",
      fontSize: isFontSize(stored.fontSize) ? stored.fontSize : "system",
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function applyPreferences(preferences: DesignPreferences) {
  document.documentElement.dataset.colorTheme = preferences.colorTheme;
  document.documentElement.dataset.typography = preferences.typography;
  document.documentElement.dataset.fontSize = preferences.fontSize;
}

export function useDesignPreferences() {
  const [preferences, setPreferences] = useState<DesignPreferences>(DEFAULT_PREFERENCES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const hydrate = window.setTimeout(() => {
      const stored = readPreferences();
      setPreferences(stored);
      applyPreferences(stored);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(hydrate);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    applyPreferences(preferences);
    try {
      window.localStorage.setItem(DESIGN_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // The active in-memory preset remains usable when browser storage is unavailable.
    }
  }, [hydrated, preferences]);

  return {
    ...preferences,
    setColorTheme: (colorTheme: ColorThemeId) => setPreferences((current) => ({ ...current, colorTheme })),
    setTypography: (typography: TypographyPresetId) => setPreferences((current) => ({ ...current, typography })),
    setFontSize: (fontSize: FontSizeId) => setPreferences((current) => ({ ...current, fontSize })),
    reset: () => setPreferences(DEFAULT_PREFERENCES),
  };
}
