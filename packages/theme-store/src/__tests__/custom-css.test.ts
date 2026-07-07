import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  CUSTOM_CSS_MAX_LENGTH,
  generatePageStyles,
  generateThemeStyles,
  hasCustomCss,
  sanitizeCustomCss,
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
