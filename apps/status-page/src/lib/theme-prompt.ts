import {
  THEME_VAR_NAMES,
  type Theme,
  serializeTheme,
} from "@openstatus/theme-store";

import { THEME_EXPLORER_URL } from "./theme-explorer-host";

export const THEME_BUILDER_URL = `${THEME_EXPLORER_URL}/?b=true`;
export const THEME_SKILL_URL =
  "https://github.com/openstatusHQ/skills/tree/main/skills/openstatus-theme";
export const THEME_SKILL_INSTALL_COMMAND =
  "npx skills add openstatushq/skills --skill openstatus-theme";

const STATUS_VARS = ["--success", "--warning", "--destructive", "--info"];
const BRAND_VARS = [
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
];
const CHART_VARS = THEME_VAR_NAMES.filter((name) =>
  name.startsWith("--chart-"),
);
const RAINBOW_VARS = THEME_VAR_NAMES.filter((name) =>
  name.startsWith("--rainbow-"),
);
const BASE_VARS = THEME_VAR_NAMES.filter(
  (name) =>
    name !== "--radius" &&
    !STATUS_VARS.includes(name) &&
    !BRAND_VARS.includes(name) &&
    !CHART_VARS.includes(name) &&
    !RAINBOW_VARS.includes(name),
);

/** Prompt a user hands to their own agent; the reply pastes back into the builder. */
export function generateThemePrompt(theme: Theme) {
  return `Design a theme for my openstatus status page.

## Brief

<describe your brand, mood, reference palette or the colors you already use>

## Output

Reply with exactly one \`\`\`json code block containing the theme, nothing else in it. I will paste it into the theme builder at ${THEME_BUILDER_URL} (Paste) to preview it on a status page.

Shape:

{
  "id": "kebab-case-id",
  "name": "Display Name",
  "author": { "name": "@handle", "url": "https://..." },
  "light": { "--background": "oklch(100% 0 0)", "--foreground": "oklch(14.5% 0 0)" },
  "dark": { "--background": "oklch(14.5% 0 0)", "--foreground": "oklch(98.5% 0 0)" }
}

## Supported CSS variables

Anything else is dropped. Only override what the theme needs, unset variables fall back to the default openstatus theme.

- Base: ${BASE_VARS.join(", ")}
- Brand: ${BRAND_VARS.join(", ")}
- Status: ${STATUS_VARS.join(", ")} (operational, degraded, outage/error, maintenance)
- Charts, response time percentiles: ${CHART_VARS.join(", ")}
- Regions on the monitor map, rarely worth overriding: ${RAINBOW_VARS[0]} … ${RAINBOW_VARS[RAINBOW_VARS.length - 1]}
- Shape: --radius (a length, e.g. 0rem or 0.625rem)

## Rules

- Values are CSS colors (oklch() preferred; hex, hsl and named colors work) or var(--other-variable) to reuse one. No ; { } < characters, max 256 characters per value.
- Define both light and dark. Tune dark separately: lift lightness and lower chroma of the status colors so they don't burn on a dark background.
- Keep the canvas (base + brand) calm and low-chroma; give the chroma to the four status colors. They must stay distinguishable from each other, also for color-blind readers.
- Body text contrast ≥ 4.5:1 against --background in both modes.
- One coherent look, no "christmas tree".

## Starting point

This is the theme currently in my builder. Refine it unless the brief asks for something else:

\`\`\`json
${serializeTheme(theme, "json")}
\`\`\`

If you can install agent skills, run \`${THEME_SKILL_INSTALL_COMMAND}\` for the full workflow, including contributing the theme to the openstatus repository.
`;
}
