import type { Theme } from "./types";

export const FURTHER_THEME = {
  id: "further",
  name: "Further",
  author: { name: "@withfurther", url: "https://www.withfurther.com" },
  light: {
    "--radius": "0.75rem",

    "--background": "oklch(100% 0 0)",
    "--foreground": "oklch(23.12% 0.0098 88.79)",
    "--border": "oklch(92.53% 0.0099 87.47)",
    "--input": "oklch(92.53% 0.0099 87.47)",
    "--ring": "oklch(51.12% 0.0703 160.73)",

    "--primary": "oklch(23.12% 0.0098 88.79)",
    "--primary-foreground": "oklch(97.91% 0.0041 91.45)",
    "--secondary": "oklch(97.91% 0.0041 91.45)",
    "--secondary-foreground": "oklch(23.12% 0.0098 88.79)",
    "--muted": "oklch(97.91% 0.0041 91.45)",
    "--muted-foreground": "oklch(52.64% 0.0138 79.74)",
    "--accent": "oklch(97.91% 0.0041 91.45)",
    "--accent-foreground": "oklch(23.12% 0.0098 88.79)",

    "--success": "oklch(51.12% 0.0703 160.73)",
    "--destructive": "oklch(57.7% 0.245 27.325)",
    "--warning": "oklch(77% 0.16 70)",
    "--info": "oklch(57.37% 0.1946 257.86)",
  },
  dark: {
    "--radius": "0.75rem",

    "--background": "oklch(18.26% 0.0043 84.59)",
    "--foreground": "oklch(97.91% 0.0041 91.45)",
    "--border": "oklch(100% 0 0 / 10%)",
    "--input": "oklch(100% 0 0 / 15%)",
    "--ring": "oklch(76.43% 0.0598 165)",

    "--primary": "oklch(97.91% 0.0041 91.45)",
    "--primary-foreground": "oklch(18.26% 0.0043 84.59)",
    "--secondary": "oklch(21.89% 0.0065 78.18)",
    "--secondary-foreground": "oklch(97.91% 0.0041 91.45)",
    "--muted": "oklch(21.89% 0.0065 78.18)",
    "--muted-foreground": "oklch(66.49% 0.0143 82.4)",
    "--accent": "oklch(21.89% 0.0065 78.18)",
    "--accent-foreground": "oklch(97.91% 0.0041 91.45)",

    "--success": "oklch(76.43% 0.0598 165)",
    "--destructive": "oklch(70.4% 0.191 22.216)",
    "--warning": "oklch(77% 0.16 70)",
    "--info": "oklch(66% 0.17 257.86)",
  },
} as const satisfies Theme;
