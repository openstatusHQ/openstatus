import type { ThemeDefinition, ThemeVarName, ThemeVars } from "./types";
import { THEME_VAR_NAMES } from "./types";

/** Per-mode CSS variable overrides merged over the selected theme. */
export type CustomTheme = Partial<ThemeDefinition>;

export const CUSTOM_THEME_VALUE_MAX_LENGTH = 256;

const THEME_VAR_NAME_SET = new Set<string>(THEME_VAR_NAMES);

// Values are rendered into an inline <style> tag as `--name: value;` —
// ban everything that could terminate the declaration, the block or the tag.
const SAFE_VALUE_REGEX = /^[^<{};\u0000-\u001f]+$/;

export function hasCustomTheme(
  customTheme: CustomTheme | null | undefined,
): customTheme is CustomTheme {
  if (!customTheme || typeof customTheme !== "object") return false;
  return (
    Object.keys(customTheme.light ?? {}).length > 0 ||
    Object.keys(customTheme.dark ?? {}).length > 0
  );
}

export type CustomThemeValidation =
  | { valid: true }
  | { valid: false; errors: string[] };

type LooseThemeVars = Record<string, string>;
type LooseCustomTheme = { light?: LooseThemeVars; dark?: LooseThemeVars };

function validateVarEntry(name: string, value: string): string[] {
  const errors: string[] = [];
  if (!THEME_VAR_NAME_SET.has(name)) {
    errors.push(`Unknown CSS variable "${name}".`);
    return errors;
  }
  if (value.length > CUSTOM_THEME_VALUE_MAX_LENGTH) {
    errors.push(
      `Value of "${name}" must be at most ${CUSTOM_THEME_VALUE_MAX_LENGTH} characters.`,
    );
  }
  if (value.trim().length === 0) {
    errors.push(`Value of "${name}" must not be empty.`);
  } else if (!SAFE_VALUE_REGEX.test(value)) {
    errors.push(`Value of "${name}" contains unsupported characters.`);
  }
  return errors;
}

/** Validates var names against the supported set and values for safe characters. */
export function validateCustomTheme(
  customTheme: LooseCustomTheme,
): CustomThemeValidation {
  const errors: string[] = [];
  for (const mode of ["light", "dark"] as const) {
    for (const [name, value] of Object.entries(customTheme[mode] ?? {})) {
      errors.push(...validateVarEntry(name, value));
    }
  }
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/** Drops unknown vars and unsafe values; render-side defense for stored data. */
export function sanitizeCustomTheme(
  customTheme: LooseCustomTheme,
): CustomTheme {
  const pick = (vars: LooseThemeVars | undefined): ThemeVars => {
    const out: ThemeVars = {};
    for (const [name, value] of Object.entries(vars ?? {})) {
      if (validateVarEntry(name, value).length > 0) continue;
      // safe: validateVarEntry checked membership in THEME_VAR_NAMES
      out[name as ThemeVarName] = value.trim();
    }
    return out;
  };
  return { light: pick(customTheme.light), dark: pick(customTheme.dark) };
}

/**
 * Parses editor text — one `--name: value;` declaration per line — into
 * theme vars. Blank lines and comment lines are ignored.
 */
export function parseThemeVarsText(text: string): {
  vars: ThemeVars;
  errors: string[];
} {
  const vars: ThemeVars = {};
  const errors: string[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    if (line.startsWith("/*") && line.endsWith("*/")) continue;
    // manual split instead of a lazy regex over the whole line — the regex
    // form backtracks quadratically on hostile input (CodeQL js/polynomial-redos)
    const colonIndex = line.indexOf(":");
    const name = colonIndex === -1 ? "" : line.slice(0, colonIndex).trimEnd();
    let value = colonIndex === -1 ? "" : line.slice(colonIndex + 1).trim();
    if (value.endsWith(";")) value = value.slice(0, -1).trimEnd();
    if (!/^--[\w-]+$/.test(name) || value.length === 0) {
      errors.push(
        `Invalid declaration "${line}". Expected e.g. --primary: hsl(24 94% 50%);`,
      );
      continue;
    }
    const entryErrors = validateVarEntry(name, value);
    if (entryErrors.length > 0) {
      errors.push(...entryErrors);
      continue;
    }
    // safe: validateVarEntry checked membership in THEME_VAR_NAMES
    vars[name as ThemeVarName] = value.trim();
  }
  return { vars, errors };
}

/** Serializes theme vars back to editor text, one declaration per line. */
export function formatThemeVars(vars: ThemeVars | null | undefined): string {
  return Object.entries(vars ?? {})
    .map(([name, value]) => `${name}: ${value};`)
    .join("\n");
}

/**
 * Editor placeholder listing every supported CSS variable for one mode,
 * pre-filled with the given theme's values (commented out where unset).
 */
export function generateThemeVarsTemplate(
  theme: ThemeDefinition | undefined,
  mode: "light" | "dark",
): string {
  const vars = theme?.[mode] ?? {};
  return THEME_VAR_NAMES.map((name) => {
    const value = vars[name];
    // vars the theme leaves unset are commented out — a saved empty
    // value would override the global default
    return value ? `${name}: ${value};` : `/* ${name}: ; */`;
  }).join("\n");
}
