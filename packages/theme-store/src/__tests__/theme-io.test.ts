import { readFileSync } from "node:fs";

import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  parseThemeInput,
  serializeTheme,
  THEME_KEYS,
  THEMES,
  type Theme,
} from "../index";

function expectOk(result: ReturnType<typeof parseThemeInput>) {
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe("parseThemeInput", () => {
  test("round-trips every registered theme through each export format", () => {
    for (const key of THEME_KEYS) {
      const theme = THEMES[key];
      for (const format of ["ts", "json", "css"] as const) {
        const result = expectOk(parseThemeInput(serializeTheme(theme, format)));
        expect(result.definition).toEqual({
          light: theme.light,
          dark: theme.dark,
        });
        expect(result.warnings).toEqual([]);
        if (format !== "css") {
          expect(result.info).toEqual({
            id: theme.id,
            name: theme.name,
            author: theme.author,
          });
        }
      }
    }
  });

  test("parses the theme source files as they are checked in", () => {
    const files: Record<string, string> = {
      default: "openstatus",
      "github-contrast": "github",
    };
    for (const key of THEME_KEYS) {
      if (key === "default-rounded") continue; // shares openstatus.ts
      const theme = THEMES[key];
      const file = files[key] ?? key;
      const source = readFileSync(
        new URL(`../${file}.ts`, import.meta.url),
        "utf8",
      );
      // openstatus.ts holds two themes; the first object literal is the plain one
      const single =
        key === "default"
          ? source.slice(0, source.indexOf("OPENSTATUS_ROUNDED_THEME"))
          : source;
      const result = expectOk(parseThemeInput(single));
      expect(result.info.id).toBe(theme.id);
      expect(result.definition).toEqual({
        light: theme.light,
        dark: theme.dark,
      });
      expect(result.warnings).toEqual([]);
    }
  });

  test("accepts a bare { light, dark } definition", () => {
    const result = expectOk(
      parseThemeInput(
        '{ "light": { "--primary": "red" }, "dark": { "--primary": "pink" } }',
      ),
    );
    expect(result.info).toEqual({});
    expect(result.partial).toBe(false);
    expect(result.definition).toEqual({
      light: { "--primary": "red" },
      dark: { "--primary": "pink" },
    });
  });

  test("accepts an agent reply wrapped in a markdown code fence", () => {
    const result = expectOk(
      parseThemeInput(
        'Here you go:\n```json\n{ "id": "nord", "name": "Nord", "light": { "--primary": "#5e81ac" }, "dark": {} }\n```\nLet me know!',
      ),
    );
    expect(result.info.id).toBe("nord");
    expect(result.definition.light).toEqual({ "--primary": "#5e81ac" });
  });

  test("applies bare declarations and flat objects to the fallback mode", () => {
    const declarations = expectOk(
      parseThemeInput("--primary: red;\n--radius: 0.5rem", "dark"),
    );
    expect(declarations.partial).toBe(true);
    expect(declarations.definition).toEqual({
      light: {},
      dark: { "--primary": "red", "--radius": "0.5rem" },
    });

    const flat = expectOk(parseThemeInput('{ "--primary": "red" }', "dark"));
    expect(flat.partial).toBe(true);
    expect(flat.definition).toEqual({
      light: {},
      dark: { "--primary": "red" },
    });
  });

  test("reads :root / .dark CSS blocks", () => {
    const result = expectOk(
      parseThemeInput(
        ":root {\n  --primary: oklch(0.6 0.1 250);\n}\n.dark {\n  --primary: oklch(0.8 0.1 250);\n}",
      ),
    );
    expect(result.definition).toEqual({
      light: { "--primary": "oklch(0.6 0.1 250)" },
      dark: { "--primary": "oklch(0.8 0.1 250)" },
    });
  });

  test("drops unknown vars and unsafe values with a warning", () => {
    const result = expectOk(
      parseThemeInput(
        '{ "light": { "--primary": "red", "--nope": "blue", "--info": "</style>" } }',
      ),
    );
    expect(result.definition.light).toEqual({ "--primary": "red" });
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings.join()).toContain('Unknown CSS variable "--nope"');
  });

  test("fails when nothing usable was found", () => {
    expect(parseThemeInput("").ok).toBe(false);
    expect(parseThemeInput("hello world").ok).toBe(false);
    expect(parseThemeInput('{ "name": "x" }').ok).toBe(false);
    expect(parseThemeInput("{ light: { --nope: red } }").ok).toBe(false);
    expect(parseThemeInput("{ light: [1, 2] }").ok).toBe(false);
  });
});

describe("serializeTheme", () => {
  const theme = {
    id: "my-theme",
    name: "My Theme",
    author: { name: "@me", url: "https://example.com" },
    light: { "--primary": "red" },
    dark: { "--primary": "pink" },
  } satisfies Theme;

  test("ts names the export after the id", () => {
    const ts = serializeTheme(theme, "ts");
    expect(ts).toContain("export const MY_THEME = {");
    expect(ts).toContain("packages/theme-store/src/my-theme.ts");
    expect(ts).toContain("} as const satisfies Theme;");
  });

  test("css emits :root and .dark blocks", () => {
    expect(serializeTheme(theme, "css")).toBe(
      ":root {\n  --primary: red;\n}\n.dark {\n  --primary: pink;\n}",
    );
  });
});
