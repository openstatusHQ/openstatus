import { THEME_VAR_NAMES, THEMES } from "@openstatus/theme-store";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  generateThemePrompt,
  THEME_SKILL_INSTALL_COMMAND,
} from "./theme-prompt";

describe("generateThemePrompt", () => {
  const prompt = generateThemePrompt(THEMES.dracula);

  test("lists every supported variable except the rainbow range", () => {
    for (const name of THEME_VAR_NAMES) {
      if (name.startsWith("--rainbow-")) continue;
      expect(prompt).toContain(name);
    }
    expect(prompt).toContain("--rainbow-1 … --rainbow-17");
  });

  test("embeds the current theme and the skill install command", () => {
    expect(prompt).toContain('"id": "dracula"');
    expect(prompt).toContain(THEME_SKILL_INSTALL_COMMAND);
    expect(prompt).toContain("https://themes.openstatus.dev/?b=true");
  });
});
