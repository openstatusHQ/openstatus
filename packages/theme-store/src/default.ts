import type { Theme } from "./types";

export const DEFAULT_THEME = {
  id: "default" as const,
  name: "Default",
  author: { name: "@openstatus", url: "https://openstatus.dev" },
  light: {
    "--background": "oklch(100% 0 0)",
    "--foreground": "oklch(14.5% 0 0)",
    "--border": "oklch(92.2% 0 0)",
    "--input": "oklch(92.2% 0 0)",

    "--primary": "oklch(20.5% 0 0)",
    "--primary-foreground": "oklch(98.5% 0 0)",
    "--secondary": "oklch(97% 0 0)",
    "--secondary-foreground": "oklch(20.5% 0 0)",
    "--muted": "oklch(97% 0 0)",
    "--muted-foreground": "oklch(55.6% 0 0)",
    "--accent": "oklch(97% 0 0)",
    "--accent-foreground": "oklch(20.5% 0 0)",

    "--success": "oklch(72% 0.19 150)",
    "--destructive": "oklch(57.7% 0.245 27.325)",
    "--warning": "oklch(77% 0.16 70)",
    "--info": "oklch(62% 0.19 260)",
  },
  dark: {
    "--background": "oklch(14.5% 0 0)",
    "--foreground": "oklch(98.5% 0 0)",
    "--border": "oklch(100% 0 0 / 10%)",
    "--input": "oklch(100% 0 0 / 15%)",

    "--primary": "oklch(92.2% 0 0)",
    "--primary-foreground": "oklch(20.5% 0 0)",
    "--secondary": "oklch(26.9% 0 0)",
    "--secondary-foreground": "oklch(98.5% 0 0)",
    "--muted": "oklch(26.9% 0 0)",
    "--muted-foreground": "oklch(70.8% 0 0)",
    "--accent": "oklch(26.9% 0 0)",
    "--accent-foreground": "oklch(98.5% 0 0)",

    "--success": "oklch(72% 0.19 150)",
    "--destructive": "oklch(70.4% 0.191 22.216)",
    "--warning": "oklch(77% 0.16 70)",
    "--info": "oklch(62% 0.19 260)",
  },
} as const satisfies Theme;
