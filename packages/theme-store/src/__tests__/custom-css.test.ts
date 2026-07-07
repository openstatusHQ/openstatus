import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  CUSTOM_CSS_MAX_LENGTH,
  generateCustomCssTemplate,
  generatePageStyles,
  generateThemeStyles,
  hasCustomCss,
  sanitizeCustomCss,
  THEME_VAR_NAMES,
  THEMES,
  validateCustomCss,
} from "../index";

describe("hasCustomCss", () => {
  test("false for null / undefined / empty / whitespace", () => {
    expect(hasCustomCss(null)).toBe(false);
    expect(hasCustomCss(undefined)).toBe(false);
    expect(hasCustomCss("")).toBe(false);
    expect(hasCustomCss("   \n\t ")).toBe(false);
  });

  test("true for non-empty css", () => {
    expect(hasCustomCss(":root { --primary: red; }")).toBe(true);
  });
});

describe("sanitizeCustomCss", () => {
  test("keeps regular css untouched", () => {
    const css = ":root {\n  --primary: oklch(0.6 0.1 250);\n}";
    expect(sanitizeCustomCss(css)).toBe(css);
  });

  test("keeps the child combinator (>)", () => {
    const css = ".header > .status { --radius: 0; }";
    expect(sanitizeCustomCss(css)).toBe(css);
  });

  test("strips style-tag breakout attempts", () => {
    const sanitized = sanitizeCustomCss(
      ':root { --x: 1; } </style><script>alert("xss")</script>',
    );
    expect(sanitized).not.toContain("<");
    expect(sanitized).not.toContain("</style");
    expect(sanitized).toContain(":root { --x: 1; }");
  });

  test("trims surrounding whitespace", () => {
    expect(sanitizeCustomCss("  .dark { --x: 1; }\n")).toBe(
      ".dark { --x: 1; }",
    );
  });

  test("caps output at CUSTOM_CSS_MAX_LENGTH", () => {
    const long = "a".repeat(CUSTOM_CSS_MAX_LENGTH + 100);
    expect(sanitizeCustomCss(long).length).toBe(CUSTOM_CSS_MAX_LENGTH);
  });
});

describe("validateCustomCss", () => {
  test("valid for empty / whitespace-only input", () => {
    expect(validateCustomCss("")).toEqual({ valid: true });
    expect(validateCustomCss("  \n ")).toEqual({ valid: true });
  });

  test("valid for well-formed declaration blocks", () => {
    expect(
      validateCustomCss(
        ":root { --primary: red; }\n.dark { --primary: pink; }",
      ),
    ).toEqual({ valid: true });
  });

  test("rejects '<' characters", () => {
    const result = validateCustomCss(":root { --x: 1; } </style>");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.join()).toContain("'<'");
    }
  });

  test("rejects unbalanced curly braces", () => {
    const result = validateCustomCss(":root { --primary: red;");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.join()).toContain("unbalanced");
    }
  });

  test("ignores braces inside comments and strings", () => {
    expect(
      validateCustomCss('/* } stray */ :root { --x: "}"; --y: 1; }'),
    ).toEqual({ valid: true });
  });

  test("rejects content without declaration blocks", () => {
    const result = validateCustomCss("--primary: red;");
    expect(result.valid).toBe(false);
  });

  test("rejects input over the max length", () => {
    const long = `:root { --x: ${"a".repeat(CUSTOM_CSS_MAX_LENGTH)}; }`;
    expect(validateCustomCss(long).valid).toBe(false);
  });
});

describe("generateCustomCssTemplate", () => {
  test("lists every supported css var in both blocks", () => {
    const template = generateCustomCssTemplate(THEMES.default);
    for (const name of THEME_VAR_NAMES) {
      const occurrences = template.split(`${name}: `).length - 1;
      expect(occurrences).toBe(2);
    }
  });

  test("comments out vars the theme leaves unset", () => {
    // the default theme defines no chart colors — an empty `--chart-1: ;`
    // would override the global default if the template were saved as-is
    const template = generateCustomCssTemplate(THEMES.default);
    expect(template).toContain("/* --chart-1: ; */");
    expect(template).not.toContain("--chart-1: ;\n");
  });

  test("pre-fills values from the given theme", () => {
    const template = generateCustomCssTemplate(THEMES.default);
    expect(template).toContain(
      `  --background: ${THEMES.default.light["--background"]};`,
    );
    expect(template.startsWith(":root {")).toBe(true);
    expect(template).toContain(".dark {");
  });

  test("passes its own structural validation", () => {
    expect(
      validateCustomCss(generateCustomCssTemplate(THEMES.default)),
    ).toEqual({ valid: true });
  });
});

describe("generatePageStyles", () => {
  test("returns plain theme styles without custom css", () => {
    expect(generatePageStyles({ themeKey: "default" })).toBe(
      generateThemeStyles("default"),
    );
    expect(generatePageStyles({ themeKey: "default", customCss: "  " })).toBe(
      generateThemeStyles("default"),
    );
  });

  test("appends custom css after the theme so it wins the cascade", () => {
    const customCss = ":root { --primary: hotpink; }";
    const styles = generatePageStyles({ themeKey: "default", customCss });
    const themeStyles = generateThemeStyles("default");
    expect(styles.startsWith(themeStyles)).toBe(true);
    expect(styles.indexOf(customCss)).toBeGreaterThan(
      styles.indexOf("--primary:"),
    );
    expect(styles.endsWith(customCss)).toBe(true);
  });

  test("sanitizes the appended custom css", () => {
    const styles = generatePageStyles({
      themeKey: "default",
      customCss: ".dark { --x: 1; } </style>",
    });
    expect(styles).not.toContain("</style");
  });

  test("falls back to the default theme for unknown keys", () => {
    expect(generatePageStyles({ themeKey: "does-not-exist" })).toBe(
      generateThemeStyles(undefined),
    );
  });
});
