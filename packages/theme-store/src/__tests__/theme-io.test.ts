import { readdirSync, readFileSync } from "node:fs";

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
    const dir = new URL("../", import.meta.url);
    const skip = [
      "custom-theme.ts",
      "index.ts",
      "theme-io.ts",
      "types.ts",
      "utils.ts",
    ];
    const parsedIds: string[] = [];
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".ts") || skip.includes(file)) continue;
      const source = readFileSync(new URL(file, dir), "utf8");
      // one literal per `export const`; spreads (default-rounded) aren't parseable
      for (const chunk of source.split(/^export const /m).slice(1)) {
        if (chunk.includes("...")) continue;
        const result = expectOk(parseThemeInput(chunk));
        const theme = THEMES[result.info.id ?? ""];
        expect(
          theme,
          `${file}: unregistered id ${result.info.id}`,
        ).toBeDefined();
        expect(result.definition).toEqual({
          light: theme.light,
          dark: theme.dark,
        });
        expect(result.warnings).toEqual([]);
        parsedIds.push(theme.id);
      }
    }
    expect(parsedIds).toContain("default");
    expect(parsedIds.length).toBeGreaterThanOrEqual(THEME_KEYS.length - 1);
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

  test("ignores a leading comment that contains a brace", () => {
    const result = expectOk(
      parseThemeInput(
        '/** see {@link Theme} */\n// shape: { light, dark }\nexport const X = { light: { "--primary": "red" }, dark: {} } as const satisfies Theme;',
      ),
    );
    expect(result.definition.light).toEqual({ "--primary": "red" });
  });

  test("keeps comment-like characters inside strings", () => {
    const result = expectOk(
      parseThemeInput(
        '{ "author": { "name": "x", "url": "https://x.dev/*" }, "light": { "--primary": "red" }, "dark": {} }',
      ),
    );
    expect(result.info.author?.url).toBe("https://x.dev/*");
  });

  test("matches CSS selectors exactly, not as prefixes", () => {
    const result = expectOk(
      parseThemeInput(
        ".light-theme { --primary: blue; }\n.light { --primary: red; }\n.dark-mode { --primary: blue; }\n.dark { --primary: pink; }",
      ),
    );
    expect(result.definition).toEqual({
      light: { "--primary": "red" },
      dark: { "--primary": "pink" },
    });
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

  test("merges a lone mode instead of wiping the other one", () => {
    const css = expectOk(parseThemeInput(":root {\n  --primary: red;\n}"));
    expect(css.partial).toBe(true);
    expect(css.definition).toEqual({ light: { "--primary": "red" }, dark: {} });

    const json = expectOk(
      parseThemeInput('{ "dark": { "--primary": "red" } }'),
    );
    expect(json.partial).toBe(true);
    expect(json.definition).toEqual({
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
    expect(result.partial).toBe(false);
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
