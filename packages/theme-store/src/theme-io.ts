import { parseThemeVarsText, validateVarEntry } from "./custom-theme";
import type {
  Theme,
  ThemeDefinition,
  ThemeInfo,
  ThemeMode,
  ThemeVarName,
  ThemeVars,
} from "./types";

export type ThemeExportFormat = "ts" | "json" | "css";

export type ParsedThemeInput = {
  info: Partial<ThemeInfo>;
  definition: ThemeDefinition;
  /** Merge into the current theme instead of replacing it (bare declarations, a lone CSS block). */
  partial: boolean;
  /** Dropped vars / values — the rest of the input still applied. */
  warnings: string[];
};

export type ParseThemeInputResult =
  | ({ ok: true } & ParsedThemeInput)
  | { ok: false; error: string };

/**
 * Parses anything a builder, an agent or a theme file hands over: a `Theme`
 * (or `{ light, dark }`) as JSON or as a TS/JS object literal, CSS with
 * `:root { }` / `.dark { }` blocks, or bare `--name: value;` declarations
 * (applied to `fallbackMode`).
 */
export function parseThemeInput(
  text: string,
  fallbackMode: ThemeMode = "light",
): ParseThemeInputResult {
  const source = text.trim();
  if (source.length === 0) return { ok: false, error: "Nothing to paste." };

  const light = cssBlock(source, [":root", ".light"]);
  const dark = cssBlock(source, [".dark"]);
  const parsed =
    light !== undefined || dark !== undefined
      ? parseCssBlocks(light, dark)
      : source.includes("{")
        ? parseObjectLiteral(source, fallbackMode)
        : parseDeclarations(source, fallbackMode);

  if (!parsed.ok) return parsed;

  const hasVars =
    Object.keys(parsed.definition.light).length > 0 ||
    Object.keys(parsed.definition.dark).length > 0;
  if (!hasVars) {
    const detail = parsed.warnings[0] ? ` ${parsed.warnings[0]}` : "";
    return { ok: false, error: `No supported CSS variables found.${detail}` };
  }
  return parsed;
}

function parseDeclarations(
  source: string,
  mode: ThemeMode,
): ParseThemeInputResult {
  const { vars, errors } = parseThemeVarsText(source);
  const definition: ThemeDefinition = { light: {}, dark: {} };
  definition[mode] = vars;
  return { ok: true, info: {}, definition, partial: true, warnings: errors };
}

/** Body of the first `selector { … }`; indexOf instead of a regex (CodeQL js/polynomial-redos). */
function cssBlock(source: string, selectors: string[]) {
  for (const selector of selectors) {
    const start = source.indexOf(selector);
    if (start === -1) continue;
    const open = source.indexOf("{", start + selector.length);
    const close = open === -1 ? -1 : source.indexOf("}", open);
    if (close === -1) continue;
    if (source.slice(start + selector.length, open).trim().length > 0) continue;
    return source.slice(open + 1, close);
  }
  return undefined;
}

function parseCssBlocks(
  light: string | undefined,
  dark: string | undefined,
): ParseThemeInputResult {
  const lightResult = parseThemeVarsText(light ?? "");
  const darkResult = parseThemeVarsText(dark ?? "");
  return {
    ok: true,
    info: {},
    definition: { light: lightResult.vars, dark: darkResult.vars },
    // a lone block must not wipe the other mode
    partial: light === undefined || dark === undefined,
    warnings: [...lightResult.errors, ...darkResult.errors],
  };
}

function parseObjectLiteral(
  source: string,
  fallbackMode: ThemeMode,
): ParseThemeInputResult {
  // drop what precedes the object literal — `import type { Theme }`, comments,
  // code fences and prose would otherwise be read as keys, strings or the first `{`
  const stripped = stripBlockComments(source)
    .replace(/^\s*(?:import\b|\/\/)[^\n]*$/gm, "")
    .replace(/^\s*```[^\n]*$/gm, "")
    .replace(/\bas const\b/g, "");
  const json = toJson(stripped.slice(stripped.indexOf("{")));
  const start = json.indexOf("{");
  const end = json.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return { ok: false, error: "Expected an object with light / dark vars." };
  }

  let value: unknown;
  try {
    value = JSON.parse(json.slice(start, end + 1));
  } catch {
    return {
      ok: false,
      error:
        "Could not parse the configuration. Paste the JSON or the theme file as is.",
    };
  }
  if (!isRecord(value)) {
    return { ok: false, error: "Expected an object with light / dark vars." };
  }

  const warnings: string[] = [];
  const definition: ThemeDefinition = { light: {}, dark: {} };
  let partial = false;

  if (isRecord(value.light) || isRecord(value.dark)) {
    // `{ light }` alone must not wipe dark (and vice versa)
    partial = value.light === undefined || value.dark === undefined;
    for (const mode of ["light", "dark"] as const) {
      const vars = value[mode];
      if (vars === undefined) continue;
      if (!isRecord(vars)) {
        warnings.push(`"${mode}" must be an object of CSS variables.`);
        continue;
      }
      definition[mode] = pickVars(vars, warnings);
    }
  } else if (Object.keys(value).some((key) => key.startsWith("--"))) {
    definition[fallbackMode] = pickVars(value, warnings);
    partial = true;
  } else {
    return { ok: false, error: "Expected an object with light / dark vars." };
  }

  const info: Partial<ThemeInfo> = {};
  if (typeof value.id === "string" && value.id.trim())
    info.id = value.id.trim();
  if (typeof value.name === "string" && value.name.trim()) {
    info.name = value.name.trim();
  }
  if (
    isRecord(value.author) &&
    typeof value.author.name === "string" &&
    typeof value.author.url === "string"
  ) {
    info.author = { name: value.author.name, url: value.author.url };
  }

  return { ok: true, info, definition, partial, warnings };
}

function pickVars(
  input: Record<string, unknown>,
  warnings: string[],
): ThemeVars {
  const vars: ThemeVars = {};
  for (const [name, raw] of Object.entries(input)) {
    if (typeof raw !== "string") {
      warnings.push(`Value of "${name}" must be a string.`);
      continue;
    }
    const errors = validateVarEntry(name, raw);
    if (errors.length > 0) {
      warnings.push(...errors);
      continue;
    }
    // safe: validateVarEntry checked membership in THEME_VAR_NAMES
    vars[name as ThemeVarName] = raw.trim();
  }
  return vars;
}

function stripBlockComments(source: string) {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const start = source.indexOf("/*", i);
    if (start === -1) break;
    const end = source.indexOf("*/", start + 2);
    out += source.slice(i, start);
    if (end === -1) return out;
    i = end + 2;
  }
  return out + source.slice(i);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Rewrites a TS/JS object literal into strict JSON: strips comments, quotes
 * bare keys, normalizes quotes and drops trailing commas. String-aware, so
 * `//` inside an author url survives.
 */
function toJson(source: string): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const ch = source.charAt(i);

    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      let str = "";
      while (j < source.length && source[j] !== ch) {
        if (source[j] === "\\") {
          str += source[j + 1] ?? "";
          j += 2;
          continue;
        }
        str += source.charAt(j);
        j++;
      }
      out += JSON.stringify(str);
      i = j + 1;
      continue;
    }

    if (ch === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      i = end === -1 ? source.length : end + 2;
      continue;
    }

    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < source.length && /[\w$]/.test(source.charAt(j))) j++;
      const word = source.slice(i, j);
      let k = j;
      while (k < source.length && /\s/.test(source.charAt(k))) k++;
      if (source[k] === ":") {
        out += `${JSON.stringify(word)}:`;
        i = k + 1;
      } else {
        out += word;
        i = j;
      }
      continue;
    }

    // comments are already gone from `out`, so a trailing comma is whatever
    // precedes the closing bracket
    if (ch === "}" || ch === "]") out = out.replace(/,\s*$/, "");

    out += ch;
    i++;
  }
  return out;
}

/** Serializes a theme for the clipboard: theme file, JSON or CSS blocks. */
export function serializeTheme(theme: Theme, format: ThemeExportFormat) {
  switch (format) {
    case "json":
      return JSON.stringify(theme, null, 2);
    case "css":
      return `:root {\n${formatBlock(theme.light)}\n}\n.dark {\n${formatBlock(theme.dark)}\n}`;
    case "ts":
      return [
        `// packages/theme-store/src/${theme.id}.ts`,
        `import type { Theme } from "./types";`,
        "",
        `export const ${constName(theme.id)} = {`,
        `  id: ${JSON.stringify(theme.id)},`,
        `  name: ${JSON.stringify(theme.name)},`,
        `  author: { name: ${JSON.stringify(theme.author.name)}, url: ${JSON.stringify(theme.author.url)} },`,
        `  light: {\n${formatObject(theme.light)}\n  },`,
        `  dark: {\n${formatObject(theme.dark)}\n  },`,
        "} as const satisfies Theme;",
      ].join("\n");
  }
}

function constName(id: string) {
  const base = id
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .replace(/_?THEME$/, "");
  return `${base || "MY"}_THEME`;
}

function formatBlock(vars: ThemeVars) {
  return Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");
}

function formatObject(vars: ThemeVars) {
  return Object.entries(vars)
    .map(
      ([name, value]) =>
        `    ${JSON.stringify(name)}: ${JSON.stringify(value)},`,
    )
    .join("\n");
}
