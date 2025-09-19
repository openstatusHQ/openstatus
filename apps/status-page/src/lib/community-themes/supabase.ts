import type { Theme } from "./types";

export const supabase: Theme = {
  name: "Supabase",
  author: { name: "@supabase", url: "https://supabase.com" },
  light: {
    "--background": "oklch(99.11% 0 0)",
    "--foreground": "oklch(20.46% 0 0)",
    "--border": "oklch(90.37% 0 0)",
    "--input": "oklch(90.37% 0 0)",

    "--primary": "oklch(76.26% 0.154 159.27)",
    "--primary-foreground": "oklch(20.46% 0 0)",
    "--muted": "oklch(97.61% 0 0)",
    "--muted-foreground": "oklch(54.52% 0 0)",
    "--secondary": "oklch(97.61% 0 0)",
    "--secondary-foreground": "oklch(20.46% 0 0)",
    "--accent": "oklch(97.61% 0 0)",
    "--accent-foreground": "oklch(20.46% 0 0)",

    "--success": "oklch(76.26% 0.154 159.27)",
    "--destructive": "oklch(62.71% 0.1936 33.34)",
    "--warning": "oklch(81.69% 0.1639 75.84)",
    "--info": "oklch(61.26% 0.218 283.85)",
  },
  dark: {
    "--background": "oklch(18.22% 0 0)",
    "--foreground": "oklch(98.51% 0 0)",
    "--border": "oklch(30.12% 0 0)",
    "--input": "oklch(30.12% 0 0)",

    "--primary": "oklch(68.56% 0.1558 158.13)",
    "--primary-foreground": "oklch(18.22% 0 0)",
    "--muted": "oklch(26.03% 0 0)",
    "--muted-foreground": "oklch(63.01% 0 0)",
    "--secondary": "oklch(26.03% 0 0)",
    "--secondary-foreground": "oklch(98.51% 0 0)",
    "--accent": "oklch(26.03% 0 0)",
    "--accent-foreground": "oklch(98.51% 0 0)",

    "--success": "oklch(68.56% 0.1558 158.13)",
    "--destructive": "oklch(62.71% 0.1936 33.34)",
    "--warning": "oklch(70.84% 0.1523 71.24)",
    "--info": "oklch(61.26% 0.218 283.85)",
  },
};
