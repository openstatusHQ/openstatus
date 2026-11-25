import { type Theme, parseThemeInput } from "@openstatus/theme-store";

/** Set by the explorer, read by `FloatingTheme` to preview a builder theme on `/status`. */
export const THEME_DRAFT_STORAGE_KEY = "community-theme-draft";

export function saveThemeDraft(theme: Theme) {
  sessionStorage.setItem(THEME_DRAFT_STORAGE_KEY, JSON.stringify(theme));
}

export function clearThemeDraft() {
  sessionStorage.removeItem(THEME_DRAFT_STORAGE_KEY);
}

/** Re-validates on read so a hand-edited storage entry can't inject styles. */
export function readThemeDraft(): Theme | null {
  const raw = sessionStorage.getItem(THEME_DRAFT_STORAGE_KEY);
  if (!raw) return null;
  const result = parseThemeInput(raw);
  if (!result.ok) return null;
  return {
    id: result.info.id ?? "draft",
    name: result.info.name ?? "Draft",
    author: result.info.author ?? { name: "", url: "" },
    ...result.definition,
  };
}
