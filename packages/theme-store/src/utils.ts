import type { Theme } from "./types";

export function assertUniqueThemeIds(themes: Theme[]) {
  const seen = new Set<string>();
  for (const theme of themes) {
    if (seen.has(theme.id)) {
      throw new Error(
        `Duplicate theme ID detected: "${theme.id}" in theme "${theme.name}". All theme IDs must be unique.`,
      );
    }
    seen.add(theme.id);
  }
}
