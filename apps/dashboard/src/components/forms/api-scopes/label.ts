import {
  type ScopeGroup,
  type ScopePreset,
  type SettableScope,
  scopeGroup,
  scopeGroups,
  scopePresets,
} from "@openstatus/db/src/schema/api-keys/constants";

export const presetLabels = {
  read: "Read only",
  write: "Read & write",
} as const satisfies Record<ScopePreset, string>;

export const groupLabels = {
  monitors: "Monitors",
  pages: "Status pages",
  incidents: "Incidents",
  notifications: "Notifications",
  subscribers: "Subscribers",
} as const satisfies Record<ScopeGroup, string>;

export function sameScopes(
  a: readonly string[],
  b: readonly string[],
): boolean {
  const set = new Set(a);
  return set.size === new Set(b).size && b.every((s) => set.has(s));
}

/** Client mirror of `matchesScope` for settable scopes only; `*` and `admin` never reach the browser. */
export function coveredBy(
  held: readonly string[],
  scope: SettableScope,
): boolean {
  for (const h of held) {
    if (h === scope || h === "write") return true;
    if (h === "read") {
      if (scope.endsWith(":read")) return true;
      continue;
    }
    const group = scopeGroup(h);
    if (group && h === `${group}:write` && scope === `${group}:read`) {
      return true;
    }
  }
  return false;
}

export function coversAll(
  held: readonly string[],
  scopes: readonly SettableScope[],
): boolean {
  return scopes.every((s) => coveredBy(held, s));
}

export function matchPreset(scopes: readonly string[]): ScopePreset | null {
  for (const id of Object.keys(scopePresets) as ScopePreset[]) {
    if (sameScopes(scopes, scopePresets[id])) return id;
  }
  return null;
}

export function scopeLabel(scopes: readonly string[]): string {
  if (scopes.includes("*")) {
    console.warn(
      "[scopes] row carries '*' scope — should never happen via the public API",
    );
    return "Admin";
  }
  const preset = matchPreset(scopes);
  return preset ? presetLabels[preset] : "Custom";
}

/** Effective access per group, e.g. `monitors: write`; groups without access are omitted. */
export function scopeChips(scopes: readonly string[]): string[] {
  const chips: string[] = [];
  for (const group of scopeGroups) {
    if (coveredBy(scopes, `${group}:write`)) chips.push(`${group}: write`);
    else if (coveredBy(scopes, `${group}:read`)) chips.push(`${group}: read`);
  }
  return chips;
}

/** Umbrella scopes spelled out per group so the Custom grid can edit them. */
export function expandScopes(
  scopes: readonly SettableScope[],
): SettableScope[] {
  const out: SettableScope[] = [];
  for (const group of scopeGroups) {
    if (coveredBy(scopes, `${group}:write`)) out.push(`${group}:write`);
    else if (coveredBy(scopes, `${group}:read`)) out.push(`${group}:read`);
  }
  return out;
}
