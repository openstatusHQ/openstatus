import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  CUSTOM_THEME_VALUE_MAX_LENGTH,
  formatThemeVars,
  generatePageStyles,
  generateThemeStyles,
  generateThemeVarsTemplate,
  hasCustomTheme,
  parseThemeVarsText,
  sanitizeCustomTheme,
  THEME_VAR_NAMES,
  THEMES,
  validateCustomTheme,
} from "../index";

describe("hasCustomTheme", () => {
  test("false for null / undefined / empty modes", () => {
    expect(hasCustomTheme(null)).toBe(false);
    expect(hasCustomTheme(undefined)).toBe(false);
    expect(hasCustomTheme({})).toBe(false);
    expect(hasCustomTheme({ light: {}, dark: {} })).toBe(false);
  });

  test("true when either mode has a var", () => {
    expect(hasCustomTheme({ light: { "--primary": "red" } })).toBe(true);
    expect(hasCustomTheme({ dark: { "--primary": "pink" } })).toBe(true);
  });
});

describe("validateCustomTheme", () => {
  test("valid for known vars with safe values", () => {
    expect(
      validateCustomTheme({
        light: { "--primary": "oklch(0.6 0.1 250)" },
        dark: { "--radius": "0.5rem" },
      }),
    ).toEqual({ valid: true });
  });

  test("rejects unknown var names", () => {
    const result = validateCustomTheme({
      light: { "--not-a-var": "red" },
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.join()).toContain(
        'Unknown CSS variable "--not-a-var"',
      );
    }
  });

  test("rejects values with style-tag breakout characters", () => {
    for (const value of ["</style>", "red;}", "red{", "a;b"]) {
      const result = validateCustomTheme({ light: { "--primary": value } });
      expect(result.valid).toBe(false);
    }
  });

  test("rejects empty and over-long values", () => {
    expect(validateCustomTheme({ light: { "--primary": "  " } }).valid).toBe(
      false,
    );
    expect(
      validateCustomTheme({
        light: {
          "--primary": "a".repeat(CUSTOM_THEME_VALUE_MAX_LENGTH + 1),
        },
      }).valid,
    ).toBe(false);
  });
});

describe("sanitizeCustomTheme", () => {
  test("keeps valid vars and trims values", () => {
    expect(
      sanitizeCustomTheme({ light: { "--primary": " hotpink " } }),
    ).toEqual({ light: { "--primary": "hotpink" }, dark: {} });
  });

  test("drops unknown vars and unsafe values", () => {
    const sanitized = sanitizeCustomTheme({
      light: { "--evil": "red", "--primary": "red;} </style>" },
      dark: { "--primary": "pink" },
    });
    expect(sanitized).toEqual({ light: {}, dark: { "--primary": "pink" } });
  });
});

describe("parseThemeVarsText", () => {
  test("parses one declaration per line, with or without semicolon", () => {
    const { vars, errors } = parseThemeVarsText(
      "--primary: hsl(24 94% 50%);\n--radius: 0.5rem",
    );
    expect(errors).toEqual([]);
    expect(vars).toEqual({
      "--primary": "hsl(24 94% 50%)",
      "--radius": "0.5rem",
    });
  });

  test("ignores blank lines and comment lines", () => {
    const { vars, errors } = parseThemeVarsText(
      "\n/* --background: ; */\n--primary: red;\n  \n",
    );
    expect(errors).toEqual([]);
    expect(vars).toEqual({ "--primary": "red" });
  });

  test("reports malformed lines and unknown vars", () => {
    const { vars, errors } = parseThemeVarsText(
      "not a declaration\n--nope: red;\n--primary: blue;",
    );
    expect(vars).toEqual({ "--primary": "blue" });
    expect(errors.length).toBe(2);
    expect(errors.join()).toContain("Invalid declaration");
    expect(errors.join()).toContain('Unknown CSS variable "--nope"');
  });

  test("empty input parses to no vars", () => {
    expect(parseThemeVarsText("")).toEqual({ vars: {}, errors: [] });
  });
});

describe("formatThemeVars", () => {
  test("round-trips with parseThemeVarsText", () => {
    const vars = { "--primary": "red", "--radius": "0.5rem" } as const;
    expect(parseThemeVarsText(formatThemeVars(vars)).vars).toEqual(vars);
  });

  test("empty / nullish vars format to an empty string", () => {
    expect(formatThemeVars({})).toBe("");
    expect(formatThemeVars(null)).toBe("");
  });
});

describe("generateThemeVarsTemplate", () => {
  test("lists every supported css var once", () => {
    const template = generateThemeVarsTemplate(THEMES.default, "light");
    for (const name of THEME_VAR_NAMES) {
      const occurrences = template.split(`${name}: `).length - 1;
      expect(occurrences).toBe(1);
    }
  });

  test("comments out vars the theme leaves unset", () => {
    const template = generateThemeVarsTemplate(THEMES.default, "light");
    expect(template).toContain("/* --chart-1: ; */");
    expect(template).not.toContain("--chart-1: ;\n");
  });

  test("pre-fills values from the given theme and mode", () => {
    const light = generateThemeVarsTemplate(THEMES.default, "light");
    const dark = generateThemeVarsTemplate(THEMES.default, "dark");
    expect(light).toContain(
      `--background: ${THEMES.default.light["--background"]};`,
    );
    expect(dark).toContain(
      `--background: ${THEMES.default.dark["--background"]};`,
    );
  });

  test("parses back without errors", () => {
    const template = generateThemeVarsTemplate(THEMES.default, "light");
    expect(parseThemeVarsText(template).errors).toEqual([]);
  });
});

describe("generatePageStyles", () => {
  test("returns plain theme styles without a custom theme", () => {
    expect(generatePageStyles({ themeKey: "default" })).toBe(
      generateThemeStyles("default"),
    );
    expect(
      generatePageStyles({ themeKey: "default", customTheme: { light: {} } }),
    ).toBe(generateThemeStyles("default"));
  });

  test("merges custom vars over the theme so they win", () => {
    const styles = generatePageStyles({
      themeKey: "default",
      customTheme: { light: { "--primary": "hotpink" } },
    });
    expect(styles).toContain("--primary: hotpink;");
    expect(styles).not.toContain(
      `--primary: ${THEMES.default.light["--primary"]};`,
    );
  });

  test("drops unsafe values from stored data", () => {
    const styles = generatePageStyles({
      themeKey: "default",
      customTheme: { light: { "--primary": "red;} </style>" } },
    });
    expect(styles).not.toContain("</style");
  });

  test("falls back to the default theme for unknown keys", () => {
    expect(generatePageStyles({ themeKey: "does-not-exist" })).toBe(
      generateThemeStyles(undefined),
    );
  });
});
