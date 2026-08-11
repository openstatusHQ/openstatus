import type { Theme } from "./types";

export const FURTHER_THEME = {
  id: "further",
  name: "Further",
  author: { name: "@withfurther", url: "https://www.withfurther.com" },
  light: {
    "--radius": "0.75rem",

    "--background": "oklch(100% 0 0)",
    "--foreground": "oklch(24.78% 0 0)",
    "--border": "oklch(90% 0.004 91.45)",
    "--input": "oklch(90% 0.004 91.45)",

    "--primary": "oklch(24.78% 0 0)",
    "--primary-foreground": "oklch(97.91% 0.0041 91.45)",
    "--secondary": "oklch(97.91% 0.0041 91.45)",
    "--secondary-foreground": "oklch(24.78% 0 0)",
    "--muted": "oklch(97.91% 0.0041 91.45)",
    "--muted-foreground": "oklch(50% 0.004 91.45)",
    "--accent": "oklch(97.91% 0.0041 91.45)",
    "--accent-foreground": "oklch(24.78% 0 0)",

    "--success": "oklch(64% 0.17 150)",
    "--destructive": "oklch(57.7% 0.245 27.325)",
    "--warning": "oklch(77% 0.16 70)",
    "--info": "oklch(57.37% 0.1946 257.86)",
  },
  dark: {
    "--radius": "0.75rem",

    "--background": "oklch(21.06% 0.005 67.55)",
    "--foreground": "oklch(97.91% 0.0041 91.45)",
    "--border": "oklch(100% 0 0 / 10%)",
    "--input": "oklch(100% 0 0 / 15%)",

    "--primary": "oklch(97.91% 0.0041 91.45)",
    "--primary-foreground": "oklch(21.06% 0.005 67.55)",
    "--secondary": "oklch(27.5% 0.005 67.55)",
    "--secondary-foreground": "oklch(97.91% 0.0041 91.45)",
    "--muted": "oklch(27.5% 0.005 67.55)",
    "--muted-foreground": "oklch(72% 0.004 91.45)",
    "--accent": "oklch(27.5% 0.005 67.55)",
    "--accent-foreground": "oklch(97.91% 0.0041 91.45)",

    "--success": "oklch(72% 0.19 150)",
    "--destructive": "oklch(70.4% 0.191 22.216)",
    "--warning": "oklch(77% 0.16 70)",
    "--info": "oklch(66% 0.17 257.86)",
  },
} as const satisfies Theme;
