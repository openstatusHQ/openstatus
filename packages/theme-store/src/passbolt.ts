import type { Theme } from "./types";

export const PASSBOLT_THEME = {
  id: "passbolt",
  name: "Passbolt",
  author: { name: "@Passbolt", url: "https://passbolt.com" },
  light: {
    "--background": "oklch(100% 0 0)",
    "--foreground": "#000000",
    "--border": "oklch(92.2% 0 0)",
    "--input": "oklch(92.2% 0 0)",
    "--primary": "#3b83d7",

    "--primary-foreground": "oklch(98.5% 0 0)",
    "--secondary": "oklch(97% 0 0)",
    "--secondary-foreground": "oklch(20.5% 0 0)",
    "--muted": "oklch(97% 0 0)",
    "--muted-foreground": "oklch(55.6% 0 0)",
    "--accent": "oklch(97% 0 0)",
    "--accent-foreground": "#0f0f0f",

    "--success": "#b6dcaf",
    "--destructive": "#ffa6a6",
    "--warning": "#ffdca8",
    "--info": "#abd2f9",

    "--radius": "0.5rem",
  },
  dark: {
    "--background": "#171717",
    "--foreground": "#ffffff",
    "--border": "#333333",
    "--input": "#000000",

    "--primary": "#58acff",
    "--primary-foreground": "#ffffff",
    "--secondary": "#000000",
    "--secondary-foreground": "oklch(98.5% 0 0)",
    "--muted": "#333333",
    "--muted-foreground": "#999999",
    "--accent": "oklch(26.9% 0 0)",
    "--accent-foreground": "#ffffff",

    "--success": "#088869",
    "--destructive": "#d40101",
    "--warning": "#f2ae55",
    "--info": "#4b92d9",

    "--radius": "0.5rem",
  },
} as const satisfies Theme;
