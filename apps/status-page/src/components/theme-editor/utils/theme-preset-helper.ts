// @ts-expect-error: owned by ngard
import { isEqual } from "@ngard/tiny-isequal";
import { useThemePresetStore } from "../../../store/theme-preset-store";
import { defaultThemeState } from "../config/theme";
import type { ThemeStyles } from "../types/theme";
import { defaultPresets } from "./theme-presets";

/**
 * Get built-in theme styles by name (without using store).
 * Use this for server-side code where store access is not available.
 * Returns null if the preset doesn't exist.
 */
export function getBuiltInThemeStyles(
  name: string,
): { name: string; styles: ThemeStyles } | null {
  const preset = defaultPresets[name];
  if (!preset) {
    return null;
  }

  const styles = mergePresetWithDefaults(preset.styles);
  return {
    name: preset.label || name,
    styles,
  };
}

function mergePresetWithDefaults(presetStyles: {
  light?: Partial<ThemeStyles["light"]>;
  dark?: Partial<ThemeStyles["dark"]>;
}): ThemeStyles {
  const defaultTheme = defaultThemeState.styles;
  return {
    light: {
      ...defaultTheme.light,
      ...(presetStyles.light || {}),
    },
    dark: {
      ...defaultTheme.dark,
      ...(presetStyles.light || {}),
      ...(presetStyles.dark || {}),
    },
  };
}

export function getPresetThemeStyles(name: string): ThemeStyles {
  if (name === "default") {
    return defaultThemeState.styles;
  }

  const store = useThemePresetStore.getState();
  const preset = store.getPreset(name);
  if (!preset || !preset.styles) {
    return defaultThemeState.styles;
  }

  return mergePresetWithDefaults(
    preset.styles as {
      light?: Partial<ThemeStyles["light"]>;
      dark?: Partial<ThemeStyles["dark"]>;
    },
  );
}

export function isDeepEqual(a: unknown, b: unknown): boolean {
  return isEqual(a, b);
}
