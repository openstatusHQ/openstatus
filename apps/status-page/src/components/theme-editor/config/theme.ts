import type { OpenStatusColorID } from "../store/color-control-focus-store";
import type { ThemeEditorState } from "../types/editor";
import type { ThemeStyles } from "../types/theme";
import { defaultPresets } from "../utils/theme-presets";

// these are common between light and dark modes
// we can assume that light mode's value will be used for dark mode as well
export const COMMON_STYLES = [
  "font-sans",
  "font-serif",
  "font-mono",
  "radius",
  "shadow-opacity",
  "shadow-blur",
  "shadow-spread",
  "shadow-offset-x",
  "shadow-offset-y",
  "letter-spacing",
  "spacing",
];

export const DEFAULT_FONT_SANS =
  "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'";

export const DEFAULT_FONT_SERIF =
  'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';

export const DEFAULT_FONT_MONO =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

export const defaultLightThemeStyles =
  defaultPresets["modern-minimal"]?.styles?.light;
export const defaultDarkThemeStyles =
  defaultPresets["modern-minimal"]?.styles?.dark;

// Default theme state
export const defaultThemeState: ThemeEditorState = {
  styles: {
    light: defaultLightThemeStyles as ThemeStyles["light"],
    dark: defaultDarkThemeStyles as ThemeStyles["dark"],
  },
  currentMode:
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
  hslAdjustments: {
    hueShift: 0,
    saturationScale: 1,
    lightnessScale: 1,
  },
};

// these are the default colors for the openstatus colors
// they are taken from the openstatus theme store
// Add according to dark and light mode
export const openstatusCommonStyles: Record<
  "light" | "dark",
  Record<OpenStatusColorID, string>
> = {
  light: {
    success: "#008000",
    warning: "#FFFF00",
    info: "#0000FF",
  },
  dark: {
    success: "#00FF00",
    warning: "#FFFF00",
    info: "#0000FF",
  },
};
